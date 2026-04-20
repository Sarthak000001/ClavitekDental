import mongoose from 'mongoose';

const patientSchema = new mongoose.Schema(
  {
    whatsapp_number: {
      type: String,
      required: [true, 'WhatsApp number is required'],
      unique: true,
      trim: true,
      index: true
    },
    patient_name: {
      type: String,
      trim: true
    }
  },
  {
    timestamps: true
  }
);

const Patient = mongoose.model('Patient', patientSchema);
export default Patient;
