import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  MdDashboard, MdPeople, MdEventAvailable, MdBeachAccess,
  MdTrendingUp, MdReceipt, MdBarChart, MdSettings, MdLogout,
  MdHistory, MdMenu, MdClose, MdChevronRight,
} from 'react-icons/md';
import { FaMicrochip } from 'react-icons/fa';

const NAV_GROUPS = [
  {
    group: 'Overview',
    items: [
      { to: '/',           label: 'Dashboard',   icon: MdDashboard },
    ],
  },
  {
    group: 'Staff',
    items: [
      { to: '/staff',      label: 'Staff Directory',  icon: MdPeople },
      { to: '/attendance', label: 'Attendance',        icon: MdEventAvailable },
    ],
  },
  {
    group: 'Workflows',
    items: [
      { to: '/leave',      label: 'Leave',       icon: MdBeachAccess },
      { to: '/promotion',  label: 'Promotions',  icon: MdTrendingUp },
    ],
  },
  {
    group: 'Finance',
    items: [
      { to: '/payroll',    label: 'Payroll',     icon: MdReceipt },
    ],
  },
  {
    group: 'System',
    items: [
      { to: '/reports',    label: 'Reports',     icon: MdBarChart },
      { to: '/audit',      label: 'Audit Log',   icon: MdHistory },
      { to: '/settings',   label: 'Settings',    icon: MdSettings },
    ],
  },
];

function useIsMobile() {
  const [mobile, setMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const h = () => setMobile(window.innerWidth < 768);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  return mobile;
}

// ─── Shared NavItem ────────────────────────────────────────────────────────────
function NavItem({ item, onClick }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      onClick={onClick}
      style={({ isActive }) => ({
        display: 'flex', alignItems: 'center', gap: 11,
        padding: '10px 18px', textDecoration: 'none',
        fontSize: 13.5, color: isActive ? '#fff' : 'rgba(255,255,255,.58)',
        background: isActive ? 'rgba(255,255,255,.10)' : 'transparent',
        borderLeft: `3px solid ${isActive ? '#6EC672' : 'transparent'}`,
        transition: 'all .15s',
        borderRadius: '0 6px 6px 0',
        marginRight: 6,
      })}
    >
      <Icon style={{ fontSize: 19, flexShrink: 0 }} />
      <span>{item.label}</span>
    </NavLink>
  );
}

// ─── Desktop Sidebar ──────────────────────────────────────────────────────────
function DesktopSidebar({ user, onLogout }) {
  const initials = user ? user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : 'U';
  return (
    <aside style={{
      width: 'var(--sidebar-w)', minHeight: '100vh', background: '#141210',
      display: 'flex', flexDirection: 'column', position: 'fixed',
      left: 0, top: 0, bottom: 0, zIndex: 100, overflowY: 'auto',
    }}>
      {/* Logo */}
      <div style={{ padding: '20px 18px 16px', borderBottom: '1px solid rgba(255,255,255,.07)', flexShrink: 0 }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'rgba(255,255,255,.32)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 4 }}>
          <FaMicrochip style={{ marginRight: 5 }} />UNIDEL · AI HRMS
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>StaffOS</div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,.28)', marginTop: 2 }}>University of Delta, Agbor</div>
      </div>

      {/* Nav groups */}
      <nav style={{ flex: 1, padding: '10px 0', overflowY: 'auto' }}>
        {NAV_GROUPS.map(g => (
          <div key={g.group} style={{ marginBottom: 4 }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,.22)', textTransform: 'uppercase', letterSpacing: '.1em', padding: '10px 18px 4px' }}>
              {g.group}
            </div>
            {g.items.map(item => <NavItem key={item.to} item={item} />)}
          </div>
        ))}
      </nav>

      {/* User footer */}
      <div style={{ padding: '12px 14px', borderTop: '1px solid rgba(255,255,255,.07)', display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0 }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0 }}>{initials}</div>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name}</div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,.33)', textTransform: 'capitalize' }}>{user?.role}</div>
        </div>
        <button onClick={onLogout} title="Logout" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.38)', fontSize: 19, padding: 4, display: 'flex' }}>
          <MdLogout />
        </button>
      </div>
    </aside>
  );
}

// ─── Mobile Hamburger Sidebar ─────────────────────────────────────────────────
function MobileSidebar({ user, onLogout }) {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const overlayRef = useRef(null);
  const initials = user ? user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : 'U';

  // Close on route change
  useEffect(() => { setOpen(false); }, [location.pathname]);

  // Prevent body scroll when open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  // Current page title
  const PAGE_TITLES = {
    '/': 'Dashboard', '/staff': 'Staff', '/attendance': 'Attendance',
    '/leave': 'Leave', '/promotion': 'Promotions', '/payroll': 'Payroll',
    '/reports': 'Reports', '/audit': 'Audit Log', '/settings': 'Settings',
  };
  const pageTitle = PAGE_TITLES[location.pathname] || 'HRMS';

  return (
    <>
      {/* Mobile Top Header Bar */}
      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200,
        background: '#141210', height: 54,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 14px', boxShadow: '0 2px 8px rgba(0,0,0,.3)',
      }}>
        {/* Hamburger */}
        <button
          onClick={() => setOpen(true)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 26, display: 'flex', alignItems: 'center', padding: 4 }}
          aria-label="Open menu"
        >
          <MdMenu />
        </button>

        {/* Logo + page title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <FaMicrochip style={{ color: '#6EC672', fontSize: 16 }} />
          <span style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>{pageTitle}</span>
        </div>

        {/* User avatar */}
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff' }}>
          {initials}
        </div>
      </header>

      {/* Overlay */}
      {open && (
        <div
          ref={overlayRef}
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 300,
            background: 'rgba(0,0,0,.55)',
            backdropFilter: 'blur(2px)',
            animation: 'fadeIn .18s ease',
          }}
        />
      )}

      {/* Drawer */}
      <div style={{
        position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 400,
        width: 280, background: '#141210',
        display: 'flex', flexDirection: 'column',
        transform: open ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform .25s cubic-bezier(.4,0,.2,1)',
        boxShadow: open ? '4px 0 24px rgba(0,0,0,.4)' : 'none',
        overflowY: 'auto',
      }}>
        {/* Drawer header */}
        <div style={{ padding: '16px 16px 14px', borderBottom: '1px solid rgba(255,255,255,.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'rgba(255,255,255,.32)', letterSpacing: '.1em', textTransform: 'uppercase' }}>
              <FaMicrochip style={{ marginRight: 4 }} />UNIDEL HRMS
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginTop: 2 }}>StaffOS</div>
          </div>
          <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.5)', fontSize: 22, display: 'flex', alignItems: 'center' }}>
            <MdClose />
          </button>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '10px 0', overflowY: 'auto' }}>
          {NAV_GROUPS.map(g => (
            <div key={g.group} style={{ marginBottom: 4 }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,.22)', textTransform: 'uppercase', letterSpacing: '.1em', padding: '10px 18px 4px' }}>
                {g.group}
              </div>
              {g.items.map(item => <NavItem key={item.to} item={item} onClick={() => setOpen(false)} />)}
            </div>
          ))}
        </nav>

        {/* User + Logout */}
        <div style={{ padding: '14px 16px', borderTop: '1px solid rgba(255,255,255,.07)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--accent2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff' }}>{initials}</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{user?.name}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', textTransform: 'capitalize' }}>{user?.role}</div>
            </div>
          </div>
          <button
            onClick={() => { setOpen(false); onLogout(); }}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center',
              background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)',
              borderRadius: 8, color: 'rgba(255,255,255,.7)', cursor: 'pointer',
              padding: '9px 0', fontSize: 13, fontFamily: 'var(--font)', fontWeight: 500,
            }}
          >
            <MdLogout /> Sign Out
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────
export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const handleLogout = () => { logout(); navigate('/login'); };

  return isMobile
    ? <MobileSidebar user={user} onLogout={handleLogout} />
    : <DesktopSidebar user={user} onLogout={handleLogout} />;
}
