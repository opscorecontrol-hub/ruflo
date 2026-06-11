import { nanoid } from 'nanoid';
import { getAll, getOne, writeQueue, runQuery } from '../db/init.js';

const OPERATOR_EMAIL = (process.env.OPERATOR_EMAIL || '').toLowerCase().trim();

// ── Helpers ──────────────────────────────────────────────────────────────────

function isOperator(request) {
  return request.user?.saas_role === 'operator' ||
    (OPERATOR_EMAIL && request.user?.email?.toLowerCase() === OPERATOR_EMAIL);
}

function getTenantMembership(userId) {
  return getOne(
    'SELECT m.*, t.name as tenant_name, t.plan_id, t.status as tenant_status FROM saas_tenant_members m JOIN saas_tenants t ON t.id = m.tenant_id WHERE m.user_id = ?',
    [userId]
  );
}

function isTenantAdmin(request) {
  const m = getTenantMembership(request.user?.id);
  return m?.role === 'admin';
}

function requiresOperator(request, reply) {
  if (!isOperator(request)) {
    return reply.code(403).send({ error: 'Operator access required' });
  }
}

function requiresTenantAdmin(request, reply) {
  if (!isTenantAdmin(request) && !isOperator(request)) {
    return reply.code(403).send({ error: 'Tenant admin access required' });
  }
}

function auditLog(tenantId, userId, action, resourceType, resourceId, details = {}) {
  try {
    runQuery(
      'INSERT INTO saas_audit_log (id, tenant_id, user_id, action, resource_type, resource_id, details, created_at) VALUES (?,?,?,?,?,?,?,?)',
      [nanoid(), tenantId, userId, action, resourceType, resourceId, JSON.stringify(details), Date.now()]
    );
  } catch {}
}

function planWithServices(plan) {
  if (!plan) return null;
  const services = getAll(
    `SELECT s.*, ps.quantity FROM saas_services s
     JOIN saas_plan_services ps ON ps.service_id = s.id
     WHERE ps.plan_id = ? AND s.is_active = 1`,
    [plan.id]
  );
  return { ...plan, services };
}

// ── Route Registration ────────────────────────────────────────────────────────

export default async function saasRoutes(fastify) {
  const auth = { onRequest: [fastify.authenticate] };

  // ── Public: Plans & Services ────────────────────────────────────────────────

  fastify.get('/api/saas/plans', async () => {
    const plans = getAll('SELECT * FROM saas_plans WHERE is_active = 1 ORDER BY price_monthly ASC', []);
    return plans.map(planWithServices);
  });

  fastify.get('/api/saas/services', async () => {
    return getAll('SELECT * FROM saas_services WHERE is_active = 1 ORDER BY category, display_name', []);
  });

  // ── Operator: Tenant Management ─────────────────────────────────────────────

  fastify.get('/api/saas/tenants', auth, async (request, reply) => {
    if (requiresOperator(request, reply)) return;
    const tenants = getAll('SELECT * FROM saas_tenants ORDER BY created_at DESC', []);
    return tenants.map(t => {
      const members = getAll('SELECT COUNT(*) as n FROM saas_tenant_members WHERE tenant_id = ?', [t.id]);
      const plan = t.plan_id ? getOne('SELECT id, name, slug FROM saas_plans WHERE id = ?', [t.plan_id]) : null;
      return { ...t, member_count: members[0]?.n || 0, plan };
    });
  });

  fastify.post('/api/saas/tenants', auth, async (request, reply) => {
    if (requiresOperator(request, reply)) return;
    const { name, domain, plan_id } = request.body || {};
    if (!name) return reply.code(400).send({ error: 'name required' });

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const existing = getOne('SELECT id FROM saas_tenants WHERE slug = ?', [slug]);
    if (existing) return reply.code(409).send({ error: 'Tenant slug already exists' });

    if (plan_id) {
      const plan = getOne('SELECT id FROM saas_plans WHERE id = ? AND is_active = 1', [plan_id]);
      if (!plan) return reply.code(400).send({ error: 'Invalid plan' });
    }

    const id = nanoid();
    const now = Date.now();
    await writeQueue(() => {
      runQuery(
        'INSERT INTO saas_tenants (id, name, slug, domain, status, plan_id, subscribed_at, created_at) VALUES (?,?,?,?,?,?,?,?)',
        [id, name, slug, domain || null, 'active', plan_id || null, plan_id ? now : null, now]
      );
    });
    auditLog(id, request.user.id, 'tenant.created', 'tenant', id, { name, plan_id });
    return reply.code(201).send(getOne('SELECT * FROM saas_tenants WHERE id = ?', [id]));
  });

  fastify.put('/api/saas/tenants/:id', auth, async (request, reply) => {
    if (requiresOperator(request, reply)) return;
    const tenant = getOne('SELECT * FROM saas_tenants WHERE id = ?', [request.params.id]);
    if (!tenant) return reply.code(404).send({ error: 'Tenant not found' });

    const { name, domain, status, plan_id } = request.body || {};
    await writeQueue(() => {
      runQuery(
        'UPDATE saas_tenants SET name=COALESCE(?,name), domain=COALESCE(?,domain), status=COALESCE(?,status), plan_id=COALESCE(?,plan_id) WHERE id=?',
        [name || null, domain || null, status || null, plan_id || null, request.params.id]
      );
    });
    if (plan_id && plan_id !== tenant.plan_id) {
      await writeQueue(() => runQuery('UPDATE saas_tenants SET subscribed_at=? WHERE id=?', [Date.now(), request.params.id]));
    }
    auditLog(request.params.id, request.user.id, 'tenant.updated', 'tenant', request.params.id, { name, plan_id });
    return getOne('SELECT * FROM saas_tenants WHERE id = ?', [request.params.id]);
  });

  fastify.delete('/api/saas/tenants/:id', auth, async (request, reply) => {
    if (requiresOperator(request, reply)) return;
    const tenant = getOne('SELECT id FROM saas_tenants WHERE id = ?', [request.params.id]);
    if (!tenant) return reply.code(404).send({ error: 'Not found' });
    await writeQueue(() => {
      runQuery('UPDATE saas_tenants SET status = ? WHERE id = ?', ['suspended', request.params.id]);
    });
    auditLog(request.params.id, request.user.id, 'tenant.suspended', 'tenant', request.params.id);
    return reply.code(204).send();
  });

  // ── Current user's tenant info ──────────────────────────────────────────────

  fastify.get('/api/saas/my-tenant', auth, async (request, reply) => {
    if (isOperator(request)) {
      // Operators see all tenants
      return { operator: true, tenants: getAll('SELECT * FROM saas_tenants ORDER BY created_at DESC', []) };
    }
    const membership = getTenantMembership(request.user.id);
    if (!membership) return reply.code(404).send({ error: 'Not a member of any tenant' });

    const tenant = getOne('SELECT * FROM saas_tenants WHERE id = ?', [membership.tenant_id]);
    const plan = tenant?.plan_id ? planWithServices(getOne('SELECT * FROM saas_plans WHERE id = ?', [tenant.plan_id])) : null;
    const members = getAll(
      `SELECT m.id, m.role, m.created_at, u.email, u.name FROM saas_tenant_members m
       JOIN users u ON u.id = m.user_id WHERE m.tenant_id = ?`,
      [membership.tenant_id]
    );
    return { tenant, plan, membership, members };
  });

  // Get services accessible to current user's tenant
  fastify.get('/api/saas/my-services', auth, async (request, reply) => {
    if (isOperator(request)) {
      return getAll('SELECT * FROM saas_services WHERE is_active = 1', []);
    }
    const membership = getTenantMembership(request.user.id);
    if (!membership) return reply.code(404).send({ error: 'Not a member of any tenant' });

    const tenant = getOne('SELECT plan_id FROM saas_tenants WHERE id = ? AND status = ?', [membership.tenant_id, 'active']);
    if (!tenant?.plan_id) return [];

    return getAll(
      `SELECT s.*, ps.quantity FROM saas_services s
       JOIN saas_plan_services ps ON ps.service_id = s.id
       WHERE ps.plan_id = ? AND s.is_active = 1`,
      [tenant.plan_id]
    );
  });

  // ── IAM: Tenant Member Management ──────────────────────────────────────────

  fastify.get('/api/saas/iam/members', auth, async (request, reply) => {
    let tenantId;
    if (isOperator(request)) {
      tenantId = request.query.tenant_id;
      if (!tenantId) return reply.code(400).send({ error: 'tenant_id required for operator' });
    } else {
      const m = getTenantMembership(request.user.id);
      if (!m || m.role !== 'admin') return reply.code(403).send({ error: 'Tenant admin required' });
      tenantId = m.tenant_id;
    }
    return getAll(
      `SELECT m.id, m.role, m.created_at, m.invited_by, u.email, u.name, u.id as user_id
       FROM saas_tenant_members m JOIN users u ON u.id = m.user_id
       WHERE m.tenant_id = ? ORDER BY m.created_at ASC`,
      [tenantId]
    );
  });

  fastify.post('/api/saas/iam/members', auth, async (request, reply) => {
    if (requiresTenantAdmin(request, reply)) return;
    const m = isOperator(request)
      ? { tenant_id: request.body?.tenant_id }
      : getTenantMembership(request.user.id);
    if (!m?.tenant_id) return reply.code(400).send({ error: 'tenant_id required' });

    const { email, role = 'member' } = request.body || {};
    if (!email) return reply.code(400).send({ error: 'email required' });

    const user = getOne('SELECT id, email, name FROM users WHERE email = ?', [email.toLowerCase().trim()]);
    if (!user) return reply.code(404).send({ error: 'User not found — they must register first' });

    const existing = getOne('SELECT id FROM saas_tenant_members WHERE tenant_id = ? AND user_id = ?', [m.tenant_id, user.id]);
    if (existing) return reply.code(409).send({ error: 'User already a member' });

    const id = nanoid();
    await writeQueue(() => {
      runQuery(
        'INSERT INTO saas_tenant_members (id, tenant_id, user_id, role, invited_by, created_at) VALUES (?,?,?,?,?,?)',
        [id, m.tenant_id, user.id, ['admin', 'member'].includes(role) ? role : 'member', request.user.id, Date.now()]
      );
    });
    auditLog(m.tenant_id, request.user.id, 'iam.member.added', 'user', user.id, { email, role });
    return reply.code(201).send({ id, tenant_id: m.tenant_id, user_id: user.id, role, email: user.email });
  });

  fastify.put('/api/saas/iam/members/:memberId', auth, async (request, reply) => {
    if (requiresTenantAdmin(request, reply)) return;
    const member = getOne('SELECT * FROM saas_tenant_members WHERE id = ?', [request.params.memberId]);
    if (!member) return reply.code(404).send({ error: 'Member not found' });

    const { role } = request.body || {};
    if (!['admin', 'member'].includes(role)) return reply.code(400).send({ error: 'role must be admin or member' });

    await writeQueue(() => runQuery('UPDATE saas_tenant_members SET role = ? WHERE id = ?', [role, request.params.memberId]));
    auditLog(member.tenant_id, request.user.id, 'iam.member.role_changed', 'user', member.user_id, { role });
    return { ...member, role };
  });

  fastify.delete('/api/saas/iam/members/:memberId', auth, async (request, reply) => {
    if (requiresTenantAdmin(request, reply)) return;
    const member = getOne('SELECT * FROM saas_tenant_members WHERE id = ?', [request.params.memberId]);
    if (!member) return reply.code(404).send({ error: 'Member not found' });

    await writeQueue(() => {
      runQuery('DELETE FROM saas_member_roles WHERE member_id = ?', [request.params.memberId]);
      runQuery('DELETE FROM saas_tenant_members WHERE id = ?', [request.params.memberId]);
    });
    auditLog(member.tenant_id, request.user.id, 'iam.member.removed', 'user', member.user_id);
    return reply.code(204).send();
  });

  // ── PAM: Roles & Permissions ────────────────────────────────────────────────

  fastify.get('/api/saas/pam/roles', auth, async (request, reply) => {
    let tenantId;
    if (isOperator(request)) {
      tenantId = request.query.tenant_id;
      if (!tenantId) return reply.code(400).send({ error: 'tenant_id required for operator' });
    } else {
      const m = getTenantMembership(request.user.id);
      if (!m || m.role !== 'admin') return reply.code(403).send({ error: 'Tenant admin required' });
      tenantId = m.tenant_id;
    }
    const roles = getAll('SELECT * FROM saas_roles WHERE tenant_id = ? ORDER BY name', [tenantId]);
    return roles.map(r => ({
      ...r,
      permissions: getAll('SELECT * FROM saas_permissions WHERE role_id = ?', [r.id])
    }));
  });

  fastify.post('/api/saas/pam/roles', auth, async (request, reply) => {
    if (requiresTenantAdmin(request, reply)) return;
    const m = isOperator(request) ? { tenant_id: request.body?.tenant_id } : getTenantMembership(request.user.id);
    if (!m?.tenant_id) return reply.code(400).send({ error: 'tenant_id required' });

    const { name, description } = request.body || {};
    if (!name) return reply.code(400).send({ error: 'name required' });

    const id = nanoid();
    await writeQueue(() => {
      runQuery(
        'INSERT INTO saas_roles (id, tenant_id, name, description, created_at) VALUES (?,?,?,?,?)',
        [id, m.tenant_id, name, description || null, Date.now()]
      );
    });
    auditLog(m.tenant_id, request.user.id, 'pam.role.created', 'role', id, { name });
    return reply.code(201).send(getOne('SELECT * FROM saas_roles WHERE id = ?', [id]));
  });

  fastify.delete('/api/saas/pam/roles/:roleId', auth, async (request, reply) => {
    if (requiresTenantAdmin(request, reply)) return;
    const role = getOne('SELECT * FROM saas_roles WHERE id = ?', [request.params.roleId]);
    if (!role) return reply.code(404).send({ error: 'Role not found' });

    await writeQueue(() => {
      runQuery('DELETE FROM saas_permissions WHERE role_id = ?', [request.params.roleId]);
      runQuery('DELETE FROM saas_member_roles WHERE role_id = ?', [request.params.roleId]);
      runQuery('DELETE FROM saas_roles WHERE id = ?', [request.params.roleId]);
    });
    auditLog(role.tenant_id, request.user.id, 'pam.role.deleted', 'role', role.id, { name: role.name });
    return reply.code(204).send();
  });

  fastify.put('/api/saas/pam/roles/:roleId/permissions', auth, async (request, reply) => {
    if (requiresTenantAdmin(request, reply)) return;
    const role = getOne('SELECT * FROM saas_roles WHERE id = ?', [request.params.roleId]);
    if (!role) return reply.code(404).send({ error: 'Role not found' });

    const { permissions = [] } = request.body || {};
    await writeQueue(() => {
      runQuery('DELETE FROM saas_permissions WHERE role_id = ?', [request.params.roleId]);
      permissions.forEach(({ service_id, can_view = 1, can_use = 0, can_admin = 0 }) => {
        runQuery(
          'INSERT INTO saas_permissions (id, role_id, service_id, can_view, can_use, can_admin, created_at) VALUES (?,?,?,?,?,?,?)',
          [nanoid(), role.id, service_id, can_view ? 1 : 0, can_use ? 1 : 0, can_admin ? 1 : 0, Date.now()]
        );
      });
    });
    auditLog(role.tenant_id, request.user.id, 'pam.permissions.updated', 'role', role.id);
    return getAll('SELECT * FROM saas_permissions WHERE role_id = ?', [role.id]);
  });

  fastify.post('/api/saas/pam/members/:memberId/roles', auth, async (request, reply) => {
    if (requiresTenantAdmin(request, reply)) return;
    const { role_id } = request.body || {};
    if (!role_id) return reply.code(400).send({ error: 'role_id required' });

    const member = getOne('SELECT * FROM saas_tenant_members WHERE id = ?', [request.params.memberId]);
    if (!member) return reply.code(404).send({ error: 'Member not found' });

    try {
      await writeQueue(() => {
        runQuery('INSERT INTO saas_member_roles (member_id, role_id) VALUES (?,?)', [request.params.memberId, role_id]);
      });
    } catch {
      return reply.code(409).send({ error: 'Role already assigned' });
    }
    auditLog(member.tenant_id, request.user.id, 'pam.role.assigned', 'user', member.user_id, { role_id });
    return reply.code(201).send({ member_id: request.params.memberId, role_id });
  });

  // ── Audit log ───────────────────────────────────────────────────────────────

  fastify.get('/api/saas/audit-log', auth, async (request, reply) => {
    let tenantId;
    if (isOperator(request)) {
      tenantId = request.query.tenant_id;
    } else {
      const m = getTenantMembership(request.user.id);
      if (!m || m.role !== 'admin') return reply.code(403).send({ error: 'Tenant admin required' });
      tenantId = m.tenant_id;
    }
    const sql = tenantId
      ? 'SELECT a.*, u.email FROM saas_audit_log a LEFT JOIN users u ON u.id = a.user_id WHERE a.tenant_id = ? ORDER BY a.created_at DESC LIMIT 200'
      : 'SELECT a.*, u.email FROM saas_audit_log a LEFT JOIN users u ON u.id = a.user_id ORDER BY a.created_at DESC LIMIT 200';
    return getAll(sql, tenantId ? [tenantId] : []);
  });

  // ── Operator: Plan/Service management ──────────────────────────────────────

  fastify.post('/api/saas/plans', auth, async (request, reply) => {
    if (requiresOperator(request, reply)) return;
    const { name, description, price_monthly = 0 } = request.body || {};
    if (!name) return reply.code(400).send({ error: 'name required' });
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const id = `plan-${nanoid(8)}`;
    await writeQueue(() => {
      runQuery(
        'INSERT INTO saas_plans (id, name, slug, description, price_monthly, is_active, created_at) VALUES (?,?,?,?,?,1,?)',
        [id, name, slug, description || null, price_monthly, Date.now()]
      );
    });
    return reply.code(201).send(planWithServices(getOne('SELECT * FROM saas_plans WHERE id = ?', [id])));
  });

  fastify.put('/api/saas/plans/:id/services', auth, async (request, reply) => {
    if (requiresOperator(request, reply)) return;
    const { services = [] } = request.body || {};
    const planId = request.params.id;
    const plan = getOne('SELECT id FROM saas_plans WHERE id = ?', [planId]);
    if (!plan) return reply.code(404).send({ error: 'Plan not found' });

    await writeQueue(() => {
      runQuery('DELETE FROM saas_plan_services WHERE plan_id = ?', [planId]);
      services.forEach(({ service_id, quantity = 1 }) => {
        runQuery('INSERT INTO saas_plan_services (plan_id, service_id, quantity) VALUES (?,?,?)', [planId, service_id, quantity]);
      });
    });
    return planWithServices(getOne('SELECT * FROM saas_plans WHERE id = ?', [planId]));
  });

  // ── Engagements (Ethical Hacker) ────────────────────────────────────────────

  fastify.get('/api/saas/engagements', auth, async (request, reply) => {
    let tenantId;
    if (isOperator(request)) {
      tenantId = request.query.tenant_id; // optional filter
    } else {
      const m = getTenantMembership(request.user.id);
      if (!m) return reply.code(403).send({ error: 'No tenant membership' });
      tenantId = m.tenant_id;
    }
    const sql = tenantId
      ? 'SELECT * FROM saas_engagements WHERE tenant_id = ? ORDER BY created_at DESC'
      : 'SELECT * FROM saas_engagements ORDER BY created_at DESC LIMIT 100';
    return getAll(sql, tenantId ? [tenantId] : []);
  });

  fastify.post('/api/saas/engagements', auth, async (request, reply) => {
    const m = isOperator(request) ? null : getTenantMembership(request.user.id);
    if (!isOperator(request) && !m) return reply.code(403).send({ error: 'No tenant membership' });
    const tenantId = m?.tenant_id || request.body?.tenant_id;
    if (!tenantId) return reply.code(400).send({ error: 'tenant_id required' });

    const { name, target, test_type = 'web', scope, out_of_scope, start_date, end_date, risk_level = 'medium' } = request.body || {};
    if (!name?.trim()) return reply.code(400).send({ error: 'name required' });
    if (!target?.trim()) return reply.code(400).send({ error: 'target required' });

    const id = nanoid();
    const repo_slug = `pentest-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)}-${id.slice(0, 6)}`;
    const now = Date.now();
    await writeQueue(() => {
      runQuery(
        'INSERT INTO saas_engagements (id, tenant_id, name, target, test_type, scope, out_of_scope, start_date, end_date, status, risk_level, repo_slug, findings_count, created_by, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,0,?,?)',
        [id, tenantId, name.trim(), target.trim(), test_type, scope || null, out_of_scope || null, start_date || null, end_date || null, 'scoping', risk_level, repo_slug, request.user.id, now]
      );
    });
    auditLog(tenantId, request.user.id, 'engagement.created', 'engagement', id, { name, test_type, target });
    return reply.code(201).send(getOne('SELECT * FROM saas_engagements WHERE id = ?', [id]));
  });

  fastify.put('/api/saas/engagements/:id', auth, async (request, reply) => {
    const eng = getOne('SELECT * FROM saas_engagements WHERE id = ?', [request.params.id]);
    if (!eng) return reply.code(404).send({ error: 'Not found' });
    const m = isOperator(request) ? null : getTenantMembership(request.user.id);
    if (!isOperator(request) && m?.tenant_id !== eng.tenant_id) return reply.code(403).send({ error: 'Forbidden' });

    const { name, target, test_type, scope, out_of_scope, start_date, end_date, status, risk_level } = request.body || {};
    await writeQueue(() => {
      runQuery(
        'UPDATE saas_engagements SET name=COALESCE(?,name), target=COALESCE(?,target), test_type=COALESCE(?,test_type), scope=COALESCE(?,scope), out_of_scope=COALESCE(?,out_of_scope), start_date=COALESCE(?,start_date), end_date=COALESCE(?,end_date), status=COALESCE(?,status), risk_level=COALESCE(?,risk_level) WHERE id=?',
        [name||null, target||null, test_type||null, scope||null, out_of_scope||null, start_date||null, end_date||null, status||null, risk_level||null, request.params.id]
      );
    });
    auditLog(eng.tenant_id, request.user.id, 'engagement.updated', 'engagement', eng.id);
    return getOne('SELECT * FROM saas_engagements WHERE id = ?', [request.params.id]);
  });

  fastify.delete('/api/saas/engagements/:id', auth, async (request, reply) => {
    const eng = getOne('SELECT * FROM saas_engagements WHERE id = ?', [request.params.id]);
    if (!eng) return reply.code(404).send({ error: 'Not found' });
    const m = isOperator(request) ? null : getTenantMembership(request.user.id);
    if (!isOperator(request) && m?.tenant_id !== eng.tenant_id) return reply.code(403).send({ error: 'Forbidden' });
    await writeQueue(() => runQuery('DELETE FROM saas_engagements WHERE id = ?', [request.params.id]));
    auditLog(eng.tenant_id, request.user.id, 'engagement.deleted', 'engagement', eng.id);
    return reply.code(204).send();
  });
}
