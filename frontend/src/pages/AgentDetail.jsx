import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

function Field({ label, value }) {
  return (
    <div
      style={{
        backgroundColor: '#18181b',
        border: '1px solid #27272a',
        borderRadius: '8px',
        padding: '16px',
      }}
    >
      <div style={{ fontSize: '12px', color: '#a1a1aa', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ fontSize: '14px', color: '#e4e4e7', wordBreak: 'break-all' }}>{value || '—'}</div>
    </div>
  );
}

function formatDate(ts) {
  if (!ts) return '—';
  try { return new Date(ts).toLocaleString(); } catch { return ts; }
}

export default function AgentDetail() {
  const { id } = useParams();
  const { fetchWithAuth } = useAuth();
  const [agent, setAgent] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [heartbeats, setHeartbeats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const res = await fetchWithAuth(`/agents/${id}`);
      if (!res.ok) { setError('Agent not found'); return; }
      const data = await res.json();
      const ag = data.agent || data;
      setAgent(ag);
      setTasks(Array.isArray(ag.tasks) ? ag.tasks : (ag.taskHistory || []));
      const hbs = Array.isArray(ag.heartbeats) ? ag.heartbeats : [];
      setHeartbeats(hbs.slice(-10));
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, [id, fetchWithAuth]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div style={{ color: '#a1a1aa' }}>Loading...</div>;
  if (error) return (
    <div>
      <Link to="/agents" style={{ color: '#6366f1', fontSize: '13px' }}>← Agents</Link>
      <div style={{ marginTop: '16px', color: '#ef4444' }}>{error}</div>
    </div>
  );
  if (!agent) return null;

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <Link to="/agents" style={{ color: '#a1a1aa', fontSize: '13px' }}>← Agents</Link>
      </div>
      <h1 style={{ fontSize: '20px', fontWeight: 600, color: '#e4e4e7', marginBottom: '24px' }}>
        Agent {String(agent.id || agent._id).slice(0, 16)}...
      </h1>

      {/* Fields grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '28px' }}>
        <Field label="ID" value={agent.id || agent._id} />
        <Field label="Status" value={agent.status} />
        <Field label="Type" value={agent.type || agent.agent_type} />
        <Field label="Swarm ID" value={agent.swarm_id || agent.swarmId} />
        <Field label="Ruflo ID" value={agent.ruflo_id || agent.rufloId} />
        <Field label="VM ID" value={agent.vm_id || agent.vmId} />
        <Field label="Created" value={formatDate(agent.createdAt || agent.created_at)} />
        <Field label="Last Heartbeat" value={formatDate(agent.lastHeartbeat || agent.last_heartbeat)} />
      </div>

      {/* Task history */}
      <div
        style={{
          backgroundColor: '#18181b',
          border: '1px solid #27272a',
          borderRadius: '8px',
          overflow: 'hidden',
          marginBottom: '20px',
        }}
      >
        <div style={{ padding: '16px', borderBottom: '1px solid #27272a' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#e4e4e7' }}>Task History</h2>
        </div>
        {tasks.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: '#a1a1aa', fontSize: '13px' }}>No tasks recorded.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #27272a' }}>
                {['ID', 'Title', 'Status', 'Started', 'Finished'].map((h) => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 500, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tasks.map((t, i) => (
                <tr key={t.id || t._id || i} style={{ borderBottom: i < tasks.length - 1 ? '1px solid #27272a' : 'none' }}>
                  <td style={{ padding: '10px 16px', color: '#a1a1aa', fontSize: '12px', fontFamily: 'monospace' }}>{String(t.id || t._id || '').slice(0, 8)}</td>
                  <td style={{ padding: '10px 16px', color: '#e4e4e7', fontSize: '13px' }}>{t.title || t.name || '—'}</td>
                  <td style={{ padding: '10px 16px', color: '#e4e4e7', fontSize: '13px' }}>{t.status || '—'}</td>
                  <td style={{ padding: '10px 16px', color: '#a1a1aa', fontSize: '13px' }}>{formatDate(t.startedAt || t.started_at)}</td>
                  <td style={{ padding: '10px 16px', color: '#a1a1aa', fontSize: '13px' }}>{formatDate(t.finishedAt || t.finished_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Heartbeat timeline */}
      <div
        style={{
          backgroundColor: '#18181b',
          border: '1px solid #27272a',
          borderRadius: '8px',
          padding: '20px',
        }}
      >
        <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#e4e4e7', marginBottom: '14px' }}>Last 10 Heartbeats</h2>
        {heartbeats.length === 0 ? (
          <div style={{ color: '#a1a1aa', fontSize: '13px' }}>No heartbeats recorded.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {[...heartbeats].reverse().map((hb, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 12px',
                  backgroundColor: '#0a0a0f',
                  borderRadius: '6px',
                  fontSize: '13px',
                }}
              >
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: '#22c55e',
                    flexShrink: 0,
                  }}
                />
                <span style={{ color: '#a1a1aa' }}>
                  {formatDate(typeof hb === 'string' || typeof hb === 'number' ? hb : (hb.ts || hb.timestamp || hb.at))}
                </span>
                {typeof hb === 'object' && hb.status && (
                  <span style={{ color: '#e4e4e7', marginLeft: '8px' }}>{hb.status}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
