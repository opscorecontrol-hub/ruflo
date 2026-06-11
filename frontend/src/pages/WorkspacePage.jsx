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

  useEffect(() => {
    const unsubs = [
      subscribe('log:entry', (d) => addLog(d?.level || 'info', d?.message || '')),
      subscribe('agent:status', (d) => {
        addLog('info', `Agent ${(d?.id || '?').slice(0, 8)} → ${d?.status}`);
        loadMap();
      }),
      subscribe('swarm:scaled', (d) => {
        addLog('info', `Swarm scaled: ${d?.action || ''} (${d?.reason || ''})`);
        loadMap();
      }),
      subscribe('vm:status', (d) => addLog('info', `VM ${(d?.id || '?').slice(0, 8)} → ${d?.status}`)),
      subscribe('monitor:check', (d) => {
        const lvl = d?.ok ? 'success' : 'warn';
        addLog(lvl, `Monitor "${d?.name || '?'}" ${d?.ok ? 'up' : 'down'}`);
      }),
      subscribe('connected', () => addLog('success', 'WebSocket connected')),
    ];
    return () => unsubs.forEach(u => u());
  }, [subscribe, addLog, loadMap]);

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

        {/* RIGHT — Output Terminal */}
        <div style={{
          width: '310px',
          flexShrink: 0,
          backgroundColor: '#0d0d0d',
          borderLeft: `1px solid ${C.border}`,
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
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#1a1a1a',
            flexShrink: 0,
          }}>
            <span>Output</span>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <span style={{ color: C.textDim, fontWeight: 400 }}>{logs.length}</span>
              <button onClick={() => setLogs([])} style={{
                background: 'none', border: 'none',
                color: C.textDim, fontSize: '11px', cursor: 'pointer', padding: 0,
              }}>
                Clear
              </button>
            </div>
          </div>

          {/* Log stream */}
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

          {/* Stats */}
          <div style={{
            padding: '8px',
            borderTop: `1px solid ${C.border}`,
            backgroundColor: '#111',
            flexShrink: 0,
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '6px' }}>
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
