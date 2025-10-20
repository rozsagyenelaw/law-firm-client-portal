import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Video, MapPin, CheckCircle, AlertCircle, X, Search } from 'lucide-react';
import { collection, query, where, getDocs, addDoc, serverTimestamp, updateDoc, doc } from 'firebase/firestore';
import { db, functions } from '../firebase';
import { httpsCallable } from 'firebase/functions';

const PublicBooking = () => {
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [appointmentType, setAppointmentType] = useState('phone');
  const [notes, setNotes] = useState('');
  const [availableSlots, setAvailableSlots] = useState([]);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Guest booking fields
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [smsConsent, setSmsConsent] = useState(false); // NEW: SMS consent checkbox

  // Manage appointment fields
  const [lookupEmail, setLookupEmail] = useState('');
  const [foundAppointments, setFoundAppointments] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  const APPOINTMENT_TYPES = [
    { value: 'virtual', label: 'Virtual Consultation', icon: Video },
    { value: 'phone', label: 'Over the Phone', icon: MapPin }
  ];

  // Business hours configuration
  const BUSINESS_HOURS = {
    monday: { start: 9, end: 17 },
    tuesday: { start: 9, end: 17 },
    wednesday: { start: 9, end: 17 },
    thursday: { start: 9, end: 17 },
    friday: { start: 9, end: 17 },
    saturday: { start: 9, end: 14 },
    sunday: null // Closed
  };

  const APPOINTMENT_DURATION = 30; // minutes

  useEffect(() => {
    if (selectedDate) {
      generateAvailableSlots(selectedDate);
    }
  }, [selectedDate]);

  const generateAvailableSlots = async (dateString) => {
    // Parse the date in Pacific Time
    const date = new Date(dateString + 'T00:00:00-08:00');
    const dayName = date.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'America/Los_Angeles' }).toLowerCase();
    
    const hours = BUSINESS_HOURS[dayName];
    if (!hours) {
      setAvailableSlots([]);
      return;
    }

    // Get current time in Pacific
    const nowPacific = new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' });
    const now = new Date(nowPacific);

    // Generate all possible time slots
    const slots = [];
    for (let hour = hours.start; hour < hours.end; hour++) {
      for (let minute = 0; minute < 60; minute += APPOINTMENT_DURATION) {
        const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        
        // Create date in Pacific Time
        const slotDateTime = new Date(dateString + `T${time}:00-08:00`);
        
        // Only show future slots
        if (slotDateTime > now) {
          slots.push(time);
        }
      }
    }

    // Check for existing appointments on this date
    try {
      const appointmentsQuery = query(
        collection(db, 'appointments'),
        where('appointmentDate', '>=', new Date(date.setHours(0, 0, 0, 0))),
        where('appointmentDate', '<=', new Date(date.setHours(23, 59, 59, 999))),
        where('status', '==', 'confirmed')
      );
      
      const snapshot = await getDocs(appointmentsQuery);
      const bookedTimes = snapshot.docs.map(doc => {
        const apptDate = doc.data().appointmentDate.toDate();
        return `${apptDate.getHours().toString().padStart(2, '0')}:${apptDate.getMinutes().toString().padStart(2, '0')}`;
      });

      // Filter out booked slots
      const available = slots.filter(slot => !bookedTimes.includes(slot));
      setAvailableSlots(available);
    } catch (error) {
      console.error('Error checking availability:', error);
      setAvailableSlots(slots);
    }
  };

  const handleBookAppointment = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      // Create appointment date object in Pacific Time
      const pacificDateString = `${selectedDate}T${selectedTime}:00-08:00`;
      const appointmentDate = new Date(pacificDateString);

      // Create appointment document
      const appointmentData = {
        clientId: 'guest',
        clientName: guestName,
        clientEmail: guestEmail,
        clientPhone: guestPhone,
        smsConsent: smsConsent, // Store SMS consent preference
        appointmentDate: appointmentDate,
        appointmentType: appointmentType,
        notes: notes,
        status: 'confirmed',
        createdAt: serverTimestamp(),
        isGuestBooking: true,
        remindersSent: {
          '24hours': false,
          '1hour': false
        }
      };

      const docRef = await addDoc(collection(db, 'appointments'), appointmentData);

      // Send confirmation emails
      try {
        const appointmentDetails = {
          appointmentId: docRef.id,
          clientName: guestName,
          clientEmail: guestEmail,
          clientPhone: smsConsent ? guestPhone : '', // Only send phone if SMS consent given
          appointmentDate: appointmentDate.toISOString(),
          appointmentDateFormatted: appointmentDate.toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            timeZone: 'America/Los_Angeles'
          }),
          appointmentTime: appointmentDate.toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            minute: '2-digit',
            hour12: true,
            timeZone: 'America/Los_Angeles'
          }),
          appointmentType: APPOINTMENT_TYPES.find(t => t.value === appointmentType)?.label,
          notes: notes || 'None'
        };

        // Send confirmation email to CLIENT
        const sendClientConfirmation = httpsCallable(functions, 'sendClientAppointmentConfirmation');
        await sendClientConfirmation(appointmentDetails);

        // Send notification email to ATTORNEY
        const sendAttorneyNotification = httpsCallable(functions, 'sendAttorneyAppointmentNotification');
        await sendAttorneyNotification(appointmentDetails);
        
      } catch (emailError) {
        console.error('Email notification failed:', emailError);
      }

      setSuccessMessage('Appointment booked successfully! You will receive a confirmation email shortly.');
      
      // Reset form
      setSelectedDate('');
      setSelectedTime('');
      setAppointmentType('phone');
      setNotes('');
      setGuestName('');
      setGuestEmail('');
      setGuestPhone('');
      setSmsConsent(false);

      // Scroll to top to show success message
      window.scrollTo({ top: 0, behavior: 'smooth' });

    } catch (error) {
      console.error('Error booking appointment:', error);
      setErrorMessage('Failed to book appointment. Please try again or contact us directly.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLookupAppointments = async (e) => {
    e.preventDefault();
    setIsSearching(true);
    setSearchError('');
    setFoundAppointments([]);

    try {
      // Query appointments by email
      const appointmentsQuery = query(
        collection(db, 'appointments'),
        where('clientEmail', '==', lookupEmail.toLowerCase().trim()),
        where('status', '==', 'confirmed')
      );

      const snapshot = await getDocs(appointmentsQuery);
      const appointments = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        appointmentDate: doc.data().appointmentDate?.toDate()
      }));

      // Filter for upcoming appointments only
      const now = new Date();
      const upcomingAppointments = appointments.filter(appt => appt.appointmentDate >= now);

      if (upcomingAppointments.length === 0) {
        setSearchError('No upcoming appointments found for this email address.');
      } else {
        setFoundAppointments(upcomingAppointments);
      }
    } catch (error) {
      console.error('Error looking up appointments:', error);
      setSearchError('Failed to look up appointments. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleCancelAppointment = async (appointmentId, appointmentDetails) => {
    if (!window.confirm('Are you sure you want to cancel this appointment? This action cannot be undone.')) {
      return;
    }

    try {
      const appointment = appointmentDetails;
      const appointmentDate = appointment.appointmentDate;

      // Update appointment status to cancelled
      await updateDoc(doc(db, 'appointments', appointmentId), {
        status: 'cancelled',
        cancelledAt: serverTimestamp()
      });

      // Send cancellation emails
      try {
        const cancellationDetails = {
          appointmentId: appointmentId,
          clientName: appointment.clientName,
          clientEmail: appointment.clientEmail,
          clientPhone: appointment.smsConsent ? (appointment.clientPhone || '') : '', // Only send if they consented to SMS
          appointmentDateFormatted: appointmentDate.toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            timeZone: 'America/Los_Angeles'
          }),
          appointmentTime: appointmentDate.toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            minute: '2-digit',
            hour12: true,
            timeZone: 'America/Los_Angeles'
          }),
          appointmentType: APPOINTMENT_TYPES.find(t => t.value === appointment.appointmentType)?.label,
          cancelledBy: 'Guest/Client'
        };

        // Send cancellation confirmation to CLIENT
        const sendClientCancellation = httpsCallable(functions, 'sendClientCancellationConfirmation');
        await sendClientCancellation(cancellationDetails);

        // Send cancellation notification to ATTORNEY
        const sendAttorneyCancellation = httpsCallable(functions, 'sendAttorneyCancellationNotification');
        await sendAttorneyCancellation(cancellationDetails);

        console.log('✓ Cancellation emails sent successfully');
      } catch (emailError) {
        console.error('Failed to send cancellation emails:', emailError);
        // Don't fail the cancellation if email fails
      }

      // Remove from found appointments
      setFoundAppointments(prev => prev.filter(appt => appt.id !== appointmentId));

      // Show success message
      setSuccessMessage('Appointment cancelled successfully. You will receive a confirmation email shortly.');

      // Scroll to show message
      window.scrollTo({ top: 0, behavior: 'smooth' });

      // Clear success message after 5 seconds
      setTimeout(() => setSuccessMessage(''), 5000);

    } catch (error) {
      console.error('Error cancelling appointment:', error);
      setSearchError('Failed to cancel appointment. Please try again or contact us directly.');
    }
  };

  const getMinDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  const getMaxDate = () => {
    const maxDate = new Date();
    maxDate.setMonth(maxDate.getMonth() + 3);
    return maxDate.toISOString().split('T')[0];
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Schedule a Consultation</h1>
          <p className="text-lg text-gray-600">
            Law Offices of Rozsa Gyene - Estate Planning & Probate
          </p>
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className="mb-6 bg-green-50 border border-green-200 text-green-700 px-6 py-4 rounded-lg flex items-start">
            <CheckCircle className="h-6 w-6 mr-3 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">{successMessage}</p>
              <p className="text-sm mt-1">Please check your email for confirmation details.</p>
            </div>
          </div>
        )}

        {/* Error Message */}
        {errorMessage && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg flex items-start">
            <AlertCircle className="h-6 w-6 mr-3 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">{errorMessage}</p>
              <p className="text-sm mt-1">Email: rozsagyenelaw1@gmail.com</p>
            </div>
          </div>
        )}

        {/* Info Card */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">What to Expect</h3>
          <div className="space-y-2 text-sm text-blue-800">
            <div className="flex items-center">
              <Clock className="h-5 w-5 mr-3 flex-shrink-0" />
              <span>30-minute consultation appointments</span>
            </div>
            <div className="flex items-center">
              <Calendar className="h-5 w-5 mr-3 flex-shrink-0" />
              <span>Available Mon-Fri: 9:00 AM - 5:00 PM, Sat: 9:00 AM - 2:00 PM (Pacific Time)</span>
            </div>
            <div className="flex items-center">
              <Video className="h-5 w-5 mr-3 flex-shrink-0" />
              <span>Choose between virtual or phone consultations</span>
            </div>
          </div>
        </div>

        {/* Booking Form */}
        <div className="bg-white shadow-lg rounded-lg p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Book New Appointment</h2>
          <form onSubmit={handleBookAppointment} className="space-y-6">
            {/* Contact Information */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Information</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    required
                    placeholder="John Smith"
                    className="block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    value={guestEmail}
                    onChange={(e) => setGuestEmail(e.target.value)}
                    required
                    placeholder="john@example.com"
                    className="block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone Number *
                  </label>
                  <input
                    type="tel"
                    value={guestPhone}
                    onChange={(e) => setGuestPhone(e.target.value)}
                    required
                    placeholder="(555) 123-4567"
                    className="block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {/* SMS CONSENT CHECKBOX - NEW */}
                <div className="mt-4 bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
                  <label className="flex items-start cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={smsConsent}
                      onChange={(e) => setSmsConsent(e.target.checked)}
                      className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer"
                    />
                    <span className="ml-3 text-sm text-gray-700 leading-relaxed">
                      I agree to receive appointment reminders and notifications via SMS/text message from <strong>Law Offices of Rozsa Gyene</strong>. 
                      Message frequency: 2-4 messages per appointment (confirmation, reminders, cancellations). 
                      Message and data rates may apply. 
                      Reply <strong>STOP</strong> to unsubscribe. Reply <strong>HELP</strong> for help.
                    </span>
                  </label>
                  <p className="text-xs text-gray-600 mt-2 ml-7 italic">
                    ℹ️ Optional - You can still book your appointment without SMS notifications. You'll always receive email confirmations.
                  </p>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Appointment Details</h3>

              {/* Appointment Type */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Consultation Type *
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {APPOINTMENT_TYPES.map((type) => {
                    const Icon = type.icon;
                    return (
                      <button
                        key={type.value}
                        type="button"
                        onClick={() => setAppointmentType(type.value)}
                        className={`p-4 border-2 rounded-lg flex items-center justify-center space-x-3 transition-all ${
                          appointmentType === type.value
                            ? 'border-blue-600 bg-blue-50 shadow-md'
                            : 'border-gray-300 hover:border-gray-400'
                        }`}
                      >
                        <Icon className={`h-6 w-6 ${appointmentType === type.value ? 'text-blue-600' : 'text-gray-400'}`} />
                        <span className={`font-medium ${appointmentType === type.value ? 'text-blue-900' : 'text-gray-700'}`}>
                          {type.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Date Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Date *
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  min={getMinDate()}
                  max={getMaxDate()}
                  required
                  className="block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="mt-2 text-sm text-gray-500">
                  Available Mon-Fri: 9 AM - 5 PM, Sat: 9 AM - 2 PM (Pacific Time)
                </p>
              </div>

              {/* Time Selection */}
              {selectedDate && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Select Time (Pacific Time) *
                  </label>
                  {availableSlots.length > 0 ? (
                    <div className="grid grid-cols-3 md:grid-cols-4 gap-3 max-h-80 overflow-y-auto p-2">
                      {availableSlots.map((slot) => (
                        <button
                          key={slot}
                          type="button"
                          onClick={() => setSelectedTime(slot)}
                          className={`px-4 py-3 text-sm border-2 rounded-lg transition-all ${
                            selectedTime === slot
                              ? 'border-blue-600 bg-blue-50 text-blue-700 font-semibold shadow-md'
                              : 'border-gray-300 hover:border-gray-400 text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          {new Date(`2000-01-01T${slot}`).toLocaleTimeString('en-US', { 
                            hour: 'numeric', 
                            minute: '2-digit',
                            hour12: true 
                          })}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
                      <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-600">
                        No available time slots for this date. Please select another date.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Additional Notes (Optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  placeholder="Please share any specific topics you'd like to discuss or questions you have..."
                  className="block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-6 border-t border-gray-200">
              <button
                type="submit"
                disabled={!selectedDate || !selectedTime || isSubmitting}
                className="w-full flex justify-center items-center px-6 py-4 bg-blue-900 text-white text-lg font-semibold rounded-lg hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Booking Your Appointment...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-5 w-5 mr-2" />
                    Confirm Appointment
                  </>
                )}
              </button>
              <p className="mt-3 text-center text-sm text-gray-500">
                You'll receive a confirmation email with all the details
              </p>
            </div>
          </form>
        </div>

        {/* Manage Appointment Section */}
        <div className="bg-white shadow-lg rounded-lg p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Manage Your Appointment</h2>
          <p className="text-gray-600 mb-6">
            Already booked an appointment? Enter your email to view and manage your upcoming appointments.
          </p>

          <form onSubmit={handleLookupAppointments} className="mb-6">
            <div className="flex gap-3">
              <div className="flex-1">
                <input
                  type="email"
                  value={lookupEmail}
                  onChange={(e) => setLookupEmail(e.target.value)}
                  required
                  placeholder="Enter your email address"
                  className="block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <button
                type="submit"
                disabled={isSearching}
                className="flex items-center px-6 py-3 bg-blue-900 text-white font-semibold rounded-lg hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSearching ? (
                  <>
                    <svg className="animate-spin h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Searching...
                  </>
                ) : (
                  <>
                    <Search className="h-5 w-5 mr-2" />
                    Find Appointments
                  </>
                )}
              </button>
            </div>
          </form>

          {searchError && (
            <div className="mb-4 bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-lg flex items-start">
              <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
              <p className="text-sm">{searchError}</p>
            </div>
          )}

          {foundAppointments.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Your Upcoming Appointments</h3>
              {foundAppointments.map((appointment) => (
                <div key={appointment.id} className="border border-gray-200 rounded-lg p-5 bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center mb-3">
                        {appointment.appointmentType === 'virtual' ? (
                          <Video className="h-5 w-5 text-green-600 mr-2" />
                        ) : (
                          <MapPin className="h-5 w-5 text-blue-600 mr-2" />
                        )}
                        <h4 className="text-base font-semibold text-gray-900">
                          {APPOINTMENT_TYPES.find(t => t.value === appointment.appointmentType)?.label}
                        </h4>
                      </div>
                      <div className="space-y-2 text-sm text-gray-600">
                        <div className="flex items-center">
                          <Calendar className="h-4 w-4 mr-2" />
                          <span>
                            {appointment.appointmentDate.toLocaleDateString('en-US', { 
                              weekday: 'long', 
                              year: 'numeric', 
                              month: 'long', 
                              day: 'numeric' 
                            })}
                          </span>
                        </div>
                        <div className="flex items-center">
                          <Clock className="h-4 w-4 mr-2" />
                          <span>
                            {appointment.appointmentDate.toLocaleTimeString('en-US', { 
                              hour: 'numeric', 
                              minute: '2-digit',
                              hour12: true 
                            })} (Pacific Time)
                          </span>
                        </div>
                        {appointment.notes && (
                          <p className="mt-2 text-gray-700">
                            <strong>Notes:</strong> {appointment.notes}
                          </p>
                        )}
                        <p className="text-xs text-gray-500 mt-2">
                          Confirmation: #{appointment.id.substring(0, 8)}
                        </p>
                      </div>
                    </div>
                    <div className="ml-4">
                      <button
                        onClick={() => handleCancelAppointment(appointment.id, appointment)}
                        className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                      >
                        Cancel Appointment
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Info */}
        <div className="mt-8 text-center text-sm text-gray-600">
          <p>Need help? Contact us at <a href="mailto:rozsagyenelaw1@gmail.com" className="text-blue-600 hover:text-blue-800">rozsagyenelaw1@gmail.com</a></p>
          <p className="mt-2">Already have an account? <a href="/login" className="text-blue-600 hover:text-blue-800 font-medium">Sign in to your portal</a></p>
        </div>
      </div>
    </div>
  );
};

export default PublicBooking;
