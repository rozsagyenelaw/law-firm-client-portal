import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, FileText, Download, Upload, MessageSquare, User, LogOut, Folder, Home, Shield, Clock, DollarSign, AlertCircle, CheckCircle, Menu, X, Calendar, CreditCard } from 'lucide-react';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
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
  serverTimestamp 
} from 'firebase/firestore';
import { 
  ref, 
  uploadBytes, 
  getDownloadURL, 
  listAll 
} from 'firebase/storage';
import { auth, db, storage } from './firebase';
import StripePayment from './components/StripePayment';

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

  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUser(user);
        // Load user data
        await loadUserData(user.uid);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // Load user data from Firestore
  const loadUserData = async (userId) => {
    try {
      // Load user's matters
      const mattersQuery = query(
        collection(db, 'matters'),
        where('clientId', '==', userId),
        orderBy('createdAt', 'desc')
      );
      const mattersSnapshot = await getDocs(mattersQuery);
      const matters = mattersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setUserMatters(matters);

      // Load user's documents
      const documentsQuery = query(
        collection(db, 'documents'),
        where('clientId', '==', userId),
        orderBy('uploadDate', 'desc')
      );
      const documentsSnapshot = await getDocs(documentsQuery);
      const documents = documentsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setUserDocuments(documents);

      // Load user's messages
      const messagesQuery = query(
        collection(db, 'messages'),
        where('clientId', '==', userId),
        orderBy('date', 'desc')
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

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');
    
    const formData = new FormData(e.target);
    const email = formData.get('email');
    const password = formData.get('password');
    const confirmPassword = formData.get('confirmPassword');
    const firstName = formData.get('firstName');
    const lastName = formData.get('lastName');
    const phone = formData.get('phone');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Create user profile in Firestore
      await setDoc(doc(db, 'users', user.uid), {
        firstName,
        lastName,
        email,
        phone,
        createdAt: serverTimestamp(),
        role: 'client'
      });

      // Create initial matter for new client
      await addDoc(collection(db, 'matters'), {
        clientId: user.uid,
        title: `Estate Planning - ${firstName} ${lastName}`,
        type: 'Estate Planning',
        status: 'Initial Consultation',
        createdAt: serverTimestamp(),
        lastUpdate: serverTimestamp()
      });

    } catch (error) {
      setError(error.message);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    
    const formData = new FormData(e.target);
    const email = formData.get('email');
    const password = formData.get('password');

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
      setSidebarOpen(false);
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !user) return;

    try {
      setUploadProgress(10);
      
      // Create a reference to the file in Firebase Storage
      const timestamp = Date.now();
      const fileName = `${timestamp}_${file.name}`;
      const storageRef = ref(storage, `documents/${user.uid}/${fileName}`);
      
      // Upload the file
      setUploadProgress(50);
      const snapshot = await uploadBytes(storageRef, file);
      
      // Get the download URL
      setUploadProgress(75);
      const downloadURL = await getDownloadURL(snapshot.ref);
      
      // Save document metadata to Firestore
      await addDoc(collection(db, 'documents'), {
        clientId: user.uid,
        name: file.name,
        fileName: fileName,
        url: downloadURL,
        size: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
        status: 'Uploaded',
        uploadDate: serverTimestamp(),
        type: file.type
      });
      
      setUploadProgress(100);
      
      // Reload documents
      await loadUserData(user.uid);
      
      // Reset progress after a delay
      setTimeout(() => setUploadProgress(0), 2000);
      
    } catch (error) {
      console.error('Error uploading file:', error);
      setError('Error uploading file');
      setUploadProgress(0);
    }
  };

  const statusColor = (status) => {
    switch (status) {
      case 'Active':
      case 'Approved':
      case 'Filed':
      case 'Uploaded':
        return 'text-green-600 bg-green-100';
      case 'In Progress':
      case 'Initial Consultation':
        return 'text-blue-600 bg-blue-100';
      case 'Review Required':
        return 'text-orange-600 bg-orange-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

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

  const LoginForm = () => (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="flex justify-center">
            <Shield className="h-12 w-12 text-blue-900" />
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            {isSignup ? 'Create Your Account' : 'Client Portal Access'}
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Law Offices of Rozsa Gyene
          </p>
          <p className="text-center text-xs text-gray-500">
            Estate Planning & Probate
          </p>
        </div>
        
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}
          
          {!isSignup ? (
            <form className="space-y-6" onSubmit={handleLogin}>
              <div>
                <label htmlFor="email-address" className="block text-sm font-medium text-gray-700">
                  Email address
                </label>
                <div className="mt-1">
                  <input
                    id="email-address"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="Email address"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Password
                </label>
                <div className="mt-1 relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    className="appearance-none block w-full px-3 py-2 pr-10 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="Password"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-gray-400" />
                    ) : (
                      <Eye className="h-4 w-4 text-gray-400" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="text-sm">
                  <a href="#" className="font-medium text-blue-600 hover:text-blue-500">
                    Forgot your password?
                  </a>
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-900 hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Sign in
                </button>
              </div>

              <div className="text-center">
                <span className="text-sm text-gray-600">Don't have an account? </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsSignup(true);
                    setError('');
                  }}
                  className="font-medium text-blue-600 hover:text-blue-500"
                >
                  Sign up
                </button>
              </div>
            </form>
          ) : (
            <form className="space-y-6" onSubmit={handleSignup}>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="firstName" className="block text-sm font-medium text-gray-700">
                    First Name
                  </label>
                  <div className="mt-1">
                    <input
                      id="firstName"
                      name="firstName"
                      type="text"
                      required
                      className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder="First Name"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="lastName" className="block text-sm font-medium text-gray-700">
                    Last Name
                  </label>
                  <div className="mt-1">
                    <input
                      id="lastName"
                      name="lastName"
                      type="text"
                      required
                      className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder="Last Name"
                    />
                  </div>
                </div>
              </div>
              
              <div>
                <label htmlFor="signup-email" className="block text-sm font-medium text-gray-700">
                  Email Address
                </label>
                <div className="mt-1">
                  <input
                    id="signup-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="Email Address"
                  />
                </div>
              </div>
              
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                  Phone Number
                </label>
                <div className="mt-1">
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    required
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="Phone Number"
                  />
                </div>
              </div>
              
              <div>
                <label htmlFor="signup-password" className="block text-sm font-medium text-gray-700">
                  Password
                </label>
                <div className="mt-1">
                  <input
                    id="signup-password"
                    name="password"
                    type="password"
                    required
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="Password (minimum 6 characters)"
                  />
                </div>
              </div>
              
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                  Confirm Password
                </label>
                <div className="mt-1">
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    required
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="Confirm Password"
                  />
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-900 hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Create Account
                </button>
              </div>

              <div className="text-center">
                <span className="text-sm text-gray-600">Already have an account? </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsSignup(false);
                    setError('');
                  }}
                  className="font-medium text-blue-600 hover:text-blue-500"
                >
                  Sign in
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );

  const Dashboard = () => (
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
              { id: 'matters', icon: Folder, label: 'My Matters' },
              { id: 'documents', icon: FileText, label: 'Documents' },
              { id: 'messages', icon: MessageSquare, label: 'Messages' },
              { id: 'appointments', icon: Calendar, label: 'Appointments' },
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
          
          <div className="absolute bottom-6 left-6 right-6">
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
      <div className="lg:ml-64 p-4 lg:p-8">
        {activeTab === 'dashboard' && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Welcome back!</h2>
            
            {/* Stats cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="bg-white p-6 rounded-lg shadow">
                <div className="flex items-center">
                  <div className="flex-shrink-0 bg-blue-100 rounded-lg p-3">
                    <Folder className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Active Matters</p>
                    <p className="text-2xl font-semibold text-gray-900">{userMatters.length}</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white p-6 rounded-lg shadow">
                <div className="flex items-center">
                  <div className="flex-shrink-0 bg-orange-100 rounded-lg p-3">
                    <FileText className="h-6 w-6 text-orange-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Documents</p>
                    <p className="text-2xl font-semibold text-gray-900">{userDocuments.length}</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white p-6 rounded-lg shadow">
                <div className="flex items-center">
                  <div className="flex-shrink-0 bg-green-100 rounded-lg p-3">
                    <MessageSquare className="h-6 w-6 text-green-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Unread Messages</p>
                    <p className="text-2xl font-semibold text-gray-900">
                      {userMessages.filter(m => m.unread).length}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white p-6 rounded-lg shadow">
                <div className="flex items-center">
                  <div className="flex-shrink-0 bg-purple-100 rounded-lg p-3">
                    <DollarSign className="h-6 w-6 text-purple-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Balance Due</p>
                    <p className="text-2xl font-semibold text-gray-900">$0</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent activity */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Recent Activity</h3>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  {userDocuments.slice(0, 3).map((doc) => (
                    <div key={doc.id} className="flex items-center">
                      <div className="flex-shrink-0">
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      </div>
                      <div className="ml-3">
                        <p className="text-sm text-gray-900">Document uploaded: {doc.name}</p>
                        <p className="text-sm text-gray-500">
                          {doc.uploadDate?.toDate ? doc.uploadDate.toDate().toLocaleDateString() : 'Recently'}
                        </p>
                      </div>
                    </div>
                  ))}
                  {userDocuments.length === 0 && (
                    <p className="text-sm text-gray-500">No recent activity</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'matters' && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">My Matters</h2>
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Matter</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Update</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {userMatters.map((matter) => (
                    <tr key={matter.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{matter.title}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{matter.type}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColor(matter.status)}`}>
                          {matter.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {matter.lastUpdate?.toDate ? matter.lastUpdate.toDate().toLocaleDateString() : 'N/A'}
                      </td>
                    </tr>
                  ))}
                  {userMatters.length === 0 && (
                    <tr>
                      <td colSpan="4" className="px-6 py-4 text-center text-sm text-gray-500">
                        No matters found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'documents' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Documents</h2>
              <label className="flex items-center px-4 py-2 bg-blue-900 text-white rounded-lg hover:bg-blue-800 transition-colors cursor-pointer">
                <Upload className="h-4 w-4 mr-2" />
                Upload Document
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                  onChange={handleFileUpload}
                />
              </label>
            </div>
            
            {uploadProgress > 0 && (
              <div className="mb-4 bg-blue-50 rounded-lg p-4">
                <div className="flex justify-between text-sm text-blue-700 mb-2">
                  <span>Uploading...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full bg-blue-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
              </div>
            )}
            
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Document</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Upload Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Size</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {userDocuments.map((doc) => (
                    <tr key={doc.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{doc.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColor(doc.status)}`}>
                          {doc.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {doc.uploadDate?.toDate ? doc.uploadDate.toDate().toLocaleDateString() : 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{doc.size}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <a 
                          href={doc.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-900"
                        >
                          <Download className="h-4 w-4" />
                        </a>
                      </td>
                    </tr>
                  ))}
                  {userDocuments.length === 0 && (
                    <tr>
                      <td colSpan="5" className="px-6 py-4 text-center text-sm text-gray-500">
                        No documents uploaded yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'messages' && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Messages</h2>
            <div className="bg-white shadow rounded-lg">
              <div className="divide-y divide-gray-200">
                {userMessages.map((message) => (
                  <div key={message.id} className={`p-6 hover:bg-gray-50 ${message.unread ? 'bg-blue-50' : ''}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center">
                          <p className="text-sm font-medium text-gray-900">{message.from}</p>
                          {message.unread && (
                            <span className="ml-2 px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">New</span>
                          )}
                        </div>
                        <p className="text-sm text-gray-900 mt-1">{message.subject}</p>
                        <p className="text-sm text-gray-500 mt-1">
                          {message.date?.toDate ? message.date.toDate().toLocaleDateString() : 'N/A'}
                        </p>
                      </div>
                      <MessageSquare className="h-5 w-5 text-gray-400" />
                    </div>
                  </div>
                ))}
                {userMessages.length === 0 && (
                  <div className="p-6 text-center text-sm text-gray-500">
                    No messages yet
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'appointments' && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Appointments</h2>
            <div className="bg-white shadow rounded-lg p-6">
              <div className="text-center">
                <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">Appointment scheduling coming soon!</p>
                <p className="text-sm text-gray-400 mt-2">
                  Please call (818) 291-6217 to schedule an appointment
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'billing' && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Billing & Payments</h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white shadow rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Make a Payment</h3>
                <StripePayment 
                  user={user}
                  onSuccess={(amount) => {
                    // Reload user data to update payment history
                    loadUserData(user.uid);
                  }}
                />
              </div>
              
              <div className="bg-white shadow rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Payment History</h3>
                <div className="space-y-3">
                  {/* This would show actual payment history from Firestore */}
                  <div className="text-center py-8">
                    <DollarSign className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No payment history yet</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'profile' && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Profile Settings</h2>
            
            <div className="bg-white shadow rounded-lg">
              <div className="p-6 space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Account Information</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Email</label>
                      <p className="mt-1 text-sm text-gray-900">{user?.email}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">User ID</label>
                      <p className="mt-1 text-sm text-gray-900">{user?.uid}</p>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Security</h3>
                  <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
                    Change Password
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Footer */}
      <div className="lg:ml-64 p-4 lg:p-8">
        <div className="mt-8 pt-8 border-t border-gray-200">
          <div className="text-center text-sm text-gray-600">
            <p className="font-medium">Law Offices of Rozsa Gyene</p>
            <p>450 N Brand Blvd. Suite 600, Glendale, CA 91203</p>
            <p>Phone: (818) 291-6217 | Email: rozsagyenelaw@yahoo.com</p>
          </div>
        </div>
      </div>
    </div>
  );

  return user ? <Dashboard /> : <LoginForm />;
};

export default ClientPortal;
