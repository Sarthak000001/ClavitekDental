import React, { useState, useEffect } from 'react';
import api from '../services/api.js';
import DoctorCard from '../components/DoctorCard.jsx';

const Doctors = () => {
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchDoctors = async () => {
      try {
        const { data } = await api.get('/doctors');
        setDoctors(data);
        setLoading(false);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to fetch doctors');
        setLoading(false);
      }
    };

    fetchDoctors();
  }, []);

  if (loading) {
    return (
      <div className="text-center py-10 text-gray-500">
        <div className="animate-spin inline-block w-8 h-8 border-4 border-indigo-300 border-t-indigo-600 rounded-full mb-3"></div>
        <p>Loading doctors...</p>
      </div>
    );
  }

  if (error) {
    return <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{error}</div>;
  }

  return (
    <div>
      <div className="mb-6">
        <p className="text-sm text-gray-500 mt-1">Manage doctor availability and time slots</p>
      </div>

      {doctors.length === 0 ? (
        <div className="text-center py-10 text-gray-400">
          <p className="text-lg mb-1">👨‍⚕️</p>
          <p>No doctors found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {doctors.map((doctor) => (
            <DoctorCard key={doctor._id} doctor={doctor} />
          ))}
        </div>
      )}
    </div>
  );
};

export default Doctors;
