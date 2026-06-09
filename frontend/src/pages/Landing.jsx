import { useNavigate } from 'react-router-dom';

const features = [
  {
    title: 'Real-time Monitoring',
    desc: 'Track uptime, response times, and incidents across all your services with millisecond precision.',
  },
  {
    title: 'Agent Swarms',
    desc: 'Deploy and coordinate autonomous agent swarms that self-organize and scale to meet demand.',
  },
  {
    title: 'Auto-scaling VMs',
    desc: 'Provision and destroy cloud VMs automatically based on workload signals and agent demand.',
  },
  {
    title: 'Orchestration Engine',
    desc: 'Define pipelines and task queues that coordinate work across agents, VMs, and services.',
  },
];

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#0a0a0f',
        color: '#e4e4e7',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      {/* Nav */}
      <nav
        style={{
          width: '100%',
          maxWidth: '1100px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '20px 24px',
        }}
      >
        <span
          style={{
            fontSize: '18px',
            fontWeight: 700,
            color: '#6366f1',
            letterSpacing: '0.04em',
          }}
        >
          OpsCore
        </span>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={() => navigate('/login')}
            style={{
              padding: '8px 20px',
              backgroundColor: 'transparent',
              border: '1px solid #27272a',
              borderRadius: '6px',
              color: '#e4e4e7',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#6366f1'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#27272a'; }}
          >
            Login
          </button>
          <button
            onClick={() => navigate('/register')}
            style={{
              padding: '8px 20px',
              backgroundColor: '#6366f1',
              border: '1px solid #6366f1',
              borderRadius: '6px',
              color: '#fff',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#4f52d4'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#6366f1'; }}
          >
            Register
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section
        style={{
          maxWidth: '1100px',
          width: '100%',
          padding: '80px 24px 60px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            display: 'inline-block',
            padding: '4px 12px',
            backgroundColor: 'rgba(99,102,241,0.15)',
            borderRadius: '20px',
            border: '1px solid rgba(99,102,241,0.3)',
            fontSize: '12px',
            fontWeight: 500,
            color: '#6366f1',
            marginBottom: '24px',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}
        >
          Autonomous Agent Platform
        </div>
        <h1
          style={{
            fontSize: 'clamp(36px, 6vw, 64px)',
            fontWeight: 700,
            lineHeight: 1.1,
            marginBottom: '24px',
            letterSpacing: '-0.02em',
          }}
        >
          Blackbird{' '}
          <span
            style={{
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            2030
          </span>
        </h1>
        <p
          style={{
            fontSize: '18px',
            color: '#a1a1aa',
            maxWidth: '560px',
            margin: '0 auto 40px',
            lineHeight: 1.6,
          }}
        >
          Deploy autonomous agent swarms, monitor your infrastructure in real time,
          and orchestrate complex workflows — all from a single control plane.
        </p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => navigate('/register')}
            style={{
              padding: '12px 28px',
              backgroundColor: '#6366f1',
              border: 'none',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '15px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#4f52d4'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#6366f1'; }}
          >
            Get Started Free
          </button>
          <button
            onClick={() => navigate('/login')}
            style={{
              padding: '12px 28px',
              backgroundColor: 'transparent',
              border: '1px solid #27272a',
              borderRadius: '8px',
              color: '#e4e4e7',
              fontSize: '15px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#6366f1'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#27272a'; }}
          >
            Sign In
          </button>
        </div>
      </section>

      {/* Features */}
      <section
        style={{
          maxWidth: '1100px',
          width: '100%',
          padding: '60px 24px',
        }}
      >
        <h2
          style={{
            textAlign: 'center',
            fontSize: '24px',
            fontWeight: 600,
            marginBottom: '40px',
            color: '#e4e4e7',
          }}
        >
          Everything you need to operate at scale
        </h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '20px',
          }}
        >
          {features.map((f) => (
            <div
              key={f.title}
              style={{
                backgroundColor: '#18181b',
                border: '1px solid #27272a',
                borderRadius: '12px',
                padding: '24px',
              }}
            >
              <h3
                style={{
                  fontSize: '15px',
                  fontWeight: 600,
                  marginBottom: '10px',
                  color: '#e4e4e7',
                }}
              >
                {f.title}
              </h3>
              <p style={{ fontSize: '13px', color: '#a1a1aa', lineHeight: 1.6 }}>
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer
        style={{
          width: '100%',
          borderTop: '1px solid #27272a',
          padding: '24px',
          textAlign: 'center',
          color: '#a1a1aa',
          fontSize: '13px',
        }}
      >
        © 2030 OpsCore / Blackbird — Autonomous Agent Platform
      </footer>
    </div>
  );
}
