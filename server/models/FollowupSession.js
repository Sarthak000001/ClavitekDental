import mongoose from 'mongoose';

const FollowupSessionSchema = new mongoose.Schema({
  plan_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FollowupPlan',
    required: true,
  },
  session_number: {
    type: Number,
    required: true,
  },
  expected_date: {
    type: Date,
    required: true,
  },
  appointment_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment',
  },
  status: {
    type: String,
    enum: ['PENDING', 'BOOKED', 'COMPLETED', 'CANCELLED'],
    default: 'PENDING',
  },
}, { timestamps: true });

export default mongoose.model('FollowupSession', FollowupSessionSchema);
