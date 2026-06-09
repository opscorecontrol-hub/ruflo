import { nanoid } from 'nanoid';
import { writeQueue, runQuery, getOne, getAll } from '../db/init.js';

export async function createMonitor(userId, { name, url, interval_s = 60 }) {
  const id = nanoid();
  const created_at = Date.now();
  await writeQueue(() => {
    runQuery(
      'INSERT INTO monitors (id, user_id, name, url, interval_s, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, userId, name, url, interval_s, 'active', created_at]
    );
  });
  return getOne('SELECT * FROM monitors WHERE id = ?', [id]);
}

export function listMonitors(userId) {
  return getAll('SELECT * FROM monitors WHERE user_id = ? ORDER BY created_at DESC', [userId]);
}

export function getMonitor(id) {
  return getOne('SELECT * FROM monitors WHERE id = ?', [id]);
}

export async function updateMonitor(id, data) {
  const fields = [];
  const values = [];
  for (const [k, v] of Object.entries(data)) {
    if (['name', 'url', 'interval_s', 'status'].includes(k)) {
      fields.push(`${k} = ?`);
      values.push(v);
    }
  }
  if (!fields.length) return getMonitor(id);
  values.push(id);
  await writeQueue(() => {
    runQuery(`UPDATE monitors SET ${fields.join(', ')} WHERE id = ?`, values);
  });
  return getMonitor(id);
}

export async function deleteMonitor(id) {
  await writeQueue(() => {
    runQuery('DELETE FROM checks WHERE monitor_id = ?', [id]);
    runQuery('DELETE FROM alerts WHERE monitor_id = ?', [id]);
    runQuery('DELETE FROM incidents WHERE monitor_id = ?', [id]);
    runQuery('DELETE FROM monitors WHERE id = ?', [id]);
  });
}

export function getStats() {
  const total = getOne('SELECT COUNT(*) as count FROM monitors');
  const up = getOne("SELECT COUNT(*) as count FROM monitors WHERE status = 'active'");
  const down = getOne("SELECT COUNT(*) as count FROM monitors WHERE status = 'down'");
  const incidents = getOne('SELECT COUNT(*) as count FROM incidents WHERE resolved_at IS NULL');
  return {
    total: total?.count || 0,
    up: up?.count || 0,
    down: down?.count || 0,
    activeIncidents: incidents?.count || 0
  };
}

export function getChecks(monitorId, limit = 100) {
  return getAll(
    'SELECT * FROM checks WHERE monitor_id = ? ORDER BY checked_at DESC LIMIT ?',
    [monitorId, limit]
  );
}

export function getUptimeData(monitorId, hours = 24) {
  const since = Date.now() - hours * 3600 * 1000;
  const checks = getAll(
    'SELECT status, checked_at FROM checks WHERE monitor_id = ? AND checked_at > ? ORDER BY checked_at ASC',
    [monitorId, since]
  );
  if (!checks.length) return { uptime: 100, checks: [] };
  const upCount = checks.filter(c => c.status === 'up').length;
  const uptime = Math.round((upCount / checks.length) * 10000) / 100;
  return { uptime, checks };
}

export function getIncidents() {
  return getAll(
    `SELECT i.*, m.name as monitor_name, m.url as monitor_url
     FROM incidents i LEFT JOIN monitors m ON m.id = i.monitor_id
     ORDER BY i.started_at DESC LIMIT 100`
  );
}

export function getMonitorIncidents(id) {
  return getAll(
    'SELECT * FROM incidents WHERE monitor_id = ? ORDER BY started_at DESC',
    [id]
  );
}
