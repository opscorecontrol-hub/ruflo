import { nanoid } from 'nanoid';
import { getAll, getOne, writeQueue, runQuery } from '../db/init.js';
import { bus } from '../events.js';
import { spawnAgent, terminateAgent } from '../services/agentManager.js';
import { createSwarm, activateSwarm, deactivateSwarm } from '../services/swarmController.js';
import { createMonitor, updateMonitor } from '../services/monitors.js';

const RUFLO_MCP_URL = process.env.RUFLO_MCP_URL || 'http://ruflo-mcp-bridge:3001';

async function askRuflo(message, ctx) {
  try {
    const ctxSummary = [
      `Swarms: ${ctx.swarms.length} (${ctx.swarms.filter(s => s.status === 'active').length} active)`,
      `Agents: ${ctx.agents.length} (${ctx.agents.filter(a => a.status === 'busy').length} busy)`,
      `Monitors: ${ctx.monitors.length} (${ctx.monitors.filter(m => m.status === 'up').length} up)`,
      `VMs: ${ctx.vms.length} (${ctx.vms.filter(v => v.status === 'running').length} running)`,
      `Active tasks: ${ctx.tasks.length}`,
    ].join('\n');

    const res = await fetch(`${RUFLO_MCP_URL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 400,
        messages: [
          {
            role: 'system',
            content: `You are the AI assistant for Blackbird 2030, an agent orchestration platform. Be concise and helpful.\n\nCurrent system state:\n${ctxSummary}\n\nAvailable commands the user can type:\n- \`create swarm <name>\` — create a new swarm\n- \`activate swarm <name>\` — activate a swarm\n- \`spawn <n> agents [in <swarm>]\` — spawn agents\n- \`terminate agent <id>\` — stop an agent\n- \`monitor <url>\` or \`add monitor <name> <url>\` — add uptime monitor\n- \`status\` — system overview`,
          },
          { role: 'user', content: message },
        ],
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.choices?.[0]?.message?.content?.trim() || null;
  } catch {
    return null;
  }
}

function buildCtx() {
  const swarms = getAll('SELECT id, name, status, target_agent_count FROM swarms ORDER BY created_at DESC LIMIT 10', []);
  const agents = getAll("SELECT id, swarm_id, type, status FROM agents WHERE status != 'terminated' ORDER BY created_at DESC LIMIT 50", []);
  const monitors = getAll('SELECT id, name, url, status FROM monitors ORDER BY created_at DESC LIMIT 10', []);
  const vms = getAll('SELECT id, provider, status, ip_address FROM vms ORDER BY created_at DESC LIMIT 10', []);
  const tasks = getAll("SELECT id, status FROM tasks WHERE status IN ('queued','running') ORDER BY created_at DESC LIMIT 10", []);
  return { swarms, agents, monitors, vms, tasks };
}

async function executeAction(message, userId, ctx) {
  const raw = message.trim();
  const m = raw.toLowerCase();

  // CREATE SWARM — "create swarm Alpha" / "new swarm Alpha" / "make swarm called Alpha"
  const createSwarmRx = /(?:create|new|make|add|start)\s+(?:a\s+)?swarm(?:\s+(?:called|named|:)?\s*)(.+)/i;
  const csm = raw.match(createSwarmRx);
  if (csm) {
    const name = csm[1].replace(/^["']|["']$/g, '').trim();
    if (!name) return 'Provide a swarm name. Example: `create swarm Alpha`';
    const swarm = await createSwarm(userId, { name, targetAgentCount: 3 });
    bus.emit('log:entry', { level: 'success', message: `[workspace] Created swarm "${name}"` });
    return `**Swarm created** ✓\n\n**${swarm.name}** \`${swarm.id.slice(0, 8)}\` — inactive, 3 target agents.\n\nType \`activate swarm ${name}\` to start it and spawn agents.`;
  }

  // ACTIVATE SWARM — "activate swarm Alpha" / "start Alpha"
  const activateRx = /(?:activate|start|launch|enable|run)\s+(?:swarm\s+)?(.+)/i;
  const am = raw.match(activateRx);
  if (am && !m.startsWith('spawn') && !m.startsWith('start a') && !m.startsWith('start new')) {
    const query = am[1].trim().toLowerCase();
    const swarm = ctx.swarms.find(s =>
      s.name.toLowerCase().includes(query) || s.id.startsWith(query)
    );
    if (!swarm) {
      const names = ctx.swarms.map(s => `**${s.name}**`).join(', ') || 'none';
      return `Swarm \`${am[1].trim()}\` not found. Available: ${names}`;
    }
    if (swarm.status === 'active') return `Swarm **${swarm.name}** is already active.`;
    await activateSwarm(swarm.id);
    bus.emit('log:entry', { level: 'success', message: `[workspace] Activated swarm "${swarm.name}"` });
    return `**Swarm activated** ✓\n\n**${swarm.name}** is now active. Agents are spawning in the background.`;
  }

  // DEACTIVATE SWARM — "deactivate swarm Alpha" / "stop swarm Alpha"
  const deactivateRx = /(?:deactivate|stop|pause|kill)\s+(?:swarm\s+)?(.+)/i;
  const dm = raw.match(deactivateRx);
  if (dm && !m.startsWith('stop monitor') && !m.startsWith('kill agent')) {
    const query = dm[1].trim().toLowerCase();
    const swarm = ctx.swarms.find(s =>
      s.name.toLowerCase().includes(query) || s.id.startsWith(query)
    );
    if (!swarm) return `Swarm \`${dm[1].trim()}\` not found.`;
    if (swarm.status !== 'active') return `Swarm **${swarm.name}** is not active.`;
    await deactivateSwarm(swarm.id);
    bus.emit('log:entry', { level: 'warn', message: `[workspace] Deactivated swarm "${swarm.name}"` });
    return `**Swarm deactivated** ✓\n\n**${swarm.name}** has been stopped and agents terminated.`;
  }

  // SPAWN AGENTS — "spawn 5 agents" / "spawn 3 worker agents in Alpha"
  const spawnRx = /(?:spawn|create|add)\s+(\d+)\s+(?:(?:worker|coordinator|analyst|researcher)\s+)?agents?(?:\s+(?:in|for|into)\s+(.+))?/i;
  const sm = raw.match(spawnRx);
  if (sm) {
    const count = Math.min(parseInt(sm[1]) || 1, 20);
    const swarmQuery = sm[2]?.trim().toLowerCase();
    const swarm = swarmQuery
      ? ctx.swarms.find(s => s.name.toLowerCase().includes(swarmQuery) || s.id.startsWith(swarmQuery))
      : ctx.swarms.find(s => s.status === 'active') || ctx.swarms[0];
    if (!swarm) return `No ${swarmQuery ? `swarm matching "${sm[2].trim()}"` : 'swarm'} found. Create one first: \`create swarm <name>\``;
    for (let i = 0; i < count; i++) {
      await spawnAgent({ swarmId: swarm.id, type: 'worker' });
    }
    bus.emit('log:entry', { level: 'success', message: `[workspace] Spawned ${count} agents in "${swarm.name}"` });
    return `**${count} agent${count > 1 ? 's' : ''} spawned** ✓\n\nAdded **${count}** worker agent${count > 1 ? 's' : ''} to **${swarm.name}**.`;
  }

  // TERMINATE AGENT — "terminate agent abc12345" / "kill agent abc12345"
  const termRx = /(?:terminate|kill|stop|remove)\s+agent\s+(\S+)/i;
  const tm = raw.match(termRx);
  if (tm) {
    const idPrefix = tm[1].trim();
    const agent = ctx.agents.find(a => a.id.startsWith(idPrefix));
    if (!agent) return `Agent \`${idPrefix}\` not found.`;
    await terminateAgent(agent.id);
    bus.emit('log:entry', { level: 'warn', message: `[workspace] Terminated agent ${agent.id.slice(0, 8)}` });
    return `**Agent terminated** ✓\n\nAgent \`${agent.id.slice(0, 8)}\` [${agent.type}] has been stopped.`;
  }

  // ADD MONITOR — "monitor https://example.com" / "add monitor My Site https://example.com"
  const monitorRx = /(?:(?:add|create|new)\s+)?monitor\s+(.+?)\s+(https?:\/\/\S+)/i;
  const monitorUrlRx = /(?:(?:add|create|new)\s+)?monitor\s+(https?:\/\/\S+)/i;
  const mam = raw.match(monitorRx) || raw.match(monitorUrlRx);
  if (mam) {
    let name, url;
    if (mam[2]) {
      name = mam[1].trim();
      url = mam[2].trim();
    } else {
      url = mam[1].trim();
      name = url.replace(/https?:\/\//, '').split('/')[0];
    }
    const mon = await createMonitor(userId, { name, url });
    bus.emit('log:entry', { level: 'success', message: `[workspace] Added monitor "${mon.name}" → ${mon.url}` });
    return `**Monitor added** ✓\n\nNow watching **${mon.name}** at \`${mon.url}\`\nID: \`${mon.id.slice(0, 8)}\` · Checks every 60 s`;
  }

  // PAUSE/STOP MONITOR — "pause monitor <name>"
  const pauseMonRx = /(?:pause|stop|disable|remove)\s+monitor\s+(.+)/i;
  const pmm = raw.match(pauseMonRx);
  if (pmm) {
    const query = pmm[1].trim().toLowerCase();
    const mon = ctx.monitors.find(mo => mo.name.toLowerCase().includes(query) || mo.id.startsWith(query));
    if (!mon) return `Monitor \`${pmm[1].trim()}\` not found.`;
    await updateMonitor(mon.id, { status: 'paused' });
    return `**Monitor paused** ✓\n\n**${mon.name}** is now paused.`;
  }

  // STATUS / OVERVIEW
  if (/^(status|overview|summary|health|health check|show status)$/.test(m)) {
    const { swarms, agents, monitors, vms, tasks } = ctx;
    const activeSwarms = swarms.filter(s => s.status === 'active').length;
    const idleAgents = agents.filter(a => a.status === 'idle').length;
    const busyAgents = agents.filter(a => a.status === 'busy').length;
    const upMonitors = monitors.filter(mo => mo.status === 'up' || mo.status === 'active').length;
    const runningVms = vms.filter(v => v.status === 'running').length;
    return `**System Status**\n\n` +
      `- **Swarms**: ${swarms.length} total, ${activeSwarms} active\n` +
      `- **Agents**: ${agents.length} total (${busyAgents} busy, ${idleAgents} idle)\n` +
      `- **Monitors**: ${monitors.length} total, ${upMonitors} up\n` +
      `- **VMs**: ${vms.length} total, ${runningVms} running\n` +
      `- **Queued/Running Tasks**: ${tasks.length}\n\n` +
      `Type \`help\` for available commands.`;
  }

  // HELP
  if (/^(help|\?|commands|what can you do)$/.test(m)) {
    return `**Blackbird 2030 Workspace Commands**\n\n` +
      `**Swarms**\n` +
      `- \`create swarm <name>\` — create a new swarm\n` +
      `- \`activate swarm <name>\` — activate a swarm & spawn agents\n` +
      `- \`deactivate swarm <name>\` — stop a swarm\n\n` +
      `**Agents**\n` +
      `- \`spawn <n> agents [in <swarm>]\` — spawn worker agents\n` +
      `- \`terminate agent <id>\` — stop an agent\n\n` +
      `**Monitoring**\n` +
      `- \`monitor <url>\` — start monitoring a URL\n` +
      `- \`add monitor <name> <url>\` — monitor with a custom name\n` +
      `- \`pause monitor <name>\` — pause a monitor\n\n` +
      `**Info**\n` +
      `- \`status\` — system overview\n` +
      `- \`agents\`, \`swarms\`, \`monitors\`, \`vms\` — list resources`;
  }

  return null; // no action matched — fall through to Ruflo or localResponse
}

function localResponse(message, ctx) {
  const m = message.toLowerCase();
  const { swarms, agents, monitors, vms, tasks } = ctx;

  if (m.includes('agent')) {
    if (!agents.length) return 'No agents running yet. Type `create swarm MySwarm` then `activate swarm MySwarm` to spawn agents.';
    return `**Active Agents (${agents.length})**\n\n` +
      agents.slice(0, 10).map(a =>
        `- \`${a.id.slice(0, 8)}\` ${a.type} [${a.status}]${a.swarm_id ? ` in swarm \`${a.swarm_id.slice(0, 8)}\`` : ''}`
      ).join('\n');
  }

  if (m.includes('swarm')) {
    if (!swarms.length) return 'No swarms yet. Type `create swarm MySwarm` to create one.';
    return `**Swarms (${swarms.length})**\n\n` +
      swarms.map(s => {
        const count = agents.filter(a => a.swarm_id === s.id).length;
        return `- **${s.name}** [${s.status}] — ${count}/${s.target_agent_count} agents`;
      }).join('\n');
  }

  if (m.includes('monitor')) {
    if (!monitors.length) return 'No monitors. Type `monitor https://example.com` to add one.';
    return `**Monitors (${monitors.length})**\n\n` +
      monitors.map(mo => `- **${mo.name}** [${mo.status || 'pending'}] — ${mo.url}`).join('\n');
  }

  if (m.includes('vm')) {
    if (!vms.length) return 'No VMs. Go to **VMs** in the sidebar to provision one.';
    return `**VMs (${vms.length})**\n\n` +
      vms.map(v => `- \`${v.id.slice(0, 8)}\` [${v.provider}] ${v.status}${v.ip_address ? ` @ ${v.ip_address}` : ''}`).join('\n');
  }

  const activeSwarms = swarms.filter(s => s.status === 'active').length;
  return `**${activeSwarms}** active swarms · **${agents.length}** agents · **${monitors.length}** monitors.\n\nType \`help\` for commands or \`status\` for a full overview.`;
}

export default async function workspaceRoutes(fastify) {
  const auth = { onRequest: [fastify.authenticate] };

  fastify.get('/api/workspace/chat', auth, async () => {
    return getAll('SELECT * FROM workspace_messages ORDER BY created_at ASC LIMIT 100', []);
  });

  fastify.post('/api/workspace/chat', auth, async (request, reply) => {
    const { message } = request.body || {};
    if (!message?.trim()) return reply.code(400).send({ error: 'message required' });

    const userId = request.user?.id || 'unknown';
    const userMsgId = nanoid();
    const now = Date.now();

    await writeQueue(() => {
      runQuery(
        'INSERT INTO workspace_messages (id, role, content, user_id, created_at) VALUES (?, ?, ?, ?, ?)',
        [userMsgId, 'user', message.trim(), userId, now]
      );
    });

    const ctx = buildCtx();

    // 1. Try to execute a recognised action
    let response = await executeAction(message, userId, ctx);

    // 2. Fall back to Ruflo LLM chat
    if (!response) response = await askRuflo(message, ctx);

    // 3. Offline keyword fallback
    if (!response) response = localResponse(message, ctx);

    const aiMsgId = nanoid();
    await writeQueue(() => {
      runQuery(
        'INSERT INTO workspace_messages (id, role, content, user_id, created_at) VALUES (?, ?, ?, ?, ?)',
        [aiMsgId, 'assistant', response, 'system', Date.now()]
      );
    });

    bus.emit('log:entry', {
      level: 'info',
      message: `[workspace] ${message.slice(0, 60)}${message.length > 60 ? '…' : ''}`
    });

    return { id: aiMsgId, role: 'assistant', content: response, created_at: Date.now() };
  });

  fastify.get('/api/workspace/swarm-map', auth, async () => {
    const swarms = getAll('SELECT * FROM swarms ORDER BY created_at DESC LIMIT 10', []);
    const agents = getAll(
      "SELECT id, swarm_id, type, status FROM agents WHERE status != 'terminated' ORDER BY created_at DESC LIMIT 50",
      []
    );
    return { swarms, agents };
  });
}
