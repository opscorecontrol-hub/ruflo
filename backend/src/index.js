import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import websocket from '@fastify/websocket';

import { initDb, getDb, saveDb } from './db/init.js';
import { applySchema } from './db/schema.js';
import { bus } from './events.js';
import { startUptimeLoop } from './services/uptime.js';
import { startScalingLoop, stopScalingLoop } from './services/swarmController.js';

import authRoutes from './routes/auth.js';
import monitorRoutes from './routes/monitors.js';
import agentRoutes from './routes/agents.js';
import swarmRoutes from './routes/swarm.js';
import vmRoutes from './routes/vms.js';
import orchestrationRoutes from './routes/orchestration.js';
import logRoutes from './routes/logs.js';

const fastify = Fastify({ logger: true });

const wsClients = new Set();

function broadcast(event, data) {
  const msg = JSON.stringify({ event, data, ts: Date.now() });
  for (const client of wsClients) {
    if (client.readyState === 1) {
      try { client.send(msg); } catch {}
    }
  }
}

[
  'agent:status',
  'agent:heartbeat',
  'vm:status',
  'swarm:scaled',
  'task:completed',
  'log:entry',
  'monitor:check'
].forEach(evt => {
  bus.on(evt, (data) => broadcast(evt, data));
});

async function buildServer() {
  await fastify.register(cors, { origin: true });

  await fastify.register(jwt, {
    secret: process.env.JWT_SECRET || 'opscore-secret-key-change-in-production'
  });

  await fastify.register(websocket);

  fastify.decorate('authenticate', async function (request, reply) {
    try {
      await request.jwtVerify();
    } catch {
      reply.code(401).send({ error: 'Unauthorized' });
    }
  });

  fastify.register(async function wsPlugin(f) {
    f.get('/ws', { websocket: true }, async (socket, request) => {
      const token = request.query?.token;
      if (!token) {
        socket.close(1008, 'Token required');
        return;
      }
      try {
        f.jwt.verify(token);
      } catch {
        socket.close(1008, 'Invalid token');
        return;
      }
      wsClients.add(socket);
      socket.send(JSON.stringify({ event: 'connected', ts: Date.now() }));
      socket.on('close', () => wsClients.delete(socket));
      socket.on('error', () => wsClients.delete(socket));
    });
  });

  fastify.get('/health', async () => ({
    status: 'ok',
    service: 'opscore-backend',
    ts: Date.now()
  }));

  await fastify.register(authRoutes);
  await fastify.register(monitorRoutes);
  await fastify.register(agentRoutes);
  await fastify.register(swarmRoutes);
  await fastify.register(vmRoutes);
  await fastify.register(orchestrationRoutes);
  await fastify.register(logRoutes);
}

async function start() {
  await initDb();
  applySchema(getDb());

  await buildServer();

  startUptimeLoop(60000);
  startScalingLoop(30000);

  const port = parseInt(process.env.PORT) || 3003;
  await fastify.listen({ port, host: '0.0.0.0' });
  fastify.log.info(`OpsCore backend running on port ${port}`);
}

process.on('SIGINT', async () => {
  fastify.log.info('Shutting down...');
  stopScalingLoop();
  saveDb();
  await fastify.close();
  process.exit(0);
});

start().catch(err => {
  console.error('Startup failed:', err);
  process.exit(1);
});
