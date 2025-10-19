import React, { useState, useEffect } from 'react';
import { 
  Users, FileText, MessageSquare, Upload, Search, 
  Plus, Edit, Trash2, Send, Calendar as CalendarIcon, DollarSign,
  Home, LogOut, Settings, Eye, Download, Shield,
  CheckCircle, AlertCircle, Clock, Menu, X, Folder,
  ChevronLeft, ChevronRight
} from 'lucide-react';
import { Calendar as BigCalendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
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
  getDoc,
  setDoc
} from 'firebase/firestore';
import { 
  ref, 
  uploadBytes, 
  getDownloadURL 
} from 'firebase/storage';
import { auth, db, storage, functions } from '../firebase';
import { httpsCallable } from 'firebase/functions';
import emailjs from '@emailjs/browser';

// Initialize EmailJS
emailjs.init('tlwGhvG0aPvocwYcO');

// Initialize moment localizer for calendar
const localizer = momentLocalizer(moment);

const AdminDashboard = () => {
  const [adminUser, setAdminUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Calendar view states
  const [calendarView, setCalendarView] = useState('month');
  const [calendarDate, setCalendarDate] = useState(new Date());
  
  // Data states
  const [clients, setClients] = useState([]);
  const [matters, setMatters] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [messages, setMessages] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [allAppointments, setAllAppointments] = useState([]); // All appointments for calendar
  const [stats, setStats] = useState({
    totalClients: 0,
    activeMatters: 0,
    totalDocuments: 0,
    unreadMessages: 0,
    upcomingAppointments: 0
  });
  
  // Form states
  const [showNewClientForm, setShowNewClientForm] = useState(false);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedCalendarEvent, setSelectedCalendarEvent] = useState(null);
  
  // New client form data
  const [newClientData, setNewClientData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    password: '',
    matterType: 'Estate Planning',
    matterTitle: '',
    matterDescription: ''
  });
  
  // Message form data
  const [selectedClient, setSelectedClient] = useState('');
  const [messageSubject, setMessageSubject] = useState('');
  const [messageContent, setMessageContent] = useState('');
  
  // Upload form data
  const [uploadClient, setUploadClient] = useState('');
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadCategory, setUploadCategory] = useState('');
  
  // View client modal
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewingClient, setViewingClient] = useState(null);
  
  // Edit client modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [editClientData, setEditClientData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: ''
  });

  // Admin emails that are allowed to access the dashboard
  const ADMIN_EMAILS = ['rozsagyenelaw@yahoo.com'];

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user && ADMIN_EMAILS.includes(user.email)) {
        setAdminUser(user);
        await loadDashboardData();
      } else {
        setAdminUser(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const loadDashboardData = async () => {
    try {
      // Load clients
      const clientsSnapshot = await getDocs(query(collection(db, 'users'), where('role', '==', 'client')));
      const clientsData = clientsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      console.log('Loaded clients:', clientsData);
      setClients(clientsData);

      // Load matters
      const mattersSnapshot = await getDocs(collection(db, 'matters'));
      const mattersData = mattersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setMatters(mattersData);

      // Load documents
      const documentsSnapshot = await getDocs(query(collection(db, 'documents'), orderBy('uploadDate', 'desc')));
      const documentsData = documentsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setDocuments(documentsData);

      // Load messages
      const messagesSnapshot = await getDocs(query(collection(db, 'messages'), orderBy('date', 'desc')));
      const messagesData = messagesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setMessages(messagesData);

      // Load ALL appointments for calendar view - EXCLUDE CANCELLED
      const allAppointmentsSnapshot = await getDocs(
        query(
          collection(db, 'appointments'),
          where('status', '!=', 'cancelled')
        )
      );
      const allAppointmentsData = allAppointmentsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        appointmentDate: doc.data().appointmentDate?.toDate()
      }));
      setAllAppointments(allAppointmentsData);

      // Load confirmed upcoming appointments for stats and list view
      const appointmentsSnapshot = await getDocs(query(
        collection(db, 'appointments'), 
        where('status', '==', 'confirmed'),
        orderBy('appointmentDate', 'asc')
      ));
      const appointmentsData = appointmentsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        appointmentDate: doc.data().appointmentDate?.toDate()
      }));
      
      // Filter for upcoming appointments only
      const now = new Date();
      const upcomingAppointmentsData = appointmentsData.filter(appt => appt.appointmentDate >= now);
      
      setAppointments(upcomingAppointmentsData);

      // Calculate stats
      setStats({
        totalClients: clientsData.length,
        activeMatters: mattersData.filter(m => m.status === 'Active').length,
        totalDocuments: documentsData.length,
        unreadMessages: messagesData.filter(m => m.unread).length,
        upcomingAppointments: upcomingAppointmentsData.length
      });
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    }
  };

  const handleCancelAppointment = async (appointmentId) => {
    if (!window.confirm('Are you sure you want to cancel this appointment?')) {
      return;
    }

    try {
      // Get appointment details before cancelling
      const appointmentDoc = await getDoc(doc(db, 'appointments', appointmentId));
      if (!appointmentDoc.exists()) {
        alert('Appointment not found.');
        return;
      }

      const appointment = appointmentDoc.data();
      const appointmentDate = appointment.appointmentDate?.toDate();

      // Update status to cancelled
      await updateDoc(doc(db, 'appointments', appointmentId), {
        status: 'cancelled',
        cancelledAt: serverTimestamp()
      });

      // Send cancellation emails
      try {
        const cancellationDetails = {
          appointmentId: appointmentId,
          clientName: appointment.clientName,
          clientEmail: appointment.clientEmail,
          clientPhone: appointment.clientPhone || '',
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
          appointmentType: appointment.appointmentType === 'virtual' ? 'Virtual Consultation' : 'Phone Consultation',
          cancelledBy: 'Admin'
        };

        // Send cancellation confirmation to CLIENT
        const sendClientCancellation = httpsCallable(functions, 'sendClientCancellationConfirmation');
        await sendClientCancellation(cancellationDetails);

        // Send cancellation notification to ATTORNEY
        const sendAttorneyCancellation = httpsCallable(functions, 'sendAttorneyCancellationNotification');
        await sendAttorneyCancellation(cancellationDetails);

        console.log('✓ Cancellation emails sent successfully');
      } catch (emailError) {
        console.error('Failed to send cancellation emails:', emailError);
        // Don't fail the cancellation if email fails
      }
      
      alert('Appointment cancelled successfully. Confirmation emails have been sent.');
      await loadDashboardData();
      
      // Close the modal if it's open
      setSelectedCalendarEvent(null);
    } catch (error) {
      console.error('Error cancelling appointment:', error);
      alert('Failed to cancel appointment. Please try again.');
    }
  };

  // Convert appointments to calendar events format
  const calendarEvents = allAppointments.map(appointment => ({
    id: appointment.id,
    title: `${appointment.clientName} - ${appointment.appointmentType === 'virtual' ? 'Virtual' : 'Phone'}`,
    start: appointment.appointmentDate,
    end: new Date(appointment.appointmentDate.getTime() + 60 * 60 * 1000), // 1 hour duration
    resource: appointment
  }));

  const eventStyleGetter = (event) => {
    const appointment = event.resource;
    let backgroundColor = '#3B82F6'; // Default blue
    
    switch(appointment.status) {
      case 'confirmed':
        backgroundColor = '#10B981'; // Green
        break;
      case 'pending':
        backgroundColor = '#F59E0B'; // Orange
        break;
      case 'cancelled':
        backgroundColor = '#EF4444'; // Red
        break;
      default:
        backgroundColor = '#6B7280'; // Gray
    }

    return {
      style: {
        backgroundColor,
        borderRadius: '4px',
        opacity: 0.9,
        color: 'white',
        border: 'none',
        display: 'block'
      }
    };
  };

  const handleSelectCalendarEvent = (event) => {
    setSelectedCalendarEvent(event.resource);
  };

  const CustomToolbar = ({ label, onNavigate, onView }) => (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'center',
      marginBottom: '20px',
      flexWrap: 'wrap',
      gap: '10px'
    }}>
      <div style={{ display: 'flex', gap: '10px' }}>
        <button 
          onClick={() => onNavigate('PREV')}
          className="px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
        >
          <ChevronLeft size={20} />
        </button>
        <button 
          onClick={() => onNavigate('TODAY')}
          className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
        >
          Today
        </button>
        <button 
          onClick={() => onNavigate('NEXT')}
          className="px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
        >
          <ChevronRight size={20} />
        </button>
      </div>
      <h2 className="text-xl font-semibold">{label}</h2>
      <div style={{ display: 'flex', gap: '5px' }}>
        {['month', 'week', 'day'].map((view) => (
          <button
            key={view}
            onClick={() => { setCalendarView(view); onView(view); }}
            className={`px-4 py-2 rounded-md ${
              calendarView === view 
                ? 'bg-blue-900 text-white' 
                : 'border border-gray-300 hover:bg-gray-50'
            }`}
          >
            {view.charAt(0).toUpperCase() + view.slice(1)}
          </button>
        ))}
      </div>
    </div>
  );

  const handleCreateClient = async (e) => {
    e.preventDefault();
    
    try {
      const tempUid = 'temp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      
      await setDoc(doc(db, 'users', tempUid), {
        uid: tempUid,
        email: newClientData.email,
        firstName: newClientData.firstName,
        lastName: newClientData.lastName,
        phone: newClientData.phone,
        address: newClientData.address,
        role: 'client',
        needsAuthSetup: true,
        tempPassword: newClientData.password,
        createdAt: serverTimestamp(),
        createdBy: adminUser.email
      });

      if (newClientData.matterTitle) {
        await addDoc(collection(db, 'matters'), {
          clientId: tempUid,
          clientName: `${newClientData.firstName} ${newClientData.lastName}`,
          title: newClientData.matterTitle,
          type: newClientData.matterType,
          description: newClientData.matterDescription,
          status: 'Active',
          createdAt: serverTimestamp(),
          lastUpdate: serverTimestamp()
        });
      }

      setNewClientData({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        address: '',
        password: '',
        matterType: 'Estate Planning',
        matterTitle: '',
        matterDescription: ''
      });
      setShowNewClientForm(false);
      
      await loadDashboardData();
      alert('Client profile created! Note: Client will need to set up their login credentials on first visit.');
    } catch (error) {
      console.error('Error creating client:', error);
      if (error.code === 'auth/email-already-in-use') {
        alert('This email is already registered. Please use a different email.');
      } else if (error.code === 'auth/weak-password') {
        alert('Password is too weak. Please use at least 6 characters.');
      } else {
        alert('Error creating client: ' + error.message);
      }
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    
    if (!selectedClient || !messageSubject || !messageContent) {
      alert('Please fill in all fields');
      return;
    }

    console.log('Selected client ID:', selectedClient);
    console.log('Available clients:', clients);

    try {
      const selectedClientData = clients.find(c => c.id === selectedClient);
      
      console.log('Found client data:', selectedClientData);
      if (!selectedClientData) {
        alert('Client not found. Please select a valid client.');
        return;
      }
      
      const clientName = `${selectedClientData.firstName} ${selectedClientData.lastName}`;
      const clientEmail = selectedClientData.email;
      
      console.log('Sending email to:', clientEmail);
      console.log('Client data:', selectedClientData);
      
      if (!clientEmail) {
        alert('Client email address not found. Please make sure the client has an email address.');
        return;
      }

      await addDoc(collection(db, 'messages'), {
        clientId: selectedClientData.uid || selectedClientData.id,
        clientName: clientName,
        from: 'Law Offices of Rozsa Gyene',
        subject: messageSubject,
        message: messageContent,
        date: serverTimestamp(),
        unread: true
      });

      const emailParams = {
        client_name: clientName,
        to_email: clientEmail,
        message_preview: messageContent.substring(0, 150) + (messageContent.length > 150 ? '...' : '')
      };

      console.log('Sending email to:', clientEmail);
      console.log('Email params:', emailParams);

      await emailjs.send(
        'service_0ak47yn',
        'template_ita6dzu',
        emailParams
      );

      setSelectedClient('');
      setMessageSubject('');
      setMessageContent('');
      setShowMessageModal(false);
      
      await loadDashboardData();
      
      alert('Message sent successfully!');
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message');
    }
  };

  const handleFileUpload = async (e) => {
    e.preventDefault();
    
    if (!uploadClient || !uploadFile || !uploadCategory) {
      alert('Please fill in all fields');
      return;
    }

    setUploadProgress(10);

    try {
      const client = clients.find(c => c.id === uploadClient);
      
      if (!client) {
        alert('Please select a client');
        return;
      }
      
      const clientName = `${client.firstName} ${client.lastName}`;
      const clientUid = client.uid || client.id;

      const timestamp = new Date().getTime();
      const fileName = `${clientUid}/${uploadCategory}/${timestamp}_${uploadFile.name}`;
      const storageRef = ref(storage, `documents/${fileName}`);
      
      setUploadProgress(30);
      const snapshot = await uploadBytes(storageRef, uploadFile);
      
      setUploadProgress(60);
      const downloadURL = await getDownloadURL(snapshot.ref);
      
      setUploadProgress(80);

      await addDoc(collection(db, 'documents'), {
        name: uploadFile.name,
        category: uploadCategory,
        url: downloadURL,
        size: `${(uploadFile.size / 1024 / 1024).toFixed(2)} MB`,
        uploadDate: serverTimestamp(),
        clientId: clientUid,
        clientName: clientName,
        uploadedBy: adminUser.email
      });

      setUploadProgress(100);

      setUploadClient('');
      setUploadFile(null);
      setUploadCategory('');
      setShowUploadModal(false);
      setUploadProgress(0);
      
      await loadDashboardData();
      
      alert('Document uploaded successfully!');
    } catch (error) {
      console.error('Error uploading document:', error);
      alert('Failed to upload document');
      setUploadProgress(0);
    }
  };

  const handleEditClient = async (e) => {
    e.preventDefault();
    
    try {
      await updateDoc(doc(db, 'users', editingClient.id), {
        firstName: editClientData.firstName,
        lastName: editClientData.lastName,
        email: editClientData.email,
        phone: editClientData.phone,
        address: editClientData.address,
        updatedAt: serverTimestamp()
      });
      
      setEditClientData({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        address: ''
      });
      setShowEditModal(false);
      setEditingClient(null);
      
      await loadDashboardData();
      
      alert('Client updated successfully!');
    } catch (error) {
      console.error('Error updating client:', error);
      alert('Error updating client: ' + error.message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Shield className="h-12 w-12 text-blue-900 animate-pulse mx-auto mb-4" />
          <p className="text-gray-600">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  if (!adminUser) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Shield className="h-12 w-12 text-red-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-600">You don't have permission to access this page.</p>
          <button
            onClick={() => window.location.href = '/'}
            className="mt-4 px-4 py-2 bg-blue-900 text-white rounded-md hover:bg-blue-800"
          >
            Return to Client Portal
          </button>
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
                <h1 className="text-xl font-bold">Admin Dashboard</h1>
                <p className="text-sm text-blue-200">Law Offices of Rozsa Gyene</p>
              </div>
            </div>
            
            <nav className="space-y-2">
              {[
                { id: 'overview', icon: Home, label: 'Overview' },
                { id: 'clients', icon: Users, label: 'Clients' },
                { id: 'calendar', icon: CalendarIcon, label: 'Calendar' },
                { id: 'appointments', icon: Clock, label: 'Appointments List' },
                { id: 'documents', icon: FileText, label: 'Documents' },
                { id: 'messages', icon: MessageSquare, label: 'Messages' },
                { id: 'matters', icon: Folder, label: 'Matters' },
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
      <div className="lg:ml-64">
        <div className="p-4 sm:p-6 lg:p-8">
          {/* Calendar Tab - NEW! */}
          {activeTab === 'calendar' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Calendar</h2>
                  <p className="text-sm text-gray-600 mt-1">View and manage all appointments</p>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="flex space-x-2">
                    <div className="flex items-center">
                      <span className="w-3 h-3 rounded-full bg-green-500 mr-1"></span>
                      <span className="text-xs text-gray-600">Confirmed</span>
                    </div>
                    <div className="flex items-center">
                      <span className="w-3 h-3 rounded-full bg-orange-500 mr-1"></span>
                      <span className="text-xs text-gray-600">Pending</span>
                    </div>
                    <div className="flex items-center">
                      <span className="w-3 h-3 rounded-full bg-red-500 mr-1"></span>
                      <span className="text-xs text-gray-600">Cancelled</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <BigCalendar
                  localizer={localizer}
                  events={calendarEvents}
                  startAccessor="start"
                  endAccessor="end"
                  style={{ height: 700 }}
                  onSelectEvent={handleSelectCalendarEvent}
                  view={calendarView}
                  date={calendarDate}
                  onView={setCalendarView}
                  onNavigate={setCalendarDate}
                  eventPropGetter={eventStyleGetter}
                  components={{
                    toolbar: CustomToolbar
                  }}
                />
              </div>
            </div>
          )}

          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Dashboard Overview</h2>
              
              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div className="bg-white p-6 rounded-lg shadow">
                  <div className="flex items-center">
                    <Users className="h-10 w-10 text-blue-600 mr-4" />
                    <div>
                      <p className="text-sm text-gray-600">Total Clients</p>
                      <p className="text-2xl font-semibold">{stats.totalClients}</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white p-6 rounded-lg shadow">
                  <div className="flex items-center">
                    <Folder className="h-10 w-10 text-green-600 mr-4" />
                    <div>
                      <p className="text-sm text-gray-600">Active Matters</p>
                      <p className="text-2xl font-semibold">{stats.activeMatters}</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white p-6 rounded-lg shadow">
                  <div className="flex items-center">
                    <FileText className="h-10 w-10 text-purple-600 mr-4" />
                    <div>
                      <p className="text-sm text-gray-600">Documents</p>
                      <p className="text-2xl font-semibold">{stats.totalDocuments}</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white p-6 rounded-lg shadow">
                  <div className="flex items-center">
                    <MessageSquare className="h-10 w-10 text-orange-600 mr-4" />
                    <div>
                      <p className="text-sm text-gray-600">Unread Messages</p>
                      <p className="text-2xl font-semibold">{stats.unreadMessages}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Appointments Card */}
              <div className="bg-white rounded-lg shadow p-6 mb-8">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">Upcoming Appointments</h3>
                  <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full">
                    {stats.upcomingAppointments} upcoming
                  </span>
                </div>
                {appointments.slice(0, 3).length > 0 ? (
                  <div className="space-y-3">
                    {appointments.slice(0, 3).map((appt) => (
                      <div key={appt.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center">
                          <CalendarIcon className="h-5 w-5 text-blue-600 mr-3" />
                          <div>
                            <p className="text-sm font-medium text-gray-900">{appt.clientName}</p>
                            <p className="text-xs text-gray-500">
                              {appt.appointmentDate?.toLocaleDateString('en-US', { 
                                weekday: 'short', 
                                month: 'short', 
                                day: 'numeric',
                                hour: 'numeric',
                                minute: '2-digit'
                              })}
                            </p>
                          </div>
                        </div>
                        <span className="text-xs text-gray-500">{appt.appointmentType === 'virtual' ? 'Virtual' : 'Phone'}</span>
                      </div>
                    ))}
                    <button
                      onClick={() => setActiveTab('calendar')}
                      className="w-full text-center text-sm text-blue-600 hover:text-blue-800 font-medium py-2"
                    >
                      View calendar →
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 text-center py-4">No upcoming appointments</p>
                )}
              </div>

              {/* Quick Actions */}
              <div className="bg-white rounded-lg shadow p-6 mb-8">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <button
                    onClick={() => setShowNewClientForm(true)}
                    className="flex items-center justify-center px-4 py-3 bg-blue-900 text-white rounded-md hover:bg-blue-800"
                  >
                    <Plus className="h-5 w-5 mr-2" />
                    New Client
                  </button>
                  <button
                    onClick={() => setShowUploadModal(true)}
                    className="flex items-center justify-center px-4 py-3 bg-green-600 text-white rounded-md hover:bg-green-700"
                  >
                    <Upload className="h-5 w-5 mr-2" />
                    Upload Document
                  </button>
                  <button
                    onClick={() => setShowMessageModal(true)}
                    className="flex items-center justify-center px-4 py-3 bg-purple-600 text-white rounded-md hover:bg-purple-700"
                  >
                    <Send className="h-5 w-5 mr-2" />
                    Send Message
                  </button>
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
                              Uploaded for {doc.clientName} • {doc.uploadDate?.toDate ? doc.uploadDate.toDate().toLocaleDateString() : 'Recently'}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Appointments Tab */}
          {activeTab === 'appointments' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Appointments List</h2>
                <span className="px-4 py-2 bg-blue-100 text-blue-800 text-sm font-medium rounded-full">
                  {appointments.length} upcoming
                </span>
              </div>

              <div className="bg-white shadow rounded-lg">
                {appointments.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Client
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Date & Time
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Type
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Notes
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {appointments.map((appointment) => (
                          <tr key={appointment.id}>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div>
                                <div className="text-sm font-medium text-gray-900">
                                  {appointment.clientName}
                                </div>
                                <div className="text-sm text-gray-500">
                                  {appointment.clientEmail}
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">
                                {appointment.appointmentDate?.toLocaleDateString('en-US', { 
                                  weekday: 'long', 
                                  year: 'numeric', 
                                  month: 'long', 
                                  day: 'numeric' 
                                })}
                              </div>
                              <div className="text-sm text-gray-500">
                                {appointment.appointmentDate?.toLocaleTimeString('en-US', { 
                                  hour: 'numeric', 
                                  minute: '2-digit',
                                  hour12: true 
                                })} PT
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                                {appointment.appointmentType === 'virtual' ? 'Virtual' : 'Phone'}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800 flex items-center w-fit">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Confirmed
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm text-gray-500 max-w-xs truncate">
                                {appointment.notes || 'No notes'}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              <button 
                                onClick={() => handleCancelAppointment(appointment.id)}
                                className="text-red-600 hover:text-red-900"
                              >
                                Cancel
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <CalendarIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No upcoming appointments</p>
                  </div>
                )}
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
                  className="flex items-center px-4 py-2 bg-blue-900 text-white rounded-md hover:bg-blue-800"
                >
                  <Plus className="h-5 w-5 mr-2" />
                  New Client
                </button>
              </div>

              <div className="bg-white shadow rounded-lg">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Name
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Email
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Phone
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Created
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
                            <div className="text-sm font-medium text-gray-900">
                              {client.firstName} {client.lastName}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-500">{client.email}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-500">{client.phone}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {client.createdAt?.toDate ? client.createdAt.toDate().toLocaleDateString() : 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <button 
                              onClick={() => {
                                setViewingClient(client);
                                setShowViewModal(true);
                              }}
                              className="text-blue-600 hover:text-blue-900 mr-3"
                            >
                              View
                            </button>
                            <button 
                              onClick={() => {
                                setEditingClient(client);
                                setEditClientData({
                                  firstName: client.firstName,
                                  lastName: client.lastName,
                                  email: client.email,
                                  phone: client.phone,
                                  address: client.address || ''
                                });
                                setShowEditModal(true);
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
            </div>
          )}

          {/* Documents Tab */}
          {activeTab === 'documents' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Documents</h2>
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                >
                  <Upload className="h-5 w-5 mr-2" />
                  Upload Document
                </button>
              </div>

              <div className="bg-white shadow rounded-lg">
                <div className="p-6">
                  <div className="space-y-4">
                    {documents.map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                        <div className="flex items-center">
                          <FileText className="h-8 w-8 text-gray-400 mr-4" />
                          <div>
                            <h4 className="text-sm font-medium text-gray-900">{doc.name}</h4>
                            <p className="text-sm text-gray-500">
                              {doc.clientName} • {doc.category} • {doc.uploadDate?.toDate ? doc.uploadDate.toDate().toLocaleDateString() : 'Recently'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-4">
                          <span className="text-sm text-gray-500">{doc.size}</span>
                          <button
                            onClick={() => {
                              console.log('Downloading document:', doc.name);
                              console.log('URL:', doc.url);
                              if (doc.url) {
                                window.open(doc.url, '_blank');
                              } else {
                                alert('Download URL not available');
                              }
                            }}
                            className="text-blue-600 hover:text-blue-800 p-2 rounded hover:bg-blue-50"
                            title="Download document"
                          >
                            <Download className="h-5 w-5" />
                          </button>
                        </div>
                      </div>
                    ))}
                    {documents.length === 0 && (
                      <p className="text-center text-gray-500">No documents uploaded yet</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Messages Tab */}
          {activeTab === 'messages' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Messages</h2>
                <button
                  onClick={() => setShowMessageModal(true)}
                  className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
                >
                  <Send className="h-5 w-5 mr-2" />
                  Send Message
                </button>
              </div>

              <div className="bg-white shadow rounded-lg">
                <div className="divide-y divide-gray-200">
                  {messages.map((message) => (
                    <div key={message.id} className={`p-6 ${message.unread ? 'bg-blue-50' : ''}`}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-medium text-gray-900">{message.subject}</h4>
                            <span className="text-sm text-gray-500">
                              {message.date?.toDate ? message.date.toDate().toLocaleDateString() : 'Recently'}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">To: {message.clientName}</p>
                          <p className="text-sm text-gray-700 mt-2">{message.message}</p>
                        </div>
                        {message.unread && (
                          <span className="ml-4 px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                            Unread
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Matters Tab */}
          {activeTab === 'matters' && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Matters</h2>

              <div className="bg-white shadow rounded-lg">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Title
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
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {matters.map((matter) => (
                        <tr key={matter.id}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{matter.title}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-500">{matter.clientName}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-500">{matter.type}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                              matter.status === 'Active' ? 'bg-green-100 text-green-800' :
                              matter.status === 'In Progress' ? 'bg-blue-100 text-blue-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {matter.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {matter.lastUpdate?.toDate ? matter.lastUpdate.toDate().toLocaleDateString() : 'N/A'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Event Details Modal */}
      {selectedCalendarEvent && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">Appointment Details</h3>
              <button
                onClick={() => setSelectedCalendarEvent(null)}
                className="text-gray-400 hover:text-gray-500"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Client</label>
                <p className="mt-1 text-sm text-gray-900">{selectedCalendarEvent.clientName}</p>
                <p className="mt-1 text-sm text-gray-500">{selectedCalendarEvent.clientEmail}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Date & Time</label>
                <p className="mt-1 text-sm text-gray-900">
                  {selectedCalendarEvent.appointmentDate?.toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  {selectedCalendarEvent.appointmentDate?.toLocaleTimeString('en-US', { 
                    hour: 'numeric', 
                    minute: '2-digit',
                    hour12: true 
                  })} PT
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Type</label>
                <span className="mt-1 inline-block px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                  {selectedCalendarEvent.appointmentType === 'virtual' ? 'Virtual Meeting' : 'Phone Call'}
                </span>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Status</label>
                <span className={`mt-1 inline-block px-2 py-1 text-xs font-medium rounded-full ${
                  selectedCalendarEvent.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                  selectedCalendarEvent.status === 'pending' ? 'bg-orange-100 text-orange-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {selectedCalendarEvent.status.charAt(0).toUpperCase() + selectedCalendarEvent.status.slice(1)}
                </span>
              </div>

              {selectedCalendarEvent.notes && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Notes</label>
                  <p className="mt-1 text-sm text-gray-500">{selectedCalendarEvent.notes}</p>
                </div>
              )}

              <div className="pt-4 flex space-x-3">
                {selectedCalendarEvent.status === 'confirmed' && (
                  <button
                    onClick={() => {
                      handleCancelAppointment(selectedCalendarEvent.id);
                    }}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                  >
                    Cancel Appointment
                  </button>
                )}
                <button
                  onClick={() => setSelectedCalendarEvent(null)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Client Modal */}
      {showNewClientForm && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">Create New Client</h3>
              <button
                onClick={() => setShowNewClientForm(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleCreateClient} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">First Name</label>
                  <input
                    type="text"
                    value={newClientData.firstName}
                    onChange={(e) => setNewClientData({...newClientData, firstName: e.target.value})}
                    required
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Last Name</label>
                  <input
                    type="text"
                    value={newClientData.lastName}
                    onChange={(e) => setNewClientData({...newClientData, lastName: e.target.value})}
                    required
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <input
                  type="email"
                  value={newClientData.email}
                  onChange={(e) => setNewClientData({...newClientData, email: e.target.value})}
                  required
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Phone</label>
                <input
                  type="tel"
                  value={newClientData.phone}
                  onChange={(e) => setNewClientData({...newClientData, phone: e.target.value})}
                  required
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Address</label>
                <input
                  type="text"
                  value={newClientData.address}
                  onChange={(e) => setNewClientData({...newClientData, address: e.target.value})}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Password</label>
                <input
                  type="password"
                  value={newClientData.password}
                  onChange={(e) => setNewClientData({...newClientData, password: e.target.value})}
                  required
                  minLength={6}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="mt-1 text-sm text-gray-500">Minimum 6 characters</p>
              </div>

              <div className="border-t pt-4 mt-4">
                <h4 className="text-md font-medium text-gray-900 mb-3">Initial Matter (Optional)</h4>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Matter Type</label>
                  <select
                    value={newClientData.matterType}
                    onChange={(e) => setNewClientData({...newClientData, matterType: e.target.value})}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option>Estate Planning</option>
                    <option>Probate</option>
                    <option>Trust Administration</option>
                    <option>Conservatorship</option>
                  </select>
                </div>

                <div className="mt-3">
                  <label className="block text-sm font-medium text-gray-700">Matter Title</label>
                  <input
                    type="text"
                    value={newClientData.matterTitle}
                    onChange={(e) => setNewClientData({...newClientData, matterTitle: e.target.value})}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div className="mt-3">
                  <label className="block text-sm font-medium text-gray-700">Description</label>
                  <textarea
                    value={newClientData.matterDescription}
                    onChange={(e) => setNewClientData({...newClientData, matterDescription: e.target.value})}
                    rows={3}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
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
        </div>
      )}

      {/* Upload Document Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">Upload Document</h3>
              <button
                onClick={() => setShowUploadModal(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleFileUpload} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Client</label>
                <select
                  value={uploadClient}
                  onChange={(e) => setUploadClient(e.target.value)}
                  required
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select a client...</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.firstName} {client.lastName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Category</label>
                <input
                  type="text"
                  value={uploadCategory}
                  onChange={(e) => setUploadCategory(e.target.value)}
                  placeholder="e.g., Trust Documents, Tax Returns"
                  required
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
                />
              </div>

              {uploadProgress > 0 && (
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div 
                    className="bg-blue-600 h-2.5 rounded-full" 
                    style={{width: `${uploadProgress}%`}}
                  ></div>
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                >
                  Upload
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Send Message Modal */}
      {showMessageModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">Send Message</h3>
              <button
                onClick={() => setShowMessageModal(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleSendMessage} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Client</label>
                <select
                  value={selectedClient}
                  onChange={(e) => setSelectedClient(e.target.value)}
                  required
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select a client...</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.firstName} {client.lastName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Subject</label>
                <input
                  type="text"
                  value={messageSubject}
                  onChange={(e) => setMessageSubject(e.target.value)}
                  required
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Message</label>
                <textarea
                  value={messageContent}
                  onChange={(e) => setMessageContent(e.target.value)}
                  rows={4}
                  required
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowMessageModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
                >
                  Send Message
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Client Modal */}
      {showViewModal && viewingClient && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">Client Details</h3>
              <button
                onClick={() => setShowViewModal(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Name</label>
                <p className="mt-1 text-sm text-gray-900">
                  {viewingClient.firstName} {viewingClient.lastName}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <p className="mt-1 text-sm text-gray-900">{viewingClient.email}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Phone</label>
                <p className="mt-1 text-sm text-gray-900">{viewingClient.phone}</p>
              </div>

              {viewingClient.address && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Address</label>
                  <p className="mt-1 text-sm text-gray-900">{viewingClient.address}</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700">Created</label>
                <p className="mt-1 text-sm text-gray-900">
                  {viewingClient.createdAt?.toDate ? viewingClient.createdAt.toDate().toLocaleDateString() : 'N/A'}
                </p>
              </div>

              <div className="pt-4 flex space-x-3">
                <button
                  onClick={() => {
                    setSelectedClient(viewingClient.uid);
                    setActiveTab('documents');
                    setShowViewModal(false);
                  }}
                  className="flex-1 px-4 py-2 bg-blue-900 text-white rounded-md hover:bg-blue-800"
                >
                  View Documents
                </button>
                <button
                  onClick={() => {
                    setSelectedClient(viewingClient.uid);
                    setActiveTab('messages');
                    setShowViewModal(false);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  View Messages
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Client Modal */}
      {showEditModal && editingClient && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">Edit Client</h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleEditClient} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">First Name</label>
                <input
                  type="text"
                  value={editClientData.firstName}
                  onChange={(e) => setEditClientData({...editClientData, firstName: e.target.value})}
                  required
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Last Name</label>
                <input
                  type="text"
                  value={editClientData.lastName}
                  onChange={(e) => setEditClientData({...editClientData, lastName: e.target.value})}
                  required
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <input
                  type="email"
                  value={editClientData.email}
                  onChange={(e) => setEditClientData({...editClientData, email: e.target.value})}
                  required
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Phone</label>
                <input
                  type="tel"
                  value={editClientData.phone}
                  onChange={(e) => setEditClientData({...editClientData, phone: e.target.value})}
                  required
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Address</label>
                <input
                  type="text"
                  value={editClientData.address}
                  onChange={(e) => setEditClientData({...editClientData, address: e.target.value})}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-900 text-white rounded-md hover:bg-blue-800"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
