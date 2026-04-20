import mongoose from 'mongoose';

const doctorSchema = new mongoose.Schema(
  {
    doctor_name: {
      type: String,
      required: [true, 'Doctor name is required'],
      trim: true
    },
    specialization: {
      type: String,
      trim: true
    },
    practice_area: {
      type: String,
      trim: true
    },
    phone: {
      type: String,
      trim: true
    },
    email: {
      type: String,
      trim: true,
      lowercase: true
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

const Doctor = mongoose.model('Doctor', doctorSchema);
export default Doctor;
