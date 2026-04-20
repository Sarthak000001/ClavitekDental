import express from 'express';
import { body, validationResult } from 'express-validator';
import { getPatients, createPatient } from '../controllers/patientController.js';

const router = express.Router();

// Input validation middleware
const validatePatient = [
  body('whatsapp_number').notEmpty().withMessage('WhatsApp number is required'),
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
  .get(getPatients)
  .post(validatePatient, createPatient);

export default router;
