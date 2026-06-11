import { nanoid } from 'nanoid';
import { writeQueue, runQuery, getOne, getAll } from '../db/init.js';
import { bus } from '../events.js';
import * as ruflo from './ruflo.js';
import { spawnAgent, terminateAgent, getAgentsBySwarm } from './agentManager.js';
import { createVm, destroyVm, listVms } from './vmProvisioner.js';
import { evaluateScaling } from './scalingPolicy.js';

const scalingLocks = new Map();
let scalingTimer = null;

export async function createSwarm(userId, { name, policy = {}, targetAgentCount = 1 }) {
  const id = nanoid();
  const created_at = Date.now();
  const policyStr = typeof policy === 'string' ? policy : JSON.stringify(policy);

  await writeQueue(() => {
    runQuery(
      'INSERT INTO swarms (id, user_id, name, status, policy, target_agent_count, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, userId, name, 'inactive', policyStr, targetAgentCount, created_at]
    );
  });

  try {
    await ruflo.initRufloSwarm(name, 'hierarchical', targetAgentCount);
  } catch (err) {
    console.warn('[swarmController] ruflo initSwarm failed:', err.message);
  }

  return getOne('SELECT * FROM swarms WHERE id = ?', [id]);
}

export async function activateSwarm(swarmId) {
  const swarm = getOne('SELECT * FROM swarms WHERE id = ?', [swarmId]);
  if (!swarm) throw new Error('Swarm not found');

  await writeQueue(() => {
    runQuery("UPDATE swarms SET status = 'active' WHERE id = ?", [swarmId]);
  });

  const agents = getAgentsBySwarm(swarmId).filter(a => a.status !== 'terminated');
  const needed = swarm.target_agent_count - agents.length;

  const spawns = [];
  for (let i = 0; i < needed; i++) {
    spawns.push(spawnAgent({ swarmId, type: 'worker' }));
  }
  await Promise.allSettled(spawns);

  bus.emit('swarm:scaled', { swarmId, action: 'activated' });
  return getOne('SELECT * FROM swarms WHERE id = ?', [swarmId]);
}

export async function deactivateSwarm(swarmId) {
  const agents = getAgentsBySwarm(swarmId).filter(a => a.status !== 'terminated');
  await Promise.allSettled(agents.map(a => terminateAgent(a.id)));

  await writeQueue(() => {
    runQuery("UPDATE swarms SET status = 'inactive' WHERE id = ?", [swarmId]);
  });

  bus.emit('swarm:scaled', { swarmId, action: 'deactivated' });
}

export async function getSwarmStatus(swarmId) {
  const swarm = getOne('SELECT * FROM swarms WHERE id = ?', [swarmId]);
  if (!swarm) return null;

  const agents = getAgentsBySwarm(swarmId);
  const vms = listVms(swarmId);
  const activeAgents = agents.filter(a => a.status !== 'terminated');
  const activeVms = vms.filter(v => v.status !== 'terminated');

  return {
    ...swarm,
    policy: (() => { try { return JSON.parse(swarm.policy); } catch { return {}; } })(),
    agentCount: activeAgents.length,
    vmCount: activeVms.length,
    agents: activeAgents,
    vms: activeVms
  };
}

export async function evaluateAndScale(swarmId) {
  if (scalingLocks.get(swarmId)) return;
  scalingLocks.set(swarmId, true);

  try {
    const swarm = getOne("SELECT * FROM swarms WHERE id = ? AND status = 'active'", [swarmId]);
    if (!swarm) return;

    const agents = getAgentsBySwarm(swarmId).filter(a => a.status !== 'terminated');
    const vms = listVms(swarmId).filter(v => v.status !== 'terminated');
    const tasks = getAll("SELECT * FROM tasks WHERE swarm_id = ? AND status = 'queued'", [swarmId]);

    // Don't scale beyond target_agent_count
    if (agents.length >= swarm.target_agent_count) return;

    const policy = (() => { try { return JSON.parse(swarm.policy); } catch { return {}; } })();
    // Use policy.simulatedLoad if set; otherwise derive from queue depth only — no random noise
    const avgLoad = policy.simulatedLoad ?? (tasks.length > 0 ? 90 : 10);

    const decision = evaluateScaling({
      agentCount: agents.length,
      vmCount: vms.length,
      avgLoad,
      queueDepth: tasks.length,
      policy: { ...policy, maxAgents: swarm.target_agent_count }
    });

    if (decision.action === 'none') return;

    if (decision.action === 'scale_up') {
      const vm = await createVm(swarmId, { instanceType: 'cx22' });
      for (let i = 0; i < decision.delta; i++) {
        await spawnAgent({ swarmId, type: 'worker', vmId: vm.id });
      }
    } else if (decision.action === 'spawn_agents') {
      for (let i = 0; i < decision.delta; i++) {
        await spawnAgent({ swarmId, type: 'worker' });
      }
    } else if (decision.action === 'scale_down') {
      const toTerminate = agents.slice(-decision.delta);
      for (const agent of toTerminate) {
        await terminateAgent(agent.id);
        if (agent.vm_id) await destroyVm(agent.vm_id);
      }
    }

    bus.emit('swarm:scaled', { swarmId, action: decision.action, reason: decision.reason, delta: decision.delta });

    const eventId = nanoid();
    await writeQueue(() => {
      runQuery(
        'INSERT INTO swarm_events (id, swarm_id, event_type, payload, created_at) VALUES (?, ?, ?, ?, ?)',
        [eventId, swarmId, 'scaling', JSON.stringify(decision), Date.now()]
      );
    });
  } catch (err) {
    console.error('[swarmController] evaluateAndScale error:', err.message);
  } finally {
    scalingLocks.delete(swarmId);
  }
}

export function startScalingLoop(intervalMs = 30000) {
  scalingTimer = setInterval(async () => {
    const swarms = getAll("SELECT id FROM swarms WHERE status = 'active'");
    for (const swarm of swarms) {
      await evaluateAndScale(swarm.id);
    }
  }, intervalMs);
  return scalingTimer;
}

export function stopScalingLoop() {
  if (scalingTimer) {
    clearInterval(scalingTimer);
    scalingTimer = null;
  }
}
