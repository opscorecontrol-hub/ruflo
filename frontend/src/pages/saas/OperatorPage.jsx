import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';

export default function OperatorPage() {
  const { fetchWithAuth, user } = useAuth();
  const [tenants, setTenants] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // 'create-tenant' | null
  const [form, setForm] = useState({ name: '', domain: '', plan_id: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    Promise.all([
      fetchWithAuth('/saas/tenants').then(r => r.json()),
      fetch('/api/saas/plans').then(r => r.json()),
    ])
      .then(([t, p]) => {
        setTenants(Array.isArray(t) ? t : []);
        setPlans(Array.isArray(p) ? p : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, [fetchWithAuth]);

  if (user?.saas_role !== 'operator') {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#ef4444' }}>
        Operator access required.
      </div>
    );
  }

  const createTenant = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetchWithAuth('/saas/tenants', {
        method: 'POST',
        body: JSON.stringify({ name: form.name.trim(), domain: form.domain.trim() || undefined, plan_id: form.plan_id || undefined }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed'); return; }
      setModal(null);
      setForm({ name: '', domain: '', plan_id: '' });
      load();
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  };

  const changePlan = async (tenantId, plan_id) => {
    await fetchWithAuth(`/saas/tenants/${tenantId}`, {
      method: 'PUT',
      body: JSON.stringify({ plan_id }),
    });
    load();
  };

  const suspendTenant = async (tenantId, name) => {
    if (!confirm(`Suspend tenant "${name}"?`)) return;
    const res = await fetchWithAuth(`/saas/tenants/${tenantId}`, { method: 'DELETE' });
    if (res.ok || res.status === 204) load();
  };

  const inputStyle = {
    width: '100%',
    padding: '8px 12px',
    backgroundColor: '#0a0a0f',
    border: '1px solid #27272a',
    borderRadius: '6px',
    color: '#e4e4e7',
    fontSize: '13px',
    outline: 'none',
    boxSizing: 'border-box',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#e4e4e7', margin: 0 }}>Operator Panel</h1>
          <p style={{ color: '#71717a', fontSize: '13px', margin: '6px 0 0' }}>
            Manage tenants, plans, and the service catalog.
          </p>
        </div>
        <button onClick={() => setModal('create-tenant')} style={{
          padding: '9px 18px',
          backgroundColor: '#6366f1',
          border: 'none',
          borderRadius: '6px',
          color: '#fff',
          fontSize: '13px',
          fontWeight: 600,
          cursor: 'pointer',
        }}>
          + New Tenant
        </button>
      </div>

      {/* Plans overview */}
      <div>
        <h2 style={{ fontSize: '13px', fontWeight: 600, color: '#a1a1aa', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Available Plans
        </h2>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {plans.map(plan => (
            <div key={plan.id} style={{
              backgroundColor: '#18181b',
              border: '1px solid #27272a',
              borderRadius: '8px',
              padding: '12px 16px',
              minWidth: '160px',
            }}>
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#e4e4e7' }}>{plan.name}</div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: '#6366f1', margin: '4px 0' }}>
                ${plan.price_monthly}/mo
              </div>
              <div style={{ fontSize: '11px', color: '#71717a' }}>
                {plan.services?.length || 0} services · {tenants.filter(t => t.plan?.id === plan.id).length} tenants
              </div>
            </div>
          ))}
          <Link to="/marketplace" style={{
            backgroundColor: '#0a0a0f',
            border: '1px dashed #27272a',
            borderRadius: '8px',
            padding: '12px 16px',
            minWidth: '160px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#71717a',
            textDecoration: 'none',
            fontSize: '13px',
          }}>
            View Marketplace →
          </Link>
        </div>
      </div>

      {/* Tenants table */}
      <div style={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '10px', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #27272a' }}>
          <h2 style={{ fontSize: '14px', fontWeight: 600, color: '#e4e4e7', margin: 0 }}>
            Tenants ({tenants.length})
          </h2>
        </div>
        {loading ? (
          <div style={{ padding: '24px', color: '#71717a', textAlign: 'center' }}>Loading…</div>
        ) : !tenants.length ? (
          <div style={{ padding: '32px', color: '#71717a', textAlign: 'center' }}>
            No tenants yet. <button onClick={() => setModal('create-tenant')} style={{ color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px' }}>Create one.</button>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#111', fontSize: '11px', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {['Tenant', 'Domain', 'Plan', 'Members', 'Status', 'Created', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '10px 20px', textAlign: 'left', fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tenants.map(t => (
                <tr key={t.id} style={{ borderTop: '1px solid #27272a' }}>
                  <td style={{ padding: '12px 20px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#e4e4e7' }}>{t.name}</div>
                    <div style={{ fontSize: '11px', color: '#71717a' }}>{t.slug}</div>
                  </td>
                  <td style={{ padding: '12px 20px', fontSize: '13px', color: '#a1a1aa' }}>{t.domain || '—'}</td>
                  <td style={{ padding: '12px 20px' }}>
                    <select
                      value={t.plan?.id || t.plan_id || ''}
                      onChange={e => changePlan(t.id, e.target.value || null)}
                      style={{
                        padding: '4px 8px',
                        backgroundColor: '#0a0a0f',
                        border: '1px solid #27272a',
                        borderRadius: '4px',
                        color: '#e4e4e7',
                        fontSize: '12px',
                        outline: 'none',
                      }}
                    >
                      <option value="">— No plan —</option>
                      {plans.map(p => <option key={p.id} value={p.id}>{p.name} (${p.price_monthly}/mo)</option>)}
                    </select>
                  </td>
                  <td style={{ padding: '12px 20px', fontSize: '13px', color: '#a1a1aa' }}>{t.member_count || 0}</td>
                  <td style={{ padding: '12px 20px' }}>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '10px',
                      fontSize: '11px',
                      fontWeight: 600,
                      backgroundColor: t.status === 'active' ? '#22c55e22' : '#ef444422',
                      color: t.status === 'active' ? '#22c55e' : '#ef4444',
                    }}>
                      {t.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px 20px', fontSize: '12px', color: '#71717a' }}>
                    {t.created_at ? new Date(t.created_at).toLocaleDateString() : '—'}
                  </td>
                  <td style={{ padding: '12px 20px' }}>
                    <button onClick={() => suspendTenant(t.id, t.name)} style={{
                      padding: '4px 12px',
                      backgroundColor: 'transparent',
                      border: '1px solid #ef444444',
                      borderRadius: '4px',
                      color: '#ef4444',
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}>
                      Suspend
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create tenant modal */}
      {modal === 'create-tenant' && (
        <div style={{
          position: 'fixed', inset: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            backgroundColor: '#18181b',
            border: '1px solid #27272a',
            borderRadius: '12px',
            padding: '28px',
            width: '440px',
            maxWidth: '90vw',
          }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#e4e4e7', margin: '0 0 20px' }}>Create Tenant</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 500, color: '#a1a1aa', display: 'block', marginBottom: '6px' }}>Company Name *</label>
                <input placeholder="Acme Corp" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 500, color: '#a1a1aa', display: 'block', marginBottom: '6px' }}>Domain</label>
                <input placeholder="acme.com" value={form.domain} onChange={e => setForm(f => ({ ...f, domain: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 500, color: '#a1a1aa', display: 'block', marginBottom: '6px' }}>Plan</label>
                <select value={form.plan_id} onChange={e => setForm(f => ({ ...f, plan_id: e.target.value }))} style={inputStyle}>
                  <option value="">— No plan yet —</option>
                  {plans.map(p => <option key={p.id} value={p.id}>{p.name} — ${p.price_monthly}/mo</option>)}
                </select>
              </div>
              {error && <div style={{ color: '#ef4444', fontSize: '13px' }}>{error}</div>}
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '24px', justifyContent: 'flex-end' }}>
              <button onClick={() => { setModal(null); setError(''); }} style={{
                padding: '9px 18px', backgroundColor: 'transparent', border: '1px solid #27272a',
                borderRadius: '6px', color: '#a1a1aa', fontSize: '13px', cursor: 'pointer',
              }}>
                Cancel
              </button>
              <button onClick={createTenant} disabled={saving || !form.name.trim()} style={{
                padding: '9px 18px', backgroundColor: '#6366f1', border: 'none',
                borderRadius: '6px', color: '#fff', fontSize: '13px', fontWeight: 600,
                cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1,
              }}>
                {saving ? 'Creating…' : 'Create Tenant'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
