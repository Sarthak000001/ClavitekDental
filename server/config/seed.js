import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

// Models
import User from '../models/User.js';
import Doctor from '../models/Doctor.js';
import Patient from '../models/Patient.js';
import DoctorSlot from '../models/DoctorSlot.js';
import Appointment from '../models/Appointment.js';

dotenv.config();

const seedData = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB Connected for seeding...');

    // Clear existing data
    await User.deleteMany({});
    await Doctor.deleteMany({});
    await Patient.deleteMany({});
    await DoctorSlot.deleteMany({});
    await Appointment.deleteMany({});
    console.log('Cleared existing data.');

    // ─── USERS ───
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('demo123', salt);

    const users = await User.insertMany([
      { username: 'receptionist', password: hashedPassword, full_name: 'Receptionist User', email: 'receptionist@clinic.com', role: 'receptionist' },
      { username: 'admin', password: hashedPassword, full_name: 'Admin User', email: 'admin@clinic.com', role: 'admin' },
    ]);
    console.log(`✅ ${users.length} users created (password: demo123)`);

    // ─── DOCTORS ───
    const doctors = await Doctor.insertMany([
      { doctor_name: 'Dr. Sharma', specialization: 'General Physician', practice_area: 'General Practice', phone: '+91 98765 43210', email: 'dr.sharma@clinic.com', is_active: true },
      { doctor_name: 'Dr. Patel', specialization: 'Pediatrician', practice_area: 'Pediatrics', phone: '+91 98765 43211', email: 'dr.patel@clinic.com', is_active: true },
      { doctor_name: 'Dr. Kumar', specialization: 'Cardiologist', practice_area: 'Cardiology', phone: '+91 98765 43212', email: 'dr.kumar@clinic.com', is_active: true },
      { doctor_name: 'Dr. Singh', specialization: 'Dermatologist', practice_area: 'Dermatology', phone: '+91 98765 43213', email: 'dr.singh@clinic.com', is_active: false },
    ]);
    console.log(`✅ ${doctors.length} doctors created`);

    // ─── PATIENTS ───
    const patients = await Patient.insertMany([
      { whatsapp_number: '+919876543210', patient_name: 'Raj Kumar' },
      { whatsapp_number: '+919876543211', patient_name: 'Priya Sharma' },
      { whatsapp_number: '+919876543212', patient_name: 'Amit Verma' },
      { whatsapp_number: '+919876543213', patient_name: 'Sneha Reddy' },
      { whatsapp_number: '+919876543214', patient_name: 'Vikram Mehta' },
      { whatsapp_number: '+919876543215', patient_name: 'Anjali Desai' },
      { whatsapp_number: '+919876543216', patient_name: 'Rohan Kapoor' },
    ]);
    console.log(`✅ ${patients.length} patients created`);

    // ─── DOCTOR SLOTS (today, tomorrow, next 5 days) ───
    const activeDoctors = doctors.filter(d => d.is_active);
    const hours = [9, 10, 11, 14, 15, 16, 17];
    const allSlots = [];

    for (let dayOffset = -1; dayOffset <= 6; dayOffset++) {
      const slotDate = new Date();
      slotDate.setDate(slotDate.getDate() + dayOffset);
      slotDate.setHours(0, 0, 0, 0);

      for (const doc of activeDoctors) {
        for (const hour of hours) {
          allSlots.push({
            doctor_id: doc._id,
            slot_date: slotDate,
            start_time: `${String(hour).padStart(2, '0')}:00:00`,
            end_time: `${String(hour + 1).padStart(2, '0')}:00:00`,
            max_capacity: 4,
            is_active: true,
          });
        }
      }
    }

    const slots = await DoctorSlot.insertMany(allSlots);
    console.log(`✅ ${slots.length} doctor slots created`);

    // ─── APPOINTMENTS ───
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Helper to find a slot
    const findSlot = (doctorIdx, date, hour) => {
      return slots.find(s =>
        s.doctor_id.toString() === activeDoctors[doctorIdx]._id.toString() &&
        s.slot_date.getTime() === date.getTime() &&
        s.start_time === `${String(hour).padStart(2, '0')}:00:00`
      );
    };

    const appointmentData = [];

    // Today's appointments
    const slot1 = findSlot(0, today, 9);
    if (slot1) appointmentData.push({ patient_id: patients[0]._id, doctor_id: activeDoctors[0]._id, slot_id: slot1._id, appointment_date: today, start_time: '09:00:00', end_time: '10:00:00', appointment_status: 'BOOKED' });

    const slot2 = findSlot(0, today, 10);
    if (slot2) appointmentData.push({ patient_id: patients[1]._id, doctor_id: activeDoctors[0]._id, slot_id: slot2._id, appointment_date: today, start_time: '10:00:00', end_time: '11:00:00', appointment_status: 'BOOKED' });

    const slot3 = findSlot(1, today, 11);
    if (slot3) appointmentData.push({ patient_id: patients[2]._id, doctor_id: activeDoctors[1]._id, slot_id: slot3._id, appointment_date: today, start_time: '11:00:00', end_time: '12:00:00', appointment_status: 'COMPLETED' });

    const slot4 = findSlot(1, today, 14);
    if (slot4) appointmentData.push({ patient_id: patients[3]._id, doctor_id: activeDoctors[1]._id, slot_id: slot4._id, appointment_date: today, start_time: '14:00:00', end_time: '15:00:00', appointment_status: 'BOOKED' });

    const slot5 = findSlot(2, today, 15);
    if (slot5) appointmentData.push({ patient_id: patients[4]._id, doctor_id: activeDoctors[2]._id, slot_id: slot5._id, appointment_date: today, start_time: '15:00:00', end_time: '16:00:00', appointment_status: 'BOOKED' });

    // Tomorrow's appointments
    const slot6 = findSlot(0, tomorrow, 9);
    if (slot6) appointmentData.push({ patient_id: patients[0]._id, doctor_id: activeDoctors[0]._id, slot_id: slot6._id, appointment_date: tomorrow, start_time: '09:00:00', end_time: '10:00:00', appointment_status: 'BOOKED' });

    const slot7 = findSlot(0, tomorrow, 10);
    if (slot7) appointmentData.push({ patient_id: patients[5]._id, doctor_id: activeDoctors[0]._id, slot_id: slot7._id, appointment_date: tomorrow, start_time: '10:00:00', end_time: '11:00:00', appointment_status: 'BOOKED' });

    const slot8 = findSlot(2, tomorrow, 14);
    if (slot8) appointmentData.push({ patient_id: patients[6]._id, doctor_id: activeDoctors[2]._id, slot_id: slot8._id, appointment_date: tomorrow, start_time: '14:00:00', end_time: '15:00:00', appointment_status: 'CANCELLED', cancelled_at: new Date() });

    // Yesterday's appointments
    const slot9 = findSlot(0, yesterday, 10);
    if (slot9) appointmentData.push({ patient_id: patients[0]._id, doctor_id: activeDoctors[0]._id, slot_id: slot9._id, appointment_date: yesterday, start_time: '10:00:00', end_time: '11:00:00', appointment_status: 'COMPLETED' });

    const slot10 = findSlot(1, yesterday, 14);
    if (slot10) appointmentData.push({ patient_id: patients[1]._id, doctor_id: activeDoctors[1]._id, slot_id: slot10._id, appointment_date: yesterday, start_time: '14:00:00', end_time: '15:00:00', appointment_status: 'CANCELLED', cancelled_at: new Date() });

    const slot11 = findSlot(2, yesterday, 16);
    if (slot11) appointmentData.push({ patient_id: patients[4]._id, doctor_id: activeDoctors[2]._id, slot_id: slot11._id, appointment_date: yesterday, start_time: '16:00:00', end_time: '17:00:00', appointment_status: 'NO_SHOW' });

    const appointments = await Appointment.insertMany(appointmentData);
    console.log(`✅ ${appointments.length} appointments created`);

    console.log('\n🎉 Database seeded successfully!');
    console.log('Login credentials: username=receptionist, password=demo123');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
    process.exit(1);
  }
};

seedData();
