import Patient from '../models/Patient.js';

// @desc    Get all patients
// @route   GET /api/patients
// @access  Private
export const getPatients = async (req, res, next) => {
  try {
    const patients = await Patient.find({});
    res.json(patients);
  } catch (error) {
    next(error);
  }
};

// @desc    Create a patient
// @route   POST /api/patients
// @access  Private
export const createPatient = async (req, res, next) => {
  try {
    const { whatsapp_number, patient_name } = req.body;

    // Check if patient exists
    const patientExists = await Patient.findOne({ whatsapp_number });
    if (patientExists) {
      res.status(400);
      throw new Error('Patient with this WhatsApp number already exists');
    }

    const patient = await Patient.create({
      whatsapp_number,
      patient_name,
    });

    res.status(201).json(patient);
  } catch (error) {
    next(error);
  }
};
