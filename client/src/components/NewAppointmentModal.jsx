import React, { useState, useEffect } from 'react';
import api from '../services/api.js';

const NewAppointmentModal = ({ isOpen, onClose, onSuccess }) => {
  // Patient state
  const [isNewPatient, setIsNewPatient] = useState(false);
  const [patientSearch, setPatientSearch] = useState('');
  const [patientResults, setPatientResults] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [newPatientName, setNewPatientName] = useState('');
  const [newPatientPhone, setNewPatientPhone] = useState('');

  // Schedule state
  const [doctors, setDoctors] = useState([]);
  const [selectedDoctor, setSelectedDoctor] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [slots, setSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState('');
  const [slotsLoading, setSlotsLoading] = useState(false);

  // Form state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Fetch doctors on mount
  useEffect(() => {
    if (isOpen) {
      api.get('/doctors')
        .then(({ data }) => setDoctors(Array.isArray(data) ? data.filter(d => d.is_active) : []))
        .catch(() => {});

      // Set today's date as default
      const today = new Date().toISOString().split('T')[0];
      setSelectedDate(today);
    }
  }, [isOpen]);

  // Search patients
  useEffect(() => {
    if (patientSearch.length < 2) {
      setPatientResults([]);
      return;
    }
    const timer = setTimeout(() => {
      api.get('/patients', { params: { search: patientSearch } })
        .then(({ data }) => setPatientResults(Array.isArray(data) ? data : []))
        .catch(() => setPatientResults([]));
    }, 300);
    return () => clearTimeout(timer);
  }, [patientSearch]);

  // Fetch slots when doctor + date selected
  useEffect(() => {
    if (selectedDoctor && selectedDate) {
      setSlotsLoading(true);
      api.get('/slots', { params: { doctor_id: selectedDoctor, date: selectedDate } })
        .then(({ data }) => {
          setSlots(Array.isArray(data) ? data : []);
          setSelectedSlot('');
        })
        .catch(() => setSlots([]))
        .finally(() => setSlotsLoading(false));
    }
  }, [selectedDoctor, selectedDate]);

  const resetForm = () => {
    setIsNewPatient(false);
    setPatientSearch('');
    setPatientResults([]);
    setSelectedPatient(null);
    setNewPatientName('');
    setNewPatientPhone('');
    setSelectedDoctor('');
    setSelectedDate(new Date().toISOString().split('T')[0]);
    setSlots([]);
    setSelectedSlot('');
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async () => {
    setError(null);
    setSubmitting(true);

    try {
      let patientId = selectedPatient?._id;

      // If creating a new patient
      if (isNewPatient) {
        if (!newPatientName || !newPatientPhone) {
          throw new Error('Patient name and WhatsApp number are required');
        }
        const phone = newPatientPhone.startsWith('+91') ? newPatientPhone : `+91${newPatientPhone}`;
        const { data: newPatient } = await api.post('/patients', {
          patient_name: newPatientName,
          whatsapp_number: phone,
        });
        patientId = newPatient._id;
      }

      if (!patientId) throw new Error('Please select or create a patient');
      if (!selectedDoctor) throw new Error('Please select a doctor');
      if (!selectedSlot) throw new Error('Please select a time slot');

      const slot = slots.find(s => s._id === selectedSlot);
      if (!slot) throw new Error('Invalid slot selected');

      await api.post('/appointments', {
        patient_id: patientId,
        doctor_id: selectedDoctor,
        slot_id: selectedSlot,
        appointment_date: selectedDate,
        start_time: slot.start_time,
        end_time: slot.end_time,
      });

      handleClose();
      if (onSuccess) onSuccess();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to create appointment');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />

      {/* Modal Card */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center text-lg">📅</div>
            <h3 className="text-lg font-bold text-gray-900">New Appointment</h3>
          </div>
          <button onClick={handleClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-gray-600">✕</button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{error}</div>
          )}

          {/* ── Patient Section ── */}
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
              <span>👤</span> Patient
            </div>

            {!isNewPatient ? (
              <div>
                {selectedPatient ? (
                  <div className="flex items-center justify-between bg-indigo-50 border border-indigo-200 px-4 py-3 rounded-xl">
                    <div className="flex items-center gap-2">
                      <span className="text-indigo-600">✓</span>
                      <span className="text-sm font-medium text-indigo-800">
                        {selectedPatient.patient_name} ({selectedPatient.whatsapp_number})
                      </span>
                    </div>
                    <button onClick={() => setSelectedPatient(null)} className="text-indigo-400 hover:text-indigo-600 text-xs">✕</button>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search by name or WhatsApp number..."
                      value={patientSearch}
                      onChange={(e) => setPatientSearch(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                    />
                    {patientResults.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-10 max-h-40 overflow-y-auto">
                        {patientResults.map((p) => (
                          <button
                            key={p._id}
                            onClick={() => { setSelectedPatient(p); setPatientSearch(''); setPatientResults([]); }}
                            className="w-full text-left px-4 py-2.5 text-sm hover:bg-indigo-50 transition-colors border-b border-gray-50 last:border-0"
                          >
                            <span className="font-medium text-gray-800">{p.patient_name}</span>
                            <span className="text-gray-400 ml-2">{p.whatsapp_number}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <button onClick={() => setIsNewPatient(true)} className="text-xs text-indigo-600 hover:text-indigo-800 mt-2 flex items-center gap-1">
                  <span>➕</span> Add new patient instead
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
                    <input type="text" value={newPatientName} onChange={(e) => setNewPatientName(e.target.value)} placeholder="Full name" className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">WhatsApp *</label>
                    <div className="flex">
                      <span className="px-3 py-2.5 bg-gray-100 border border-r-0 border-gray-300 rounded-l-xl text-sm text-gray-500">+91</span>
                      <input type="tel" value={newPatientPhone} onChange={(e) => setNewPatientPhone(e.target.value)} placeholder="9876543210" maxLength={10} className="w-full px-3 py-2.5 border border-gray-300 rounded-r-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none" />
                    </div>
                  </div>
                </div>
                <button onClick={() => setIsNewPatient(false)} className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
                  <span>🔍</span> Search existing patient instead
                </button>
              </div>
            )}
          </div>

          <hr className="border-gray-100" />

          {/* ── Schedule Section ── */}
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
              <span>📅</span> Schedule
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Doctor *</label>
                <select value={selectedDoctor} onChange={(e) => setSelectedDoctor(e.target.value)} className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none">
                  <option value="">Select doctor...</option>
                  {doctors.map(d => (
                    <option key={d._id} value={d._id}>{d.doctor_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Date *</label>
                <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none" />
              </div>
            </div>

            {/* Time Slot */}
            <div className="mt-3">
              <label className="block text-xs font-medium text-gray-600 mb-1">Time Slot *</label>
              {slotsLoading ? (
                <div className="text-center py-3 text-gray-400 text-sm">Loading slots...</div>
              ) : !selectedDoctor || !selectedDate ? (
                <p className="text-xs text-gray-400 py-2">Select doctor & date first</p>
              ) : slots.length === 0 ? (
                <p className="text-xs text-orange-500 py-2">No slots available for this date</p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {slots.map((slot) => (
                    <button
                      key={slot._id}
                      onClick={() => slot.available > 0 && setSelectedSlot(slot._id)}
                      disabled={slot.available <= 0}
                      className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                        selectedSlot === slot._id
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : slot.available > 0
                            ? 'bg-white text-gray-700 border-gray-200 hover:border-indigo-300'
                            : 'bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed'
                      }`}
                    >
                      {slot.start_time.substring(0, 5)}
                      <span className="block text-[10px] opacity-70">{slot.available} left</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-5 border-t border-gray-100">
          <button onClick={handleClose} className="px-5 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Booking...' : 'Book Appointment'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default NewAppointmentModal;
