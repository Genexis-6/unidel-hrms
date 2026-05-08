import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('hrms_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401 globally — redirect to login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('hrms_token');
      localStorage.removeItem('hrms_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const authAPI = {
  login:    (data) => api.post('/auth/login', data),
  register: (data) => api.post('/auth/register', data),
  me:       ()     => api.get('/auth/me'),
  changePassword: (data) => api.put('/auth/password', data),
};

// ─── Dashboard ────────────────────────────────────────────────────────────────
export const dashboardAPI = {
  getOverview: () => api.get('/dashboard'),
};

// ─── Staff ───────────────────────────────────────────────────────────────────
export const staffAPI = {
  getAll:   (params) => api.get('/staff', { params }),
  getById:  (id)     => api.get(`/staff/${id}`),
  getStats: ()       => api.get('/staff/stats'),
  create:   (data)   => api.post('/staff', data),
  update:   (id, data) => api.put(`/staff/${id}`, data),
  delete:   (id)     => api.delete(`/staff/${id}`),
};

// ─── Attendance ───────────────────────────────────────────────────────────────
export const attendanceAPI = {
  getAll:       (params)  => api.get('/attendance', { params }),
  getSummary:   (date)    => api.get('/attendance/summary', { params: { date } }),
  getByStaff:   (id, p)   => api.get(`/attendance/staff/${id}`, { params: p }),
  getAnomalies: ()        => api.get('/attendance/anomalies'),
  mark:         (records) => api.post('/attendance', records),
};

// ─── Leave ───────────────────────────────────────────────────────────────────
export const leaveAPI = {
  getAll:   (params)        => api.get('/leave', { params }),
  getById:  (id)            => api.get(`/leave/${id}`),
  apply:    (data)          => api.post('/leave', data),
  approve:  (id, data)      => api.put(`/leave/${id}/approve`, data),
};

// ─── Promotion ───────────────────────────────────────────────────────────────
export const promotionAPI = {
  getAll:    (params)   => api.get('/promotion', { params }),
  getStats:  ()         => api.get('/promotion/stats'),
  apply:     (data)     => api.post('/promotion', data),
  revet:     (id)       => api.post(`/promotion/${id}/revet`),
  finalize:  (id, data) => api.put(`/promotion/${id}/finalize`, data),
};

// ─── Payroll ─────────────────────────────────────────────────────────────────
export const payrollAPI = {
  getAll:        (params)   => api.get('/payroll', { params }),
  generate:      (data)     => api.post('/payroll/generate', data),
  runAudit:      (data)     => api.post('/payroll/audit', data),
  getFlags:      ()         => api.get('/payroll/flags'),
  resolveFlag:   (id)       => api.put(`/payroll/${id}/resolve-flag`),
  getSlip:       (sid, m, y) => api.get(`/payroll/slip/${sid}/${m}/${y}`),
};

// ─── AI Engine ───────────────────────────────────────────────────────────────
export const aiAPI = {
  vetPromotion:   (data) => api.post('/ai/vet-promotion', data),
  checkLeave:     (data) => api.post('/ai/check-leave', data),
  payrollAudit:   (data) => api.post('/ai/payroll-audit', data),
};

// ─── Reports ─────────────────────────────────────────────────────────────────
export const reportsAPI = {
  attendance:  (params) => api.get('/reports/attendance-summary', { params }),
  payroll:     (params) => api.get('/reports/payroll-summary', { params }),
  promotion:   ()       => api.get('/reports/promotion-summary'),
  kpis:        ()       => api.get('/reports/dashboard-kpis'),
};

export default api;

// ─── Audit & Notifications ────────────────────────────────────────────────────
export const auditAPI = {
  getLogs:        (params)  => api.get('/audit/logs', { params }),
  getStats:       ()        => api.get('/audit/logs/stats'),
  getNotifications:(params) => api.get('/audit/notifications', { params }),
  markRead:       (id)      => api.put(`/audit/notifications/${id}/read`),
  markAllRead:    ()        => api.put('/audit/notifications/read-all'),
};

// ─── Clock In/Out ─────────────────────────────────────────────────────────────
export const clockAPI = {
  clockIn:  (staffId) => api.post('/attendance/clockin',  { staffId }),
  clockOut: (staffId) => api.post('/attendance/clockout', { staffId }),
};
