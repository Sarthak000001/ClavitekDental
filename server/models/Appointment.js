import mongoose from 'mongoose';

const appointmentSchema = new mongoose.Schema(
  {
    patient_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: [true, 'Patient reference is required']
    },
    doctor_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor',
      required: [true, 'Doctor reference is required']
    },
    slot_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DoctorSlot',
      required: [true, 'Slot reference is required']
    },
    appointment_date: {
      type: Date,
      required: [true, 'Appointment date is required']
    },
    start_time: {
      type: String, // Stored as 'HH:mm:ss' to match SQL TIME or 'HH:mm'
      required: [true, 'Start time is required']
    },
    end_time: {
      type: String,
      required: [true, 'End time is required']
    },
    appointment_status: {
      type: String,
      enum: ['BOOKED', 'CANCELLED', 'NO_SHOW', 'COMPLETED'],
      default: 'BOOKED'
    },
    booked_at: {
      type: Date,
      default: Date.now
    },
    cancelled_at: {
      type: Date
    }
  },
  {
    timestamps: true // Gives us createdAt mimicking the original default timestamp
  }
);

// Optional: compound index to quickly find a doctor's appointments on a specific day
appointmentSchema.index({ doctor_id: 1, appointment_date: 1 });

const Appointment = mongoose.model('Appointment', appointmentSchema);
export default Appointment;
