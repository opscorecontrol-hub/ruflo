import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';

function StatusBadge({ status }) {
  const map = {
    running: { bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.3)', text: '#22c55e' },
    provisioning: { bg: 'rgba(234,179,8,0.1)', border: 'rgba(234,179,8,0.3)', text: '#eab308' },
    stopped: { bg: 'rgba(161,161,170,0.1)', border: 'rgba(161,161,170,0.3)', text: '#a1a1aa' },
    error: { bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.3)', text: '#ef4444' },
    destroying: { bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.3)', text: '#ef4444' },
  };
  const c = map[status] || map.stopped;
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
      {status || 'unknown'}
    </span>
  );
}

function ProviderBadge({ provider }) {
  const colors = {
    hetzner: { bg: 'rgba(99,102,241,0.1)', border: 'rgba(99,102,241,0.3)', text: '#6366f1' },
    local: { bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.3)', text: '#22c55e' },
  };
  const c = colors[provider] || colors.local;
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
      {provider || 'unknown'}
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

export default function VMsPage() {
  const { fetchWithAuth } = useAuth();
  const { subscribe } = useSocket();
  const [vms, setVms] = useState([]);
  const [swarms, setSwarms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newVm, setNewVm] = useState({ swarm_id: '', provider: 'local', instance_type: 'cx11' });
  const [actionError, setActionError] = useState('');

  const load = useCallback(async () => {
    try {
      const [vRes, sRes] = await Promise.all([
        fetchWithAuth('/vms'),
        fetchWithAuth('/swarm'),
      ]);
      if (vRes.ok) {
        const d = await vRes.json();
        setVms(Array.isArray(d) ? d : (d.vms || []));
      } else {
        setError('Failed to load VMs');
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
    const unsub = subscribe('vm:status', () => { load(); });
    return unsub;
  }, [subscribe, load]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    setActionError('');
    try {
      const res = await fetchWithAuth('/vms', {
        method: 'POST',
        body: JSON.stringify(newVm),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setActionError(d.message || 'Create failed');
        return;
      }
      setShowCreate(false);
      setNewVm({ swarm_id: '', provider: 'local', instance_type: 'cx11' });
      await load();
    } catch {
      setActionError('Network error');
    } finally {
      setCreating(false);
    }
  };

  const handleDestroy = async (id) => {
    setActionError('');
    try {
      const res = await fetchWithAuth(`/vms/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setActionError(d.message || 'Destroy failed');
      }
      await load();
    } catch {
      setActionError('Network error');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 600, color: '#e4e4e7' }}>Virtual Machines</h1>
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
          {showCreate ? 'Cancel' : '+ Provision VM'}
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
          <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#e4e4e7', marginBottom: '16px' }}>Provision VM</h3>
          <form onSubmit={handleCreate} style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#a1a1aa', marginBottom: '4px' }}>Swarm</label>
              <select
                value={newVm.swarm_id}
                onChange={(e) => setNewVm((p) => ({ ...p, swarm_id: e.target.value }))}
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
              <label style={{ display: 'block', fontSize: '12px', color: '#a1a1aa', marginBottom: '4px' }}>Provider</label>
              <select
                value={newVm.provider}
                onChange={(e) => setNewVm((p) => ({ ...p, provider: e.target.value }))}
                style={{ ...inputStyle, width: '140px' }}
              >
                <option value="local">local</option>
                <option value="hetzner">hetzner</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#a1a1aa', marginBottom: '4px' }}>Instance Type</label>
              <input
                value={newVm.instance_type}
                onChange={(e) => setNewVm((p) => ({ ...p, instance_type: e.target.value }))}
                placeholder="cx11"
                style={{ ...inputStyle, width: '120px' }}
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
              {creating ? 'Provisioning...' : 'Provision'}
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
        <div style={{ color: '#a1a1aa' }}>Loading VMs...</div>
      ) : vms.length === 0 ? (
        <div style={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px', padding: '40px', textAlign: 'center', color: '#a1a1aa', fontSize: '14px' }}>
          No VMs provisioned.
        </div>
      ) : (
        <div style={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #27272a' }}>
                {['ID', 'Swarm', 'Provider', 'IP', 'Instance', 'Status', 'Actions'].map((h) => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 500, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vms.map((v, i) => {
                const vmId = v.id || v._id;
                const swarm = swarms.find((s) => (s.id || s._id) === (v.swarm_id || v.swarmId));
                return (
                  <tr key={vmId || i} style={{ borderBottom: i < vms.length - 1 ? '1px solid #27272a' : 'none' }}>
                    <td style={{ padding: '12px 16px', color: '#a1a1aa', fontSize: '12px', fontFamily: 'monospace' }}>
                      {String(vmId || '').slice(0, 10)}...
                    </td>
                    <td style={{ padding: '12px 16px', color: '#e4e4e7', fontSize: '13px' }}>
                      {swarm ? swarm.name : (v.swarm_id || v.swarmId || '—')}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <ProviderBadge provider={v.provider} />
                    </td>
                    <td style={{ padding: '12px 16px', color: '#e4e4e7', fontSize: '13px', fontFamily: 'monospace' }}>
                      {v.ip || v.ip_address || '—'}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#a1a1aa', fontSize: '13px' }}>
                      {v.instance_type || v.instanceType || '—'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <StatusBadge status={v.status} />
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <button
                        onClick={() => handleDestroy(vmId)}
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
                        Destroy
                      </button>
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
