import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { attendanceAPI, staffAPI, clockAPI } from '../services/api';
import { LoadingPage, EmptyState } from '../components/ui';
import {
  MdEventAvailable, MdWarning, MdCheckCircle, MdLogin, MdLogout,
  MdSchedule, MdPersonOff, MdAccessTime, MdRefresh, MdPeopleOutline,
  MdDoneAll, MdOutlinePending
} from 'react-icons/md';

const STATUS_OPTIONS = [
  { value: null, label: 'Unmarked', color: '#94a3b8', bg: '#f1f5f9' },
  { value: 'Present', label: 'Present', color: '#16a34a', bg: '#f0fdf4' },
  { value: 'Absent', label: 'Absent', color: '#dc2626', bg: '#fef2f2' },
  { value: 'Half-Day', label: 'Half-Day', color: '#d97706', bg: '#fffbeb' },
  { value: 'On-Leave', label: 'On-Leave', color: '#6d28d9', bg: '#faf5ff' },
];

export default function AttendancePage() {
  const qc = useQueryClient();
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [dept, setDept] = useState('');
  const [marks, setMarks] = useState({});
  const [times, setTimes] = useState({});
  const [clockStaff, setClockStaff] = useState('');
  const [showUnmarkedOnly, setShowUnmarkedOnly] = useState(false);

  const { data: staffData, isLoading: staffLoading } = useQuery({
    queryKey: ['staff-all', dept],
    queryFn: () => staffAPI.getAll({ limit: 100, department: dept || undefined }).then(r => r.data.data),
  });

  useQuery({
    queryKey: ['attendance', date, dept],
    queryFn: () => attendanceAPI.getAll({ date, department: dept || undefined }).then(r => r.data.data),
    onSuccess: (records) => {
      const m = {};
      const t = {};
      records.forEach(r => {
        if (r.staff?._id) {
          m[r.staff._id] = r.status;
          t[r.staff._id] = {
            checkIn: r.checkIn || '',
            checkOut: r.checkOut || '',
            clockedInAt: r.clockedInAt || null,
            clockedOutAt: r.clockedOutAt || null,
          };
        }
      });
      setMarks(m);
      setTimes(t);
    },
  });

  const { data: anomalies } = useQuery({
    queryKey: ['att-anomalies', date],
    queryFn: () => attendanceAPI.getAnomalies({ date }).then(r => r.data.data),
  });

  const markMutation = useMutation({
    mutationFn: (records) => attendanceAPI.mark(records),
    onSuccess: () => {
      qc.invalidateQueries(['attendance']);
      toast.success('Attendance saved.');
    },
    onError: () => toast.error('Failed to save attendance.'),
  });

  const clockInMutation = useMutation({
    mutationFn: (staffId) => clockAPI.clockIn(staffId),
    onMutate: async (staffId) => {
      await qc.cancelQueries(['attendance', date]);
      setTimes(prev => ({
        ...prev,
        [staffId]: {
          ...prev[staffId],
          checkIn: format(new Date(), 'HH:mm'),
          clockedInAt: new Date().toISOString(),
        },
      }));
      setMarks(prev => ({
        ...prev,
        [staffId]: prev[staffId] || 'Present',
      }));
      toast.success('Clocked in!', { duration: 2000 });
    },
    onError: (e, staffId) => {
      qc.invalidateQueries(['attendance', date]);
      toast.error(e.response?.data?.message || 'Clock-in failed.');
    },
    onSettled: () => {
      qc.invalidateQueries(['attendance', date]);
    },
  });

  const clockOutMutation = useMutation({
    mutationFn: (staffId) => clockAPI.clockOut(staffId),
    onMutate: async (staffId) => {
      await qc.cancelQueries(['attendance', date]);
      const now = new Date();
      setTimes(prev => ({
        ...prev,
        [staffId]: {
          ...prev[staffId],
          checkOut: format(now, 'HH:mm'),
          clockedOutAt: now.toISOString(),
        },
      }));
      const clockedIn = times[staffId]?.clockedInAt || times[staffId]?.checkIn;
      let hoursMsg = '';
      if (clockedIn) {
        const inTime = new Date(clockedIn.includes('T') ? clockedIn : `${date}T${clockedIn}:00`);
        const diff = (now - inTime) / (1000 * 60 * 60);
        if (diff > 0) hoursMsg = ` · ${diff.toFixed(1)}h worked`;
      }
      toast.success(`Clocked out!${hoursMsg}`, { duration: 2000 });
    },
    onError: (e, staffId) => {
      qc.invalidateQueries(['attendance', date]);
      toast.error(e.response?.data?.message || 'Clock-out failed.');
    },
    onSettled: () => {
      qc.invalidateQueries(['attendance', date]);
    },
  });

  const setAllStatus = (status) => {
    if (!staffData) return;
    const newMarks = { ...marks };
    staffData.forEach(s => { newMarks[s._id] = status; });
    setMarks(newMarks);
    toast.success(`All set to "${status || 'Unmarked'}"`);
  };

  const handleSave = () => {
    if (!staffData) return;
    const unmarked = staffData.filter(s => !marks[s._id]);
    if (unmarked.length > 0 && !window.confirm(`${unmarked.length} staff members are unmarked. Save anyway?`)) {
      return;
    }
    const records = staffData.map(s => ({
      staff: s._id,
      date,
      status: marks[s._id] || null,
      checkIn: times[s._id]?.checkIn || null,
      checkOut: times[s._id]?.checkOut || null,
    }));
    markMutation.mutate(records);
  };

  const stats = useMemo(() => {
    if (!staffData) return { present: 0, absent: 0, half: 0, onLeave: 0, unmarked: 0, total: 0 };
    const present = Object.values(marks).filter(v => v === 'Present').length;
    const absent = Object.values(marks).filter(v => v === 'Absent').length;
    const half = Object.values(marks).filter(v => v === 'Half-Day').length;
    const onLeave = Object.values(marks).filter(v => v === 'On-Leave').length;
    const unmarked = staffData.length - present - absent - half - onLeave;
    return { present, absent, half, onLeave, unmarked, total: staffData.length };
  }, [marks, staffData]);

  const displayStaff = useMemo(() => {
    if (!staffData) return [];
    if (showUnmarkedOnly) return staffData.filter(s => !marks[s._id] || marks[s._id] === null);
    return staffData;
  }, [staffData, showUnmarkedOnly, marks]);

  const getStatusInfo = (status) => {
    return STATUS_OPTIONS.find(o => o.value === status) || STATUS_OPTIONS[0];
  };

  const isLoading = staffLoading;

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1>Attendance Tracking</h1>
          <p>Mark daily attendance and manage clock-ins</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-ghost"
            onClick={() => { qc.invalidateQueries(['attendance', date]); toast.success('Refreshed!'); }}
            title="Refresh data"
          >
            <MdRefresh /> Refresh
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={markMutation.isPending}
          >
            {markMutation.isPending ? 'Saving…' : <><MdDoneAll /> Save Attendance</>}
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="stats-row">
        <div className="stat-card">
          <MdPeopleOutline className="stat-icon" style={{ color: '#6366f1' }} />
          <div className="stat-value">{stats.total}</div>
          <div className="stat-label">Total</div>
        </div>
        <div className="stat-card">
          <MdEventAvailable className="stat-icon" style={{ color: '#16a34a' }} />
          <div className="stat-value">{stats.present}</div>
          <div className="stat-label">Present</div>
        </div>
        <div className="stat-card">
          <MdPersonOff className="stat-icon" style={{ color: '#dc2626' }} />
          <div className="stat-value">{stats.absent}</div>
          <div className="stat-label">Absent</div>
        </div>
        <div className="stat-card">
          <MdAccessTime className="stat-icon" style={{ color: '#d97706' }} />
          <div className="stat-value">{stats.half}</div>
          <div className="stat-label">Half-Day</div>
        </div>
        <div className="stat-card">
          <MdSchedule className="stat-icon" style={{ color: '#7c3aed' }} />
          <div className="stat-value">{stats.onLeave}</div>
          <div className="stat-label">On Leave</div>
        </div>
        <div className="stat-card">
          <MdOutlinePending className="stat-icon" style={{ color: '#94a3b8' }} />
          <div className="stat-value">{stats.unmarked}</div>
          <div className="stat-label">Unmarked</div>
        </div>
      </div>

      {/* Quick Clock Panel */}
      <div className="card" style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #eff6ff 100%)', marginBottom: 16 }}>
        <div className="card-header">
          <div className="card-title"><MdLogin style={{ color: '#16a34a', marginRight: 6 }} /> Quick Clock In / Out</div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <select
            className="form-input"
            value={clockStaff}
            onChange={e => setClockStaff(e.target.value)}
            style={{ flex: 1, minWidth: 200 }}
          >
            <option value="">— Select staff member —</option>
            {(staffData || []).map(s => (
              <option key={s._id} value={s._id}>{s.firstName} {s.lastName} ({s.department || 'N/A'})</option>
            ))}
          </select>
          <button
            className="btn btn-primary"
            onClick={() => {
              if (!clockStaff) return toast.error('Please select a staff member.');
              clockInMutation.mutate(clockStaff);
            }}
            disabled={clockInMutation.isPending || !clockStaff}
          >
            <MdLogin /> Clock In
          </button>
          <button
            className="btn btn-ghost"
            style={{ border: '1px solid var(--accent)' }}
            onClick={() => {
              if (!clockStaff) return toast.error('Please select a staff member.');
              clockOutMutation.mutate(clockStaff);
            }}
            disabled={clockOutMutation.isPending || !clockStaff}
          >
            <MdLogout /> Clock Out
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--text3)', fontWeight: 600 }}>Date</label>
          <input className="form-input" type="date" value={date} onChange={e => setDate(e.target.value)} style={{ width: 140 }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--text3)', fontWeight: 600 }}>Department</label>
          <select className="form-input" value={dept} onChange={e => setDept(e.target.value)} style={{ width: 160 }}>
            <option value="">All Departments</option>
            {['Computer Science', 'Engineering', 'Medicine', 'Registry', 'Bursary', 'Library', 'ICT'].map(d => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--text3)', fontWeight: 600 }}>Quick Set</label>
          <div style={{ display: 'flex', gap: 4 }}>
            <button className="btn btn-sm btn-ghost" onClick={() => setAllStatus('Present')}>All Present</button>
            <button className="btn btn-sm btn-ghost" onClick={() => setAllStatus('Absent')}>All Absent</button>
            <button className="btn btn-sm btn-ghost" onClick={() => setAllStatus(null)}>Clear All</button>
          </div>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer', marginBottom: 8 }}>
          <input type="checkbox" checked={showUnmarkedOnly} onChange={e => setShowUnmarkedOnly(e.target.checked)} />
          Show unmarked only
        </label>
      </div>

      {/* Main Grid */}
      <div className="grid2">
        {/* Attendance Table */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="card-header">
            <div>
              <div className="card-title">{format(new Date(date + 'T12:00:00'), 'EEEE, d MMMM yyyy')}</div>
            </div>
            <span className="badge">{displayStaff.length} staff</span>
          </div>
          {isLoading ? (
            <LoadingPage />
          ) : (
            <div className="table-wrap" style={{ maxHeight: 500, overflowY: 'auto', overflowX: 'auto' }}>
              <table style={{ minWidth: 650, tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={{ width: '35%' }} />
                  <col style={{ width: '22%' }} />
                  <col style={{ width: '16%' }} />
                  <col style={{ width: '16%' }} />
                  <col style={{ width: '11%' }} />
                </colgroup>
                <thead>
                  <tr>
                    <th>Staff Member</th>
                    <th>Status</th>
                    <th>In</th>
                    <th>Out</th>
                    <th style={{ textAlign: 'center' }}>Act</th>
                  </tr>
                </thead>
                <tbody>
                  {displayStaff.map(s => {
                    const statusInfo = getStatusInfo(marks[s._id]);
                    const isUnmarked = !marks[s._id];
                    return (
                      <tr
                        key={s._id}
                        style={{
                          borderLeft: `3px solid ${statusInfo.color}`,
                          background: isUnmarked ? undefined : statusInfo.bg,
                        }}
                      >
                        <td style={{ overflow: 'hidden' }}>
                          <div style={{ fontWeight: 500, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {s.firstName} {s.lastName}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {s.department || 'N/A'}
                          </div>
                          {isUnmarked && (
                            <span style={{
                              display: 'inline-block', fontSize: 10, background: '#fef3c7', color: '#92400e',
                              padding: '1px 5px', borderRadius: 3, marginTop: 1
                            }}>⚠️</span>
                          )}
                        </td>
                        <td>
                          <select
                            className="form-input"
                            style={{
                              padding: '4px 4px', fontSize: 11, width: '100%',
                              borderColor: statusInfo.color, backgroundColor: statusInfo.bg
                            }}
                            value={marks[s._id] || ''}
                            onChange={e => setMarks(m => ({ ...m, [s._id]: e.target.value || null }))}
                          >
                            {STATUS_OPTIONS.map(o => (
                              <option key={o.value || 'unmarked'} value={o.value || ''}>{o.label}</option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input
                            type="time"
                            className="form-input"
                            style={{
                              padding: '4px 4px', fontSize: 11, width: '100%',
                              background: times[s._id]?.clockedInAt ? '#f0fdf4' : undefined,
                              color: times[s._id]?.clockedInAt ? '#16a34a' : undefined,
                              fontWeight: times[s._id]?.clockedInAt ? 600 : undefined
                            }}
                            value={times[s._id]?.checkIn || ''}
                            onChange={e => setTimes(t => ({ ...t, [s._id]: { ...t[s._id], checkIn: e.target.value } }))}
                            disabled={!!times[s._id]?.clockedInAt}
                          />
                        </td>
                        <td>
                          <input
                            type="time"
                            className="form-input"
                            style={{
                              padding: '4px 4px', fontSize: 11, width: '100%',
                              background: times[s._id]?.clockedOutAt ? '#eef2ff' : undefined,
                              color: times[s._id]?.clockedOutAt ? '#6366f1' : undefined,
                              fontWeight: times[s._id]?.clockedOutAt ? 600 : undefined
                            }}
                            value={times[s._id]?.checkOut || ''}
                            onChange={e => setTimes(t => ({ ...t, [s._id]: { ...t[s._id], checkOut: e.target.value } }))}
                            disabled={!!times[s._id]?.clockedOutAt}
                          />
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
                            <button
                              className="btn btn-sm btn-ghost"
                              onClick={() => clockInMutation.mutate(s._id)}
                              disabled={clockInMutation.isPending}
                              title="Clock In"
                              style={{ padding: '3px 5px', minWidth: 28 }}
                            >
                              <MdLogin size={14} />
                            </button>
                            <button
                              className="btn btn-sm btn-ghost"
                              onClick={() => clockOutMutation.mutate(s._id)}
                              disabled={clockOutMutation.isPending}
                              title="Clock Out"
                              style={{ padding: '3px 5px', minWidth: 28 }}
                            >
                              <MdLogout size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {displayStaff.length === 0 && (
                    <tr>
                      <td colSpan={5}>
                        <EmptyState message={showUnmarkedOnly ? "All staff marked! 🎉" : "No staff found."} />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Anomalies Panel */}
        <div>
          <div className="card">
            <div className="card-header">
              <div className="card-title"><MdWarning style={{ color: '#dc2626', marginRight: 6 }} /> Anomaly Alerts</div>
              <span className={`badge ${(anomalies || []).length > 0 ? 'badge-warning' : 'badge-success'}`}>
                {(anomalies || []).length} flagged
              </span>
            </div>
            {(anomalies || []).length === 0 ? (
              <EmptyState message="No anomalies detected." icon={<MdCheckCircle style={{ color: '#16a34a' }} />} />
            ) : (
              (anomalies || []).slice(0, 10).map(a => (
                <div key={a._id} style={{ padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#dc2626' }}>{a.flagReason}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                    {a.staff?.firstName} {a.staff?.lastName} · {a.staff?.department}
                  </div>
                  {a.date && (
                    <div style={{ fontSize: 10, color: 'var(--text3)' }}>
                      {format(new Date(a.date), 'MMM d, yyyy')}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}