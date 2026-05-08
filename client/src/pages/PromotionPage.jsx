import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { promotionAPI, staffAPI } from '../services/api';
import { Modal, ScoreBar, TabBar, statusBadge, LoadingPage, AIPanel, StatCard, EmptyState } from '../components/ui';
import { MdAdd, MdRefresh, MdCheck, MdClose } from 'react-icons/md';
import { FaMicrochip } from 'react-icons/fa';

const RANKS = ['Graduate Assistant','Assistant Lecturer','Lecturer II','Lecturer I','Senior Lecturer','Reader','Professor','Officer II','Officer I','Senior Officer','Principal Officer','Assistant Registrar','Deputy Registrar','Registrar','Technologist II','Technologist I','Senior Technologist'];
const GRADES = ['GL 03','GL 04','GL 05','GL 06','GL 07','GL 08','GL 09','GL 10','GL 11','GL 12','GL 13','GL 14','GL 15','GL 16','GL 17'];

const emptyForm = { staffId:'', fromGradeLevel:'GL 09', toGradeLevel:'GL 10', fromRank:'', toRank:'', publications:0, teachingEvalScore:70, committeeRoles:0, cycle:'' };

export default function PromotionPage() {
  const qc = useQueryClient();
  const [tab, setTab]   = useState('Pending');
  const [modal, setModal]   = useState(false);
  const [detail, setDetail] = useState(null);
  const [form, setForm]     = useState(emptyForm);
  const [aiResult, setAiResult] = useState(null);

  const { data: stats } = useQuery({ queryKey:['promo-stats'], queryFn: ()=>promotionAPI.getStats().then(r=>r.data.data) });
  const { data, isLoading } = useQuery({
    queryKey: ['promotions', tab],
    queryFn: () => promotionAPI.getAll({ status: tab === 'All' ? undefined : tab }).then(r => r.data),
  });
  const { data: staffList } = useQuery({ queryKey:['staff-list'], queryFn:()=>staffAPI.getAll({limit:200}).then(r=>r.data.data) });

  const applyMutation = useMutation({
    mutationFn: (d) => promotionAPI.apply(d),
    onSuccess: (res) => {
      setAiResult(res.data.aiResult);
      qc.invalidateQueries(['promotions']); qc.invalidateQueries(['promo-stats']);
      toast.success('Application submitted and AI-vetted.');
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed.'),
  });

  const revetMutation = useMutation({
    mutationFn: (id) => promotionAPI.revet(id),
    onSuccess: () => { qc.invalidateQueries(['promotions']); toast.success('Re-vetted by AI.'); },
  });

  const finalizeMutation = useMutation({
    mutationFn: ({ id, decision }) => promotionAPI.finalize(id, { decision }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries(['promotions']); qc.invalidateQueries(['promo-stats']);
      toast.success(`Promotion ${vars.decision === 'approve' ? 'approved' : 'rejected'}.`);
      setDetail(null);
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Action failed.'),
  });

  const f = k => e => setForm(p => ({...p, [k]: e.target.value}));

  const statMap = {};
  (stats||[]).forEach(s => { statMap[s._id] = s; });

  const tabs = [
    {value:'Pending',label:'Pending'},
    {value:'AI-Approved',label:'AI-Approved'},
    {value:'Under-Review',label:'Under Review'},
    {value:'Approved',label:'Approved'},
    {value:'Rejected',label:'Rejected'},
  ];

  return (
    <div>
      <div className="page-header">
        <div><h1>Promotion Vetting</h1><p>AI-powered promotion eligibility assessment</p></div>
        <button className="btn btn-primary" onClick={()=>{setModal(true);setAiResult(null);setForm(emptyForm);}}><MdAdd/> New Application</button>
      </div>

      <div className="stat-grid" style={{gridTemplateColumns:'repeat(4,1fr)',marginBottom:20}}>
        <StatCard label="In Queue"     value={(statMap['Pending']?.count||0)+(statMap['AI-Approved']?.count||0)} />
        <StatCard label="AI-Approved"  value={statMap['AI-Approved']?.count||0} color="var(--accent2)"/>
        <StatCard label="Needs Review" value={statMap['Under-Review']?.count||0} color="var(--amber)"/>
        <StatCard label="Approved"     value={statMap['Approved']?.count||0} color="var(--blue)"/>
      </div>

      <div className="card">
        <TabBar tabs={tabs} active={tab} onChange={setTab}/>
        {isLoading ? <LoadingPage/> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Staff</th><th>Department</th><th>Current Rank</th><th>Target Rank</th><th>AI Score</th><th>AI Decision</th><th>Status</th><th></th></tr>
              </thead>
              <tbody>
                {(data?.data||[]).length===0
                  ? <tr><td colSpan={8}><EmptyState message="No promotion applications."/></td></tr>
                  : (data.data).map(p=>(
                    <tr key={p._id}>
                      <td><strong>{p.staff?.firstName} {p.staff?.lastName}</strong><div style={{fontSize:11,color:'var(--text3)',fontFamily:'var(--mono)'}}>{p.staff?.staffId}</div></td>
                      <td style={{fontSize:12}}>{p.staff?.department}</td>
                      <td><span className="badge badge-neutral">{p.fromRank||p.fromGradeLevel}</span></td>
                      <td><span className="badge badge-info">{p.toRank||p.toGradeLevel}</span></td>
                      <td style={{minWidth:120}}>{p.aiScore!=null?<ScoreBar score={p.aiScore}/>:'—'}</td>
                      <td>{statusBadge(p.aiDecision||'Pending')}</td>
                      <td>{statusBadge(p.status)}</td>
                      <td>
                        <div style={{display:'flex',gap:4}}>
                          <button className="btn btn-ghost btn-sm btn-icon" onClick={()=>setDetail(p)} title="View details"><FaMicrochip/></button>
                          <button className="btn btn-ghost btn-sm btn-icon" onClick={()=>revetMutation.mutate(p._id)} disabled={revetMutation.isPending} title="Re-vet"><MdRefresh/></button>
                          {(p.status==='AI-Approved'||p.status==='Under-Review') && (
                            <>
                              <button className="btn btn-primary btn-sm" onClick={()=>finalizeMutation.mutate({id:p._id,decision:'approve'})}><MdCheck/></button>
                              <button className="btn btn-ghost btn-sm"  onClick={()=>finalizeMutation.mutate({id:p._id,decision:'reject'})}><MdClose/></button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New Application Modal */}
      <Modal open={modal} onClose={()=>setModal(false)} title="Submit Promotion Application" wide
        footer={
          <>
            <button className="btn btn-ghost" onClick={()=>setModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={()=>applyMutation.mutate(form)} disabled={applyMutation.isPending}>
              {applyMutation.isPending?<><FaMicrochip/> Vetting…</>:<><FaMicrochip/> Submit & Vet with AI</>}
            </button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label">Staff Member *</label>
          <select className="form-input" value={form.staffId} onChange={f('staffId')}>
            <option value="">Select staff…</option>
            {(staffList||[]).map(s=><option key={s._id} value={s._id}>{s.firstName} {s.lastName} — {s.department} ({s.gradeLevel})</option>)}
          </select>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Current Grade Level</label>
            <select className="form-input" value={form.fromGradeLevel} onChange={f('fromGradeLevel')}>
              {GRADES.map(g=><option key={g}>{g}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Target Grade Level</label>
            <select className="form-input" value={form.toGradeLevel} onChange={f('toGradeLevel')}>
              {GRADES.map(g=><option key={g}>{g}</option>)}
            </select>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Current Rank</label>
            <select className="form-input" value={form.fromRank} onChange={f('fromRank')}>
              <option value="">Select…</option>{RANKS.map(r=><option key={r}>{r}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Target Rank</label>
            <select className="form-input" value={form.toRank} onChange={f('toRank')}>
              <option value="">Select…</option>{RANKS.map(r=><option key={r}>{r}</option>)}
            </select>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Publications (peer-reviewed)</label><input className="form-input" type="number" min="0" value={form.publications} onChange={f('publications')}/></div>
          <div className="form-group"><label className="form-label">Teaching Eval Score (0-100)</label><input className="form-input" type="number" min="0" max="100" value={form.teachingEvalScore} onChange={f('teachingEvalScore')}/></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Committee Roles held</label><input className="form-input" type="number" min="0" value={form.committeeRoles} onChange={f('committeeRoles')}/></div>
          <div className="form-group"><label className="form-label">Academic Cycle (e.g. 2024/2025)</label><input className="form-input" placeholder="2024/2025" value={form.cycle} onChange={f('cycle')}/></div>
        </div>

        {aiResult && (
          <div style={{marginTop:14}}>
            <div style={{fontSize:12,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'.07em',marginBottom:8}}>AI Vetting Result</div>
            <AIPanel score={aiResult.aiScore} decision={aiResult.aiDecision} breakdown={aiResult.aiBreakdown} reasons={aiResult.aiReasons}/>
          </div>
        )}
      </Modal>

      {/* Detail Modal */}
      {detail && (
        <Modal open={!!detail} onClose={()=>setDetail(null)} title="AI Vetting Details" wide>
          <AIPanel score={detail.aiScore} decision={detail.aiDecision} breakdown={detail.aiBreakdown} reasons={detail.aiReasons}/>
          <div style={{marginTop:16,padding:14,background:'var(--surface2)',borderRadius:10,fontSize:13}}>
            <div style={{marginBottom:8,fontWeight:600}}>Application Details</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,color:'var(--text2)'}}>
              <div>Publications: <strong>{detail.publications}</strong></div>
              <div>Teaching Eval: <strong>{detail.teachingEvalScore}/100</strong></div>
              <div>Committee Roles: <strong>{detail.committeeRoles}</strong></div>
              <div>Cycle: <strong>{detail.cycle||'—'}</strong></div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
