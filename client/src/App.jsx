import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import Sidebar from './components/layout/Sidebar';
import Topbar  from './components/layout/Topbar';
import LoginPage      from './pages/LoginPage';
import DashboardPage  from './pages/DashboardPage';
import StaffPage      from './pages/StaffPage';
import AttendancePage from './pages/AttendancePage';
import LeavePage      from './pages/LeavePage';
import PromotionPage  from './pages/PromotionPage';
import PayrollPage    from './pages/PayrollPage';
import ReportsPage    from './pages/ReportsPage';
import AuditPage      from './pages/AuditPage';
import SettingsPage   from './pages/SettingsPage';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30000, retry: 1 } },
});

function useIsMobile() {
  const [mobile, setMobile] = React.useState(window.innerWidth < 768);
  React.useEffect(() => {
    const h = () => setMobile(window.innerWidth < 768);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  return mobile;
}

const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:12, color:'var(--text3)', fontFamily:'var(--font)' }}>
      <div className="spinner" style={{ width:28, height:28 }}/>
      <span>Loading HRMS…</span>
    </div>
  );
  return user ? children : <Navigate to="/login" replace />;
};

const AppLayout = ({ children }) => {
  const isMobile = useIsMobile();
  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-area" style={{ marginLeft: isMobile ? 0 : 'var(--sidebar-w)' }}>
        <Topbar />
        {/* on mobile add paddingTop for fixed header bar */}
        <main className="page-content" style={{ paddingTop: isMobile ? 70 : 0 }}>
          {children}
        </main>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Toaster
            position="top-right"
            toastOptions={{ duration: 3500, style: { fontFamily: 'DM Sans, sans-serif', fontSize: '13px' } }}
          />
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/*" element={
              <PrivateRoute>
                <AppLayout>
                  <Routes>
                    <Route path="/"           element={<DashboardPage />} />
                    <Route path="/staff"      element={<StaffPage />} />
                    <Route path="/attendance" element={<AttendancePage />} />
                    <Route path="/leave"      element={<LeavePage />} />
                    <Route path="/promotion"  element={<PromotionPage />} />
                    <Route path="/payroll"    element={<PayrollPage />} />
                    <Route path="/reports"    element={<ReportsPage />} />
                    <Route path="/audit"      element={<AuditPage />} />
                    <Route path="/settings"   element={<SettingsPage />} />
                    <Route path="*"           element={<Navigate to="/" replace />} />
                  </Routes>
                </AppLayout>
              </PrivateRoute>
            } />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
