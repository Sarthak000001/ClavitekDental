import React, { useState, useEffect } from 'react';
import api from '../services/api.js';
import KpiCard from '../components/KpiCard.jsx';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const Dashboard = () => {
  const [stats, setStats] = useState({ total: 0, completed: 0, cancelled: 0, noShow: 0 });
  const [doctors, setDoctors] = useState([]);
  const [filterType, setFilterType] = useState('today');
  const [doctorFilter, setDoctorFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch dashboard data
  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        setLoading(true);
        const { data } = await api.get('/dashboard', {
          params: { filter_type: filterType, doctor_id: doctorFilter }
        });
        if (data.success) {
          setStats(data.data.stats);
          setDoctors(data.data.doctorBreakdown || []);
        }
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, [filterType, doctorFilter]);

  const now = new Date();
  const formattedDate = now.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
  const formattedTime = now.toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit'
  });

  const percentage = (count) => stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;

  const pieData = [
    { name: 'Completed', value: stats.completed, color: '#10B981' },
    { name: 'Booked', value: stats.total - (stats.completed + stats.cancelled + stats.noShow), color: '#3B82F6' },
    { name: 'No-Show', value: stats.noShow, color: '#F59E0B' },
    { name: 'Cancelled', value: stats.cancelled, color: '#EF4444' }
  ].filter(d => d.value > 0);

  const exportToCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Dashboard Statistics\n";
    csvContent += `Filter: ${filterType}\n\n`;
    csvContent += "Metric,Value\n";
    csvContent += `Total Appointments,${stats.total}\n`;
    csvContent += `Completed,${stats.completed}\n`;
    csvContent += `Cancelled,${stats.cancelled}\n`;
    csvContent += `No-Show,${stats.noShow}\n\n`;
    csvContent += "Doctor Breakdown\n";
    csvContent += "Doctor Name,Count\n";
    doctors.forEach(d => {
      csvContent += `"${d.doctor_name}",${d.count}\n`;
    });
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `dashboard_data_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToPDF = async () => {
    const element = document.getElementById('dashboard-content');
    if (!element) return;
    try {
      const canvas = await html2canvas(element, { scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`dashboard_report_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) {
      console.error("PDF generation error:", err);
      alert("Failed to generate PDF");
    }
  };

  return (
    <div>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
        <div>
          <p className="text-sm text-gray-500 mt-1">Overview of today's appointments</p>
          <p className="text-xs text-gray-400 mt-1">🕐 {formattedDate} {formattedTime}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportToCSV} className="px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors shadow-sm flex items-center gap-2">
            <span>📄</span> Export CSV
          </button>
          <button onClick={exportToPDF} className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm flex items-center gap-2">
            <span>📊</span> Export PDF
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 shadow-sm">
        <div className="flex flex-wrap gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Filter Type</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
            >
              <option value="today">Today</option>
              <option value="this-week">This Week</option>
              <option value="this-month">This Month</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Doctor</label>
            <select
              value={doctorFilter}
              onChange={(e) => setDoctorFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
            >
              <option value="">All Doctors</option>
              {doctors.map((d) => (
                <option key={d._id || d.id} value={d._id || d.id}>{d.doctor_name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      {loading ? (
        <div className="text-center py-10 text-gray-500">
          <div className="animate-spin inline-block w-8 h-8 border-4 border-indigo-300 border-t-indigo-600 rounded-full mb-3"></div>
          <p>Loading dashboard...</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{error}</div>
      ) : (
        <div id="dashboard-content" className="bg-gray-50/50 -mx-4 px-4 py-2 rounded-xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <KpiCard
              label="Total Appointments"
              value={stats.total}
              sublabel={filterType === 'today' ? 'Today' : filterType}
              icon="📅"
              color="indigo"
            />
            <KpiCard
              label="Completed"
              value={stats.completed}
              sublabel={`${percentage(stats.completed)}% of total`}
              icon="✅"
              color="green"
            />
            <KpiCard
              label="Cancelled"
              value={stats.cancelled}
              sublabel={`${percentage(stats.cancelled)}% of total`}
              icon="❌"
              color="red"
            />
            <KpiCard
              label="No-Show"
              value={stats.noShow}
              sublabel={`${percentage(stats.noShow)}% of total`}
              icon="🚫"
              color="orange"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Chart 1: Bar Chart */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <h3 className="text-base font-semibold text-gray-900 mb-4">Doctor-wise Appointments</h3>
              {doctors.length === 0 ? (
                <p className="text-sm text-gray-500">No data available.</p>
              ) : (
                <div className="h-64 mt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={doctors} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="doctor_name" axisLine={false} tickLine={false} />
                      <YAxis allowDecimals={false} axisLine={false} tickLine={false} />
                      <Tooltip cursor={{ fill: '#f3f4f6' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                      <Bar dataKey="count" fill="#4f46e5" radius={[4, 4, 0, 0]} barSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Chart 2: Pie Chart */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm flex flex-col">
              <h3 className="text-base font-semibold text-gray-900 mb-4">Appointment Status Breakdown</h3>
              {pieData.length === 0 ? (
                <p className="text-sm text-gray-500">No data available.</p>
              ) : (
                <div className="flex-1 min-h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                      <Legend verticalAlign="bottom" height={36} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          {/* Doctor Breakdown Table */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <h3 className="text-base font-semibold text-gray-900 mb-4">Detailed Doctor Breakdown</h3>
            {doctors.length === 0 ? (
              <p className="text-sm text-gray-500">No data available.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Doctor</th>
                      <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {doctors.map((doc, idx) => (
                      <tr key={idx} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                        <td className="py-3 px-4 text-gray-800 font-medium">{doc.doctor_name}</td>
                        <td className="py-3 px-4 text-right">
                          <span className="bg-indigo-100 text-indigo-700 px-2.5 py-1 rounded-full text-xs font-semibold">{doc.count}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
