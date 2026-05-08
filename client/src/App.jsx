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

const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-page"><div className="spinner"/><span>Loading HRMS…</span></div>;
  return user ? children : <Navigate to="/login" replace />;
};

const AppLayout = ({ children }) => (
  <div className="app-layout">
    <Sidebar />
    <div className="main-area">
      <Topbar />
      <main className="page-content" style={{ paddingBottom: 80 }}>{children}</main>
    </div>
  </div>
);

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Toaster position="top-right" toastOptions={{ duration: 3500, style: { fontFamily: 'DM Sans, sans-serif', fontSize: '13px' } }} />
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
