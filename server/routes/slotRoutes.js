import express from 'express';
import {
  getAvailableSlots,
  getSlotsByDoctor,
  createSlot,
  updateSlot,
  deleteSlot,
} from '../controllers/slotController.js';

const router = express.Router();

// Get available slots for booking (date + doctor)
router.get('/', getAvailableSlots);

// Get all slots for a specific doctor (management view)
router.get('/doctor/:doctorId', getSlotsByDoctor);

// Create a new slot
router.post('/', createSlot);

// Toggle slot active/inactive or update capacity
router.patch('/:id', updateSlot);

// Delete a slot
router.delete('/:id', deleteSlot);

export default router;
