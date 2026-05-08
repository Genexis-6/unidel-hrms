import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { attendanceAPI, staffAPI, clockAPI } from '../services/api';
import { LoadingPage, statusBadge, StatCard, EmptyState } from '../components/ui';
import { MdEventAvailable, MdWarning, MdCheckCircle, MdLogin, MdLogout } from 'react-icons/md';

const STATUS_OPTIONS = ['Present','Absent','Half-Day','On-Leave'];

export default function AttendancePage() {
  const qc = useQueryClient();
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [dept, setDept] = useState('');
  const [marks, setMarks]   = useState({});
  const [times, setTimes]   = useState({}); // { staffId: { checkIn, checkOut } }
  const [clockStaff, setClockStaff] = useState('');

  const { data: staffData, isLoading: staffLoading } = useQuery({
    queryKey: ['staff-all', dept],
    queryFn: () => staffAPI.getAll({ limit: 100, department: dept || undefined }).then(r => r.data.data),
  });

  useQuery({
    queryKey: ['attendance', date, dept],
    queryFn: () => attendanceAPI.getAll({ date, department: dept || undefined }).then(r => r.data.data),
    onSuccess: (records) => {
      const m = {}; const t = {};
      records.forEach(r => {
        if (r.staff?._id) {
          m[r.staff._id] = r.status;
          t[r.staff._id] = { checkIn: r.checkIn || '', checkOut: r.checkOut || '' };
        }
      });
      setMarks(m); setTimes(t);
    },
  });

  const { data: anomalies } = useQuery({
    queryKey: ['att-anomalies'],
    queryFn: () => attendanceAPI.getAnomalies().then(r => r.data.data),
  });

  const markMutation = useMutation({
    mutationFn: (records) => attendanceAPI.mark(records),
    onSuccess: () => { qc.invalidateQueries(['attendance']); toast.success('Attendance saved.'); },
    onError:   () => toast.error('Failed to save attendance.'),
  });

  const clockInMutation = useMutation({
    mutationFn: (staffId) => clockAPI.clockIn(staffId),
    onSuccess: (res) => { qc.invalidateQueries(['attendance']); toast.success(res.data.message); },
    onError: (e) => toast.error(e.response?.data?.message || 'Clock-in failed.'),
  });

  const clockOutMutation = useMutation({
    mutationFn: (staffId) => clockAPI.clockOut(staffId),
    onSuccess: (res) => {
      qc.invalidateQueries(['attendance']);
      const h = res.data.hoursWorked;
      toast.success(`${res.data.message}${h ? ` · ${h.toFixed(1)}h worked` : ''}`);
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Clock-out failed.'),
  });

  const handleSave = () => {
    if (!staffData) return;
    const records = staffData.map(s => ({
      staff: s._id, date,
      status: marks[s._id] || 'Present',
      checkIn:  times[s._id]?.checkIn  || null,
      checkOut: times[s._id]?.checkOut || null,
    }));
    markMutation.mutate(records);
  };

  const presentCount = Object.values(marks).filter(v => v === 'Present').length;
  const absentCount  = Object.values(marks).filter(v => v === 'Absent').length;
  const halfCount    = Object.values(marks).filter(v => v === 'Half-Day').length;

  return (
    <div>
      <div className="page-header">
        <div><h1>Attendance Tracking</h1><p>Mark daily attendance with clock-in/out times</p></div>
        <button className="btn btn-primary" onClick={handleSave} disabled={markMutation.isPending}>
          {markMutation.isPending ? 'Saving…' : <><MdCheckCircle/> Save Attendance</>}
        </button>
      </div>

      {/* Quick Clock In/Out Panel */}
      <div className="card" style={{ marginBottom: 16, background: 'linear-gradient(135deg,#EBF4EB,#EBF0F8)' }}>
        <div className="card-header" style={{ marginBottom: 10 }}>
          <div className="card-title">Quick Clock In / Clock Out</div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label className="form-label">Select Staff</label>
            <select className="form-input" value={clockStaff} onChange={e => setClockStaff(e.target.value)}>
              <option value="">— Choose staff member —</option>
              {(staffData||[]).map(s => <option key={s._id} value={s._id}>{s.firstName} {s.lastName} ({s.department})</option>)}
            </select>
          </div>
          <button className="btn btn-primary" style={{ gap: 6 }} onClick={() => { if (!clockStaff) return toast.error('Select a staff member.'); clockInMutation.mutate(clockStaff); }} disabled={clockInMutation.isPending || !clockStaff}>
            <MdLogin/> Clock In
          </button>
          <button className="btn btn-ghost" style={{ gap: 6, border: '1px solid var(--accent)' }} onClick={() => { if (!clockStaff) return toast.error('Select a staff member.'); clockOutMutation.mutate(clockStaff); }} disabled={clockOutMutation.isPending || !clockStaff}>
            <MdLogout/> Clock Out
          </button>
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: 12, color: 'var(--text3)' }}>Date:</label>
          <input className="form-input" type="date" value={date} onChange={e => setDate(e.target.value)} style={{ width: 160 }}/>
        </div>
        <select className="form-input" style={{ width: 180 }} value={dept} onChange={e => setDept(e.target.value)}>
          <option value="">All Departments</option>
          {['Computer Science','Engineering','Medicine','Registry','Bursary','Library','ICT'].map(d=><option key={d}>{d}</option>)}
        </select>
      </div>

      <div className="grid2">
        {/* Marking Table */}
        <div className="card">
          <div className="card-header">
            <div><div className="card-title">Mark Attendance</div><div className="card-subtitle">{format(new Date(date+'T12:00:00'), 'EEEE, d MMMM yyyy')}</div></div>
            <div style={{ display:'flex',gap:6,fontSize:12 }}>
              <span style={{ color:'var(--accent2)',fontFamily:'var(--mono)',fontWeight:600 }}>{presentCount}P</span>
              <span style={{ color:'#C0392B',fontFamily:'var(--mono)',fontWeight:600 }}>{absentCount}A</span>
              <span style={{ color:'#E6A020',fontFamily:'var(--mono)',fontWeight:600 }}>{halfCount}H</span>
            </div>
          </div>

          {staffLoading ? <LoadingPage/> : (
            <div className="table-wrap" style={{ maxHeight: 500, overflowY:'auto' }}>
              <table>
                <thead>
                  <tr><th>Staff</th><th>Status</th><th>Clock In</th><th>Clock Out</th></tr>
                </thead>
                <tbody>
                  {(staffData||[]).map(s => (
                    <tr key={s._id} style={{ background: marks[s._id]==='Absent'?'var(--red-bg)': marks[s._id]==='Present'?'var(--accent-bg)':'' }}>
                      <td>
                        <div style={{ fontWeight:500, fontSize:13 }}>{s.firstName} {s.lastName}</div>
                        <div style={{ fontSize:11,color:'var(--text3)' }}>{s.department}</div>
                      </td>
                      <td>
                        <select className="form-input" style={{ padding:'4px 6px',fontSize:12,width:105 }}
                          value={marks[s._id] || 'Present'}
                          onChange={e => setMarks(m => ({...m,[s._id]:e.target.value}))}>
                          {STATUS_OPTIONS.map(o=><option key={o}>{o}</option>)}
                        </select>
                      </td>
                      <td>
                        <input type="time" className="form-input" style={{ padding:'4px 6px',fontSize:12,width:90 }}
                          value={times[s._id]?.checkIn || ''}
                          onChange={e => setTimes(t => ({...t,[s._id]:{...t[s._id],checkIn:e.target.value}}))}/>
                      </td>
                      <td>
                        <input type="time" className="form-input" style={{ padding:'4px 6px',fontSize:12,width:90 }}
                          value={times[s._id]?.checkOut || ''}
                          onChange={e => setTimes(t => ({...t,[s._id]:{...t[s._id],checkOut:e.target.value}}))}/>
                      </td>
                    </tr>
                  ))}
                  {(staffData||[]).length === 0 && <tr><td colSpan={4}><EmptyState message="No staff found."/></td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right panel */}
        <div>
          <div className="grid2" style={{ marginBottom:14 }}>
            <StatCard label="Present" value={presentCount} color="var(--accent2)" icon={<MdEventAvailable/>}/>
            <StatCard label="Absent"  value={absentCount}  color="var(--red)"     icon={<MdWarning/>}/>
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-title">Anomaly Alerts</div>
              <span className="badge badge-warning">{(anomalies||[]).length} flagged</span>
            </div>
            {(anomalies||[]).length === 0
              ? <EmptyState message="No anomalies detected." icon={<MdCheckCircle style={{color:'var(--accent2)'}}/>}/>
              : (anomalies||[]).slice(0,8).map(a => (
                <div key={a._id} style={{ padding:'9px 0',borderBottom:'1px solid var(--border)' }}>
                  <div style={{ fontSize:13,fontWeight:500,color:'var(--red)' }}>{a.flagReason}</div>
                  <div style={{ fontSize:11,color:'var(--text3)' }}>{a.staff?.firstName} {a.staff?.lastName} · {a.staff?.department} · {a.date ? format(new Date(a.date),'d MMM') : ''}</div>
                </div>
              ))
            }
          </div>
        </div>
      </div>
    </div>
  );
}
