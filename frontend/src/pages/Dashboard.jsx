import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const StatusDot = ({ up }) => (
  <span
    style={{
      display: 'inline-block',
      width: '8px',
      height: '8px',
      borderRadius: '50%',
      backgroundColor: up ? '#22c55e' : '#ef4444',
      boxShadow: up ? '0 0 6px #22c55e66' : '0 0 6px #ef444466',
      flexShrink: 0,
    }}
  />
);

const StatCard = ({ label, value, color }) => (
  <div
    style={{
      backgroundColor: '#18181b',
      border: '1px solid #27272a',
      borderRadius: '8px',
      padding: '20px',
      flex: 1,
      minWidth: '140px',
    }}
  >
    <div style={{ fontSize: '28px', fontWeight: 700, color: color || '#e4e4e7' }}>
      {value ?? '—'}
    </div>
    <div style={{ fontSize: '13px', color: '#a1a1aa', marginTop: '4px' }}>{label}</div>
  </div>
);

export default function Dashboard() {
  const { fetchWithAuth } = useAuth();
  const [monitors, setMonitors] = useState([]);
  const [stats, setStats] = useState({ total: 0, up: 0, down: 0, incidents: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newMonitor, setNewMonitor] = useState({ name: '', url: '', interval: 60 });
  const [actionError, setActionError] = useState('');

  const loadMonitors = useCallback(async () => {
    try {
      const res = await fetchWithAuth('/monitors');
      if (!res.ok) { setError('Failed to load monitors'); return; }
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data.monitors || []);
      setMonitors(list);
      const up = list.filter((m) => m.status === 'up').length;
      const down = list.filter((m) => m.status === 'down').length;
      const incidents = list.filter((m) => m.status === 'incident' || m.status === 'down').length;
      setStats({ total: list.length, up, down, incidents });
    } catch {
      setError('Network error loading monitors');
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth]);

  useEffect(() => {
    loadMonitors();
    const interval = setInterval(loadMonitors, 30000);
    return () => clearInterval(interval);
  }, [loadMonitors]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    setActionError('');
    try {
      const res = await fetchWithAuth('/monitors', {
        method: 'POST',
        body: JSON.stringify(newMonitor),
      });
      if (!res.ok) {
        const d = await res.json();
        setActionError(d.message || 'Create failed');
        return;
      }
      setShowCreate(false);
      setNewMonitor({ name: '', url: '', interval: 60 });
      await loadMonitors();
    } catch {
      setActionError('Network error');
    } finally {
      setCreating(false);
    }
  };

  const handleAction = async (id, action) => {
    setActionError('');
    try {
      let res;
      if (action === 'delete') {
        res = await fetchWithAuth(`/monitors/${id}`, { method: 'DELETE' });
      } else if (action === 'check') {
        res = await fetchWithAuth(`/monitors/${id}/check`, { method: 'POST' });
      } else if (action === 'pause') {
        res = await fetchWithAuth(`/monitors/${id}/pause`, { method: 'POST' });
      } else if (action === 'resume') {
        res = await fetchWithAuth(`/monitors/${id}/resume`, { method: 'POST' });
      }
      if (res && !res.ok) {
        const d = await res.json().catch(() => ({}));
        setActionError(d.message || `Action ${action} failed`);
      }
      await loadMonitors();
    } catch {
      setActionError('Network error');
    }
  };

  const inputStyle = {
    padding: '8px 10px',
    backgroundColor: '#0a0a0f',
    border: '1px solid #27272a',
    borderRadius: '6px',
    color: '#e4e4e7',
    fontSize: '13px',
    outline: 'none',
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 600, color: '#e4e4e7' }}>Monitors</h1>
        <button
          onClick={() => setShowCreate(!showCreate)}
          style={{
            padding: '8px 16px',
            backgroundColor: showCreate ? '#27272a' : '#6366f1',
            border: 'none',
            borderRadius: '6px',
            color: '#fff',
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          {showCreate ? 'Cancel' : '+ New Monitor'}
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <StatCard label="Total" value={stats.total} />
        <StatCard label="Up" value={stats.up} color="#22c55e" />
        <StatCard label="Down" value={stats.down} color="#ef4444" />
        <StatCard label="Active Incidents" value={stats.incidents} color="#eab308" />
      </div>

      {/* Create form */}
      {showCreate && (
        <div
          style={{
            backgroundColor: '#18181b',
            border: '1px solid #27272a',
            borderRadius: '8px',
            padding: '20px',
            marginBottom: '20px',
          }}
        >
          <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#e4e4e7', marginBottom: '16px' }}>
            New Monitor
          </h3>
          <form onSubmit={handleCreate} style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#a1a1aa', marginBottom: '4px' }}>Name</label>
              <input
                value={newMonitor.name}
                onChange={(e) => setNewMonitor((p) => ({ ...p, name: e.target.value }))}
                required
                placeholder="My Service"
                style={{ ...inputStyle, width: '160px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#a1a1aa', marginBottom: '4px' }}>URL</label>
              <input
                value={newMonitor.url}
                onChange={(e) => setNewMonitor((p) => ({ ...p, url: e.target.value }))}
                required
                placeholder="https://example.com"
                style={{ ...inputStyle, width: '240px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#a1a1aa', marginBottom: '4px' }}>Interval (s)</label>
              <input
                type="number"
                value={newMonitor.interval}
                onChange={(e) => setNewMonitor((p) => ({ ...p, interval: Number(e.target.value) }))}
                min={10}
                style={{ ...inputStyle, width: '100px' }}
              />
            </div>
            <button
              type="submit"
              disabled={creating}
              style={{
                padding: '8px 16px',
                backgroundColor: '#6366f1',
                border: 'none',
                borderRadius: '6px',
                color: '#fff',
                fontSize: '13px',
                cursor: creating ? 'not-allowed' : 'pointer',
                opacity: creating ? 0.7 : 1,
              }}
            >
              {creating ? 'Creating...' : 'Create'}
            </button>
          </form>
          {actionError && (
            <div style={{ marginTop: '10px', fontSize: '13px', color: '#ef4444' }}>{actionError}</div>
          )}
        </div>
      )}

      {error && (
        <div style={{ padding: '12px', backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', color: '#ef4444', fontSize: '13px', marginBottom: '16px' }}>
          {error}
        </div>
      )}

      {/* Monitor list */}
      {loading ? (
        <div style={{ color: '#a1a1aa', fontSize: '14px' }}>Loading monitors...</div>
      ) : monitors.length === 0 ? (
        <div
          style={{
            backgroundColor: '#18181b',
            border: '1px solid #27272a',
            borderRadius: '8px',
            padding: '40px',
            textAlign: 'center',
            color: '#a1a1aa',
            fontSize: '14px',
          }}
        >
          No monitors yet. Create one to get started.
        </div>
      ) : (
        <div
          style={{
            backgroundColor: '#18181b',
            border: '1px solid #27272a',
            borderRadius: '8px',
            overflow: 'hidden',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #27272a' }}>
                {['Status', 'Name', 'URL', 'Uptime', 'Resp (ms)', 'Actions'].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: '12px 16px',
                      textAlign: 'left',
                      fontSize: '12px',
                      fontWeight: 500,
                      color: '#a1a1aa',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {monitors.map((m, i) => (
                <tr
                  key={m.id || m._id}
                  style={{
                    borderBottom: i < monitors.length - 1 ? '1px solid #27272a' : 'none',
                  }}
                >
                  <td style={{ padding: '12px 16px' }}>
                    <StatusDot up={m.status === 'up'} />
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <Link
                      to={`/dashboard/monitor/${m.id || m._id}`}
                      style={{ color: '#e4e4e7', fontWeight: 500 }}
                    >
                      {m.name}
                    </Link>
                    {m.paused && (
                      <span style={{ marginLeft: '8px', fontSize: '11px', color: '#eab308', backgroundColor: 'rgba(234,179,8,0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                        PAUSED
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#a1a1aa', fontSize: '13px', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {m.url}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#e4e4e7', fontSize: '13px' }}>
                    {m.uptime != null ? `${Number(m.uptime).toFixed(1)}%` : '—'}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#e4e4e7', fontSize: '13px' }}>
                    {m.responseTime != null ? m.responseTime : (m.response_time != null ? m.response_time : '—')}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <ActionBtn onClick={() => handleAction(m.id || m._id, 'check')}>Check</ActionBtn>
                      {m.paused
                        ? <ActionBtn onClick={() => handleAction(m.id || m._id, 'resume')}>Resume</ActionBtn>
                        : <ActionBtn onClick={() => handleAction(m.id || m._id, 'pause')}>Pause</ActionBtn>
                      }
                      <ActionBtn danger onClick={() => handleAction(m.id || m._id, 'delete')}>Delete</ActionBtn>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ActionBtn({ children, onClick, danger }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '4px 10px',
        backgroundColor: 'transparent',
        border: `1px solid ${danger ? '#ef4444' : '#27272a'}`,
        borderRadius: '6px',
        color: danger ? '#ef4444' : '#a1a1aa',
        fontSize: '12px',
        cursor: 'pointer',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = danger ? 'rgba(239,68,68,0.1)' : 'rgba(99,102,241,0.1)';
        if (!danger) e.currentTarget.style.borderColor = '#6366f1';
        if (!danger) e.currentTarget.style.color = '#6366f1';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'transparent';
        e.currentTarget.style.borderColor = danger ? '#ef4444' : '#27272a';
        e.currentTarget.style.color = danger ? '#ef4444' : '#a1a1aa';
      }}
    >
      {children}
    </button>
  );
}
