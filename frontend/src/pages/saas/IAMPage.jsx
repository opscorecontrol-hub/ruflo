import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';

export default function IAMPage() {
  const { fetchWithAuth, user } = useAuth();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const isOp = user?.saas_role === 'operator';
  const tenantId = user?.tenant_id;

  const load = () => {
    const url = isOp && tenantId ? `/saas/iam/members?tenant_id=${tenantId}` : '/saas/iam/members';
    fetchWithAuth(url)
      .then(r => r.json())
      .then(d => Array.isArray(d) && setMembers(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, [fetchWithAuth]);

  const invite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setError('');
    setSuccess('');
    try {
      const body = { email: inviteEmail.trim().toLowerCase(), role: inviteRole };
      if (isOp && tenantId) body.tenant_id = tenantId;
      const res = await fetchWithAuth('/saas/iam/members', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to invite'); return; }
      setSuccess(`${inviteEmail} added as ${inviteRole}`);
      setInviteEmail('');
      load();
    } catch {
      setError('Network error');
    } finally {
      setInviting(false);
    }
  };

  const changeRole = async (memberId, role) => {
    const res = await fetchWithAuth(`/saas/iam/members/${memberId}`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    });
    if (res.ok) load();
  };

  const remove = async (memberId, email) => {
    if (!confirm(`Remove ${email} from the tenant?`)) return;
    const res = await fetchWithAuth(`/saas/iam/members/${memberId}`, { method: 'DELETE' });
    if (res.ok || res.status === 204) load();
  };

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
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#e4e4e7', margin: 0 }}>Identity & Access Management</h1>
        <p style={{ color: '#71717a', fontSize: '13px', margin: '6px 0 0' }}>
          Manage who has access to your tenant and their roles.
        </p>
      </div>

      {/* Invite form */}
      <div style={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '10px', padding: '20px' }}>
        <h2 style={{ fontSize: '14px', fontWeight: 600, color: '#e4e4e7', margin: '0 0 16px' }}>Add Member</h2>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <input
            type="email"
            placeholder="user@example.com"
            value={inviteEmail}
            onChange={e => setInviteEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && invite()}
            style={{ ...inputStyle, flex: '1 1 200px' }}
          />
          <select value={inviteRole} onChange={e => setInviteRole(e.target.value)} style={{ ...inputStyle, minWidth: '120px' }}>
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
          <button onClick={invite} disabled={inviting || !inviteEmail.trim()} style={{
            padding: '8px 20px',
            backgroundColor: inviting ? '#4f52d4' : '#6366f1',
            border: 'none',
            borderRadius: '6px',
            color: '#fff',
            fontSize: '13px',
            fontWeight: 600,
            cursor: inviting ? 'not-allowed' : 'pointer',
            opacity: inviting ? 0.7 : 1,
          }}>
            {inviting ? 'Adding…' : 'Add'}
          </button>
        </div>
        {error && <div style={{ marginTop: '10px', color: '#ef4444', fontSize: '13px' }}>{error}</div>}
        {success && <div style={{ marginTop: '10px', color: '#22c55e', fontSize: '13px' }}>{success}</div>}
        <p style={{ color: '#71717a', fontSize: '12px', margin: '10px 0 0' }}>
          The user must already have an account. Share the registration link if they haven't signed up.
        </p>
      </div>

      {/* Members table */}
      <div style={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '10px', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #27272a', display: 'flex', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: '14px', fontWeight: 600, color: '#e4e4e7', margin: 0 }}>
            Members ({members.length})
          </h2>
        </div>
        {loading ? (
          <div style={{ padding: '24px', color: '#71717a', textAlign: 'center' }}>Loading…</div>
        ) : !members.length ? (
          <div style={{ padding: '24px', color: '#71717a', textAlign: 'center' }}>No members yet.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#111', fontSize: '11px', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {['User', 'Email', 'Role', 'Joined', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '10px 20px', textAlign: 'left', fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {members.map((m, i) => (
                <tr key={m.id} style={{ borderTop: '1px solid #27272a', fontSize: '13px' }}>
                  <td style={{ padding: '12px 20px', color: '#e4e4e7', fontWeight: 500 }}>
                    {m.name || '—'}
                  </td>
                  <td style={{ padding: '12px 20px', color: '#a1a1aa' }}>{m.email}</td>
                  <td style={{ padding: '12px 20px' }}>
                    <select
                      value={m.role}
                      onChange={e => changeRole(m.id, e.target.value)}
                      style={{
                        ...inputStyle,
                        padding: '4px 8px',
                        fontSize: '12px',
                        color: m.role === 'admin' ? '#6366f1' : '#a1a1aa',
                      }}
                    >
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td style={{ padding: '12px 20px', color: '#71717a', fontSize: '12px' }}>
                    {m.created_at ? new Date(m.created_at).toLocaleDateString() : '—'}
                  </td>
                  <td style={{ padding: '12px 20px' }}>
                    <button onClick={() => remove(m.id, m.email)} style={{
                      padding: '4px 12px',
                      backgroundColor: 'transparent',
                      border: '1px solid #ef444444',
                      borderRadius: '4px',
                      color: '#ef4444',
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
