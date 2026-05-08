import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bar, Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend } from 'chart.js';
import { dashboardAPI } from '../services/api';
import { StatCard, ScoreBar, LoadingPage, statusBadge } from '../components/ui';
import { MdPeople, MdEventAvailable, MdTrendingUp, MdWarning } from 'react-icons/md';
import { FaMicrochip } from 'react-icons/fa';
import { format } from 'date-fns';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

const chartOpts = {
  responsive: true,
  plugins: { legend: { display: false } },
  scales: { x: { grid: { display: false } }, y: { grid: { color: '#E2DED6' } } },
};

export default function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => dashboardAPI.getOverview().then(r => r.data.data),
    refetchInterval: 60000,
  });

  if (isLoading) return <LoadingPage />;

  const s = data?.stats || {};
  const deptLabels  = (data?.deptBreakdown || []).map(d => d._id);
  const deptCounts  = (data?.deptBreakdown || []).map(d => d.count);

  const attChartData = {
    labels: ['Present', 'Absent', 'Half-Day'],
    datasets: [{ data: [s.presentToday||0, s.absentToday||0, s.halfDay||0], backgroundColor: ['#4A8C4D','#C0392B','#E6A020'], borderWidth: 0 }],
  };

  const deptChartData = {
    labels: deptLabels,
    datasets: [{ data: deptCounts, backgroundColor: '#4A8C4D', borderRadius: 6 }],
  };

  return (
    <div>
      {/* Stats */}
      <div className="stat-grid">
        <StatCard label="Total Staff" value={s.totalStaff} delta="Active employees" icon={<MdPeople/>} />
        <StatCard label="Present Today" value={s.presentToday} delta={`${s.attendanceRate}% attendance rate`} deltaType="up" icon={<MdEventAvailable/>} color="var(--accent2)" />
        <StatCard label="Pending Promotions" value={s.pendingPromo} delta={`${s.aiApprovedToday} AI-vetted today`} icon={<MdTrendingUp/>} color="var(--blue)" />
        <StatCard label="Payroll Flags" value={s.flaggedPayroll} delta={s.flaggedPayroll > 0 ? 'Requires action' : 'All clear'} deltaType={s.flaggedPayroll > 0 ? 'down' : 'up'} icon={<MdWarning/>} color={s.flaggedPayroll > 0 ? 'var(--red)' : undefined} />
      </div>

      <div className="grid3" style={{ marginBottom: 20 }}>
        {/* Recent Activity */}
        <div className="card">
          <div className="card-header">
            <div><div className="card-title">Recent Leave Requests</div><div className="card-subtitle">Pending approval</div></div>
            <span className="badge badge-warning">{s.pendingLeave} pending</span>
          </div>
          {(data?.recentLeave || []).length === 0
            ? <p style={{color:'var(--text3)',fontSize:13}}>No pending leave requests.</p>
            : (data.recentLeave).map(l => (
              <div key={l._id} style={{ display:'flex', justifyContent:'space-between', padding:'9px 0', borderBottom:'1px solid var(--border)' }}>
                <div>
                  <div style={{fontSize:13,fontWeight:500}}>{l.staff?.firstName} {l.staff?.lastName}</div>
                  <div style={{fontSize:11,color:'var(--text3)'}}>{l.staff?.department} · {format(new Date(l.createdAt),'d MMM yyyy')}</div>
                </div>
                {statusBadge(l.status)}
              </div>
            ))
          }
        </div>

        {/* Attendance Doughnut */}
        <div className="card">
          <div className="card-header"><div className="card-title">Today's Attendance</div></div>
          <div style={{maxWidth:180,margin:'0 auto'}}>
            <Doughnut data={attChartData} options={{ responsive:true, plugins:{ legend:{ position:'bottom', labels:{ font:{ family:'DM Sans', size:11 }, padding:8 } } }, cutout:'65%' }} />
          </div>
          <div style={{display:'flex',justifyContent:'center',gap:16,marginTop:12,fontSize:12}}>
            <span style={{color:'var(--accent2)'}}>● {s.presentToday} Present</span>
            <span style={{color:'#C0392B'}}>● {s.absentToday} Absent</span>
            <span style={{color:'#E6A020'}}>● {s.halfDay} Half</span>
          </div>
        </div>

        {/* AI Summary */}
        <div className="card">
          <div className="card-header">
            <div className="card-title"><FaMicrochip style={{marginRight:6,color:'var(--accent2)'}}/>AI Engine Today</div>
            <span className="badge badge-success">Active</span>
          </div>
          <div style={{background:'var(--accent-bg)',borderRadius:10,padding:14,marginBottom:12}}>
            <div style={{fontSize:11,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'.07em'}}>Auto-Vetted Promotions</div>
            <div style={{fontSize:30,fontWeight:700,fontFamily:'var(--mono)',color:'var(--accent)',margin:'4px 0'}}>{s.aiApprovedToday}</div>
            <div style={{fontSize:12,color:'var(--text2)'}}>of {s.pendingPromo} in queue</div>
          </div>
          {(data?.recentPromo || []).slice(0,3).map(p => (
            <div key={p._id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'7px 0',borderBottom:'1px solid var(--border)'}}>
              <div>
                <div style={{fontSize:13,fontWeight:500}}>{p.staff?.firstName} {p.staff?.lastName}</div>
                <div style={{fontSize:11,color:'var(--text3)'}}>{p.fromRank} → {p.toRank}</div>
              </div>
              {p.aiScore != null && <ScoreBar score={p.aiScore}/>}
            </div>
          ))}
        </div>
      </div>

      {/* Dept Chart */}
      <div className="card">
        <div className="card-header"><div className="card-title">Staff Distribution by Department</div></div>
        <Bar data={deptChartData} options={chartOpts} height={80}/>
      </div>
    </div>
  );
}
