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

const TYPE_COLOR = { leave: 'var(--blue)', promotion: 'var(--accent2)', payroll: 'var(--red)', attendance: 'var(--amber)', system: 'var(--text3)', ai: 'var(--purple)' };
const TYPE_ICON  = { leave: '🏖', promotion: '🎯', payroll: '💰', attendance: '📅', system: '⚙️', ai: '🤖' };

export default function Topbar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);

  const title   = PAGE_TITLES[pathname] || 'HRMS';
  const dateStr = new Date().toLocaleDateString('en-NG', { weekday:'short', day:'numeric', month:'short', year:'numeric' });

  const { data: notifData } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => auditAPI.getNotifications({ limit: 15 }).then(r => r.data),
    refetchInterval: 30000,
  });

  const markReadMutation = useMutation({
    mutationFn: (id) => auditAPI.markRead(id),
    onSuccess: () => qc.invalidateQueries(['notifications']),
  });

  const markAllMutation = useMutation({
    mutationFn: () => auditAPI.markAllRead(),
    onSuccess: () => qc.invalidateQueries(['notifications']),
  });

  // Close panel on outside click
  useEffect(() => {
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const notifications = notifData?.data || [];
  const unread = notifData?.unread || 0;

  return (
    <header style={{
      background: 'var(--surface)', borderBottom: '1px solid var(--border)',
      height: 'var(--topbar-h)', display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', padding: '0 24px', flexShrink: 0,
      position: 'sticky', top: 0, zIndex: 50, boxShadow: 'var(--shadow)',
    }}>
      <h1 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{title}</h1>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <span style={{ fontSize: 12, color: 'var(--text3)', fontFamily: 'var(--mono)', display: 'var(--hide-mobile, block)' }}>{dateStr}</span>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--accent-bg)', border: '1px solid var(--accent)', padding: '4px 10px', borderRadius: 8 }}>
          <FaMicrochip style={{ color: 'var(--accent)', fontSize: 12 }} />
          <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>AI Active</span>
        </div>

        {/* Notification Bell */}
        <div style={{ position: 'relative' }} ref={panelRef}>
          <button
            onClick={() => setOpen(o => !o)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)', fontSize: 22, padding: 4, position: 'relative', display: 'flex', alignItems: 'center' }}
          >
            <MdNotifications />
            {unread > 0 && (
              <span style={{
                position: 'absolute', top: 2, right: 2,
                width: 16, height: 16, borderRadius: '50%',
                background: 'var(--red)', color: '#fff',
                fontSize: 9, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{unread > 9 ? '9+' : unread}</span>
            )}
          </button>

          {/* Dropdown Panel */}
          {open && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 8px)', right: 0,
              width: 340, maxHeight: 480,
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)',
              display: 'flex', flexDirection: 'column', zIndex: 999,
              overflow: 'hidden',
            }}>
              {/* Header */}
              <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>Notifications</div>
                  {unread > 0 && <div style={{ fontSize: 11, color: 'var(--text3)' }}>{unread} unread</div>}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {unread > 0 && (
                    <button onClick={() => markAllMutation.mutate()} title="Mark all read"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent2)', fontSize: 18, padding: 2 }}>
                      <MdDoneAll />
                    </button>
                  )}
                  <button onClick={() => setOpen(false)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 18, padding: 2 }}>
                    <MdClose />
                  </button>
                </div>
              </div>

              {/* List */}
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
                      padding: '12px 16px', borderBottom: '1px solid var(--border)',
                      cursor: n.link ? 'pointer' : 'default',
                      background: n.read ? 'transparent' : 'var(--blue-bg)',
                      display: 'flex', gap: 10, alignItems: 'flex-start',
                    }}
                  >
                    <div style={{ fontSize: 20, flexShrink: 0, marginTop: 1 }}>{TYPE_ICON[n.type] || '🔔'}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: n.read ? 400 : 600, color: 'var(--text)' }}>{n.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>{n.message}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>
                        {format(new Date(n.createdAt), 'd MMM · HH:mm')}
                      </div>
                    </div>
                    {!n.read && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--blue)', flexShrink: 0, marginTop: 4 }} />}
                  </div>
                ))}
              </div>

              {/* Footer */}
              <button
                onClick={() => { navigate('/audit'); setOpen(false); }}
                style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--accent2)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center', fontFamily: 'var(--font)', width: '100%' }}
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
