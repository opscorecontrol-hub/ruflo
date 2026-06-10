import { useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function RegisterPage() {
  const { login } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  if (done) return <Navigate to="/dashboard" replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || data.error || 'Registration failed');
        return;
      }
      login(data.token, data.user);
      setDone(true);
    } catch {
      setError('Network error — please try again');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    backgroundColor: '#0a0a0f',
    border: '1px solid #27272a',
    borderRadius: '6px',
    color: '#e4e4e7',
    fontSize: '14px',
    outline: 'none',
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#0a0a0f',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      <div style={{ width: '100%', maxWidth: '380px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h1
            style={{
              fontSize: '24px',
              fontWeight: 700,
              color: '#e4e4e7',
              marginBottom: '8px',
            }}
          >
            Create account
          </h1>
          <p style={{ fontSize: '14px', color: '#a1a1aa' }}>
            Join Blackbird 2030
          </p>
        </div>

        <div
          style={{
            backgroundColor: '#18181b',
            border: '1px solid #27272a',
            borderRadius: '12px',
            padding: '28px',
          }}
        >
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '16px' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: '#e4e4e7',
                  marginBottom: '6px',
                }}
              >
                Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Your name"
                style={inputStyle}
                onFocus={(e) => { e.target.style.borderColor = '#6366f1'; }}
                onBlur={(e) => { e.target.style.borderColor = '#27272a'; }}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: '#e4e4e7',
                  marginBottom: '6px',
                }}
              >
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                style={inputStyle}
                onFocus={(e) => { e.target.style.borderColor = '#6366f1'; }}
                onBlur={(e) => { e.target.style.borderColor = '#27272a'; }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: '#e4e4e7',
                  marginBottom: '6px',
                }}
              >
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                minLength={8}
                style={inputStyle}
                onFocus={(e) => { e.target.style.borderColor = '#6366f1'; }}
                onBlur={(e) => { e.target.style.borderColor = '#27272a'; }}
              />
            </div>

            {error && (
              <div
                style={{
                  padding: '10px 12px',
                  backgroundColor: 'rgba(239,68,68,0.1)',
                  border: '1px solid rgba(239,68,68,0.3)',
                  borderRadius: '6px',
                  color: '#ef4444',
                  fontSize: '13px',
                  marginBottom: '16px',
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '10px',
                backgroundColor: loading ? '#4f52d4' : '#6366f1',
                border: 'none',
                borderRadius: '6px',
                color: '#fff',
                fontSize: '14px',
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? 'Creating account...' : 'Create account'}
            </button>
          </form>
        </div>

        <p
          style={{
            textAlign: 'center',
            fontSize: '13px',
            color: '#a1a1aa',
            marginTop: '20px',
          }}
        >
          Already have an account?{' '}
          <Link to="/login" style={{ color: '#6366f1' }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
