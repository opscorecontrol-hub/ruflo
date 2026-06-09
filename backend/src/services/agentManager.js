import { nanoid } from 'nanoid';
import { writeQueue, runQuery, getOne, getAll } from '../db/init.js';
import { bus } from '../events.js';
import * as ruflo from './ruflo.js';

export async function spawnAgent({ swarmId, type = 'worker', vmId = null }) {
  const id = nanoid();
  const created_at = Date.now();

  await writeQueue(() => {
    runQuery(
      'INSERT INTO agents (id, swarm_id, vm_id, type, status, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [id, swarmId, vmId, type, 'spawning', created_at]
    );
  });

  let rufloId = null;
  try {
    const result = await ruflo.spawnRufloAgent(type, `agent-${id.slice(0, 8)}`);
    rufloId = result?.agentId || result?.id || null;
  } catch (err) {
    console.warn('[agentManager] ruflo spawn failed:', err.message);
  }

  await writeQueue(() => {
    runQuery(
      'UPDATE agents SET ruflo_id = ?, status = ? WHERE id = ?',
      [rufloId, 'idle', id]
    );
  });

  const eventId = nanoid();
  await writeQueue(() => {
    runQuery(
      'INSERT INTO swarm_events (id, swarm_id, agent_id, vm_id, event_type, payload, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [eventId, swarmId, id, vmId, 'agent_spawned', JSON.stringify({ type, rufloId }), Date.now()]
    );
  });

  const agent = getOne('SELECT * FROM agents WHERE id = ?', [id]);
  bus.emit('agent:status', { agentId: id, swarmId, status: 'idle', type });
  return agent;
}

export async function terminateAgent(agentId) {
  const agent = getOne('SELECT * FROM agents WHERE id = ?', [agentId]);
  if (!agent) return;

  await writeQueue(() => {
    runQuery("UPDATE agents SET status = 'terminated' WHERE id = ?", [agentId]);
  });

  if (agent.ruflo_id) {
    try {
      await ruflo.terminateRufloAgent(agent.ruflo_id);
    } catch (err) {
      console.warn('[agentManager] ruflo terminate failed:', err.message);
    }
  }

  const eventId = nanoid();
  await writeQueue(() => {
    runQuery(
      'INSERT INTO swarm_events (id, swarm_id, agent_id, event_type, payload, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [eventId, agent.swarm_id, agentId, 'agent_terminated', '{}', Date.now()]
    );
  });

  bus.emit('agent:status', { agentId, swarmId: agent.swarm_id, status: 'terminated' });
}

export async function heartbeat(agentId) {
  const now = Date.now();
  await writeQueue(() => {
    runQuery('UPDATE agents SET last_heartbeat = ? WHERE id = ?', [now, agentId]);
  });
  bus.emit('agent:heartbeat', { agentId, ts: now });
}

export function getAgentsBySwarm(swarmId) {
  return getAll('SELECT * FROM agents WHERE swarm_id = ? ORDER BY created_at DESC', [swarmId]);
}

export function getAgentById(id) {
  return getOne('SELECT * FROM agents WHERE id = ?', [id]);
}
