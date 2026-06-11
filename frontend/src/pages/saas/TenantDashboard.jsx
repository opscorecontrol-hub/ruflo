import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';

const CAT_COLOR = { devtools: '#6366f1', security: '#ef4444', ai: '#22c55e', general: '#71717a' };

export default function TenantDashboard() {
  const { fetchWithAuth, user } = useAuth();
  const [data, setData] = useState(null);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      fetchWithAuth('/saas/my-tenant').then(r => r.json()),
      fetchWithAuth('/saas/my-services').then(r => r.json()),
    ])
      .then(([tenantData, svcData]) => {
        setData(tenantData);
        setServices(Array.isArray(svcData) ? svcData : []);
      })
      .catch(() => setError('Could not load tenant data'))
      .finally(() => setLoading(false));
  }, [fetchWithAuth]);

  if (loading) return <div style={{ color: '#a1a1aa', padding: '40px', textAlign: 'center' }}>Loading…</div>;
  if (error) return <div style={{ color: '#ef4444', padding: '40px', textAlign: 'center' }}>{error}</div>;

  const tenant = data?.tenant;
  const plan = data?.plan;
  const isTenantAdmin = user?.saas_role === 'tenant_admin';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#e4e4e7', margin: 0 }}>
            {tenant?.name || 'My Tenant'}
          </h1>
          <p style={{ color: '#71717a', fontSize: '13px', margin: '4px 0 0' }}>
            Plan: <span style={{ color: '#6366f1', fontWeight: 500 }}>{plan?.name || 'No plan'}</span>
            {tenant?.status && (
              <span style={{
                marginLeft: '12px',
                padding: '1px 8px',
                borderRadius: '10px',
                fontSize: '11px',
                backgroundColor: tenant.status === 'active' ? '#22c55e22' : '#ef444422',
                color: tenant.status === 'active' ? '#22c55e' : '#ef4444',
                border: `1px solid ${tenant.status === 'active' ? '#22c55e44' : '#ef444444'}`,
              }}>
                {tenant.status}
              </span>
            )}
          </p>
        </div>
        {isTenantAdmin && (
          <div style={{ display: 'flex', gap: '10px' }}>
            <Link to="/saas/iam" style={btnStyle('#6366f1')}>Manage Users</Link>
            <Link to="/saas/pam" style={btnStyle('#27272a', '#a1a1aa')}>Roles & Perms</Link>
          </div>
        )}
      </div>

      {/* Services grid */}
      <div>
        <h2 style={{ fontSize: '14px', fontWeight: 600, color: '#a1a1aa', margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Your Services ({services.length})
        </h2>
        {!services.length ? (
          <div style={{ color: '#71717a', fontSize: '14px', padding: '24px', backgroundColor: '#18181b', borderRadius: '8px', border: '1px solid #27272a', textAlign: 'center' }}>
            No services assigned to this tenant yet.{' '}
            {user?.saas_role === 'operator' && <Link to="/saas/operator" style={{ color: '#6366f1' }}>Assign a plan.</Link>}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px' }}>
            {services.map(svc => {
              const color = CAT_COLOR[svc.category] || '#71717a';
              return (
                <div key={svc.id} style={{
                  backgroundColor: '#18181b',
                  border: `1px solid ${color}44`,
                  borderRadius: '10px',
                  padding: '20px',
                }}>
                  <div style={{ fontSize: '28px', marginBottom: '10px' }}>{svc.icon}</div>
                  <div style={{ fontSize: '15px', fontWeight: 600, color: '#e4e4e7', marginBottom: '4px' }}>
                    {svc.display_name}
                    {svc.quantity > 1 && <span style={{ marginLeft: '6px', fontSize: '12px', color }}> ×{svc.quantity}</span>}
                  </div>
                  <div style={{ fontSize: '12px', color: '#71717a', marginBottom: '12px' }}>{svc.description}</div>
                  <div style={{
                    display: 'inline-block',
                    padding: '2px 8px',
                    backgroundColor: color + '22',
                    border: `1px solid ${color}44`,
                    borderRadius: '20px',
                    fontSize: '10px',
                    color,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                  }}>
                    {svc.category}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Engagements quicklink */}
      <div style={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ fontSize: '24px' }}>🔐</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '14px', fontWeight: 600, color: '#e4e4e7' }}>Ethical Hacker Engagements</div>
          <div style={{ fontSize: '12px', color: '#71717a', marginTop: '2px' }}>Commission penetration tests with structured GitHub deliverables</div>
        </div>
        <Link to="/saas/engagements" style={{ padding: '7px 16px', backgroundColor: '#6366f1', borderRadius: '6px', color: '#fff', fontSize: '13px', fontWeight: 500, textDecoration: 'none' }}>
          View Engagements →
        </Link>
      </div>

      {/* Members preview */}
      {isTenantAdmin && data?.members && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h2 style={{ fontSize: '14px', fontWeight: 600, color: '#a1a1aa', margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Members ({data.members.length})
            </h2>
            <Link to="/saas/iam" style={{ fontSize: '13px', color: '#6366f1', textDecoration: 'none' }}>Manage →</Link>
          </div>
          <div style={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px', overflow: 'hidden' }}>
            {data.members.map((m, i) => (
              <div key={m.id} style={{
                padding: '10px 16px',
                borderTop: i > 0 ? '1px solid #27272a' : 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#27272a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', color: '#a1a1aa', fontWeight: 600, flexShrink: 0 }}>
                  {(m.name || m.email || '?')[0].toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', color: '#e4e4e7', fontWeight: 500 }}>{m.name || m.email}</div>
                  {m.name && <div style={{ fontSize: '11px', color: '#71717a' }}>{m.email}</div>}
                </div>
                <span style={{
                  padding: '2px 8px',
                  borderRadius: '10px',
                  fontSize: '11px',
                  fontWeight: 600,
                  backgroundColor: m.role === 'admin' ? '#6366f122' : '#27272a',
                  color: m.role === 'admin' ? '#6366f1' : '#71717a',
                }}>
                  {m.role}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function btnStyle(bg, color = '#fff') {
  return {
    padding: '8px 16px',
    backgroundColor: bg,
    border: `1px solid ${bg}`,
    borderRadius: '6px',
    color,
    fontSize: '13px',
    fontWeight: 500,
    textDecoration: 'none',
    cursor: 'pointer',
  };
}
