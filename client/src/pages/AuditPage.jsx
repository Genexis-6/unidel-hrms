import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { auditAPI } from '../services/api';
import { LoadingPage, EmptyState, TabBar } from '../components/ui';
import { MdHistory, MdSearch } from 'react-icons/md';

const MODULE_COLOR = {
  Auth:'var(--purple)', Staff:'var(--blue)', Attendance:'var(--accent2)',
  Leave:'var(--amber)', Promotion:'var(--accent)', Payroll:'var(--red)',
  Reports:'var(--text2)', AI:'var(--purple)', System:'var(--text3)',
};
const MODULE_BADGE = {
  Auth:'badge-purple', Staff:'badge-info', Attendance:'badge-success',
  Leave:'badge-warning', Promotion:'badge-success', Payroll:'badge-danger',
  Reports:'badge-neutral', AI:'badge-purple', System:'badge-neutral',
};

const ACTION_ICON = {
  APPROVE_LEAVE:'✅', REJECT_LEAVE:'❌', SUBMIT_LEAVE:'📋',
  APPROVE_PROMOTION:'🎉', REJECT_PROMOTION:'🚫', SUBMIT_PROMOTION:'📄',
  CLOCK_IN:'🟢', CLOCK_OUT:'🔴', BULK_MARK_ATTENDANCE:'📅',
  CREATE_STAFF:'👤', LOGIN:'🔑', BULK_GENERATE_PAYROLL:'💰',
};

export default function AuditPage() {
  const [page, setPage]     = useState(1);
  const [module, setModule] = useState('');
  const [search, setSearch] = useState('');
  const [from, setFrom]     = useState('');
  const [to, setTo]         = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', page, module, search, from, to],
    queryFn: () => auditAPI.getLogs({
      page, limit: 25,
      module: module || undefined,
      action: search || undefined,
      from: from || undefined,
      to:   to   || undefined,
    }).then(r => r.data),
    placeholderData: (prev) => prev,
  });

  const { data: stats } = useQuery({
    queryKey: ['audit-stats'],
    queryFn: () => auditAPI.getStats().then(r => r.data.data),
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Audit Log</h1>
          <p>Complete record of all system operations and who performed them</p>
        </div>
      </div>

      {/* Stats row */}
      {stats?.byModule && (
        <div style={{ display:'flex',gap:8,flexWrap:'wrap',marginBottom:18 }}>
          {stats.byModule.map(m => (
            <div key={m._id} style={{ background:'var(--surface)',border:'1px solid var(--border)',borderRadius:8,padding:'8px 14px',display:'flex',alignItems:'center',gap:8,fontSize:13 }}>
              <span className={`badge ${MODULE_BADGE[m._id]||'badge-neutral'}`}>{m._id}</span>
              <span style={{ fontFamily:'var(--mono)',fontWeight:600 }}>{m.count}</span>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div style={{ display:'flex',gap:10,marginBottom:16,flexWrap:'wrap' }}>
        <div className="search-wrap" style={{ flex:1,minWidth:180 }}>
          <MdSearch style={{ color:'var(--text3)' }}/>
          <input placeholder="Search action…" value={search} onChange={e=>{setSearch(e.target.value);setPage(1)}}/>
        </div>
        <select className="form-input" style={{ width:150 }} value={module} onChange={e=>{setModule(e.target.value);setPage(1)}}>
          <option value="">All Modules</option>
          {['Auth','Staff','Attendance','Leave','Promotion','Payroll','Reports','AI','System'].map(m=><option key={m}>{m}</option>)}
        </select>
        <input className="form-input" type="date" style={{ width:150 }} value={from} onChange={e=>{setFrom(e.target.value);setPage(1)}} placeholder="From"/>
        <input className="form-input" type="date" style={{ width:150 }} value={to}   onChange={e=>{setTo(e.target.value);setPage(1)}}   placeholder="To"/>
      </div>

      <div className="card">
        <div className="card-header">
          <div><div className="card-title"><MdHistory style={{marginRight:6}}/>Activity Log</div><div className="card-subtitle">{data?.total||0} total entries</div></div>
        </div>

        {isLoading ? <LoadingPage/> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Time</th><th>User</th><th>Role</th><th>Module</th><th>Action</th><th>Description</th><th>Status</th></tr>
              </thead>
              <tbody>
                {(data?.data||[]).length === 0
                  ? <tr><td colSpan={7}><EmptyState message="No audit records found."/></td></tr>
                  : (data.data).map(log => (
                    <tr key={log._id}>
                      <td style={{ fontFamily:'var(--mono)',fontSize:11,whiteSpace:'nowrap',color:'var(--text3)' }}>
                        {format(new Date(log.createdAt),'dd MMM HH:mm')}
                      </td>
                      <td>
                        <div style={{ fontWeight:500,fontSize:13 }}>{log.userName || log.user?.name || '—'}</div>
                      </td>
                      <td><span className="badge badge-neutral" style={{ fontSize:10 }}>{log.userRole}</span></td>
                      <td><span className={`badge ${MODULE_BADGE[log.module]||'badge-neutral'}`} style={{ fontSize:10 }}>{log.module}</span></td>
                      <td>
                        <div style={{ display:'flex',alignItems:'center',gap:5,fontSize:12,whiteSpace:'nowrap' }}>
                          <span>{ACTION_ICON[log.action]||'⚡'}</span>
                          <span style={{ fontFamily:'var(--mono)',fontSize:10,color:'var(--text2)' }}>{log.action}</span>
                        </div>
                      </td>
                      <td style={{ fontSize:12,color:'var(--text2)',maxWidth:280 }}>{log.description}</td>
                      <td>
                        <span className={`badge ${log.status==='success'?'badge-success':'badge-danger'}`} style={{ fontSize:10 }}>
                          {log.status}
                        </span>
                      </td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {data?.pages > 1 && (
          <div style={{ display:'flex',gap:8,justifyContent:'center',marginTop:16 }}>
            <button className="btn btn-ghost btn-sm" disabled={page===1} onClick={()=>setPage(p=>p-1)}>← Prev</button>
            <span style={{ fontSize:13,color:'var(--text3)',padding:'5px 10px' }}>Page {page} of {data.pages}</span>
            <button className="btn btn-ghost btn-sm" disabled={page>=data.pages} onClick={()=>setPage(p=>p+1)}>Next →</button>
          </div>
        )}
      </div>
    </div>
  );
}
