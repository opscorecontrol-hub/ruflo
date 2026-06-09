import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';

function StatusBadge({ status }) {
  const map = {
    idle: { bg: 'rgba(161,161,170,0.1)', border: 'rgba(161,161,170,0.3)', text: '#a1a1aa' },
    busy: { bg: 'rgba(99,102,241,0.1)', border: 'rgba(99,102,241,0.3)', text: '#6366f1' },
    terminated: { bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.3)', text: '#ef4444' },
    spawning: { bg: 'rgba(234,179,8,0.1)', border: 'rgba(234,179,8,0.3)', text: '#eab308' },
    error: { bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.3)', text: '#ef4444' },
  };
  const c = map[status] || map.idle;
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
      {status || 'idle'}
    </span>
  );
}

function truncateId(id) {
  if (!id) return '—';
  const s = String(id);
  return s.length > 12 ? `${s.slice(0, 8)}...${s.slice(-4)}` : s;
}

function formatHb(ts) {
  if (!ts) return '—';
  try {
    const d = new Date(ts);
    const diff = Date.now() - d.getTime();
    if (diff < 60000) return `${Math.round(diff / 1000)}s ago`;
    if (diff < 3600000) return `${Math.round(diff / 60000)}m ago`;
    return d.toLocaleTimeString();
  } catch {
    return ts;
  }
}

const selectStyle = {
  padding: '7px 10px',
  backgroundColor: '#0a0a0f',
  border: '1px solid #27272a',
  borderRadius: '6px',
  color: '#e4e4e7',
  fontSize: '13px',
  outline: 'none',
};

export default function AgentsPage() {
  const { fetchWithAuth } = useAuth();
  const { subscribe } = useSocket();
  const [agents, setAgents] = useState([]);
  const [swarms, setSwarms] = useState([]);
  const [filterSwarm, setFilterSwarm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');

  const load = useCallback(async () => {
    try {
      const [aRes, sRes] = await Promise.all([
        fetchWithAuth('/agents'),
        fetchWithAuth('/swarms'),
      ]);
      if (aRes.ok) {
        const d = await aRes.json();
        setAgents(Array.isArray(d) ? d : (d.agents || []));
      } else {
        setError('Failed to load agents');
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

  useEffect(() => {
    const unsub = subscribe('agent:status', () => { load(); });
    return unsub;
  }, [subscribe, load]);

  const handleTerminate = async (id) => {
    setActionError('');
    try {
      const res = await fetchWithAuth(`/agents/${id}/terminate`, { method: 'POST' });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setActionError(d.message || 'Terminate failed');
      }
      await load();
    } catch {
      setActionError('Network error');
    }
  };

  const filtered = agents.filter((a) => {
    if (filterSwarm && (a.swarm_id || a.swarmId) !== filterSwarm) return false;
    if (filterStatus && a.status !== filterStatus) return false;
    return true;
  });

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 600, color: '#e4e4e7' }}>Agents</h1>
        <div style={{ display: 'flex', gap: '10px' }}>
          <select
            value={filterSwarm}
            onChange={(e) => setFilterSwarm(e.target.value)}
            style={selectStyle}
          >
            <option value="">All Swarms</option>
            {swarms.map((s) => (
              <option key={s.id || s._id} value={s.id || s._id}>{s.name}</option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={selectStyle}
          >
            <option value="">All Statuses</option>
            {['idle', 'busy', 'spawning', 'terminated', 'error'].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div style={{ padding: '12px', backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', color: '#ef4444', fontSize: '13px', marginBottom: '16px' }}>
          {error}
        </div>
      )}
      {actionError && (
        <div style={{ padding: '10px', backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', color: '#ef4444', fontSize: '13px', marginBottom: '12px' }}>
          {actionError}
        </div>
      )}

      {loading ? (
        <div style={{ color: '#a1a1aa' }}>Loading agents...</div>
      ) : filtered.length === 0 ? (
        <div style={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px', padding: '40px', textAlign: 'center', color: '#a1a1aa', fontSize: '14px' }}>
          No agents found.
        </div>
      ) : (
        <div style={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #27272a' }}>
                {['ID', 'Swarm', 'Type', 'Status', 'Last Heartbeat', 'Actions'].map((h) => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 500, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((a, i) => {
                const agentId = a.id || a._id;
                const swarm = swarms.find((s) => (s.id || s._id) === (a.swarm_id || a.swarmId));
                return (
                  <tr key={agentId || i} style={{ borderBottom: i < filtered.length - 1 ? '1px solid #27272a' : 'none' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <Link to={`/agents/${agentId}`} style={{ color: '#6366f1', fontSize: '13px', fontFamily: 'monospace' }}>
                        {truncateId(agentId)}
                      </Link>
                    </td>
                    <td style={{ padding: '12px 16px', color: '#e4e4e7', fontSize: '13px' }}>
                      {swarm ? swarm.name : (a.swarm_id || a.swarmId ? truncateId(a.swarm_id || a.swarmId) : '—')}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#a1a1aa', fontSize: '13px' }}>{a.type || a.agent_type || '—'}</td>
                    <td style={{ padding: '12px 16px' }}><StatusBadge status={a.status} /></td>
                    <td style={{ padding: '12px 16px', color: '#a1a1aa', fontSize: '13px' }}>
                      {formatHb(a.lastHeartbeat || a.last_heartbeat)}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {a.status !== 'terminated' && (
                        <button
                          onClick={() => handleTerminate(agentId)}
                          style={{
                            padding: '4px 10px',
                            backgroundColor: 'transparent',
                            border: '1px solid #ef4444',
                            borderRadius: '6px',
                            color: '#ef4444',
                            fontSize: '12px',
                            cursor: 'pointer',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.1)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                        >
                          Terminate
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
