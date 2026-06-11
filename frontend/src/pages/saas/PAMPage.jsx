import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';

export default function PAMPage() {
  const { fetchWithAuth, user } = useAuth();
  const [roles, setRoles] = useState([]);
  const [services, setServices] = useState([]);
  const [auditLog, setAuditLog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDesc, setNewRoleDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const [activeRoleId, setActiveRoleId] = useState(null);
  const [error, setError] = useState('');

  const isOp = user?.saas_role === 'operator';
  const tenantId = user?.tenant_id;

  const load = () => {
    const q = isOp && tenantId ? `?tenant_id=${tenantId}` : '';
    Promise.all([
      fetchWithAuth(`/saas/pam/roles${q}`).then(r => r.json()),
      fetch('/api/saas/services').then(r => r.json()),
      fetchWithAuth(`/saas/audit-log${q}`).then(r => r.json()),
    ])
      .then(([rolesData, svcsData, logData]) => {
        setRoles(Array.isArray(rolesData) ? rolesData : []);
        setServices(Array.isArray(svcsData) ? svcsData : []);
        setAuditLog(Array.isArray(logData) ? logData.slice(0, 20) : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, [fetchWithAuth]);

  const createRole = async () => {
    if (!newRoleName.trim()) return;
    setCreating(true);
    setError('');
    try {
      const body = { name: newRoleName.trim(), description: newRoleDesc.trim() };
      if (isOp && tenantId) body.tenant_id = tenantId;
      const res = await fetchWithAuth('/saas/pam/roles', { method: 'POST', body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed'); return; }
      setNewRoleName('');
      setNewRoleDesc('');
      load();
    } catch {
      setError('Network error');
    } finally {
      setCreating(false);
    }
  };

  const deleteRole = async (roleId, roleName) => {
    if (!confirm(`Delete role "${roleName}"?`)) return;
    const res = await fetchWithAuth(`/saas/pam/roles/${roleId}`, { method: 'DELETE' });
    if (res.ok || res.status === 204) {
      if (activeRoleId === roleId) setActiveRoleId(null);
      load();
    }
  };

  const updatePermissions = async (roleId, newPerms) => {
    const res = await fetchWithAuth(`/saas/pam/roles/${roleId}/permissions`, {
      method: 'PUT',
      body: JSON.stringify({ permissions: newPerms }),
    });
    if (res.ok) load();
  };

  const activeRole = roles.find(r => r.id === activeRoleId);

  const inputStyle = {
    padding: '8px 12px',
    backgroundColor: '#0a0a0f',
    border: '1px solid #27272a',
    borderRadius: '6px',
    color: '#e4e4e7',
    fontSize: '13px',
    outline: 'none',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#e4e4e7', margin: 0 }}>Privileged Access Management</h1>
        <p style={{ color: '#71717a', fontSize: '13px', margin: '6px 0 0' }}>
          Define roles and control which services each role can access.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '20px', alignItems: 'start' }}>
        {/* Roles list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '10px', overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #27272a' }}>
              <h2 style={{ fontSize: '13px', fontWeight: 600, color: '#a1a1aa', margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Roles</h2>
            </div>
            {loading ? (
              <div style={{ padding: '16px', color: '#71717a', textAlign: 'center', fontSize: '13px' }}>Loading…</div>
            ) : !roles.length ? (
              <div style={{ padding: '16px', color: '#71717a', fontSize: '13px', textAlign: 'center' }}>No roles yet.</div>
            ) : (
              roles.map(role => (
                <div
                  key={role.id}
                  onClick={() => setActiveRoleId(role.id === activeRoleId ? null : role.id)}
                  style={{
                    padding: '12px 16px',
                    borderTop: '1px solid #27272a',
                    cursor: 'pointer',
                    backgroundColor: activeRoleId === role.id ? '#6366f115' : 'transparent',
                    borderLeft: `2px solid ${activeRoleId === role.id ? '#6366f1' : 'transparent'}`,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: '#e4e4e7' }}>{role.name}</div>
                    {role.description && <div style={{ fontSize: '11px', color: '#71717a' }}>{role.description}</div>}
                    <div style={{ fontSize: '11px', color: '#71717a', marginTop: '2px' }}>
                      {role.permissions?.length || 0} permissions
                    </div>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); deleteRole(role.id, role.name); }}
                    style={{ background: 'none', border: 'none', color: '#ef444466', cursor: 'pointer', fontSize: '14px' }}
                  >
                    ✕
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Create role */}
          <div style={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '10px', padding: '14px' }}>
            <div style={{ fontSize: '13px', fontWeight: 500, color: '#e4e4e7', marginBottom: '10px' }}>New Role</div>
            <input placeholder="Role name" value={newRoleName} onChange={e => setNewRoleName(e.target.value)}
              style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', marginBottom: '8px' }} />
            <input placeholder="Description (optional)" value={newRoleDesc} onChange={e => setNewRoleDesc(e.target.value)}
              style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', marginBottom: '10px' }} />
            {error && <div style={{ color: '#ef4444', fontSize: '12px', marginBottom: '8px' }}>{error}</div>}
            <button onClick={createRole} disabled={creating || !newRoleName.trim()} style={{
              width: '100%',
              padding: '8px',
              backgroundColor: '#6366f1',
              border: 'none',
              borderRadius: '6px',
              color: '#fff',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              opacity: creating ? 0.7 : 1,
            }}>
              {creating ? 'Creating…' : 'Create Role'}
            </button>
          </div>
        </div>

        {/* Right: permission editor */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {activeRole ? (
            <div style={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '10px', overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid #27272a' }}>
                <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#e4e4e7', margin: 0 }}>
                  Permissions: <span style={{ color: '#6366f1' }}>{activeRole.name}</span>
                </h2>
                <p style={{ color: '#71717a', fontSize: '12px', margin: '4px 0 0' }}>
                  Toggle what this role can do for each service.
                </p>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#111', fontSize: '11px', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    <th style={{ padding: '10px 20px', textAlign: 'left', fontWeight: 600 }}>Service</th>
                    <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 600 }}>View</th>
                    <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 600 }}>Use</th>
                    <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 600 }}>Admin</th>
                  </tr>
                </thead>
                <tbody>
                  {services.map(svc => {
                    const perm = activeRole.permissions?.find(p => p.service_id === svc.id) || {};
                    const toggle = (field) => {
                      const newPerms = services.map(s => {
                        const p = activeRole.permissions?.find(x => x.service_id === s.id) || {};
                        if (s.id === svc.id) return { service_id: s.id, can_view: p.can_view || 0, can_use: p.can_use || 0, can_admin: p.can_admin || 0, [field]: p[field] ? 0 : 1 };
                        return { service_id: s.id, can_view: p.can_view || 0, can_use: p.can_use || 0, can_admin: p.can_admin || 0 };
                      }).filter(p => p.can_view || p.can_use || p.can_admin);
                      updatePermissions(activeRole.id, newPerms);
                    };
                    return (
                      <tr key={svc.id} style={{ borderTop: '1px solid #27272a' }}>
                        <td style={{ padding: '12px 20px' }}>
                          <span style={{ marginRight: '8px', fontSize: '16px' }}>{svc.icon}</span>
                          <span style={{ fontSize: '13px', color: '#e4e4e7' }}>{svc.display_name}</span>
                        </td>
                        {['can_view', 'can_use', 'can_admin'].map(f => (
                          <td key={f} style={{ padding: '12px 16px', textAlign: 'center' }}>
                            <input type="checkbox" checked={!!(perm[f])} onChange={() => toggle(f)}
                              style={{ cursor: 'pointer', accentColor: '#6366f1', width: '16px', height: '16px' }} />
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{
              backgroundColor: '#18181b',
              border: '1px solid #27272a',
              borderRadius: '10px',
              padding: '40px',
              textAlign: 'center',
              color: '#71717a',
              fontSize: '14px',
            }}>
              Select a role on the left to edit its permissions.
            </div>
          )}

          {/* Audit log */}
          <div style={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '10px', overflow: 'hidden' }}>
            <div style={{ padding: '12px 20px', borderBottom: '1px solid #27272a' }}>
              <h2 style={{ fontSize: '13px', fontWeight: 600, color: '#a1a1aa', margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Recent Audit Log
              </h2>
            </div>
            {!auditLog.length ? (
              <div style={{ padding: '16px', color: '#71717a', textAlign: 'center', fontSize: '13px' }}>No activity yet.</div>
            ) : auditLog.map(entry => (
              <div key={entry.id} style={{ padding: '10px 20px', borderTop: '1px solid #27272a', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <div style={{ fontSize: '11px', color: '#555', flexShrink: 0, marginTop: '2px' }}>
                  {new Date(entry.created_at).toLocaleString()}
                </div>
                <div>
                  <span style={{ fontSize: '12px', color: '#a1a1aa', fontWeight: 500 }}>{entry.action}</span>
                  {entry.email && <span style={{ fontSize: '11px', color: '#71717a', marginLeft: '8px' }}>by {entry.email}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
