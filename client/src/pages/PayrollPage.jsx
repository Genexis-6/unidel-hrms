import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { payrollAPI } from '../services/api';
import { StatCard, LoadingPage, statusBadge, EmptyState, ConfirmDialog } from '../components/ui';
import { MdWarning, MdCheckCircle, MdRefresh } from 'react-icons/md';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function PayrollPage() {
  const qc = useQueryClient();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth()+1);
  const [year,  setYear]  = useState(now.getFullYear());
  const [genConfirm, setGenConfirm] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['payroll', month, year],
    queryFn:  () => payrollAPI.getAll({ month, year }).then(r => r.data),
  });

  const { data: flags } = useQuery({
    queryKey: ['payroll-flags'],
    queryFn:  () => payrollAPI.getFlags().then(r => r.data.data),
  });

  const genMutation = useMutation({
    mutationFn: () => payrollAPI.generate({ month, year }),
    onSuccess: (res) => {
      qc.invalidateQueries(['payroll']); qc.invalidateQueries(['payroll-flags']);
      toast.success(`Payroll generated. ${res.data.anomalies} anomalies detected.`);
      setGenConfirm(false);
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Generation failed.'),
  });

  const auditMutation = useMutation({
    mutationFn: () => payrollAPI.runAudit({ month, year }),
    onSuccess: (res) => {
      qc.invalidateQueries(['payroll']); qc.invalidateQueries(['payroll-flags']);
      toast.success(`Audit complete. ${res.data.data.flagged} records flagged.`);
    },
  });

  const resolveMutation = useMutation({
    mutationFn: (id) => payrollAPI.resolveFlag(id),
    onSuccess: () => { qc.invalidateQueries(['payroll-flags']); toast.success('Flag resolved.'); },
  });

  const t = data?.totals || {};
  const total = data?.total || 0;

  return (
    <div>
      <div className="page-header">
        <div><h1>Payroll & Finance</h1><p>Monthly payroll management and anomaly detection</p></div>
        <div style={{display:'flex',gap:8}}>
          <button className="btn btn-ghost" onClick={()=>auditMutation.mutate()} disabled={auditMutation.isPending}>
            <MdRefresh/> {auditMutation.isPending?'Auditing…':'Run AI Audit'}
          </button>
          <button className="btn btn-primary" onClick={()=>setGenConfirm(true)}>Generate Payroll</button>
        </div>
      </div>

      {/* Period selector */}
      <div style={{display:'flex',gap:10,marginBottom:20}}>
        <select className="form-input" style={{width:150}} value={month} onChange={e=>setMonth(Number(e.target.value))}>
          {MONTHS.map((m,i)=><option key={i+1} value={i+1}>{m}</option>)}
        </select>
        <select className="form-input" style={{width:100}} value={year} onChange={e=>setYear(Number(e.target.value))}>
          {[2024,2025,2026,2027].map(y=><option key={y}>{y}</option>)}
        </select>
      </div>

      <div className="stat-grid" style={{marginBottom:20}}>
        <StatCard label="Total Gross" value={t.totalGross ? `₦${(t.totalGross/1e6).toFixed(1)}M` : '—'} />
        <StatCard label="Total Net"   value={t.totalNet   ? `₦${(t.totalNet/1e6).toFixed(1)}M` : '—'} color="var(--accent2)"/>
        <StatCard label="Staff Processed" value={total} />
        <StatCard label="Anomaly Flags" value={t.flagged||0} color={t.flagged>0?'var(--red)':undefined}
          delta={t.flagged>0?'Requires action':'All clear'} deltaType={t.flagged>0?'down':'up'}
          icon={t.flagged>0?<MdWarning/>:<MdCheckCircle/>}
        />
      </div>

      <div className="grid2">
        <div className="card">
          <div className="card-header">
            <div><div className="card-title">Payroll Register — {MONTHS[month-1]} {year}</div></div>
            <span className="badge badge-neutral">{total} records</span>
          </div>
          {isLoading ? <LoadingPage/> : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Staff ID</th><th>Name</th><th>Grade</th><th>Gross (₦)</th><th>Net (₦)</th><th>Status</th></tr></thead>
                <tbody>
                  {(data?.data||[]).length===0
                    ? <tr><td colSpan={6}><EmptyState message="No payroll records. Generate payroll first."/></td></tr>
                    : (data.data).map(p=>(
                      <tr key={p._id} style={p.flagged?{background:'var(--red-bg)'}:{}}>
                        <td style={{fontFamily:'var(--mono)',fontSize:11}}>{p.staff?.staffId}</td>
                        <td><strong>{p.staff?.firstName} {p.staff?.lastName}</strong><div style={{fontSize:11,color:'var(--text3)'}}>{p.staff?.department}</div></td>
                        <td style={{fontFamily:'var(--mono)',fontSize:12}}>{p.staff?.gradeLevel}</td>
                        <td style={{fontFamily:'var(--mono)'}}>{p.grossSalary?.toLocaleString()}</td>
                        <td style={{fontFamily:'var(--mono)'}}>{p.netSalary?.toLocaleString()}</td>
                        <td>{statusBadge(p.status)}</td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">Anomaly Flags</div>
            <span className="badge badge-danger">{(flags||[]).length} active</span>
          </div>
          {(flags||[]).length===0
            ? <EmptyState message="No anomalies detected." icon={<MdCheckCircle style={{color:'var(--accent2)'}}/>}/>
            : (flags||[]).map(f=>(
              <div key={f._id} style={{padding:'12px 0',borderBottom:'1px solid var(--border)'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:8}}>
                  <div>
                    <div style={{fontSize:13,fontWeight:500,color:'var(--red)',marginBottom:3}}>{f.staff?.firstName} {f.staff?.lastName}</div>
                    <div style={{fontSize:12,color:'var(--text2)',marginBottom:4}}>{f.flagReason}</div>
                    <div style={{fontSize:11,color:'var(--text3)'}}>{f.staff?.staffId} · {f.staff?.gradeLevel}</div>
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={()=>resolveMutation.mutate(f._id)}>Resolve</button>
                </div>
              </div>
            ))
          }
        </div>
      </div>

      <ConfirmDialog
        open={genConfirm} onClose={()=>setGenConfirm(false)} onConfirm={()=>genMutation.mutate()}
        loading={genMutation.isPending}
        title="Generate Payroll"
        message={`Generate payroll for ${MONTHS[month-1]} ${year}? This will create records for all active staff and run AI anomaly detection.`}
      />
    </div>
  );
}
