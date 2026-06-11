import { nanoid } from 'nanoid';
import { getAll, writeQueue, runQuery } from '../db/init.js';
import { bus } from '../events.js';

const RUFLO_MCP_URL = process.env.RUFLO_MCP_URL || 'http://ruflo-mcp-bridge:3001';

async function askRuflo(message, ctx) {
  try {
    const res = await fetch(`${RUFLO_MCP_URL}/mcp/intelligence`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: crypto.randomUUID(),
        method: 'tools/call',
        params: {
          name: 'intelligence__analyze',
          arguments: { query: message, context: JSON.stringify(ctx).slice(0, 2000) }
        }
      }),
      signal: AbortSignal.timeout(12000)
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.result?.content?.[0]?.text || null;
  } catch {
    return null;
  }
}

function buildCtx() {
  const swarms = getAll('SELECT id, name, status, target_agent_count FROM swarms ORDER BY created_at DESC LIMIT 5', []);
  const agents = getAll("SELECT id, swarm_id, type, status FROM agents WHERE status != 'terminated' ORDER BY created_at DESC LIMIT 20", []);
  const monitors = getAll('SELECT id, name, url, status FROM monitors ORDER BY created_at DESC LIMIT 10', []);
  const vms = getAll('SELECT id, provider, status, ip_address FROM vms ORDER BY created_at DESC LIMIT 10', []);
  const tasks = getAll("SELECT id, title, status FROM tasks WHERE status IN ('queued','running') ORDER BY created_at DESC LIMIT 10", []);
  return { swarms, agents, monitors, vms, tasks };
}

function localResponse(message, ctx) {
  const msg = message.toLowerCase();
  const { swarms, agents, monitors, vms, tasks } = ctx;

  if (msg.match(/^(status|overview|summary|health)$/)) {
    return `**System Status**\n\n` +
      `- **Swarms**: ${swarms.length} (${swarms.filter(s => s.status === 'active').length} active)\n` +
      `- **Agents**: ${agents.length} (${agents.filter(a => a.status === 'busy').length} busy)\n` +
      `- **Monitors**: ${monitors.length} (${monitors.filter(m => m.status === 'up').length} up)\n` +
      `- **VMs**: ${vms.length} (${vms.filter(v => v.status === 'running').length} running)\n` +
      `- **Active Tasks**: ${tasks.length}\n\n` +
      `All systems operational. Use the sidebar to manage your infrastructure.`;
  }

  if (msg.includes('agent')) {
    if (!agents.length) return 'No agents running yet. Go to **Swarm** → activate a swarm to spawn agents.';
    return `**Active Agents (${agents.length})**\n\n` +
      agents.slice(0, 10).map(a =>
        `- \`${a.id.slice(0, 8)}\` ${a.type} [${a.status}]`
      ).join('\n');
  }

  if (msg.includes('swarm')) {
    if (!swarms.length) return 'No swarms created. Go to **Swarm** to create one.';
    return `**Swarms (${swarms.length})**\n\n` +
      swarms.map(s =>
        `- **${s.name}** [${s.status}] — ${agents.filter(a => a.swarm_id === s.id).length}/${s.target_agent_count} agents`
      ).join('\n');
  }

  if (msg.includes('monitor')) {
    if (!monitors.length) return 'No monitors configured. Go to **Monitors** to add one.';
    return `**Monitors (${monitors.length})**\n\n` +
      monitors.map(m => `- **${m.name}** [${m.status || 'pending'}] — ${m.url}`).join('\n');
  }

  if (msg.includes('vm')) {
    if (!vms.length) return 'No VMs provisioned. Go to **VMs** to provision one.';
    return `**VMs (${vms.length})**\n\n` +
      vms.map(v => `- \`${v.id.slice(0, 8)}\` [${v.provider}] ${v.status}${v.ip_address ? ` @ ${v.ip_address}` : ''}`).join('\n');
  }

  if (msg.match(/^(\?|help)$/)) {
    return `**Blackbird 2030 AI Workspace**\n\nCommands:\n- \`status\` — system overview\n- \`agents\` — list active agents\n- \`swarms\` — list swarms\n- \`monitors\` — list monitors\n- \`vms\` — list virtual machines\n\nOr use the sidebar navigation to manage resources directly.`;
  }

  return `Current state: **${swarms.filter(s => s.status === 'active').length}** active swarms, ` +
    `**${agents.length}** agents, **${monitors.length}** monitors.\n\n` +
    `Type \`status\` for a full overview or \`help\` for available commands.`;
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
    let response = await askRuflo(message, ctx);
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
