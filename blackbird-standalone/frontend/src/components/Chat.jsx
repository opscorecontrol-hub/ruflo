import { useState, useRef, useEffect } from 'react';

const PROVIDERS = {
  claude:  ['claude-sonnet-4-6', 'claude-opus-4-8', 'claude-haiku-4-5-20251001'],
  openai:  ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo'],
  gemini:  ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash'],
  mistral: ['mistral-small-latest', 'mistral-medium-latest', 'mistral-large-latest'],
  groq:    ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],
  ollama:  ['llama3.2', 'codellama', 'deepseek-coder', 'mistral', 'phi3'],
};
const SEARCH_PROVIDERS = [
  { value: 'ddg', label: 'DuckDuckGo (free)' },
  { value: 'bing', label: 'Bing Search API' },
];

const S = {
  container: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  toolbar: { padding: '8px 14px', borderBottom: '1px solid #1e1e1e', display: 'flex', gap: '8px', alignItems: 'center', backgroundColor: '#111', flexShrink: 0, flexWrap: 'wrap' },
  label: { fontSize: '11px', color: '#555', flexShrink: 0 },
  sel: { padding: '4px 8px', backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '5px', color: '#e2e2e2', fontSize: '12px', outline: 'none', cursor: 'pointer' },
  msgs: { flex: 1, overflowY: 'auto', padding: '16px 14px' },
  bubble: (role) => ({
    display: 'flex', flexDirection: 'column',
    alignItems: role === 'user' ? 'flex-end' : 'flex-start',
    marginBottom: '12px',
  }),
  bubbleInner: (role) => ({
    maxWidth: '85%', padding: '10px 14px', borderRadius: role === 'user' ? '10px 10px 2px 10px' : '10px 10px 10px 2px',
    backgroundColor: role === 'user' ? '#1e1a3a' : '#1a1a1a',
    border: `1px solid ${role === 'user' ? '#3d2f7a' : '#222'}`,
    fontSize: '13px', lineHeight: 1.55, color: '#e2e2e2', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
  }),
  meta: (role) => ({ fontSize: '10px', color: '#444', marginTop: '3px', paddingLeft: role === 'user' ? 0 : '2px', paddingRight: role === 'user' ? '2px' : 0 }),
  systemMsg: { padding: '6px 12px', backgroundColor: '#0f1a0f', border: '1px solid #1a2a1a', borderRadius: '6px', fontSize: '12px', color: '#4ade80', marginBottom: '10px', fontFamily: 'monospace' },
  inputRow: { padding: '10px 14px', borderTop: '1px solid #1e1e1e', backgroundColor: '#111', flexShrink: 0 },
  inputWrap: { display: 'flex', gap: '8px', alignItems: 'flex-end' },
  textarea: { flex: 1, padding: '10px 12px', backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#e2e2e2', fontSize: '13px', resize: 'none', outline: 'none', fontFamily: 'inherit', lineHeight: 1.5, minHeight: '44px', maxHeight: '160px' },
  sendBtn: (disabled) => ({ padding: '10px 16px', backgroundColor: disabled ? '#2a2a2a' : '#7c6af7', border: 'none', borderRadius: '8px', color: disabled ? '#555' : '#fff', fontSize: '14px', cursor: disabled ? 'not-allowed' : 'pointer', alignSelf: 'flex-end', flexShrink: 0 }),
  stopBtn: { padding: '10px 14px', backgroundColor: 'transparent', border: '1px solid #ef444466', borderRadius: '8px', color: '#ef4444', fontSize: '12px', cursor: 'pointer', alignSelf: 'flex-end', flexShrink: 0 },
  empty: { height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '10px', color: '#444' },
};

export default function Chat({ projectName, messages, agentRunning, currentRunId, onSendGoal, onStop }) {
  const [provider, setProvider] = useState('claude');
  const [model, setModel]       = useState('claude-sonnet-4-6');
  const [search, setSearch]     = useState('ddg');
  const [input, setInput]       = useState('');
  const endRef = useRef(null);
  const taRef  = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const changeProvider = (p) => {
    setProvider(p);
    setModel(PROVIDERS[p]?.[0] || '');
  };

  const send = () => {
    const text = input.trim();
    if (!text || agentRunning) return;
    onSendGoal(text, `${provider}/${model}`, search);
    setInput('');
  };

  return (
    <div style={S.container}>
      {/* Toolbar */}
      <div style={S.toolbar}>
        <span style={S.label}>Model</span>
        <select style={S.sel} value={provider} onChange={e => changeProvider(e.target.value)}>
          {Object.keys(PROVIDERS).map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select style={S.sel} value={model} onChange={e => setModel(e.target.value)}>
          {(PROVIDERS[provider] || []).map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <span style={{ ...S.label, marginLeft: '8px' }}>Search</span>
        <select style={S.sel} value={search} onChange={e => setSearch(e.target.value)}>
          {SEARCH_PROVIDERS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      {/* Messages */}
      <div style={S.msgs}>
        {messages.length === 0 ? (
          <div style={S.empty}>
            <div style={{ fontSize: '32px' }}>⬡</div>
            <div style={{ fontSize: '15px', color: '#666', fontWeight: 600 }}>{projectName || 'No project selected'}</div>
            <div style={{ fontSize: '13px' }}>Describe what you want to build in plain English.</div>
            <div style={{ fontSize: '11px', color: '#444', marginTop: '4px' }}>getOpsCore.com</div>
          </div>
        ) : messages.map((m, i) => (
          m.role === 'system' ? (
            <div key={m.id || i} style={S.systemMsg}>{m.content}</div>
          ) : (
            <div key={m.id || i} style={S.bubble(m.role)}>
              <div style={S.bubbleInner(m.role)}>{m.content}</div>
              <div style={S.meta(m.role)}>
                {m.role === 'user' ? 'You' : 'Blackbird AI'} · {new Date(m.created_at || Date.now()).toLocaleTimeString()}
              </div>
            </div>
          )
        ))}
        {agentRunning && (
          <div style={S.bubble('assistant')}>
            <div style={{ ...S.bubbleInner('assistant'), color: '#7c6af7', fontStyle: 'italic' }}>
              ⬡ Working…
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div style={S.inputRow}>
        <div style={S.inputWrap}>
          <textarea
            ref={taRef}
            style={S.textarea}
            placeholder={agentRunning ? 'Agent is working…' : 'Describe what to build… (Enter to send, Shift+Enter for newline)'}
            value={input}
            disabled={agentRunning}
            onChange={e => {
              setInput(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px';
            }}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          />
          {agentRunning && currentRunId ? (
            <button style={S.stopBtn} onClick={() => onStop(currentRunId)}>■ Stop</button>
          ) : (
            <button style={S.sendBtn(!input.trim())} onClick={send} disabled={!input.trim()}>↑</button>
          )}
        </div>
      </div>
    </div>
  );
}
