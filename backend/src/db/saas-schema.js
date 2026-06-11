export function applySaasSchema(db) {
  // Seed column for existing users table (ignore error if column exists)
  try { db.run(`ALTER TABLE users ADD COLUMN saas_role TEXT DEFAULT 'user'`); } catch {}
  try { db.run(`ALTER TABLE users ADD COLUMN tenant_id TEXT`); } catch {}

  db.run(`CREATE TABLE IF NOT EXISTS saas_plans (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    price_monthly REAL DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at INTEGER
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS saas_services (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    display_name TEXT NOT NULL,
    description TEXT,
    icon TEXT DEFAULT '🔧',
    category TEXT DEFAULT 'general',
    is_active INTEGER DEFAULT 1,
    created_at INTEGER
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS saas_plan_services (
    plan_id TEXT NOT NULL,
    service_id TEXT NOT NULL,
    quantity INTEGER DEFAULT 1,
    PRIMARY KEY (plan_id, service_id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS saas_tenants (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    domain TEXT,
    status TEXT DEFAULT 'active',
    plan_id TEXT,
    subscribed_at INTEGER,
    created_at INTEGER
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS saas_tenant_members (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT DEFAULT 'member',
    invited_by TEXT,
    created_at INTEGER
  )`);

  db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_member_unique ON saas_tenant_members(tenant_id, user_id)`);

  db.run(`CREATE TABLE IF NOT EXISTS saas_roles (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    created_at INTEGER
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS saas_permissions (
    id TEXT PRIMARY KEY,
    role_id TEXT NOT NULL,
    service_id TEXT NOT NULL,
    can_view INTEGER DEFAULT 1,
    can_use INTEGER DEFAULT 0,
    can_admin INTEGER DEFAULT 0,
    created_at INTEGER
  )`);

  db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_perm_role_svc ON saas_permissions(role_id, service_id)`);

  db.run(`CREATE TABLE IF NOT EXISTS saas_member_roles (
    member_id TEXT NOT NULL,
    role_id TEXT NOT NULL,
    PRIMARY KEY (member_id, role_id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS saas_audit_log (
    id TEXT PRIMARY KEY,
    tenant_id TEXT,
    user_id TEXT,
    action TEXT NOT NULL,
    resource_type TEXT,
    resource_id TEXT,
    details TEXT DEFAULT '{}',
    created_at INTEGER
  )`);

  db.run(`CREATE INDEX IF NOT EXISTS idx_audit_tenant ON saas_audit_log(tenant_id, created_at)`);

  db.run(`CREATE TABLE IF NOT EXISTS saas_engagements (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    target TEXT NOT NULL,
    test_type TEXT NOT NULL DEFAULT 'web',
    scope TEXT,
    out_of_scope TEXT,
    start_date TEXT,
    end_date TEXT,
    status TEXT NOT NULL DEFAULT 'scoping',
    risk_level TEXT DEFAULT 'medium',
    repo_slug TEXT,
    findings_count INTEGER DEFAULT 0,
    created_by TEXT,
    created_at INTEGER
  )`);

  // Seed default service catalog if empty
  const existing = db.exec("SELECT COUNT(*) as n FROM saas_services");
  if (existing?.[0]?.values?.[0]?.[0] === 0) {
    const now = Date.now();
    const services = [
      ['svc-github', 'github-repo', 'GitHub Repository', 'Managed private GitHub repository with CI/CD access', '🐙', 'devtools'],
      ['svc-crowdsec', 'crowdsec', 'CrowdSec', 'Open-source crowdsourced security threat detection', '🛡️', 'security'],
      ['svc-decepticon', 'decepticon', 'Decepticon', 'Deception technology — honeypots and threat traps', '🪤', 'security'],
      ['svc-purple-ai', 'purple-ai', 'Purple AI', 'AI-powered purple team security intelligence', '🤖', 'ai'],
      ['svc-ethicalhacker', 'ethical-hacker', 'Ethical Hacker', 'On-demand penetration testing with structured GitHub deliverables', '🔐', 'security'],
    ];
    services.forEach(([id, name, display_name, description, icon, category]) => {
      try {
        db.run(
          'INSERT INTO saas_services (id, name, display_name, description, icon, category, is_active, created_at) VALUES (?,?,?,?,?,?,1,?)',
          [id, name, display_name, description, icon, category, now]
        );
      } catch {}
    });

    const plans = [
      ['plan-starter', 'Starter', 'starter', 'Perfect for small teams. 1 GitHub repo.', 49],
      ['plan-pro', 'Pro', 'pro', '2 GitHub repos + CrowdSec security agent.', 149],
      ['plan-enterprise', 'Enterprise', 'enterprise', 'Full stack: 2 repos + CrowdSec + Decepticon + Purple AI.', 499],
    ];
    plans.forEach(([id, name, slug, description, price]) => {
      try {
        db.run(
          'INSERT INTO saas_plans (id, name, slug, description, price_monthly, is_active, created_at) VALUES (?,?,?,?,?,1,?)',
          [id, name, slug, description, price, now]
        );
      } catch {}
    });

    const planServices = [
      ['plan-starter', 'svc-github', 1],
      ['plan-pro', 'svc-github', 2],
      ['plan-pro', 'svc-crowdsec', 1],
      ['plan-enterprise', 'svc-github', 2],
      ['plan-enterprise', 'svc-crowdsec', 1],
      ['plan-enterprise', 'svc-decepticon', 1],
      ['plan-enterprise', 'svc-purple-ai', 1],
      ['plan-enterprise', 'svc-ethicalhacker', 1],
    ];
    planServices.forEach(([plan_id, service_id, quantity]) => {
      try {
        db.run('INSERT INTO saas_plan_services (plan_id, service_id, quantity) VALUES (?,?,?)', [plan_id, service_id, quantity]);
      } catch {}
    });
  }
}
