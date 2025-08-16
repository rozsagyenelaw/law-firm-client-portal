import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, FileText, Download, Upload, MessageSquare, User, LogOut, Folder, Home, Shield, Clock, DollarSign, AlertCircle, CheckCircle, Menu, X, Calendar, CreditCard } from 'lucide-react';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  sendPasswordResetEmail 
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
  const [success, setSuccess] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [userDocuments, setUserDocuments] = useState([]);
  const [userMatters, setUserMatters] = useState([]);
  const [userMessages, setUserMessages] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [forgotPassword, setForgotPassword] = useState(false);
  
  // Client upload states
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadCategory, setUploadCategory] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploading, setUploading] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    phone: '',
    address: ''
  });

  // Stats for dashboard
  const [stats, setStats] = useState({
    documentsCount: 0,
    mattersCount: 0,
    messagesCount: 0,
    lastActivity: null
  });

  // Admin emails that have access to admin dashboard
  const ADMIN_EMAILS = ['rozsagyenelaw@yahoo.com'];

  // Check if current path is /admin
  const isAdminRoute = window.location.pathname === '/admin';

  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUser(user);
        setIsAdmin(ADMIN_EMAILS.includes(user.email));
        
        // Load user data
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setFormData(prevData => ({
            ...prevData,
            firstName: userData.firstName || '',
            lastName: userData.lastName || '',
            phone: userData.phone || '',
            address: userData.address || ''
          }));
        }
        
        // Only load client data if not admin route
        if (!isAdminRoute) {
          await loadUserData(user.uid);
        }
      } else {
        setUser(null);
        setIsAdmin(false);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, [isAdminRoute]);

  // Load user data
  const loadUserData = async (userId) => {
    try {
      // Load documents
      const docsQuery = query(
        collection(db, 'documents'),
        where('clientId', '==', userId),
        orderBy('uploadDate', 'desc')
      );
      const docsSnapshot = await getDocs(docsQuery);
      const docs = docsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        uploadDate: doc.data().uploadDate?.toDate()
      }));
      setUserDocuments(docs);

      // Load matters
      const mattersQuery = query(
        collection(db, 'matters'),
        where('clientId', '==', userId)
      );
      const mattersSnapshot = await getDocs(mattersQuery);
      const matters = mattersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setUserMatters(matters);

      // Load messages
      const messagesQuery = query(
        collection(db, 'messages'),
        where('clientId', '==', userId),
        orderBy('date', 'desc')
      );
      const messagesSnapshot = await getDocs(messagesQuery);
      const messages = messagesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date?.toDate()
      }));
      setUserMessages(messages);

      // Update stats
      setStats({
        documentsCount: docs.length,
        mattersCount: matters.length,
        messagesCount: messages.length,
        lastActivity: new Date()
      });

      // Mark messages as read
      messages.forEach(async (message) => {
        if (message.unread) {
          await updateDoc(doc(db, 'messages', message.id), {
            unread: false
          });
        }
      });
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  // Handle signup
  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');
    
    try {
      // For existing temp users created by admin
      const tempUserQuery = query(
        collection(db, 'users'),
        where('email', '==', formData.email),
        where('needsAuthSetup', '==', true)
      );
      const tempUserSnapshot = await getDocs(tempUserQuery);
      
      if (!tempUserSnapshot.empty) {
        // User was pre-created by admin
        const tempUserDoc = tempUserSnapshot.docs[0];
        const tempUserData = tempUserDoc.data();
        
        // Verify the temp password
        if (tempUserData.tempPassword !== formData.password) {
          setError('Invalid credentials. Please check with your attorney.');
          return;
        }
        
        // Create Firebase Auth account
        const userCredential = await createUserWithEmailAndPassword(
          auth,
          formData.email,
          formData.password
        );
        
        // Update the user document with the new UID and remove temp fields
        await setDoc(doc(db, 'users', userCredential.user.uid), {
          ...tempUserData,
          uid: userCredential.user.uid,
          firstName: formData.firstName || tempUserData.firstName,
          lastName: formData.lastName || tempUserData.lastName,
          phone: formData.phone || tempUserData.phone,
          address: formData.address || tempUserData.address,
          needsAuthSetup: false,
          tempPassword: null,
          updatedAt: serverTimestamp()
        });
        
        // Delete the temp user document
        await deleteDoc(doc(db, 'users', tempUserDoc.id));
      } else {
        // New user signup
        const userCredential = await createUserWithEmailAndPassword(
          auth,
          formData.email,
          formData.password
        );
        
        // Create user profile
        await setDoc(doc(db, 'users', userCredential.user.uid), {
          uid: userCredential.user.uid,
          email: formData.email,
          firstName: formData.firstName,
          lastName: formData.lastName,
          phone: formData.phone,
          address: formData.address,
          role: 'client',
          createdAt: serverTimestamp()
        });
      }
      
      setSuccess('Account created successfully!');
    } catch (error) {
      if (error.code === 'auth/email-already-in-use') {
        setError('An account with this email already exists. Please sign in.');
      } else {
        setError(error.message);
      }
    }
  };

  // Handle login
  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    
    try {
      await signInWithEmailAndPassword(auth, formData.email, formData.password);
    } catch (error) {
      setError('Invalid email or password');
    }
  };

  // Handle password reset
  const handlePasswordReset = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    try {
      await sendPasswordResetEmail(auth, formData.email);
      setSuccess('Password reset email sent! Check your inbox.');
      setForgotPassword(false);
    } catch (error) {
      setError('Error sending password reset email. Please check your email address.');
    }
  };

  // Handle client document upload
  const handleClientUpload = async (e) => {
    e.preventDefault();
    
    if (!uploadFile || !uploadCategory) {
      setError('Please select a file and category');
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      // Get user data
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const userData = userDoc.data();
      const clientName = `${userData.firstName} ${userData.lastName}`;

      // Upload file to Firebase Storage
      const timestamp = new Date().getTime();
      const fileName = `${user.uid}/${uploadCategory}/${timestamp}_${uploadFile.name}`;
      const storageRef = ref(storage, `documents/${fileName}`);
      
      setUploadProgress(30);
      const snapshot = await uploadBytes(storageRef, uploadFile);
      
      setUploadProgress(60);
      const downloadURL = await getDownloadURL(snapshot.ref);
      
      setUploadProgress(80);

      // Save document info to Firestore
      await addDoc(collection(db, 'documents'), {
        name: uploadFile.name,
        category: uploadCategory,
        description: uploadDescription,
        url: downloadURL,
        size: `${(uploadFile.size / 1024 / 1024).toFixed(2)} MB`,
        uploadDate: serverTimestamp(),
        clientId: user.uid,
        clientName: clientName,
        uploadedBy: user.email,
        uploadedByClient: true
      });

      // Send email notification to attorney
      const emailParams = {
        client_name: clientName,
        document_name: uploadFile.name,
        category: uploadCategory,
        upload_date: new Date().toLocaleDateString()
      };

      await emailjs.send(
        'service_0ak47yn',
        'template_xcta2pl',
        emailParams
      );

      setUploadProgress(100);
      
      // Reset form
      setUploadFile(null);
      setUploadCategory('');
      setUploadDescription('');
      setShowUploadModal(false);
      setUploadProgress(0);
      
      // Reload documents
      await loadUserData(user.uid);
      
      setSuccess('Document uploaded successfully!');
      setUploading(false);
    } catch (error) {
      console.error('Error uploading document:', error);
      setError('Failed to upload document. Please try again.');
      setUploading(false);
      setUploadProgress(0);
    }
  };

  // If loading, show loading screen
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

  // If admin route and user is admin, show admin dashboard
  if (isAdminRoute && user && isAdmin) {
    return <AdminDashboard />;
  }

  // If admin route but user is not admin, show access denied
  if (isAdminRoute && user && !isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Shield className="h-12 w-12 text-red-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-600 mb-4">You don't have permission to access this page.</p>
          <button
            onClick={() => window.location.href = '/'}
            className="px-4 py-2 bg-blue-900 text-white rounded-md hover:bg-blue-800"
          >
            Return to Client Portal
          </button>
        </div>
      </div>
    );
  }

  // If not logged in, show login/signup form
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-8">
          <div className="text-center mb-8">
            <Shield className="h-12 w-12 text-blue-900 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900">Law Offices of Rozsa Gyene</h1>
            <p className="text-gray-600 mt-2">Secure Client Portal</p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded">
              {success}
            </div>
          )}

          {forgotPassword ? (
            <form onSubmit={handlePasswordReset} className="space-y-4">
              <h2 className="text-xl font-semibold mb-4">Reset Password</h2>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <button
                type="submit"
                className="w-full bg-blue-900 text-white py-2 px-4 rounded-md hover:bg-blue-800 transition duration-200"
              >
                Send Reset Email
              </button>
              <button
                type="button"
                onClick={() => setForgotPassword(false)}
                className="w-full text-blue-900 hover:underline"
              >
                Back to Login
              </button>
            </form>
          ) : (
            <form onSubmit={isSignup ? handleSignup : handleLogin} className="space-y-4">
              <h2 className="text-xl font-semibold mb-4">
                {isSignup ? 'Create Account' : 'Sign In'}
              </h2>

              {isSignup && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        First Name
                      </label>
                      <input
                        type="text"
                        value={formData.firstName}
                        onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Last Name
                      </label>
                      <input
                        type="text"
                        value={formData.lastName}
                        onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Address
                    </label>
                    <input
                      type="text"
                      value={formData.address}
                      onChange={(e) => setFormData({...formData, address: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-blue-900 text-white py-2 px-4 rounded-md hover:bg-blue-800 transition duration-200"
              >
                {isSignup ? 'Create Account' : 'Sign In'}
              </button>

              {!isSignup && (
                <button
                  type="button"
                  onClick={() => setForgotPassword(true)}
                  className="w-full text-blue-900 hover:underline text-sm"
                >
                  Forgot Password?
                </button>
              )}

              <div className="text-center text-sm">
                {isSignup ? (
                  <>
                    Already have an account?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setIsSignup(false);
                        setError('');
                        setSuccess('');
                      }}
                      className="text-blue-900 hover:underline"
                    >
                      Sign In
                    </button>
                  </>
                ) : (
                  <>
                    Don't have an account?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setIsSignup(true);
                        setError('');
                        setSuccess('');
                      }}
                      className="text-blue-900 hover:underline"
                    >
                      Sign Up
                    </button>
                  </>
                )}
              </div>
            </form>
          )}

          {isAdmin && !isAdminRoute && (
            <div className="mt-4 text-center">
              <a
                href="/admin"
                className="text-blue-900 hover:underline text-sm"
              >
                Access Admin Dashboard →
              </a>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Main client portal
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Success/Error Messages */}
      {success && (
        <div className="fixed top-4 right-4 z-50 p-4 bg-green-100 border border-green-400 text-green-700 rounded-md shadow-lg">
          <div className="flex items-center">
            <CheckCircle className="h-5 w-5 mr-2" />
            {success}
          </div>
        </div>
      )}

      {error && (
        <div className="fixed top-4 right-4 z-50 p-4 bg-red-100 border border-red-400 text-red-700 rounded-md shadow-lg">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 mr-2" />
            {error}
          </div>
        </div>
      )}

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
                <p className="text-sm text-blue-200">Law Offices of Rozsa Gyene</p>
              </div>
            </div>
            
            <nav className="space-y-2">
              {[
                { id: 'dashboard', icon: Home, label: 'Dashboard' },
                { id: 'documents', icon: FileText, label: 'Documents' },
                { id: 'matters', icon: Folder, label: 'Matters' },
                { id: 'messages', icon: MessageSquare, label: 'Messages' },
                { id: 'billing', icon: CreditCard, label: 'Billing' },
                { id: 'profile', icon: User, label: 'Profile' },
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
              {user?.email}
            </div>
            <button
              onClick={() => signOut(auth)}
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
          {/* Dashboard Tab */}
          {activeTab === 'dashboard' && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Welcome, {formData.firstName}!</h2>
              
              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div className="bg-white p-6 rounded-lg shadow">
                  <div className="flex items-center">
                    <FileText className="h-10 w-10 text-blue-600 mr-4" />
                    <div>
                      <p className="text-sm text-gray-600">Documents</p>
                      <p className="text-2xl font-semibold">{stats.documentsCount}</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white p-6 rounded-lg shadow">
                  <div className="flex items-center">
                    <Folder className="h-10 w-10 text-green-600 mr-4" />
                    <div>
                      <p className="text-sm text-gray-600">Active Matters</p>
                      <p className="text-2xl font-semibold">{stats.mattersCount}</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white p-6 rounded-lg shadow">
                  <div className="flex items-center">
                    <MessageSquare className="h-10 w-10 text-purple-600 mr-4" />
                    <div>
                      <p className="text-sm text-gray-600">Messages</p>
                      <p className="text-2xl font-semibold">{stats.messagesCount}</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white p-6 rounded-lg shadow">
                  <div className="flex items-center">
                    <Clock className="h-10 w-10 text-orange-600 mr-4" />
                    <div>
                      <p className="text-sm text-gray-600">Last Activity</p>
                      <p className="text-sm font-semibold">
                        {stats.lastActivity ? stats.lastActivity.toLocaleDateString() : 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent Activity */}
              <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Recent Activity</h3>
                </div>
                <div className="p-6">
                  {userDocuments.length === 0 && userMessages.length === 0 ? (
                    <p className="text-gray-500">No recent activity</p>
                  ) : (
                    <div className="space-y-4">
                      {userDocuments.slice(0, 3).map((doc) => (
                        <div key={doc.id} className="flex items-center justify-between">
                          <div className="flex items-center">
                            <FileText className="h-5 w-5 text-gray-400 mr-3" />
                            <div>
                              <p className="text-sm font-medium text-gray-900">{doc.name}</p>
                              <p className="text-sm text-gray-500">
                                Uploaded on {doc.uploadDate?.toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                      {userMessages.slice(0, 3).map((message) => (
                        <div key={message.id} className="flex items-center justify-between">
                          <div className="flex items-center">
                            <MessageSquare className="h-5 w-5 text-gray-400 mr-3" />
                            <div>
                              <p className="text-sm font-medium text-gray-900">{message.subject}</p>
                              <p className="text-sm text-gray-500">
                                Received on {message.date?.toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Documents Tab */}
          {activeTab === 'documents' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">My Documents</h2>
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="flex items-center px-4 py-2 bg-blue-900 text-white rounded-md hover:bg-blue-800"
                >
                  <Upload className="h-5 w-5 mr-2" />
                  Upload Document
                </button>
              </div>

              <div className="bg-white shadow rounded-lg">
                <div className="p-6">
                  {userDocuments.length === 0 ? (
                    <div className="text-center py-12">
                      <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500">No documents uploaded yet</p>
                      <button
                        onClick={() => setShowUploadModal(true)}
                        className="mt-4 text-blue-900 hover:underline"
                      >
                        Upload your first document
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {userDocuments.map((doc) => (
                        <div key={doc.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                          <div className="flex items-center">
                            <FileText className="h-8 w-8 text-gray-400 mr-4" />
                            <div>
                              <h4 className="text-sm font-medium text-gray-900">{doc.name}</h4>
                              <p className="text-sm text-gray-500">
                                {doc.category} • {doc.size} • Uploaded {doc.uploadDate?.toLocaleDateString()}
                              </p>
                              {doc.description && (
                                <p className="text-sm text-gray-600 mt-1">{doc.description}</p>
                              )}
                            </div>
                          </div>
                          <a 
                            href={doc.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800"
                          >
                            <Download className="h-5 w-5" />
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Matters Tab */}
          {activeTab === 'matters' && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">My Matters</h2>

              <div className="grid gap-6">
                {userMatters.length === 0 ? (
                  <div className="bg-white rounded-lg shadow p-12 text-center">
                    <Folder className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No active matters</p>
                  </div>
                ) : (
                  userMatters.map((matter) => (
                    <div key={matter.id} className="bg-white rounded-lg shadow p-6">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="text-lg font-medium text-gray-900">{matter.title}</h3>
                          <p className="text-sm text-gray-600 mt-1">{matter.type}</p>
                          <p className="text-sm text-gray-500 mt-2">{matter.description}</p>
                        </div>
                        <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                          matter.status === 'Active' ? 'bg-green-100 text-green-800' :
                          matter.status === 'In Progress' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {matter.status}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Messages Tab */}
          {activeTab === 'messages' && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Messages</h2>

              <div className="bg-white shadow rounded-lg">
                <div className="divide-y divide-gray-200">
                  {userMessages.length === 0 ? (
                    <div className="p-12 text-center">
                      <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500">No messages yet</p>
                    </div>
                  ) : (
                    userMessages.map((message) => (
                      <div key={message.id} className="p-6">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <h4 className="text-sm font-medium text-gray-900">{message.subject}</h4>
                              <span className="text-sm text-gray-500">
                                {message.date?.toLocaleDateString()}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600 mt-1">From: {message.from}</p>
                            <p className="text-sm text-gray-700 mt-2">{message.message}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Billing Tab */}
          {activeTab === 'billing' && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Billing & Payments</h2>

              <div className="grid gap-6">
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Make a Payment</h3>
                  <StripePayment clientId={user.uid} clientName={`${formData.firstName} ${formData.lastName}`} />
                </div>
              </div>
            </div>
          )}

          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">My Profile</h2>

              <div className="bg-white shadow rounded-lg p-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Name</label>
                    <p className="mt-1 text-sm text-gray-900">{formData.firstName} {formData.lastName}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Email</label>
                    <p className="mt-1 text-sm text-gray-900">{user.email}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Phone</label>
                    <p className="mt-1 text-sm text-gray-900">{formData.phone || 'Not provided'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Address</label>
                    <p className="mt-1 text-sm text-gray-900">{formData.address || 'Not provided'}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Upload Document Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6 m-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">Upload Document</h3>
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  setUploadFile(null);
                  setUploadCategory('');
                  setUploadDescription('');
                }}
                className="text-gray-400 hover:text-gray-500"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleClientUpload} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Category</label>
                <select
                  value={uploadCategory}
                  onChange={(e) => setUploadCategory(e.target.value)}
                  required
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select a category...</option>
                  <option value="Existing Documents">Existing Documents (Old Trust, Will, etc.)</option>
                  <option value="Financial Documents">Financial Documents</option>
                  <option value="Property Documents">Property Documents</option>
                  <option value="Personal Documents">Personal Documents</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Description (Optional)</label>
                <textarea
                  value={uploadDescription}
                  onChange={(e) => setUploadDescription(e.target.value)}
                  placeholder="e.g., 2015 Living Trust created by previous attorney"
                  rows={3}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">File</label>
                <input
                  type="file"
                  onChange={(e) => setUploadFile(e.target.files[0])}
                  required
                  className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Accepted formats: PDF, DOC, DOCX, JPG, PNG (Max 10MB)
                </p>
              </div>

              {uploadProgress > 0 && (
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div 
                    className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" 
                    style={{width: `${uploadProgress}%`}}
                  ></div>
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowUploadModal(false);
                    setUploadFile(null);
                    setUploadCategory('');
                    setUploadDescription('');
                  }}
                  disabled={uploading}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="px-4 py-2 bg-blue-900 text-white rounded-md hover:bg-blue-800 disabled:opacity-50"
                >
                  {uploading ? 'Uploading...' : 'Upload'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientPortal;
