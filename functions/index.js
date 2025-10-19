require('dotenv').config();
const functions = require('firebase-functions/v2');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');
const axios = require('axios');

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

// ClickSend credentials
const CLICKSEND_USERNAME = 'rozsagyenelaw1@gmail.com';
const CLICKSEND_API_KEY = '5FB6FC75-7032-5BB1-015B-4F775631B73E';

// Helper function to send SMS using ClickSend REST API
async function sendSMS(phoneNumber, message) {
  try {
    // Format phone number (remove any non-digits and ensure it has country code)
    let formattedPhone = phoneNumber.replace(/\D/g, '');
    if (!formattedPhone.startsWith('1') && formattedPhone.length === 10) {
      formattedPhone = '1' + formattedPhone;
    }
    
    // Create Basic Auth token
    const authToken = Buffer.from(`${CLICKSEND_USERNAME}:${CLICKSEND_API_KEY}`).toString('base64');
    
    // ClickSend API payload
    const payload = {
      messages: [
        {
          to: `+${formattedPhone}`,
          body: message,
          source: 'lawfirm'
        }
      ]
    };
    
    // Make API call
    const response = await axios.post('https://rest.clicksend.com/v3/sms/send', payload, {
      headers: {
        'Authorization': `Basic ${authToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✓ SMS sent successfully to', formattedPhone);
    return { success: true, data: response.data };
    
  } catch (error) {
    console.error('Error sending SMS:', error.response?.data || error.message);
    return { success: false, error: error.message };
  }
}

// Send appointment confirmation email to CLIENT (PUBLIC - allows guest bookings)
exports.sendClientAppointmentConfirmation = functions.https.onCall({
  cors: ['https://portal.livingtrust-attorneys.com', 'http://localhost:3000', 'http://localhost:5173']
}, async (request) => {
  // REMOVED authentication check to allow guest bookings
  // Validate required fields instead
  const { clientName, clientEmail, appointmentId } = request.data;
  
  if (!clientName || !clientEmail || !appointmentId) {
    throw new functions.https.HttpsError(
      'invalid-argument', 
      'Client name, email, and appointment ID are required'
    );
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(clientEmail)) {
    throw new functions.https.HttpsError(
      'invalid-argument', 
      'Invalid email address format'
    );
  }

  const { 
    clientPhone,
    appointmentDate,
    appointmentDateFormatted,
    appointmentTime,
    appointmentType, 
    notes 
  } = request.data;

  try {
    console.log('===== CLIENT CONFIRMATION EMAIL =====');
    console.log('Sending TO:', clientEmail);
    console.log('Client Name:', clientName);
    console.log('Client Phone:', clientPhone || 'NOT PROVIDED');
    console.log('Appointment ID:', appointmentId);
    
    // Create cancellation/management URL
    const manageUrl = `https://portal.livingtrust-attorneys.com/book?manage=${appointmentId}&email=${encodeURIComponent(clientEmail)}`;
    
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
            .contact-box { background-color: #fef3c7; border: 2px solid #f59e0b; padding: 15px; border-radius: 8px; margin: 20px 0; }
            .contact-highlight { font-size: 16px; font-weight: bold; color: #1e3a8a; }
            .questionnaire-box { background-color: #f0fdf4; border: 2px solid #10b981; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; }
            .btn-questionnaire { display: inline-block; background-color: #10b981; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; margin: 10px 0; }
            .manage-box { background-color: #fee2e2; border: 2px solid #ef4444; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; }
            .btn-cancel { display: inline-block; background-color: #ef4444; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 10px 0; }
            .confirmation-id { background-color: #f3f4f6; padding: 10px 15px; border-radius: 6px; font-family: monospace; font-size: 14px; margin: 10px 0; display: inline-block; border: 2px dashed #9ca3af; }
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
              
              <div class="contact-box">
                <h3 style="color: #92400e; margin-top: 0; margin-bottom: 10px;">📞 Your Contact Information</h3>
                <p style="margin: 5px 0;"><strong>Name:</strong> <span class="contact-highlight">${clientName}</span></p>
                <p style="margin: 5px 0;"><strong>Email:</strong> <span class="contact-highlight">${clientEmail}</span></p>
                <p style="margin: 5px 0;"><strong>Phone:</strong> <span class="contact-highlight">${clientPhone || 'Not provided'}</span></p>
              </div>

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

              <div class="questionnaire-box">
                <h3 style="color: #065f46; margin-top: 0; margin-bottom: 10px;">📋 Optional: Complete Your Estate Planning Questionnaire</h3>
                <p style="color: #047857; margin: 10px 0;">To maximize the value of your consultation, you may complete our comprehensive estate planning questionnaire in advance. This allows us to:</p>
                <ul style="text-align: left; color: #065f46; margin: 10px auto; max-width: 400px;">
                  <li>Review your specific situation before our call</li>
                  <li>Provide more detailed and tailored guidance</li>
                  <li>Address complex issues more efficiently</li>
                </ul>
                <p style="color: #047857; margin: 10px 0; font-size: 14px;"><em>This is completely optional - we can also complete it together during or after your consultation.</em></p>
                <a href="https://livingtrust-attorneys.com/estate-planning-questionnaire" class="btn-questionnaire">Complete Questionnaire</a>
              </div>

              <div class="manage-box">
                <h3 style="color: #991b1b; margin-top: 0; margin-bottom: 10px;">📅 Need to Reschedule or Cancel?</h3>
                <p style="color: #7f1d1d; margin: 10px 0;">You can manage your appointment using the button below:</p>
                <div class="confirmation-id">
                  <strong>Your Confirmation ID:</strong><br>
                  ${appointmentId.substring(0, 8).toUpperCase()}
                </div>
                <p style="color: #7f1d1d; margin: 10px 0; font-size: 14px;">Please make changes at least 24 hours before your appointment.</p>
                <a href="${manageUrl}" class="btn-cancel">Manage Appointment</a>
              </div>

              <div style="text-align: center;">
                <a href="${manageUrl}" style="display: inline-block; background-color: #1e3a8a; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 20px 0; font-weight: 600;">Manage Your Appointments</a>
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
    console.log(`✓ CLIENT CONFIRMATION EMAIL sent successfully`);
    console.log(`  --> Sent to: ${clientEmail}`);
    console.log(`  --> Appointment ID: ${appointmentId}`);
    
    // Send SMS confirmation if phone number is provided
    if (clientPhone && clientPhone.trim() !== '') {
      console.log('Attempting to send SMS confirmation...');
      const smsMessage = `Law Offices of Rozsa Gyene: Your appointment is confirmed for ${appointmentDateFormatted} at ${appointmentTime} PT. Confirmation #${appointmentId.substring(0, 8)}. Reply STOP to opt out.`;
      
      try {
        await sendSMS(clientPhone, smsMessage);
        console.log('✓ SMS confirmation sent successfully');
      } catch (smsError) {
        console.error('SMS confirmation failed:', smsError);
        // Don't fail the whole function if SMS fails
      }
    } else {
      console.log('No phone number provided, skipping SMS');
    }
    
    return { success: true, message: 'Client confirmation email sent successfully' };

  } catch (error) {
    console.error('Error sending client confirmation email:', error);
    console.error('Error details:', error.message);
    throw new functions.https.HttpsError('internal', 'Failed to send client confirmation email: ' + error.message);
  }
});

// Send appointment notification email to ATTORNEY (PUBLIC - allows guest bookings)
exports.sendAttorneyAppointmentNotification = functions.https.onCall({
  cors: ['https://portal.livingtrust-attorneys.com', 'http://localhost:3000', 'http://localhost:5173']
}, async (request) => {
  // REMOVED authentication check to allow guest bookings
  // Validate required fields instead
  const { clientName, clientEmail, appointmentId } = request.data;
  
  if (!clientName || !clientEmail || !appointmentId) {
    throw new functions.https.HttpsError(
      'invalid-argument', 
      'Client name, email, and appointment ID are required'
    );
  }

  const { 
    clientPhone,
    appointmentDate,
    appointmentDateFormatted,
    appointmentTime,
    appointmentType, 
    notes 
  } = request.data;

  // Log the received data for debugging
  console.log('===== ATTORNEY NOTIFICATION EMAIL =====');
  console.log('Sending TO: rozsagyenelaw1@gmail.com (ATTORNEY)');
  console.log('Client Name:', clientName);
  console.log('Client Email:', clientEmail);
  console.log('Client Phone:', clientPhone || 'NOT PROVIDED');
  console.log('Appointment ID:', appointmentId);

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
            .client-box { background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #064e3b; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            .detail-row { display: flex; padding: 12px 0; border-bottom: 1px solid #e5e7eb; align-items: center; }
            .detail-label { font-weight: bold; min-width: 150px; color: #064e3b; font-size: 14px; }
            .detail-value { flex: 1; font-size: 15px; }
            .contact-highlight { background-color: #fef3c7; padding: 6px 12px; border-radius: 4px; font-weight: bold; display: inline-block; }
            .contact-large { font-size: 18px; font-weight: bold; color: #064e3b; }
            .notes-box { background-color: #f3f4f6; padding: 15px; border-radius: 6px; font-style: italic; border-left: 3px solid #064e3b; margin: 15px 0; }
            .action-buttons { text-align: center; margin: 25px 0; }
            .button { display: inline-block; padding: 12px 24px; margin: 5px; text-decoration: none; border-radius: 4px; font-weight: bold; }
            .btn-primary { background-color: #064e3b; color: white; }
            .btn-secondary { background-color: #2563eb; color: white; }
            .next-steps { background-color: #eff6ff; padding: 15px; border-radius: 8px; border-left: 4px solid #2563eb; margin-top: 20px; }
            .guest-badge { background-color: #fef3c7; color: #92400e; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }
            .contact-header { background-color: #064e3b; color: white; padding: 12px; border-radius: 6px 6px 0 0; margin: -20px -20px 15px -20px; }
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
                ${!request.auth ? '<br><span class="guest-badge">👤 GUEST BOOKING</span>' : ''}
              </div>

              <div class="client-box">
                <div class="contact-header">
                  <h3 style="margin: 0;">👤 CLIENT CONTACT INFORMATION</h3>
                </div>
                <div class="detail-row">
                  <span class="detail-label">👤 Full Name:</span>
                  <span class="detail-value contact-large">${clientName}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">📧 Email Address:</span>
                  <span class="detail-value">
                    <a href="mailto:${clientEmail}" style="color: #064e3b; text-decoration: none;">
                      <span class="contact-highlight">${clientEmail}</span>
                    </a>
                  </span>
                </div>
                <div class="detail-row" style="border-bottom: none;">
                  <span class="detail-label">📞 Phone Number:</span>
                  <span class="detail-value">
                    ${clientPhone && clientPhone.trim() !== '' ? `
                      <a href="tel:${clientPhone}" style="color: #064e3b; text-decoration: none;">
                        <span class="contact-highlight">${clientPhone}</span>
                      </a>
                    ` : '<span style="color: #ef4444; font-weight: bold; font-style: italic;">⚠️ NOT PROVIDED - Follow up via email</span>'}
                  </span>
                </div>
              </div>

              <div class="client-box">
                <h3 style="color: #064e3b; margin-top: 0; border-bottom: 2px solid #064e3b; padding-bottom: 10px;">📅 Appointment Details</h3>
                <div class="detail-row">
                  <span class="detail-label">📅 Date:</span>
                  <span class="detail-value"><strong style="font-size: 16px;">${appointmentDateFormatted}</strong></span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">🕐 Time:</span>
                  <span class="detail-value"><strong style="font-size: 16px;">${appointmentTime}</strong> Pacific Time</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">📍 Meeting Type:</span>
                  <span class="detail-value">${appointmentType}</span>
                </div>
                <div class="detail-row" style="border-bottom: none;">
                  <span class="detail-label">🔖 Appointment ID:</span>
                  <span class="detail-value"><code style="background: #f3f4f6; padding: 4px 8px; border-radius: 3px; font-size: 13px;">${appointmentId}</code></span>
                </div>
              </div>

              ${notes && notes !== 'None' && notes.trim() !== '' ? `
              <div class="client-box">
                <h3 style="color: #064e3b; margin-top: 0; border-bottom: 2px solid #064e3b; padding-bottom: 10px;">📝 Client's Notes</h3>
                <div class="notes-box">
                  <p style="margin: 0; color: #1f2937;">"${notes}"</p>
                </div>
              </div>
              ` : ''}

              <div class="action-buttons">
                <a href="https://console.firebase.google.com/project/law-firm-client-portal/firestore/data/~2Fappointments~2F${appointmentId}" style="display: inline-block; padding: 12px 24px; margin: 5px; text-decoration: none; border-radius: 4px; font-weight: bold; background-color: #064e3b; color: #ffffff;">
                  🔍 View in Firebase
                </a>
                <a href="mailto:${clientEmail}?subject=Re:%20Your%20Upcoming%20Appointment%20on%20${encodeURIComponent(appointmentDateFormatted)}&body=Dear%20${encodeURIComponent(clientName)},%0D%0A%0D%0AThank%20you%20for%20scheduling%20an%20appointment%20with%20us.%0D%0A%0D%0A" style="display: inline-block; padding: 12px 24px; margin: 5px; text-decoration: none; border-radius: 4px; font-weight: bold; background-color: #2563eb; color: #ffffff;">
                  ✉️ Email Client
                </a>
                ${clientPhone && clientPhone.trim() !== '' ? `
                <a href="tel:${clientPhone}" style="display: inline-block; padding: 12px 24px; margin: 5px; text-decoration: none; border-radius: 4px; font-weight: bold; background-color: #059669; color: #ffffff;">
                  📞 Call Client
                </a>
                ` : ''}
              </div>

              <div class="next-steps">
                <h4 style="margin-top: 0; color: #1e40af;">📌 Next Steps:</h4>
                <ul style="margin: 10px 0 0 0; padding-left: 20px; color: #1f2937;">
                  <li>Review client information and prepare for the consultation</li>
                  ${!clientPhone || clientPhone.trim() === '' ? '<li><strong style="color: #ef4444;">⚠️ No phone number provided - Contact client via email to obtain contact number</strong></li>' : ''}
                  <li>Add appointment to your calendar (if not auto-synced)</li>
                  <li>Prepare relevant estate planning documents or templates</li>
                  <li>Review any previous correspondence with this client</li>
                  <li>Contact client if additional information is needed before the meeting</li>
                  ${!request.auth ? '<li><strong>Note: This is a guest booking - client does not have a portal account</strong></li>' : ''}
                </ul>
              </div>

              <div style="margin-top: 30px; padding: 20px; background-color: #f3f4f6; border-radius: 8px; border-left: 4px solid #064e3b;">
                <h4 style="margin-top: 0; color: #064e3b;">📋 Quick Contact Summary:</h4>
                <p style="margin: 5px 0; font-size: 14px;"><strong>Client:</strong> ${clientName}</p>
                <p style="margin: 5px 0; font-size: 14px;"><strong>Email:</strong> <a href="mailto:${clientEmail}" style="color: #064e3b;">${clientEmail}</a></p>
                <p style="margin: 5px 0; font-size: 14px;"><strong>Phone:</strong> ${clientPhone && clientPhone.trim() !== '' ? `<a href="tel:${clientPhone}" style="color: #064e3b;">${clientPhone}</a>` : '<span style="color: #ef4444;">Not Provided</span>'}</p>
                <p style="margin: 5px 0; font-size: 14px;"><strong>Date:</strong> ${appointmentDateFormatted} at ${appointmentTime} PT</p>
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
    console.log(`✓ ATTORNEY NOTIFICATION EMAIL sent successfully`);
    console.log(`  --> Sent to: rozsagyenelaw1@gmail.com (ATTORNEY)`);
    console.log(`  --> Client: ${clientName} (${clientEmail})`);
    console.log(`  --> Client Phone: ${clientPhone || 'NOT PROVIDED'}`);
    console.log(`  --> Appointment ID: ${appointmentId}`);
    
    return { success: true, message: 'Attorney notification email sent successfully' };

  } catch (error) {
    console.error('Error sending attorney notification email:', error);
    console.error('Error details:', error.message);
    throw new functions.https.HttpsError('internal', 'Failed to send attorney notification email: ' + error.message);
  }
});

// Send 24-hour reminder emails - runs every hour
exports.send24HourReminders = functions.scheduler.onSchedule('every 1 hours', async (event) => {
  console.log('===== 24-HOUR REMINDER CHECK STARTED =====');
  console.log('Current time:', new Date().toISOString());
  
  try {
    const now = new Date();
    const tomorrow = new Date(now.getTime() + (24 * 60 * 60 * 1000));
    const tomorrowStart = new Date(tomorrow.setHours(0, 0, 0, 0));
    const tomorrowEnd = new Date(tomorrow.setHours(23, 59, 59, 999));

    console.log('Looking for appointments between:');
    console.log('  Start:', tomorrowStart.toISOString());
    console.log('  End:', tomorrowEnd.toISOString());

    const appointmentsSnapshot = await db.collection('appointments')
      .where('appointmentDate', '>=', tomorrowStart)
      .where('appointmentDate', '<=', tomorrowEnd)
      .get();

    console.log(`Found ${appointmentsSnapshot.size} appointments in tomorrow's date range`);

    const batch = db.batch();
    const emailPromises = [];
    const smsPromises = [];
    let sentCount = 0;
    let skippedCount = 0;

    appointmentsSnapshot.forEach(doc => {
      const appointment = doc.data();
      
      if (appointment.status === 'confirmed' && 
          appointment.remindersSent?.['24hours'] !== true) {
        
        const appointmentDate = appointment.appointmentDate.toDate();

        console.log(`\nSending 24-hour reminder:`);
        console.log('  - Client:', appointment.clientName);
        console.log('  - Email:', appointment.clientEmail);
        console.log('  - Phone:', appointment.clientPhone || 'NOT PROVIDED');
        console.log('  - Date:', appointmentDate.toISOString());

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
                  <li style="margin: 10px 0;"><strong>Type:</strong> ${appointment.appointmentType}</li>
                </ul>
              </div>
              
              <p>Please be ready 5 minutes early. If you need to cancel or reschedule, please contact us as soon as possible.</p>
              
              <p>Contact: <a href="mailto:rozsagyenelaw1@gmail.com">rozsagyenelaw1@gmail.com</a></p>
              
              <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                <p style="margin: 5px 0;"><strong>Law Offices of Rozsa Gyene</strong></p>
                <p style="margin: 5px 0;">Estate Planning & Probate</p>
                <p style="margin: 5px 0;">Email: rozsagyenelaw1@gmail.com</p>
              </div>
            </div>
          `
        };

        emailPromises.push(
          gmailTransporter.sendMail(mailOptions)
            .then(() => console.log(`  ✓ Email sent to ${appointment.clientEmail}`))
            .catch(err => console.error(`  ✗ Failed to send to ${appointment.clientEmail}:`, err.message))
        );

        if (appointment.clientPhone && appointment.clientPhone.trim() !== '') {
          const smsMessage = `Law Offices of Rozsa Gyene: Reminder - Your appointment is tomorrow, ${appointmentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at ${appointmentDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })} PT. Reply STOP to opt out.`;
          
          smsPromises.push(
            sendSMS(appointment.clientPhone, smsMessage)
              .then(() => console.log(`  ✓ SMS sent to ${appointment.clientPhone}`))
              .catch(err => console.error(`  ✗ SMS failed to ${appointment.clientPhone}:`, err.message))
          );
        }

        batch.update(doc.ref, {
          'remindersSent.24hours': true,
          'lastReminderSent': admin.firestore.FieldValue.serverTimestamp()
        });
        
        sentCount++;
      } else {
        skippedCount++;
      }
    });

    await Promise.all([...emailPromises, ...smsPromises]);
    await batch.commit();
    
    console.log(`\n===== SUMMARY =====`);
    console.log(`Total appointments found: ${appointmentsSnapshot.size}`);
    console.log(`Reminders sent: ${sentCount}`);
    console.log(`Skipped: ${skippedCount}`);
    console.log(`✓ 24-hour reminder check completed successfully`);

  } catch (error) {
    console.error('ERROR in 24-hour reminders:', error);
    console.error('Error stack:', error.stack);
  }
  
  console.log('===== 24-HOUR REMINDER CHECK COMPLETED =====\n');
});

// Send 1-hour reminder emails - runs every 15 minutes
exports.send1HourReminders = functions.scheduler.onSchedule('every 15 minutes', async (event) => {
  console.log('===== 1-HOUR REMINDER CHECK STARTED =====');
  console.log('Current time:', new Date().toISOString());
  
  try {
    const now = new Date();
    const oneHourFromNow = new Date(now.getTime() + (60 * 60 * 1000));
    const rangeStart = new Date(oneHourFromNow.getTime() - (15 * 60 * 1000));
    const rangeEnd = new Date(oneHourFromNow.getTime() + (15 * 60 * 1000));

    console.log('Looking for appointments between:');
    console.log('  Start:', rangeStart.toISOString());
    console.log('  End:', rangeEnd.toISOString());

    const appointmentsSnapshot = await db.collection('appointments')
      .where('appointmentDate', '>=', rangeStart)
      .where('appointmentDate', '<=', rangeEnd)
      .get();

    console.log(`Found ${appointmentsSnapshot.size} appointments in 1-hour window`);

    const batch = db.batch();
    const emailPromises = [];
    const smsPromises = [];
    let sentCount = 0;
    let skippedCount = 0;

    appointmentsSnapshot.forEach(doc => {
      const appointment = doc.data();
      
      if (appointment.status === 'confirmed' && 
          appointment.remindersSent?.['1hour'] !== true) {
        
        const appointmentDate = appointment.appointmentDate.toDate();

        console.log(`\nSending 1-hour reminder:`);
        console.log('  - Client:', appointment.clientName);
        console.log('  - Email:', appointment.clientEmail);
        console.log('  - Phone:', appointment.clientPhone || 'NOT PROVIDED');
        console.log('  - Date:', appointmentDate.toISOString());

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
                  <li style="margin: 10px 0;"><strong>Type:</strong> ${appointment.appointmentType}</li>
                </ul>
              </div>
              
              <p>We look forward to speaking with you!</p>
              
              <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                <p style="margin: 5px 0;"><strong>Law Offices of Rozsa Gyene</strong></p>
                <p style="margin: 5px 0;">Estate Planning & Probate</p>
                <p style="margin: 5px 0;">Email: rozsagyenelaw1@gmail.com</p>
              </div>
            </div>
          `
        };

        emailPromises.push(
          gmailTransporter.sendMail(mailOptions)
            .then(() => console.log(`  ✓ Email sent to ${appointment.clientEmail}`))
            .catch(err => console.error(`  ✗ Failed to send to ${appointment.clientEmail}:`, err.message))
        );

        if (appointment.clientPhone && appointment.clientPhone.trim() !== '') {
          const smsMessage = `Law Offices of Rozsa Gyene: Your appointment starts in 1 hour at ${appointmentDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })} PT. We look forward to speaking with you! Reply STOP to opt out.`;
          
          smsPromises.push(
            sendSMS(appointment.clientPhone, smsMessage)
              .then(() => console.log(`  ✓ SMS sent to ${appointment.clientPhone}`))
              .catch(err => console.error(`  ✗ SMS failed to ${appointment.clientPhone}:`, err.message))
          );
        }

        batch.update(doc.ref, {
          'remindersSent.1hour': true,
          'lastReminderSent': admin.firestore.FieldValue.serverTimestamp()
        });
        
        sentCount++;
      } else {
        skippedCount++;
      }
    });

    await Promise.all([...emailPromises, ...smsPromises]);
    await batch.commit();
    
    console.log(`\n===== SUMMARY =====`);
    console.log(`Total appointments found: ${appointmentsSnapshot.size}`);
    console.log(`Reminders sent: ${sentCount}`);
    console.log(`Skipped: ${skippedCount}`);
    console.log(`✓ 1-hour reminder check completed successfully`);

  } catch (error) {
    console.error('ERROR in 1-hour reminders:', error);
    console.error('Error stack:', error.stack);
  }
  
  console.log('===== 1-HOUR REMINDER CHECK COMPLETED =====\n');
});
