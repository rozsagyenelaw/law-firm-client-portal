import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, FileText, Download, Upload, MessageSquare, User, LogOut, Folder, Home, Shield, Clock, DollarSign, AlertCircle, CheckCircle, Menu, X, Calendar, CreditCard, Settings, Lock, Save, Send, PenTool, Edit3 } from 'lucide-react';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  query, 
  where, 
  getDocs,
  addDoc,
  orderBy,
  serverTimestamp,
  updateDoc
} from 'firebase/firestore';
import { 
  ref, 
  uploadBytes, 
  getDownloadURL, 
  listAll 
} from 'firebase/storage';
import { auth, db, storage } from './firebase';
import StripePayment from './components/StripePayment';
import AdminDashboard from './components/AdminDashboard';
import Appointments from './components/Appointments';
import DocumentSigning from './components/DocumentSigning';
import DocumentUpload from './components/DocumentUpload';
import DocuSign from './components/DocuSign';
import PublicBooking from './components/PublicBooking';
import emailjs from '@emailjs/browser';

// Initialize EmailJS with your public key
emailjs.init('tlwGhvG0aPvocwYcO');

const ClientPortal = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSignup, setIsSignup] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [error, setError] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [userDocuments, setUserDocuments] = useState([]);
  const [userMatters, setUserMatters] = useState([]);
  const [userMessages, setUserMessages] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userProfile, setUserProfile] = useState(null);

  // Client upload states
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  // Password change states
  const [passwordChangeData, setPasswordChangeData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordChangeMessage, setPasswordChangeMessage] = useState('');
  const [passwordChangeError, setPasswordChangeError] = useState('');

  // Admin emails that have access to admin dashboard
  const ADMIN_EMAILS = ['rozsagyenelaw@yahoo.com'];

  // Check if current path is /admin
  const isAdminRoute = window.location.pathname === '/admin';

  // Check if current path is public booking page
  const isPublicBookingRoute = window.location.pathname === '/book' || 
                               window.location.pathname === '/book-appointment' ||
                               window.location.pathname === '/appointments';

  // Check if current path is signing page - /sign/:sessionId
  const isSigningRoute = window.location.pathname.startsWith('/sign/');
  const sessionId = isSigningRoute ? window.location.pathname.split('/sign/')[1] : null;

  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUser(user);
        const userIsAdmin = ADMIN_EMAILS.includes(user.email);
        setIsAdmin(userIsAdmin);
        
        // Only load user profile and data for non-admin users
        if (!userIsAdmin) {
          // First try to find user by uid
          let userQuery = query(collection(db, 'users'), where('uid', '==', user.uid));
          let userSnapshot = await getDocs(userQuery);
          
          // If not found by uid, try by email
          if (userSnapshot.empty) {
            userQuery = query(collection(db, 'users'), where('email', '==', user.email));
            userSnapshot = await getDocs(userQuery);
          }
          
          if (!userSnapshot.empty) {
            const userData = { id: userSnapshot.docs[0].id, ...userSnapshot.docs[0].data() };
            setUserProfile(userData);
            // Pass the user data to loadUserData
            await loadUserData(user, userData);
          }
        }
      } else {
        setUser(null);
        setIsAdmin(false);
        setUserProfile(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const loadUserData = async (user, profileData = null) => {
    try {
      // Use profileData if provided, otherwise use user
      const userIdForQuery = profileData ? (profileData.uid || profileData.id) : user.uid;
      
      // Load user's matters
      const mattersQuery = query(
        collection(db, 'matters'), 
        where('clientId', '==', userIdForQuery)
      );
      const mattersSnapshot = await getDocs(mattersQuery);
      const matters = mattersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setUserMatters(matters);

      // Load ALL documents for this user (check both uid and id)
      const documentsQuery1 = query(
        collection(db, 'documents'),
        where('clientId', '==', user.uid)
      );
      const documentsSnapshot1 = await getDocs(documentsQuery1);
      
      // Also check with the profile uid/id if different
      let documentsSnapshot2 = { docs: [] };
      if (profileData && profileData.uid && profileData.uid !== user.uid) {
        const documentsQuery2 = query(
          collection(db, 'documents'),
          where('clientId', '==', profileData.uid)
        );
        documentsSnapshot2 = await getDocs(documentsQuery2);
      }
      
      // Also check with the document id if available
      let documentsSnapshot3 = { docs: [] };
      if (profileData && profileData.id) {
        const documentsQuery3 = query(
          collection(db, 'documents'),
          where('clientId', '==', profileData.id)
        );
        documentsSnapshot3 = await getDocs(documentsQuery3);
      }
      
      // Combine all documents and remove duplicates
      const allDocs = [
        ...documentsSnapshot1.docs,
        ...documentsSnapshot2.docs,
        ...documentsSnapshot3.docs
      ];
      
      const uniqueDocs = allDocs.reduce((acc, doc) => {
        if (!acc.find(d => d.id === doc.id)) {
          acc.push(doc);
        }
        return acc;
      }, []);
      
      const documents = uniqueDocs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Sort documents by upload date (handling both serverTimestamp and regular dates)
      const sortedDocuments = documents.sort((a, b) => {
        const dateA = a.uploadDate?.toDate ? a.uploadDate.toDate() : new Date(a.uploadDate || 0);
        const dateB = b.uploadDate?.toDate ? b.uploadDate.toDate() : new Date(b.uploadDate || 0);
        return dateB - dateA;
      });
      
      setUserDocuments(sortedDocuments);

      // Load messages for the user (check multiple ID fields)
      const messagesQuery1 = query(
        collection(db, 'messages'),
        where('clientId', '==', user.uid),
        orderBy('date', 'desc')
      );
      const messagesSnapshot1 = await getDocs(messagesQuery1);
      
      // Also try with profile uid if different
      let messagesSnapshot2 = { docs: [] };
      if (profileData && profileData.uid && profileData.uid !== user.uid) {
        const messagesQuery2 = query(
          collection(db, 'messages'),
          where('clientId', '==', profileData.uid),
          orderBy('date', 'desc')
        );
        messagesSnapshot2 = await getDocs(messagesQuery2);
      }

      // Try with email as fallback
      let messagesSnapshot3 = { docs: [] };
      const messagesQuery3 = query(
        collection(db, 'messages'),
        where('clientId', '==', user.email),
        orderBy('date', 'desc')
      );
      messagesSnapshot3 = await getDocs(messagesQuery3);
      
      // Combine all messages and remove duplicates
      const allMessages = [
        ...messagesSnapshot1.docs,
        ...messagesSnapshot2.docs,
        ...messagesSnapshot3.docs
      ];
      
      const uniqueMessages = allMessages.reduce((acc, doc) => {
        if (!acc.find(d => d.id === doc.id)) {
          acc.push(doc);
        }
        return acc;
      }, []);
      
      const messages = uniqueMessages.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      setUserMessages(messages);
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');
    
    const email = e.target.email.value;
    const password = e.target.password.value;
    const firstName = e.target.firstName.value;
    const lastName = e.target.lastName.value;
    const phone = e.target.phone.value;

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      // Create user profile
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        uid: userCredential.user.uid,
        email,
        firstName,
        lastName,
        phone,
        createdAt: serverTimestamp(),
        role: 'client'
      });

      // Send welcome email using EmailJS
      try {
        await emailjs.send(
          'service_h8b0pnh',
          'template_xcq0zt9',
          {
            to_email: email,
            to_name: `${firstName} ${lastName}`,
            from_name: 'Rozsagyne Law',
            reply_to: 'rozsagyenelaw@yahoo.com'
          }
        );
      } catch (emailError) {
        console.error('Error sending welcome email:', emailError);
      }

    } catch (error) {
      setError(error.message);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    
    const email = e.target.email.value;
    const password = e.target.password.value;

    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      setError('Invalid email or password');
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setActiveTab('dashboard');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleFileUpload = async (e) => {
    e.preventDefault();
    
    if (!selectedFile) {
      setUploadError('Please select a file');
      return;
    }

    if (!selectedCategory) {
      setUploadError('Please select a category');
      return;
    }

    setIsUploading(true);
    setUploadError('');
    setUploadSuccess('');

    try {
      // Create a unique filename
      const timestamp = Date.now();
      const fileName = `${user.uid}/${selectedCategory}/${timestamp}_${selectedFile.name}`;
      const storageRef = ref(storage, `documents/${fileName}`);

      // Upload file
      await uploadBytes(storageRef, selectedFile);
      const downloadURL = await getDownloadURL(storageRef);

      // Save metadata to Firestore
      await addDoc(collection(db, 'documents'), {
        clientId: user.uid,
        clientEmail: user.email,
        fileName: selectedFile.name,
        category: selectedCategory,
        uploadDate: serverTimestamp(),
        url: downloadURL,
        storagePath: fileName,
        size: selectedFile.size,
        type: selectedFile.type
      });

      setUploadSuccess('File uploaded successfully!');
      setSelectedFile(null);
      setSelectedCategory('');
      
      // Reload user data to show new document
      await loadUserData(user, userProfile);

      // Clear success message after 3 seconds
      setTimeout(() => {
        setUploadSuccess('');
      }, 3000);

    } catch (error) {
      console.error('Error uploading file:', error);
      setUploadError('Failed to upload file. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPasswordChangeMessage('');
    setPasswordChangeError('');

    // Validate passwords
    if (passwordChangeData.newPassword !== passwordChangeData.confirmPassword) {
      setPasswordChangeError('New passwords do not match');
      return;
    }

    if (passwordChangeData.newPassword.length < 6) {
      setPasswordChangeError('Password must be at least 6 characters');
      return;
    }

    try {
      // Re-authenticate user
      const credential = EmailAuthProvider.credential(
        user.email,
        passwordChangeData.currentPassword
      );
      await reauthenticateWithCredential(user, credential);

      // Update password
      await updatePassword(user, passwordChangeData.newPassword);

      // Clear form and show success message
      setPasswordChangeData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
      setPasswordChangeMessage('Password updated successfully!');

      // Clear success message after 5 seconds
      setTimeout(() => {
        setPasswordChangeMessage('');
      }, 5000);

    } catch (error) {
      console.error('Error changing password:', error);
      if (error.code === 'auth/wrong-password') {
        setPasswordChangeError('Current password is incorrect');
      } else {
        setPasswordChangeError('Failed to update password. Please try again.');
      }
    }
  };

  const markMessageAsRead = async (messageId) => {
    try {
      const messageRef = doc(db, 'messages', messageId);
      await updateDoc(messageRef, {
        unread: false
      });
      
      // Update local state
      setUserMessages(prevMessages =>
        prevMessages.map(msg =>
          msg.id === messageId ? { ...msg, unread: false } : msg
        )
      );
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  };

  // Show loading spinner
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-900"></div>
      </div>
    );
  }

  // Show public booking page if on /book route
  if (isPublicBookingRoute) {
    return <PublicBooking />;
  }

  // Show signing page if on /sign/:sessionId route
  if (isSigningRoute && sessionId) {
    return <SigningPage sessionId={sessionId} />;
  }

  // Show admin dashboard if admin and on /admin route
  if (isAdminRoute && isAdmin && user) {
    return <AdminDashboard />;
  }

  // Show login/signup if not authenticated
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-8">
          <div className="text-center mb-8">
            <Shield className="h-12 w-12 text-blue-900 mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-gray-900">Client Portal</h1>
            <p className="text-gray-600 mt-2">Rozsagyne Law</p>
          </div>

          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded relative">
              <AlertCircle className="h-5 w-5 inline mr-2" />
              {error}
            </div>
          )}

          {isSignup ? (
            <form onSubmit={handleSignup} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                  <input
                    type="text"
                    name="firstName"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                  <input
                    type="text"
                    name="lastName"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  name="email"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="tel"
                  name="phone"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    required
                    minLength={6}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5 text-gray-400" /> : <Eye className="h-5 w-5 text-gray-400" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-blue-900 text-white py-2 px-4 rounded-md hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Create Account
              </button>

              <p className="text-center text-sm text-gray-600">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setIsSignup(false);
                    setError('');
                  }}
                  className="text-blue-900 hover:text-blue-700 font-medium"
                >
                  Sign In
                </button>
              </p>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  name="email"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5 text-gray-400" /> : <Eye className="h-5 w-5 text-gray-400" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-blue-900 text-white py-2 px-4 rounded-md hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Sign In
              </button>

              <p className="text-center text-sm text-gray-600">
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setIsSignup(true);
                    setError('');
                  }}
                  className="text-blue-900 hover:text-blue-700 font-medium"
                >
                  Sign Up
                </button>
              </p>
            </form>
          )}
        </div>
      </div>
    );
  }

  // Main portal for authenticated users
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-blue-900 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <Shield className="h-8 w-8 mr-3" />
              <div>
                <h1 className="text-2xl font-bold">Client Portal</h1>
                <p className="text-sm text-blue-100">Rozsagyne Law</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="hidden md:flex items-center">
                <User className="h-5 w-5 mr-2" />
                <span className="text-sm">
                  {userProfile ? `${userProfile.firstName} ${userProfile.lastName}` : user.email}
                </span>
              </div>
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="md:hidden p-2 rounded-md hover:bg-blue-800"
              >
                {sidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
              <button
                onClick={handleLogout}
                className="hidden md:flex items-center px-4 py-2 bg-blue-800 rounded-md hover:bg-blue-700 transition-colors"
              >
                <LogOut className="h-5 w-5 mr-2" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Sidebar */}
          <aside className={`${sidebarOpen ? 'block' : 'hidden'} md:block w-full md:w-64 flex-shrink-0`}>
            <nav className="bg-white rounded-lg shadow-md p-4 space-y-2">
              <button
                onClick={() => {
                  setActiveTab('dashboard');
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center px-4 py-3 rounded-md transition-colors ${
                  activeTab === 'dashboard'
                    ? 'bg-blue-50 text-blue-900'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Home className="h-5 w-5 mr-3" />
                Dashboard
              </button>

              <button
                onClick={() => {
                  setActiveTab('documents');
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center px-4 py-3 rounded-md transition-colors ${
                  activeTab === 'documents'
                    ? 'bg-blue-50 text-blue-900'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <FileText className="h-5 w-5 mr-3" />
                Documents
                {userDocuments.length > 0 && (
                  <span className="ml-auto bg-blue-100 text-blue-900 text-xs font-medium px-2 py-1 rounded-full">
                    {userDocuments.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => {
                  setActiveTab('matters');
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center px-4 py-3 rounded-md transition-colors ${
                  activeTab === 'matters'
                    ? 'bg-blue-50 text-blue-900'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Folder className="h-5 w-5 mr-3" />
                My Matters
              </button>

              <button
                onClick={() => {
                  setActiveTab('appointments');
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center px-4 py-3 rounded-md transition-colors ${
                  activeTab === 'appointments'
                    ? 'bg-blue-50 text-blue-900'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Calendar className="h-5 w-5 mr-3" />
                Appointments
              </button>

              <button
                onClick={() => {
                  setActiveTab('messages');
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center px-4 py-3 rounded-md transition-colors ${
                  activeTab === 'messages'
                    ? 'bg-blue-50 text-blue-900'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <MessageSquare className="h-5 w-5 mr-3" />
                Messages
                {userMessages.filter(m => m.unread).length > 0 && (
                  <span className="ml-auto bg-red-500 text-white text-xs font-medium px-2 py-1 rounded-full">
                    {userMessages.filter(m => m.unread).length}
                  </span>
                )}
              </button>

              <button
                onClick={() => {
                  setActiveTab('billing');
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center px-4 py-3 rounded-md transition-colors ${
                  activeTab === 'billing'
                    ? 'bg-blue-50 text-blue-900'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <CreditCard className="h-5 w-5 mr-3" />
                Billing
              </button>

              <button
                onClick={() => {
                  setActiveTab('settings');
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center px-4 py-3 rounded-md transition-colors ${
                  activeTab === 'settings'
                    ? 'bg-blue-50 text-blue-900'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Settings className="h-5 w-5 mr-3" />
                Settings
              </button>

              <button
                onClick={() => {
                  handleLogout();
                  setSidebarOpen(false);
                }}
                className="md:hidden w-full flex items-center px-4 py-3 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <LogOut className="h-5 w-5 mr-3" />
                Sign Out
              </button>
            </nav>
          </aside>

          {/* Main Content */}
          <main className="flex-1">
            {/* Dashboard */}
            {activeTab === 'dashboard' && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Welcome Back!</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                  <div className="bg-white p-6 rounded-lg shadow-md">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Documents</p>
                        <p className="text-2xl font-bold text-gray-900">{userDocuments.length}</p>
                      </div>
                      <FileText className="h-8 w-8 text-blue-500" />
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-lg shadow-md">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Active Matters</p>
                        <p className="text-2xl font-bold text-gray-900">{userMatters.length}</p>
                      </div>
                      <Folder className="h-8 w-8 text-green-500" />
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-lg shadow-md">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Unread Messages</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {userMessages.filter(m => m.unread).length}
                        </p>
                      </div>
                      <MessageSquare className="h-8 w-8 text-yellow-500" />
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-lg shadow-md">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Status</p>
                        <p className="text-sm font-bold text-green-600">Active</p>
                      </div>
                      <CheckCircle className="h-8 w-8 text-green-500" />
                    </div>
                  </div>
                </div>

                {/* Recent Activity */}
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Activity</h3>
                  <div className="space-y-4">
                    {userDocuments.slice(0, 5).map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between py-3 border-b last:border-b-0">
                        <div className="flex items-center">
                          <FileText className="h-5 w-5 text-gray-400 mr-3" />
                          <div>
                            <p className="text-sm font-medium text-gray-900">{doc.fileName}</p>
                            <p className="text-xs text-gray-500">
                              {doc.uploadDate?.toDate ? doc.uploadDate.toDate().toLocaleDateString() : 'Recently uploaded'}
                            </p>
                          </div>
                        </div>
                        <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded">
                          {doc.category}
                        </span>
                      </div>
                    ))}
                    {userDocuments.length === 0 && (
                      <p className="text-center text-gray-500 py-4">No recent activity</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Documents Tab - NEW: Using ClientDocuments component */}
            {activeTab === 'documents' && (
              <div>
                <ClientDocuments 
                  clientId={user.uid} 
                  clientName={userProfile ? `${userProfile.firstName} ${userProfile.lastName}` : user.email}
                />
              </div>
            )}

            {/* My Matters */}
            {activeTab === 'matters' && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-6">My Matters</h2>
                
                <div className="grid grid-cols-1 gap-6">
                  {userMatters.map((matter) => (
                    <div key={matter.id} className="bg-white rounded-lg shadow-md p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="text-lg font-medium text-gray-900">{matter.title}</h3>
                          <p className="text-sm text-gray-500 mt-1">Matter #{matter.id}</p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          matter.status === 'Active' 
                            ? 'bg-green-100 text-green-800'
                            : matter.status === 'Pending'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {matter.status}
                        </span>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center text-sm text-gray-600">
                          <Clock className="h-4 w-4 mr-2" />
                          Opened: {matter.openDate?.toDate ? matter.openDate.toDate().toLocaleDateString() : 'N/A'}
                        </div>
                        {matter.description && (
                          <p className="text-sm text-gray-700 mt-2">{matter.description}</p>
                        )}
                      </div>
                    </div>
                  ))}
                  {userMatters.length === 0 && (
                    <div className="bg-white rounded-lg shadow-md p-12 text-center">
                      <Folder className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No Active Matters</h3>
                      <p className="text-gray-600">Your matters will appear here once they are created.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Appointments */}
            {activeTab === 'appointments' && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Appointments</h2>
                <div className="bg-white shadow rounded-lg p-6">
                  <Appointments />
                </div>
              </div>
            )}

            {/* Messages */}
            {activeTab === 'messages' && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Messages</h2>
                
                <div className="bg-white shadow rounded-lg">
                  <div className="divide-y divide-gray-200">
                    {userMessages.map((message) => (
                      <div 
                        key={message.id} 
                        className={`p-6 hover:bg-gray-50 cursor-pointer ${message.unread ? 'bg-blue-50' : ''}`}
                        onClick={() => markMessageAsRead(message.id)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center">
                              <h3 className="text-lg font-medium text-gray-900">{message.subject}</h3>
                            </div>
                            <p className="text-sm text-gray-500 mt-1">
                              {message.date?.toDate ? message.date.toDate().toLocaleDateString() : 'Recently'}
                            </p>
                            <p className="text-sm text-gray-700 mt-2">{message.message}</p>
                          </div>
                          {message.unread && (
                            <span className="ml-4 px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                              New
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                    {userMessages.length === 0 && (
                      <div className="p-6 text-center text-gray-500">
                        No messages yet
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Billing */}
            {activeTab === 'billing' && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Billing & Payments</h2>
                
                <div className="bg-white shadow rounded-lg p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Payment Options</h3>
                  <p className="text-gray-600 mb-6">Choose your preferred payment method for our services.</p>
                  
                  <StripePayment />
                </div>
              </div>
            )}

            {/* Account Settings */}
            {activeTab === 'settings' && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Account Settings</h2>
                
                {/* Profile Information */}
                <div className="bg-white shadow rounded-lg mb-6">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h3 className="text-lg font-medium text-gray-900">Profile Information</h3>
                  </div>
                  <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">First Name</label>
                        <input
                          type="text"
                          value={userProfile?.firstName || ''}
                          readOnly
                          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Last Name</label>
                        <input
                          type="text"
                          value={userProfile?.lastName || ''}
                          readOnly
                          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Email</label>
                        <input
                          type="email"
                          value={user.email}
                          readOnly
                          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Phone</label>
                        <input
                          type="tel"
                          value={userProfile?.phone || ''}
                          readOnly
                          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                        />
                      </div>
                    </div>
                    <p className="mt-4 text-sm text-gray-500">
                      To update your profile information, please contact our office.
                    </p>
                  </div>
                </div>

                {/* Change Password */}
                <div className="bg-white shadow rounded-lg">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h3 className="text-lg font-medium text-gray-900">Change Password</h3>
                  </div>
                  <div className="p-6">
                    {passwordChangeMessage && (
                      <div className="mb-4 bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded relative">
                        <CheckCircle className="h-5 w-5 inline mr-2" />
                        {passwordChangeMessage}
                      </div>
                    )}
                    
                    {passwordChangeError && (
                      <div className="mb-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded relative">
                        <AlertCircle className="h-5 w-5 inline mr-2" />
                        {passwordChangeError}
                      </div>
                    )}

                    <form onSubmit={handlePasswordChange} className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Current Password</label>
                        <div className="mt-1 relative">
                          <input
                            type={showCurrentPassword ? "text" : "password"}
                            value={passwordChangeData.currentPassword}
                            onChange={(e) => setPasswordChangeData({...passwordChangeData, currentPassword: e.target.value})}
                            required
                            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                          <button
                            type="button"
                            onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                            className="absolute inset-y-0 right-0 pr-3 flex items-center"
                          >
                            {showCurrentPassword ? 
                              <EyeOff className="h-5 w-5 text-gray-400" /> : 
                              <Eye className="h-5 w-5 text-gray-400" />
                            }
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700">New Password</label>
                        <div className="mt-1 relative">
                          <input
                            type={showNewPassword ? "text" : "password"}
                            value={passwordChangeData.newPassword}
                            onChange={(e) => setPasswordChangeData({...passwordChangeData, newPassword: e.target.value})}
                            required
                            minLength={6}
                            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                          <button
                            type="button"
                            onClick={() => setShowNewPassword(!showNewPassword)}
                            className="absolute inset-y-0 right-0 pr-3 flex items-center"
                          >
                            {showNewPassword ? 
                              <EyeOff className="h-5 w-5 text-gray-400" /> : 
                              <Eye className="h-5 w-5 text-gray-400" />
                            }
                          </button>
                        </div>
                        <p className="mt-1 text-sm text-gray-500">Must be at least 6 characters</p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700">Confirm New Password</label>
                        <input
                          type="password"
                          value={passwordChangeData.confirmPassword}
                          onChange={(e) => setPasswordChangeData({...passwordChangeData, confirmPassword: e.target.value})}
                          required
                          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>

                      <div className="pt-4">
                        <button
                          type="submit"
                          className="flex items-center px-4 py-2 bg-blue-900 text-white rounded-md hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                          <Lock className="h-4 w-4 mr-2" />
                          Update Password
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
};

export default ClientPortal;
