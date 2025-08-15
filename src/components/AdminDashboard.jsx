import React, { useState, useEffect } from 'react';
import { 
  Users, FileText, MessageSquare, Upload, Search, 
  Plus, Edit, Trash2, Send, Calendar, DollarSign,
  Home, LogOut, Settings, Eye, Download, Shield,
  CheckCircle, AlertCircle, Clock, Menu, X
} from 'lucide-react';
import { 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  getAuth
} from 'firebase/auth';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  orderBy,
  getDoc
} from 'firebase/firestore';
import { 
  ref, 
  uploadBytes, 
  getDownloadURL 
} from 'firebase/storage';
import { auth, db, storage } from '../firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { initializeApp } from 'firebase/app';

const AdminDashboard = () => {
  const [adminUser, setAdminUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Data states
  const [clients, setClients] = useState([]);
  const [matters, setMatters] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [messages, setMessages] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  
  // Form states
  const [showNewClientForm, setShowNewClientForm] = useState(false);
  const [showMessageForm, setShowMessageForm] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showClientDetails, setShowClientDetails] = useState(false);
  const [editingClient, setEditingClient] = useState(null);

  // Admin emails that are allowed to access the dashboard
  const ADMIN_EMAILS = ['rozsagyenelaw@yahoo.com']; // Add your admin emails here

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user && ADMIN_EMAILS.includes(user.email)) {
        setAdminUser(user);
        await loadAllData();
      } else {
        setAdminUser(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const loadAllData = async () => {
    try {
      // Load all clients
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const clientsData = usersSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(user => user.role === 'client');
      setClients(clientsData);

      // Load all matters
      const mattersSnapshot = await getDocs(
        query(collection(db, 'matters'), orderBy('createdAt', 'desc'))
      );
      const mattersData = mattersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setMatters(mattersData);

      // Load all documents
      const documentsSnapshot = await getDocs(
        query(collection(db, 'documents'), orderBy('uploadDate', 'desc'))
      );
      const documentsData = documentsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setDocuments(documentsData);

      // Load all messages
      const messagesSnapshot = await getDocs(
        query(collection(db, 'messages'), orderBy('date', 'desc'))
      );
      const messagesData = messagesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setMessages(messagesData);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const email = formData.get('email');
    const password = formData.get('password');

    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      alert('Invalid credentials');
    }
  };

  const handleCreateClient = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    
    try {
      // Generate a random password if you want to auto-generate it
      const tempPassword = formData.get('password');
      
      // Create a temporary unique ID for the client
      const tempClientId = 'client_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

      // Create user profile first (without auth)
      const userDocRef = await addDoc(collection(db, 'users'), {
        tempId: tempClientId,
        firstName: formData.get('firstName'),
        lastName: formData.get('lastName'),
        email: formData.get('email'),
        phone: formData.get('phone'),
        address: formData.get('address'),
        role: 'client',
        tempPassword: tempPassword, // Store temporarily - remove this in production
        needsAccountSetup: true,
        createdAt: serverTimestamp(),
        createdBy: adminUser.uid
      });

      // Create initial matter
      await addDoc(collection(db, 'matters'), {
        clientId: tempClientId,
        title: formData.get('matterTitle') || `Estate Planning - ${formData.get('firstName')} ${formData.get('lastName')}`,
        type: formData.get('matterType') || 'Estate Planning',
        status: 'Active',
        createdAt: serverTimestamp(),
        lastUpdate: serverTimestamp()
      });

      alert(`Client created successfully!\n\nPlease send the client their login credentials:\nEmail: ${formData.get('email')}\nPassword: ${tempPassword}\n\nThey will need to complete their account setup on first login.`);
      
      setShowNewClientForm(false);
      e.target.reset();
      await loadAllData();
      
    } catch (error) {
      alert('Error creating client: ' + error.message);
    }
  };

  const handleUploadDocument = async (e, clientId) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setUploadProgress(10);
      
      const timestamp = Date.now();
      const fileName = `${timestamp}_${file.name}`;
      const storageRef = ref(storage, `documents/${clientId}/${fileName}`);
      
      setUploadProgress(50);
      const snapshot = await uploadBytes(storageRef, file);
      
      setUploadProgress(75);
      const downloadURL = await getDownloadURL(snapshot.ref);
      
      await addDoc(collection(db, 'documents'), {
        clientId: clientId,
        name: file.name,
        fileName: fileName,
        url: downloadURL,
        size: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
        status: 'Uploaded',
        uploadDate: serverTimestamp(),
        uploadedBy: adminUser.uid,
        type: file.type
      });
      
      setUploadProgress(100);
      await loadAllData();
      
      setTimeout(() => setUploadProgress(0), 2000);
    } catch (error) {
      console.error('Error uploading file:', error);
      setUploadProgress(0);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    
    try {
      await addDoc(collection(db, 'messages'), {
        clientId: formData.get('clientId'),
        subject: formData.get('subject'),
        message: formData.get('message'),
        from: 'Law Office',
        to: formData.get('clientName'),
        date: serverTimestamp(),
        unread: true,
        sentBy: adminUser.uid
      });

      alert('Message sent successfully!');
      setShowMessageForm(false);
      e.target.reset();
      await loadAllData();
    } catch (error) {
      alert('Error sending message: ' + error.message);
    }
  };

  const getClientName = (clientId) => {
    const client = clients.find(c => c.id === clientId || c.uid === clientId);
    return client ? `${client.firstName} ${client.lastName}` : 'Unknown Client';
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Active':
      case 'Uploaded':
        return 'text-green-600 bg-green-100';
      case 'In Progress':
        return 'text-blue-600 bg-blue-100';
      case 'Review Required':
        return 'text-orange-600 bg-orange-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  // Add this CSS for proper input styling
  const inputClassName = "mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm";
  const textareaClassName = "mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm";
  const selectClassName = "mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm";

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Shield className="h-12 w-12 text-blue-900 animate-pulse mx-auto mb-4" />
          <p className="text-gray-600">Loading Admin Dashboard...</p>
        </div>
      </div>
    );
  }

  if (!adminUser) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
        <div className="max-w-md w-full space-y-8">
          <div>
            <Shield className="mx-auto h-12 w-12 text-blue-900" />
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
              Admin Access
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              Law Offices of Rozsa Gyene
            </p>
          </div>
          <form className="mt-8 space-y-6" onSubmit={handleAdminLogin}>
            <div className="rounded-md shadow-sm -space-y-px">
              <div>
                <input
                  name="email"
                  type="email"
                  required
                  className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                  placeholder="Admin email"
                />
              </div>
              <div>
                <input
                  name="password"
                  type="password"
                  required
                  className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                  placeholder="Password"
                />
              </div>
            </div>
            <div>
              <button
                type="submit"
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-900 hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Sign in
              </button>
            </div>
          </form>
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
        <div className="p-6">
          <div className="flex items-center text-white mb-8">
            <Shield className="h-8 w-8 mr-3" />
            <div>
              <h1 className="text-xl font-bold">Admin Dashboard</h1>
              <p className="text-sm text-blue-200">Law Offices</p>
            </div>
          </div>
          
          <nav className="space-y-2">
            {[
              { id: 'overview', icon: Home, label: 'Overview' },
              { id: 'clients', icon: Users, label: 'Clients' },
              { id: 'matters', icon: FileText, label: 'Matters' },
              { id: 'documents', icon: FileText, label: 'Documents' },
              { id: 'messages', icon: MessageSquare, label: 'Messages' },
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
            <div className="text-blue-200 text-sm mb-4">
              {adminUser.email}
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
      <div className="lg:ml-64 p-4 lg:p-8">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Dashboard Overview</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="bg-white p-6 rounded-lg shadow">
                <div className="flex items-center">
                  <Users className="h-10 w-10 text-blue-600 mr-4" />
                  <div>
                    <p className="text-sm text-gray-600">Total Clients</p>
                    <p className="text-2xl font-semibold">{clients.length}</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white p-6 rounded-lg shadow">
                <div className="flex items-center">
                  <FileText className="h-10 w-10 text-green-600 mr-4" />
                  <div>
                    <p className="text-sm text-gray-600">Active Matters</p>
                    <p className="text-2xl font-semibold">
                      {matters.filter(m => m.status === 'Active').length}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white p-6 rounded-lg shadow">
                <div className="flex items-center">
                  <FileText className="h-10 w-10 text-purple-600 mr-4" />
                  <div>
                    <p className="text-sm text-gray-600">Total Documents</p>
                    <p className="text-2xl font-semibold">{documents.length}</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white p-6 rounded-lg shadow">
                <div className="flex items-center">
                  <MessageSquare className="h-10 w-10 text-orange-600 mr-4" />
                  <div>
                    <p className="text-sm text-gray-600">Unread Messages</p>
                    <p className="text-2xl font-semibold">
                      {messages.filter(m => m.unread).length}
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
                <div className="space-y-4">
                  {documents.slice(0, 5).map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between">
                      <div className="flex items-center">
                        <FileText className="h-5 w-5 text-gray-400 mr-3" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">{doc.name}</p>
                          <p className="text-sm text-gray-500">
                            Uploaded for {getClientName(doc.clientId)}
                          </p>
                        </div>
                      </div>
                      <span className="text-sm text-gray-500">
                        {doc.uploadDate?.toDate ? doc.uploadDate.toDate().toLocaleDateString() : 'Recently'}
                      </span>
                    </div>
                  ))}
                  {documents.length === 0 && (
                    <p className="text-sm text-gray-500">No recent activity</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Clients Tab */}
        {activeTab === 'clients' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Clients</h2>
              <button
                onClick={() => setShowNewClientForm(true)}
                className="flex items-center px-4 py-2 bg-blue-900 text-white rounded-lg hover:bg-blue-800"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Client
              </button>
            </div>

            {/* Client Details Modal */}
            {showClientDetails && selectedClient && (
              <div className="bg-white rounded-lg shadow mb-6 p-6">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-lg font-medium text-gray-900">Client Details</h3>
                  <button
                    onClick={() => {
                      setShowClientDetails(false);
                      setSelectedClient(null);
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Name</p>
                    <p className="font-medium">{selectedClient.firstName} {selectedClient.lastName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Email</p>
                    <p className="font-medium">{selectedClient.email}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Phone</p>
                    <p className="font-medium">{selectedClient.phone}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Address</p>
                    <p className="font-medium">{selectedClient.address || 'Not provided'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Created</p>
                    <p className="font-medium">
                      {selectedClient.createdAt?.toDate ? 
                        selectedClient.createdAt.toDate().toLocaleDateString() : 
                        'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Matters</p>
                    <p className="font-medium">
                      {matters.filter(m => m.clientId === selectedClient.uid || m.clientId === selectedClient.id).length} active
                    </p>
                  </div>
                </div>
                
                <div className="mt-6 flex space-x-3">
                  <button
                    onClick={() => {
                      setShowClientDetails(false);
                      setActiveTab('documents');
                    }}
                    className="px-4 py-2 bg-blue-900 text-white rounded-md hover:bg-blue-800"
                  >
                    View Documents
                  </button>
                  <button
                    onClick={() => {
                      setShowClientDetails(false);
                      setActiveTab('messages');
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  >
                    View Messages
                  </button>
                  <button
                    onClick={() => {
                      setShowClientDetails(false);
                      setSelectedClient(null);
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}

            {/* New Client Form */}
            {showNewClientForm && (
              <div className="bg-white rounded-lg shadow mb-6 p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Create New Client</h3>
                <form onSubmit={handleCreateClient} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">First Name</label>
                      <input
                        name="firstName"
                        type="text"
                        required
                        className={inputClassName}
                        placeholder="Enter first name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Last Name</label>
                      <input
                        name="lastName"
                        type="text"
                        required
                        className={inputClassName}
                        placeholder="Enter last name"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Email</label>
                      <input
                        name="email"
                        type="email"
                        required
                        className={inputClassName}
                        placeholder="client@example.com"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Phone</label>
                      <input
                        name="phone"
                        type="tel"
                        required
                        className={inputClassName}
                        placeholder="(555) 123-4567"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Address</label>
                    <textarea
                      name="address"
                      rows={2}
                      className={textareaClassName}
                      placeholder="Enter client address"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Password</label>
                      <input
                        name="password"
                        type="password"
                        required
                        placeholder="Temporary password for client"
                        className={inputClassName}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Matter Type</label>
                      <select
                        name="matterType"
                        className={selectClassName}
                      >
                        <option>Estate Planning</option>
                        <option>Trust Administration</option>
                        <option>Probate</option>
                        <option>Will</option>
                      </select>
                    </div>
                  </div>
                  
                  <div className="flex justify-end space-x-3">
                    <button
                      type="button"
                      onClick={() => setShowNewClientForm(false)}
                      className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-900 text-white rounded-md hover:bg-blue-800"
                    >
                      Create Client
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Clients Table */}
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Client
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Phone
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Matters
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {clients.map((client) => (
                    <tr key={client.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 bg-gray-200 rounded-full flex items-center justify-center">
                            <span className="text-gray-600 font-medium">
                              {client.firstName?.[0]}{client.lastName?.[0]}
                            </span>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {client.firstName} {client.lastName}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {client.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {client.phone}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {matters.filter(m => m.clientId === client.uid || m.clientId === client.id).length}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => {
                            setSelectedClient(client);
                            setShowClientDetails(true);
                          }}
                          className="text-blue-600 hover:text-blue-900 mr-3"
                        >
                          View
                        </button>
                        <button 
                          onClick={() => {
                            alert('Edit feature coming soon! For now, create a new client.');
                          }}
                          className="text-gray-600 hover:text-gray-900"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Documents Tab */}
        {activeTab === 'documents' && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Documents</h2>
            
            {/* Upload Section */}
            <div className="bg-white rounded-lg shadow mb-6 p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Upload Document for Client</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Client
                  </label>
                  <select
                    onChange={(e) => setSelectedClient(clients.find(c => c.id === e.target.value))}
                    className={selectClassName}
                  >
                    <option value="">Choose a client...</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.firstName} {client.lastName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Upload File
                  </label>
                  <input
                    type="file"
                    onChange={(e) => selectedClient && handleUploadDocument(e, selectedClient.uid || selectedClient.id)}
                    disabled={!selectedClient}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                </div>
              </div>
              
              {uploadProgress > 0 && (
                <div className="mt-4">
                  <div className="flex justify-between text-sm text-gray-600 mb-1">
                    <span>Uploading...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                </div>
              )}
            </div>

            {/* Documents Table */}
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Document
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Client
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Upload Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Size
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {documents.map((doc) => (
                    <tr key={doc.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <FileText className="h-5 w-5 text-gray-400 mr-3" />
                          <span className="text-sm font-medium text-gray-900">{doc.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {getClientName(doc.clientId)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {doc.uploadDate?.toDate ? doc.uploadDate.toDate().toLocaleDateString() : 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {doc.size}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <a 
                          href={doc.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-900 mr-3"
                        >
                          <Download className="h-4 w-4 inline" />
                        </a>
                        <button className="text-red-600 hover:text-red-900">
                          <Trash2 className="h-4 w-4 inline" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Messages Tab */}
        {activeTab === 'messages' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Messages</h2>
              <button
                onClick={() => setShowMessageForm(true)}
                className="flex items-center px-4 py-2 bg-blue-900 text-white rounded-lg hover:bg-blue-800"
              >
                <Send className="h-4 w-4 mr-2" />
                Send Message
              </button>
            </div>

            {/* Send Message Form */}
            {showMessageForm && (
              <div className="bg-white rounded-lg shadow mb-6 p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Send Message to Client</h3>
                <form onSubmit={handleSendMessage} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Select Client</label>
                    <select
                      name="clientId"
                      required
                      className={selectClassName}
                    >
                      <option value="">Choose a client...</option>
                      {clients.map((client) => (
                        <option key={client.id} value={client.uid || client.id}>
                          {client.firstName} {client.lastName}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Subject</label>
                    <input
                      name="subject"
                      type="text"
                      required
                      className={inputClassName}
                      placeholder="Enter message subject"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Message</label>
                    <textarea
                      name="message"
                      rows={4}
                      required
                      className={textareaClassName}
                      placeholder="Type your message here..."
                    />
                  </div>
                  
                  <div className="flex justify-end space-x-3">
                    <button
                      type="button"
                      onClick={() => setShowMessageForm(false)}
                      className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-900 text-white rounded-md hover:bg-blue-800"
                    >
                      Send Message
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Messages List */}
            <div className="bg-white shadow rounded-lg">
              <div className="divide-y divide-gray-200">
                {messages.map((message) => (
                  <div key={message.id} className={`p-6 hover:bg-gray-50 ${message.unread ? 'bg-blue-50' : ''}`}>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-medium text-gray-900">{message.subject}</h4>
                      <span className="text-sm text-gray-500">
                        {message.date?.toDate ? message.date.toDate().toLocaleDateString() : 'N/A'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">
                      To: {getClientName(message.clientId)}
                    </p>
                    <p className="text-sm text-gray-700">{message.message}</p>
                    {message.unread && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 mt-2">
                        Unread
                      </span>
                    )}
                  </div>
                ))}
                {messages.length === 0 && (
                  <div className="p-6 text-center text-sm text-gray-500">
                    No messages yet
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Matters Tab */}
        {activeTab === 'matters' && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Matters</h2>
            
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Matter
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Client
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last Update
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {matters.map((matter) => (
                    <tr key={matter.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {matter.title}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {getClientName(matter.clientId)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {matter.type}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(matter.status)}`}>
                          {matter.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {matter.lastUpdate?.toDate ? matter.lastUpdate.toDate().toLocaleDateString() : 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button className="text-blue-600 hover:text-blue-900 mr-3">
                          Edit
                        </button>
                        <button className="text-gray-600 hover:text-gray-900">
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
