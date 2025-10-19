import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, 
  Mail, 
  Clock,
  AlertCircle,
  CheckCircle,
  Phone,
  ArrowLeft
} from 'lucide-react';
import { 
  collection, 
  query, 
  where, 
  orderBy,
  getDocs,
  doc,
  updateDoc
} from 'firebase/firestore';
import { db } from '../firebase';

const ClientMessages = ({ user, onBack }) => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [stats, setStats] = useState({
    total: 0,
    unread: 0
  });

  useEffect(() => {
    if (user) {
      loadMessages();
    }
  }, [user]);

  const loadMessages = async () => {
    try {
      setLoading(true);
      
      // Query messages for this client
      const messagesQuery = query(
        collection(db, 'messages'),
        where('clientId', '==', user.uid),
        orderBy('date', 'desc')
      );

      const messagesSnapshot = await getDocs(messagesQuery);
      const messagesData = messagesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date?.toDate()
      }));

      setMessages(messagesData);
      
      // Calculate stats
      setStats({
        total: messagesData.length,
        unread: messagesData.filter(m => m.unread).length
      });

      setLoading(false);
    } catch (error) {
      console.error('Error loading messages:', error);
      setLoading(false);
    }
  };

  const handleMessageClick = async (message) => {
    setSelectedMessage(message);
    
    // Mark as read if unread
    if (message.unread) {
      try {
        await updateDoc(doc(db, 'messages', message.id), {
          unread: false
        });
        
        // Update local state
        setMessages(prevMessages =>
          prevMessages.map(m =>
            m.id === message.id ? { ...m, unread: false } : m
          )
        );
        
        setStats(prevStats => ({
          ...prevStats,
          unread: Math.max(0, prevStats.unread - 1)
        }));
      } catch (error) {
        console.error('Error marking message as read:', error);
      }
    }
  };

  const formatDate = (date) => {
    if (!date) return 'Recently';
    
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return 'Today at ' + date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      });
    } else if (diffDays === 1) {
      return 'Yesterday at ' + date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      });
    } else if (diffDays < 7) {
      return date.toLocaleDateString('en-US', { 
        weekday: 'long',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } else {
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <MessageSquare className="h-12 w-12 text-blue-900 animate-pulse mx-auto mb-4" />
          <p className="text-gray-600">Loading messages...</p>
        </div>
      </div>
    );
  }

  // Message Detail View
  if (selectedMessage) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <button
            onClick={() => setSelectedMessage(null)}
            className="flex items-center text-blue-900 hover:text-blue-800 mb-6"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Back to Messages
          </button>

          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            {/* Message Header */}
            <div className="bg-blue-900 text-white px-6 py-4">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-2xl font-bold mb-2">{selectedMessage.subject}</h2>
                  <p className="text-blue-200 text-sm">
                    From: {selectedMessage.from}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-blue-200">
                    {formatDate(selectedMessage.date)}
                  </p>
                  <div className="mt-2 flex items-center justify-end space-x-2">
                    {selectedMessage.sentViaEmail && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-800 text-blue-100">
                        <Mail className="h-3 w-3 mr-1" />
                        Email
                      </span>
                    )}
                    {selectedMessage.sentViaSMS && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-800 text-green-100">
                        <Phone className="h-3 w-3 mr-1" />
                        SMS
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Message Body */}
            <div className="px-6 py-8">
              <div className="prose max-w-none">
                <div className="whitespace-pre-wrap text-gray-700 leading-relaxed">
                  {selectedMessage.message}
                </div>
              </div>
            </div>

            {/* Message Footer */}
            <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
              <p className="text-sm text-gray-600">
                If you have any questions about this message, please contact our office directly at{' '}
                <a href="mailto:rozsagyenelaw1@gmail.com" className="text-blue-900 hover:text-blue-800 font-medium">
                  rozsagyenelaw1@gmail.com
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Messages List View
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          {onBack && (
            <button
              onClick={onBack}
              className="flex items-center text-blue-900 hover:text-blue-800 mb-4"
            >
              <ArrowLeft className="h-5 w-5 mr-2" />
              Back to Dashboard
            </button>
          )}
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                <MessageSquare className="h-8 w-8 mr-3 text-blue-900" />
                Messages
              </h1>
              <p className="text-gray-600 mt-1">
                Communications from Law Offices of Rozsa Gyene
              </p>
            </div>
            
            {/* Stats */}
            <div className="flex space-x-4">
              <div className="bg-white rounded-lg shadow px-4 py-3 text-center">
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                <p className="text-sm text-gray-600">Total</p>
              </div>
              <div className="bg-blue-50 rounded-lg shadow px-4 py-3 text-center border-2 border-blue-200">
                <p className="text-2xl font-bold text-blue-900">{stats.unread}</p>
                <p className="text-sm text-blue-700">Unread</p>
              </div>
            </div>
          </div>
        </div>

        {/* Messages List */}
        {messages.length === 0 ? (
          <div className="bg-white rounded-lg shadow-lg p-12 text-center">
            <MessageSquare className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              No Messages Yet
            </h3>
            <p className="text-gray-600">
              When your attorney sends you a message, it will appear here.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="divide-y divide-gray-200">
              {messages.map((message) => (
                <button
                  key={message.id}
                  onClick={() => handleMessageClick(message)}
                  className={`w-full text-left px-6 py-5 hover:bg-gray-50 transition-colors ${
                    message.unread ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-3 mb-2">
                        {message.unread && (
                          <span className="flex-shrink-0 w-2 h-2 bg-blue-600 rounded-full"></span>
                        )}
                        <h3 className={`text-lg font-semibold truncate ${
                          message.unread ? 'text-gray-900' : 'text-gray-700'
                        }`}>
                          {message.subject}
                        </h3>
                        {message.unread && (
                          <span className="flex-shrink-0 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            New
                          </span>
                        )}
                      </div>
                      
                      <p className="text-sm text-gray-600 mb-2">
                        From: {message.from}
                      </p>
                      
                      <p className={`text-sm line-clamp-2 ${
                        message.unread ? 'text-gray-700' : 'text-gray-500'
                      }`}>
                        {message.message}
                      </p>
                      
                      <div className="mt-3 flex items-center space-x-4">
                        <span className="flex items-center text-xs text-gray-500">
                          <Clock className="h-4 w-4 mr-1" />
                          {formatDate(message.date)}
                        </span>
                        
                        <div className="flex items-center space-x-2">
                          {message.sentViaEmail && (
                            <span className="inline-flex items-center text-xs text-gray-500">
                              <Mail className="h-3 w-3 mr-1" />
                              Email
                            </span>
                          )}
                          {message.sentViaSMS && (
                            <span className="inline-flex items-center text-xs text-gray-500">
                              <Phone className="h-3 w-3 mr-1" />
                              SMS
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="ml-4 flex-shrink-0">
                      {message.unread ? (
                        <AlertCircle className="h-6 w-6 text-blue-600" />
                      ) : (
                        <CheckCircle className="h-6 w-6 text-gray-400" />
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Info Box */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex items-start">
            <AlertCircle className="h-6 w-6 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
            <div>
              <h4 className="text-sm font-semibold text-blue-900 mb-1">
                Important Information
              </h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Messages from your attorney will appear in this section</li>
                <li>• You'll receive email and/or SMS notifications when new messages arrive</li>
                <li>• For urgent matters, please contact our office directly</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClientMessages;
