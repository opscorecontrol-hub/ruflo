import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

function StatusBadge({ status }) {
  const map = {
    pending: { bg: 'rgba(234,179,8,0.1)', border: 'rgba(234,179,8,0.3)', text: '#eab308' },
    running: { bg: 'rgba(99,102,241,0.1)', border: 'rgba(99,102,241,0.3)', text: '#6366f1' },
    completed: { bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.3)', text: '#22c55e' },
    failed: { bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.3)', text: '#ef4444' },
    cancelled: { bg: 'rgba(161,161,170,0.1)', border: 'rgba(161,161,170,0.3)', text: '#a1a1aa' },
    queued: { bg: 'rgba(234,179,8,0.1)', border: 'rgba(234,179,8,0.3)', text: '#eab308' },
  };
  const c = map[status] || map.pending;
  return (
    <span style={{
      display: 'inline-block', padding: '2px 10px',
      backgroundColor: c.bg, border: `1px solid ${c.border}`,
      borderRadius: '20px', color: c.text,
      fontSize: '11px', fontWeight: 500,
      textTransform: 'uppercase', letterSpacing: '0.06em',
    }}>
      {status || 'pending'}
    </span>
  );
}

const inp = {
  padding: '8px 10px', backgroundColor: '#0a0a0f',
  border: '1px solid #27272a', borderRadius: '6px',
  color: '#e4e4e7', fontSize: '13px', outline: 'none',
};

function ActionBtn({ children, onClick, color = '#6366f1', outline = false, small = false, disabled = false }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        padding: small ? '3px 9px' : '6px 13px',
        backgroundColor: outline ? (hover ? `${color}18` : 'transparent') : color,
        border: `1px solid ${color}`,
        borderRadius: '6px', color: outline ? color : '#fff',
        fontSize: small ? '12px' : '13px', cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1, transition: 'background .15s',
      }}
    >
      {children}
    </button>
  );
}

export default function OrchestrationPage() {
  const { fetchWithAuth } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [pipelines, setPipelines] = useState([]);
  const [swarms, setSwarms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [newTask, setNewTask] = useState({ swarm_id: '', title: '', description: '' });
  const [creatingTask, setCreatingTask] = useState(false);
  const [triggerPipeline, setTriggerPipeline] = useState(null);
  const [pipelinePayload, setPipelinePayload] = useState('{}');
  const [triggering, setTriggering] = useState(false);
  const [actionError, setActionError] = useState('');
  const [clearing, setClearing] = useState(false);
  const [scalingSwarm, setScalingSwarm] = useState(null);
  const [targetCount, setTargetCount] = useState('');
  const [scalingBusy, setScalingBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [tRes, pRes, sRes] = await Promise.all([
        fetchWithAuth('/orchestration/tasks'),
        fetchWithAuth('/orchestration/pipelines'),
        fetchWithAuth('/swarm'),
      ]);
      if (tRes.ok) {
        const d = await tRes.json();
        setTasks(Array.isArray(d) ? d : (d.tasks || []));
      }
      if (pRes.ok) {
        const d = await pRes.json();
        setPipelines(Array.isArray(d) ? d : (d.pipelines || []));
      }
      if (sRes.ok) {
        const d = await sRes.json();
        setSwarms(Array.isArray(d) ? d : (d.swarms || []));
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth]);

  useEffect(() => { load(); }, [load]);

  const handleCreateTask = async (e) => {
    e.preventDefault();
    setCreatingTask(true);
    setActionError('');
    try {
      const res = await fetchWithAuth('/orchestration/tasks', {
        method: 'POST',
        body: JSON.stringify(newTask),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setActionError(d.message || 'Create task failed');
        return;
      }
      setShowTaskForm(false);
      setNewTask({ swarm_id: '', title: '', description: '' });
      await load();
    } catch {
      setActionError('Network error');
    } finally {
      setCreatingTask(false);
    }
  };

  const handleTriggerPipeline = async (e) => {
    e.preventDefault();
    setTriggering(true);
    setActionError('');
    try {
      let payload = {};
      try { payload = JSON.parse(pipelinePayload); } catch {
        setActionError('Invalid JSON payload');
        setTriggering(false);
        return;
      }
      const pipelineName = triggerPipeline.name || triggerPipeline.id || triggerPipeline._id;
      const res = await fetchWithAuth('/orchestration/pipelines', {
        method: 'POST',
        body: JSON.stringify({ name: pipelineName, payload }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setActionError(d.message || 'Trigger failed');
        return;
      }
      setTriggerPipeline(null);
      setPipelinePayload('{}');
      await load();
    } catch {
      setActionError('Network error');
    } finally {
      setTriggering(false);
    }
  };

  const handleTaskAction = async (taskId, status) => {
    setActionError('');
    try {
      const res = await fetchWithAuth(`/orchestration/tasks/${taskId}`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setActionError(d.error || 'Action failed');
        return;
      }
      await load();
    } catch {
      setActionError('Network error');
    }
  };

  const handleBulkClear = async () => {
    setClearing(true);
    setActionError('');
    try {
      await fetchWithAuth('/orchestration/tasks?status=completed,failed,cancelled', {
        method: 'DELETE',
      });
      await load();
    } catch {
      setActionError('Network error');
    } finally {
      setClearing(false);
    }
  };

  const handleSetTargetAgents = async (e) => {
    e.preventDefault();
    const count = parseInt(targetCount, 10);
    if (!scalingSwarm || isNaN(count) || count < 1) return;
    setScalingBusy(true);
    setActionError('');
    try {
      const res = await fetchWithAuth(`/swarm/${scalingSwarm.id || scalingSwarm._id}`, {
        method: 'PUT',
        body: JSON.stringify({ targetAgentCount: count }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setActionError(d.error || 'Update failed');
        return;
      }
      setScalingSwarm(null);
      setTargetCount('');
      await load();
    } catch {
      setActionError('Network error');
    } finally {
      setScalingBusy(false);
    }
  };

  const doneCount = tasks.filter(t => ['completed', 'failed', 'cancelled'].includes(t.status)).length;

  if (loading) return <div style={{ color: '#a1a1aa' }}>Loading...</div>;

  return (
    <div>
      <h1 style={{ fontSize: '20px', fontWeight: 600, color: '#e4e4e7', marginBottom: '28px' }}>Orchestration</h1>

      {error && (
        <div style={{ padding: '12px', backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', color: '#ef4444', fontSize: '13px', marginBottom: '16px' }}>
          {error}
        </div>
      )}

      {actionError && (
        <div style={{ padding: '10px 14px', backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '6px', color: '#ef4444', fontSize: '13px', marginBottom: '14px' }}>
          {actionError}
        </div>
      )}

      {/* ── Task Queue ───────────────────────────────────────────────── */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#e4e4e7' }}>
            Task Queue <span style={{ fontSize: '13px', color: '#71717a', fontWeight: 400 }}>({tasks.length})</span>
          </h2>
          <div style={{ display: 'flex', gap: '8px' }}>
            {doneCount > 0 && (
              <ActionBtn onClick={handleBulkClear} disabled={clearing} color='#71717a' outline small>
                {clearing ? 'Clearing…' : `Clear ${doneCount} done`}
              </ActionBtn>
            )}
            <ActionBtn onClick={() => setShowTaskForm(!showTaskForm)} color={showTaskForm ? '#71717a' : '#6366f1'} outline={showTaskForm} small>
              {showTaskForm ? 'Cancel' : '+ New Task'}
            </ActionBtn>
          </div>
        </div>

        {showTaskForm && (
          <div style={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px', padding: '20px', marginBottom: '16px' }}>
            <form onSubmit={handleCreateTask} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#a1a1aa', marginBottom: '4px' }}>Swarm</label>
                  <select value={newTask.swarm_id} onChange={(e) => setNewTask(p => ({ ...p, swarm_id: e.target.value }))} required style={{ ...inp, width: '180px' }}>
                    <option value="">Select swarm</option>
                    {swarms.map(s => <option key={s.id || s._id} value={s.id || s._id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#a1a1aa', marginBottom: '4px' }}>Title</label>
                  <input value={newTask.title} onChange={(e) => setNewTask(p => ({ ...p, title: e.target.value }))} required placeholder="Task title" style={{ ...inp, width: '240px' }} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#a1a1aa', marginBottom: '4px' }}>Description</label>
                <textarea value={newTask.description} onChange={(e) => setNewTask(p => ({ ...p, description: e.target.value }))} rows={3} placeholder="Task description…" style={{ ...inp, width: '100%', resize: 'vertical' }} />
              </div>
              <ActionBtn color='#6366f1' disabled={creatingTask}>
                {creatingTask ? 'Creating…' : 'Create Task'}
              </ActionBtn>
            </form>
          </div>
        )}

        <div style={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px', overflow: 'hidden' }}>
          {tasks.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: '#a1a1aa', fontSize: '13px' }}>No tasks in queue.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #27272a' }}>
                  {['Title', 'Swarm', 'Status', 'Created', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 500, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tasks.map((t, i) => (
                  <tr key={t.id || t._id || i} style={{ borderBottom: i < tasks.length - 1 ? '1px solid #27272a' : 'none' }}>
                    <td style={{ padding: '10px 16px', color: '#e4e4e7', fontSize: '13px', fontWeight: 500 }}>{t.title || t.name}</td>
                    <td style={{ padding: '10px 16px', color: '#a1a1aa', fontSize: '12px', fontFamily: 'monospace' }}>{(t.swarm_id || t.swarmId || '—').slice(0, 10)}</td>
                    <td style={{ padding: '10px 16px' }}><StatusBadge status={t.status} /></td>
                    <td style={{ padding: '10px 16px', color: '#a1a1aa', fontSize: '12px' }}>
                      {t.created_at ? new Date(t.created_at).toLocaleString() : '—'}
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {['queued', 'running'].includes(t.status) && (
                          <ActionBtn onClick={() => handleTaskAction(t.id || t._id, 'cancelled')} color='#ef4444' outline small>Cancel</ActionBtn>
                        )}
                        {t.status === 'failed' && (
                          <ActionBtn onClick={() => handleTaskAction(t.id || t._id, 'queued')} color='#6366f1' outline small>Retry</ActionBtn>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Swarm Scaling Controls ────────────────────────────────────── */}
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#e4e4e7', marginBottom: '16px' }}>
          Swarm Scaling
        </h2>
        {scalingSwarm && (
          <div style={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px', padding: '20px', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#e4e4e7', marginBottom: '12px' }}>
              Set target agents — <span style={{ color: '#6366f1' }}>{scalingSwarm.name}</span>
            </h3>
            <form onSubmit={handleSetTargetAgents} style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#a1a1aa', marginBottom: '4px' }}>Target Agent Count</label>
                <input
                  type="number" min="0" max="50"
                  value={targetCount}
                  onChange={e => setTargetCount(e.target.value)}
                  placeholder={scalingSwarm.target_agent_count ?? 1}
                  style={{ ...inp, width: '120px' }}
                />
              </div>
              <ActionBtn color='#6366f1' disabled={scalingBusy}>
                {scalingBusy ? 'Updating…' : 'Apply'}
              </ActionBtn>
              <ActionBtn onClick={() => { setScalingSwarm(null); setTargetCount(''); }} color='#71717a' outline>
                Cancel
              </ActionBtn>
            </form>
          </div>
        )}
        <div style={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px', overflow: 'hidden' }}>
          {swarms.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: '#a1a1aa', fontSize: '13px' }}>No swarms found.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #27272a' }}>
                  {['Name', 'Status', 'Target Agents', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 500, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {swarms.map((s, i) => (
                  <tr key={s.id || s._id || i} style={{ borderBottom: i < swarms.length - 1 ? '1px solid #27272a' : 'none' }}>
                    <td style={{ padding: '10px 16px', color: '#e4e4e7', fontSize: '13px', fontWeight: 500 }}>{s.name}</td>
                    <td style={{ padding: '10px 16px' }}><StatusBadge status={s.status} /></td>
                    <td style={{ padding: '10px 16px', color: '#a1a1aa', fontSize: '13px' }}>{s.target_agent_count ?? '—'}</td>
                    <td style={{ padding: '10px 16px' }}>
                      <ActionBtn
                        onClick={() => { setScalingSwarm(s); setTargetCount(String(s.target_agent_count ?? 1)); setActionError(''); }}
                        color='#6366f1' outline small
                      >
                        Set Target
                      </ActionBtn>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Pipelines ─────────────────────────────────────────────────── */}
      <div>
        <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#e4e4e7', marginBottom: '16px' }}>Pipelines</h2>

        {triggerPipeline && (
          <div style={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px', padding: '20px', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#e4e4e7', marginBottom: '12px' }}>
              Trigger: {triggerPipeline.name}
            </h3>
            <form onSubmit={handleTriggerPipeline} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#a1a1aa', marginBottom: '4px' }}>Payload (JSON)</label>
                <textarea value={pipelinePayload} onChange={e => setPipelinePayload(e.target.value)} rows={4} style={{ ...inp, width: '100%', resize: 'vertical', fontFamily: 'monospace' }} />
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <ActionBtn color='#6366f1' disabled={triggering}>{triggering ? 'Triggering…' : 'Trigger'}</ActionBtn>
                <ActionBtn onClick={() => { setTriggerPipeline(null); setPipelinePayload('{}'); setActionError(''); }} color='#71717a' outline>Cancel</ActionBtn>
              </div>
            </form>
          </div>
        )}

        <div style={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px', overflow: 'hidden' }}>
          {pipelines.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: '#a1a1aa', fontSize: '13px' }}>No pipelines defined.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #27272a' }}>
                  {['Name', 'Status', 'Runs', 'Last Run', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 500, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pipelines.map((p, i) => (
                  <tr key={p.id || p._id || i} style={{ borderBottom: i < pipelines.length - 1 ? '1px solid #27272a' : 'none' }}>
                    <td style={{ padding: '10px 16px', color: '#e4e4e7', fontSize: '13px', fontWeight: 500 }}>{p.name}</td>
                    <td style={{ padding: '10px 16px' }}><StatusBadge status={p.status} /></td>
                    <td style={{ padding: '10px 16px', color: '#a1a1aa', fontSize: '13px' }}>{p.run_count ?? p.runCount ?? '—'}</td>
                    <td style={{ padding: '10px 16px', color: '#a1a1aa', fontSize: '13px' }}>
                      {p.lastRun || p.last_run ? new Date(p.lastRun || p.last_run).toLocaleString() : '—'}
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <ActionBtn onClick={() => { setTriggerPipeline(p); setActionError(''); }} color='#6366f1' outline small>
                          ▶ Trigger
                        </ActionBtn>
                        {p.status === 'running' && (
                          <ActionBtn
                            onClick={async () => {
                              await fetchWithAuth(`/orchestration/pipelines/${p.id || p._id}`, { method: 'DELETE' });
                              await load();
                            }}
                            color='#ef4444' outline small
                          >
                            Cancel
                          </ActionBtn>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
