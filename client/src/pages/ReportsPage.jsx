import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Tooltip, Legend, Filler } from 'chart.js';
import { reportsAPI } from '../services/api';
import { LoadingPage, StatCard } from '../components/ui';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Tooltip, Legend, Filler);

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function ReportsPage() {
  const [year, setYear] = useState(new Date().getFullYear());

  const { data: payrollData, isLoading: payLoading } = useQuery({
    queryKey: ['report-payroll', year],
    queryFn: () => reportsAPI.payroll({ year }).then(r => r.data.data),
  });

  const { data: promoData, isLoading: promoLoading } = useQuery({
    queryKey: ['report-promo'],
    queryFn: () => reportsAPI.promotion().then(r => r.data.data),
  });

  const { data: attData } = useQuery({
    queryKey: ['report-att'],
    queryFn: () => reportsAPI.attendance({}).then(r => r.data.data),
  });

  const monthlyGross = Array(12).fill(0);
  const monthlyNet   = Array(12).fill(0);
  (payrollData?.monthly||[]).forEach(m => {
    monthlyGross[m._id-1] = Math.round(m.totalGross/1e6 * 10) / 10;
    monthlyNet  [m._id-1] = Math.round(m.totalNet/1e6   * 10) / 10;
  });

  const payrollChart = {
    labels: MONTHS,
    datasets: [
      { label: 'Gross (₦M)', data: monthlyGross, backgroundColor: 'rgba(74,140,77,.7)', borderRadius: 6 },
      { label: 'Net (₦M)',   data: monthlyNet,   backgroundColor: 'rgba(26,58,107,.5)', borderRadius: 6 },
    ],
  };

  const promoStatusData = {
    labels: (promoData?.byStatus||[]).map(s=>s._id),
    datasets: [{ data: (promoData?.byStatus||[]).map(s=>s.count), backgroundColor: ['#4A8C4D','#1A3A6B','#E6A020','#C0392B','#9E9890'], borderWidth:0 }],
  };

  const deptPayData = {
    labels: (payrollData?.byDept||[]).slice(0,8).map(d=>d._id),
    datasets: [{ data: (payrollData?.byDept||[]).slice(0,8).map(d=>Math.round(d.totalGross/1e6*10)/10), backgroundColor: '#4A8C4D', borderRadius:6 }],
  };

  const chartOpts = { responsive:true, plugins:{ legend:{ position:'bottom', labels:{ font:{family:'DM Sans',size:11}, padding:10 } } } };
  const barOpts = { ...chartOpts, scales:{ x:{grid:{display:false}}, y:{grid:{color:'#E2DED6'}} } };

  const totalGross = (payrollData?.monthly||[]).reduce((s,m)=>s+m.totalGross,0);
  const totalFlagged = (payrollData?.monthly||[]).reduce((s,m)=>s+m.flagged,0);

  return (
    <div>
      <div className="page-header">
        <div><h1>Reports & Analytics</h1><p>Comprehensive HRMS data insights</p></div>
        <select className="form-input" style={{width:100}} value={year} onChange={e=>setYear(Number(e.target.value))}>
          {[2024,2025,2026].map(y=><option key={y}>{y}</option>)}
        </select>
      </div>

      <div className="stat-grid" style={{marginBottom:22}}>
        <StatCard label="Annual Payroll" value={totalGross?`₦${(totalGross/1e9).toFixed(2)}B`:'—'} />
        <StatCard label="Promotions Processed" value={(promoData?.byStatus||[]).find(s=>s._id==='Approved')?.count||0} color="var(--accent2)"/>
        <StatCard label="Payroll Anomalies" value={totalFlagged} color={totalFlagged>0?'var(--red)':undefined}/>
        <StatCard label="Avg Promo Score" value={promoData?.scoreStats?.avg?Math.round(promoData.scoreStats.avg):0} />
      </div>

      <div className="grid2" style={{marginBottom:20}}>
        <div className="card">
          <div className="card-header"><div className="card-title">Monthly Payroll — {year}</div></div>
          {payLoading ? <LoadingPage/> : <Bar data={payrollChart} options={barOpts} height={110}/>}
        </div>
        <div className="card">
          <div className="card-header"><div className="card-title">Promotion Status Distribution</div></div>
          {promoLoading ? <LoadingPage/> : (
            (promoData?.byStatus||[]).length>0
              ? <Doughnut data={promoStatusData} options={{...chartOpts,cutout:'60%'}}/>
              : <div style={{padding:40,textAlign:'center',color:'var(--text3)'}}>No promotion data.</div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header"><div className="card-title">Payroll by Department (₦M)</div></div>
        {payLoading ? <LoadingPage/> : <Bar data={deptPayData} options={barOpts} height={80}/>}
      </div>

      <div className="card" style={{marginTop:16}}>
        <div className="card-header">
          <div className="card-title">AI Vetting Performance Summary</div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16}}>
          {[{label:'Min Score',val:promoData?.scoreStats?.min},{label:'Average Score',val:promoData?.scoreStats?.avg},{label:'Max Score',val:promoData?.scoreStats?.max}].map(s=>(
            <div key={s.label} style={{background:'var(--surface2)',borderRadius:10,padding:16,textAlign:'center'}}>
              <div style={{fontSize:11,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'.07em'}}>{s.label}</div>
              <div style={{fontSize:30,fontWeight:700,fontFamily:'var(--mono)',color:'var(--accent)',margin:'6px 0'}}>{s.val?Math.round(s.val):0}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
