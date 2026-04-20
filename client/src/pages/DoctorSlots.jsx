import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api.js';

// Utility: format slot date for display
const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

// Utility: format time "09:00:00" → "9:00 AM"
const formatTime = (t) => {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
};

// Today's date as YYYY-MM-DD
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Group slots by date
const groupByDate = (slots) => {
  const map = {};
  slots.forEach((s) => {
    const key = s.slot_date ? s.slot_date.substring(0, 10) : 'unknown';
    if (!map[key]) map[key] = [];
    map[key].push(s);
  });
  return map;
};

const AddSlotModal = ({ doctorId, onClose, onSuccess }) => {
  const [form, setForm] = useState({
    slot_date: todayStr(),
    start_time: '09:00',
    end_time: '10:00',
    max_capacity: 4,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.start_time >= form.end_time) {
      setError('End time must be after start time');
      return;
    }
    setSaving(true);
    try {
      await api.post('/slots', {
        doctor_id: doctorId,
        slot_date: form.slot_date,
        start_time: form.start_time + ':00',
        end_time: form.end_time + ':00',
        max_capacity: parseInt(form.max_capacity),
      });
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create slot');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-blue-50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <span className="text-white text-sm">🕐</span>
            </div>
            <h3 className="text-lg font-bold text-gray-900">Add New Slot</h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Date *</label>
            <input
              type="date"
              name="slot_date"
              value={form.slot_date}
              onChange={handleChange}
              required
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Start Time *</label>
              <input
                type="time"
                name="start_time"
                value={form.start_time}
                onChange={handleChange}
                required
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">End Time *</label>
              <input
                type="time"
                name="end_time"
                value={form.end_time}
                onChange={handleChange}
                required
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Max Capacity</label>
            <input
              type="number"
              name="max_capacity"
              value={form.max_capacity}
              onChange={handleChange}
              min={1}
              max={50}
              required
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors text-sm disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save Slot'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const DoctorSlots = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [doctor, setDoctor] = useState(null);
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [togglingId, setTogglingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [togglingDoctor, setTogglingDoctor] = useState(false);
  const [filterDate, setFilterDate] = useState('');
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [docRes, slotsRes] = await Promise.all([
        api.get(`/doctors/${id}`),
        api.get(`/slots/doctor/${id}`),
      ]);
      setDoctor(docRes.data);
      setSlots(slotsRes.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Listen for the "Add Slot" button click from the header
  useEffect(() => {
    const handler = () => setShowAddModal(true);
    window.addEventListener('open-add-slot-modal', handler);
    return () => window.removeEventListener('open-add-slot-modal', handler);
  }, []);

  const handleDoctorToggle = async () => {
    if (!doctor) return;
    setTogglingDoctor(true);
    try {
      await api.put(`/doctors/${id}`, {
        doctor_name: doctor.doctor_name,
        specialization: doctor.specialization,
        practice_area: doctor.practice_area,
        phone: doctor.phone,
        email: doctor.email,
        is_active: !doctor.is_active,
      });
      showToast(
        `Dr. ${doctor.doctor_name} is now ${!doctor.is_active ? 'active' : 'inactive'}`,
        'success'
      );
      await fetchData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to update doctor status', 'error');
    } finally {
      setTogglingDoctor(false);
    }
  };

  const handleToggle = async (slot) => {
    setTogglingId(slot._id);
    try {
      await api.patch(`/slots/${slot._id}`, { is_active: !slot.is_active });
      showToast(`Slot ${!slot.is_active ? 'activated' : 'deactivated'} successfully`);
      await fetchData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to update slot', 'error');
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (slotId) => {
    if (!window.confirm('Delete this slot? This cannot be undone.')) return;
    setDeletingId(slotId);
    try {
      await api.delete(`/slots/${slotId}`);
      showToast('Slot deleted successfully');
      await fetchData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to delete slot', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  // Filter slots by date
  const filteredSlots = filterDate
    ? slots.filter((s) => s.slot_date && s.slot_date.startsWith(filterDate))
    : slots;

  const grouped = groupByDate(filteredSlots);
  const sortedDates = Object.keys(grouped).sort();

  const activeCount = slots.filter((s) => s.is_active).length;
  const totalCount = slots.length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin inline-block w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full mb-4"></div>
          <p className="text-gray-500 text-sm">Loading doctor & slots...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-lg mx-auto mt-10">
        <div className="bg-red-50 border border-red-200 text-red-700 px-5 py-4 rounded-xl text-sm">{error}</div>
        <button onClick={() => navigate('/doctors')} className="mt-4 text-indigo-600 hover:underline text-sm">
          ← Back to Doctors
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-medium text-white transition-all ${
            toast.type === 'error' ? 'bg-red-500' : 'bg-emerald-500'
          }`}
        >
          {toast.msg}
        </div>
      )}

      {/* Add Slot Modal */}
      {showAddModal && (
        <AddSlotModal
          doctorId={id}
          onClose={() => setShowAddModal(false)}
          onSuccess={async () => {
            showToast('Slot added successfully!');
            await fetchData();
          }}
        />
      )}

      {/* Back Button */}
      <button
        onClick={() => navigate('/doctors')}
        className="inline-flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
      >
        <span>←</span> Back to Doctors
      </button>

      {/* Doctor Profile Card */}
      {doctor && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-600 via-indigo-500 to-blue-500 px-6 py-5">
            <div className="flex items-center gap-4">
              {/* Avatar */}
              <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-3xl flex-shrink-0 shadow">
                👨‍⚕️
              </div>
              <div className="text-white">
                <h2 className="text-xl font-bold">{doctor.doctor_name}</h2>
                {doctor.specialization && (
                  <p className="text-indigo-100 text-sm mt-0.5">{doctor.specialization}</p>
                )}
                {doctor.practice_area && (
                  <p className="text-indigo-200 text-xs mt-0.5">{doctor.practice_area}</p>
                )}
              </div>
              <div className="ml-auto flex-shrink-0 flex flex-col items-end gap-2">
                {/* Doctor Active/Inactive Toggle */}
                <button
                  onClick={handleDoctorToggle}
                  disabled={togglingDoctor}
                  className={`relative inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border-2 transition-all duration-200 shadow-sm ${
                    doctor.is_active
                      ? 'bg-emerald-500/20 text-emerald-100 border-emerald-400/50 hover:bg-red-500/20 hover:text-red-100 hover:border-red-400/50'
                      : 'bg-red-500/20 text-red-100 border-red-400/50 hover:bg-emerald-500/20 hover:text-emerald-100 hover:border-emerald-400/50'
                  } disabled:opacity-60 disabled:cursor-not-allowed group`}
                  title={doctor.is_active ? 'Click to deactivate doctor' : 'Click to activate doctor'}
                >
                  {togglingDoctor ? (
                    <>
                      <span className="inline-block w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin"></span>
                      Updating...
                    </>
                  ) : (
                    <>
                      <span className={`w-2 h-2 rounded-full ${
                        doctor.is_active ? 'bg-emerald-300' : 'bg-red-300'
                      }`}></span>
                      {doctor.is_active ? 'Active' : 'Inactive'}
                      <span className="text-white/50 group-hover:text-white/80 transition-colors">⇄</span>
                    </>
                  )}
                </button>
                <span className="text-white/50 text-[10px]">
                  {doctor.is_active ? 'Visible in appointments' : 'Hidden from appointments'}
                </span>
              </div>
            </div>
          </div>

          {/* Doctor detail row */}
          <div className="px-6 py-4 flex flex-wrap gap-6 text-sm text-gray-600 border-t border-gray-50">
            {doctor.email && (
              <span className="flex items-center gap-1.5">
                <span className="text-gray-400">✉</span> {doctor.email}
              </span>
            )}
            {doctor.phone && (
              <span className="flex items-center gap-1.5">
                <span className="text-gray-400">📞</span> {doctor.phone}
              </span>
            )}
            <span className="flex items-center gap-1.5 ml-auto">
              <span className="font-semibold text-indigo-600">{activeCount}</span>
              <span className="text-gray-400">active /</span>
              <span className="font-semibold text-gray-700">{totalCount}</span>
              <span className="text-gray-400">total slots</span>
            </span>
          </div>
        </div>
      )}

      {/* Slots Section */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
              <span className="text-indigo-600 text-sm">🗓</span>
            </div>
            <h3 className="font-bold text-gray-900 text-base">Doctor Slots</h3>
            <span className="bg-indigo-50 text-indigo-600 text-xs font-semibold px-2.5 py-1 rounded-full">
              {totalCount} total
            </span>
          </div>
          <div className="flex items-center gap-3">
            {/* Date filter */}
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
              title="Filter by date"
            />
            {filterDate && (
              <button
                onClick={() => setFilterDate('')}
                className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                Clear
              </button>
            )}
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm flex items-center gap-2"
            >
              <span>+</span> Add Slot
            </button>
          </div>
        </div>

        {/* Slots list */}
        <div className="divide-y divide-gray-50">
          {sortedDates.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-4xl mb-3">🗕</p>
              <p className="font-semibold text-gray-600 mb-1">No slots found</p>
              <p className="text-sm text-gray-400 mb-5">
                {filterDate ? 'No slots for the selected date.' : 'This doctor has no scheduled slots yet.'}
              </p>
              <button
                onClick={() => setShowAddModal(true)}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                Add First Slot
              </button>
            </div>
          ) : (
            sortedDates.map((date) => (
              <div key={date} className="px-6 py-4">
                {/* Date group header */}
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">
                    {formatDate(date)}
                  </span>
                  <div className="flex-1 h-px bg-indigo-100"></div>
                  <span className="text-xs text-gray-400">{grouped[date].length} slot{grouped[date].length !== 1 ? 's' : ''}</span>
                </div>

                {/* Slot rows */}
                <div className="space-y-2">
                  {grouped[date].map((slot) => {
                    const isToggling = togglingId === slot._id;
                    const isDeleting = deletingId === slot._id;
                    const filledPct = slot.max_capacity > 0
                      ? Math.min(100, Math.round((slot.booked / slot.max_capacity) * 100))
                      : 0;

                    return (
                      <div
                        key={slot._id}
                        className={`flex items-center gap-4 p-3.5 rounded-xl border transition-all ${
                          slot.is_active
                            ? 'border-gray-200 bg-gray-50 hover:border-indigo-200 hover:bg-indigo-50/30'
                            : 'border-gray-200 bg-gray-100/60 opacity-70'
                        }`}
                      >
                        {/* Time */}
                        <div className="min-w-[130px]">
                          <p className="text-sm font-bold text-gray-800">
                            {formatTime(slot.start_time)} – {formatTime(slot.end_time)}
                          </p>
                          <div className="flex items-center gap-1 mt-1">
                            <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  filledPct >= 100
                                    ? 'bg-red-500'
                                    : filledPct >= 70
                                    ? 'bg-amber-400'
                                    : 'bg-emerald-500'
                                }`}
                                style={{ width: `${filledPct}%` }}
                              ></div>
                            </div>
                            <span className="text-xs text-gray-400 whitespace-nowrap">
                              {slot.booked ?? 0}/{slot.max_capacity}
                            </span>
                          </div>
                        </div>

                        {/* Status badge */}
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                            slot.is_active
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-gray-200 text-gray-500'
                          }`}
                        >
                          {slot.is_active ? 'Active' : 'Inactive'}
                        </span>

                        {/* Available */}
                        <span className="text-xs text-gray-500 ml-auto">
                          {slot.available ?? slot.max_capacity - (slot.booked ?? 0)} seats left
                        </span>

                        {/* Actions */}
                        <div className="flex items-center gap-2">
                          {/* Toggle */}
                          <button
                            onClick={() => handleToggle(slot)}
                            disabled={isToggling || isDeleting}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 ${
                              slot.is_active
                                ? 'bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200'
                                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
                            }`}
                            title={slot.is_active ? 'Deactivate slot' : 'Activate slot'}
                          >
                            {isToggling ? '...' : slot.is_active ? 'Deactivate' : 'Activate'}
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => handleDelete(slot._id)}
                            disabled={isToggling || isDeleting}
                            className="w-7 h-7 flex items-center justify-center rounded-lg bg-red-50 hover:bg-red-100 text-red-500 border border-red-200 transition-colors disabled:opacity-50 text-sm"
                            title="Delete slot"
                          >
                            {isDeleting ? '...' : '🗑'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default DoctorSlots;
