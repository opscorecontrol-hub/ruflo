import { useState } from 'react';

const S = {
  sidebar: { width: '220px', flexShrink: 0, backgroundColor: '#141414', borderRight: '1px solid #222', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  header: { padding: '16px 14px 10px', borderBottom: '1px solid #1e1e1e' },
  logo: { fontSize: '14px', fontWeight: 700, color: '#7c6af7', letterSpacing: '0.02em', display: 'flex', alignItems: 'center', gap: '6px' },
  brand: { fontSize: '10px', color: '#555', letterSpacing: '0.04em', marginTop: '2px' },
  newBtn: { marginTop: '10px', width: '100%', padding: '7px', backgroundColor: '#7c6af7', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '12px', fontWeight: 600, cursor: 'pointer' },
  list: { flex: 1, overflowY: 'auto', padding: '6px' },
  item: (active) => ({
    padding: '8px 10px', borderRadius: '6px', cursor: 'pointer', marginBottom: '2px',
    backgroundColor: active ? '#1e1a3a' : 'transparent',
    border: active ? '1px solid #3d2f7a' : '1px solid transparent',
    transition: 'background .15s',
  }),
  itemName: { fontSize: '13px', color: '#e2e2e2', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  itemDesc: { fontSize: '11px', color: '#666', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  del: { background: 'none', border: 'none', color: '#555', fontSize: '14px', cursor: 'pointer', padding: '0 2px', float: 'right' },
  form: { padding: '10px', borderTop: '1px solid #1e1e1e' },
  inp: { width: '100%', padding: '6px 8px', backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '5px', color: '#e2e2e2', fontSize: '12px', outline: 'none', marginBottom: '6px' },
  formRow: { display: 'flex', gap: '6px' },
  saveBtn: { flex: 1, padding: '6px', backgroundColor: '#7c6af7', border: 'none', borderRadius: '5px', color: '#fff', fontSize: '12px', cursor: 'pointer' },
  cancelBtn: { flex: 1, padding: '6px', backgroundColor: 'transparent', border: '1px solid #333', borderRadius: '5px', color: '#888', fontSize: '12px', cursor: 'pointer' },
  empty: { padding: '20px 14px', color: '#555', fontSize: '12px', textAlign: 'center' },
};

export default function Sidebar({ projects, activeId, onSelect, onCreate, onDelete }) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');

  const submit = () => {
    if (!name.trim()) return;
    onCreate(name.trim(), desc.trim());
    setName(''); setDesc(''); setShowForm(false);
  };

  return (
    <div style={S.sidebar}>
      <div style={S.header}>
        <div style={S.logo}>
          <span>⬡</span> Blackbird 2030
        </div>
        <div style={S.brand}>by getOpsCore.com</div>
        <button style={S.newBtn} onClick={() => setShowForm(v => !v)}>
          {showForm ? '✕ Cancel' : '+ New Project'}
        </button>
      </div>

      {showForm && (
        <div style={S.form}>
          <input style={S.inp} placeholder="Project name" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} autoFocus />
          <input style={S.inp} placeholder="Description (optional)" value={desc} onChange={e => setDesc(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} />
          <div style={S.formRow}>
            <button style={S.saveBtn} onClick={submit}>Create</button>
            <button style={S.cancelBtn} onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div style={S.list}>
        {projects.length === 0 && !showForm && (
          <div style={S.empty}>No projects yet.<br />Create one to start.</div>
        )}
        {projects.map(p => (
          <div key={p.id} style={S.item(p.id === activeId)} onClick={() => onSelect(p.id)}>
            <button style={S.del} onClick={e => { e.stopPropagation(); onDelete(p.id); }} title="Delete">×</button>
            <div style={S.itemName}>{p.name}</div>
            {p.description && <div style={S.itemDesc}>{p.description}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
