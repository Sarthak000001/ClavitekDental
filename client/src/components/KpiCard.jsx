import React from 'react';

// Reusable KPI card matching the dashboard statistics cards
const KpiCard = ({ label, value, sublabel, icon, color = 'indigo' }) => {
  const colorClasses = {
    indigo: { bg: 'bg-indigo-50', text: 'text-indigo-600', icon: 'bg-indigo-100 text-indigo-600' },
    green:  { bg: 'bg-green-50',  text: 'text-green-600',  icon: 'bg-green-100 text-green-600' },
    red:    { bg: 'bg-red-50',    text: 'text-red-600',    icon: 'bg-red-100 text-red-600' },
    orange: { bg: 'bg-orange-50', text: 'text-orange-600', icon: 'bg-orange-100 text-orange-600' },
  };

  const c = colorClasses[color] || colorClasses.indigo;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow duration-300">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
          <p className={`text-2xl font-bold mt-1 ${c.text}`}>{value}</p>
          <p className="text-xs text-gray-400 mt-1">{sublabel}</p>
        </div>
        <div className={`w-12 h-12 rounded-xl ${c.icon} flex items-center justify-center text-xl`}>
          {icon}
        </div>
      </div>
    </div>
  );
};

export default KpiCard;
