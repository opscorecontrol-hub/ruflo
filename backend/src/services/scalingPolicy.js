export function evaluateScaling({ agentCount, vmCount, avgLoad, queueDepth, policy }) {
  const AGENT_DENSITY = parseInt(process.env.AGENT_DENSITY_THRESHOLD) || 10;
  const HIGH_LOAD = parseInt(process.env.HIGH_LOAD_THRESHOLD) || 80;
  const LOW_LOAD = parseInt(process.env.LOW_LOAD_THRESHOLD) || 20;
  const QUEUE_DEPTH = parseInt(process.env.QUEUE_DEPTH_THRESHOLD) || 50;

  const maxAgents = policy?.maxAgents || 20;
  const minAgents = policy?.minAgents || 1;
  const maxVms = policy?.maxVms || 5;

  if (avgLoad > HIGH_LOAD && agentCount < maxAgents) {
    const delta = Math.min(2, maxAgents - agentCount);
    // Only provision a new VM if under the cap; otherwise reuse existing
    if (vmCount < maxVms) {
      return { action: 'scale_up', reason: `avgLoad ${avgLoad}% exceeds HIGH_LOAD ${HIGH_LOAD}%`, delta };
    }
    return { action: 'spawn_agents', reason: `VM cap reached (${vmCount}/${maxVms}), spawning on existing`, delta };
  }

  if (queueDepth > QUEUE_DEPTH && agentCount < maxAgents) {
    const delta = Math.min(3, maxAgents - agentCount);
    return { action: 'spawn_agents', reason: `queueDepth ${queueDepth} exceeds threshold ${QUEUE_DEPTH}`, delta };
  }

  if (avgLoad < LOW_LOAD && agentCount > minAgents) {
    const delta = Math.min(1, agentCount - minAgents);
    return { action: 'scale_down', reason: `avgLoad ${avgLoad}% below LOW_LOAD ${LOW_LOAD}%`, delta };
  }

  return { action: 'none', reason: 'load within normal range', delta: 0 };
}
