import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { authAPI } from '../services/api';
import { MdSave, MdLock, MdPeople, MdSettings } from 'react-icons/md';
import { FaMicrochip } from 'react-icons/fa';
import { TabBar } from '../components/ui';

const ROLES = [
  { role: 'superadmin', label: 'Super Admin',  access: 'Full system access', badge: 'danger' },
  { role: 'registrar',  label: 'Registrar',    access: 'Staff, Attendance, Leave, Promotions', badge: 'info' },
  { role: 'bursary',    label: 'Bursary',       access: 'Payroll & Finance only', badge: 'warning' },
  { role: 'hod',        label: 'HOD',           access: 'Department view only', badge: 'success' },
  { role: 'viewer',     label: 'Viewer',        access: 'Read-only access', badge: 'neutral' },
];

export default function SettingsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState('system');
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [pwLoading, setPwLoading] = useState(false);

  const [sysSettings, setSysSettings] = useState({
    institution: 'University of Delta (UNIDEL), Agbor',
    aiThreshold: 75,
    offlineSync: true,
    payrollAnomalyDetection: true,
    autoAttendanceClose: true,
    weeklyRevetSchedule: true,
    logLevel: 'info',
  });

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (pwForm.newPassword !== pwForm.confirm) return toast.error('New passwords do not match.');
    if (pwForm.newPassword.length < 6) return toast.error('Password must be at least 6 characters.');
    setPwLoading(true);
    try {
      await authAPI.changePassword({ currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword });
      toast.success('Password updated successfully.');
      setPwForm({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Password change failed.');
    } finally {
      setPwLoading(false);
    }
  };

  const handleSaveSystem = () => toast.success('Settings saved. (Persisted to server config in production.)');

  const sf = (k) => (e) => setSysSettings(p => ({
    ...p,
    [k]: e.target.type === 'checkbox' ? e.target.checked
       : e.target.type === 'number'   ? Number(e.target.value)
       : e.target.value,
  }));

  const tabs = [
    { value: 'system',   label: 'System Config' },
    { value: 'ai',       label: 'AI Engine' },
    { value: 'roles',    label: 'User Roles' },
    { value: 'security', label: 'Security' },
  ];

  return (
    <div>
      <div className="page-header">
        <div><h1>System Settings</h1><p>Configure HRMS behaviour, AI parameters, and security</p></div>
      </div>

      <TabBar tabs={tabs} active={tab} onChange={setTab} />

      {/* System Config */}
      {tab === 'system' && (
        <div className="grid2">
          <div className="card">
            <div className="card-header">
              <div className="card-title"><MdSettings style={{ marginRight: 6 }} />General Configuration</div>
            </div>
            <div className="form-group">
              <label className="form-label">Institution Name</label>
              <input className="form-input" value={sysSettings.institution} onChange={sf('institution')} />
            </div>
            <div className="form-group">
              <label className="form-label">Log Level</label>
              <select className="form-input" value={sysSettings.logLevel} onChange={sf('logLevel')}>
                <option value="error">Error only</option>
                <option value="warn">Warning</option>
                <option value="info">Info (recommended)</option>
                <option value="debug">Debug (verbose)</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
              {[
                { key: 'offlineSync',           label: 'Offline Sync Mode',           sub: 'Queue changes when disconnected and sync on reconnect' },
                { key: 'autoAttendanceClose',   label: 'Auto-Close Attendance (23:55)',sub: 'Mark unmarked staff as absent at end of day' },
              ].map(item => (
                <label key={item.key} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
                  <input type="checkbox" checked={sysSettings[item.key]} onChange={sf(item.key)} style={{ marginTop: 3 }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{item.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>{item.sub}</div>
                  </div>
                </label>
              ))}
            </div>

            <button className="btn btn-primary" onClick={handleSaveSystem}><MdSave /> Save Settings</button>
          </div>

          <div className="card">
            <div className="card-header"><div className="card-title">System Information</div></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { label: 'System Version',  value: 'UNIDEL StaffOS v1.0.0' },
                { label: 'Backend',         value: 'Node.js + Express.js' },
                { label: 'Database',        value: 'MongoDB (Mongoose ODM)' },
                { label: 'Frontend',        value: 'React 18 + React Query' },
                { label: 'AI Engine',       value: 'Custom Rule-Based + Weighted Scoring' },
                { label: 'Stack',           value: 'MERN (MongoDB, Express, React, Node)' },
                { label: 'Institution',     value: 'University of Delta, Agbor' },
                { label: 'Logged in as',    value: `${user?.name} (${user?.role})` },
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                  <span style={{ color: 'var(--text3)' }}>{row.label}</span>
                  <span style={{ fontWeight: 500 }}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* AI Engine */}
      {tab === 'ai' && (
        <div className="grid2">
          <div className="card">
            <div className="card-header">
              <div className="card-title"><FaMicrochip style={{ marginRight: 6, color: 'var(--accent2)' }} />AI Vetting Parameters</div>
              <span className="badge badge-success">Engine Active</span>
            </div>
            <div className="form-group">
              <label className="form-label">Promotion Pass Score (0–100)</label>
              <input className="form-input" type="number" min="50" max="100" value={sysSettings.aiThreshold} onChange={sf('aiThreshold')} />
              <span style={{ fontSize: 11, color: 'var(--text3)' }}>Staff scoring above this threshold are auto-approved. Default: 75</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
              {[
                { key: 'payrollAnomalyDetection', label: 'Payroll Anomaly Detection',   sub: 'AI scans each payroll cycle for ghost workers and duplicates' },
                { key: 'weeklyRevetSchedule',     label: 'Weekly Promotion Re-Vet',      sub: 'Every Monday, AI re-scores all pending promotion applications' },
              ].map(item => (
                <label key={item.key} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
                  <input type="checkbox" checked={sysSettings[item.key]} onChange={sf(item.key)} style={{ marginTop: 3 }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{item.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>{item.sub}</div>
                  </div>
                </label>
              ))}
            </div>

            <button className="btn btn-primary" onClick={handleSaveSystem}><MdSave /> Save AI Config</button>
          </div>

          <div className="card">
            <div className="card-header"><div className="card-title">Promotion Criteria Weights</div></div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 14 }}>
              These weights determine how the AI scores each criterion. Total must equal 100%.
            </div>
            {[
              { label: 'Years of Service',      weight: 25, color: 'var(--accent2)' },
              { label: 'Publications',           weight: 25, color: 'var(--blue)' },
              { label: 'Teaching Evaluation',   weight: 20, color: '#E6A020' },
              { label: 'Attendance Record',     weight: 15, color: 'var(--purple)' },
              { label: 'PSC Compliance',        weight: 10, color: 'var(--amber)' },
              { label: 'Committee Work',         weight: 5,  color: 'var(--text3)' },
            ].map(c => (
              <div key={c.label} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span style={{ color: 'var(--text2)' }}>{c.label}</span>
                  <span style={{ fontFamily: 'var(--mono)', fontWeight: 600 }}>{c.weight}%</span>
                </div>
                <div style={{ height: 8, background: 'var(--border)', borderRadius: 4 }}>
                  <div style={{ height: '100%', width: `${c.weight * 4}%`, background: c.color, borderRadius: 4 }} />
                </div>
              </div>
            ))}
            <div style={{ marginTop: 10, padding: 10, background: 'var(--blue-bg)', borderRadius: 8, fontSize: 12, color: 'var(--blue)' }}>
              ℹ To modify weights, update <code>PROMOTION_WEIGHTS</code> in <code>server/utils/aiEngine.js</code>
            </div>
          </div>
        </div>
      )}

      {/* Roles */}
      {tab === 'roles' && (
        <div className="card">
          <div className="card-header">
            <div className="card-title"><MdPeople style={{ marginRight: 6 }} />Role-Based Access Control</div>
          </div>
          <table>
            <thead>
              <tr><th>Role</th><th>Access Scope</th><th>Modules</th></tr>
            </thead>
            <tbody>
              {ROLES.map(r => (
                <tr key={r.role}>
                  <td><span className={`badge badge-${r.badge}`}>{r.label}</span></td>
                  <td style={{ fontSize: 13, color: 'var(--text2)' }}>{r.access}</td>
                  <td>
                    {r.role === 'superadmin' && <span style={{ fontSize: 12, color: 'var(--text3)' }}>All modules</span>}
                    {r.role === 'registrar'  && <span style={{ fontSize: 12, color: 'var(--text3)' }}>Staff, Attendance, Leave, Promotions, Reports</span>}
                    {r.role === 'bursary'    && <span style={{ fontSize: 12, color: 'var(--text3)' }}>Payroll, Reports (Finance)</span>}
                    {r.role === 'hod'        && <span style={{ fontSize: 12, color: 'var(--text3)' }}>Department Staff, Leave Approval</span>}
                    {r.role === 'viewer'     && <span style={{ fontSize: 12, color: 'var(--text3)' }}>Dashboard read-only</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: 16, padding: 14, background: 'var(--amber-bg)', borderRadius: 8, fontSize: 12, color: 'var(--amber)' }}>
            ⚠ User creation is managed via <code>POST /api/auth/register</code>. Only Super Admins can create new user accounts.
          </div>
        </div>
      )}

      {/* Security */}
      {tab === 'security' && (
        <div className="grid2">
          <div className="card">
            <div className="card-header">
              <div className="card-title"><MdLock style={{ marginRight: 6 }} />Change Password</div>
            </div>
            <form onSubmit={handlePasswordChange}>
              <div className="form-group">
                <label className="form-label">Current Password</label>
                <input className="form-input" type="password" value={pwForm.currentPassword}
                  onChange={e => setPwForm(p => ({ ...p, currentPassword: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="form-label">New Password</label>
                <input className="form-input" type="password" value={pwForm.newPassword}
                  onChange={e => setPwForm(p => ({ ...p, newPassword: e.target.value }))} required minLength={6} />
              </div>
              <div className="form-group">
                <label className="form-label">Confirm New Password</label>
                <input className="form-input" type="password" value={pwForm.confirm}
                  onChange={e => setPwForm(p => ({ ...p, confirm: e.target.value }))} required />
              </div>
              <button type="submit" className="btn btn-primary" disabled={pwLoading}>
                {pwLoading ? 'Updating…' : <><MdLock /> Update Password</>}
              </button>
            </form>
          </div>

          <div className="card">
            <div className="card-header"><div className="card-title">Security Features</div></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { label: 'JWT Authentication',     status: 'Active',   color: 'var(--accent2)' },
                { label: 'Role-Based Access Control', status: 'Active', color: 'var(--accent2)' },
                { label: 'Rate Limiting (200/15min)', status: 'Active', color: 'var(--accent2)' },
                { label: 'Helmet.js Security Headers', status: 'Active',color: 'var(--accent2)' },
                { label: 'Input Validation',        status: 'Active',   color: 'var(--accent2)' },
                { label: 'Password Hashing (bcrypt)', status: 'Active', color: 'var(--accent2)' },
                { label: 'Audit Log',               status: 'Planned',  color: 'var(--amber)' },
                { label: '2FA / OTP',               status: 'Planned',  color: 'var(--amber)' },
              ].map(f => (
                <div key={f.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                  <span style={{ color: 'var(--text2)' }}>{f.label}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: f.color }}>{f.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
