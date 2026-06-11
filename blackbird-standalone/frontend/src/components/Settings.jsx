import { useState, useEffect } from 'react';
import { api } from '../api.js';

const S = {
  overlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal: { backgroundColor: '#141414', border: '1px solid #2a2a2a', borderRadius: '10px', width: '500px', maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' },
  header: { padding: '16px 20px', borderBottom: '1px solid #1e1e1e', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: '15px', fontWeight: 700, color: '#e2e2e2' },
  close: { background: 'none', border: 'none', color: '#666', fontSize: '18px', cursor: 'pointer' },
  body: { padding: '20px', overflowY: 'auto', flex: 1 },
  section: { marginBottom: '20px' },
  sectionTitle: { fontSize: '11px', fontWeight: 700, color: '#7c6af7', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '10px' },
  field: { marginBottom: '12px' },
  label: { display: 'block', fontSize: '12px', color: '#888', marginBottom: '4px' },
  inp: { width: '100%', padding: '8px 10px', backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '6px', color: '#e2e2e2', fontSize: '13px', outline: 'none', fontFamily: 'monospace' },
  footer: { padding: '14px 20px', borderTop: '1px solid #1e1e1e', display: 'flex', gap: '10px', justifyContent: 'flex-end' },
  saveBtn: { padding: '8px 18px', backgroundColor: '#7c6af7', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' },
  cancelBtn: { padding: '8px 18px', backgroundColor: 'transparent', border: '1px solid #333', borderRadius: '6px', color: '#888', fontSize: '13px', cursor: 'pointer' },
  saved: { fontSize: '12px', color: '#22c55e', alignSelf: 'center' },
};

const FIELDS = [
  { section: 'Claude (Anthropic)', key: 'anthropic_api_key', label: 'API Key', placeholder: 'sk-ant-...' },
  { section: 'OpenAI', key: 'openai_api_key', label: 'API Key', placeholder: 'sk-...' },
  { section: 'OpenAI', key: 'openai_base_url', label: 'Base URL (optional)', placeholder: 'https://api.openai.com/v1' },
  { section: 'Google Gemini', key: 'google_api_key', label: 'API Key', placeholder: 'AIza...' },
  { section: 'Mistral', key: 'mistral_api_key', label: 'API Key', placeholder: '' },
  { section: 'Groq', key: 'groq_api_key', label: 'API Key', placeholder: 'gsk_...' },
  { section: 'Ollama', key: 'ollama_endpoint', label: 'Endpoint URL', placeholder: 'http://localhost:11434/v1' },
  { section: 'Search', key: 'bing_api_key', label: 'Bing Search API Key (optional)', placeholder: '' },
];

export default function Settings({ onClose }) {
  const [values, setValues] = useState({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.getSettings().then(s => setValues(s || {})).catch(() => {});
  }, []);

  const set = (key, val) => setValues(prev => ({ ...prev, [key]: val }));

  const save = async () => {
    await api.saveSettings(values);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const sections = [...new Set(FIELDS.map(f => f.section))];

  return (
    <div style={S.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={S.modal}>
        <div style={S.header}>
          <span style={S.title}>⚙ Settings</span>
          <button style={S.close} onClick={onClose}>✕</button>
        </div>
        <div style={S.body}>
          {sections.map(section => (
            <div key={section} style={S.section}>
              <div style={S.sectionTitle}>{section}</div>
              {FIELDS.filter(f => f.section === section).map(f => (
                <div key={f.key} style={S.field}>
                  <label style={S.label}>{f.label}</label>
                  <input
                    type={f.key.endsWith('_key') ? 'password' : 'text'}
                    style={S.inp}
                    placeholder={f.placeholder}
                    value={values[f.key] || ''}
                    onChange={e => set(f.key, e.target.value)}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
        <div style={S.footer}>
          {saved && <span style={S.saved}>✓ Saved</span>}
          <button style={S.cancelBtn} onClick={onClose}>Close</button>
          <button style={S.saveBtn} onClick={save}>Save Settings</button>
        </div>
      </div>
    </div>
  );
}
