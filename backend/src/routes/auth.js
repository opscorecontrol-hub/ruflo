import * as authService from '../services/auth.js';
import { getOne } from '../db/init.js';

const OPERATOR_EMAIL = (process.env.OPERATOR_EMAIL || '').toLowerCase().trim();

function buildTokenPayload(user) {
  const email = user.email.toLowerCase();
  const isOperator = OPERATOR_EMAIL && email === OPERATOR_EMAIL;

  let saas_role = 'user';
  let tenant_id = null;

  if (isOperator) {
    saas_role = 'operator';
  } else {
    const membership = getOne(
      'SELECT m.role, m.tenant_id FROM saas_tenant_members m JOIN saas_tenants t ON t.id = m.tenant_id WHERE m.user_id = ? AND t.status = ?',
      [user.id, 'active']
    );
    if (membership) {
      tenant_id = membership.tenant_id;
      saas_role = membership.role === 'admin' ? 'tenant_admin' : 'tenant_member';
    }
  }

  return { id: user.id, email, saas_role, tenant_id };
}

export default async function authRoutes(fastify) {
  fastify.post('/api/auth/register', async (request, reply) => {
    const { email, password, name } = request.body || {};
    if (!email || !password) {
      return reply.code(400).send({ error: 'email and password required' });
    }
    try {
      const user = await authService.register(email, password, name);
      const payload = buildTokenPayload(user);
      const token = fastify.jwt.sign(payload);
      return reply.code(201).send({ token, user: { ...payload, name: user.name } });
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
      const payload = buildTokenPayload(user);
      const token = fastify.jwt.sign(payload);
      return { token, user: { ...payload, name: user.name } };
    } catch (err) {
      return reply.code(401).send({ error: err.message });
    }
  });

  fastify.get('/api/auth/me', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const user = authService.getById(request.user.id);
    if (!user) return reply.code(404).send({ error: 'User not found' });
    const payload = buildTokenPayload(user);
    return { user: { ...payload, name: user.name } };
  });
}
