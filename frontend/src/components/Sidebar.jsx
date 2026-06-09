import { NavLink } from 'react-router-dom';
import { useSocket } from '../context/SocketContext.jsx';

const navItems = [
  { label: 'Monitors', path: '/dashboard' },
  { label: 'Swarm', path: '/swarm' },
  { label: 'Agents', path: '/agents' },
  { label: 'VMs', path: '/vms' },
  { label: 'Orchestration', path: '/orchestration' },
  { label: 'Logs', path: '/logs' },
];

export default function Sidebar() {
  const { connected } = useSocket();

  return (
    <aside
      style={{
        width: '200px',
        minHeight: '100vh',
        backgroundColor: '#18181b',
        borderRight: '1px solid #27272a',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        position: 'sticky',
        top: 0,
        height: '100vh',
        overflow: 'hidden',
      }}
    >
      {/* Logo area */}
      <div
        style={{
          padding: '20px 16px 16px',
          borderBottom: '1px solid #27272a',
        }}
      >
        <span
          style={{
            fontSize: '13px',
            fontWeight: 600,
            color: '#6366f1',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          OpsCore
        </span>
      </div>

      {/* Nav links */}
      <nav
        style={{
          flex: 1,
          padding: '8px 0',
          overflowY: 'auto',
        }}
      >
        {navItems.map(({ label, path }) => (
          <NavLink
            key={path}
            to={path}
            end={path === '/dashboard'}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              padding: '9px 16px',
              color: isActive ? '#6366f1' : '#a1a1aa',
              backgroundColor: isActive ? 'rgba(99,102,241,0.1)' : 'transparent',
              borderLeft: isActive ? '2px solid #6366f1' : '2px solid transparent',
              textDecoration: 'none',
              fontSize: '14px',
              fontWeight: isActive ? 500 : 400,
              transition: 'color 0.15s, background-color 0.15s',
            })}
          >
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Connection status */}
      <div
        style={{
          padding: '12px 16px',
          borderTop: '1px solid #27272a',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <span
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: connected ? '#22c55e' : '#ef4444',
            flexShrink: 0,
            boxShadow: connected ? '0 0 6px #22c55e66' : '0 0 6px #ef444466',
          }}
        />
        <span
          style={{
            fontSize: '12px',
            color: '#a1a1aa',
          }}
        >
          {connected ? 'Live' : 'Offline'}
        </span>
      </div>
    </aside>
  );
}
