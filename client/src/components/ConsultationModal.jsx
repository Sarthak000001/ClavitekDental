import React, { useState, useEffect } from 'react';
import api from '../services/api.js';

const ConsultationModal = ({ isOpen, onClose, appointment, onSave }) => {
  const [loading, setLoading] = useState(false);
  const [needsFollowup, setNeedsFollowup] = useState('no');
  const [consultationNotes, setConsultationNotes] = useState('');
  const [planName, setPlanName] = useState('');
  const [intervalType, setIntervalType] = useState('weekly');
  const [totalSessions, setTotalSessions] = useState(1);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [previewDates, setPreviewDates] = useState([]);

  useEffect(() => {
    if (isOpen) {
      setNeedsFollowup('no');
      setConsultationNotes('');
      setPlanName('');
      setIntervalType('weekly');
      setTotalSessions(1);
      setStartDate(new Date().toISOString().split('T')[0]);
      setPreviewDates([]);
    }
  }, [isOpen]);

  useEffect(() => {
    if (needsFollowup === 'yes') {
      const dates = [];
      let current = new Date(startDate);
      
      for (let i = 0; i < totalSessions; i++) {
        dates.push({
          session_number: i + 1,
          expected_date: current.toISOString().split('T')[0]
        });
        
        switch (intervalType) {
          case 'daily':
            current.setDate(current.getDate() + 1);
            break;
          case 'weekly':
            current.setDate(current.getDate() + 7);
            break;
          case 'monthly':
            current.setMonth(current.getMonth() + 1);
            break;
          default:
            current.setDate(current.getDate() + 7);
        }
      }
      setPreviewDates(dates);
    }
  }, [needsFollowup, intervalType, totalSessions, startDate]);

  if (!isOpen || !appointment) return null;

  const handleSave = async () => {
    try {
      setLoading(true);
      
      if (needsFollowup === 'yes') {
        if (!planName) return alert('Please enter a plan name');
        
        await api.post('/followups', {
          appointmentId: appointment._id,
          notes: consultationNotes,
          planName,
          intervalType,
          totalSessions,
          sessions: previewDates
        });
      } else {
        await api.put(`/appointments/${appointment._id}/status`, { status: 'COMPLETED' });
      }
      
      onSave(); // Refresh data on parent
      onClose();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to save');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="na-modal-overlay flex items-center justify-center bg-black/50 fixed inset-0 z-50">
      <div className="na-modal-card bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        <div className="na-modal-header flex justify-between items-center p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <span className="text-xl">⚕</span>
            </div>
            <h3 className="text-xl font-bold text-gray-800 m-0">Consultation & Follow-up</h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            ✕
          </button>
        </div>

        <div className="na-modal-body p-6 overflow-y-auto">
          <div className="font-semibold text-gray-700 flex items-center gap-2 mb-4">
            Consultation Details
          </div>
          <div className="mb-6">
            <p className="font-medium mb-1">Patient: <span className="text-gray-500 font-normal">{appointment.patient_id?.patient_name || 'N/A'}</span></p>
            <p className="font-medium mb-4">Doctor: <span className="text-gray-500 font-normal">{appointment.doctor_id?.doctor_name || 'N/A'}</span></p>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Consultation Notes</label>
              <textarea 
                value={consultationNotes} 
                onChange={(e) => setConsultationNotes(e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" 
                style={{height: '80px'}} 
                placeholder="Document your findings, diagnosis, or treatment provided today..."
              />
            </div>
          </div>

          <div className="font-semibold text-gray-700 flex items-center gap-2 mb-4">
            Plan Follow-up Sessions
          </div>

          <div className="mb-4">
            <label className="block text-sm text-gray-700 mb-2">Does the patient need follow-up sessions?</label>
            <div className="flex gap-4 mt-2">
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input type="radio" value="no" checked={needsFollowup === 'no'} onChange={() => setNeedsFollowup('no')} className="w-4 h-4 text-blue-600 focus:ring-blue-500 rounded-full" />
                <span>No follow-up needed</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input type="radio" value="yes" checked={needsFollowup === 'yes'} onChange={() => setNeedsFollowup('yes')} className="w-4 h-4 text-blue-600 focus:ring-blue-500 rounded-full" />
                <span>Create follow-up plan</span>
              </label>
            </div>
          </div>

          {needsFollowup === 'yes' && (
            <div className="mt-4 animate-fade-in">
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">Plan Name (e.g. Root Canal Treatment)</label>
                <input 
                  type="text" 
                  value={planName} 
                  onChange={(e) => setPlanName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                  placeholder="Enter treatment plan name..." 
                />
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Interval Type</label>
                  <select 
                    value={intervalType} 
                    onChange={(e) => setIntervalType(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Total Sessions (Max 20)</label>
                  <input 
                    type="number" 
                    min="1" max="20" 
                    value={totalSessions} 
                    onChange={(e) => setTotalSessions(parseInt(e.target.value) || 1)}
                    className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                  />
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Follow-ups From Date</label>
                <input 
                  type="date" 
                  value={startDate} 
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                />
              </div>

              <div className="border border-gray-200 rounded-lg overflow-hidden mt-6">
                <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 font-medium text-sm text-gray-700">
                  Session Dates Preview
                </div>
                <div className="max-h-[200px] overflow-y-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 font-medium text-gray-500">Session #</th>
                        <th className="px-4 py-3 font-medium text-gray-500">Expected Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewDates.map((d, idx) => (
                        <tr key={idx} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                          <td className="px-4 py-3">Session {d.session_number}</td>
                          <td className="px-4 py-3">{new Date(d.expected_date).toLocaleDateString('en-IN')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

        </div>

        <div className="p-6 border-t border-gray-100 flex justify-end gap-3 bg-gray-50 mt-auto">
          <button onClick={onClose} disabled={loading} className="px-5 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-100 transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} disabled={loading} className="px-5 py-2.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50">
            {loading ? 'Saving...' : '✓ Complete & Save'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConsultationModal;
