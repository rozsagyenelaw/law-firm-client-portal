
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
import DocuSign from './components/DocuSign';
import PublicBooking from './components/PublicBooking';
import ClientSignaturePage from './components/ClientSignaturePage';
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

  // Check if current path is signature page
  const isSignatureRoute = window.location.pathname.startsWith('/sign/');

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
        return dateB - dateA; // Newest first
      });
      
      setUserDocuments(sortedDocuments);

      // Load user's messages
      const messagesQuery = query(
        collection(db, 'messages'),
        where('clientId', '==', userIdForQuery)
      );
      const messagesSnapshot = await getDocs(messagesQuery);
      const messages = messagesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setUserMessages(messages);
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const handleClientUpload = async (e) => {
    e.preventDefault();
    setUploadError('');
    setUploadSuccess('');
    
    if (!selectedFile) {
      setUploadError('Please select a file to upload');
      return;
    }
    
    if (!selectedCategory) {
      setUploadError('Please select a category');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Create a unique filename
      const timestamp = new Date().getTime();
      const fileName = `${user.uid}/${selectedCategory}/${timestamp}_${selectedFile.name}`;
      const storageRef = ref(storage, `client-uploads/${fileName}`);

      // Upload file
      const uploadTask = uploadBytes(storageRef, selectedFile);
      
      // Get download URL
      const snapshot = await uploadTask;
      const downloadURL = await getDownloadURL(snapshot.ref);

      // Save document info to Firestore
      const docData = {
        name: selectedFile.name,
        category: selectedCategory,
        url: downloadURL,
        size: `${(selectedFile.size / 1024 / 1024).toFixed(2)} MB`,
        uploadDate: serverTimestamp(),
        clientId: user.uid,
        clientName: userProfile ? `${userProfile.firstName} ${userProfile.lastName}` : user.email,
        uploadedBy: 'client',
        status: 'pending_review'
      };

      await addDoc(collection(db, 'documents'), docData);

      // Try to send email notification
      try {
        const emailParams = {
          client_name: userProfile ? `${userProfile.firstName} ${userProfile.lastName}` : user.email,
          document_name: selectedFile.name,
          category: selectedCategory.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          upload_date: new Date().toLocaleDateString()
        };

        // Send notification email
        await emailjs.send(
          'service_1y5vmr2',
          'template_xcta2pl',  // Your client upload template
          emailParams
        );
      } catch (emailError) {
        console.error('Email notification failed:', emailError);
        // Don't fail the entire upload if email fails
      }

      setUploadSuccess('Document uploaded successfully!');
      setSelectedFile(null);
      setSelectedCategory('');
      
      // Reset file input
      const fileInput = document.querySelector('input[type="file"]');
      if (fileInput) fileInput.value = '';
      
      // Reload documents
      await loadUserData(user);

      // Clear success message after 5 seconds
      setTimeout(() => {
        setUploadSuccess('');
      }, 5000);

    } catch (error) {
      console.error('Upload error:', error);
      setUploadError('Failed to upload document. Please try again.');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDocumentSigned = async (signedData) => {
    // Reload documents to show updated status
    await loadUserData(user, userProfile);
    
    // Show success message
    setUploadSuccess('Document signed successfully!');
    setTimeout(() => {
      setUploadSuccess('');
    }, 5000);
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPasswordChangeError('');
    setPasswordChangeMessage('');

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

      setPasswordChangeMessage('Password changed successfully!');
      setPasswordChangeData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });

      // Clear success message after 3 seconds
      setTimeout(() => {
        setPasswordChangeMessage('');
      }, 3000);
    } catch (error) {
      if (error.code === 'auth/wrong-password') {
        setPasswordChangeError('Current password is incorrect');
      } else {
        setPasswordChangeError('Error changing password: ' + error.message);
      }
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    const formData = new FormData(e.target);
    
    try {
      await signInWithEmailAndPassword(auth, formData.get('email'), formData.get('password'));
      // Don't redirect - let the auth state change handler deal with routing
    } catch (error) {
      setError('Invalid email or password');
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');
    const formData = new FormData(e.target);
    
    if (formData.get('password') !== formData.get('confirmPassword')) {
      setError('Passwords do not match');
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth, 
        formData.get('email'), 
        formData.get('password')
      );

      // Create user profile
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        uid: userCredential.user.uid,
        email: formData.get('email'),
        firstName: formData.get('firstName'),
        lastName: formData.get('lastName'),
        phone: formData.get('phone'),
        role: 'client',
        createdAt: serverTimestamp()
      });

    } catch (error) {
      setError(error.message);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setActiveTab('dashboard');
  };

  // Check for signature route FIRST - accessible without login, bypass auth loading
  if (isSignatureRoute) {
    return <ClientSignaturePage />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Shield className="h-12 w-12 text-blue-900 animate-pulse mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // IMPORTANT: Check admin route FIRST before showing login
  if (isAdminRoute) {
    if (user && isAdmin) {
      // Show admin dashboard
      return <AdminDashboard />;
    } else if (user && !isAdmin) {
      // Non-admin trying to access admin route
      window.location.href = '/';
      return null;
    }
    // If not logged in, fall through to show login page
  }

  // Check for public booking route - accessible without login
  if (isPublicBookingRoute && !user) {
    return <PublicBooking />;
  }

  // For non-admin routes, if user is admin, they can still see client portal if they want

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <Shield className="mx-auto h-12 w-12 text-blue-900" />
            <h1 className="mt-6 text-3xl font-bold text-gray-900">
              {isAdminRoute ? 'Admin Access' : 'Client Portal Access'}
            </h1>
            <p className="mt-2 text-gray-600">Law Offices of Rozsa Gyene</p>
            <p className="text-sm text-gray-500">Estate Planning & Probate</p>
          </div>

          <div className="mt-8 bg-white py-8 px-4 shadow rounded-lg sm:px-10">
            {error && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded relative">
                {error}
              </div>
            )}

            {!isSignup ? (
              <form className="space-y-6" onSubmit={handleLogin}>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Email address
                  </label>
                  <input
                    name="email"
                    type="email"
                    required
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Email address"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Password
                  </label>
                  <div className="mt-1 relative">
                    <input
                      name="password"
                      type={showPassword ? "text" : "password"}
                      required
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    >
                      {showPassword ? 
                        <EyeOff className="h-5 w-5 text-gray-400" /> : 
                        <Eye className="h-5 w-5 text-gray-400" />
                      }
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <a href="#" className="text-sm text-blue-600 hover:text-blue-500">
                    Forgot your password?
                  </a>
                </div>

                <button
                  type="submit"
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-900 hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Sign in
                </button>

                {!isAdminRoute && (
                  <div className="text-center">
                    <span className="text-sm text-gray-600">Don't have an account? </span>
                    <button
                      type="button"
                      onClick={() => setIsSignup(true)}
                      className="text-sm text-blue-600 hover:text-blue-500"
                    >
                      Sign up
                    </button>
                  </div>
                )}
              </form>
            ) : (
              <form className="space-y-6" onSubmit={handleSignup}>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      First Name
                    </label>
                    <input
                      name="firstName"
                      type="text"
                      required
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Last Name
                    </label>
                    <input
                      name="lastName"
                      type="text"
                      required
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Email address
                  </label>
                  <input
                    name="email"
                    type="email"
                    required
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Phone
                  </label>
                  <input
                    name="phone"
                    type="tel"
                    required
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Password
                  </label>
                  <input
                    name="password"
                    type="password"
                    required
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Confirm Password
                  </label>
                  <input
                    name="confirmPassword"
                    type="password"
                    required
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-900 hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Create Account
                </button>

                <div className="text-center">
                  <span className="text-sm text-gray-600">Already have an account? </span>
                  <button
                    type="button"
                    onClick={() => setIsSignup(false)}
                    className="text-sm text-blue-600 hover:text-blue-500"
                  >
                    Sign in
                  </button>
                </div>
              </form>
            )}

            {!isAdminRoute && (
              <div className="mt-6 text-center">
                <a href="/admin" className="text-xs text-gray-500 hover:text-gray-700">
                  Admin Access
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 rounded-md bg-white shadow-md"
        >
          {sidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-40 w-64 bg-blue-900 transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 transition-transform duration-300 ease-in-out`}>
        <div className="h-full flex flex-col">
          <div className="p-6">
            <div className="flex items-center text-white mb-8">
              <Shield className="h-8 w-8 mr-3" />
              <div>
                <h1 className="text-xl font-bold">Client Portal</h1>
                <p className="text-sm text-blue-200">Rozsa Gyene Law</p>
              </div>
            </div>
            
            <nav className="space-y-2">
              {[
                { id: 'dashboard', icon: Home, label: 'Dashboard' },
                { id: 'documents', icon: FileText, label: 'Documents' },
                { id: 'docusign', icon: Edit3, label: 'E-Signatures' },
                { id: 'appointments', icon: Calendar, label: 'Appointments' },
                { id: 'messages', icon: MessageSquare, label: 'Messages' },
                { id: 'billing', icon: DollarSign, label: 'Billing' },
                { id: 'settings', icon: Settings, label: 'Account Settings' },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                    activeTab === item.id
                      ? 'bg-blue-800 text-white'
                      : 'text-blue-100 hover:bg-blue-800 hover:text-white'
                  }`}
                >
                  <item.icon className="h-5 w-5 mr-3" />
                  {item.label}
                </button>
              ))}
            </nav>
          </div>
          
          <div className="mt-auto p-6">
            <div className="text-blue-200 text-sm mb-4">
              {userProfile ? `${userProfile.firstName} ${userProfile.lastName}` : user.email}
            </div>
            {isAdmin && !isAdminRoute && (
              <button
                onClick={() => window.location.href = '/admin'}
                className="w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg text-blue-100 hover:bg-blue-800 hover:text-white transition-colors mb-2"
              >
                <Shield className="h-5 w-5 mr-3" />
                Admin Dashboard
              </button>
            )}
            <button
              onClick={handleLogout}
              className="w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg text-blue-100 hover:bg-blue-800 hover:text-white transition-colors"
            >
              <LogOut className="h-5 w-5 mr-3" />
              Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:ml-64">
        <div className="p-4 sm:p-6 lg:p-8">
          {/* Dashboard */}
          {activeTab === 'dashboard' && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Welcome Back!</h2>
              
              {/* Quick Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white p-6 rounded-lg shadow">
                  <div className="flex items-center">
                    <Folder className="h-10 w-10 text-blue-600 mr-4" />
                    <div>
                      <p className="text-sm text-gray-600">Active Matters</p>
                      <p className="text-2xl font-semibold">{userMatters.filter(m => m.status === 'Active').length}</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white p-6 rounded-lg shadow">
                  <div className="flex items-center">
                    <FileText className="h-10 w-10 text-green-600 mr-4" />
                    <div>
                      <p className="text-sm text-gray-600">Documents</p>
                      <p className="text-2xl font-semibold">{userDocuments.length}</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white p-6 rounded-lg shadow">
                  <div className="flex items-center">
                    <MessageSquare className="h-10 w-10 text-purple-600 mr-4" />
                    <div>
                      <p className="text-sm text-gray-600">Unread Messages</p>
                      <p className="text-2xl font-semibold">{userMessages.filter(m => m.unread).length}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent Matters */}
              <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Your Matters</h3>
                </div>
                <div className="p-6">
                  <div className="space-y-4">
                    {userMatters.map((matter) => (
                      <div key={matter.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div>
                          <h4 className="text-sm font-medium text-gray-900">{matter.title}</h4>
                          <p className="text-sm text-gray-500">{matter.type}</p>
                        </div>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          matter.status === 'Active' ? 'bg-green-100 text-green-800' :
                          matter.status === 'In Progress' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {matter.status}
                        </span>
                      </div>
                    ))}
                    {userMatters.length === 0 && (
                      <p className="text-sm text-gray-500 text-center">No active matters</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Documents */}
          {activeTab === 'documents' && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Your Documents</h2>
              
              {/* Upload Section */}
              <div className="bg-white shadow rounded-lg mb-6">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Upload Documents</h3>
                </div>
                <div className="p-6">
                  {uploadSuccess && (
                    <div className="mb-4 bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded relative">
                      <CheckCircle className="h-5 w-5 inline mr-2" />
                      {uploadSuccess}
                    </div>
                  )}
                  
                  {uploadError && (
                    <div className="mb-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded relative">
                      <AlertCircle className="h-5 w-5 inline mr-2" />
                      {uploadError}
                    </div>
                  )}

                  <form onSubmit={handleClientUpload} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Select Category
                      </label>
                      <select
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        required
                      >
                        <option value="">Choose a category...</option>
                        <option value="existing_documents">Existing Documents</option>
                        <option value="completed_documents">Completed Documents</option>
                        <option value="supporting_documents">Supporting Documents</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Select File
                      </label>
                      <input
                        type="file"
                        onChange={(e) => setSelectedFile(e.target.files[0])}
                        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                        required
                      />
                      <p className="mt-1 text-sm text-gray-500">
                        Maximum file size: 10MB. Supported formats: PDF, DOC, DOCX, JPG, PNG
                      </p>
                    </div>

                    <button
                      type="submit"
                      disabled={isUploading}
                      className="flex items-center px-4 py-2 bg-blue-900 text-white rounded-md hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {isUploading ? 'Uploading...' : 'Upload Document'}
                    </button>
                  </form>
                </div>
              </div>

              {/* Documents List */}
              <div className="bg-white shadow rounded-lg">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Document Library</h3>
                </div>
                <div className="p-6">
                  <div className="space-y-4">
                    {userDocuments.map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                        <div className="flex items-center">
                          <FileText className="h-8 w-8 text-gray-400 mr-4" />
                          <div>
                            <h4 className="text-sm font-medium text-gray-900">{doc.name}</h4>
                            <p className="text-sm text-gray-500">
                              {doc.category && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 mr-2">
                                  {doc.category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                </span>
                              )}
                              Uploaded {doc.uploadDate?.toDate ? doc.uploadDate.toDate().toLocaleDateString() : 'Recently'}
                              {doc.signed && (
                                <span className="ml-2 text-green-600">
                                  • Signed on {doc.signedAt?.toDate ? doc.signedAt.toDate().toLocaleDateString() : 'Recently'}
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-4">
                          <span className="text-sm text-gray-500">{doc.size}</span>
                          {/* Use DocumentSigning component directly for unsigned documents */}
                          {!doc.signed && (
                            <DocumentSigning
                              document={doc}
                              user={user}
                              userProfile={userProfile}
                              onSigned={handleDocumentSigned}
                            />
                          )}
                          <a 
                            href={doc.signedDocumentUrl || doc.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800"
                            title={doc.signed ? "Download Signed Document" : "Download Document"}
                          >
                            <Download className="h-5 w-5" />
                          </a>
                          {doc.signed && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Signed
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                    {userDocuments.length === 0 && (
                      <p className="text-center text-gray-500">No documents uploaded yet</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* DocuSign Tab */}
          {activeTab === 'docusign' && (
            <DocuSign user={user} />
          )}

          {/* Appointments */}
          {activeTab === 'appointments' && (
            <Appointments userProfile={userProfile} />
          )}

          {/* Messages */}
          {activeTab === 'messages' && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Messages</h2>
              
              <div className="bg-white shadow rounded-lg">
                <div className="divide-y divide-gray-200">
                  {userMessages.map((message) => (
                    <div key={message.id} className={`p-6 ${message.unread ? 'bg-blue-50' : ''}`}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-medium text-gray-900">{message.subject}</h4>
                            <span className="text-sm text-gray-500">
                              {message.date?.toDate ? message.date.toDate().toLocaleDateString() : 'Recently'}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">From: {message.from}</p>
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
        </div>
      </div>
    </div>
  );
};

export default ClientPortal;
