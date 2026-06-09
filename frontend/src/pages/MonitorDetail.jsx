import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const RANGES = [
  { label: '24h', value: '24h' },
  { label: '3d', value: '3d' },
  { label: '7d', value: '7d' },
];

function StatusBadge({ status }) {
  const colors = {
    up: { bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.3)', text: '#22c55e' },
    down: { bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.3)', text: '#ef4444' },
    pending: { bg: 'rgba(161,161,170,0.1)', border: 'rgba(161,161,170,0.3)', text: '#a1a1aa' },
  };
  const c = colors[status] || colors.pending;
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 10px',
        backgroundColor: c.bg,
        border: `1px solid ${c.border}`,
        borderRadius: '20px',
        color: c.text,
        fontSize: '12px',
        fontWeight: 500,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
      }}
    >
      {status || 'unknown'}
    </span>
  );
}

function formatDate(ts) {
  if (!ts) return '—';
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
}

export default function MonitorDetail() {
  const { id } = useParams();
  const { fetchWithAuth } = useAuth();
  const [monitor, setMonitor] = useState(null);
  const [checks, setChecks] = useState([]);
  const [range, setRange] = useState('24h');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const [mRes, cRes] = await Promise.all([
        fetchWithAuth(`/monitors/${id}`),
        fetchWithAuth(`/monitors/${id}/checks?limit=50&range=${range}`),
      ]);
      if (!mRes.ok) { setError('Monitor not found'); return; }
      const mData = await mRes.json();
      setMonitor(mData.monitor || mData);
      if (cRes.ok) {
        const cData = await cRes.json();
        setChecks(Array.isArray(cData) ? cData : (cData.checks || []));
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, [id, range, fetchWithAuth]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div style={{ color: '#a1a1aa' }}>Loading...</div>;
  if (error) return (
    <div>
      <Link to="/dashboard" style={{ color: '#6366f1', fontSize: '13px' }}>← Back to Monitors</Link>
      <div style={{ marginTop: '16px', color: '#ef4444' }}>{error}</div>
    </div>
  );
  if (!monitor) return null;

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <Link to="/dashboard" style={{ color: '#a1a1aa', fontSize: '13px' }}>← Monitors</Link>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 600, color: '#e4e4e7' }}>{monitor.name}</h1>
        <StatusBadge status={monitor.status} />
      </div>

      {/* Detail cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        {[
          { label: 'URL', value: monitor.url },
          { label: 'Interval', value: monitor.interval ? `${monitor.interval}s` : '—' },
          { label: 'Uptime', value: monitor.uptime != null ? `${Number(monitor.uptime).toFixed(2)}%` : '—' },
          { label: 'Response Time', value: monitor.responseTime != null ? `${monitor.responseTime}ms` : (monitor.response_time != null ? `${monitor.response_time}ms` : '—') },
          { label: 'Created', value: formatDate(monitor.createdAt || monitor.created_at) },
          { label: 'Last Check', value: formatDate(monitor.lastCheck || monitor.last_check) },
        ].map(({ label, value }) => (
          <div
            key={label}
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
        ))}
      </div>

      {/* Recent checks */}
      <div
        style={{
          backgroundColor: '#18181b',
          border: '1px solid #27272a',
          borderRadius: '8px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px',
            borderBottom: '1px solid #27272a',
          }}
        >
          <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#e4e4e7' }}>Recent Checks</h2>
          <div style={{ display: 'flex', gap: '8px' }}>
            {RANGES.map((r) => (
              <button
                key={r.value}
                onClick={() => setRange(r.value)}
                style={{
                  padding: '4px 12px',
                  backgroundColor: range === r.value ? '#6366f1' : 'transparent',
                  border: `1px solid ${range === r.value ? '#6366f1' : '#27272a'}`,
                  borderRadius: '6px',
                  color: range === r.value ? '#fff' : '#a1a1aa',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {checks.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: '#a1a1aa', fontSize: '13px' }}>
            No checks recorded yet.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #27272a' }}>
                {['Status', 'Response Time', 'Status Code', 'Timestamp', 'Error'].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: '10px 16px',
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
              {checks.slice(0, 50).map((c, i) => (
                <tr
                  key={c.id || c._id || i}
                  style={{ borderBottom: i < checks.length - 1 ? '1px solid #27272a' : 'none' }}
                >
                  <td style={{ padding: '10px 16px' }}>
                    <StatusBadge status={c.status === true || c.status === 'up' ? 'up' : (c.status === false || c.status === 'down' ? 'down' : c.status)} />
                  </td>
                  <td style={{ padding: '10px 16px', color: '#e4e4e7', fontSize: '13px' }}>
                    {c.responseTime != null ? `${c.responseTime}ms` : (c.response_time != null ? `${c.response_time}ms` : '—')}
                  </td>
                  <td style={{ padding: '10px 16px', color: '#e4e4e7', fontSize: '13px' }}>
                    {c.statusCode || c.status_code || '—'}
                  </td>
                  <td style={{ padding: '10px 16px', color: '#a1a1aa', fontSize: '13px' }}>
                    {formatDate(c.checkedAt || c.checked_at || c.createdAt || c.created_at || c.timestamp)}
                  </td>
                  <td style={{ padding: '10px 16px', color: '#ef4444', fontSize: '12px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {c.error || '—'}
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
