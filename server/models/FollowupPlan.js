import mongoose from 'mongoose';

const FollowupPlanSchema = new mongoose.Schema({
  patient_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true,
  },
  doctor_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Doctor',
    required: true,
  },
  original_appointment_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment',
    required: true,
  },
  plan_name: {
    type: String,
    required: true,
  },
  interval_type: {
    type: String,
    enum: ['daily', 'weekly', 'monthly', 'custom'],
    default: 'weekly',
  },
  total_sessions: {
    type: Number,
    required: true,
    min: 1,
    max: 20,
  },
}, { timestamps: true });

export default mongoose.model('FollowupPlan', FollowupPlanSchema);
