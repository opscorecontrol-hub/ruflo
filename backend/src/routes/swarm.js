import * as swarmController from '../services/swarmController.js';
import { getAll, getOne, writeQueue, runQuery } from '../db/init.js';
import { nanoid } from 'nanoid';

export default async function swarmRoutes(fastify) {
  const auth = { onRequest: [fastify.authenticate] };

  fastify.get('/api/swarm', auth, async (request) => {
    return getAll(
      `SELECT s.*,
        (SELECT COUNT(*) FROM agents WHERE swarm_id = s.id AND status != 'terminated') AS agent_count,
        (SELECT COUNT(*) FROM vms   WHERE swarm_id = s.id AND status != 'terminated') AS vm_count
       FROM swarms s
       WHERE s.user_id = ?
       ORDER BY s.created_at DESC`,
      [request.user.id]
    );
  });

  fastify.post('/api/swarm', auth, async (request, reply) => {
    const { name, policy, targetAgentCount } = request.body || {};
    if (!name) return reply.code(400).send({ error: 'name required' });
    const swarm = await swarmController.createSwarm(request.user.id, { name, policy, targetAgentCount });
    return reply.code(201).send(swarm);
  });

  fastify.get('/api/swarm/:id', auth, async (request, reply) => {
    const status = await swarmController.getSwarmStatus(request.params.id);
    if (!status) return reply.code(404).send({ error: 'Swarm not found' });
    return status;
  });

  fastify.put('/api/swarm/:id', auth, async (request, reply) => {
    const swarm = getOne('SELECT * FROM swarms WHERE id = ?', [request.params.id]);
    if (!swarm) return reply.code(404).send({ error: 'Swarm not found' });

    const { name, policy, targetAgentCount } = request.body || {};
    const fields = [];
    const values = [];
    if (name) { fields.push('name = ?'); values.push(name); }
    if (policy !== undefined) { fields.push('policy = ?'); values.push(JSON.stringify(policy)); }
    if (targetAgentCount !== undefined) { fields.push('target_agent_count = ?'); values.push(targetAgentCount); }

    if (fields.length) {
      values.push(request.params.id);
      await writeQueue(() => {
        runQuery(`UPDATE swarms SET ${fields.join(', ')} WHERE id = ?`, values);
      });
    }

    return getOne('SELECT * FROM swarms WHERE id = ?', [request.params.id]);
  });

  fastify.delete('/api/swarm/:id', auth, async (request, reply) => {
    const swarm = getOne('SELECT * FROM swarms WHERE id = ?', [request.params.id]);
    if (!swarm) return reply.code(404).send({ error: 'Swarm not found' });
    await swarmController.deactivateSwarm(request.params.id);
    await writeQueue(() => {
      runQuery('DELETE FROM swarms WHERE id = ?', [request.params.id]);
    });
    return reply.code(204).send();
  });

  fastify.post('/api/swarm/:id/activate', auth, async (request, reply) => {
    const swarm = getOne('SELECT * FROM swarms WHERE id = ?', [request.params.id]);
    if (!swarm) return reply.code(404).send({ error: 'Swarm not found' });
    return swarmController.activateSwarm(request.params.id);
  });

  fastify.post('/api/swarm/:id/deactivate', auth, async (request, reply) => {
    const swarm = getOne('SELECT * FROM swarms WHERE id = ?', [request.params.id]);
    if (!swarm) return reply.code(404).send({ error: 'Swarm not found' });
    await swarmController.deactivateSwarm(request.params.id);
    return getOne('SELECT * FROM swarms WHERE id = ?', [request.params.id]);
  });

  fastify.post('/api/swarm/:id/task', auth, async (request, reply) => {
    const swarm = getOne('SELECT * FROM swarms WHERE id = ?', [request.params.id]);
    if (!swarm) return reply.code(404).send({ error: 'Swarm not found' });
    const { title, description, payload } = request.body || {};
    if (!title) return reply.code(400).send({ error: 'title required' });

    const id = nanoid();
    const created_at = Date.now();
    await writeQueue(() => {
      runQuery(
        'INSERT INTO tasks (id, swarm_id, title, description, status, payload, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [id, request.params.id, title, description || null, 'queued', payload ? JSON.stringify(payload) : '{}', created_at]
      );
    });

    const task = getOne('SELECT * FROM tasks WHERE id = ?', [id]);
    return reply.code(201).send(task);
  });

  fastify.get('/api/swarm/:id/events', auth, async (request, reply) => {
    const swarm = getOne('SELECT * FROM swarms WHERE id = ?', [request.params.id]);
    if (!swarm) return reply.code(404).send({ error: 'Swarm not found' });
    const limit = parseInt(request.query.limit) || 100;
    return getAll(
      'SELECT * FROM swarm_events WHERE swarm_id = ? ORDER BY created_at DESC LIMIT ?',
      [request.params.id, limit]
    );
  });
}
