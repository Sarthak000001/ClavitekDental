import React, { useState, useEffect } from 'react';
import api from '../services/api.js';

const Followups = () => {
  const [followups, setFollowups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlan, setSelectedPlan] = useState(null);

  useEffect(() => {
    const fetchFollowups = async () => {
      try {
        setLoading(true);
        const { data } = await api.get('/followups', {
          params: { status: activeFilter !== 'ALL' ? activeFilter : '' }
        });
        setFollowups(Array.isArray(data) ? data : data.data || []);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load follow-ups');
      } finally {
        setLoading(false);
      }
    };

    fetchFollowups();
  }, [activeFilter]);

  const tiles = [
    { key: 'ALL', label: 'All Plans', icon: '📋', color: 'indigo' },
    { key: 'IN_PROGRESS', label: 'In Progress', icon: '🕐', color: 'blue' },
    { key: 'COMPLETED', label: 'Completed', icon: '✅', color: 'green' },
  ];

  const filteredFollowups = followups.filter(f => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (f.patient_name || '').toLowerCase().includes(q) ||
      (f.doctor_name || '').toLowerCase().includes(q)
    );
  });

  return (
    <div>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
        <div>
          <p className="text-sm text-gray-500 mt-1">Monitor and manage multi-session patient care</p>
        </div>
        <div className="flex gap-3 items-center">
          <div className="relative">
            <input
              type="text"
              placeholder="Search patient or doctor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none w-64"
            />
            <span className="absolute left-3 top-2.5 text-gray-400 text-sm">🔍</span>
          </div>
        </div>
      </div>

      {/* Status Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {tiles.map((tile) => (
          <button
            key={tile.key}
            onClick={() => setActiveFilter(tile.key)}
            className={`flex items-center gap-3 p-4 rounded-xl border transition-all duration-200 text-left ${
              activeFilter === tile.key
                ? 'bg-indigo-50 border-indigo-200 shadow-sm'
                : 'bg-white border-gray-200 hover:bg-gray-50'
            }`}
          >
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg ${
              activeFilter === tile.key ? 'bg-indigo-100' : 'bg-gray-100'
            }`}>
              {tile.icon}
            </div>
            <div>
              <span className="text-xs text-gray-500 font-medium">{tile.label}</span>
              <p className="text-lg font-bold text-gray-900">
                {tile.key === 'ALL' ? followups.length :
                  followups.filter(f => f.status === tile.key).length}
              </p>
            </div>
          </button>
        ))}
      </div>

      {/* Follow-ups Grid */}
      {loading ? (
        <div className="text-center py-10 text-gray-500">
          <div className="animate-spin inline-block w-8 h-8 border-4 border-indigo-300 border-t-indigo-600 rounded-full mb-3"></div>
          <p>Loading follow-up plans...</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{error}</div>
      ) : filteredFollowups.length === 0 ? (
        <div className="text-center py-10 text-gray-400">
          <p className="text-lg mb-1">🔄</p>
          <p>No follow-up plans found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredFollowups.map((plan, idx) => (
            <div 
              key={plan._id || idx} 
              onClick={() => setSelectedPlan(plan)}
              className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow duration-300 cursor-pointer"
            >
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-gray-900 text-sm">{plan.patient_name || 'Patient'}</h4>
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                  plan.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                  plan.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {plan.status || 'Unknown'}
                </span>
              </div>
              <p className="text-xs text-gray-500 mb-2">Doctor: {plan.doctor_name || 'N/A'}</p>
              <p className="text-xs text-gray-500">Plan: {plan.plan_name || 'Custom'}</p>
              <div className="mt-3 pt-3 border-t border-gray-100">
                <div className="flex justify-between text-xs text-gray-400">
                  <span>Sessions: {plan.completed_sessions || 0}/{plan.total_sessions || 0}</span>
                </div>
                {/* Progress bar */}
                <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2">
                  <div
                    className="bg-indigo-500 h-1.5 rounded-full transition-all duration-500"
                    style={{ width: `${plan.total_sessions ? (plan.completed_sessions / plan.total_sessions * 100) : 0}%` }}
                  ></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Plan History Modal */}
      {selectedPlan && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-fade-in flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-gray-900">{selectedPlan.patient_name || 'Patient'}</h3>
                <p className="text-sm text-gray-500 mt-1">{selectedPlan.plan_name || 'Custom Plan'}</p>
              </div>
              <button 
                onClick={() => setSelectedPlan(null)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
              >
                ✕
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="text-sm font-medium text-gray-500">Doctor</p>
                  <p className="font-semibold text-gray-900">{selectedPlan.doctor_name || 'N/A'}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-500">Interval</p>
                  <p className="font-semibold text-gray-900 capitalize">{selectedPlan.interval_type || 'Weekly'}</p>
                </div>
              </div>

              <h4 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <span className="text-lg">📅</span> Session History
              </h4>
              
              <div className="space-y-3">
                {selectedPlan.sessions && selectedPlan.sessions.length > 0 ? (
                  selectedPlan.sessions.map((session, sIdx) => (
                    <div key={sIdx} className="flex items-center justify-between p-4 rounded-xl border border-gray-100 bg-gray-50">
                      <div>
                        <p className="font-semibold text-gray-800">Session {session.session_number}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          Expected: {new Date(session.expected_date).toLocaleDateString('en-IN', {
                            weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
                          })}
                        </p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        session.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                        session.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-gray-200 text-gray-700'
                      }`}>
                        {session.status}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6 text-gray-500 bg-gray-50 rounded-xl border border-gray-100/50">
                    No sessions found.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Followups;
