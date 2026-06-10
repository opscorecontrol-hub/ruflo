import * as agentManager from '../services/agentManager.js';
import { getAll, getOne, writeQueue, runQuery } from '../db/init.js';

export default async function agentRoutes(fastify) {
  const auth = { onRequest: [fastify.authenticate] };

  fastify.get('/api/agents', auth, async (request) => {
    const { swarm_id } = request.query;
    if (swarm_id) return agentManager.getAgentsBySwarm(swarm_id);
    return getAll('SELECT * FROM agents ORDER BY created_at DESC LIMIT 200');
  });

  fastify.post('/api/agents', auth, async (request, reply) => {
    const { swarm_id, type, vm_id } = request.body || {};
    if (!swarm_id) return reply.code(400).send({ error: 'swarm_id required' });
    const agent = await agentManager.spawnAgent({ swarmId: swarm_id, type, vmId: vm_id });
    return reply.code(201).send(agent);
  });

  fastify.get('/api/agents/:id', auth, async (request, reply) => {
    const agent = agentManager.getAgentById(request.params.id);
    if (!agent) return reply.code(404).send({ error: 'Agent not found' });
    const tasks = getAll(
      'SELECT * FROM tasks WHERE agent_id = ? ORDER BY created_at DESC LIMIT 50',
      [request.params.id]
    );
    return { ...agent, tasks };
  });

  fastify.delete('/api/agents/:id', auth, async (request, reply) => {
    const agent = agentManager.getAgentById(request.params.id);
    if (!agent) return reply.code(404).send({ error: 'Agent not found' });
    await agentManager.terminateAgent(request.params.id);
    return reply.code(204).send();
  });

  fastify.post('/api/agents/:id/heartbeat', auth, async (request, reply) => {
    const agent = agentManager.getAgentById(request.params.id);
    if (!agent) return reply.code(404).send({ error: 'Agent not found' });
    await agentManager.heartbeat(request.params.id);
    return { ok: true, ts: Date.now() };
  });

  fastify.get('/api/agents/:id/tasks', auth, async (request, reply) => {
    const agent = agentManager.getAgentById(request.params.id);
    if (!agent) return reply.code(404).send({ error: 'Agent not found' });
    return getAll(
      'SELECT * FROM tasks WHERE agent_id = ? ORDER BY created_at DESC LIMIT 100',
      [request.params.id]
    );
  });

  fastify.post('/api/agents/:id/tasks/:taskId/result', auth, async (request, reply) => {
    const { result, status } = request.body || {};
    const task = getOne('SELECT * FROM tasks WHERE id = ? AND agent_id = ?', [request.params.taskId, request.params.id]);
    if (!task) return reply.code(404).send({ error: 'Task not found' });

    const finalStatus = status || 'completed';
    const now = Date.now();
    await writeQueue(() => {
      runQuery(
        'UPDATE tasks SET status = ?, result = ?, completed_at = ? WHERE id = ?',
        [finalStatus, result ? JSON.stringify(result) : null, now, request.params.taskId]
      );
    });
    return getOne('SELECT * FROM tasks WHERE id = ?', [request.params.taskId]);
  });
}
