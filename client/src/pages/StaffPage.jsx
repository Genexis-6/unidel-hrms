import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { staffAPI } from '../services/api';
import { Modal, Badge, LoadingPage, statusBadge, EmptyState } from '../components/ui';
import { MdAdd, MdSearch, MdEdit, MdDelete } from 'react-icons/md';

const DEPARTMENTS = ['Computer Science','Engineering','Medicine','Law','Education','Sciences','Arts','Agriculture','Registry','Bursary','Library','Maintenance','Security','ICT','Medical Centre'];
const CATEGORIES  = ['Academic','Administrative','Technical'];
const GRADES      = ['GL 03','GL 04','GL 05','GL 06','GL 07','GL 08','GL 09','GL 10','GL 11','GL 12','GL 13','GL 14','GL 15','GL 16','GL 17'];
const RANKS = ['Graduate Assistant','Assistant Lecturer','Lecturer II','Lecturer I','Senior Lecturer','Reader','Professor','Officer II','Officer I','Senior Officer','Principal Officer','Assistant Registrar','Deputy Registrar','Registrar','Technologist II','Technologist I','Senior Technologist'];

const emptyForm = { firstName:'', lastName:'', middleName:'', email:'', phone:'', department:'', category:'Academic', gradeLevel:'GL 09', rank:'', dateOfEmployment:'', designation:'', highestQualification:'', publications:0 };

export default function StaffPage() {
  const qc = useQueryClient();
  const [search, setSearch]   = useState('');
  const [deptFilter, setDept] = useState('');
  const [catFilter, setCat]   = useState('');
  const [modal, setModal]     = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm]       = useState(emptyForm);
  const [page, setPage]       = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['staff', page, search, deptFilter, catFilter],
    queryFn: () => staffAPI.getAll({ page, limit:20, search: search||undefined, department: deptFilter||undefined, category: catFilter||undefined }).then(r => r.data),
    placeholderData: (prev) => prev,
  });

  const saveMutation = useMutation({
    mutationFn: (d) => editing ? staffAPI.update(editing._id, d) : staffAPI.create(d),
    onSuccess: () => {
      qc.invalidateQueries(['staff']);
      toast.success(editing ? 'Staff record updated.' : 'Staff member added successfully.');
      setModal(false); setEditing(null); setForm(emptyForm);
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to save.'),
  });

  const openAdd = () => { setEditing(null); setForm(emptyForm); setModal(true); };
  const openEdit = (s) => { setEditing(s); setForm({ ...emptyForm, ...s, dateOfEmployment: s.dateOfEmployment?.split('T')[0] || '' }); setModal(true); };
  const f = (k) => (e) => setForm(p => ({...p, [k]: e.target.value}));

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Staff Directory</h1>
          <p>Manage all academic and non-academic staff records</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}><MdAdd/> Add Staff</button>
      </div>

      {/* Filters */}
      <div style={{display:'flex',gap:10,marginBottom:16,flexWrap:'wrap'}}>
        <div className="search-wrap" style={{flex:1,minWidth:200}}>
          <MdSearch style={{color:'var(--text3)'}}/>
          <input placeholder="Search by name, ID, department…" value={search} onChange={e=>{setSearch(e.target.value);setPage(1)}}/>
        </div>
        <select className="form-input" style={{width:170}} value={deptFilter} onChange={e=>{setDept(e.target.value);setPage(1)}}>
          <option value="">All Departments</option>
          {DEPARTMENTS.map(d=><option key={d}>{d}</option>)}
        </select>
        <select className="form-input" style={{width:150}} value={catFilter} onChange={e=>{setCat(e.target.value);setPage(1)}}>
          <option value="">All Categories</option>
          {CATEGORIES.map(c=><option key={c}>{c}</option>)}
        </select>
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Staff Records</div>
            <div className="card-subtitle">{data?.pagination?.total || 0} total staff</div>
          </div>
        </div>

        {isLoading ? <LoadingPage/> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Staff ID</th><th>Name</th><th>Department</th><th>Category</th><th>Grade</th><th>Rank</th><th>Status</th><th></th></tr>
              </thead>
              <tbody>
                {(data?.data || []).length === 0
                  ? <tr><td colSpan={8}><EmptyState message="No staff records found."/></td></tr>
                  : (data.data).map(s => (
                    <tr key={s._id}>
                      <td style={{fontFamily:'var(--mono)',fontSize:11}}>{s.staffId}</td>
                      <td><strong>{s.firstName} {s.lastName}</strong><div style={{fontSize:11,color:'var(--text3)'}}>{s.email}</div></td>
                      <td>{s.department}</td>
                      <td><Badge type={s.category==='Academic'?'info':s.category==='Administrative'?'purple':'warning'}>{s.category}</Badge></td>
                      <td style={{fontFamily:'var(--mono)',fontSize:12}}>{s.gradeLevel}</td>
                      <td style={{fontSize:12,color:'var(--text2)'}}>{s.rank || '—'}</td>
                      <td>{statusBadge(s.status)}</td>
                      <td>
                        <button className="btn btn-ghost btn-icon btn-sm" onClick={()=>openEdit(s)} title="Edit"><MdEdit/></button>
                      </td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {data?.pagination?.pages > 1 && (
          <div style={{display:'flex',gap:8,justifyContent:'center',marginTop:16}}>
            <button className="btn btn-ghost btn-sm" disabled={page===1} onClick={()=>setPage(p=>p-1)}>← Prev</button>
            <span style={{fontSize:13,color:'var(--text3)',padding:'5px 10px'}}>Page {page} of {data.pagination.pages}</span>
            <button className="btn btn-ghost btn-sm" disabled={page>=data.pagination.pages} onClick={()=>setPage(p=>p+1)}>Next →</button>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <Modal
        open={modal} onClose={()=>{setModal(false);setEditing(null);}}
        title={editing ? 'Edit Staff Record' : 'Add New Staff Member'}
        wide
        footer={
          <>
            <button className="btn btn-ghost" onClick={()=>{setModal(false);setEditing(null);}}>Cancel</button>
            <button className="btn btn-primary" onClick={()=>saveMutation.mutate(form)} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving…' : editing ? 'Update Record' : 'Save Staff'}
            </button>
          </>
        }
      >
        <div className="form-row">
          <div className="form-group"><label className="form-label">First Name *</label><input className="form-input" value={form.firstName} onChange={f('firstName')} placeholder="e.g. Chukwuemeka"/></div>
          <div className="form-group"><label className="form-label">Last Name *</label><input className="form-input" value={form.lastName} onChange={f('lastName')} placeholder="e.g. Okafor"/></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Middle Name</label><input className="form-input" value={form.middleName} onChange={f('middleName')}/></div>
          <div className="form-group"><label className="form-label">Email *</label><input className="form-input" type="email" value={form.email} onChange={f('email')}/></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Phone</label><input className="form-input" value={form.phone} onChange={f('phone')}/></div>
          <div className="form-group"><label className="form-label">Date of Employment *</label><input className="form-input" type="date" value={form.dateOfEmployment} onChange={f('dateOfEmployment')}/></div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Department *</label>
            <select className="form-input" value={form.department} onChange={f('department')}>
              <option value="">Select…</option>{DEPARTMENTS.map(d=><option key={d}>{d}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Category *</label>
            <select className="form-input" value={form.category} onChange={f('category')}>
              {CATEGORIES.map(c=><option key={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Grade Level *</label>
            <select className="form-input" value={form.gradeLevel} onChange={f('gradeLevel')}>
              {GRADES.map(g=><option key={g}>{g}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Rank / Designation</label>
            <select className="form-input" value={form.rank} onChange={f('rank')}>
              <option value="">Select…</option>{RANKS.map(r=><option key={r}>{r}</option>)}
            </select>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Highest Qualification</label>
            <select className="form-input" value={form.highestQualification} onChange={f('highestQualification')}>
              <option value="">Select…</option>
              {['WAEC/NECO','OND','HND','B.Sc/B.A','PGD','M.Sc/M.A','Ph.D','Professor'].map(q=><option key={q}>{q}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Publications (count)</label>
            <input className="form-input" type="number" min="0" value={form.publications} onChange={f('publications')}/>
          </div>
        </div>
      </Modal>
    </div>
  );
}
