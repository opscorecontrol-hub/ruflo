import * as monitors from '../services/monitors.js';
import { runCheck } from '../services/uptime.js';

export default async function monitorRoutes(fastify) {
  const auth = { onRequest: [fastify.authenticate] };

  fastify.get('/api/monitors/stats', auth, async () => monitors.getStats());

  fastify.get('/api/monitors/incidents', auth, async () => monitors.getIncidents());

  fastify.get('/api/monitors', auth, async (request) => {
    return monitors.listMonitors(request.user.id);
  });

  fastify.post('/api/monitors', auth, async (request, reply) => {
    const { name, url, interval_s } = request.body || {};
    if (!name || !url) return reply.code(400).send({ error: 'name and url required' });
    const monitor = await monitors.createMonitor(request.user.id, { name, url, interval_s });
    return reply.code(201).send(monitor);
  });

  fastify.get('/api/monitors/:id', auth, async (request, reply) => {
    const monitor = monitors.getMonitor(request.params.id);
    if (!monitor) return reply.code(404).send({ error: 'Monitor not found' });
    return monitor;
  });

  fastify.put('/api/monitors/:id', auth, async (request, reply) => {
    const monitor = monitors.getMonitor(request.params.id);
    if (!monitor) return reply.code(404).send({ error: 'Monitor not found' });
    return monitors.updateMonitor(request.params.id, request.body || {});
  });

  fastify.delete('/api/monitors/:id', auth, async (request, reply) => {
    const monitor = monitors.getMonitor(request.params.id);
    if (!monitor) return reply.code(404).send({ error: 'Monitor not found' });
    await monitors.deleteMonitor(request.params.id);
    return reply.code(204).send();
  });

  fastify.post('/api/monitors/:id/check', auth, async (request, reply) => {
    const monitor = monitors.getMonitor(request.params.id);
    if (!monitor) return reply.code(404).send({ error: 'Monitor not found' });
    const result = await runCheck(request.params.id);
    return result;
  });

  fastify.get('/api/monitors/:id/checks', auth, async (request, reply) => {
    const monitor = monitors.getMonitor(request.params.id);
    if (!monitor) return reply.code(404).send({ error: 'Monitor not found' });
    const limit = parseInt(request.query.limit) || 100;
    return monitors.getChecks(request.params.id, limit);
  });

  fastify.get('/api/monitors/:id/uptime', auth, async (request, reply) => {
    const monitor = monitors.getMonitor(request.params.id);
    if (!monitor) return reply.code(404).send({ error: 'Monitor not found' });
    const hours = parseInt(request.query.hours) || 24;
    return monitors.getUptimeData(request.params.id, hours);
  });

  fastify.get('/api/monitors/:id/incidents', auth, async (request, reply) => {
    const monitor = monitors.getMonitor(request.params.id);
    if (!monitor) return reply.code(404).send({ error: 'Monitor not found' });
    return monitors.getMonitorIncidents(request.params.id);
  });
}
