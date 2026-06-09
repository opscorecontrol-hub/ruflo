import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';

const MAX_ENTRIES = 500;

const EVENT_COLORS = {
  'agent:status': '#6366f1',
  'swarm:scaled': '#22c55e',
  'vm:status': '#eab308',
  'monitor:down': '#ef4444',
  'monitor:up': '#22c55e',
  'monitor:check': '#a1a1aa',
  'pipeline:triggered': '#6366f1',
  'task:created': '#a1a1aa',
  'task:completed': '#22c55e',
  'task:failed': '#ef4444',
  'error': '#ef4444',
};

function getEventColor(eventType) {
  if (!eventType) return '#a1a1aa';
  const exact = EVENT_COLORS[eventType];
  if (exact) return exact;
  if (eventType.includes('error') || eventType.includes('fail')) return '#ef4444';
  if (eventType.includes('success') || eventType.includes('up') || eventType.includes('complete')) return '#22c55e';
  if (eventType.includes('warn') || eventType.includes('scaling')) return '#eab308';
  return '#a1a1aa';
}

function summarizePayload(data) {
  if (data == null) return '';
  if (typeof data === 'string') return data.slice(0, 120);
  try {
    const s = JSON.stringify(data);
    return s.length > 120 ? s.slice(0, 117) + '...' : s;
  } catch {
    return '';
  }
}

function formatTs(ts) {
  if (!ts) return '';
  try {
    return new Date(typeof ts === 'number' ? ts : ts).toLocaleTimeString();
  } catch {
    return '';
  }
}

export default function LogsPage() {
  const { fetchWithAuth } = useAuth();
  const { subscribe } = useSocket();
  const [entries, setEntries] = useState([]);
  const [filterType, setFilterType] = useState('');
  const [knownTypes, setKnownTypes] = useState(new Set());
  const topRef = useRef(null);

  // Load history on mount
  useEffect(() => {
    fetchWithAuth('/logs')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data) return;
        const list = Array.isArray(data) ? data : (data.logs || data.events || []);
        const normalized = list.map((item, i) => ({
          id: item.id || item._id || `hist-${i}`,
          event: item.event || item.type || item.eventType || 'log',
          data: item.data || item.payload || item,
          ts: item.ts || item.timestamp || item.createdAt || Date.now(),
        }));
        setEntries(normalized.reverse().slice(0, MAX_ENTRIES));
        setKnownTypes((prev) => {
          const next = new Set(prev);
          normalized.forEach((e) => next.add(e.event));
          return next;
        });
      })
      .catch(() => {});
  }, [fetchWithAuth]);

  // Live subscription
  const addEntry = useCallback((entry) => {
    setEntries((prev) => {
      const next = [entry, ...prev];
      return next.length > MAX_ENTRIES ? next.slice(0, MAX_ENTRIES) : next;
    });
    setKnownTypes((prev) => {
      if (prev.has(entry.event)) return prev;
      const next = new Set(prev);
      next.add(entry.event);
      return next;
    });
  }, []);

  useEffect(() => {
    const unsub = subscribe('*', ({ event, data, ts }) => {
      addEntry({
        id: `live-${Date.now()}-${Math.random()}`,
        event,
        data,
        ts: ts || Date.now(),
      });
    });
    return unsub;
  }, [subscribe, addEntry]);

  const filtered = filterType ? entries.filter((e) => e.event === filterType) : entries;

  const typesArray = Array.from(knownTypes).sort();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexShrink: 0 }}>
        <h1 style={{ fontSize: '20px', fontWeight: 600, color: '#e4e4e7' }}>Live Logs</h1>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            style={{
              padding: '7px 10px',
              backgroundColor: '#0a0a0f',
              border: '1px solid #27272a',
              borderRadius: '6px',
              color: '#e4e4e7',
              fontSize: '13px',
              outline: 'none',
            }}
          >
            <option value="">All Events</option>
            {typesArray.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <button
            onClick={() => setEntries([])}
            style={{
              padding: '7px 14px',
              backgroundColor: 'transparent',
              border: '1px solid #27272a',
              borderRadius: '6px',
              color: '#a1a1aa',
              fontSize: '13px',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#6366f1'; e.currentTarget.style.color = '#6366f1'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#27272a'; e.currentTarget.style.color = '#a1a1aa'; }}
          >
            Clear
          </button>
        </div>
      </div>

      {/* Log feed */}
      <div
        style={{
          flex: 1,
          backgroundColor: '#18181b',
          border: '1px solid #27272a',
          borderRadius: '8px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
        }}
      >
        <div style={{ padding: '10px 16px', borderBottom: '1px solid #27272a', display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: '#22c55e',
              boxShadow: '0 0 6px #22c55e66',
              animation: 'pulse 2s infinite',
            }}
          />
          <span style={{ fontSize: '13px', color: '#a1a1aa' }}>
            {filtered.length} event{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>

        <div
          ref={topRef}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '4px 0',
          }}
        >
          {filtered.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#a1a1aa', fontSize: '13px' }}>
              Waiting for events...
            </div>
          ) : (
            filtered.map((entry) => {
              const color = getEventColor(entry.event);
              return (
                <div
                  key={entry.id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    padding: '7px 16px',
                    borderBottom: '1px solid rgba(39,39,42,0.5)',
                    fontFamily: 'monospace',
                    fontSize: '12px',
                  }}
                >
                  {/* Event type chip */}
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '1px 8px',
                      backgroundColor: `${color}20`,
                      border: `1px solid ${color}40`,
                      borderRadius: '4px',
                      color,
                      fontSize: '11px',
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                      minWidth: '120px',
                      textAlign: 'center',
                    }}
                  >
                    {entry.event}
                  </span>

                  {/* Payload summary */}
                  <span
                    style={{
                      color: '#a1a1aa',
                      flex: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {summarizePayload(entry.data)}
                  </span>

                  {/* Timestamp */}
                  <span style={{ color: '#52525b', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {formatTs(entry.ts)}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
