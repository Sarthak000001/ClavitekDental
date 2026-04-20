import React, { useState, useEffect } from 'react';
import api from '../services/api.js';
import ConsultationModal from '../components/ConsultationModal.jsx';

const Appointments = () => {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterType, setFilterType] = useState('today');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [showConsultationModal, setShowConsultationModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filterType, statusFilter, searchQuery]);

  const totalPages = Math.ceil(appointments.length / itemsPerPage);
  const currentAppointments = appointments.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const fetchAppointments = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/appointments', {
        params: {
          filter_type: filterType,
          search: searchQuery,
          status: statusFilter
        }
      });
      setAppointments(Array.isArray(data) ? data : data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load appointments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, [filterType, statusFilter]);

  const handleStatusUpdate = async (id, status) => {
    if (!window.confirm(`Are you sure you want to mark this appointment as ${status}?`)) return;
    try {
      await api.put(`/appointments/${id}/status`, { status });
      await fetchAppointments();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update status');
    }
  };

  const statusBadge = (status) => {
    const styles = {
      BOOKED:    'bg-blue-100 text-blue-700',
      COMPLETED: 'bg-green-100 text-green-700',
      CANCELLED: 'bg-red-100 text-red-700',
      NO_SHOW:   'bg-orange-100 text-orange-700',
    };
    return (
      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${styles[status] || 'bg-gray-100 text-gray-700'}`}>
        {status}
      </span>
    );
  };

  return (
    <div>
      {/* Page Header */}
      <div className="mb-6">
        <p className="text-sm text-gray-500 mt-1">Manage and track patient appointments</p>
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
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Search Patient</label>
            <input
              type="text"
              placeholder="Name or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
            >
              <option value="">All Status</option>
              <option value="BOOKED">Booked</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="NO_SHOW">No-Show</option>
            </select>
          </div>
        </div>
      </div>

      {/* Appointments Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">
            Appointments List (<span className="text-indigo-600">{appointments.length}</span> total)
          </h3>
        </div>

        {loading ? (
          <div className="text-center py-10 text-gray-500">
            <div className="animate-spin inline-block w-8 h-8 border-4 border-indigo-300 border-t-indigo-600 rounded-full mb-3"></div>
            <p>Loading appointments...</p>
          </div>
        ) : error ? (
          <div className="p-4 text-red-600 text-sm">{error}</div>
        ) : appointments.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <p className="text-lg mb-1">📅</p>
            <p>No appointments found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Date</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Slot</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Doctor</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Patient</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">WhatsApp</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody>
                {currentAppointments.map((appt, idx) => (
                  <tr key={appt._id || idx} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4 text-gray-800">
                      {new Date(appt.appointment_date).toLocaleDateString('en-IN')}
                    </td>
                    <td className="py-3 px-4 text-gray-600">{appt.start_time} - {appt.end_time}</td>
                    <td className="py-3 px-4 text-gray-800 font-medium">
                      {appt.doctor_id?.doctor_name || 'N/A'}
                    </td>
                    <td className="py-3 px-4 text-gray-800">
                      {appt.patient_id?.patient_name || 'N/A'}
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      {appt.patient_id?.whatsapp_number || 'N/A'}
                    </td>
                    <td className="py-3 px-4">{statusBadge(appt.appointment_status)}</td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center gap-2">
                        {appt.appointment_status === 'BOOKED' && (
                          <>
                            <button
                              onClick={() => handleStatusUpdate(appt._id, 'COMPLETED')}
                              className="w-7 h-7 flex items-center justify-center rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border border-emerald-200 transition-colors"
                              title="Mark as Completed"
                            >
                              ✓
                            </button>
                            <button
                              onClick={() => {
                                setSelectedAppointment(appt);
                                setShowConsultationModal(true);
                              }}
                              className="w-7 h-7 flex items-center justify-center rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 transition-colors"
                              title="Schedule Follow-up"
                            >
                              ⚕
                            </button>
                            <button
                              onClick={() => handleStatusUpdate(appt._id, 'NO_SHOW')}
                              className="w-7 h-7 flex items-center justify-center rounded-lg bg-orange-50 hover:bg-orange-100 text-orange-600 border border-orange-200 transition-colors"
                              title="Mark as No-Show"
                            >
                              ✕
                            </button>
                            <button
                              onClick={() => handleStatusUpdate(appt._id, 'CANCELLED')}
                              className="w-7 h-7 flex items-center justify-center rounded-lg bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 transition-colors"
                              title="Cancel Appointment"
                            >
                              🗑
                            </button>
                          </>
                        )}
                        {(appt.appointment_status === 'CANCELLED' || appt.appointment_status === 'NO_SHOW') && (
                          <button
                            onClick={() => handleStatusUpdate(appt._id, 'COMPLETED')}
                            className="w-7 h-7 flex items-center justify-center rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border border-emerald-200 transition-colors"
                            title="Mark as Completed"
                          >
                            ✓
                          </button>
                        )}
                        {appt.appointment_status === 'COMPLETED' && (
                          <span className="text-xs text-gray-400">No actions</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && !error && appointments.length > 0 && (
          <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6 rounded-b-xl">
            <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Showing <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="font-medium">{Math.min(currentPage * itemsPerPage, appointments.length)}</span> of <span className="font-medium">{appointments.length}</span> results
                </p>
              </div>
              <div>
                <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="sr-only">Previous</span>
                    <span aria-hidden="true">&lt;</span>
                  </button>
                  {[...Array(totalPages)].map((_, i) => (
                    <button
                      key={i + 1}
                      onClick={() => setCurrentPage(i + 1)}
                      className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold focus:z-20 focus:outline-offset-0 ${
                        currentPage === i + 1 
                          ? 'z-10 bg-indigo-600 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600' 
                          : 'text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="sr-only">Next</span>
                    <span aria-hidden="true">&gt;</span>
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>

      {showConsultationModal && (
        <ConsultationModal 
          isOpen={showConsultationModal}
          onClose={() => setShowConsultationModal(false)}
          appointment={selectedAppointment}
          onSave={fetchAppointments}
        />
      )}
    </div>
  );
};

export default Appointments;
