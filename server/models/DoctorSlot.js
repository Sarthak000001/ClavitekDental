import mongoose from 'mongoose';

const doctorSlotSchema = new mongoose.Schema(
  {
    doctor_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor',
      required: true,
      index: true
    },
    slot_date: {
      type: Date,
      required: true
    },
    start_time: {
      type: String, // Example: '09:00:00'
      required: true
    },
    end_time: {
      type: String,
      required: true
    },
    max_capacity: {
      type: Number,
      default: 4
    },
    is_active: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

// Enforce unique slot per doctor per date per start/end time combination
doctorSlotSchema.index({ doctor_id: 1, slot_date: 1, start_time: 1, end_time: 1 }, { unique: true });

const DoctorSlot = mongoose.model('DoctorSlot', doctorSlotSchema);
export default DoctorSlot;
