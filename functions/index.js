require('dotenv').config();
const functions = require('firebase-functions/v2');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

// Initialize admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// Create Gmail transporter
const gmailTransporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'rozsagyenelaw@yahoo.com',
    pass: 'zgan nkyz tcgv spzo'
  }
});

// Send appointment confirmation email
exports.sendAppointmentConfirmation = functions.https.onCall(async (request) => {
  if (!request.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { 
    appointmentId,
    clientName, 
    clientEmail, 
    appointmentDate,
    appointmentTime,
    appointmentType, 
    notes 
  } = request.data;

  try {
    const mailOptions = {
      from: '"Law Offices of Rozsa Gyene" <rozsagyenelaw@yahoo.com>',
      to: clientEmail,
      subject: 'Appointment Confirmed - Law Offices of Rozsa Gyene',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1e3a8a;">Appointment Confirmed</h2>
          
          <p>Dear ${clientName},</p>
          
          <p>Your appointment has been confirmed!</p>
          
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #1e3a8a;">Appointment Details:</h3>
            <ul style="list-style: none; padding: 0;">
              <li style="margin: 10px 0;"><strong>Date:</strong> ${new Date(appointmentDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</li>
              <li style="margin: 10px 0;"><strong>Time:</strong> ${appointmentTime} (Pacific Time)</li>
              <li style="margin: 10px 0;"><strong>Type:</strong> ${appointmentType}</li>
              ${notes ? `<li style="margin: 10px 0;"><strong>Notes:</strong> ${notes}</li>` : ''}
            </ul>
          </div>
          
          <p>If you need to cancel or reschedule, please log into your client portal at <a href="https://portal.livingtrust-attorneys.com">https://portal.livingtrust-attorneys.com</a></p>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="margin: 5px 0;"><strong>Law Offices of Rozsa Gyene</strong></p>
            <p style="margin: 5px 0;">Estate Planning & Probate</p>
            <p style="margin: 5px 0;">Email: rozsagyenelaw@yahoo.com</p>
          </div>
        </div>
      `
    };

    await gmailTransporter.sendMail(mailOptions);
    console.log(`Confirmation email sent to ${clientEmail} for appointment ${appointmentId}`);
    
    return { success: true, message: 'Email sent successfully' };

  } catch (error) {
    console.error('Error sending confirmation email:', error);
    throw new functions.https.HttpsError('internal', 'Failed to send email');
  }
});

// Send 24-hour reminder emails - runs every hour
exports.send24HourReminders = functions.scheduler.onSchedule('every 1 hours', async (event) => {
  try {
    const now = new Date();
    const tomorrow = new Date(now.getTime() + (24 * 60 * 60 * 1000));
    const tomorrowStart = new Date(tomorrow.setHours(0, 0, 0, 0));
    const tomorrowEnd = new Date(tomorrow.setHours(23, 59, 59, 999));

    const appointmentsSnapshot = await db.collection('appointments')
      .where('appointmentDate', '>=', tomorrowStart)
      .where('appointmentDate', '<=', tomorrowEnd)
      .where('status', '==', 'confirmed')
      .where('remindersSent.24hours', '==', false)
      .get();

    const batch = db.batch();
    const emailPromises = [];

    appointmentsSnapshot.forEach(doc => {
      const appointment = doc.data();
      const appointmentDate = appointment.appointmentDate.toDate();

      const mailOptions = {
        from: '"Law Offices of Rozsa Gyene" <rozsagyenelaw@yahoo.com>',
        to: appointment.clientEmail,
        subject: 'Reminder: Appointment Tomorrow - Law Offices of Rozsa Gyene',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1e3a8a;">Appointment Reminder</h2>
            
            <p>Dear ${appointment.clientName},</p>
            
            <p>This is a friendly reminder about your appointment tomorrow:</p>
            
            <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #1e3a8a;">Appointment Details:</h3>
              <ul style="list-style: none; padding: 0;">
                <li style="margin: 10px 0;"><strong>Date:</strong> ${appointmentDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</li>
                <li style="margin: 10px 0;"><strong>Time:</strong> ${appointmentDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })} (Pacific Time)</li>
                <li style="margin: 10px 0;"><strong>Type:</strong> ${appointment.appointmentType === 'virtual' ? 'Virtual Consultation' : 'In-Person Meeting'}</li>
              </ul>
            </div>
            
            <p>Please arrive 5 minutes early. If you need to cancel or reschedule, please contact us as soon as possible.</p>
            
            <p>Client Portal: <a href="https://portal.livingtrust-attorneys.com">https://portal.livingtrust-attorneys.com</a></p>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 5px 0;"><strong>Law Offices of Rozsa Gyene</strong></p>
              <p style="margin: 5px 0;">Estate Planning & Probate</p>
              <p style="margin: 5px 0;">Email: rozsagyenelaw@yahoo.com</p>
            </div>
          </div>
        `
      };

      emailPromises.push(gmailTransporter.sendMail(mailOptions));

      batch.update(doc.ref, {
        'remindersSent.24hours': true,
        'lastReminderSent': admin.firestore.FieldValue.serverTimestamp()
      });
    });

    await Promise.all(emailPromises);
    await batch.commit();
    
    console.log(`Sent ${appointmentsSnapshot.size} 24-hour reminders`);

  } catch (error) {
    console.error('Error sending 24-hour reminders:', error);
  }
});

// Send 1-hour reminder emails - runs every 15 minutes
exports.send1HourReminders = functions.scheduler.onSchedule('every 15 minutes', async (event) => {
  try {
    const now = new Date();
    const oneHourFromNow = new Date(now.getTime() + (60 * 60 * 1000));
    const rangeStart = new Date(oneHourFromNow.getTime() - (15 * 60 * 1000));
    const rangeEnd = new Date(oneHourFromNow.getTime() + (15 * 60 * 1000));

    const appointmentsSnapshot = await db.collection('appointments')
      .where('appointmentDate', '>=', rangeStart)
      .where('appointmentDate', '<=', rangeEnd)
      .where('status', '==', 'confirmed')
      .where('remindersSent.1hour', '==', false)
      .get();

    const batch = db.batch();
    const emailPromises = [];

    appointmentsSnapshot.forEach(doc => {
      const appointment = doc.data();
      const appointmentDate = appointment.appointmentDate.toDate();

      const mailOptions = {
        from: '"Law Offices of Rozsa Gyene" <rozsagyenelaw@yahoo.com>',
        to: appointment.clientEmail,
        subject: 'Reminder: Appointment in 1 Hour - Law Offices of Rozsa Gyene',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1e3a8a;">Appointment Starting Soon!</h2>
            
            <p>Dear ${appointment.clientName},</p>
            
            <p>Your appointment is in 1 hour!</p>
            
            <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #1e3a8a;">Appointment Details:</h3>
              <ul style="list-style: none; padding: 0;">
                <li style="margin: 10px 0;"><strong>Time:</strong> ${appointmentDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })} (Pacific Time)</li>
                <li style="margin: 10px 0;"><strong>Type:</strong> ${appointment.appointmentType === 'virtual' ? 'Virtual Consultation' : 'In-Person Meeting'}</li>
              </ul>
            </div>
            
            <p>We look forward to seeing you!</p>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 5px 0;"><strong>Law Offices of Rozsa Gyene</strong></p>
              <p style="margin: 5px 0;">Estate Planning & Probate</p>
              <p style="margin: 5px 0;">Email: rozsagyenelaw@yahoo.com</p>
            </div>
          </div>
        `
      };

      emailPromises.push(gmailTransporter.sendMail(mailOptions));

      batch.update(doc.ref, {
        'remindersSent.1hour': true,
        'lastReminderSent': admin.firestore.FieldValue.serverTimestamp()
      });
    });

    await Promise.all(emailPromises);
    await batch.commit();
    
    console.log(`Sent ${appointmentsSnapshot.size} 1-hour reminders`);

  } catch (error) {
    console.error('Error sending 1-hour reminders:', error);
  }
});
