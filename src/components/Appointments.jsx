import React, { useState } from 'react';
import { Calendar, Clock, ExternalLink, Video, MapPin } from 'lucide-react';

const Appointments = ({ userProfile }) => {
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
          
          {/* Virtual Consultation Only */}
          <div className="max-w-md mx-auto mb-6">
            <div className="border border-gray-200 rounded-lg p-6">
              <div className="flex items-center mb-3">
                <Video className="h-6 w-6 text-green-600 mr-3" />
                <h4 className="text-lg font-medium">Virtual Consultation</h4>
              </div>
              <p className="text-gray-600 mb-4">
                Meet with us online via secure video conference from the comfort of your home
              </p>
              <a
                href={SQUARE_BOOKING_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center px-6 py-3 bg-green-600 text-white rounded-md hover:bg-green-700"
              >
                Book Virtual Meeting
                <ExternalLink className="h-4 w-4 ml-2" />
              </a>
            </div>
          </div>
          
          {/* Alternative Book Button */}
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
      
      {/* Booking Modal - Removed since we're using direct links */}
    </div>
  );
};

export default Appointments;
