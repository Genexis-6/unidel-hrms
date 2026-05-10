import React, { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MdNotifications, MdClose, MdDoneAll, MdArrowForward } from 'react-icons/md';
import { FaMicrochip } from 'react-icons/fa';
import { auditAPI } from '../../services/api';
import { format } from 'date-fns';

const PAGE_TITLES = {
  '/':           'Dashboard Overview',
  '/staff':      'Staff Directory',
  '/attendance': 'Attendance Tracking',
  '/leave':      'Leave Management',
  '/promotion':  'Promotion Vetting',
  '/payroll':    'Payroll & Finance',
  '/reports':    'Reports & Analytics',
  '/audit':      'Audit Log',
  '/settings':   'System Settings',
};

const TYPE_ICON = {
  leave: '🏖', promotion: '🎯', payroll: '💰',
  attendance: '📅', system: '⚙️', ai: '🤖',
};

function useIsMobile() {
  const [mobile, setMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const h = () => setMobile(window.innerWidth < 768);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  return mobile;
}

export default function Topbar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);

  const title   = PAGE_TITLES[pathname] || 'HRMS';
  const dateStr = new Date().toLocaleDateString('en-NG', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

  const { data: notifData } = useQuery({
    queryKey: ['notifications'],
    queryFn:  () => auditAPI.getNotifications({ limit: 15 }).then(r => r.data),
    refetchInterval: 30000,
  });

  const markReadMutation = useMutation({
    mutationFn: (id) => auditAPI.markRead(id),
    onSuccess:  () => qc.invalidateQueries(['notifications']),
  });

  const markAllMutation = useMutation({
    mutationFn: () => auditAPI.markAllRead(),
    onSuccess:  () => qc.invalidateQueries(['notifications']),
  });

  // Close panel on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const notifications = notifData?.data  || [];
  const unread        = notifData?.unread || 0;

  // On mobile the header is rendered inside the MobileSidebar component,
  // so we only render the desktop topbar here.
  if (isMobile) return null;

  return (
    <header style={{
      background: 'var(--surface)', borderBottom: '1px solid var(--border)',
      height: 'var(--topbar-h)', display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', padding: '0 24px', flexShrink: 0,
      position: 'sticky', top: 0, zIndex: 50, boxShadow: 'var(--shadow)',
    }}>
      <h1 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{title}</h1>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <span style={{ fontSize: 12, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{dateStr}</span>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--accent-bg)', border: '1px solid var(--accent)', padding: '4px 10px', borderRadius: 8 }}>
          <FaMicrochip style={{ color: 'var(--accent)', fontSize: 12 }} />
          <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>AI Active</span>
        </div>

        {/* Notification Bell */}
        <div style={{ position: 'relative' }} ref={panelRef}>
          <button
            onClick={() => setOpen(o => !o)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text2)', fontSize: 22, padding: 4,
              position: 'relative', display: 'flex', alignItems: 'center',
              borderRadius: 8,
            }}
            aria-label="Notifications"
          >
            <MdNotifications />
            {unread > 0 && (
              <span style={{
                position: 'absolute', top: 1, right: 1,
                minWidth: 16, height: 16, borderRadius: 8,
                background: 'var(--red)', color: '#fff',
                fontSize: 9, fontWeight: 700, lineHeight: '16px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '0 3px',
              }}>{unread > 9 ? '9+' : unread}</span>
            )}
          </button>

          {/* Dropdown panel */}
          {open && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 8px)', right: 0,
              width: 340, maxHeight: 480,
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)', boxShadow: '0 8px 32px rgba(0,0,0,.14)',
              display: 'flex', flexDirection: 'column', zIndex: 999, overflow: 'hidden',
            }}>
              {/* Header */}
              <div style={{ padding: '13px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>Notifications</div>
                  {unread > 0 && <div style={{ fontSize: 11, color: 'var(--text3)' }}>{unread} unread</div>}
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {unread > 0 && (
                    <button
                      onClick={() => markAllMutation.mutate()}
                      title="Mark all read"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent2)', fontSize: 18, padding: 4, display: 'flex', borderRadius: 6 }}
                    >
                      <MdDoneAll />
                    </button>
                  )}
                  <button
                    onClick={() => setOpen(false)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 18, padding: 4, display: 'flex', borderRadius: 6 }}
                  >
                    <MdClose />
                  </button>
                </div>
              </div>

              {/* Notification list */}
              <div style={{ overflowY: 'auto', flex: 1 }}>
                {notifications.length === 0 ? (
                  <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
                    No notifications yet
                  </div>
                ) : notifications.map(n => (
                  <div
                    key={n._id}
                    onClick={() => {
                      markReadMutation.mutate(n._id);
                      if (n.link) { navigate(n.link); setOpen(false); }
                    }}
                    style={{
                      padding: '11px 16px', borderBottom: '1px solid var(--border2)',
                      cursor: n.link ? 'pointer' : 'default',
                      background: n.read ? 'transparent' : 'var(--blue-bg)',
                      display: 'flex', gap: 10, alignItems: 'flex-start',
                      transition: 'background .15s',
                    }}
                  >
                    <div style={{ fontSize: 19, flexShrink: 0, marginTop: 1 }}>{TYPE_ICON[n.type] || '🔔'}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: n.read ? 400 : 600, color: 'var(--text)', lineHeight: 1.4 }}>{n.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2, lineHeight: 1.4 }}>{n.message}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>
                        {format(new Date(n.createdAt), 'd MMM · HH:mm')}
                      </div>
                    </div>
                    {!n.read && (
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--blue)', flexShrink: 0, marginTop: 5 }} />
                    )}
                  </div>
                ))}
              </div>

              {/* Footer */}
              <button
                onClick={() => { navigate('/audit'); setOpen(false); }}
                style={{
                  padding: '10px 16px', borderTop: '1px solid var(--border)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 12, color: 'var(--accent2)', fontWeight: 500,
                  display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center',
                  fontFamily: 'var(--font)', width: '100%', flexShrink: 0,
                }}
              >
                View Audit Log <MdArrowForward />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
