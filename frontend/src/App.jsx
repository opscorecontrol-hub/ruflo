import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { SocketProvider } from './context/SocketContext.jsx';
import AppLayout from './components/AppLayout.jsx';
import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import Dashboard from './pages/Dashboard.jsx';
import MonitorDetail from './pages/MonitorDetail.jsx';
import SwarmPage from './pages/SwarmPage.jsx';
import AgentsPage from './pages/AgentsPage.jsx';
import AgentDetail from './pages/AgentDetail.jsx';
import VMsPage from './pages/VMsPage.jsx';
import OrchestrationPage from './pages/OrchestrationPage.jsx';
import LogsPage from './pages/LogsPage.jsx';
import WorkspacePage from './pages/WorkspacePage.jsx';
import MarketplacePage from './pages/saas/MarketplacePage.jsx';
import TenantDashboard from './pages/saas/TenantDashboard.jsx';
import IAMPage from './pages/saas/IAMPage.jsx';
import PAMPage from './pages/saas/PAMPage.jsx';
import OperatorPage from './pages/saas/OperatorPage.jsx';
import EngagementPage from './pages/saas/EngagementPage.jsx';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0a0a0f',
          color: '#a1a1aa',
          fontSize: '14px',
        }}
      >
        Loading...
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0a0a0f',
          color: '#a1a1aa',
          fontSize: '14px',
        }}
      >
        Loading...
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={user ? <Navigate to="/dashboard" replace /> : <Landing />} />
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />
      <Route path="/register" element={user ? <Navigate to="/dashboard" replace /> : <RegisterPage />} />

      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/dashboard/monitor/:id" element={<MonitorDetail />} />
        <Route path="/swarm" element={<SwarmPage />} />
        <Route path="/agents" element={<AgentsPage />} />
        <Route path="/agents/:id" element={<AgentDetail />} />
        <Route path="/vms" element={<VMsPage />} />
        <Route path="/orchestration" element={<OrchestrationPage />} />
        <Route path="/logs" element={<LogsPage />} />
        <Route path="/workspace" element={<WorkspacePage />} />
        <Route path="/marketplace" element={<MarketplacePage />} />
        <Route path="/saas" element={<TenantDashboard />} />
        <Route path="/saas/iam" element={<IAMPage />} />
        <Route path="/saas/pam" element={<PAMPage />} />
        <Route path="/saas/operator" element={<OperatorPage />} />
        <Route path="/saas/engagements" element={<EngagementPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SocketProvider>
          <AppRoutes />
        </SocketProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
