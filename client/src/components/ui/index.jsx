import React from 'react';

// ─── Badge ────────────────────────────────────────────────────────────────────
export const Badge = ({ type = 'neutral', children }) => (
  <span className={`badge badge-${type}`}>{children}</span>
);

export const statusBadge = (status) => {
  const map = {
    Active: 'success', 'On Leave': 'warning', Suspended: 'danger',
    Retired: 'neutral', Terminated: 'danger', Deceased: 'neutral',
    Pending: 'warning', Approved: 'success', Rejected: 'danger',
    Processed: 'success', Flagged: 'danger', Draft: 'neutral', Paid: 'info',
    'AI-Approved': 'success', 'Under-Review': 'warning', Present: 'success',
    Absent: 'danger', 'Half-Day': 'warning', Cancelled: 'neutral',
  };
  return <Badge type={map[status] || 'neutral'}>{status}</Badge>;
};

// ─── Score Bar ────────────────────────────────────────────────────────────────
export const ScoreBar = ({ score }) => {
  const cls = score >= 75 ? 'score-hi' : score >= 50 ? 'score-mid' : 'score-lo';
  const color = score >= 75 ? 'var(--accent2)' : score >= 50 ? '#E6A020' : '#C0392B';
  return (
    <div className="score-bar-wrap">
      <div className="score-bar">
        <div className={`score-fill ${cls}`} style={{ width: `${score}%` }} />
      </div>
      <span className="score-num" style={{ color }}>{score}</span>
    </div>
  );
};

// ─── Modal ────────────────────────────────────────────────────────────────────
export const Modal = ({ open, onClose, title, children, footer, wide }) => {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={wide ? { width: 680 } : {}}>
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: 'var(--text3)', lineHeight: 1 }}>×</button>
        </div>
        {children}
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
};

// ─── Spinner ──────────────────────────────────────────────────────────────────
export const Spinner = ({ size = 20 }) => (
  <div className="spinner" style={{ width: size, height: size }} />
);

export const LoadingPage = () => (
  <div className="loading-page"><Spinner size={28} /><span>Loading…</span></div>
);

// ─── Stat Card ────────────────────────────────────────────────────────────────
export const StatCard = ({ label, value, delta, deltaType, icon, color }) => (
  <div className="stat-card">
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div className="stat-label">{label}</div>
      {icon && <span style={{ fontSize: 20, color: color || 'var(--text3)' }}>{icon}</span>}
    </div>
    <div className="stat-value" style={color ? { color } : {}}>{value ?? '—'}</div>
    {delta && <div className={`stat-delta ${deltaType || ''}`}>{delta}</div>}
  </div>
);

// ─── Empty State ──────────────────────────────────────────────────────────────
export const EmptyState = ({ message = 'No data found.', icon }) => (
  <div className="empty-state">
    {icon && <div style={{ fontSize: 36, marginBottom: 8 }}>{icon}</div>}
    <p>{message}</p>
  </div>
);

// ─── Confirm Dialog ───────────────────────────────────────────────────────────
export const ConfirmDialog = ({ open, onClose, onConfirm, title, message, loading }) => (
  <Modal
    open={open} onClose={onClose} title={title || 'Confirm Action'}
    footer={
      <>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-danger" onClick={onConfirm} disabled={loading}>
          {loading ? <Spinner size={14}/> : 'Confirm'}
        </button>
      </>
    }
  >
    <p style={{ color: 'var(--text2)', fontSize: 14 }}>{message}</p>
  </Modal>
);

// ─── AI Result Panel ──────────────────────────────────────────────────────────
export const AIPanel = ({ score, decision, breakdown, reasons }) => {
  if (!score) return null;
  const decisionColor = decision === 'Approved' ? 'var(--accent2)' : decision === 'Review' ? '#E6A020' : '#C0392B';

  return (
    <div style={{ background: 'linear-gradient(135deg,#0F2D1A,#1A3A6B)', borderRadius: 12, padding: 18, color: '#fff' }}>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,.45)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>
        AI Eligibility Score
      </div>
      <div style={{ fontSize: 36, fontWeight: 700, fontFamily: 'var(--mono)', color: decisionColor }}>{score}/100</div>
      <div style={{ fontSize: 13, color: 'rgba(255,255,255,.6)', marginTop: 4, marginBottom: 14 }}>
        Decision: <strong style={{ color: decisionColor }}>{decision}</strong>
      </div>

      {breakdown && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
          {Object.entries(breakdown).map(([key, val]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', fontSize: 12, gap: 8, color: 'rgba(255,255,255,.7)' }}>
              <span style={{ minWidth: 140 }}>{key.replace(/([A-Z])/g,' $1').replace(/^./,s=>s.toUpperCase())}</span>
              <div style={{ flex:1, height:4, background:'rgba(255,255,255,.15)', borderRadius:2 }}>
                <div style={{ height:'100%', width:`${val}%`, background:'#6EC672', borderRadius:2 }}/>
              </div>
              <span style={{ minWidth:28, textAlign:'right', fontFamily:'var(--mono)', fontWeight:600 }}>{val}</span>
            </div>
          ))}
        </div>
      )}

      {reasons?.length > 0 && (
        <ul style={{ listStyle:'none', fontSize:12, color:'rgba(255,255,255,.55)', display:'flex', flexDirection:'column', gap:4 }}>
          {reasons.map((r,i) => <li key={i}>• {r}</li>)}
        </ul>
      )}
    </div>
  );
};

// ─── Tab Bar ──────────────────────────────────────────────────────────────────
export const TabBar = ({ tabs, active, onChange }) => (
  <div className="tabs">
    {tabs.map(t => (
      <button key={t.value} className={`tab-btn ${active === t.value ? 'active' : ''}`} onClick={() => onChange(t.value)}>
        {t.label}
      </button>
    ))}
  </div>
);
