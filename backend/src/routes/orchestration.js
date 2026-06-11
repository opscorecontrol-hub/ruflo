import { nanoid } from 'nanoid';
import * as ruflo from '../services/ruflo.js';
import { writeQueue, runQuery, getAll } from '../db/init.js';

export default async function orchestrationRoutes(fastify) {
  const auth = { onRequest: [fastify.authenticate] };

  fastify.get('/api/orchestration/pipelines', auth, async () => {
    try {
      const pipelines = await ruflo.listActivePipelines();
      return Array.isArray(pipelines) ? pipelines : [];
    } catch {
      return [];
    }
  });

  fastify.post('/api/orchestration/pipelines', auth, async (request, reply) => {
    const { name, payload } = request.body || {};
    if (!name) return reply.code(400).send({ error: 'name required' });
    try {
      const result = await ruflo.triggerPipeline(name, payload || {});
      return { triggered: true, name, result };
    } catch (err) {
      return reply.code(500).send({ error: err.message });
    }
  });

  fastify.get('/api/orchestration/pipelines/:runId', auth, async (request, reply) => {
    try {
      const status = await ruflo.getPipelineStatus(request.params.runId);
      if (!status) return reply.code(404).send({ error: 'Pipeline run not found' });
      return status;
    } catch (err) {
      return reply.code(500).send({ error: err.message });
    }
  });

  fastify.delete('/api/orchestration/pipelines/:runId', auth, async (request, reply) => {
    try {
      await ruflo.cancelPipeline(request.params.runId);
      return reply.code(204).send();
    } catch (err) {
      return reply.code(500).send({ error: err.message });
    }
  });

  fastify.get('/api/orchestration/tasks', auth, async (request) => {
    const { swarm_id, status } = request.query;
    let sql = 'SELECT * FROM tasks WHERE 1=1';
    const params = [];
    if (swarm_id) { sql += ' AND swarm_id = ?'; params.push(swarm_id); }
    if (status) { sql += ' AND status = ?'; params.push(status); }
    sql += ' ORDER BY created_at DESC LIMIT 200';
    return getAll(sql, params);
  });

  fastify.post('/api/orchestration/tasks', auth, async (request, reply) => {
    const { swarm_id, title, description, payload } = request.body || {};
    if (!swarm_id || !title) return reply.code(400).send({ error: 'swarm_id and title required' });

    const id = nanoid();
    const created_at = Date.now();
    const payloadStr = payload ? JSON.stringify(payload) : '{}';

    await writeQueue(() => {
      runQuery(
        'INSERT INTO tasks (id, swarm_id, title, description, status, payload, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [id, swarm_id, title, description || null, 'queued', payloadStr, created_at]
      );
    });

    return reply.code(201).send(
      getAll('SELECT * FROM tasks WHERE id = ?', [id])[0] || { id, swarm_id, title, status: 'queued' }
    );
  });

  // Cancel or retry a single task
  fastify.put('/api/orchestration/tasks/:id', auth, async (request, reply) => {
    const { status } = request.body || {};
    const allowed = ['cancelled', 'queued'];
    if (!allowed.includes(status)) {
      return reply.code(400).send({ error: `status must be one of: ${allowed.join(', ')}` });
    }
    const task = getAll('SELECT * FROM tasks WHERE id = ?', [request.params.id])[0];
    if (!task) return reply.code(404).send({ error: 'Task not found' });

    await writeQueue(() => {
      runQuery('UPDATE tasks SET status = ? WHERE id = ?', [status, request.params.id]);
    });
    return getAll('SELECT * FROM tasks WHERE id = ?', [request.params.id])[0];
  });

  // Bulk clear tasks by status (e.g. DELETE /api/orchestration/tasks?status=completed,failed)
  fastify.delete('/api/orchestration/tasks', auth, async (request, reply) => {
    const statuses = (request.query.status || 'completed,failed').split(',').map(s => s.trim());
    const placeholders = statuses.map(() => '?').join(',');
    await writeQueue(() => {
      runQuery(`DELETE FROM tasks WHERE status IN (${placeholders})`, statuses);
    });
    return { ok: true, cleared: statuses };
  });
}
