import FollowupPlan from '../models/FollowupPlan.js';
import FollowupSession from '../models/FollowupSession.js';
import Appointment from '../models/Appointment.js';

// @desc    Get all follow-up plans
// @route   GET /api/followups
// @access  Private
export const getFollowups = async (req, res, next) => {
  try {
    const { status, search } = req.query;

    let plans = await FollowupPlan.find()
      .populate('patient_id', 'patient_name whatsapp_number')
      .populate('doctor_id', 'doctor_name')
      .sort({ createdAt: -1 });

    if (search) {
      const lowerSearch = search.toLowerCase();
      plans = plans.filter(p => 
        (p.patient_id?.patient_name || '').toLowerCase().includes(lowerSearch) ||
        (p.doctor_id?.doctor_name || '').toLowerCase().includes(lowerSearch) ||
        (p.plan_name || '').toLowerCase().includes(lowerSearch)
      );
    }

    const result = [];
    for (const plan of plans) {
      const completedCount = await FollowupSession.countDocuments({ 
        plan_id: plan._id, 
        status: 'COMPLETED' 
      });

      const planObj = plan.toObject();
      planObj.completed_sessions = completedCount;
      const isCompleted = completedCount === plan.total_sessions;
      planObj.status = isCompleted ? 'COMPLETED' : 'IN_PROGRESS';
      
      if (status === 'COMPLETED' && !isCompleted) continue;
      if (status === 'IN_PROGRESS' && isCompleted) continue;
      
      const sessions = await FollowupSession.find({ plan_id: plan._id }).sort({ session_number: 1 });
      planObj.sessions = sessions;

      // Legacy mappings
      planObj.id = plan._id;
      planObj.patient_name = plan.patient_id?.patient_name;
      planObj.doctor_name = plan.doctor_id?.doctor_name;
      planObj.whatsapp_number = plan.patient_id?.whatsapp_number;
      
      result.push(planObj);
    }

    res.json(result);
  } catch (error) {
    next(error);
  }
};

// @desc    Create follow-up plan
// @route   POST /api/followups
// @access  Private
export const createFollowupPlan = async (req, res, next) => {
  try {
    const { appointmentId, planName, intervalType, totalSessions, sessions, notes } = req.body;
    
    // Complete the original appointment
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      res.status(404);
      throw new Error('Appointment not found');
    }
    
    appointment.appointment_status = 'COMPLETED';
    await appointment.save();

    // Create the Follow-up Plan
    const plan = await FollowupPlan.create({
      patient_id: appointment.patient_id,
      doctor_id: appointment.doctor_id,
      original_appointment_id: appointment._id,
      plan_name: planName,
      interval_type: intervalType,
      total_sessions: totalSessions
    });

    // Create Follow-up Sessions
    if (sessions && sessions.length > 0) {
      const sessionDocs = sessions.map(s => ({
        plan_id: plan._id,
        session_number: s.session_number,
        expected_date: new Date(s.expected_date),
        status: 'PENDING'
      }));
      await FollowupSession.insertMany(sessionDocs);
    }

    res.status(201).json({ success: true, data: plan });
  } catch (error) {
    next(error);
  }
};
