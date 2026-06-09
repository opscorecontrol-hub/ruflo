import { getAll } from '../db/init.js';

export default async function logRoutes(fastify) {
  const auth = { onRequest: [fastify.authenticate] };

  fastify.get('/api/logs', auth, async (request) => {
    const { level, swarm_id, since, limit } = request.query;
    const limitN = parseInt(limit) || 200;

    let sql = 'SELECT * FROM swarm_events WHERE 1=1';
    const params = [];

    if (swarm_id) { sql += ' AND swarm_id = ?'; params.push(swarm_id); }
    if (since) { sql += ' AND created_at > ?'; params.push(parseInt(since)); }
    if (level) { sql += ' AND event_type = ?'; params.push(level); }

    sql += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limitN);

    return getAll(sql, params);
  });

  fastify.get('/api/logs/stream', auth, async (request, reply) => {
    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.setHeader('X-Accel-Buffering', 'no');
    reply.raw.flushHeaders();

    let lastId = null;
    const { swarm_id } = request.query;

    const send = (row) => {
      reply.raw.write(`data: ${JSON.stringify(row)}\n\n`);
    };

    const poll = () => {
      let sql = 'SELECT * FROM swarm_events WHERE 1=1';
      const params = [];
      if (swarm_id) { sql += ' AND swarm_id = ?'; params.push(swarm_id); }
      if (lastId) { sql += ' AND created_at > ?'; params.push(lastId); }
      sql += ' ORDER BY created_at ASC LIMIT 50';

      const rows = getAll(sql, params);
      for (const row of rows) {
        send(row);
        if (!lastId || row.created_at > lastId) lastId = row.created_at;
      }
    };

    const timer = setInterval(poll, 2000);
    poll();

    request.raw.on('close', () => {
      clearInterval(timer);
    });

    await new Promise(() => {});
  });
}
