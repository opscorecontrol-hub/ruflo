import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

function StatusBadge({ status }) {
  const map = {
    pending: { bg: 'rgba(234,179,8,0.1)', border: 'rgba(234,179,8,0.3)', text: '#eab308' },
    running: { bg: 'rgba(99,102,241,0.1)', border: 'rgba(99,102,241,0.3)', text: '#6366f1' },
    completed: { bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.3)', text: '#22c55e' },
    failed: { bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.3)', text: '#ef4444' },
    cancelled: { bg: 'rgba(161,161,170,0.1)', border: 'rgba(161,161,170,0.3)', text: '#a1a1aa' },
  };
  const c = map[status] || map.pending;
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 10px',
        backgroundColor: c.bg,
        border: `1px solid ${c.border}`,
        borderRadius: '20px',
        color: c.text,
        fontSize: '11px',
        fontWeight: 500,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
      }}
    >
      {status || 'pending'}
    </span>
  );
}

const inputStyle = {
  padding: '8px 10px',
  backgroundColor: '#0a0a0f',
  border: '1px solid #27272a',
  borderRadius: '6px',
  color: '#e4e4e7',
  fontSize: '13px',
  outline: 'none',
};

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

  if (loading) return <div style={{ color: '#a1a1aa' }}>Loading...</div>;

  return (
    <div>
      <h1 style={{ fontSize: '20px', fontWeight: 600, color: '#e4e4e7', marginBottom: '28px' }}>Orchestration</h1>

      {error && (
        <div style={{ padding: '12px', backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', color: '#ef4444', fontSize: '13px', marginBottom: '16px' }}>
          {error}
        </div>
      )}

      {/* Tasks section */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#e4e4e7' }}>Task Queue</h2>
          <button
            onClick={() => setShowTaskForm(!showTaskForm)}
            style={{
              padding: '7px 14px',
              backgroundColor: showTaskForm ? '#27272a' : '#6366f1',
              border: 'none',
              borderRadius: '6px',
              color: '#fff',
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            {showTaskForm ? 'Cancel' : '+ New Task'}
          </button>
        </div>

        {showTaskForm && (
          <div
            style={{
              backgroundColor: '#18181b',
              border: '1px solid #27272a',
              borderRadius: '8px',
              padding: '20px',
              marginBottom: '16px',
            }}
          >
            <form onSubmit={handleCreateTask} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#a1a1aa', marginBottom: '4px' }}>Swarm</label>
                  <select
                    value={newTask.swarm_id}
                    onChange={(e) => setNewTask((p) => ({ ...p, swarm_id: e.target.value }))}
                    required
                    style={{ ...inputStyle, width: '180px' }}
                  >
                    <option value="">Select swarm</option>
                    {swarms.map((s) => (
                      <option key={s.id || s._id} value={s.id || s._id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#a1a1aa', marginBottom: '4px' }}>Title</label>
                  <input
                    value={newTask.title}
                    onChange={(e) => setNewTask((p) => ({ ...p, title: e.target.value }))}
                    required
                    placeholder="Task title"
                    style={{ ...inputStyle, width: '240px' }}
                  />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#a1a1aa', marginBottom: '4px' }}>Description</label>
                <textarea
                  value={newTask.description}
                  onChange={(e) => setNewTask((p) => ({ ...p, description: e.target.value }))}
                  rows={3}
                  placeholder="Task description..."
                  style={{ ...inputStyle, width: '100%', resize: 'vertical' }}
                />
              </div>
              {actionError && <div style={{ fontSize: '13px', color: '#ef4444' }}>{actionError}</div>}
              <div>
                <button
                  type="submit"
                  disabled={creatingTask}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#6366f1',
                    border: 'none',
                    borderRadius: '6px',
                    color: '#fff',
                    fontSize: '13px',
                    cursor: creatingTask ? 'not-allowed' : 'pointer',
                    opacity: creatingTask ? 0.7 : 1,
                  }}
                >
                  {creatingTask ? 'Creating...' : 'Create Task'}
                </button>
              </div>
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
                  {['Title', 'Swarm', 'Status', 'Created'].map((h) => (
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
                    <td style={{ padding: '10px 16px', color: '#a1a1aa', fontSize: '13px' }}>{t.swarm_id || t.swarmId || '—'}</td>
                    <td style={{ padding: '10px 16px' }}><StatusBadge status={t.status} /></td>
                    <td style={{ padding: '10px 16px', color: '#a1a1aa', fontSize: '13px' }}>
                      {t.createdAt || t.created_at ? new Date(t.createdAt || t.created_at).toLocaleString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Pipelines section */}
      <div>
        <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#e4e4e7', marginBottom: '16px' }}>Pipelines</h2>

        {triggerPipeline && (
          <div
            style={{
              backgroundColor: '#18181b',
              border: '1px solid #27272a',
              borderRadius: '8px',
              padding: '20px',
              marginBottom: '16px',
            }}
          >
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#e4e4e7', marginBottom: '12px' }}>
              Trigger: {triggerPipeline.name}
            </h3>
            <form onSubmit={handleTriggerPipeline} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#a1a1aa', marginBottom: '4px' }}>Payload (JSON)</label>
                <textarea
                  value={pipelinePayload}
                  onChange={(e) => setPipelinePayload(e.target.value)}
                  rows={4}
                  style={{ ...inputStyle, width: '100%', resize: 'vertical', fontFamily: 'monospace' }}
                />
              </div>
              {actionError && <div style={{ fontSize: '13px', color: '#ef4444' }}>{actionError}</div>}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="submit"
                  disabled={triggering}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#6366f1',
                    border: 'none',
                    borderRadius: '6px',
                    color: '#fff',
                    fontSize: '13px',
                    cursor: triggering ? 'not-allowed' : 'pointer',
                    opacity: triggering ? 0.7 : 1,
                  }}
                >
                  {triggering ? 'Triggering...' : 'Trigger'}
                </button>
                <button
                  type="button"
                  onClick={() => { setTriggerPipeline(null); setPipelinePayload('{}'); setActionError(''); }}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: 'transparent',
                    border: '1px solid #27272a',
                    borderRadius: '6px',
                    color: '#a1a1aa',
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
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
                  {['Name', 'Status', 'Runs', 'Last Run', 'Actions'].map((h) => (
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
                      <button
                        onClick={() => { setTriggerPipeline(p); setActionError(''); }}
                        style={{
                          padding: '4px 12px',
                          backgroundColor: 'transparent',
                          border: '1px solid #6366f1',
                          borderRadius: '6px',
                          color: '#6366f1',
                          fontSize: '12px',
                          cursor: 'pointer',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(99,102,241,0.1)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                      >
                        Trigger Pipeline
                      </button>
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
