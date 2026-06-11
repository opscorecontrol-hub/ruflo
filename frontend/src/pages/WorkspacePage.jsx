import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';

const C = {
  bg: '#1e1e1e',
  sidebar: '#252526',
  panel: '#2d2d30',
  header: '#3c3c3c',
  border: '#404040',
  text: '#d4d4d4',
  textMuted: '#858585',
  textDim: '#555',
  accent: '#007acc',
  green: '#4ec9b0',
  yellow: '#dcdcaa',
  red: '#f44747',
  blue: '#569cd6',
};

function renderLine(line, key) {
  if (line.startsWith('**') && line.endsWith('**') && line.length > 4) {
    return <div key={key}><strong style={{ color: C.blue }}>{line.slice(2, -2)}</strong></div>;
  }
  if (line.startsWith('- ')) {
    return <div key={key} style={{ paddingLeft: '10px' }}>
      <span style={{ color: C.textMuted }}>•</span> {renderInline(line.slice(2))}
    </div>;
  }
  if (line === '') return <div key={key} style={{ height: '6px' }} />;
  return <div key={key}>{renderInline(line)}</div>;
}

function renderInline(text) {
  return text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).map((part, i) => {
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code key={i} style={{
          backgroundColor: '#111',
          padding: '1px 5px',
          borderRadius: '3px',
          fontFamily: 'Consolas, monospace',
          fontSize: '11px',
          color: C.green,
        }}>
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={i} style={{ color: C.blue }}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

function ChatBubble({ role, content, created_at }) {
  const isUser = role === 'user';
  const lines = content.split('\n');
  return (
    <div style={{
      marginBottom: '10px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: isUser ? 'flex-end' : 'flex-start',
    }}>
      <div style={{
        maxWidth: '90%',
        padding: '7px 11px',
        borderRadius: isUser ? '10px 10px 2px 10px' : '10px 10px 10px 2px',
        backgroundColor: isUser ? '#264f78' : C.panel,
        border: `1px solid ${isUser ? '#3a6fa8' : C.border}`,
        fontSize: '12px',
        lineHeight: '1.55',
        color: C.text,
      }}>
        {lines.map((line, i) => renderLine(line, i))}
      </div>
      <div style={{
        fontSize: '10px',
        color: C.textDim,
        marginTop: '2px',
        paddingLeft: isUser ? 0 : '4px',
        paddingRight: isUser ? '4px' : 0,
      }}>
        {isUser ? 'You' : 'Blackbird AI'} · {new Date(created_at).toLocaleTimeString()}
      </div>
    </div>
  );
}

function AgentMap({ swarms, agents }) {
  const W = 252;
  const H = 180;

  if (!swarms.length) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        color: C.textDim,
        fontSize: '11px',
        textAlign: 'center',
      }}>
        No swarms yet.
      </div>
    );
  }

  const nodes = [];
  const edges = [];

  swarms.slice(0, 4).forEach((swarm, si) => {
    const total = Math.min(swarms.length, 4);
    const cx = 30 + (si * (W - 60)) / Math.max(total - 1, 1);
    const cy = 70;
    nodes.push({ ...swarm, cx, cy, r: 18, isSwarm: true });

    const swarmAgents = agents.filter(a => a.swarm_id === swarm.id).slice(0, 8);
    swarmAgents.forEach((agent, ai) => {
      const angle = (ai / Math.max(swarmAgents.length, 1)) * 2 * Math.PI - Math.PI / 2;
      const rx = 42;
      const ry = 35;
      const acx = cx + rx * Math.cos(angle);
      const acy = cy + ry * Math.sin(angle);
      nodes.push({ ...agent, cx: acx, cy: acy, r: 7, isSwarm: false });
      edges.push({ x1: cx, y1: cy, x2: acx, y2: acy });
    });
  });

  const nodeColor = (n) => {
    if (n.isSwarm) {
      if (n.status === 'active') return '#22c55e';
      if (n.status === 'error') return C.red;
      return '#6366f1';
    }
    if (n.status === 'busy') return '#f59e0b';
    if (n.status === 'idle') return '#22c55e';
    return '#555';
  };

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`}>
      <defs>
        <pattern id="g" width="16" height="16" patternUnits="userSpaceOnUse">
          <path d="M16 0L0 0 0 16" fill="none" stroke="#333" strokeWidth="0.4" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#g)" opacity="0.6" />
      {edges.map((e, i) => (
        <line key={i} x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
          stroke="#444" strokeWidth="0.8" strokeDasharray="3,2" />
      ))}
      {nodes.map((n, i) => (
        <g key={i}>
          {n.isSwarm && (
            <circle cx={n.cx} cy={n.cy} r={n.r + 5}
              fill={nodeColor(n) + '18'} stroke={nodeColor(n)} strokeWidth="0.5" />
          )}
          <circle cx={n.cx} cy={n.cy} r={n.r}
            fill={nodeColor(n) + '30'} stroke={nodeColor(n)} strokeWidth="1.5" />
          {n.isSwarm && (
            <text x={n.cx} y={n.cy + n.r + 12} textAnchor="middle"
              fill={C.textMuted} fontSize="8.5" fontFamily="sans-serif">
              {(n.name || '').slice(0, 10)}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

const DEFAULT_CODE = `// Blackbird 2030 — Agent Orchestration Workspace
// Edit and run code, or ask the AI assistant on the left.

import { SwarmController } from '@blackbird/swarm';
import { AgentManager } from '@blackbird/agents';

// Create a swarm with auto-scaling policy
const swarm = await SwarmController.create({
  name: 'production-fleet',
  policy: {
    minAgents: 2,
    maxAgents: 10,
    highLoadThreshold: 80,
    autoScale: true,
  },
});

// Spawn initial worker agents
const agents = await Promise.all([
  AgentManager.spawn({ type: 'coordinator', swarmId: swarm.id }),
  AgentManager.spawn({ type: 'worker', swarmId: swarm.id }),
  AgentManager.spawn({ type: 'worker', swarmId: swarm.id }),
]);

console.log(\`Swarm \${swarm.name} ready with \${agents.length} agents\`);
`;

const TABS_CONTENT = {
  'workspace.js': DEFAULT_CODE,
  'swarm-config.json': `{
  "swarm": {
    "name": "production-fleet",
    "topology": "hierarchical",
    "maxAgents": 10,
    "policy": {
      "minAgents": 2,
      "highLoadThreshold": 80,
      "lowLoadThreshold": 20,
      "agentDensity": 10,
      "autoScale": true
    }
  },
  "vm": {
    "provider": "hetzner",
    "instanceType": "cx22",
    "region": "nbg1"
  }
}`,
  'agent-policy.js': `// Agent scaling policy — evaluated every 30s
// Returns: { action: 'none'|'scale_up'|'scale_down', delta }

export function evaluateScaling({ agentCount, avgLoad, queueDepth, policy }) {
  const { minAgents = 1, maxAgents = 10,
          highLoadThreshold = 80, lowLoadThreshold = 20 } = policy;

  if (avgLoad > highLoadThreshold && agentCount < maxAgents) {
    return { action: 'scale_up', delta: 1, reason: \`load \${avgLoad}% > \${highLoadThreshold}%\` };
  }

  if (avgLoad < lowLoadThreshold && agentCount > minAgents) {
    return { action: 'scale_down', delta: 1, reason: \`load \${avgLoad}% < \${lowLoadThreshold}%\` };
  }

  return { action: 'none', reason: 'load within thresholds' };
}
`,
};

function logColor(level) {
  if (level === 'error') return C.red;
  if (level === 'warn') return C.yellow;
  if (level === 'success') return C.green;
  return '#6a9955';
}

function logTag(level) {
  if (level === 'error') return 'ERR';
  if (level === 'warn') return 'WRN';
  if (level === 'success') return 'OK ';
  return 'INF';
}

// Maps incoming WS events to AI terminal lines the way Devin AI shows activity
function eventToTerminalLines(eventType, data) {
  const ts = new Date().toLocaleTimeString('en', { hour12: false });
  const id = (data?.id || data?.agentId || '').slice(0, 8);
  const vmIp = data?.ip_address || data?.ip || '10.0.x.x';

  switch (eventType) {
    case 'agent:status':
      if (data?.status === 'idle') {
        return [
          { t: ts, kind: 'cmd',    text: `$ ps aux | grep agent-${id}` },
          { t: ts, kind: 'stdout', text: `blackbird   1234  0.1  0.2  agent-${id} [${data?.type || 'worker'}] — idle` },
        ];
      }
      if (data?.status === 'busy') {
        return [
          { t: ts, kind: 'cmd',    text: `$ systemctl status blackbird-agent@${id}` },
          { t: ts, kind: 'stdout', text: `● blackbird-agent@${id} — Active: running (1m 23s)` },
          { t: ts, kind: 'stdout', text: `  task: processing queued payload...` },
        ];
      }
      if (data?.status === 'terminated') {
        return [
          { t: ts, kind: 'cmd',    text: `$ systemctl stop blackbird-agent@${id}` },
          { t: ts, kind: 'ok',     text: `[  OK  ] Stopped blackbird-agent@${id}` },
        ];
      }
      return [{ t: ts, kind: 'info', text: `agent ${id} → ${data?.status}` }];

    case 'swarm:scaled':
      if (data?.action === 'scale_up') {
        return [
          { t: ts, kind: 'cmd',    text: `$ docker run -d --name worker-${id} blackbird/agent:latest` },
          { t: ts, kind: 'stdout', text: `${data?.delta || 1}x container(s) starting...` },
          { t: ts, kind: 'ok',     text: `[  OK  ] Agents spawned — ${data?.reason || ''}` },
        ];
      }
      if (data?.action === 'scale_down') {
        return [
          { t: ts, kind: 'cmd',    text: `$ docker stop $(docker ps -q --filter label=blackbird.swarm=${data?.swarmId?.slice(0,8) || '?'})` },
          { t: ts, kind: 'ok',     text: `[  OK  ] Scaled down — ${data?.reason || ''}` },
        ];
      }
      if (data?.action === 'cleanup') {
        return [
          { t: ts, kind: 'cmd',    text: `$ blackbird-cli vms cleanup --orphaned` },
          { t: ts, kind: 'ok',     text: `[  OK  ] ${data?.reason || 'Orphaned VMs destroyed'}` },
        ];
      }
      return [{ t: ts, kind: 'info', text: `swarm scaled: ${data?.action} — ${data?.reason || ''}` }];

    case 'vm:status':
      if (data?.status === 'running') {
        return [
          { t: ts, kind: 'cmd',    text: `$ ssh root@${vmIp} 'uname -a && df -h /'` },
          { t: ts, kind: 'stdout', text: `Linux blackbird-node 6.1.0 #1 SMP x86_64 GNU/Linux` },
          { t: ts, kind: 'stdout', text: `Filesystem      Size  Used Avail Use%` },
          { t: ts, kind: 'stdout', text: `/dev/sda1        80G  3.2G   77G   4%  /` },
          { t: ts, kind: 'ok',     text: `[  OK  ] VM ${id} online at ${vmIp}` },
        ];
      }
      if (data?.status === 'provisioning') {
        return [
          { t: ts, kind: 'cmd',    text: `$ hcloud server create --name bb-${id} --type cx22 --image debian-12` },
          { t: ts, kind: 'stdout', text: `Waiting for server to start...` },
        ];
      }
      return [{ t: ts, kind: 'info', text: `VM ${id} → ${data?.status}` }];

    case 'monitor:check':
      return [
        { t: ts, kind: 'cmd',    text: `$ curl -sI --max-time 5 "${data?.url || 'http://...'}" | head -1` },
        { t: ts, kind: data?.ok ? 'ok' : 'err', text: data?.ok ? `HTTP/1.1 200 OK  — ${data?.name || 'monitor'} ✓` : `curl: (7) Failed — ${data?.name || 'monitor'} DOWN` },
      ];

    default:
      return [];
  }
}

function AiDesktop({ termLines, activeAgents, vms }) {
  const termRef = useRef(null);
  const [activeVm, setActiveVm] = useState(0);

  useEffect(() => {
    termRef.current?.scrollTo({ top: termRef.current.scrollHeight, behavior: 'smooth' });
  }, [termLines]);

  const busyAgents = activeAgents.filter(a => a.status === 'busy');
  const runningVms = vms.filter(v => v.status === 'running');
  const currentVm = runningVms[activeVm % Math.max(runningVms.length, 1)];

  function lineColor(kind) {
    if (kind === 'cmd')    return '#c586c0';
    if (kind === 'ok')     return '#4ec9b0';
    if (kind === 'err')    return '#f44747';
    if (kind === 'stdout') return '#9cdcfe';
    return '#858585';
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Active agent banner */}
      <div style={{
        padding: '6px 10px',
        backgroundColor: '#0f1a0f',
        borderBottom: '1px solid #1a3a1a',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        flexShrink: 0,
      }}>
        <span style={{
          width: '7px', height: '7px', borderRadius: '50%',
          backgroundColor: busyAgents.length > 0 ? '#22c55e' : '#555',
          boxShadow: busyAgents.length > 0 ? '0 0 6px #22c55e' : 'none',
          flexShrink: 0,
        }} />
        <span style={{ fontSize: '10px', color: '#4ec9b0', fontWeight: 600, letterSpacing: '0.06em' }}>
          {busyAgents.length > 0
            ? `AI ACTIVE — ${busyAgents.length} agent${busyAgents.length > 1 ? 's' : ''} working`
            : activeAgents.length > 0
            ? `STANDBY — ${activeAgents.length} agent${activeAgents.length > 1 ? 's' : ''} idle`
            : 'WAITING FOR AGENTS'}
        </span>
        {runningVms.length > 0 && (
          <span style={{ marginLeft: 'auto', fontSize: '10px', color: '#555' }}>
            <span
              style={{ color: '#6366f1', cursor: runningVms.length > 1 ? 'pointer' : 'default' }}
              onClick={() => setActiveVm(v => (v + 1) % runningVms.length)}
            >
              {currentVm?.ip_address || currentVm?.id?.slice(0, 10) || '—'}
            </span>
            {runningVms.length > 1 && <span style={{ color: '#333' }}> +{runningVms.length - 1}</span>}
          </span>
        )}
      </div>

      {/* VM info strip */}
      {currentVm && (
        <div style={{
          padding: '4px 10px',
          backgroundColor: '#0a0a0a',
          borderBottom: '1px solid #1a1a1a',
          display: 'flex',
          gap: '14px',
          flexShrink: 0,
          flexWrap: 'wrap',
        }}>
          {[
            ['HOST', currentVm.ip_address || '—'],
            ['PROVIDER', currentVm.provider || '—'],
            ['TYPE', currentVm.instance_type || '—'],
            ['STATUS', currentVm.status],
          ].map(([k, v]) => (
            <span key={k} style={{ fontSize: '9px', color: '#3a3a3a' }}>
              <span style={{ letterSpacing: '0.06em', marginRight: '3px' }}>{k}</span>
              <span style={{ color: '#777', fontFamily: 'Consolas, monospace' }}>{v}</span>
            </span>
          ))}
        </div>
      )}

      {/* Terminal */}
      <div
        ref={termRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '8px 10px',
          fontFamily: '"Cascadia Code", Consolas, "Courier New", monospace',
          fontSize: '11px',
          lineHeight: '17px',
          backgroundColor: '#0d0d0d',
        }}
      >
        {termLines.length === 0 && (
          <div style={{ padding: '20px 0', color: '#333', fontSize: '11px', textAlign: 'center' }}>
            <div style={{ marginBottom: '6px', fontSize: '18px' }}>⬡</div>
            <div style={{ color: '#555' }}>Waiting for AI activity…</div>
            <div style={{ color: '#333', marginTop: '4px' }}>Events appear here in real time</div>
          </div>
        )}
        {termLines.map((line, i) => (
          <div key={i} style={{ display: 'flex', gap: '6px', marginBottom: '1px' }}>
            <span style={{ color: '#2a2a2a', flexShrink: 0, userSelect: 'none', fontFamily: 'Consolas, monospace' }}>
              {line.t}
            </span>
            <span style={{ color: lineColor(line.kind), wordBreak: 'break-all' }}>
              {line.text}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function vmStatusColor(status) {
  if (status === 'running') return '#22c55e';
  if (status === 'provisioning' || status === 'pending') return '#eab308';
  if (status === 'terminated' || status === 'error') return '#ef4444';
  return '#71717a';
}

function VmCard({ vm, agents }) {
  const statusColor = vmStatusColor(vm.status);
  const isRunning = vm.status === 'running';
  return (
    <div style={{
      backgroundColor: '#111518',
      border: `1px solid ${isRunning ? '#1a3a1a' : '#27272a'}`,
      borderRadius: '6px',
      padding: '10px 12px',
      marginBottom: '8px',
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
          <span style={{
            width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
            backgroundColor: statusColor,
            boxShadow: isRunning ? `0 0 6px ${statusColor}88` : 'none',
          }} />
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#d4d4d4', fontFamily: 'Consolas, monospace' }}>
            {vm.id.slice(0, 10)}
          </span>
        </div>
        <span style={{
          fontSize: '9px', fontWeight: 600, letterSpacing: '0.08em',
          color: statusColor, textTransform: 'uppercase',
        }}>
          {vm.status}
        </span>
      </div>

      {/* Detail grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 8px', marginBottom: '7px' }}>
        {[
          ['PROVIDER', vm.provider || '—'],
          ['IP', vm.ip_address || '—'],
          ['TYPE', vm.instance_type || '—'],
          ['AGENTS', agents.length],
        ].map(([label, val]) => (
          <div key={label} style={{ display: 'flex', gap: '4px', alignItems: 'baseline' }}>
            <span style={{ fontSize: '9px', color: '#3a3a3a', fontWeight: 600, letterSpacing: '0.06em', minWidth: '46px' }}>
              {label}
            </span>
            <span style={{ fontSize: '10px', color: '#9a9a9a', fontFamily: 'Consolas, monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {String(val)}
            </span>
          </div>
        ))}
      </div>

      {/* Agents on VM */}
      {agents.length > 0 && (
        <div style={{ marginBottom: '6px' }}>
          <div style={{ fontSize: '9px', color: '#3a3a3a', fontWeight: 600, letterSpacing: '0.06em', marginBottom: '3px' }}>
            AGENT PROCESSES
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
            {agents.slice(0, 8).map(a => (
              <span key={a.id} style={{
                fontSize: '9px', padding: '1px 5px', borderRadius: '3px',
                fontFamily: 'Consolas, monospace',
                backgroundColor: a.status === 'busy' ? 'rgba(245,158,11,0.12)' : 'rgba(34,197,94,0.1)',
                color: a.status === 'busy' ? '#f59e0b' : '#22c55e',
                border: `1px solid ${a.status === 'busy' ? 'rgba(245,158,11,0.2)' : 'rgba(34,197,94,0.2)'}`,
              }}>
                {a.type} {a.id.slice(0, 5)}
              </span>
            ))}
            {agents.length > 8 && (
              <span style={{ fontSize: '9px', color: '#555' }}>+{agents.length - 8} more</span>
            )}
          </div>
        </div>
      )}

      {/* AI managed footer */}
      <div style={{
        borderTop: '1px solid #1e1e1e',
        paddingTop: '5px',
        marginTop: '2px',
        display: 'flex',
        alignItems: 'center',
        gap: '5px',
      }}>
        <span style={{ fontSize: '9px', color: '#6366f1', fontWeight: 600, letterSpacing: '0.04em' }}>AI</span>
        <span style={{ fontSize: '9px', color: '#333' }}>
          {vm.provider === 'hetzner' ? 'Hetzner Cloud · AI-provisioned' : 'Local provider · AI-managed'}
        </span>
        {isRunning && (
          <span style={{
            marginLeft: 'auto', fontSize: '9px', color: '#22c55e',
            display: 'flex', alignItems: 'center', gap: '3px',
          }}>
            <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#22c55e', boxShadow: '0 0 4px #22c55e' }} />
            live
          </span>
        )}
      </div>
    </div>
  );
}

export default function WorkspacePage() {
  const { fetchWithAuth } = useAuth();
  const { subscribe, connected } = useSocket();

  const [messages, setMessages] = useState([{
    id: 'welcome',
    role: 'assistant',
    content: 'Welcome to Blackbird 2030 AI Workspace.\n\nType `status` for a system overview, `agents` to list agents, or ask anything about your infrastructure.',
    created_at: Date.now(),
  }]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef(null);

  const [mapData, setMapData] = useState({ swarms: [], agents: [] });
  const [vms, setVms] = useState([]);
  const [rightTab, setRightTab] = useState('ai-desktop');
  const [termLines, setTermLines] = useState([]);

  const [activeTab, setActiveTab] = useState('workspace.js');
  const [tabContents, setTabContents] = useState(TABS_CONTENT);

  const [logs, setLogs] = useState([
    { level: 'info', msg: 'Workspace initialised', ts: Date.now() - 4000 },
  ]);
  const logsEndRef = useRef(null);

  const addLog = useCallback((level, msg) => {
    setLogs(prev => [...prev.slice(-299), { level, msg, ts: Date.now() }]);
  }, []);

  const loadMap = useCallback(() => {
    fetchWithAuth('/workspace/swarm-map')
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setMapData(d))
      .catch(() => {});
    fetchWithAuth('/vms')
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setVms(Array.isArray(d) ? d : (d?.vms || [])))
      .catch(() => {});
  }, [fetchWithAuth]);

  useEffect(() => {
    fetchWithAuth('/workspace/chat')
      .then(r => r.ok ? r.json() : [])
      .then(hist => hist.length && setMessages(prev => [...prev, ...hist]))
      .catch(() => {});

    loadMap();
    const t = setInterval(loadMap, 15000);
    return () => clearInterval(t);
  }, [fetchWithAuth, loadMap]);

  const addTermLines = useCallback((lines) => {
    if (!lines.length) return;
    setTermLines(prev => [...prev.slice(-499), ...lines]);
  }, []);

  useEffect(() => {
    const unsubs = [
      subscribe('log:entry', (d) => addLog(d?.level || 'info', d?.message || '')),
      subscribe('agent:status', (d) => {
        addLog('info', `Agent ${(d?.id || '?').slice(0, 8)} → ${d?.status}`);
        addTermLines(eventToTerminalLines('agent:status', d));
        loadMap();
      }),
      subscribe('swarm:scaled', (d) => {
        addLog('info', `Swarm scaled: ${d?.action || ''} (${d?.reason || ''})`);
        addTermLines(eventToTerminalLines('swarm:scaled', d));
        loadMap();
      }),
      subscribe('vm:status', (d) => {
        addLog('info', `VM ${(d?.id || '?').slice(0, 8)} → ${d?.status}`);
        addTermLines(eventToTerminalLines('vm:status', d));
        loadMap();
      }),
      subscribe('monitor:check', (d) => {
        const lvl = d?.ok ? 'success' : 'warn';
        addLog(lvl, `Monitor "${d?.name || '?'}" ${d?.ok ? 'up' : 'down'}`);
        addTermLines(eventToTerminalLines('monitor:check', d));
      }),
      subscribe('connected', () => addLog('success', 'WebSocket connected')),
    ];
    return () => unsubs.forEach(u => u());
  }, [subscribe, addLog, addTermLines, loadMap]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => { logsEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [logs]);

  const sendMessage = async () => {
    const msg = chatInput.trim();
    if (!msg || chatLoading) return;
    const userMsg = { id: `u-${Date.now()}`, role: 'user', content: msg, created_at: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setChatLoading(true);
    try {
      const res = await fetchWithAuth('/workspace/chat', {
        method: 'POST',
        body: JSON.stringify({ message: msg }),
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(prev => [...prev, data]);
      } else {
        setMessages(prev => [...prev, {
          id: `err-${Date.now()}`, role: 'assistant',
          content: 'Sorry, could not process that. Try again.',
          created_at: Date.now(),
        }]);
      }
    } catch {
      setMessages(prev => [...prev, {
        id: `err-${Date.now()}`, role: 'assistant',
        content: 'Network error. Check your connection.',
        created_at: Date.now(),
      }]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleRun = () => {
    addLog('info', `> Running ${activeTab}…`);
    fetchWithAuth('/workspace/chat', {
      method: 'POST',
      body: JSON.stringify({ message: `Execute and analyse the current ${activeTab} code` }),
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setMessages(prev => [...prev, d]))
      .catch(() => addLog('error', 'Run failed: network error'));
  };

  const code = tabContents[activeTab] ?? '';
  const setCode = (val) => setTabContents(prev => ({ ...prev, [activeTab]: val }));

  return (
    <div style={{
      margin: '-24px',
      height: 'calc(100vh - 100px)',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: C.bg,
      overflow: 'hidden',
    }}>
      {/* Top bar */}
      <div style={{
        height: '34px',
        backgroundColor: C.header,
        borderBottom: `1px solid ${C.border}`,
        display: 'flex',
        alignItems: 'center',
        padding: '0 12px',
        gap: '2px',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: '11px', color: C.textMuted, fontWeight: 600, marginRight: '12px' }}>
          WORKSPACE
        </span>
        {Object.keys(tabContents).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding: '3px 12px',
            fontSize: '11px',
            backgroundColor: activeTab === tab ? C.bg : 'transparent',
            border: `1px solid ${activeTab === tab ? C.border : 'transparent'}`,
            borderBottom: `1px solid ${activeTab === tab ? C.bg : 'transparent'}`,
            color: activeTab === tab ? C.text : C.textDim,
            cursor: 'pointer',
            borderRadius: '3px 3px 0 0',
            marginBottom: '-1px',
            lineHeight: '22px',
          }}>
            {tab}
          </button>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{
            width: '6px', height: '6px', borderRadius: '50%',
            backgroundColor: connected ? '#22c55e' : C.red,
            boxShadow: connected ? '0 0 4px #22c55e88' : 'none',
            flexShrink: 0,
          }} />
          <span style={{ fontSize: '11px', color: C.textDim }}>{connected ? 'Live' : 'Offline'}</span>
        </div>
      </div>

      {/* 3-panel body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* LEFT — Chat + Agent Map */}
        <div style={{
          width: '272px',
          flexShrink: 0,
          backgroundColor: C.sidebar,
          borderRight: `1px solid ${C.border}`,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '6px 12px',
            borderBottom: `1px solid ${C.border}`,
            fontSize: '10px',
            fontWeight: 600,
            color: C.textMuted,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            flexShrink: 0,
          }}>
            AI Assistant
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '10px', minHeight: 0 }}>
            {messages.map(m => <ChatBubble key={m.id} {...m} />)}
            {chatLoading && (
              <div style={{ color: C.textDim, fontSize: '11px', fontStyle: 'italic', padding: '4px' }}>
                Thinking…
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div style={{ padding: '8px', borderTop: `1px solid ${C.border}`, flexShrink: 0 }}>
            <div style={{ display: 'flex', gap: '5px' }}>
              <textarea
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
                }}
                placeholder="Ask anything… (⏎ send, ⇧⏎ newline)"
                rows={2}
                style={{
                  flex: 1,
                  padding: '5px 8px',
                  backgroundColor: C.bg,
                  border: `1px solid ${C.border}`,
                  borderRadius: '4px',
                  color: C.text,
                  fontSize: '11px',
                  resize: 'none',
                  outline: 'none',
                  fontFamily: 'inherit',
                  lineHeight: '1.4',
                }}
              />
              <button
                onClick={sendMessage}
                disabled={chatLoading || !chatInput.trim()}
                style={{
                  padding: '0 10px',
                  backgroundColor: chatLoading || !chatInput.trim() ? '#333' : C.accent,
                  border: 'none',
                  borderRadius: '4px',
                  color: chatLoading || !chatInput.trim() ? C.textDim : '#fff',
                  fontSize: '15px',
                  cursor: chatLoading || !chatInput.trim() ? 'not-allowed' : 'pointer',
                  alignSelf: 'stretch',
                }}
              >
                ↑
              </button>
            </div>
          </div>

          {/* Agent Map */}
          <div style={{ borderTop: `1px solid ${C.border}`, flexShrink: 0 }}>
            <div style={{
              padding: '5px 12px',
              fontSize: '10px',
              fontWeight: 600,
              color: C.textMuted,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              display: 'flex',
              justifyContent: 'space-between',
            }}>
              <span>Agent Topology</span>
              <span style={{ color: C.textDim, fontWeight: 400 }}>
                {mapData.swarms.length}S·{mapData.agents.length}A
              </span>
            </div>
            <div style={{ height: '190px' }}>
              <AgentMap swarms={mapData.swarms} agents={mapData.agents} />
            </div>
          </div>
        </div>

        {/* MIDDLE — Code Editor */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: C.bg,
          overflow: 'hidden',
          minWidth: 0,
        }}>
          {/* Editor toolbar */}
          <div style={{
            height: '30px',
            backgroundColor: C.panel,
            borderBottom: `1px solid ${C.border}`,
            display: 'flex',
            alignItems: 'center',
            padding: '0 12px',
            gap: '8px',
            flexShrink: 0,
          }}>
            <span style={{ fontSize: '11px', color: C.textMuted, flex: 1 }}>
              {activeTab}
            </span>
            <button onClick={handleRun} style={{
              padding: '2px 10px',
              backgroundColor: '#22c55e22',
              border: '1px solid #22c55e55',
              borderRadius: '3px',
              color: '#22c55e',
              fontSize: '11px',
              cursor: 'pointer',
            }}>
              ▶ Run
            </button>
            <button onClick={() => setCode(TABS_CONTENT[activeTab])} style={{
              padding: '2px 10px',
              backgroundColor: 'transparent',
              border: `1px solid ${C.border}`,
              borderRadius: '3px',
              color: C.textMuted,
              fontSize: '11px',
              cursor: 'pointer',
            }}>
              Reset
            </button>
          </div>

          {/* Textarea editor */}
          <textarea
            value={code}
            onChange={e => setCode(e.target.value)}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            style={{
              flex: 1,
              width: '100%',
              padding: '14px 16px',
              backgroundColor: C.bg,
              color: C.text,
              fontFamily: '"Cascadia Code", "Fira Code", Consolas, "Courier New", monospace',
              fontSize: '13px',
              lineHeight: '20px',
              border: 'none',
              resize: 'none',
              outline: 'none',
              tabSize: 2,
              boxSizing: 'border-box',
            }}
          />

          {/* VS Code-style status bar */}
          <div style={{
            height: '22px',
            backgroundColor: C.accent,
            display: 'flex',
            alignItems: 'center',
            padding: '0 12px',
            gap: '16px',
            flexShrink: 0,
          }}>
            <span style={{ fontSize: '11px', color: '#fff', opacity: 0.9 }}>JavaScript</span>
            <span style={{ fontSize: '11px', color: '#ffffffbb' }}>
              {code.split('\n').length} lines
            </span>
            <span style={{ fontSize: '11px', color: '#ffffffbb', marginLeft: 'auto' }}>
              Blackbird 2030
            </span>
          </div>
        </div>

        {/* RIGHT — AI Desktop / VM Console / Logs */}
        <div style={{
          width: '310px',
          flexShrink: 0,
          backgroundColor: '#0d0d0d',
          borderLeft: `1px solid ${C.border}`,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          {/* Tab bar */}
          <div style={{
            borderBottom: `1px solid ${C.border}`,
            backgroundColor: '#1a1a1a',
            display: 'flex',
            alignItems: 'center',
            flexShrink: 0,
          }}>
            {[
              { id: 'ai-desktop', label: 'AI Desktop' },
              { id: 'vm-console', label: 'VMs', badge: vms.length || null },
              { id: 'logs', label: 'Logs' },
            ].map(({ id, label, badge }) => (
              <button
                key={id}
                onClick={() => setRightTab(id)}
                style={{
                  padding: '6px 10px',
                  fontSize: '10px',
                  fontWeight: 600,
                  letterSpacing: '0.07em',
                  textTransform: 'uppercase',
                  border: 'none',
                  borderBottom: rightTab === id ? `2px solid ${C.accent}` : '2px solid transparent',
                  backgroundColor: 'transparent',
                  color: rightTab === id ? C.text : C.textDim,
                  cursor: 'pointer',
                }}
              >
                {label}
                {badge > 0 && (
                  <span style={{
                    marginLeft: '4px', fontSize: '9px', backgroundColor: '#6366f122',
                    color: '#6366f1', padding: '0 4px', borderRadius: '8px',
                  }}>
                    {badge}
                  </span>
                )}
              </button>
            ))}
            {rightTab === 'ai-desktop' && termLines.length > 0 && (
              <div style={{ marginLeft: 'auto', paddingRight: '8px' }}>
                <button onClick={() => setTermLines([])} style={{
                  background: 'none', border: 'none',
                  color: C.textDim, fontSize: '10px', cursor: 'pointer', padding: 0,
                }}>
                  Clear
                </button>
              </div>
            )}
            {rightTab === 'logs' && (
              <div style={{ marginLeft: 'auto', display: 'flex', gap: '10px', alignItems: 'center', paddingRight: '10px' }}>
                <span style={{ fontSize: '10px', color: C.textDim }}>{logs.length}</span>
                <button onClick={() => setLogs([])} style={{
                  background: 'none', border: 'none',
                  color: C.textDim, fontSize: '11px', cursor: 'pointer', padding: 0,
                }}>
                  Clear
                </button>
              </div>
            )}
          </div>

          {/* AI Desktop */}
          {rightTab === 'ai-desktop' && (
            <AiDesktop termLines={termLines} activeAgents={mapData.agents} vms={vms} />
          )}

          {/* Log stream */}
          {rightTab === 'logs' && (
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '8px 10px',
            fontFamily: 'Consolas, "Courier New", monospace',
            fontSize: '11px',
            lineHeight: '17px',
          }}>
            {logs.map((log, i) => (
              <div key={i} style={{ display: 'flex', gap: '6px', marginBottom: '1px' }}>
                <span style={{ color: '#3a3a3a', flexShrink: 0, userSelect: 'none' }}>
                  {new Date(log.ts).toLocaleTimeString('en', {
                    hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit',
                  })}
                </span>
                <span style={{
                  color: logColor(log.level),
                  flexShrink: 0,
                  fontWeight: 600,
                  fontSize: '10px',
                }}>
                  {logTag(log.level)}
                </span>
                <span style={{ color: '#bbb', wordBreak: 'break-all' }}>
                  {log.msg}
                </span>
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
          )}

          {/* VM Console */}
          {rightTab === 'vm-console' && (
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '8px',
          }}>
            {vms.length === 0 ? (
              <div style={{
                padding: '24px 12px',
                textAlign: 'center',
                color: C.textDim,
                fontSize: '11px',
                lineHeight: '1.7',
              }}>
                <div style={{ fontSize: '22px', marginBottom: '8px' }}>◻</div>
                <div style={{ color: C.textMuted, marginBottom: '6px' }}>No VMs provisioned</div>
                <div>Type in the chat:</div>
                <code style={{ color: C.green, fontSize: '10px' }}>provision vm for &lt;swarm&gt;</code>
                <div style={{ marginTop: '6px' }}>or use the <strong style={{ color: C.text }}>VMs</strong> page</div>
              </div>
            ) : vms.map(vm => (
              <VmCard
                key={vm.id}
                vm={vm}
                agents={mapData.agents.filter(a => a.vm_id === vm.id)}
              />
            ))}
          </div>
          )}

          {/* Stats */}
          <div style={{
            padding: '8px',
            borderTop: `1px solid ${C.border}`,
            backgroundColor: '#111',
            flexShrink: 0,
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', marginBottom: '6px' }}>
              {[
                {
                  label: 'Swarms',
                  value: mapData.swarms.length,
                  sub: `${mapData.swarms.filter(s => s.status === 'active').length} active`,
                  color: '#6366f1',
                },
                {
                  label: 'Agents',
                  value: mapData.agents.length,
                  sub: `${mapData.agents.filter(a => a.status === 'idle').length} idle`,
                  color: '#22c55e',
                },
                {
                  label: 'VMs',
                  value: vms.length,
                  sub: `${vms.filter(v => v.status === 'running').length} running`,
                  color: '#f59e0b',
                },
              ].map(({ label, value, sub, color }) => (
                <div key={label} style={{
                  backgroundColor: C.bg,
                  border: `1px solid ${C.border}`,
                  borderRadius: '4px',
                  padding: '6px 8px',
                }}>
                  <div style={{ fontSize: '10px', color: C.textDim }}>{label}</div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color, lineHeight: 1.2 }}>{value}</div>
                  <div style={{ fontSize: '10px', color: C.textMuted }}>{sub}</div>
                </div>
              ))}
            </div>
            <div style={{
              fontSize: '10px',
              color: C.textDim,
              textAlign: 'center',
              borderTop: `1px solid ${C.border}`,
              paddingTop: '6px',
            }}>
              {new Date().toLocaleString()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
