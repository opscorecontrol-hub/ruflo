import { useEffect, useRef } from 'react';

const stepColors = {
  pending:  { dot: '#444', text: '#555' },
  running:  { dot: '#7c6af7', text: '#a89cff' },
  done:     { dot: '#22c55e', text: '#4ade80' },
  error:    { dot: '#ef4444', text: '#f87171' },
};

const typeIcon = { research: '🔍', code: '💻', analyze: '📊' };

const S = {
  panel: { width: '280px', flexShrink: 0, backgroundColor: '#111', borderLeft: '1px solid #1e1e1e', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  header: { padding: '10px 14px', borderBottom: '1px solid #1e1e1e', fontSize: '11px', fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  body: { flex: 1, overflowY: 'auto', padding: '10px' },
  statusBanner: (active) => ({
    padding: '8px 10px', borderRadius: '6px', marginBottom: '10px', fontSize: '12px',
    backgroundColor: active ? '#1a1530' : '#141414',
    border: `1px solid ${active ? '#3d2f7a' : '#222'}`,
    color: active ? '#a89cff' : '#555',
    display: 'flex', alignItems: 'center', gap: '8px',
  }),
  dot: (active) => ({
    width: '7px', height: '7px', borderRadius: '50%', flexShrink: 0,
    backgroundColor: active ? '#7c6af7' : '#333',
    boxShadow: active ? '0 0 6px #7c6af7' : 'none',
  }),
  sectionTitle: { fontSize: '10px', color: '#444', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '6px', marginTop: '14px' },
  step: { padding: '8px 10px', borderRadius: '6px', marginBottom: '4px', backgroundColor: '#141414', border: '1px solid #1e1e1e' },
  stepHeader: { display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' },
  stepDot: (status) => ({
    width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0,
    backgroundColor: stepColors[status]?.dot || '#444',
    boxShadow: status === 'running' ? `0 0 5px ${stepColors.running.dot}` : 'none',
  }),
  stepTitle: (status) => ({ fontSize: '12px', fontWeight: 500, color: stepColors[status]?.text || '#555', flex: 1 }),
  stepResult: { fontSize: '11px', color: '#555', marginTop: '3px', paddingLeft: '12px', lineHeight: 1.4 },
  fileSection: { marginTop: '14px' },
  fileChip: { display: 'inline-block', padding: '2px 8px', backgroundColor: '#1a2a1a', border: '1px solid #2a3a2a', borderRadius: '4px', fontSize: '10px', color: '#4ade80', fontFamily: 'monospace', margin: '2px', wordBreak: 'break-all' },
  empty: { padding: '20px 14px', color: '#444', fontSize: '12px', textAlign: 'center', lineHeight: 1.7 },
};

export default function AgentStatus({ agentState }) {
  const { status, steps, files, currentRun } = agentState;
  const isRunning = currentRun && currentRun.status === 'running';

  return (
    <div style={S.panel}>
      <div style={S.header}>
        <span>Agent Status</span>
        {isRunning && <span style={{ color: '#7c6af7', fontSize: '10px', animation: 'none' }}>● LIVE</span>}
      </div>
      <div style={S.body}>
        {/* Status banner */}
        <div style={S.statusBanner(isRunning)}>
          <span style={S.dot(isRunning)} />
          <span>{status || (isRunning ? 'Agent running…' : 'Idle — enter a goal to start')}</span>
        </div>

        {/* Plan steps */}
        {steps.length > 0 && (
          <>
            <div style={S.sectionTitle}>Plan Steps ({steps.length})</div>
            {steps.map((step, i) => (
              <div key={step.id || step._db_id || i} style={S.step}>
                <div style={S.stepHeader}>
                  <span style={S.stepDot(step.status)}>
                    {step.status === 'running' && (
                      <span style={{ display: 'none' }} />
                    )}
                  </span>
                  <span style={{ fontSize: '11px', flexShrink: 0, marginRight: '2px' }}>
                    {typeIcon[step.type] || '·'}
                  </span>
                  <span style={S.stepTitle(step.status)}>{step.title}</span>
                </div>
                {step.result && (
                  <div style={S.stepResult}>
                    {typeof step.result === 'string' ? step.result : JSON.stringify(step.result)}
                  </div>
                )}
              </div>
            ))}
          </>
        )}

        {/* Files created */}
        {files.length > 0 && (
          <div style={S.fileSection}>
            <div style={S.sectionTitle}>Files Created ({files.length})</div>
            <div>
              {files.map((f, i) => (
                <span key={i} style={S.fileChip}>{f}</span>
              ))}
            </div>
          </div>
        )}

        {steps.length === 0 && files.length === 0 && (
          <div style={S.empty}>
            <div style={{ fontSize: '24px', marginBottom: '8px' }}>⬡</div>
            Agent steps and file changes will appear here as the AI works through your goal.
          </div>
        )}
      </div>
    </div>
  );
}
