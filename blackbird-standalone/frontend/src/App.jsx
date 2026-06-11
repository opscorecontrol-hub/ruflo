import { useState, useEffect, useRef, useCallback } from 'react';
import { api, createWs } from './api.js';
import Sidebar from './components/Sidebar.jsx';
import Chat from './components/Chat.jsx';
import AgentStatus from './components/AgentStatus.jsx';
import Settings from './components/Settings.jsx';

const S = {
  root: { display: 'flex', height: '100vh', overflow: 'hidden' },
  main: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  topbar: { height: '38px', backgroundColor: '#0d0d0d', borderBottom: '1px solid #1e1e1e', display: 'flex', alignItems: 'center', padding: '0 14px', gap: '10px', flexShrink: 0 },
  topTitle: { fontSize: '12px', color: '#666', flex: 1 },
  settingsBtn: { padding: '4px 10px', backgroundColor: 'transparent', border: '1px solid #2a2a2a', borderRadius: '5px', color: '#888', fontSize: '12px', cursor: 'pointer' },
  center: { flex: 1, display: 'flex', overflow: 'hidden' },
  noProject: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '12px', color: '#444' },
};

function useWs(projectId, onEvent) {
  const wsRef = useRef(null);

  useEffect(() => {
    if (!projectId) return;
    const ws = createWs(projectId, onEvent);
    wsRef.current = ws;
    return () => ws.close();
  }, [projectId]);  // intentionally omit onEvent to avoid reconnect loops
}

export default function App() {
  const [projects, setProjects]     = useState([]);
  const [activeId, setActiveId]     = useState(null);
  const [messages, setMessages]     = useState([]);
  const [showSettings, setShowSettings] = useState(false);

  const [agentState, setAgentState] = useState({
    status: '',
    steps: [],
    files: [],
    currentRun: null,
  });
  const agentStateRef = useRef(agentState);
  agentStateRef.current = agentState;

  // Load projects on mount
  useEffect(() => {
    api.getProjects().then(setProjects).catch(console.error);
  }, []);

  // Load messages when project changes
  useEffect(() => {
    if (!activeId) { setMessages([]); return; }
    setAgentState({ status: '', steps: [], files: [], currentRun: null });
    api.getMessages(activeId).then(setMessages).catch(console.error);
  }, [activeId]);

  // WebSocket event handler
  const handleWsEvent = useCallback((event) => {
    const { type, ...data } = event;

    if (type === 'status') {
      setAgentState(prev => ({ ...prev, status: data.message }));
    }
    else if (type === 'plan') {
      setAgentState(prev => ({
        ...prev,
        steps: (data.steps || []).map(s => ({ ...s, status: 'pending', result: null })),
      }));
    }
    else if (type === 'step_status') {
      setAgentState(prev => ({
        ...prev,
        steps: prev.steps.map(s =>
          (s.id === data.step_id || s._db_id === data.id)
            ? { ...s, status: data.status, result: data.result ?? s.result }
            : s
        ),
      }));
    }
    else if (type === 'file') {
      setAgentState(prev => ({
        ...prev,
        files: prev.files.includes(data.path) ? prev.files : [...prev.files, data.path],
      }));
    }
    else if (type === 'done') {
      setAgentState(prev => ({
        ...prev,
        status: 'Done ✓',
        currentRun: prev.currentRun ? { ...prev.currentRun, status: 'done' } : null,
      }));
      if (data.summary) {
        const msg = { id: `ai-${Date.now()}`, role: 'assistant', content: data.summary, created_at: Date.now() };
        setMessages(prev => [...prev, msg]);
        if (activeId) api.sendMessage && void 0; // message already persisted server-side
      }
    }
    else if (type === 'error') {
      setAgentState(prev => ({
        ...prev,
        status: `Error: ${data.message}`,
        currentRun: prev.currentRun ? { ...prev.currentRun, status: 'error' } : null,
      }));
      const msg = { id: `err-${Date.now()}`, role: 'assistant', content: `⚠ ${data.message}`, created_at: Date.now() };
      setMessages(prev => [...prev, msg]);
    }
    else if (type === 'stopped') {
      setAgentState(prev => ({
        ...prev,
        status: 'Stopped',
        currentRun: prev.currentRun ? { ...prev.currentRun, status: 'stopped' } : null,
      }));
    }
  }, [activeId]);

  useWs(activeId, handleWsEvent);

  const handleCreateProject = async (name, desc) => {
    const project = await api.createProject(name, desc);
    setProjects(prev => [project, ...prev]);
    setActiveId(project.id);
  };

  const handleDeleteProject = async (id) => {
    await api.deleteProject(id);
    setProjects(prev => prev.filter(p => p.id !== id));
    if (activeId === id) setActiveId(null);
  };

  const handleSendGoal = async (goal, model, searchProvider) => {
    if (!activeId) return;
    // Add user message to UI immediately
    const userMsg = { id: `u-${Date.now()}`, role: 'user', content: goal, created_at: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    await api.sendMessage(activeId, goal);

    // Reset agent state
    setAgentState({ status: 'Starting…', steps: [], files: [], currentRun: { status: 'running' } });

    try {
      const result = await api.startRun(activeId, { goal, model, search_provider: searchProvider });
      setAgentState(prev => ({ ...prev, currentRun: { id: result.run_id, status: 'running' } }));
    } catch (err) {
      const msg = { id: `err-${Date.now()}`, role: 'assistant', content: `Failed to start: ${err.message}`, created_at: Date.now() };
      setMessages(prev => [...prev, msg]);
      setAgentState(prev => ({ ...prev, status: '', currentRun: null }));
    }
  };

  const handleStop = async (runId) => {
    await api.stopRun(runId);
    setAgentState(prev => ({ ...prev, status: 'Stopping…' }));
  };

  const activeProject = projects.find(p => p.id === activeId);
  const isRunning = agentState.currentRun?.status === 'running';

  return (
    <div style={S.root}>
      <Sidebar
        projects={projects}
        activeId={activeId}
        onSelect={setActiveId}
        onCreate={handleCreateProject}
        onDelete={handleDeleteProject}
      />

      <div style={S.main}>
        {/* Top bar */}
        <div style={S.topbar}>
          <span style={S.topTitle}>
            {activeProject ? `📁 ${activeProject.name}` : 'Blackbird 2030 — AI Software Engineer'}
          </span>
          <button style={S.settingsBtn} onClick={() => setShowSettings(true)}>⚙ Settings</button>
        </div>

        <div style={S.center}>
          {!activeId ? (
            <div style={S.noProject}>
              <div style={{ fontSize: '40px' }}>⬡</div>
              <div style={{ fontSize: '16px', color: '#666', fontWeight: 600 }}>Select or create a project</div>
              <div style={{ fontSize: '13px' }}>Use the sidebar to get started.</div>
              <div style={{ fontSize: '11px', color: '#3a3a3a', marginTop: '8px' }}>Blackbird 2030 · getOpsCore.com</div>
            </div>
          ) : (
            <>
              <Chat
                projectName={activeProject?.name}
                messages={messages}
                agentRunning={isRunning}
                currentRunId={agentState.currentRun?.id}
                onSendGoal={handleSendGoal}
                onStop={handleStop}
              />
              <AgentStatus agentState={agentState} />
            </>
          )}
        </div>
      </div>

      {showSettings && <Settings onClose={() => setShowSettings(false)} />}
    </div>
  );
}
