import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { leaveAPI, staffAPI } from '../services/api';
import { Modal, TabBar, statusBadge, LoadingPage, AIPanel, EmptyState } from '../components/ui';
import { MdAdd, MdCheck, MdClose } from 'react-icons/md';

const LEAVE_TYPES = ['Annual','Sick','Maternity','Paternity','Study','Emergency','Unpaid'];
const emptyForm   = { staffId:'', leaveType:'Annual', startDate:'', endDate:'', daysRequested:'', reason:'' };

export default function LeavePage() {
  const qc = useQueryClient();
  const [tab, setTab]       = useState('Pending');
  const [modal, setModal]   = useState(false);
  const [form, setForm]     = useState(emptyForm);
  const [aiResult, setAiResult] = useState(null);
  const [approveModal, setApproveModal] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['leave', tab],
    queryFn: () => leaveAPI.getAll({ status: tab }).then(r => r.data),
  });

  const { data: staffList } = useQuery({
    queryKey: ['staff-list'],
    queryFn: () => staffAPI.getAll({ limit:200 }).then(r => r.data.data),
  });

  const applyMutation = useMutation({
    mutationFn: (d) => leaveAPI.apply(d),
    onSuccess: (res) => {
      setAiResult(res.data.aiResult);
      qc.invalidateQueries(['leave']);
      toast.success('Leave request submitted and AI-checked.');
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to submit.'),
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, action, comment }) => leaveAPI.approve(id, { action, comment }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries(['leave']);
      toast.success(`Leave ${vars.action === 'approve' ? 'approved' : 'rejected'}.`);
      setApproveModal(null);
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Action failed.'),
  });

  const f = k => e => setForm(p => ({...p, [k]: e.target.value}));

  const handleSubmit = () => {
    if (!form.staffId || !form.startDate || !form.endDate || !form.reason) return toast.error('Fill all required fields.');
    applyMutation.mutate(form);
  };

  const tabs = [
    { value:'Pending',  label:'Pending' },
    { value:'Approved', label:'Approved' },
    { value:'Rejected', label:'Rejected' },
  ];

  return (
    <div>
      <div className="page-header">
        <div><h1>Leave Management</h1><p>AI-validated leave requests and approvals</p></div>
        <button className="btn btn-primary" onClick={()=>{setModal(true);setAiResult(null);setForm(emptyForm);}}>
          <MdAdd/> New Request
        </button>
      </div>

      <div className="card">
        <TabBar tabs={tabs} active={tab} onChange={setTab}/>

        {isLoading ? <LoadingPage/> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Staff</th><th>Department</th><th>Type</th><th>Duration</th><th>Dates</th><th>AI Eligible</th><th>Status</th><th></th></tr>
              </thead>
              <tbody>
                {(data?.data||[]).length === 0
                  ? <tr><td colSpan={8}><EmptyState message={`No ${tab.toLowerCase()} leave requests.`}/></td></tr>
                  : (data.data).map(l => (
                    <tr key={l._id}>
                      <td><strong>{l.staff?.firstName} {l.staff?.lastName}</strong><div style={{fontSize:11,color:'var(--text3)',fontFamily:'var(--mono)'}}>{l.staff?.staffId}</div></td>
                      <td style={{fontSize:12}}>{l.staff?.department}</td>
                      <td><span className="badge badge-info">{l.leaveType}</span></td>
                      <td style={{fontFamily:'var(--mono)'}}>{l.daysRequested}d</td>
                      <td style={{fontSize:12,color:'var(--text2)'}}>
                        {format(new Date(l.startDate),'d MMM')} – {format(new Date(l.endDate),'d MMM yyyy')}
                      </td>
                      <td>
                        {l.aiEligible === true  && <span className="badge badge-success">Eligible</span>}
                        {l.aiEligible === false && <span className="badge badge-danger">Ineligible</span>}
                        {l.aiEligible == null   && <span className="badge badge-neutral">Pending</span>}
                      </td>
                      <td>{statusBadge(l.status)}</td>
                      <td>
                        {l.status === 'Pending' && (
                          <div style={{display:'flex',gap:4}}>
                            <button className="btn btn-sm btn-primary" onClick={()=>setApproveModal({id:l._id,action:'approve'})} title="Approve"><MdCheck/></button>
                            <button className="btn btn-sm btn-ghost" onClick={()=>setApproveModal({id:l._id,action:'reject'})} title="Reject"><MdClose/></button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Apply Modal */}
      <Modal
        open={modal} onClose={()=>setModal(false)}
        title="Submit Leave Request"
        footer={
          <>
            <button className="btn btn-ghost" onClick={()=>setModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSubmit} disabled={applyMutation.isPending}>
              {applyMutation.isPending ? 'Submitting & checking…' : 'Submit Request'}
            </button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label">Staff Member *</label>
          <select className="form-input" value={form.staffId} onChange={f('staffId')}>
            <option value="">Select staff…</option>
            {(staffList||[]).map(s=><option key={s._id} value={s._id}>{s.firstName} {s.lastName} ({s.department})</option>)}
          </select>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Leave Type</label>
            <select className="form-input" value={form.leaveType} onChange={f('leaveType')}>
              {LEAVE_TYPES.map(t=><option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Days Requested</label>
            <input className="form-input" type="number" min="1" max="90" value={form.daysRequested} onChange={f('daysRequested')}/>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Start Date</label><input className="form-input" type="date" value={form.startDate} onChange={f('startDate')}/></div>
          <div className="form-group"><label className="form-label">End Date</label><input className="form-input" type="date" value={form.endDate} onChange={f('endDate')}/></div>
        </div>
        <div className="form-group">
          <label className="form-label">Reason *</label>
          <textarea className="form-input" rows={3} value={form.reason} onChange={f('reason')} placeholder="Brief justification for leave request…"/>
        </div>

        {aiResult && (
          <div style={{marginTop:14}}>
            <div style={{fontSize:12,color:'var(--text3)',marginBottom:8,textTransform:'uppercase',letterSpacing:'.07em'}}>AI Eligibility Result</div>
            <AIPanel score={aiResult.score} decision={aiResult.eligible ? 'Eligible' : 'Ineligible'} reasons={aiResult.reasons}/>
          </div>
        )}
      </Modal>

      {/* Approve/Reject Modal */}
      <Modal
        open={!!approveModal} onClose={()=>setApproveModal(null)}
        title={approveModal?.action === 'approve' ? 'Approve Leave' : 'Reject Leave'}
        footer={
          <>
            <button className="btn btn-ghost" onClick={()=>setApproveModal(null)}>Cancel</button>
            <button
              className={`btn ${approveModal?.action==='approve'?'btn-primary':'btn-danger'}`}
              onClick={()=>approveMutation.mutate(approveModal)}
              disabled={approveMutation.isPending}
            >
              {approveMutation.isPending ? 'Processing…' : approveModal?.action === 'approve' ? 'Approve' : 'Reject'}
            </button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label">Comment (optional)</label>
          <textarea className="form-input" rows={3} placeholder="Add a comment…"
            onChange={e => setApproveModal(p=>({...p,comment:e.target.value}))}
          />
        </div>
      </Modal>
    </div>
  );
}
