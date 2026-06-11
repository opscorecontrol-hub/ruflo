import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';

function StatusBadge({ status }) {
  const map = {
    active: { bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.3)', text: '#22c55e' },
    inactive: { bg: 'rgba(161,161,170,0.1)', border: 'rgba(161,161,170,0.3)', text: '#a1a1aa' },
    error: { bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.3)', text: '#ef4444' },
    scaling: { bg: 'rgba(234,179,8,0.1)', border: 'rgba(234,179,8,0.3)', text: '#eab308' },
  };
  const c = map[status] || map.inactive;
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
      {status || 'inactive'}
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

export default function SwarmPage() {
  const { fetchWithAuth } = useAuth();
  const { subscribe } = useSocket();
  const [swarms, setSwarms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newSwarm, setNewSwarm] = useState({ name: '', target_agent_count: 2 });
  const [actionError, setActionError] = useState('');

  const loadSwarms = useCallback(async () => {
    try {
      const res = await fetchWithAuth('/swarm');
      if (!res.ok) { setError('Failed to load swarms'); return; }
      const data = await res.json();
      setSwarms(Array.isArray(data) ? data : (data.swarms || []));
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth]);

  useEffect(() => { loadSwarms(); }, [loadSwarms]);

  // Live updates
  useEffect(() => {
    const unsub = subscribe('swarm:scaled', () => { loadSwarms(); });
    return unsub;
  }, [subscribe, loadSwarms]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    setActionError('');
    try {
      const res = await fetchWithAuth('/swarm', {
        method: 'POST',
        body: JSON.stringify(newSwarm),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setActionError(d.message || 'Create failed');
        return;
      }
      setShowCreate(false);
      setNewSwarm({ name: '', target_agent_count: 2 });
      await loadSwarms();
    } catch {
      setActionError('Network error');
    } finally {
      setCreating(false);
    }
  };

  const handleAction = async (id, action) => {
    setActionError('');
    try {
      let method = 'POST';
      let endpoint = `/swarm/${id}/${action}`;
      if (action === 'delete') {
        method = 'DELETE';
        endpoint = `/swarm/${id}`;
      }
      const res = await fetchWithAuth(endpoint, {
        method,
        body: method === 'POST' ? '{}' : undefined,
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setActionError(d.message || `Action failed`);
      }
      await loadSwarms();
    } catch {
      setActionError('Network error');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 600, color: '#e4e4e7' }}>Swarms</h1>
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
          {showCreate ? 'Cancel' : '+ New Swarm'}
        </button>
      </div>

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
          <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#e4e4e7', marginBottom: '16px' }}>New Swarm</h3>
          <form onSubmit={handleCreate} style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#a1a1aa', marginBottom: '4px' }}>Name</label>
              <input
                value={newSwarm.name}
                onChange={(e) => setNewSwarm((p) => ({ ...p, name: e.target.value }))}
                required
                placeholder="worker-swarm-1"
                style={{ ...inputStyle, width: '200px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#a1a1aa', marginBottom: '4px' }}>Target Agents</label>
              <input
                type="number"
                value={newSwarm.target_agent_count}
                onChange={(e) => setNewSwarm((p) => ({ ...p, target_agent_count: Number(e.target.value) }))}
                min={1}
                max={50}
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
          {actionError && <div style={{ marginTop: '10px', fontSize: '13px', color: '#ef4444' }}>{actionError}</div>}
        </div>
      )}

      {error && (
        <div style={{ padding: '12px', backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', color: '#ef4444', fontSize: '13px', marginBottom: '16px' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ color: '#a1a1aa' }}>Loading swarms...</div>
      ) : swarms.length === 0 ? (
        <div style={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px', padding: '40px', textAlign: 'center', color: '#a1a1aa', fontSize: '14px' }}>
          No swarms yet.
        </div>
      ) : (
        <div style={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #27272a' }}>
                {['Name', 'Status', 'Agents', 'VMs', 'Created', 'Actions'].map((h) => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 500, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {swarms.map((s, i) => (
                <tr key={s.id || s._id} style={{ borderBottom: i < swarms.length - 1 ? '1px solid #27272a' : 'none' }}>
                  <td style={{ padding: '12px 16px', color: '#e4e4e7', fontWeight: 500 }}>{s.name}</td>
                  <td style={{ padding: '12px 16px' }}><StatusBadge status={s.status} /></td>
                  <td style={{ padding: '12px 16px', color: '#e4e4e7', fontSize: '13px' }}>
                    {s.agent_count ?? s.agentCount ?? '—'} / {s.target_agent_count ?? s.targetAgentCount ?? '—'}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#e4e4e7', fontSize: '13px' }}>{s.vm_count ?? s.vmCount ?? '—'}</td>
                  <td style={{ padding: '12px 16px', color: '#a1a1aa', fontSize: '13px' }}>
                    {s.createdAt || s.created_at ? new Date(s.createdAt || s.created_at).toLocaleDateString() : '—'}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {s.status !== 'active' && (
                        <SmallBtn onClick={() => handleAction(s.id || s._id, 'activate')}>Activate</SmallBtn>
                      )}
                      {s.status === 'active' && (
                        <SmallBtn onClick={() => handleAction(s.id || s._id, 'deactivate')}>Deactivate</SmallBtn>
                      )}
                      <SmallBtn danger onClick={() => handleAction(s.id || s._id, 'delete')}>Delete</SmallBtn>
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

function SmallBtn({ children, onClick, danger }) {
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
        if (!danger) { e.currentTarget.style.borderColor = '#6366f1'; e.currentTarget.style.color = '#6366f1'; }
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
