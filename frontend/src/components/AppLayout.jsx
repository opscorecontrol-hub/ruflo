import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import Sidebar from './Sidebar.jsx';

export default function AppLayout() {
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        width: '100%',
        overflow: 'hidden',
        backgroundColor: '#0a0a0f',
      }}
    >
      <Sidebar />

      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <header
          style={{
            height: '52px',
            backgroundColor: '#18181b',
            borderBottom: '1px solid #27272a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 24px',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontSize: '16px',
              fontWeight: 600,
              color: '#e4e4e7',
              letterSpacing: '0.02em',
            }}
          >
            Blackbird 2030
          </span>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
            }}
          >
            {user && (
              <span
                style={{
                  fontSize: '13px',
                  color: '#a1a1aa',
                }}
              >
                {user.email || user.name || 'User'}
              </span>
            )}
            <button
              onClick={handleLogout}
              style={{
                padding: '6px 14px',
                backgroundColor: 'transparent',
                border: '1px solid #27272a',
                borderRadius: '6px',
                color: '#a1a1aa',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'border-color 0.15s, color 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#ef4444';
                e.currentTarget.style.color = '#ef4444';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#27272a';
                e.currentTarget.style.color = '#a1a1aa';
              }}
            >
              Logout
            </button>
          </div>
        </header>

        {/* Main content */}
        <main
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '24px',
          }}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
