import express from 'express';
import { getFollowups, createFollowupPlan } from '../controllers/followupController.js';

const router = express.Router();

router.route('/')
  .get(getFollowups)
  .post(createFollowupPlan);

export default router;
