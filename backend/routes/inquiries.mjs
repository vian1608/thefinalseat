import express from 'express';
import { sendConsultingInquiry } from '../services/email-service.mjs';

const router = express.Router();

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post('/consulting', async (req, res) => {
  try {
    const {
      serviceType,
      name,
      email,
      phone,
      origin,
      destination,
      tripType,
      travelDate,
      returnDate,
      passengers,
      cabinClass,
      notes,
    } = req.body;

    if (!serviceType || !['flights', 'rail', 'consulting-payment'].includes(serviceType)) {
      return res.status(400).json({
        success: false,
        error: 'serviceType must be "flights", "rail", or "consulting-payment".',
      });
    }

    if (!name?.trim() || !email?.trim() || !origin?.trim() || !destination?.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Name, email, origin, and destination are required.',
      });
    }

    if (!emailPattern.test(email.trim())) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a valid email address.',
      });
    }

    const inquiry = {
      serviceType,
      name: name.trim(),
      email: email.trim(),
      phone: phone?.trim() || '',
      origin: origin.trim(),
      destination: destination.trim(),
      tripType: tripType || '',
      travelDate: travelDate || '',
      returnDate: returnDate || '',
      passengers: passengers || '1',
      cabinClass: cabinClass || '',
      notes: notes?.trim() || '',
    };

    const result = await sendConsultingInquiry(inquiry);

    const customerMessage = result.emailed
      ? 'Thank you! Your consulting inquiry was submitted. Our team will contact you shortly.'
      : 'Thank you! Your inquiry was received. Our team will contact you shortly.';

    res.status(201).json({
      success: true,
      message: customerMessage,
      emailed: result.emailed,
    });
  } catch (error) {
    console.error('Consulting inquiry error:', error);
    res.status(500).json({
      success: false,
      error: 'Unable to submit your inquiry right now. Please email support@thefinalseat.com directly.',
    });
  }
});

export default router;
