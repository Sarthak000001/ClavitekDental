import Doctor from '../models/Doctor.js';

// @desc    Get all doctors
// @route   GET /api/doctors
// @access  Public (or Private depending on your auth later)
export const getDoctors = async (req, res, next) => {
  try {
    const doctors = await Doctor.find({});
    res.json(doctors);
  } catch (error) {
    next(error);
  }
};

// @desc    Get single doctor
// @route   GET /api/doctors/:id
// @access  Public
export const getDoctorById = async (req, res, next) => {
  try {
    const doctor = await Doctor.findById(req.params.id);
    if (doctor) {
      res.json(doctor);
    } else {
      res.status(404);
      throw new Error('Doctor not found');
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Create a doctor
// @route   POST /api/doctors
// @access  Private (Admin)
export const createDoctor = async (req, res, next) => {
  try {
    const { doctor_name, specialization, practice_area, phone, email } = req.body;

    const doctor = new Doctor({
      doctor_name,
      specialization,
      practice_area,
      phone,
      email,
    });

    const createdDoctor = await doctor.save();
    res.status(201).json(createdDoctor);
  } catch (error) {
    res.status(400);
    next(error);
  }
};

// @desc    Update a doctor
// @route   PUT /api/doctors/:id
// @access  Private (Admin)
export const updateDoctor = async (req, res, next) => {
  try {
    const { doctor_name, specialization, practice_area, phone, email, is_active } = req.body;

    const doctor = await Doctor.findById(req.params.id);

    if (doctor) {
      doctor.doctor_name = doctor_name || doctor.doctor_name;
      doctor.specialization = specialization || doctor.specialization;
      doctor.practice_area = practice_area || doctor.practice_area;
      doctor.phone = phone || doctor.phone;
      doctor.email = email || doctor.email;
      if (is_active !== undefined) doctor.is_active = is_active;

      const updatedDoctor = await doctor.save();
      res.json(updatedDoctor);
    } else {
      res.status(404);
      throw new Error('Doctor not found');
    }
  } catch (error) {
    next(error);
  }
};
