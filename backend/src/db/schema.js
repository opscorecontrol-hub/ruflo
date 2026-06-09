export function applySchema(db) {
  db.run(`CREATE TABLE IF NOT EXISTS swarms (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    name TEXT NOT NULL,
    status TEXT DEFAULT 'inactive',
    policy TEXT DEFAULT '{}',
    target_agent_count INTEGER DEFAULT 1,
    created_at INTEGER
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY,
    swarm_id TEXT,
    vm_id TEXT,
    type TEXT DEFAULT 'worker',
    status TEXT DEFAULT 'idle',
    ruflo_id TEXT,
    last_heartbeat INTEGER,
    metadata TEXT DEFAULT '{}',
    created_at INTEGER
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS vms (
    id TEXT PRIMARY KEY,
    swarm_id TEXT,
    provider TEXT DEFAULT 'local',
    provider_id TEXT,
    name TEXT,
    ip_address TEXT,
    instance_type TEXT DEFAULT 'cx22',
    status TEXT DEFAULT 'pending',
    created_at INTEGER
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS swarm_events (
    id TEXT PRIMARY KEY,
    swarm_id TEXT,
    agent_id TEXT,
    vm_id TEXT,
    event_type TEXT NOT NULL,
    payload TEXT DEFAULT '{}',
    created_at INTEGER
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    swarm_id TEXT,
    agent_id TEXT,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'queued',
    payload TEXT DEFAULT '{}',
    result TEXT,
    created_at INTEGER,
    completed_at INTEGER
  )`);

  db.run(`CREATE INDEX IF NOT EXISTS idx_agents_swarm ON agents(swarm_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_vms_swarm ON vms(swarm_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_events_swarm ON swarm_events(swarm_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_events_created ON swarm_events(created_at)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_tasks_swarm ON tasks(swarm_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_checks_monitor ON checks(monitor_id)`);
}
