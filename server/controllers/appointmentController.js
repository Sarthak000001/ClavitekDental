import Appointment from '../models/Appointment.js';

// @desc    Get all appointments (with optional filters)
// @route   GET /api/appointments
// @access  Private
export const getAppointments = async (req, res, next) => {
  try {
    const { filter_type, status, search } = req.query;

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
      default: {
        dateFrom = new Date(now);
        dateFrom.setHours(0, 0, 0, 0);
        dateTo = new Date(now);
        dateTo.setHours(23, 59, 59, 999);
      }
    }

    const filter = {
      appointment_date: { $gte: dateFrom, $lte: dateTo }
    };

    if (status) {
      filter.appointment_status = status;
    }

    const appointments = await Appointment.find(filter)
      .populate('patient_id', 'patient_name whatsapp_number')
      .populate('doctor_id', 'doctor_name specialization')
      .sort({ appointment_date: -1, start_time: 1 });

    res.json({ success: true, data: appointments });
  } catch (error) {
    next(error);
  }
};

// @desc    Create a new appointment
// @route   POST /api/appointments
// @access  Private
export const createAppointment = async (req, res, next) => {
  try {
    const { patient_id, doctor_id, slot_id, appointment_date, start_time, end_time } = req.body;

    const appointment = await Appointment.create({
      patient_id,
      doctor_id,
      slot_id,
      appointment_date,
      start_time,
      end_time,
    });

    res.status(201).json(appointment);
  } catch (error) {
    next(error);
  }
};

// @desc    Update appointment status
// @route   PUT /api/appointments/:id/status
// @access  Private
export const updateAppointmentStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) {
      res.status(404);
      throw new Error('Appointment not found');
    }

    appointment.appointment_status = status;
    if (status === 'CANCELLED') {
      appointment.cancelled_at = new Date();
    }

    await appointment.save();
    res.json(appointment);
  } catch (error) {
    next(error);
  }
};
