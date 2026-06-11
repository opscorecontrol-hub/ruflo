const BASE = '/api';

async function req(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(await res.text());
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  getProviders:       ()           => req('GET', '/providers'),
  getProjects:        ()           => req('GET', '/projects'),
  createProject:      (name, desc) => req('POST', '/projects', { name, description: desc }),
  deleteProject:      (id)         => req('DELETE', `/projects/${id}`),
  getMessages:        (pid)        => req('GET', `/projects/${pid}/messages`),
  sendMessage:        (pid, text)  => req('POST', `/projects/${pid}/messages`, { content: text, role: 'user' }),
  getFiles:           (pid)        => req('GET', `/projects/${pid}/files`),
  getFileContent:     (pid, path)  => req('GET', `/projects/${pid}/files/content?path=${encodeURIComponent(path)}`),
  startRun:           (pid, body)  => req('POST', `/projects/${pid}/run`, body),
  stopRun:            (runId)      => req('POST', `/runs/${runId}/stop`),
  getSettings:        ()           => req('GET', '/settings'),
  saveSettings:       (settings)   => req('POST', '/settings', { settings }),
};

export function createWs(projectId, onEvent) {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const ws = new WebSocket(`${proto}://${location.host}/ws/${projectId}`);
  ws.onmessage = (e) => {
    try { onEvent(JSON.parse(e.data)); } catch {}
  };
  const ping = setInterval(() => ws.readyState === 1 && ws.send('ping'), 20000);
  ws.onclose = () => clearInterval(ping);
  return ws;
}
