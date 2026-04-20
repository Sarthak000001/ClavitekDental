import express from 'express';
import { body, validationResult } from 'express-validator';
import {
  getDoctors,
  getDoctorById,
  createDoctor,
  updateDoctor,
} from '../controllers/doctorController.js';

const router = express.Router();

// Input validation middleware
const validateDoctor = [
  body('doctor_name').notEmpty().withMessage('Doctor name is required'),
  body('email').optional().isEmail().withMessage('Must be a valid email address'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  }
];

// Routes
router.route('/')
  .get(getDoctors)
  .post(validateDoctor, createDoctor);

router.route('/:id')
  .get(getDoctorById)
  .put(validateDoctor, updateDoctor);

export default router;
