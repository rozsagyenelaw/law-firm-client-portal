import React, { useState } from 'react';
import { Calendar, Clock, ExternalLink, Video, MapPin } from 'lucide-react';

const Appointments = ({ userProfile }) => {
  const [showBookingModal, setShowBookingModal] = useState(false);
  
  // Your Square Appointments URL
  const SQUARE_BOOKING_URL = 'https://square.site/book/0W2A8PKKPYC21/law-offices-of-rozsa-gyene-glendale-ca';
  
  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Appointments</h2>
      
      {/* Book New Appointment */}
      <div className="bg-white shadow rounded-lg mb-6">
        <div className="p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Book an Appointment</h3>
          <p className="text-gray-600 mb-6">
            Schedule a consultation for estate planning, probate, or trust administration matters.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* Office Visit */}
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center mb-2">
                <MapPin className="h-5 w-5 text-blue-600 mr-2" />
                <h4 className="font-medium">Office Visit</h4>
              </div>
              <p className="text-sm text-gray-600 mb-3">
                Visit us at our Glendale office for an in-person consultation
              </p>
              <button
                onClick={() => setShowBookingModal(true)}
                className="w-full px-4 py-2 bg-blue-900 text-white rounded-md hover:bg-blue-800"
              >
                Book Office Visit
              </button>
            </div>
            
            {/* Virtual Consultation */}
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center mb-2">
                <Video className="h-5 w-5 text-green-600 mr-2" />
                <h4 className="font-medium">Virtual Consultation</h4>
              </div>
              <p className="text-sm text-gray-600 mb-3">
                Meet with us online via secure video conference
              </p>
              <button
                onClick={() => setShowBookingModal(true)}
                className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
              >
                Book Virtual Meeting
              </button>
            </div>
          </div>
          
          {/* Quick Book Button */}
          <div className="text-center">
            <a
              href={SQUARE_BOOKING_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-6 py-3 bg-blue-900 text-white rounded-md hover:bg-blue-800"
            >
              <Calendar className="h-5 w-5 mr-2" />
              Book Appointment Now
              <ExternalLink className="h-4 w-4 ml-2" />
            </a>
          </div>
        </div>
      </div>
      
      {/* Upcoming Appointments */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Your Appointments</h3>
        </div>
        <div className="p-6">
          <div className="text-center text-gray-500">
            <Calendar className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p>No upcoming appointments</p>
            <p className="text-sm mt-2">
              Book an appointment above to get started
            </p>
          </div>
        </div>
      </div>
      
      {/* Booking Modal */}
      {showBookingModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="text-lg font-medium text-gray-900">Book an Appointment</h3>
              <button
                onClick={() => setShowBookingModal(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                ✕
              </button>
            </div>
            <div className="p-0" style={{ height: '600px' }}>
              <iframe
                src={`${SQUARE_BOOKING_URL}?embedded=true`}
                width="100%"
                height="100%"
                frameBorder="0"
                title="Book Appointment"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Appointments;
