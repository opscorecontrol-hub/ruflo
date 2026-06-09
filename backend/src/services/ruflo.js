const RUFLO_MCP_URL = process.env.RUFLO_MCP_URL || 'http://ruflo-mcp-bridge:3001';

async function callTool(toolName, args) {
  try {
    const controller = new AbortController();
    const timeout = AbortSignal.timeout(10000);
    timeout.addEventListener('abort', () => controller.abort());

    const res = await fetch(`${RUFLO_MCP_URL}/mcp/agents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: crypto.randomUUID(),
        method: 'tools/call',
        params: { name: toolName, arguments: args }
      }),
      signal: AbortSignal.timeout(10000)
    });

    if (!res.ok) {
      console.warn(`[ruflo] ${toolName} HTTP ${res.status}`);
      return null;
    }

    const json = await res.json();
    const text = json?.result?.content?.[0]?.text;
    if (!text) return null;

    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  } catch (err) {
    console.warn(`[ruflo] ${toolName} failed:`, err.message);
    return null;
  }
}

export async function isHealthy() {
  try {
    const res = await fetch(`${RUFLO_MCP_URL}/health`, { signal: AbortSignal.timeout(5000) });
    return res.ok;
  } catch {
    return false;
  }
}

export async function spawnRufloAgent(type, name) {
  return callTool('ruflo__agent_spawn', { type, name });
}

export async function terminateRufloAgent(rufloId) {
  return callTool('ruflo__agent_terminate', { agentId: rufloId });
}

export async function getRufloAgentStatus(rufloId) {
  return callTool('ruflo__agent_status', { agentId: rufloId });
}

export async function initRufloSwarm(name, topology, maxAgents) {
  return callTool('ruflo__swarm_init', { name, topology, maxAgents });
}

export async function triggerPipeline(name, payload) {
  return callTool('ruflo__workflow_execute', { workflowId: name, ...payload });
}

export async function listActivePipelines() {
  try {
    return (await callTool('ruflo__agent_list', {})) || [];
  } catch {
    return [];
  }
}
