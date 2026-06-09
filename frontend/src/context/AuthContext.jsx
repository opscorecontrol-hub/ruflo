import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const API_BASE = '/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('opscore_token'));
  const [loading, setLoading] = useState(true);

  const fetchWithAuth = useCallback(async (url, opts = {}) => {
    const currentToken = localStorage.getItem('opscore_token');
    const headers = {
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    };
    if (currentToken) {
      headers['Authorization'] = `Bearer ${currentToken}`;
    }
    return fetch(`${API_BASE}${url}`, { ...opts, headers });
  }, []);

  const login = useCallback((newToken, newUser) => {
    localStorage.setItem('opscore_token', newToken);
    localStorage.setItem('opscore_user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('opscore_token');
    localStorage.removeItem('opscore_user');
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    const restoreSession = async () => {
      const storedToken = localStorage.getItem('opscore_token');
      if (!storedToken) {
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(`${API_BASE}/auth/me`, {
          headers: {
            'Authorization': `Bearer ${storedToken}`,
            'Content-Type': 'application/json',
          },
        });
        if (res.ok) {
          const data = await res.json();
          setUser(data.user || data);
          setToken(storedToken);
        } else {
          localStorage.removeItem('opscore_token');
          localStorage.removeItem('opscore_user');
          setToken(null);
          setUser(null);
        }
      } catch {
        // Network error — keep token but don't verify
        const storedUser = localStorage.getItem('opscore_user');
        if (storedUser) {
          try {
            setUser(JSON.parse(storedUser));
          } catch {
            // ignore parse error
          }
        }
      } finally {
        setLoading(false);
      }
    };
    restoreSession();
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, fetchWithAuth, API_BASE }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
