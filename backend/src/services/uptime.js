import { nanoid } from 'nanoid';
import { writeQueue, runQuery, getOne, getAll } from '../db/init.js';
import { bus } from '../events.js';

export async function checkMonitor(monitor) {
  const start = Date.now();
  try {
    const res = await fetch(monitor.url, { signal: AbortSignal.timeout(10000) });
    const responseTime = Date.now() - start;
    return {
      status: res.ok ? 'up' : 'down',
      responseTime,
      statusCode: res.status,
      error: null
    };
  } catch (err) {
    return {
      status: 'down',
      responseTime: Date.now() - start,
      statusCode: null,
      error: err.message
    };
  }
}

export async function runCheck(monitorId) {
  const monitor = getOne('SELECT * FROM monitors WHERE id = ?', [monitorId]);
  if (!monitor) return;

  const result = await checkMonitor(monitor);
  const checkId = nanoid();
  const now = Date.now();

  await writeQueue(() => {
    runQuery(
      'INSERT INTO checks (id, monitor_id, status, response_time, status_code, error, checked_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [checkId, monitorId, result.status, result.responseTime, result.statusCode, result.error, now]
    );
    runQuery(
      "UPDATE monitors SET status = ? WHERE id = ? AND status != 'paused'",
      [result.status === 'up' ? 'active' : 'down', monitorId]
    );
  });

  const previousCheck = getOne(
    'SELECT status FROM checks WHERE monitor_id = ? ORDER BY checked_at DESC LIMIT 1 OFFSET 1',
    [monitorId]
  );

  if (result.status === 'down' && (!previousCheck || previousCheck.status !== 'down')) {
    const incidentId = nanoid();
    await writeQueue(() => {
      runQuery(
        'INSERT INTO incidents (id, monitor_id, started_at) VALUES (?, ?, ?)',
        [incidentId, monitorId, now]
      );
    });
  } else if (result.status === 'up' && previousCheck?.status === 'down') {
    await writeQueue(() => {
      runQuery(
        'UPDATE incidents SET resolved_at = ? WHERE monitor_id = ? AND resolved_at IS NULL',
        [now, monitorId]
      );
    });
  }

  bus.emit('monitor:check', { monitorId, ...result, checkedAt: now });
  return result;
}

export async function runAllChecks() {
  const monitors = getAll("SELECT * FROM monitors WHERE status != 'paused'");
  for (const monitor of monitors) {
    await runCheck(monitor.id);
    await new Promise(r => setTimeout(r, 200));
  }
}

export function startUptimeLoop(intervalMs = 60000) {
  return setInterval(runAllChecks, intervalMs);
}
