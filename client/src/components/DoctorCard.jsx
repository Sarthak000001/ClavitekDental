import React from 'react';
import { useNavigate } from 'react-router-dom';

const DoctorCard = ({ doctor }) => {
  const navigate = useNavigate();

  const handleManageSlots = (e) => {
    e.stopPropagation();
    navigate(`/doctors/${doctor._id}/slots`);
  };

  return (
    <div
      className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all duration-200 cursor-pointer overflow-hidden"
      onClick={handleManageSlots}
    >
      {/* Card Top Accent */}
      <div className="h-1.5 bg-gradient-to-r from-indigo-500 to-blue-400 group-hover:from-indigo-600 group-hover:to-blue-500 transition-colors"></div>

      <div className="p-5">
        {/* Doctor Info */}
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-2xl flex-shrink-0">
            👨‍⚕️
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold text-gray-900 truncate group-hover:text-indigo-700 transition-colors">
              {doctor.doctor_name}
            </h3>
            {doctor.specialization && (
              <p className="text-sm text-gray-500 mt-0.5 truncate">{doctor.specialization}</p>
            )}
            {doctor.practice_area && (
              <p className="text-xs text-gray-400 mt-0.5 truncate">{doctor.practice_area}</p>
            )}
          </div>

          {/* Status badge */}
          <span
            className={`flex-shrink-0 text-xs font-semibold px-2 py-1 rounded-full ${
              doctor.is_active
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-red-100 text-red-600'
            }`}
          >
            {doctor.is_active ? '● Active' : '● Inactive'}
          </span>
        </div>

        {/* Contact info */}
        {(doctor.email || doctor.phone) && (
          <div className="mt-3 pt-3 border-t border-gray-50 space-y-1">
            {doctor.email && (
              <p className="text-xs text-gray-500 flex items-center gap-1.5 truncate">
                <span className="text-gray-400">✉</span> {doctor.email}
              </p>
            )}
            {doctor.phone && (
              <p className="text-xs text-gray-500 flex items-center gap-1.5">
                <span className="text-gray-400">📞</span> {doctor.phone}
              </p>
            )}
          </div>
        )}

        {/* Footer: Manage Slots button */}
        <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
          <span className="text-xs text-gray-400">Click to manage slots</span>
          <button
            onClick={handleManageSlots}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-sm"
          >
            <span>🗓</span>
            Doctor Slots
            <span className="text-indigo-300">→</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default DoctorCard;
