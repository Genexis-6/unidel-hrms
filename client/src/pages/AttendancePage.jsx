import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { attendanceAPI, staffAPI, clockAPI } from '../services/api';
import { LoadingPage, EmptyState, Modal } from '../components/ui';
import {
  MdEventAvailable, MdWarning, MdCheckCircle, MdLogin, MdLogout,
  MdSchedule, MdPersonOff, MdAccessTime, MdRefresh, MdPeopleOutline,
  MdDoneAll, MdHourglassEmpty, MdHistory,
} from 'react-icons/md';

const STATUS_OPTIONS = [
  { value: '',         label: 'Unmarked',  color: '#94a3b8', bg: '#f1f5f9' },
  { value: 'Present',  label: 'Present',   color: '#16a34a', bg: '#f0fdf4' },
  { value: 'Absent',   label: 'Absent',    color: '#dc2626', bg: '#fef2f2' },
  { value: 'Half-Day', label: 'Half-Day',  color: '#d97706', bg: '#fffbeb' },
  { value: 'On-Leave', label: 'On-Leave',  color: '#6d28d9', bg: '#faf5ff' },
];

const fmtMins = (m) => {
  if (!m) return '—';
  const h = Math.floor(m / 60), min = m % 60;
  return h > 0 ? `${h}h ${min}m` : `${min}m`;
};

export default function AttendancePage() {
  const qc = useQueryClient();
  const [date, setDate]           = useState(format(new Date(), 'yyyy-MM-dd'));
  const [dept, setDept]           = useState('');
  const [marks, setMarks]         = useState({});
  const [times, setTimes]         = useState({});
  const [clockStaff, setClockStaff]   = useState('');
  const [showUnmarkedOnly, setShowUnmarkedOnly] = useState(false);
  const [clockHistoryStaff, setClockHistoryStaff] = useState(null);

  const hydratedKey = useRef('');

  // ── Staff list ──────────────────────────────────────────────────────────────
  const { data: staffData, isLoading: staffLoading } = useQuery({
    queryKey: ['staff-all', dept],
    queryFn: () => staffAPI.getAll({ limit: 100, department: dept || undefined }).then(r => r.data.data),
  });

  // ── Attendance records for selected date ────────────────────────────────────
  const { data: attRecords } = useQuery({
    queryKey: ['attendance', date, dept],
    queryFn:  () => attendanceAPI.getAll({ date, department: dept || undefined }).then(r => r.data.data),
    refetchInterval: 60000,
    staleTime: 30000,
  });

  // ── Hydrate marks/times from server data ──────────────────────────────────
  useEffect(() => {
    if (!attRecords) return;
    const currentKey = `${date}__${dept}`;

    const m = {}, t = {};
    attRecords.forEach(r => {
      if (!r.staff?._id) return;
      const sid = r.staff._id;
      m[sid] = r.status || '';
      t[sid] = {
        checkIn:       r.checkIn             || '',
        checkOut:      r.checkOut            || '',
        clockInCount:  r.clockInCount        || 0,
        clockOutCount: r.clockOutCount       || 0,
        totalMinutes:  r.totalMinutesWorked  || 0,
        clockEvents:   r.clockEvents         || [],
      };
    });

    if (hydratedKey.current !== currentKey) {
      hydratedKey.current = currentKey;
      setMarks(m);
      setTimes(t);
    } else {
      setMarks(prev => {
        const merged = { ...prev };
        Object.entries(m).forEach(([sid, status]) => {
          if (status) merged[sid] = status;
        });
        return merged;
      });
      setTimes(prev => {
        const merged = { ...prev };
        Object.entries(t).forEach(([sid, serverT]) => {
          const localT = prev[sid] || {};
          if ((serverT.clockInCount || 0) >= (localT.clockInCount || 0)) {
            merged[sid] = serverT;
          }
        });
        return merged;
      });
    }
  }, [attRecords, date, dept]);

  const handleDateChange = (v) => {
    hydratedKey.current = '';
    setDate(v);
  };
  const handleDeptChange = (v) => {
    hydratedKey.current = '';
    setDept(v);
  };

  // ── Clock stats ─────────────────────────────────────────────────────────────
  const { data: clockStats } = useQuery({
    queryKey: ['clock-stats', date],
    queryFn:  () => attendanceAPI.getClockStats(date).then(r => r.data.data),
    refetchInterval: 30000,
  });

  // ── Anomalies ───────────────────────────────────────────────────────────────
  const { data: anomalies } = useQuery({
    queryKey: ['att-anomalies', date],
    queryFn:  () => attendanceAPI.getAnomalies({ date }).then(r => r.data.data),
  });

  // ── Clock history (modal) ───────────────────────────────────────────────────
  const { data: clockHistoryData } = useQuery({
    queryKey: ['clock-history', clockHistoryStaff?._id],
    queryFn:  () => attendanceAPI.getClockHistory(clockHistoryStaff._id, { limit: 30 }).then(r => r.data.data),
    enabled:  !!clockHistoryStaff,
  });

  // ── Bulk save ───────────────────────────────────────────────────────────────
  const markMutation = useMutation({
    mutationFn: (records) => attendanceAPI.mark(records),
    onSuccess: () => {
      hydratedKey.current = '';
      qc.invalidateQueries(['attendance', date]);
      qc.invalidateQueries(['clock-stats', date]);
      toast.success('Attendance saved.');
    },
    onError: () => toast.error('Failed to save attendance.'),
  });

  // ── Clock In ────────────────────────────────────────────────────────────────
  const clockInMutation = useMutation({
    mutationFn: ({ staffId }) => clockAPI.clockIn(staffId),
    onMutate: async ({ staffId }) => {
      await qc.cancelQueries({ queryKey: ['attendance', date, dept] });
      const now = format(new Date(), 'HH:mm');
      setMarks(prev => ({ ...prev, [staffId]: prev[staffId] || 'Present' }));
      setTimes(prev => ({
        ...prev,
        [staffId]: {
          ...prev[staffId],
          checkIn:      prev[staffId]?.checkIn || now,
          clockInCount: (prev[staffId]?.clockInCount || 0) + 1,
        },
      }));
      toast.success('Clocked in!', { duration: 2000 });
      return { staffId };
    },
    onSuccess: (serverResponse, { staffId }) => {
      const rec = serverResponse?.data?.data;
      if (rec) {
        setTimes(prev => ({
          ...prev,
          [staffId]: {
            ...prev[staffId],
            checkIn:       rec.checkIn       || prev[staffId]?.checkIn || '',
            checkOut:      rec.checkOut      || prev[staffId]?.checkOut || '',
            clockInCount:  rec.clockInCount  ?? prev[staffId]?.clockInCount,
            clockOutCount: rec.clockOutCount ?? prev[staffId]?.clockOutCount,
            totalMinutes:  rec.totalMinutesWorked ?? prev[staffId]?.totalMinutes,
            clockEvents:   rec.clockEvents   || prev[staffId]?.clockEvents || [],
          },
        }));
      }
      qc.invalidateQueries({ queryKey: ['clock-stats', date] });
      qc.invalidateQueries({ queryKey: ['att-anomalies', date] });
    },
    onError: (e, { staffId }) => {
      setTimes(prev => ({
        ...prev,
        [staffId]: {
          ...prev[staffId],
          clockInCount: Math.max(0, (prev[staffId]?.clockInCount || 1) - 1),
        },
      }));
      toast.error(e.response?.data?.message || 'Clock-in failed.');
    },
  });

  // ── Clock Out ───────────────────────────────────────────────────────────────
  const clockOutMutation = useMutation({
    mutationFn: ({ staffId }) => clockAPI.clockOut(staffId),
    onMutate: async ({ staffId }) => {
      await qc.cancelQueries({ queryKey: ['attendance', date, dept] });
      const now = format(new Date(), 'HH:mm');
      setTimes(prev => ({
        ...prev,
        [staffId]: {
          ...prev[staffId],
          checkOut:      now,
          clockOutCount: (prev[staffId]?.clockOutCount || 0) + 1,
        },
      }));
      toast.success('Clocked out!', { duration: 2000 });
      return { staffId };
    },
    onSuccess: (serverResponse, { staffId }) => {
      const rec = serverResponse?.data?.data;
      if (rec) {
        setTimes(prev => ({
          ...prev,
          [staffId]: {
            ...prev[staffId],
            checkIn:       rec.checkIn       || prev[staffId]?.checkIn || '',
            checkOut:      rec.checkOut      || prev[staffId]?.checkOut || '',
            clockInCount:  rec.clockInCount  ?? prev[staffId]?.clockInCount,
            clockOutCount: rec.clockOutCount ?? prev[staffId]?.clockOutCount,
            totalMinutes:  rec.totalMinutesWorked ?? prev[staffId]?.totalMinutes,
            clockEvents:   rec.clockEvents   || prev[staffId]?.clockEvents || [],
          },
        }));
      }
      qc.invalidateQueries({ queryKey: ['clock-stats', date] });
      qc.invalidateQueries({ queryKey: ['att-anomalies', date] });
    },
    onError: (e, { staffId }) => {
      setTimes(prev => ({
        ...prev,
        [staffId]: {
          ...prev[staffId],
          clockOutCount: Math.max(0, (prev[staffId]?.clockOutCount || 1) - 1),
        },
      }));
      toast.error(e.response?.data?.message || 'Clock-out failed.');
    },
  });

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const setAllStatus = (status) => {
    if (!staffData) return;
    const nm = {};
    staffData.forEach(s => { nm[s._id] = status; });
    setMarks(nm);
    toast.success(`All set to "${status || 'Unmarked'}"`);
  };

  const handleSave = () => {
    if (!staffData) return;
    const unmarked = staffData.filter(s => !marks[s._id]);
    if (unmarked.length > 0 && !window.confirm(`${unmarked.length} staff member(s) are unmarked. Save anyway?`)) return;
    const records = staffData.map(s => ({
      staff: s._id, date,
      status:   marks[s._id] || null,
      checkIn:  times[s._id]?.checkIn  || null,
      checkOut: times[s._id]?.checkOut || null,
    }));
    markMutation.mutate(records);
  };

  const handleManualRefresh = () => {
    hydratedKey.current = '';
    qc.invalidateQueries({ queryKey: ['attendance', date, dept] });
    qc.invalidateQueries({ queryKey: ['clock-stats', date] });
    toast.success('Refreshed!');
  };

  // ── Derived stats ───────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    if (!staffData) return { present:0, absent:0, half:0, onLeave:0, unmarked:0, total:0 };
    const v = Object.values(marks);
    const present  = v.filter(x => x === 'Present').length;
    const absent   = v.filter(x => x === 'Absent').length;
    const half     = v.filter(x => x === 'Half-Day').length;
    const onLeave  = v.filter(x => x === 'On-Leave').length;
    return { present, absent, half, onLeave,
      unmarked: staffData.length - present - absent - half - onLeave,
      total: staffData.length };
  }, [marks, staffData]);

  const displayStaff = useMemo(() => {
    if (!staffData) return [];
    return showUnmarkedOnly ? staffData.filter(s => !marks[s._id]) : staffData;
  }, [staffData, showUnmarkedOnly, marks]);

  const getStatusStyle = (val) =>
    STATUS_OPTIONS.find(o => o.value === (val || '')) || STATUS_OPTIONS[0];

  // ─── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div className="attendance-page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Attendance Tracking</h1>
          <p className="page-subtitle">Mark daily attendance and manage clock-ins</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-ghost" onClick={handleManualRefresh}>
            <MdRefresh /> Refresh
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={markMutation.isPending}>
            {markMutation.isPending ? 'Saving…' : <><MdDoneAll /> Save Attendance</>}
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="stats-grid">
        {[
          { icon:<MdPeopleOutline/>,  label:'Total',    value:stats.total,    color:'#6366f1' },
          { icon:<MdEventAvailable/>, label:'Present',  value:stats.present,  color:'#16a34a' },
          { icon:<MdPersonOff/>,      label:'Absent',   value:stats.absent,   color:'#dc2626' },
          { icon:<MdAccessTime/>,     label:'Half-Day', value:stats.half,     color:'#d97706' },
          { icon:<MdSchedule/>,       label:'On Leave', value:stats.onLeave,  color:'#7c3aed' },
          { icon:<MdHourglassEmpty/>, label:'Unmarked', value:stats.unmarked, color:'#94a3b8' },
        ].map(s => (
          <div key={s.label} className="stat-card-mini">
            <div className="stat-icon" style={{color:s.color}}>{s.icon}</div>
            <div className="stat-value" style={{color:s.color}}>{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Clock activity summary */}
      {clockStats && (
        <div className="clock-summary">
          <div className="clock-summary-header">
            <div className="card-title" style={{display:'flex',alignItems:'center',gap:6}}>
              <MdHistory style={{color:'var(--accent2)'}}/>
              Clock Activity — {format(new Date(date+'T12:00:00'), 'd MMMM yyyy')}
            </div>
          </div>
          <div className="clock-summary-grid">
            {[
              { value: clockStats.totalClockIns,      label: 'Total Clock-Ins Today',  color: '#16a34a' },
              { value: clockStats.totalClockOuts,     label: 'Total Clock-Outs Today', color: '#6366f1' },
              { value: fmtMins(clockStats.avgMinutes),label: 'Avg Time Worked',        color: '#d97706' },
            ].map(c => (
              <div key={c.label} className="clock-summary-item">
                <div className="stat-value" style={{color:c.color}}>{c.value}</div>
                <div className="stat-label">{c.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick clock panel */}
      <div className="quick-clock card">
        <div className="card-header">
          <div className="card-title" style={{display:'flex',alignItems:'center',gap:6}}>
            <MdLogin style={{color:'#16a34a'}}/>Quick Clock In / Out
          </div>
          <span style={{fontSize:11,color:'var(--text3)'}}>Multiple clock-ins per day supported</span>
        </div>
        <div className="quick-clock-controls">
          <select className="form-input" value={clockStaff} onChange={e=>setClockStaff(e.target.value)}>
            <option value="">— Select staff member —</option>
            {(staffData||[]).map(s=>(
              <option key={s._id} value={s._id}>
                {s.firstName} {s.lastName}
                {times[s._id]?.clockInCount ? ` [${times[s._id].clockInCount}↑ / ${times[s._id].clockOutCount}↓]` : ''}
              </option>
            ))}
          </select>
          <button className="btn btn-primary"
            onClick={() => { if (!clockStaff) return toast.error('Select a staff member.'); clockInMutation.mutate({ staffId:clockStaff }); }}
            disabled={clockInMutation.isPending || !clockStaff}>
            <MdLogin/> Clock In
          </button>
          <button className="btn btn-ghost" style={{border:'1px solid var(--accent)'}}
            onClick={() => { if (!clockStaff) return toast.error('Select a staff member.'); clockOutMutation.mutate({ staffId:clockStaff }); }}
            disabled={clockOutMutation.isPending || !clockStaff}>
            <MdLogout/> Clock Out
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-section">
        <div className="filter-group">
          <label className="filter-label">Date</label>
          <input className="form-input" type="date" value={date} onChange={e=>handleDateChange(e.target.value)}/>
        </div>
        <div className="filter-group">
          <label className="filter-label">Department</label>
          <select className="form-input" value={dept} onChange={e=>handleDeptChange(e.target.value)}>
            <option value="">All Departments</option>
            {['Computer Science','Engineering','Medicine','Registry','Bursary','Library','ICT'].map(d=><option key={d}>{d}</option>)}
          </select>
        </div>
        <div className="filter-group">
          <label className="filter-label">Quick Set</label>
          <div className="quick-set-buttons">
            <button className="btn btn-sm btn-ghost" onClick={()=>setAllStatus('Present')}>All Present</button>
            <button className="btn btn-sm btn-ghost" onClick={()=>setAllStatus('Absent')}>All Absent</button>
            <button className="btn btn-sm btn-ghost" onClick={()=>setAllStatus('')}>Clear All</button>
          </div>
        </div>
        <label className="filter-checkbox">
          <input type="checkbox" checked={showUnmarkedOnly} onChange={e=>setShowUnmarkedOnly(e.target.checked)}/>
          Show unmarked only {stats.unmarked > 0 && (
            <span className="unmarked-badge">{stats.unmarked}</span>
          )}
        </label>
      </div>

      <div className="grid2">
        {/* Main attendance table */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">{format(new Date(date+'T12:00:00'), 'EEEE, d MMMM yyyy')}</div>
              <div className="card-subtitle">{displayStaff.length} staff shown</div>
            </div>
          </div>
          {staffLoading ? <LoadingPage/> : (
            <div className="table-wrap table-scroll">
              <table className="attendance-table">
                <thead>
                  <tr>
                    <th>Staff</th><th>Status</th><th>Clock In</th><th>Clock Out</th><th>Time</th>
                    <th className="th-actions">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {displayStaff.map(s => {
                    const st = getStatusStyle(marks[s._id]);
                    const t  = times[s._id] || {};
                    const isUnmarked = !marks[s._id];
                    const hasClockedIn  = t.clockEvents?.some(e => e.type === 'in')  || t.clockInCount > 0;
                    const hasClockedOut = t.clockEvents?.some(e => e.type === 'out') || t.clockOutCount > 0;
                    return (
                      <tr key={s._id} style={{borderLeft:`3px solid ${st.color}`, background: isUnmarked ? undefined : st.bg}}>
                        <td>
                          <div className="staff-name">{s.firstName} {s.lastName}</div>
                          <div className="staff-dept">{s.department}</div>
                          {(t.clockInCount > 0 || t.clockOutCount > 0) && (
                            <div className="clock-counts">
                              <span className="badge-in">↑{t.clockInCount}</span>
                              <span className="badge-out">↓{t.clockOutCount}</span>
                              {t.totalMinutes > 0 && <span className="total-minutes">{fmtMins(t.totalMinutes)}</span>}
                            </div>
                          )}
                          {isUnmarked && <span className="unmarked-tag">⚠ unmarked</span>}
                        </td>
                        <td>
                          <select className="form-input status-select"
                            style={{borderColor:st.color, background:st.bg}}
                            value={marks[s._id] || ''}
                            onChange={e=>setMarks(m=>({...m,[s._id]:e.target.value}))}>
                            {STATUS_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        </td>
                        <td>
                          <input type="time" className="form-input time-input"
                            style={{
                              background: hasClockedIn ? '#f0fdf4' : undefined,
                              color: hasClockedIn ? '#16a34a' : undefined,
                              fontWeight: hasClockedIn ? 600 : undefined
                            }}
                            value={t.checkIn || ''}
                            onChange={e=>setTimes(x=>({...x,[s._id]:{...x[s._id],checkIn:e.target.value}}))}/>
                        </td>
                        <td>
                          <input type="time" className="form-input time-input"
                            style={{
                              background: hasClockedOut ? '#ede9fe' : undefined,
                              color: hasClockedOut ? '#6d28d9' : undefined,
                              fontWeight: hasClockedOut ? 600 : undefined
                            }}
                            value={t.checkOut || ''}
                            onChange={e=>setTimes(x=>({...x,[s._id]:{...x[s._id],checkOut:e.target.value}}))}/>
                        </td>
                        <td className="time-cell">
                          {t.totalMinutes > 0 ? fmtMins(t.totalMinutes) : '—'}
                        </td>
                        <td>
                          <div className="action-buttons">
                            <button className="btn btn-sm btn-ghost btn-icon" title="Clock In"
                              onClick={()=>clockInMutation.mutate({ staffId:s._id })} disabled={clockInMutation.isPending}>
                              <MdLogin size={14}/>
                            </button>
                            <button className="btn btn-sm btn-ghost btn-icon" title="Clock Out"
                              onClick={()=>clockOutMutation.mutate({ staffId:s._id })} disabled={clockOutMutation.isPending}>
                              <MdLogout size={14}/>
                            </button>
                            {t.clockInCount > 0 && (
                              <button className="btn btn-sm btn-ghost btn-icon btn-history" title="View clock history"
                                onClick={()=>setClockHistoryStaff(s)}>
                                <MdHistory size={14}/>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {displayStaff.length === 0 && (
                    <tr><td colSpan={6}><EmptyState message={showUnmarkedOnly?'All staff marked! 🎉':'No staff found.'}/></td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right panel */}
        <div className="right-panel">
          {/* Per-staff clock counts */}
          {clockStats?.perStaff?.filter(r=>r.clockInCount>0).length > 0 && (
            <div className="card">
              <div className="card-header">
                <div className="card-title">Clock Event Counts</div>
                <span className="badge badge-info">{date}</span>
              </div>
              <div className="table-wrap table-scroll-small">
                <table>
                  <thead><tr><th>Staff</th><th className="th-center">↑ In</th><th className="th-center">↓ Out</th><th>Total</th></tr></thead>
                  <tbody>
                    {clockStats.perStaff.filter(r=>r.clockInCount>0).map(r=>(
                      <tr key={r.staff?._id}>
                        <td className="staff-cell">{r.staff?.firstName} {r.staff?.lastName}</td>
                        <td className="td-center">
                          <span className="count-in">{r.clockInCount}</span>
                        </td>
                        <td className="td-center">
                          <span className="count-out">{r.clockOutCount}</span>
                        </td>
                        <td className="time-cell">{fmtMins(r.totalMinutesWorked)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Anomalies */}
          <div className="card">
            <div className="card-header">
              <div className="card-title" style={{display:'flex',alignItems:'center',gap:6}}>
                <MdWarning style={{color:'#dc2626'}}/>Anomaly Alerts
              </div>
              <span className={`badge ${(anomalies||[]).length>0?'badge-warning':'badge-success'}`}>{(anomalies||[]).length}</span>
            </div>
            {(anomalies||[]).length===0
              ? <EmptyState message="No anomalies detected." icon={<MdCheckCircle style={{color:'#16a34a'}}/>}/>
              : (anomalies||[]).slice(0,8).map(a=>(
                <div key={a._id} className="anomaly-item">
                  <div className="anomaly-reason">{a.flagReason}</div>
                  <div className="anomaly-detail">{a.staff?.firstName} {a.staff?.lastName} · {a.staff?.department} · {a.date?format(new Date(a.date),'d MMM'):''}</div>
                </div>
              ))
            }
          </div>
        </div>
      </div>

      {/* Clock History Modal */}
      <Modal open={!!clockHistoryStaff} onClose={()=>setClockHistoryStaff(null)}
        title={`Clock History — ${clockHistoryStaff?.firstName} ${clockHistoryStaff?.lastName}`} wide>
        {!clockHistoryData ? <LoadingPage/> :
         clockHistoryData.length===0 ? <EmptyState message="No clock events recorded yet."/> :
         clockHistoryData.map(rec=>(
          <div key={rec._id} className="history-card">
            <div className="history-header">
              <strong>{format(new Date(rec.date),'EEEE, d MMMM yyyy')}</strong>
              <div className="history-badges">
                <span className="history-in">↑ {rec.clockInCount}</span>
                <span className="history-out">↓ {rec.clockOutCount}</span>
                <span className="history-time">{fmtMins(rec.totalMinutesWorked)}</span>
              </div>
            </div>
            <div className="history-events">
              {[...(rec.clockEvents||[])].sort((a,b)=>new Date(a.timestamp)-new Date(b.timestamp)).map((ev,i)=>(
                <div key={i} className="history-event">
                  <span className={`event-badge ${ev.type==='in'?'event-in':'event-out'}`}>
                    {ev.type==='in'?'↑ IN':'↓ OUT'}
                  </span>
                  <span className="event-time">{ev.time}</span>
                  <span className="event-note">{ev.note||''}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </Modal>
    </div>
  );
}