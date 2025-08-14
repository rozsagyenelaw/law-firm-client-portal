import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, FileText, Download, Upload, MessageSquare, User, LogOut, Folder, Home, Shield, Clock, DollarSign, AlertCircle, Check, X, ChevronRight, Menu, Bell, Plus, Search, Calendar, Briefcase, Users, FileCheck } from 'lucide-react';

const ClientPortal = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [signupData, setSignupData] = useState({ 
    fullName: '', 
    email: '', 
    password: '', 
    confirmPassword: '',
    phone: ''
  });
  const [isSignup, setIsSignup] = useState(false);
  const [selectedMatter, setSelectedMatter] = useState(null);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [message, setMessage] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState([
    { id: 1, text: 'Your trust documents are ready for review', time: '2 hours ago', unread: true },
    { id: 2, text: 'Payment received - Thank you!', time: '1 day ago', unread: false }
  ]);

  // Mock user data
  const [userData, setUserData] = useState({
    name: 'John Smith',
    email: 'john.smith@email.com',
    matters: [
      {
        id: 1,
        type: 'Living Trust',
        name: 'Smith Family Trust',
        status: 'In Progress',
        lastUpdate: '2025-08-10',
        documents: [
          { name: 'Draft Trust Agreement', date: '2025-08-08', status: 'Review Required' },
          { name: 'Asset Schedule', date: '2025-08-05', status: 'Completed' }
        ],
        tasks: [
          { name: 'Review trust draft', due: '2025-08-16', completed: false },
          { name: 'Provide bank account information', due: '2025-08-18', completed: false }
        ]
      },
      {
        id: 2,
        type: 'Probate',
        name: 'Estate of Mary Smith',
        status: 'Active',
        lastUpdate: '2025-08-12',
        documents: [
          { name: 'Petition for Probate', date: '2025-08-01', status: 'Filed' },
          { name: 'Letters of Administration', date: '2025-08-10', status: 'Issued' }
        ],
        tasks: [
          { name: 'Inventory assets', due: '2025-08-20', completed: false }
        ]
      }
    ],
    messages: [
      {
        id: 1,
        from: 'Rozsa Gyene',
        subject: 'Trust Draft Ready for Review',
        date: '2025-08-10',
        content: 'Hi John, I\'ve completed the initial draft of your trust. Please review and let me know if you have any questions.',
        unread: true
      }
    ]
  });

  const handleLogin = () => {
    if (loginData.email && loginData.password) {
      setIsLoggedIn(true);
      setActiveTab('dashboard');
    }
  };

  const handleSignup = () => {
    if (signupData.password !== signupData.confirmPassword) {
      alert('Passwords do not match');
      return;
    }
    if (signupData.fullName && signupData.email && signupData.password) {
      setIsLoggedIn(true);
      setActiveTab('dashboard');
      setUserData({
        ...userData,
        name: signupData.fullName,
        email: signupData.email,
        matters: []
      });
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setUploadedFile(file);
      // In real app, would upload to server
      alert(`File "${file.name}" uploaded successfully!`);
    }
  };

  const handleSendMessage = () => {
    if (message.trim()) {
      // In real app, would send to server
      alert('Message sent to your attorney!');
      setMessage('');
    }
  };

  const LoginScreen = () => (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-full mb-4">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Rozsa Gyene Law</h1>
            <p className="text-gray-600 mt-2">Secure Client Portal</p>
          </div>

          {!isSignup ? (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  value={loginData.email}
                  onChange={(e) => setLoginData({...loginData, email: e.target.value})}
                  placeholder="your@email.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition pr-12"
                    value={loginData.password}
                    onChange={(e) => setLoginData({...loginData, password: e.target.value})}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              <button
                onClick={handleLogin}
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition duration-200 transform hover:scale-[1.02]"
              >
                Sign In
              </button>

              <div className="text-center">
                <p className="text-sm text-gray-600">
                  Don't have an account?{' '}
                  <button
                    type="button"
                    onClick={() => setIsSignup(true)}
                    className="text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Sign up
                  </button>
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  value={signupData.fullName}
                  onChange={(e) => setSignupData({...signupData, fullName: e.target.value})}
                  placeholder="John Smith"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  value={signupData.email}
                  onChange={(e) => setSignupData({...signupData, email: e.target.value})}
                  placeholder="your@email.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number
                </label>
                <input
                  type="tel"
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  value={signupData.phone}
                  onChange={(e) => setSignupData({...signupData, phone: e.target.value})}
                  placeholder="(555) 123-4567"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <input
                  type="password"
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  value={signupData.password}
                  onChange={(e) => setSignupData({...signupData, password: e.target.value})}
                  placeholder="••••••••"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Confirm Password
                </label>
                <input
                  type="password"
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  value={signupData.confirmPassword}
                  onChange={(e) => setSignupData({...signupData, confirmPassword: e.target.value})}
                  placeholder="••••••••"
                />
              </div>

              <button
                onClick={handleSignup}
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition duration-200 transform hover:scale-[1.02]"
              >
                Create Account
              </button>

              <div className="text-center">
                <p className="text-sm text-gray-600">
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => setIsSignup(false)}
                    className="text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Sign in
                  </button>
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const Dashboard = () => (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden mr-4 text-gray-500 hover:text-gray-700"
              >
                <Menu size={24} />
              </button>
              <h1 className="text-2xl font-bold text-gray-900">Rozsa Gyene Law</h1>
            </div>
            <div className="flex items-center space-x-4">
              <button className="relative text-gray-500 hover:text-gray-700">
                <Bell size={20} />
                {notifications.some(n => n.unread) && (
                  <span className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full"></span>
                )}
              </button>
              <div className="flex items-center space-x-3">
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">{userData.name}</p>
                  <p className="text-xs text-gray-500">{userData.email}</p>
                </div>
                <button
                  onClick={() => setIsLoggedIn(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <LogOut size={20} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className={`${mobileMenuOpen ? 'block' : 'hidden'} lg:block w-64 bg-white shadow-sm h-[calc(100vh-73px)]`}>
          <nav className="p-4 space-y-1">
            <button
              onClick={() => {setActiveTab('dashboard'); setMobileMenuOpen(false)}}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition ${
                activeTab === 'dashboard' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Home size={20} />
              <span>Dashboard</span>
            </button>
            <button
              onClick={() => {setActiveTab('matters'); setMobileMenuOpen(false)}}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition ${
                activeTab === 'matters' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Briefcase size={20} />
              <span>My Matters</span>
            </button>
            <button
              onClick={() => {setActiveTab('documents'); setMobileMenuOpen(false)}}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition ${
                activeTab === 'documents' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <FileText size={20} />
              <span>Documents</span>
            </button>
            <button
              onClick={() => {setActiveTab('messages'); setMobileMenuOpen(false)}}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition ${
                activeTab === 'messages' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <MessageSquare size={20} />
              <span>Messages</span>
              {userData.messages.some(m => m.unread) && (
                <span className="ml-auto bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                  {userData.messages.filter(m => m.unread).length}
                </span>
              )}
            </button>
            <button
              onClick={() => {setActiveTab('billing'); setMobileMenuOpen(false)}}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition ${
                activeTab === 'billing' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <DollarSign size={20} />
              <span>Billing</span>
            </button>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6 overflow-auto">
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Welcome back, {userData.name.split(' ')[0]}!</h2>
                
                {/* Quick Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">Active Matters</p>
                        <p className="text-2xl font-bold text-gray-900">{userData.matters.length}</p>
                      </div>
                      <Briefcase className="text-blue-600" size={32} />
                    </div>
                  </div>
                  <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">Pending Tasks</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {userData.matters.reduce((acc, m) => acc + m.tasks.filter(t => !t.completed).length, 0)}
                        </p>
                      </div>
                      <Clock className="text-yellow-600" size={32} />
                    </div>
                  </div>
                  <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">New Messages</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {userData.messages.filter(m => m.unread).length}
                        </p>
                      </div>
                      <MessageSquare className="text-green-600" size={32} />
                    </div>
                  </div>
                </div>

                {/* Recent Activity */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                  <div className="p-6 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
                  </div>
                  <div className="p-6 space-y-4">
                    {userData.matters.map(matter => (
                      <div key={matter.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div>
                          <p className="font-medium text-gray-900">{matter.name}</p>
                          <p className="text-sm text-gray-600">Last updated: {matter.lastUpdate}</p>
                        </div>
                        <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                          matter.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {matter.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'matters' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">My Matters</h2>
                <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition flex items-center space-x-2">
                  <Plus size={20} />
                  <span>New Matter</span>
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {userData.matters.map(matter => (
                  <div key={matter.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="font-semibold text-lg text-gray-900">{matter.name}</h3>
                        <p className="text-sm text-gray-600">{matter.type}</p>
                      </div>
                      <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                        matter.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {matter.status}
                      </span>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <p className="text-sm font-medium text-gray-700 mb-2">Recent Documents</p>
                        {matter.documents.slice(0, 2).map((doc, idx) => (
                          <div key={idx} className="flex items-center justify-between py-2">
                            <div className="flex items-center space-x-2">
                              <FileText size={16} className="text-gray-400" />
                              <span className="text-sm text-gray-600">{doc.name}</span>
                            </div>
                            <span className={`text-xs ${
                              doc.status === 'Review Required' ? 'text-red-600' : 'text-green-600'
                            }`}>
                              {doc.status}
                            </span>
                          </div>
                        ))}
                      </div>

                      <button
                        onClick={() => setSelectedMatter(matter)}
                        className="w-full mt-4 text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center justify-center space-x-1"
                      >
                        <span>View Details</span>
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'documents' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Documents</h2>
                <div className="flex space-x-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                    <input
                      type="text"
                      placeholder="Search documents..."
                      className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <label className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition cursor-pointer flex items-center space-x-2">
                    <Upload size={20} />
                    <span>Upload</span>
                    <input type="file" className="hidden" onChange={handleFileUpload} />
                  </label>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="p-6 space-y-4">
                  {userData.matters.flatMap(matter => 
                    matter.documents.map((doc, idx) => (
                      <div key={`${matter.id}-${idx}`} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition">
                        <div className="flex items-center space-x-4">
                          <FileText className="text-blue-600" size={24} />
                          <div>
                            <p className="font-medium text-gray-900">{doc.name}</p>
                            <p className="text-sm text-gray-600">{matter.name} • {doc.date}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-3">
                          <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                            doc.status === 'Review Required' ? 'bg-red-100 text-red-800' : 
                            doc.status === 'Filed' ? 'bg-blue-100 text-blue-800' :
                            'bg-green-100 text-green-800'
                          }`}>
                            {doc.status}
                          </span>
                          <button className="text-gray-500 hover:text-gray-700">
                            <Download size={20} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'messages' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Messages</h2>
              
              <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="p-6 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900">Send a Message</h3>
                </div>
                <div className="p-6">
                  <textarea
                    className="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    rows="4"
                    placeholder="Type your message here..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                  />
                  <button
                    onClick={handleSendMessage}
                    className="mt-4 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition"
                  >
                    Send Message
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="p-6 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900">Message History</h3>
                </div>
                <div className="divide-y divide-gray-200">
                  {userData.messages.map(msg => (
                    <div key={msg.id} className="p-6 hover:bg-gray-50 transition">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-medium text-gray-900">{msg.subject}</p>
                          <p className="text-sm text-gray-600">From: {msg.from}</p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-gray-500">{msg.date}</span>
                          {msg.unread && <span className="h-2 w-2 bg-blue-600 rounded-full"></span>}
                        </div>
                      </div>
                      <p className="text-gray-700 mt-2">{msg.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'billing' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Billing & Payments</h2>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Current Balance</h3>
                  <p className="text-3xl font-bold text-gray-900">$0.00</p>
                  <p className="text-sm text-gray-600 mt-2">All payments are up to date</p>
                  <button className="mt-4 w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition">
                    Make a Payment
                  </button>
                </div>

                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Methods</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <DollarSign className="text-gray-600" size={20} />
                        <span className="text-gray-700">Visa ending in 4242</span>
                      </div>
                      <button className="text-blue-600 hover:text-blue-700 text-sm">Edit</button>
                    </div>
                    <button className="w-full text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center justify-center space-x-1 py-2">
                      <Plus size={16} />
                      <span>Add Payment Method</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="p-6 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900">Recent Transactions</h3>
                </div>
                <div className="p-6">
                  <p className="text-gray-600 text-center py-8">No recent transactions</p>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );

  return isLoggedIn ? <Dashboard /> : <LoginScreen />;
};

export default ClientPortal;
