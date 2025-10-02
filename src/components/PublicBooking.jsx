import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Video, Phone, CheckCircle, AlertCircle, X } from 'lucide-react';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, functions } from '../firebase';
import { httpsCallable } from 'firebase/functions';

const PublicBooking = () => {
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [appointmentType, setAppointmentType] = useState('phone');
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [availableSlots, setAvailableSlots] = useState([]);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const APPOINTMENT_TYPES = [
    { value: 'virtual', label: 'Virtual Consultation', icon: Video },
    { value: 'phone', label: 'Over the Phone', icon: Phone }
  ];

  const BUSINESS_HOURS = {
    monday: { start: 9, end: 17 },
    tuesday: { start: 9, end: 17 },
    wednesday: { start: 9, end: 17 },
    thursday: { start: 9, end: 17 },
    friday: { start: 9, end: 17 },
    saturday: { start: 9, end: 14 },
    sunday: null
  };

  const APPOINTMENT_DURATION = 30;

  useEffect(() => {
    if (selectedDate) {
      generateAvailableSlots(selectedDate);
    }
  }, [selectedDate]);

  const generateAvailableSlots = async (dateString) => {
    const date = new Date(dateString + 'T00:00:00-08:00');
    const dayName = date.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'America/Los_Angeles' }).toLowerCase();
    
    const hours = BUSINESS_HOURS[dayName];
    if (!hours) {
      setAvailableSlots([]);
      return;
    }

    const nowPacific = new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' });
    const now = new Date(nowPacific);

    const slots = [];
    for (let hour = hours.start; hour < hours.end; hour++) {
      for (let minute = 0; minute < 60; minute += APPOINTMENT_DURATION) {
        const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        const slotDateTime = new Date(dateString + `T${time}:00-08:00`);
        
        if (slotDateTime > now) {
          slots.push(time);
        }
      }
    }

    try {
      const startOfDay = new Date(dateString + 'T00:00:00-08:00');
      const endOfDay = new Date(dateString + 'T23:59:59-08:00');
      
      const appointmentsQuery = query(
        collection(db, 'appointments'),
        where('appointmentDate', '>=', startOfDay),
        where('appointmentDate', '<=', endOfDay),
        where('status', '==', 'confirmed')
      );
      
      const snapshot = await getDocs(appointmentsQuery);
      const bookedTimes = snapshot.docs.map(doc => {
        const apptDate = doc.data().appointmentDate.toDate();
        return `${apptDate.getHours().toString().padStart(2, '0')}:${apptDate.getMinutes().toString().padStart(2, '0')}`;
      });

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

    // Validation
    if (!clientName || !clientEmail || !clientPhone) {
      setErrorMessage('Please fill in all required fields.');
      setIsSubmitting(false);
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(clientEmail)) {
      setErrorMessage('Please enter a valid email address.');
      setIsSubmitting(false);
      return;
    }

    try {
      const pacificDateString = `${selectedDate}T${selectedTime}:00-08:00`;
      const appointmentDate = new Date(pacificDateString);

      const appointmentData = {
        clientId: 'public',
        clientName: clientName,
        clientEmail: clientEmail,
        clientPhone: clientPhone,
        appointmentDate: appointmentDate,
        appointmentType: appointmentType,
        notes: notes,
        status: 'confirmed',
        createdAt: serverTimestamp(),
        isPublicBooking: true,
        remindersSent: {
          '24hours': false,
          '1hour': false
        }
      };

      const docRef = await addDoc(collection(db, 'appointments'), appointmentData);

      // Send confirmation email
      try {
        const sendAppointmentEmail = httpsCallable(functions, 'sendAppointmentConfirmation');
        await sendAppointmentEmail({
          appointmentId: docRef.id,
          clientName: appointmentData.clientName,
          clientEmail: appointmentData.clientEmail,
          appointmentDate: appointmentDate.toISOString(),
          appointmentTime: appointmentDate.toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            minute: '2-digit',
            hour12: true,
            timeZone: 'America/Los_Angeles'
          }),
          appointmentType: APPOINTMENT_TYPES.find(t => t.value === appointmentType)?.label,
          notes: notes || 'None'
        });
      } catch (emailError) {
        console.error('Email notification failed:', emailError);
      }

      setSuccessMessage('Appointment booked successfully! You will receive a confirmation email shortly.');
      
      // Reset form
      setSelectedDate('');
      setSelectedTime('');
      setAppointmentType('phone');
      setClientName('');
      setClientEmail('');
      setClientPhone('');
      setNotes('');

      // Scroll to top to show success message
      window.scrollTo({ top: 0, behavior: 'smooth' });

    } catch (error) {
      console.error('Error booking appointment:', error);
      setErrorMessage('Failed to book appointment. Please try again or contact us directly.');
    } finally {
      setIsSubmitting(false);
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Book a Consultation</h1>
          <p className="text-lg text-gray-600">Law Offices of Rozsa Gyene</p>
          <p className="text-sm text-gray-500 mt-2">Estate Planning, Probate & Trust Administration</p>
        </div>

        {successMessage && (
          <div className="mb-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-start">
            <CheckCircle className="h-5 w-5 mr-3 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium">{successMessage}</p>
              <p className="text-sm mt-1">We look forward to speaking with you!</p>
            </div>
          </div>
        )}

        {errorMessage && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-start">
            <AlertCircle className="h-5 w-5 mr-3 mt-0.5 flex-shrink-0" />
            <p>{errorMessage}</p>
          </div>
        )}

        {/* Info Card */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
          <h3 className="text-lg font-medium text-blue-900 mb-3">Office Hours</h3>
          <div className="space-y-2 text-sm text-blue-800">
            <div className="flex items-center">
              <Calendar className="h-4 w-4 mr-2 flex-shrink-0" />
              <span>Monday - Friday: 9:00 AM - 5:00 PM</span>
            </div>
            <div className="flex items-center">
              <Calendar className="h-4 w-4 mr-2 flex-shrink-0" />
              <span>Saturday: 9:00 AM - 2:00 PM</span>
            </div>
            <div className="flex items-center">
              <Clock className="h-4 w-4 mr-2 flex-shrink-0" />
              <span>30-minute appointments (Pacific Time)</span>
            </div>
          </div>
        </div>

        {/* Booking Form */}
        <div className="bg-white shadow-lg rounded-lg p-8">
          <form onSubmit={handleBookAppointment} className="space-y-6">
            
            {/* Contact Information */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Your Information</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    required
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="John Doe"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    required
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="john@example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    required
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="(555) 123-4567"
                  />
                </div>
              </div>
            </div>

            {/* Appointment Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Consultation Type
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
            </div>

            {/* Time Selection */}
            {selectedDate && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Time (Pacific Time)
                </label>
                {availableSlots.length > 0 ? (
                  <div className="grid grid-cols-3 md:grid-cols-4 gap-2 max-h-64 overflow-y-auto p-2 border border-gray-200 rounded-md">
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
                  <p className="text-sm text-gray-500 py-4 text-center border border-gray-200 rounded-md">
                    No available time slots for this date. Please select another date.
                  </p>
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
                rows={3}
                placeholder="Any specific topics you'd like to discuss?"
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Submit Button */}
            <div>
              <button
                type="submit"
                disabled={!selectedDate || !selectedTime || isSubmitting}
                className="w-full px-6 py-3 bg-blue-900 text-white text-lg font-medium rounded-md hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? 'Booking...' : 'Confirm Appointment'}
              </button>
            </div>
          </form>
        </div>

        {/* Contact Info */}
        <div className="mt-8 text-center text-sm text-gray-600">
          <p>Questions? Contact us at <a href="mailto:rozsagyenelaw@yahoo.com" className="text-blue-600 hover:text-blue-800">rozsagyenelaw@yahoo.com</a></p>
        </div>
      </div>
    </div>
  );
};

export default PublicBooking;
