import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';

// Generate repo tree based on engagement config
function buildRepoTree(form) {
  const slug = (form.target || 'target').replace(/https?:\/\//, '').split('/')[0].replace(/[^a-z0-9.-]/gi, '-').toLowerCase();
  const type = form.test_type || 'web';

  const base = [
    { type: 'file', name: 'README.md', desc: 'Engagement overview, objectives & contacts' },
    { type: 'file', name: 'SCOPE.md', desc: `${form.scope ? 'Targets: ' + form.scope.slice(0, 40) : 'Rules of engagement & in-scope assets'}` },
    { type: 'file', name: 'RULES_OF_ENGAGEMENT.md', desc: 'Authorisation, constraints & emergency contacts' },
  ];

  const recon = {
    type: 'folder', name: '01-reconnaissance', children: [
      { type: 'file', name: 'passive-recon.md', desc: 'WHOIS, DNS records, certificate transparency, ASN' },
      { type: 'file', name: 'osint-findings.md', desc: 'LinkedIn exposure, leaked credentials, Shodan data' },
      { type: 'file', name: 'technology-stack.md', desc: 'Detected frameworks, CMS, CDN, third-party services' },
    ]
  };

  const scanning = {
    type: 'folder', name: '02-scanning', children: [
      { type: 'file', name: 'port-scan.txt', desc: 'nmap full-port scan output' },
      { type: 'file', name: 'service-enumeration.md', desc: 'Service versions, banners, TLS certificates' },
      { type: 'file', name: 'automated-vuln-scan.md', desc: 'Nuclei / OpenVAS / OWASP ZAP summary' },
    ]
  };

  const webSpecific = [
    { type: 'file', name: 'web-spider.txt', desc: 'Crawled endpoints, forms, JS files' },
    { type: 'file', name: 'authentication-analysis.md', desc: 'Login flows, session management, token analysis' },
    { type: 'file', name: 'input-validation.md', desc: 'XSS, SQLi, SSTI, file upload vectors' },
  ];

  const networkSpecific = [
    { type: 'file', name: 'network-topology.md', desc: 'Discovered hosts, subnets, routing' },
    { type: 'file', name: 'firewall-analysis.md', desc: 'ACL bypass attempts, NAT traversal' },
    { type: 'file', name: 'smb-ldap-enum.md', desc: 'AD enumeration, share access, user lists' },
  ];

  const apiSpecific = [
    { type: 'file', name: 'api-endpoints.md', desc: 'Discovered endpoints, methods, parameters' },
    { type: 'file', name: 'auth-bypass.md', desc: 'JWT analysis, OAuth flaws, IDOR testing' },
    { type: 'file', name: 'graphql-introspection.md', desc: 'Schema exposure, query depth attacks' },
  ];

  const cloudSpecific = [
    { type: 'file', name: 'iam-misconfiguration.md', desc: 'Overprivileged roles, unused permissions' },
    { type: 'file', name: 'storage-audit.md', desc: 'Public S3/GCS/Azure blobs, exposed data' },
    { type: 'file', name: 'secrets-exposure.md', desc: 'Hardcoded keys, leaked env vars, metadata endpoints' },
    { type: 'file', name: 'container-security.md', desc: 'K8s RBAC, privileged pods, image vulnerabilities' },
  ];

  const mobileSpecific = [
    { type: 'file', name: 'static-analysis.md', desc: 'APK/IPA reverse engineering, hardcoded secrets' },
    { type: 'file', name: 'traffic-interception.md', desc: 'Certificate pinning bypass, API traffic' },
    { type: 'file', name: 'local-storage-audit.md', desc: 'Insecure data storage, SQLite, shared prefs' },
  ];

  const redteamSpecific = [
    { type: 'file', name: 'initial-access.md', desc: 'Phishing, watering hole, supply chain vectors' },
    { type: 'file', name: 'persistence.md', desc: 'Backdoors, scheduled tasks, registry keys' },
    { type: 'file', name: 'c2-infrastructure.md', desc: 'C2 channels, beacon intervals, evasion' },
    { type: 'file', name: 'exfiltration-simulation.md', desc: 'Data staging, DNS tunnelling, HTTPS beaconing' },
  ];

  const typeExtra = {
    web: webSpecific, network: networkSpecific, api: apiSpecific,
    cloud: cloudSpecific, mobile: mobileSpecific, redteam: redteamSpecific
  }[type] || webSpecific;

  scanning.children.push(...typeExtra);

  const riskLabel = form.risk_level || 'medium';
  const findingCount = { critical: 3, high: 5, medium: 4, low: 6 }[riskLabel] || 4;
  const sampleFindings = [
    ['CRITICAL', 'Remote Code Execution via Deserialization'],
    ['HIGH', 'SQL Injection — Authentication Bypass'],
    ['HIGH', 'Broken Access Control — IDOR on User Data'],
    ['MEDIUM', 'Reflected Cross-Site Scripting (XSS)'],
    ['MEDIUM', 'Sensitive Data Exposure — Stack Traces'],
    ['LOW', 'Missing Security Headers (HSTS, CSP)'],
    ['INFO', 'Outdated Third-Party Libraries Detected'],
  ];

  const exploitation = {
    type: 'folder', name: '03-exploitation', children: [
      {
        type: 'folder', name: 'findings',
        children: sampleFindings.slice(0, findingCount).map(([sev, title], i) => ({
          type: 'file',
          name: `FINDING-${String(i + 1).padStart(3, '0')}.md`,
          desc: `[${sev}] ${title}`,
          severity: sev,
        }))
      },
      {
        type: 'folder', name: 'evidence',
        children: [
          { type: 'file', name: 'screenshots.md', desc: 'Redacted proof-of-concept screenshots' },
          { type: 'file', name: 'request-responses.txt', desc: 'HTTP request/response captures' },
        ]
      }
    ]
  };

  const postExploit = type === 'redteam' ? {
    type: 'folder', name: '04-post-exploitation', children: [
      { type: 'file', name: 'privilege-escalation.md', desc: 'Local/domain privilege escalation paths' },
      { type: 'file', name: 'lateral-movement.md', desc: 'Pass-the-hash, Kerberoasting, trust abuse' },
      { type: 'file', name: 'domain-compromise.md', desc: 'DA/EA access timeline & techniques used' },
    ]
  } : null;

  const reporting = {
    type: 'folder', name: type === 'redteam' ? '05-reporting' : '04-reporting', children: [
      { type: 'file', name: 'executive-summary.md', desc: 'Business risk narrative, risk rating overview' },
      { type: 'file', name: 'technical-report.md', desc: 'Full technical findings with CVSS scores' },
      { type: 'file', name: 'remediation-guide.md', desc: 'Prioritised fix recommendations per finding' },
      { type: 'file', name: 'retest-checklist.md', desc: 'Verification steps after fixes are applied' },
    ]
  };

  const github = {
    type: 'folder', name: '.github', children: [
      {
        type: 'folder', name: 'workflows', children: [
          { type: 'file', name: 'generate-report.yml', desc: 'CI: auto-build PDF report on push' },
          { type: 'file', name: 'finding-triage.yml', desc: 'CI: auto-label severity on new issues' },
        ]
      },
      {
        type: 'folder', name: 'ISSUE_TEMPLATE', children: [
          { type: 'file', name: 'finding.yml', desc: 'GitHub issue template: security finding' },
          { type: 'file', name: 'retest.yml', desc: 'GitHub issue template: retest request' },
        ]
      },
    ]
  };

  const tree = [
    {
      type: 'root', name: `pentest-${slug}`, children: [
        ...base,
        recon,
        scanning,
        exploitation,
        ...(postExploit ? [postExploit] : []),
        reporting,
        github,
      ]
    }
  ];

  return tree;
}

function sevColor(sev) {
  if (!sev) return null;
  if (sev === 'CRITICAL') return '#ef4444';
  if (sev === 'HIGH') return '#f97316';
  if (sev === 'MEDIUM') return '#eab308';
  if (sev === 'LOW') return '#22c55e';
  return '#71717a';
}

function TreeNode({ node, depth = 0 }) {
  const [open, setOpen] = useState(depth < 2);
  const indent = depth * 14;

  if (node.type === 'root') {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '3px 0', cursor: 'pointer' }} onClick={() => setOpen(!open)}>
          <span style={{ fontSize: '11px', color: '#555', width: '10px' }}>{open ? '▼' : '▶'}</span>
          <span style={{ fontSize: '14px' }}>📁</span>
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#6366f1', fontFamily: 'Consolas, monospace' }}>{node.name}/</span>
        </div>
        {open && node.children?.map((c, i) => <TreeNode key={i} node={c} depth={1} />)}
      </div>
    );
  }

  if (node.type === 'folder') {
    return (
      <div style={{ paddingLeft: indent }}>
        <div
          style={{ display: 'flex', alignItems: 'flex-start', gap: '5px', padding: '2px 0', cursor: 'pointer' }}
          onClick={() => setOpen(!open)}
        >
          <span style={{ fontSize: '10px', color: '#555', width: '10px', marginTop: '2px', flexShrink: 0 }}>{open ? '▼' : '▶'}</span>
          <span style={{ fontSize: '13px' }}>📂</span>
          <span style={{ fontSize: '11px', fontWeight: 600, color: '#d4d4d4', fontFamily: 'Consolas, monospace' }}>{node.name}/</span>
        </div>
        {open && node.children?.map((c, i) => <TreeNode key={i} node={c} depth={depth + 1} />)}
      </div>
    );
  }

  // file
  const color = sevColor(node.severity);
  return (
    <div style={{ paddingLeft: indent, display: 'flex', alignItems: 'flex-start', gap: '5px', padding: `2px 0 2px ${indent}px` }}>
      <span style={{ fontSize: '13px', flexShrink: 0 }}>📄</span>
      <div>
        <span style={{ fontSize: '11px', color: '#9cdcfe', fontFamily: 'Consolas, monospace' }}>{node.name}</span>
        {node.desc && (
          <span style={{ fontSize: '10px', color: color || '#555', marginLeft: '8px' }}>
            {node.desc}
          </span>
        )}
      </div>
    </div>
  );
}

const inputStyle = {
  width: '100%', padding: '8px 10px',
  backgroundColor: '#0a0a0f', border: '1px solid #27272a', borderRadius: '6px',
  color: '#e4e4e7', fontSize: '13px', outline: 'none', boxSizing: 'border-box',
};

const STATUS_COLOR = {
  scoping: '#6366f1', active: '#22c55e', reporting: '#eab308',
  completed: '#71717a', cancelled: '#ef4444',
};
const RISK_COLOR = { critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#22c55e' };

export default function EngagementPage() {
  const { fetchWithAuth } = useAuth();
  const [engagements, setEngagements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '', target: '', test_type: 'web', scope: '',
    out_of_scope: '', start_date: '', end_date: '', risk_level: 'medium',
  });

  const load = () => {
    fetchWithAuth('/saas/engagements')
      .then(r => r.ok ? r.json() : [])
      .then(d => setEngagements(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, [fetchWithAuth]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.target.trim()) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetchWithAuth('/saas/engagements', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to create'); return; }
      setShowForm(false);
      setForm({ name: '', target: '', test_type: 'web', scope: '', out_of_scope: '', start_date: '', end_date: '', risk_level: 'medium' });
      load();
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this engagement?')) return;
    await fetchWithAuth(`/saas/engagements/${id}`, { method: 'DELETE' });
    load();
  };

  const tree = buildRepoTree(form);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#e4e4e7', margin: 0 }}>
            Ethical Hacker Engagements
          </h1>
          <p style={{ color: '#71717a', fontSize: '13px', margin: '6px 0 0' }}>
            Commission structured penetration tests. Each engagement automatically provisions a GitHub repository with full deliverables.
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          style={{
            padding: '9px 20px', backgroundColor: showForm ? '#27272a' : '#6366f1',
            border: 'none', borderRadius: '6px', color: '#fff',
            fontSize: '13px', fontWeight: 600, cursor: 'pointer',
          }}
        >
          {showForm ? 'Cancel' : '+ New Engagement'}
        </button>
      </div>

      {/* Create form with live preview */}
      {showForm && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          {/* Left: Form */}
          <div style={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '10px', padding: '24px' }}>
            <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#e4e4e7', margin: '0 0 20px' }}>
              Engagement Configuration
            </h2>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 500, color: '#a1a1aa', display: 'block', marginBottom: '5px' }}>
                  Engagement Name *
                </label>
                <input
                  style={inputStyle} required
                  placeholder="e.g. Q2 2026 Web App Pentest"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 500, color: '#a1a1aa', display: 'block', marginBottom: '5px' }}>
                  Target *
                </label>
                <input
                  style={inputStyle} required
                  placeholder="https://app.example.com or 10.0.0.0/24"
                  value={form.target}
                  onChange={e => setForm(f => ({ ...f, target: e.target.value }))}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 500, color: '#a1a1aa', display: 'block', marginBottom: '5px' }}>
                    Test Type
                  </label>
                  <select
                    style={{ ...inputStyle }}
                    value={form.test_type}
                    onChange={e => setForm(f => ({ ...f, test_type: e.target.value }))}
                  >
                    <option value="web">Web Application</option>
                    <option value="network">Network / Infrastructure</option>
                    <option value="api">API / REST / GraphQL</option>
                    <option value="cloud">Cloud (AWS/GCP/Azure)</option>
                    <option value="mobile">Mobile (iOS/Android)</option>
                    <option value="redteam">Red Team / Full Scope</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 500, color: '#a1a1aa', display: 'block', marginBottom: '5px' }}>
                    Risk Estimate
                  </label>
                  <select
                    style={{ ...inputStyle }}
                    value={form.risk_level}
                    onChange={e => setForm(f => ({ ...f, risk_level: e.target.value }))}
                  >
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 500, color: '#a1a1aa', display: 'block', marginBottom: '5px' }}>
                  In-Scope Assets
                </label>
                <textarea
                  style={{ ...inputStyle, resize: 'vertical', minHeight: '64px', fontFamily: 'inherit', lineHeight: '1.4' }}
                  placeholder="List IPs, domains, or subnets in scope..."
                  value={form.scope}
                  onChange={e => setForm(f => ({ ...f, scope: e.target.value }))}
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 500, color: '#a1a1aa', display: 'block', marginBottom: '5px' }}>
                  Out of Scope
                </label>
                <textarea
                  style={{ ...inputStyle, resize: 'vertical', minHeight: '48px', fontFamily: 'inherit', lineHeight: '1.4' }}
                  placeholder="Excluded assets, third-party services..."
                  value={form.out_of_scope}
                  onChange={e => setForm(f => ({ ...f, out_of_scope: e.target.value }))}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 500, color: '#a1a1aa', display: 'block', marginBottom: '5px' }}>Start Date</label>
                  <input type="date" style={inputStyle} value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 500, color: '#a1a1aa', display: 'block', marginBottom: '5px' }}>End Date</label>
                  <input type="date" style={inputStyle} value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
                </div>
              </div>
              {error && <div style={{ color: '#ef4444', fontSize: '13px' }}>{error}</div>}
              <button
                type="submit" disabled={saving || !form.name.trim() || !form.target.trim()}
                style={{
                  padding: '10px', backgroundColor: '#6366f1', border: 'none',
                  borderRadius: '6px', color: '#fff', fontSize: '13px', fontWeight: 600,
                  cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1,
                }}
              >
                {saving ? 'Creating Engagement...' : 'Create Engagement & Provision Repository'}
              </button>
            </form>
          </div>

          {/* Right: Live GitHub repo preview */}
          <div style={{ backgroundColor: '#0d1117', border: '1px solid #30363d', borderRadius: '10px', overflow: 'hidden' }}>
            {/* GitHub-style header */}
            <div style={{
              backgroundColor: '#161b22', borderBottom: '1px solid #30363d',
              padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px',
            }}>
              <span style={{ fontSize: '16px' }}>🐙</span>
              <div>
                <div style={{ fontSize: '13px', color: '#58a6ff', fontWeight: 600 }}>
                  your-org /&nbsp;
                  <span style={{ color: '#79c0ff' }}>
                    {form.name
                      ? `pentest-${form.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30)}`
                      : 'pentest-engagement-name'
                    }
                  </span>
                </div>
                <div style={{ fontSize: '11px', color: '#8b949e', marginTop: '1px' }}>
                  Private · AI-provisioned repository · {form.test_type || 'web'} pentest
                </div>
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
                <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '20px', backgroundColor: '#21262d', color: '#8b949e', border: '1px solid #30363d' }}>Private</span>
                <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '20px', backgroundColor: '#6366f122', color: '#6366f1', border: '1px solid #6366f144' }}>AI Managed</span>
              </div>
            </div>

            {/* Live preview notice */}
            <div style={{
              padding: '8px 16px', backgroundColor: '#1c2128',
              borderBottom: '1px solid #30363d',
              fontSize: '11px', color: '#8b949e', display: 'flex', alignItems: 'center', gap: '6px',
            }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#22c55e', boxShadow: '0 0 4px #22c55e' }} />
              Live preview — repository structure updates as you fill in the form above
            </div>

            {/* File tree */}
            <div style={{
              padding: '12px 16px', overflowY: 'auto', maxHeight: '480px',
              fontFamily: 'Consolas, "SFMono-Regular", monospace',
            }}>
              {tree.map((node, i) => <TreeNode key={i} node={node} depth={0} />)}
            </div>

            {/* Footer stats */}
            <div style={{
              padding: '10px 16px', backgroundColor: '#161b22',
              borderTop: '1px solid #30363d', display: 'flex', gap: '16px',
            }}>
              {[
                ['📄', 'README', '1 file'],
                ['🔍', 'Findings', `${({ critical: 3, high: 5, medium: 4, low: 6 }[form.risk_level] || 4)} expected`],
                ['⚙️', 'CI/CD', '2 workflows'],
                ['📋', 'Templates', '2 issue templates'],
              ].map(([icon, label, val]) => (
                <div key={label} style={{ fontSize: '11px', color: '#8b949e' }}>
                  {icon} <span style={{ color: '#e6edf3' }}>{val}</span> {label}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Existing engagements */}
      {loading ? (
        <div style={{ color: '#71717a', padding: '24px', textAlign: 'center' }}>Loading engagements...</div>
      ) : engagements.length === 0 ? (
        <div style={{
          backgroundColor: '#18181b', border: '1px dashed #27272a', borderRadius: '10px',
          padding: '48px', textAlign: 'center',
        }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>🔐</div>
          <div style={{ fontSize: '15px', fontWeight: 600, color: '#e4e4e7', marginBottom: '6px' }}>
            No engagements yet
          </div>
          <div style={{ fontSize: '13px', color: '#71717a' }}>
            Create your first penetration test engagement above.
          </div>
        </div>
      ) : (
        <div>
          <h2 style={{ fontSize: '13px', fontWeight: 600, color: '#a1a1aa', margin: '0 0 14px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Active Engagements ({engagements.length})
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {engagements.map(eng => (
              <div key={eng.id} style={{
                backgroundColor: '#18181b', border: '1px solid #27272a',
                borderRadius: '8px', padding: '16px 20px',
                display: 'flex', alignItems: 'center', gap: '16px',
              }}>
                <span style={{ fontSize: '24px' }}>🔐</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#e4e4e7' }}>{eng.name}</div>
                  <div style={{ fontSize: '12px', color: '#71717a', marginTop: '2px' }}>
                    {eng.test_type} · {eng.target}
                    {eng.repo_slug && (
                      <span style={{ marginLeft: '8px', color: '#58a6ff', fontFamily: 'monospace', fontSize: '11px' }}>
                        🐙 {eng.repo_slug}
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
                  <span style={{
                    padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: 600,
                    backgroundColor: (RISK_COLOR[eng.risk_level] || '#71717a') + '22',
                    color: RISK_COLOR[eng.risk_level] || '#71717a',
                    border: `1px solid ${(RISK_COLOR[eng.risk_level] || '#71717a')}44`,
                    textTransform: 'uppercase',
                  }}>
                    {eng.risk_level}
                  </span>
                  <span style={{
                    padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: 600,
                    backgroundColor: (STATUS_COLOR[eng.status] || '#71717a') + '22',
                    color: STATUS_COLOR[eng.status] || '#71717a',
                    border: `1px solid ${(STATUS_COLOR[eng.status] || '#71717a')}44`,
                    textTransform: 'uppercase',
                  }}>
                    {eng.status}
                  </span>
                  <button
                    onClick={() => handleDelete(eng.id)}
                    style={{
                      padding: '4px 10px', backgroundColor: 'transparent',
                      border: '1px solid #ef444444', borderRadius: '4px',
                      color: '#ef4444', fontSize: '12px', cursor: 'pointer',
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
