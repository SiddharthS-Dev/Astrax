import { useState } from 'react';
import { Layout } from './components/Layout';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './hooks/useAuth';

// Pages
import { LoginPage } from './pages/LoginPage';
import { ChangePasswordPage } from './pages/ChangePasswordPage';
import { CEOCockpit } from './pages/CEOCockpit';
import { ExperimentBacklog } from './pages/ExperimentBacklog';
import { TeamView } from './pages/TeamView';
import { ReportsPage } from './pages/ReportsPage';
import { PlaceholderModule } from './pages/PlaceholderModule';

import { LogOut } from 'lucide-react';

/**
 * Module router – maps sidebar IDs to page components.
 * Layout and Sidebar remain completely untouched.
 */
function ModuleRouter({ activeModule }: { activeModule: string }) {
  switch (activeModule) {
    case 'ceo-cockpit':
      return <CEOCockpit />;
    case 'experiment-backlog':
      return <ExperimentBacklog />;
    case 'pm-control':
      return <TeamView />;
    case 'docs-gateway':
      return <ReportsPage />;
    default:
      return <PlaceholderModule moduleId={activeModule} moduleName="" />;
  }
}

/**
 * Authenticated dashboard shell.
 * Handles the password-change intercept and renders the Layout + active module.
 */
function Dashboard() {
  const { isAuthenticated, isLoading, requiresPasswordChange, logout } = useAuth();
  const [activeModule, setActiveModule] = useState<string>('ceo-cockpit');

  // Loading state (hydrating JWT from localStorage)
  if (isLoading) {
    return (
      <div className="min-h-screen bg-dashboard-bg flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-neon-blue/30 border-t-neon-blue rounded-full animate-spin" />
      </div>
    );
  }

  // Not authenticated → show login
  if (!isAuthenticated) {
    return <LoginPage />;
  }

  // Authenticated but must change password first
  if (requiresPasswordChange) {
    return <ChangePasswordPage />;
  }

  // Fully authenticated → render dashboard
  return (
    <Layout activeModule={activeModule} setActiveModule={setActiveModule}>
      {/* Top-right user actions bar */}
      <div className="flex items-center justify-end mb-4">
        <button
          onClick={logout}
          className="flex items-center gap-2 text-gray-500 hover:text-red-400 bg-white/5 hover:bg-red-500/5 border border-white/10 hover:border-red-500/20 rounded-lg px-3 py-1.5 text-xs transition-all"
          title="Sign out"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign Out
        </button>
      </div>

      <ModuleRouter activeModule={activeModule} />
    </Layout>
  );
}

/**
 * App root – wraps everything in AuthProvider.
 */
function App() {
  return (
    <AuthProvider>
      <Dashboard />
    </AuthProvider>
  );
}

export default App;
