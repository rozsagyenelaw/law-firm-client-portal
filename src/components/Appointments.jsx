import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Video, MapPin, CheckCircle, AlertCircle, X, Plus } from 'lucide-react';
import { collection, query, where, getDocs, addDoc, serverTimestamp, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { db, auth, functions } from '../firebase';
import { httpsCallable } from 'firebase/functions';

const Appointments = ({ userProfile }) => {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [appointmentType, setAppointmentType] = useState('phone');
  const [notes, setNotes] = useState('');
  const [availableSlots, setAvailableSlots] = useState([]);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Guest booking fields (when not logged in)
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPhone, setGuestPhone] = useState('');

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
  
  const isLoggedIn = auth.currentUser !== null;

  useEffect(() => {
    if (auth.currentUser) {
      loadAppointments();
    } else {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedDate) {
      generateAvailableSlots(selectedDate);
    }
  }, [selectedDate]);

  const loadAppointments = async () => {
    try {
      const appointmentsQuery = query(
        collection(db, 'appointments'),
        where('clientId', '==', auth.currentUser.uid),
        where('status', '!=', 'cancelled'),
        orderBy('status'),
        orderBy('appointmentDate', 'asc')
      );
      
      const snapshot = await getDocs(appointmentsQuery);
      const appts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        appointmentDate: doc.data().appointmentDate?.toDate()
      }));

      // Filter out past appointments
      const now = new Date();
      const upcomingAppts = appts.filter(appt => appt.appointmentDate >= now);
      
      setAppointments(upcomingAppts);
    } catch (error) {
      console.error('Error loading appointments:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateAvailableSlots = async (dateString) => {
    // Parse the date in Pacific Time
    const date = new Date(dateString + 'T00:00:00-08:00'); // Force Pacific Time
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
        
        // Only show future slots (compare with Pacific time)
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
      // Get client info - either from auth or guest fields
      const clientName = isLoggedIn 
        ? (userProfile ? `${userProfile.firstName} ${userProfile.lastName}` : auth.currentUser.email)
        : guestName;
      const clientEmail = isLoggedIn ? auth.currentUser.email : guestEmail;
      const clientPhone = isLoggedIn ? (userProfile?.phone || '') : guestPhone;
      
      // Create appointment date object in Pacific Time
      const [hours, minutes] = selectedTime.split(':');
      
      // Create a date string in Pacific Time format
      const pacificDateString = `${selectedDate}T${selectedTime}:00-08:00`;
      const appointmentDate = new Date(pacificDateString);

      // Create appointment document
      const appointmentData = {
        clientId: isLoggedIn ? auth.currentUser.uid : 'guest',
        clientName: clientName,
        clientEmail: clientEmail,
        clientPhone: clientPhone,
        appointmentDate: appointmentDate,
        appointmentType: appointmentType,
        notes: notes,
        status: 'confirmed',
        createdAt: serverTimestamp(),
        isGuestBooking: !isLoggedIn,
        remindersSent: {
          '24hours': false,
          '1hour': false
        }
      };

      const docRef = await addDoc(collection(db, 'appointments'), appointmentData);

      // Send confirmation emails - BLUE email to both client and attorney
      try {
        const appointmentDetails = {
          appointmentId: docRef.id,
          clientName: clientName,
          clientEmail: clientEmail,
          clientPhone: clientPhone,
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

        // Send BLUE confirmation email to CLIENT
        const sendClientConfirmation = httpsCallable(functions, 'sendClientAppointmentConfirmation');
        await sendClientConfirmation(appointmentDetails);

        // Send same BLUE confirmation email to ATTORNEY
        const sendAttorneyConfirmation = httpsCallable(functions, 'sendClientAppointmentConfirmation');
        await sendAttorneyConfirmation({
          ...appointmentDetails,
          clientEmail: 'rozsagyenelaw1@gmail.com' // Override to send to attorney
        });
        
      } catch (emailError) {
        console.error('Email notification failed:', emailError);
        // Don't fail the booking if email fails
      }

      setSuccessMessage('Appointment booked successfully! You will receive a confirmation email shortly.');
      setShowBookingModal(false);
      setSelectedDate('');
      setSelectedTime('');
      setAppointmentType('phone');
      setNotes('');
      setGuestName('');
      setGuestEmail('');
      setGuestPhone('');
      
      // Reload appointments if logged in
      if (isLoggedIn) {
        await loadAppointments();
      }

      // Clear success message after 5 seconds
      setTimeout(() => {
        setSuccessMessage('');
      }, 5000);

    } catch (error) {
      console.error('Error booking appointment:', error);
      setErrorMessage('Failed to book appointment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelAppointment = async (appointmentId) => {
    if (!window.confirm('Are you sure you want to cancel this appointment?')) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'appointments', appointmentId));
      setSuccessMessage('Appointment cancelled successfully.');
      await loadAppointments();

      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);
    } catch (error) {
      console.error('Error cancelling appointment:', error);
      setErrorMessage('Failed to cancel appointment. Please try again.');
    }
  };

  // Get minimum date (today)
  const getMinDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  // Get maximum date (3 months from now)
  const getMaxDate = () => {
    const maxDate = new Date();
    maxDate.setMonth(maxDate.getMonth() + 3);
    return maxDate.toISOString().split('T')[0];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <Calendar className="h-12 w-12 text-blue-900 animate-pulse mx-auto mb-4" />
          <p className="text-gray-600">Loading appointments...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Appointments</h2>
        <button
          onClick={() => setShowBookingModal(true)}
          className="flex items-center px-4 py-2 bg-blue-900 text-white rounded-md hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <Plus className="h-5 w-5 mr-2" />
          Book Appointment
        </button>
      </div>

      {successMessage && (
        <div className="mb-4 bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded relative flex items-center">
          <CheckCircle className="h-5 w-5 mr-2" />
          {successMessage}
        </div>
      )}

      {errorMessage && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded relative flex items-center">
          <AlertCircle className="h-5 w-5 mr-2" />
          {errorMessage}
        </div>
      )}

      {/* Info Card */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
        <h3 className="text-lg font-medium text-blue-900 mb-2">Schedule a Consultation</h3>
        <p className="text-blue-700 mb-4">
          Book a consultation for estate planning, probate, or trust administration matters.
        </p>
        <div className="space-y-2 text-sm text-blue-800">
          <div className="flex items-center">
            <Clock className="h-4 w-4 mr-2" />
            <span>30-minute appointments</span>
          </div>
          <div className="flex items-center">
            <Calendar className="h-4 w-4 mr-2" />
            <span>Available Mon-Fri: 9:00 AM - 5:00 PM, Sat: 9:00 AM - 2:00 PM (Pacific Time)</span>
          </div>
          <div className="flex items-center">
            <Video className="h-4 w-4 mr-2" />
            <span>Virtual or phone consultations available</span>
          </div>
        </div>
      </div>

      {/* Upcoming Appointments - Only show if logged in */}
      {isLoggedIn && (
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Your Appointments</h3>
          </div>
          <div className="p-6">
            {appointments.length > 0 ? (
              <div className="space-y-4">
                {appointments.map((appointment) => (
                  <div key={appointment.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center mb-2">
                          {appointment.appointmentType === 'virtual' ? (
                            <Video className="h-5 w-5 text-green-600 mr-2" />
                          ) : (
                            <MapPin className="h-5 w-5 text-blue-600 mr-2" />
                          )}
                          <h4 className="text-sm font-medium text-gray-900">
                            {APPOINTMENT_TYPES.find(t => t.value === appointment.appointmentType)?.label}
                          </h4>
                        </div>
                        <div className="space-y-1 text-sm text-gray-600">
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
                        </div>
                      </div>
                      <div className="ml-4 flex flex-col items-end space-y-2">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Confirmed
                        </span>
                        <button
                          onClick={() => handleCancelAppointment(appointment.id)}
                          className="text-sm text-red-600 hover:text-red-800"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No upcoming appointments</p>
                <button
                  onClick={() => setShowBookingModal(true)}
                  className="mt-4 text-blue-600 hover:text-blue-800 font-medium"
                >
                  Book your first appointment
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Booking Modal */}
      {showBookingModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
          <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-900">Book an Appointment</h3>
              <button
                onClick={() => setShowBookingModal(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleBookAppointment} className="p-6 space-y-6">
              {/* Guest Information - Only show if not logged in */}
              {!isLoggedIn && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-4">
                  <h4 className="font-medium text-blue-900">Your Information</h4>
                  
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
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              )}

              {/* Appointment Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Appointment Type
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {APPOINTMENT_TYPES.map((type) => {
                    const Icon = type.icon;
                    return (
                      <button
                        key={type.value}
                        type="button"
                        onClick={() => setAppointmentType(type.value)}
                        className={`p-4 border-2 rounded-lg flex items-center justify-center space-x-3 transition-colors ${
                          appointmentType === type.value
                            ? 'border-blue-600 bg-blue-50'
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Date
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  min={getMinDate()}
                  max={getMaxDate()}
                  required
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="mt-1 text-sm text-gray-500">
                  Available Mon-Fri: 9 AM - 5 PM, Sat: 9 AM - 2 PM
                </p>
              </div>

              {/* Time Selection */}
              {selectedDate && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Time (Pacific Time)
                  </label>
                  {availableSlots.length > 0 ? (
                    <div className="grid grid-cols-3 md:grid-cols-4 gap-2 max-h-64 overflow-y-auto">
                      {availableSlots.map((slot) => (
                        <button
                          key={slot}
                          type="button"
                          onClick={() => setSelectedTime(slot)}
                          className={`px-3 py-2 text-sm border rounded-md transition-colors ${
                            selectedTime === slot
                              ? 'border-blue-600 bg-blue-50 text-blue-700 font-medium'
                              : 'border-gray-300 hover:border-gray-400 text-gray-700'
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
                    <p className="text-sm text-gray-500 py-4 text-center">
                      No available time slots for this date. Please select another date.
                    </p>
                  )}
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes (Optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Any specific topics you'd like to discuss?"
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Submit Button */}
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowBookingModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!selectedDate || !selectedTime || isSubmitting}
                  className="px-4 py-2 bg-blue-900 text-white rounded-md hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Booking...' : 'Confirm Appointment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Appointments;
