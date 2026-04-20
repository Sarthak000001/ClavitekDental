import Appointment from '../models/Appointment.js';
import Doctor from '../models/Doctor.js';

// @desc    Get dashboard statistics
// @route   GET /api/dashboard
// @access  Private
export const getDashboardStats = async (req, res, next) => {
  try {
    const { filter_type, doctor_id } = req.query;

    // Build date range based on filter type
    const now = new Date();
    let dateFrom, dateTo;

    switch (filter_type) {
      case 'this-week': {
        const dayOfWeek = now.getDay();
        dateFrom = new Date(now);
        dateFrom.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
        dateFrom.setHours(0, 0, 0, 0);
        dateTo = new Date(dateFrom);
        dateTo.setDate(dateFrom.getDate() + 6);
        dateTo.setHours(23, 59, 59, 999);
        break;
      }
      case 'this-month': {
        dateFrom = new Date(now.getFullYear(), now.getMonth(), 1);
        dateTo = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        break;
      }
      default: { // 'today'
        dateFrom = new Date(now);
        dateFrom.setHours(0, 0, 0, 0);
        dateTo = new Date(now);
        dateTo.setHours(23, 59, 59, 999);
      }
    }

    // Build match filter
    const matchFilter = {
      appointment_date: { $gte: dateFrom, $lte: dateTo }
    };
    if (doctor_id) {
      const mongoose = await import('mongoose');
      matchFilter.doctor_id = new mongoose.default.Types.ObjectId(doctor_id);
    }

    // Get total count
    const total = await Appointment.countDocuments(matchFilter);

    // Get status counts
    const completed = await Appointment.countDocuments({ ...matchFilter, appointment_status: 'COMPLETED' });
    const cancelled = await Appointment.countDocuments({ ...matchFilter, appointment_status: 'CANCELLED' });
    const noShow = await Appointment.countDocuments({ ...matchFilter, appointment_status: 'NO_SHOW' });

    // Doctor breakdown
    const doctors = await Doctor.find({ is_active: true }).lean();
    const doctorBreakdown = [];
    for (const doc of doctors) {
      const count = await Appointment.countDocuments({
        ...matchFilter,
        doctor_id: doc._id
      });
      doctorBreakdown.push({
        _id: doc._id,
        doctor_name: doc.doctor_name,
        count
      });
    }

    res.json({
      success: true,
      data: {
        stats: { total, completed, cancelled, noShow },
        doctorBreakdown,
      }
    });
  } catch (error) {
    next(error);
  }
};
