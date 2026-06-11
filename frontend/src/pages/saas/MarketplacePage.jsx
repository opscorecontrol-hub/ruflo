import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';

const TIER_COLOR = { Starter: '#6366f1', Pro: '#22c55e', Enterprise: '#f59e0b' };

export default function MarketplacePage() {
  const { fetchWithAuth, user } = useAuth();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/saas/plans')
      .then(r => r.json())
      .then(setPlans)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const card = {
    backgroundColor: '#18181b',
    border: '1px solid #27272a',
    borderRadius: '12px',
    padding: '28px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  };

  if (loading) return (
    <div style={{ color: '#a1a1aa', padding: '40px', textAlign: 'center' }}>Loading plans…</div>
  );

  return (
    <div>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#e4e4e7', margin: 0 }}>
          Service Marketplace
        </h1>
        <p style={{ color: '#a1a1aa', margin: '8px 0 0', fontSize: '14px' }}>
          Choose a plan to get access to the services your team needs.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
        {plans.map(plan => {
          const color = TIER_COLOR[plan.name] || '#6366f1';
          return (
            <div key={plan.id} style={{
              ...card,
              borderColor: color + '44',
              boxShadow: `0 0 0 1px ${color}22`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{
                    display: 'inline-block',
                    padding: '2px 10px',
                    backgroundColor: color + '22',
                    border: `1px solid ${color}55`,
                    borderRadius: '20px',
                    fontSize: '11px',
                    fontWeight: 600,
                    color,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    marginBottom: '8px',
                  }}>
                    {plan.name}
                  </div>
                  <div style={{ fontSize: '28px', fontWeight: 700, color: '#e4e4e7' }}>
                    ${plan.price_monthly}
                    <span style={{ fontSize: '14px', fontWeight: 400, color: '#71717a' }}>/mo</span>
                  </div>
                </div>
              </div>

              <p style={{ color: '#a1a1aa', fontSize: '13px', margin: 0 }}>{plan.description}</p>

              <div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
                  Included Services
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {(plan.services || []).map(svc => (
                    <div key={svc.id} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '18px' }}>{svc.icon}</span>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 500, color: '#e4e4e7' }}>
                          {svc.display_name}
                          {svc.quantity > 1 && (
                            <span style={{ marginLeft: '6px', color: color, fontSize: '11px' }}>×{svc.quantity}</span>
                          )}
                        </div>
                        <div style={{ fontSize: '11px', color: '#71717a' }}>{svc.description}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {user?.saas_role === 'operator' && (
                <Link to="/saas/operator" style={{
                  display: 'block',
                  textAlign: 'center',
                  padding: '10px',
                  backgroundColor: color,
                  borderRadius: '6px',
                  color: '#fff',
                  fontSize: '14px',
                  fontWeight: 600,
                  textDecoration: 'none',
                  marginTop: 'auto',
                }}>
                  Assign to Tenant
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
