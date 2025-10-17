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
    user: 'rozsagyenelaw1@gmail.com',
    pass: 'nwgg fzkx qguh hsdc'
  }
});

// Send appointment confirmation email to CLIENT
exports.sendClientAppointmentConfirmation = functions.https.onCall(async (request) => {
  if (!request.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { 
    appointmentId,
    clientName, 
    clientEmail,
    clientPhone,
    appointmentDate,
    appointmentDateFormatted,
    appointmentTime,
    appointmentType, 
    notes 
  } = request.data;

  try {
    // Client-focused confirmation email
    const clientMailOptions = {
      from: '"Law Offices of Rozsa Gyene" <rozsagyenelaw1@gmail.com>',
      to: clientEmail,
      subject: `Appointment Confirmed - ${appointmentDateFormatted}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #1e3a8a; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background-color: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
            .appointment-details { background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .detail-row { display: flex; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
            .detail-label { font-weight: bold; min-width: 120px; color: #1e3a8a; }
            .detail-value { flex: 1; }
            .button { display: inline-block; background-color: #1e3a8a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 20px 0; }
            .footer { text-align: center; padding: 20px; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; margin-top: 20px; }
            .checklist { background-color: #eff6ff; padding: 15px; border-radius: 8px; border-left: 4px solid #1e3a8a; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0;">✓ Appointment Confirmed</h1>
            </div>
            <div class="content">
              <h2 style="color: #1e3a8a;">Dear ${clientName},</h2>
              <p>Thank you for scheduling your consultation with Law Offices of Rozsa Gyene. Your appointment has been confirmed!</p>
              
              <div class="appointment-details">
                <h3 style="color: #1e3a8a; margin-top: 0;">Appointment Details</h3>
                <div class="detail-row">
                  <span class="detail-label">📅 Date:</span>
                  <span class="detail-value"><strong>${appointmentDateFormatted}</strong></span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">🕐 Time:</span>
                  <span class="detail-value"><strong>${appointmentTime}</strong> Pacific Time</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">📍 Type:</span>
                  <span class="detail-value">${appointmentType}</span>
                </div>
                ${notes && notes !== 'None' ? `
                <div class="detail-row">
                  <span class="detail-label">📝 Your Notes:</span>
                  <span class="detail-value">${notes}</span>
                </div>
                ` : ''}
                <div class="detail-row" style="border-bottom: none;">
                  <span class="detail-label">🔖 Confirmation:</span>
                  <span class="detail-value"><code style="background: #f3f4f6; padding: 2px 6px; border-radius: 3px;">#${appointmentId.substring(0, 8)}</code></span>
                </div>
              </div>

              <div class="checklist">
                <h3 style="margin-top: 0; color: #1e3a8a;">📋 How to Prepare:</h3>
                <ul style="margin: 10px 0; padding-left: 20px;">
                  <li>Prepare a list of questions or concerns you'd like to discuss</li>
                  <li>Have information about your assets and property ready to reference</li>
                  <li>Be ready to discuss beneficiaries and their contact information</li>
                  <li>Note any specific estate planning goals or family considerations</li>
                  ${appointmentType.includes('Phone') ? 
                    '<li>Find a quiet, private place for the call with good phone reception</li>' : 
                    '<li>Ensure you have a stable internet connection and webcam for the video call</li>'}
                </ul>
              </div>

              <p><strong>Need to reschedule or cancel?</strong><br>
              Please log into your client portal at least 24 hours before your appointment.</p>

              <div style="text-align: center;">
                <a href="https://portal.livingtrust-attorneys.com/appointments" class="button">View My Appointments</a>
              </div>

              <p style="margin-top: 30px; color: #6b7280; font-size: 14px;">
                We look forward to speaking with you and helping you secure your family's future.
              </p>
            </div>
            <div class="footer">
              <p style="margin: 5px 0;"><strong>Law Offices of Rozsa Gyene</strong></p>
              <p style="margin: 5px 0;">Estate Planning & Probate Attorney</p>
              <p style="margin: 5px 0;">📧 rozsagyenelaw1@gmail.com</p>
              <p style="margin: 5px 0;">🌐 <a href="https://portal.livingtrust-attorneys.com" style="color: #1e3a8a;">Client Portal</a></p>
              <p style="margin-top: 15px; color: #9ca3af;">© ${new Date().getFullYear()} Law Offices of Rozsa Gyene. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    await gmailTransporter.sendMail(clientMailOptions);
    console.log(`✓ Client confirmation email sent to ${clientEmail} for appointment ${appointmentId}`);
    
    return { success: true, message: 'Client confirmation email sent successfully' };

  } catch (error) {
    console.error('Error sending client confirmation email:', error);
    console.error('Error details:', error.message);
    throw new functions.https.HttpsError('internal', 'Failed to send client confirmation email: ' + error.message);
  }
});

// Send appointment notification email to ATTORNEY
exports.sendAttorneyAppointmentNotification = functions.https.onCall(async (request) => {
  if (!request.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { 
    appointmentId,
    clientName, 
    clientEmail,
    clientPhone,
    appointmentDate,
    appointmentDateFormatted,
    appointmentTime,
    appointmentType, 
    notes 
  } = request.data;

  try {
    // Attorney-focused notification email with all client details
    const attorneyMailOptions = {
      from: '"Client Portal System" <rozsagyenelaw1@gmail.com>',
      to: 'rozsagyenelaw1@gmail.com',
      subject: `🗓️ New Appointment: ${clientName} - ${appointmentDateFormatted}`,
      replyTo: clientEmail,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 650px; margin: 0 auto; padding: 20px; }
            .header { background-color: #064e3b; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background-color: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
            .alert { background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 15px 0; border-radius: 4px; }
            .client-box { background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #064e3b; }
            .detail-row { display: flex; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
            .detail-label { font-weight: bold; min-width: 150px; color: #064e3b; }
            .detail-value { flex: 1; }
            .notes-box { background-color: #f3f4f6; padding: 15px; border-radius: 6px; font-style: italic; border-left: 3px solid #064e3b; margin: 15px 0; }
            .action-buttons { text-align: center; margin: 25px 0; }
            .button { display: inline-block; padding: 12px 24px; margin: 5px; text-decoration: none; border-radius: 4px; font-weight: bold; }
            .btn-primary { background-color: #064e3b; color: white; }
            .btn-secondary { background-color: #2563eb; color: white; }
            .next-steps { background-color: #eff6ff; padding: 15px; border-radius: 8px; border-left: 4px solid #2563eb; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0;">🗓️ New Appointment Booked</h1>
            </div>
            <div class="content">
              <div class="alert">
                <strong>⚠️ Action Required:</strong> A new client appointment has been scheduled and requires your attention.
              </div>

              <div class="client-box">
                <h3 style="color: #064e3b; margin-top: 0; border-bottom: 2px solid #064e3b; padding-bottom: 10px;">👤 Client Information</h3>
                <div class="detail-row">
                  <span class="detail-label">Name:</span>
                  <span class="detail-value"><strong style="font-size: 16px;">${clientName}</strong></span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Email:</span>
                  <span class="detail-value">
                    <a href="mailto:${clientEmail}" style="color: #064e3b; text-decoration: none;">
                      📧 ${clientEmail}
                    </a>
                  </span>
                </div>
                ${clientPhone ? `
                <div class="detail-row" style="border-bottom: none;">
                  <span class="detail-label">Phone:</span>
                  <span class="detail-value">
                    <a href="tel:${clientPhone}" style="color: #064e3b; text-decoration: none;">
                      📞 ${clientPhone}
                    </a>
                  </span>
                </div>
                ` : '<div style="border-bottom: none;"></div>'}
              </div>

              <div class="client-box">
                <h3 style="color: #064e3b; margin-top: 0; border-bottom: 2px solid #064e3b; padding-bottom: 10px;">📅 Appointment Details</h3>
                <div class="detail-row">
                  <span class="detail-label">Date:</span>
                  <span class="detail-value"><strong style="font-size: 16px;">${appointmentDateFormatted}</strong></span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Time:</span>
                  <span class="detail-value"><strong style="font-size: 16px;">${appointmentTime}</strong> Pacific Time</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Meeting Type:</span>
                  <span class="detail-value">${appointmentType}</span>
                </div>
                <div class="detail-row" style="border-bottom: none;">
                  <span class="detail-label">Appointment ID:</span>
                  <span class="detail-value"><code style="background: #f3f4f6; padding: 4px 8px; border-radius: 3px; font-size: 13px;">${appointmentId}</code></span>
                </div>
              </div>

              ${notes && notes !== 'None' ? `
              <div class="client-box">
                <h3 style="color: #064e3b; margin-top: 0; border-bottom: 2px solid #064e3b; padding-bottom: 10px;">📝 Client's Notes</h3>
                <div class="notes-box">
                  <p style="margin: 0; color: #1f2937;">"${notes}"</p>
                </div>
              </div>
              ` : ''}

              <div class="action-buttons">
                <a href="https://console.firebase.google.com/project/law-firm-client-portal/firestore/data/~2Fappointments~2F${appointmentId}" class="button btn-primary">
                  🔍 View in Firebase
                </a>
                <a href="mailto:${clientEmail}?subject=Re: Your Upcoming Appointment&body=Dear ${clientName},%0D%0A%0D%0AThank you for scheduling an appointment..." class="button btn-secondary">
                  ✉️ Email Client
                </a>
              </div>

              <div class="next-steps">
                <h4 style="margin-top: 0; color: #1e40af;">📌 Next Steps:</h4>
                <ul style="margin: 10px 0 0 0; padding-left: 20px; color: #1f2937;">
                  <li>Review client information and prepare for the consultation</li>
                  <li>Add appointment to your calendar (if not auto-synced)</li>
                  <li>Prepare relevant estate planning documents or templates</li>
                  <li>Review any previous correspondence with this client</li>
                  <li>Contact client if additional information is needed before the meeting</li>
                </ul>
              </div>

              <div style="margin-top: 30px; padding-top: 20px; border-top: 2px solid #e5e7eb; text-align: center;">
                <p style="color: #6b7280; font-size: 14px; margin: 5px 0;">
                  This notification was sent from your Client Portal System
                </p>
                <p style="color: #9ca3af; font-size: 12px; margin: 5px 0;">
                  Time sent: ${new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })} PT
                </p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `
    };

    await gmailTransporter.sendMail(attorneyMailOptions);
    console.log(`✓ Attorney notification email sent to rozsagyenelaw1@gmail.com for appointment ${appointmentId}`);
    
    return { success: true, message: 'Attorney notification email sent successfully' };

  } catch (error) {
    console.error('Error sending attorney notification email:', error);
    console.error('Error details:', error.message);
    throw new functions.https.HttpsError('internal', 'Failed to send attorney notification email: ' + error.message);
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
        from: '"Law Offices of Rozsa Gyene" <rozsagyenelaw1@gmail.com>',
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
                <li style="margin: 10px 0;"><strong>Type:</strong> ${appointment.appointmentType === 'virtual' ? 'Virtual Consultation' : 'Over the Phone'}</li>
              </ul>
            </div>
            
            <p>Please arrive 5 minutes early. If you need to cancel or reschedule, please contact us as soon as possible.</p>
            
            <p>Client Portal: <a href="https://portal.livingtrust-attorneys.com">https://portal.livingtrust-attorneys.com</a></p>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 5px 0;"><strong>Law Offices of Rozsa Gyene</strong></p>
              <p style="margin: 5px 0;">Estate Planning & Probate</p>
              <p style="margin: 5px 0;">Email: rozsagyenelaw1@gmail.com</p>
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
        from: '"Law Offices of Rozsa Gyene" <rozsagyenelaw1@gmail.com>',
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
                <li style="margin: 10px 0;"><strong>Type:</strong> ${appointment.appointmentType === 'virtual' ? 'Virtual Consultation' : 'Over the Phone'}</li>
              </ul>
            </div>
            
            <p>We look forward to seeing you!</p>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 5px 0;"><strong>Law Offices of Rozsa Gyene</strong></p>
              <p style="margin: 5px 0;">Estate Planning & Probate</p>
              <p style="margin: 5px 0;">Email: rozsagyenelaw1@gmail.com</p>
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
