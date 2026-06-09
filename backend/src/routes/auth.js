import * as authService from '../services/auth.js';

export default async function authRoutes(fastify) {
  fastify.post('/api/auth/register', async (request, reply) => {
    const { email, password, name } = request.body || {};
    if (!email || !password) {
      return reply.code(400).send({ error: 'email and password required' });
    }
    try {
      const user = await authService.register(email, password, name);
      const token = fastify.jwt.sign({ id: user.id, email: user.email });
      return reply.code(201).send({ token, user });
    } catch (err) {
      return reply.code(409).send({ error: err.message });
    }
  });

  fastify.post('/api/auth/login', async (request, reply) => {
    const { email, password } = request.body || {};
    if (!email || !password) {
      return reply.code(400).send({ error: 'email and password required' });
    }
    try {
      const user = await authService.login(email, password);
      const token = fastify.jwt.sign({ id: user.id, email: user.email });
      return { token, user: { id: user.id, email: user.email, name: user.name } };
    } catch (err) {
      return reply.code(401).send({ error: err.message });
    }
  });

  fastify.get('/api/auth/me', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const user = authService.getById(request.user.id);
    if (!user) return reply.code(404).send({ error: 'User not found' });
    return { user };
  });
}
