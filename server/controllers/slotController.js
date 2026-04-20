import DoctorSlot from '../models/DoctorSlot.js';
import Appointment from '../models/Appointment.js';

// @desc    Get available slots for a doctor on a specific date
// @route   GET /api/slots?doctor_id=xxx&date=yyyy-mm-dd
// @access  Private
export const getAvailableSlots = async (req, res, next) => {
  try {
    const { doctor_id, date } = req.query;

    if (!doctor_id || !date) {
      res.status(400);
      throw new Error('doctor_id and date are required');
    }

    const slotDate = new Date(date);
    slotDate.setHours(0, 0, 0, 0);
    const slotDateEnd = new Date(date);
    slotDateEnd.setHours(23, 59, 59, 999);

    const slots = await DoctorSlot.find({
      doctor_id,
      slot_date: { $gte: slotDate, $lte: slotDateEnd },
      is_active: true,
    }).sort({ start_time: 1 });

    const slotsWithAvailability = await Promise.all(
      slots.map(async (slot) => {
        const bookedCount = await Appointment.countDocuments({
          slot_id: slot._id,
          appointment_status: { $ne: 'CANCELLED' },
        });

        return {
          _id: slot._id,
          start_time: slot.start_time,
          end_time: slot.end_time,
          max_capacity: slot.max_capacity,
          booked: bookedCount,
          available: slot.max_capacity - bookedCount,
        };
      })
    );

    res.json(slotsWithAvailability);
  } catch (error) {
    next(error);
  }
};

// @desc    Get all slots for a specific doctor (all dates, all statuses)
// @route   GET /api/slots/doctor/:doctorId
// @access  Private
export const getSlotsByDoctor = async (req, res, next) => {
  try {
    const { doctorId } = req.params;

    const slots = await DoctorSlot.find({ doctor_id: doctorId })
      .sort({ slot_date: 1, start_time: 1 });

    // Attach booked count to each slot
    const slotsWithBookings = await Promise.all(
      slots.map(async (slot) => {
        const bookedCount = await Appointment.countDocuments({
          slot_id: slot._id,
          appointment_status: { $ne: 'CANCELLED' },
        });
        return {
          _id: slot._id,
          doctor_id: slot.doctor_id,
          slot_date: slot.slot_date,
          start_time: slot.start_time,
          end_time: slot.end_time,
          max_capacity: slot.max_capacity,
          is_active: slot.is_active,
          booked: bookedCount,
          available: slot.max_capacity - bookedCount,
          createdAt: slot.createdAt,
        };
      })
    );

    res.json(slotsWithBookings);
  } catch (error) {
    next(error);
  }
};

// @desc    Create a new slot for a doctor
// @route   POST /api/slots
// @access  Private
export const createSlot = async (req, res, next) => {
  try {
    const { doctor_id, slot_date, start_time, end_time, max_capacity } = req.body;

    if (!doctor_id || !slot_date || !start_time || !end_time) {
      res.status(400);
      throw new Error('doctor_id, slot_date, start_time, and end_time are required');
    }

    const slot = new DoctorSlot({
      doctor_id,
      slot_date: new Date(slot_date),
      start_time,
      end_time,
      max_capacity: max_capacity || 4,
      is_active: true,
    });

    const created = await slot.save();
    res.status(201).json(created);
  } catch (error) {
    if (error.code === 11000) {
      res.status(409);
      next(new Error('A slot with this date and time already exists for this doctor'));
    } else {
      next(error);
    }
  }
};

// @desc    Toggle a slot active/inactive (or update capacity)
// @route   PATCH /api/slots/:id
// @access  Private
export const updateSlot = async (req, res, next) => {
  try {
    const { is_active, max_capacity } = req.body;
    const slot = await DoctorSlot.findById(req.params.id);

    if (!slot) {
      res.status(404);
      throw new Error('Slot not found');
    }

    if (is_active !== undefined) slot.is_active = is_active;
    if (max_capacity !== undefined) slot.max_capacity = max_capacity;

    const updated = await slot.save();
    res.json(updated);
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a slot
// @route   DELETE /api/slots/:id
// @access  Private
export const deleteSlot = async (req, res, next) => {
  try {
    const slot = await DoctorSlot.findById(req.params.id);
    if (!slot) {
      res.status(404);
      throw new Error('Slot not found');
    }
    await slot.deleteOne();
    res.json({ message: 'Slot deleted successfully' });
  } catch (error) {
    next(error);
  }
};
