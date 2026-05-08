import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  MdDashboard, MdPeople, MdEventAvailable, MdBeachAccess,
  MdTrendingUp, MdReceipt, MdBarChart, MdSettings, MdLogout,
  MdHistory,
} from 'react-icons/md';
import { FaMicrochip } from 'react-icons/fa';

const NAV = [
  { to: '/',           label: 'Dashboard',  icon: MdDashboard,      group: 'Overview' },
  { to: '/staff',      label: 'Staff',      icon: MdPeople,         group: 'Staff' },
  { to: '/attendance', label: 'Attendance', icon: MdEventAvailable, group: 'Staff' },
  { to: '/leave',      label: 'Leave',      icon: MdBeachAccess,    group: 'Workflows' },
  { to: '/promotion',  label: 'Promotions', icon: MdTrendingUp,     group: 'Workflows' },
  { to: '/payroll',    label: 'Payroll',    icon: MdReceipt,        group: 'Finance' },
  { to: '/reports',    label: 'Reports',    icon: MdBarChart,       group: 'System' },
  { to: '/audit',      label: 'Audit Log',  icon: MdHistory,        group: 'System' },
  { to: '/settings',   label: 'Settings',   icon: MdSettings,       group: 'System' },
];

// Bottom nav items (mobile) — pick the 5 most important
const BOTTOM_NAV = [
  { to: '/',           label: 'Home',       icon: MdDashboard },
  { to: '/staff',      label: 'Staff',      icon: MdPeople },
  { to: '/attendance', label: 'Attend',     icon: MdEventAvailable },
  { to: '/leave',      label: 'Leave',      icon: MdBeachAccess },
  { to: '/promotion',  label: 'Promote',    icon: MdTrendingUp },
];

function useIsMobile() {
  const [mobile, setMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return mobile;
}

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();
  const isMobile  = useIsMobile();

  const handleLogout = () => { logout(); navigate('/login'); };
  const initials = user ? user.name.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase() : 'U';

  // ── MOBILE: Bottom Tab Bar ────────────────────────────────────────────────
  if (isMobile) {
    return (
      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 200,
        background: '#141210',
        borderTop: '1px solid rgba(255,255,255,.1)',
        display: 'flex', alignItems: 'stretch',
        height: 60, paddingBottom: 'env(safe-area-inset-bottom)',
      }}>
        {BOTTOM_NAV.map(item => {
          const active = item.to === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(item.to);
          const Icon = item.icon;
          return (
            <NavLink key={item.to} to={item.to}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 3,
                textDecoration: 'none', color: active ? '#6EC672' : 'rgba(255,255,255,.45)',
                fontSize: 10, fontFamily: 'var(--font)', fontWeight: 500,
                borderTop: active ? '2px solid #6EC672' : '2px solid transparent',
                paddingTop: 2,
              }}
            >
              <Icon style={{ fontSize: 22 }} />
              {item.label}
            </NavLink>
          );
        })}
      </nav>
    );
  }

  // ── DESKTOP: Side Nav ─────────────────────────────────────────────────────
  const groups = [...new Set(NAV.map(n => n.group))];

  return (
    <aside style={{
      width: 'var(--sidebar-w)', minHeight: '100vh', background: '#141210',
      display: 'flex', flexDirection: 'column', position: 'fixed',
      left: 0, top: 0, bottom: 0, zIndex: 100,
    }}>
      {/* Logo */}
      <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid rgba(255,255,255,.07)' }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'rgba(255,255,255,.35)', letterSpacing: '.1em', textTransform: 'uppercase' }}>
          <FaMicrochip style={{ marginRight: 4 }}/>UNIDEL · AI HRMS
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginTop: 3 }}>StaffOS</div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,.3)', marginTop: 1, lineHeight: 1.3 }}>University of Delta, Agbor</div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '10px 0', overflowY: 'auto' }}>
        {groups.map(group => (
          <div key={group}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,.25)', textTransform: 'uppercase', letterSpacing: '.1em', padding: '12px 16px 5px' }}>{group}</div>
            {NAV.filter(n => n.group === group).map(item => {
              const Icon = item.icon;
              return (
                <NavLink key={item.to} to={item.to} end={item.to === '/'}
                  style={({ isActive }) => ({
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '9px 16px', textDecoration: 'none',
                    fontSize: 13, color: isActive ? '#fff' : 'rgba(255,255,255,.55)',
                    background: isActive ? 'rgba(255,255,255,.09)' : 'transparent',
                    borderLeft: `2px solid ${isActive ? '#6EC672' : 'transparent'}`,
                    transition: 'all .15s',
                  })}
                >
                  <Icon style={{ fontSize: 17 }} /><span>{item.label}</span>
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>

      {/* User + Logout */}
      <div style={{ padding: '12px 14px', borderTop: '1px solid rgba(255,255,255,.07)', display: 'flex', alignItems: 'center', gap: 9 }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0 }}>{initials}</div>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name}</div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,.35)', textTransform: 'capitalize' }}>{user?.role}</div>
        </div>
        <button onClick={handleLogout} title="Logout" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.4)', fontSize: 18, padding: 4 }}><MdLogout /></button>
      </div>
    </aside>
  );
}
