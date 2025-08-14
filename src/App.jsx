import React, { useState } from 'react';

const ClientPortal = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isSignup, setIsSignup] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Mock data
  const matters = [
    { id: 1, title: 'Living Trust - Smith Family', type: 'Estate Planning', status: 'In Progress', lastUpdate: '2024-01-15' },
    { id: 2, title: 'Will Amendment - John Doe', type: 'Estate Planning', status: 'Review Required', lastUpdate: '2024-01-10' },
    { id: 3, title: 'Trust Administration - Johnson Estate', type: 'Trust Administration', status: 'Active', lastUpdate: '2024-01-12' }
  ];

  const documents = [
    { id: 1, name: 'Living Trust Draft.pdf', status: 'Review Required', uploadDate: '2024-01-14', size: '2.4 MB' },
    { id: 2, name: 'Asset List.xlsx', status: 'Approved', uploadDate: '2024-01-10', size: '156 KB' },
    { id: 3, name: 'Property Deed.pdf', status: 'Filed', uploadDate: '2024-01-05', size: '4.2 MB' }
  ];

  const messages = [
    { id: 1, from: 'Attorney Rozsa Gyene', subject: 'Document Review Complete', date: '2024-01-15', unread: true },
    { id: 2, from: 'Legal Assistant', subject: 'Appointment Reminder', date: '2024-01-12', unread: false },
    { id: 3, from: 'Attorney Rozsa Gyene', subject: 'Trust Funding Instructions', date: '2024-01-10', unread: false }
  ];

  const statusColor = (status) => {
    switch (status) {
      case 'Active':
      case 'Approved':
      case 'Filed':
        return '#10b981';
      case 'In Progress':
        return '#3b82f6';
      case 'Review Required':
        return '#f97316';
      default:
        return '#6b7280';
    }
  };

  if (!isLoggedIn) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 16px' }}>
        <div style={{ maxWidth: '448px', width: '100%' }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
              <div style={{ width: '48px', height: '48px', backgroundColor: '#1e3a8a', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ color: 'white', fontSize: '24px', fontWeight: 'bold' }}>RG</span>
              </div>
            </div>
            <h2 style={{ fontSize: '30px', fontWeight: 'bold', color: '#111827', marginBottom: '8px' }}>
              {isSignup ? 'Create Your Account' : 'Client Portal Access'}
            </h2>
            <p style={{ fontSize: '14px', color: '#4b5563' }}>
              Law Offices of Rozsa Gyene
            </p>
            <p style={{ fontSize: '12px', color: '#6b7280' }}>
              Estate Planning & Probate
            </p>
          </div>

          <div style={{ backgroundColor: 'white', padding: '32px', borderRadius: '8px', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)' }}>
            {isSignup && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
                      First Name
                    </label>
                    <input
                      type="text"
                      placeholder="First Name"
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '16px',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
                      Last Name
                    </label>
                    <input
                      type="text"
                      placeholder="Last Name"
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '16px',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    placeholder="Phone Number"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '16px',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </>
            )}

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
                Email Address
              </label>
              <input
                type="email"
                placeholder="Email address"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '16px',
                  boxSizing: 'border-box'
                }}
              />
            </div>
            
            <div style={{ marginBottom: '16px', position: 'relative' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
                Password
              </label>
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                style={{
                  width: '100%',
                  padding: '8px 40px 8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '16px',
                  boxSizing: 'border-box'
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '32px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px'
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
                  {showPassword ? (
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1l22 22" />
                  ) : (
                    <>
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </>
                  )}
                </svg>
              </button>
            </div>

            {isSignup && (
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
                  Confirm Password
                </label>
                <input
                  type="password"
                  placeholder="Confirm Password"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '16px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            )}

            {!isSignup && (
              <div style={{ marginBottom: '16px', textAlign: 'right' }}>
                <a href="#" style={{ fontSize: '14px', color: '#2563eb', textDecoration: 'none' }}>
                  Forgot your password?
                </a>
              </div>
            )}

            <button
              onClick={() => setIsLoggedIn(true)}
              style={{
                width: '100%',
                padding: '10px 16px',
                backgroundColor: '#1e3a8a',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '16px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'background-color 0.2s'
              }}
              onMouseOver={(e) => e.target.style.backgroundColor = '#1e40af'}
              onMouseOut={(e) => e.target.style.backgroundColor = '#1e3a8a'}
            >
              {isSignup ? 'Create Account' : 'Sign In'}
            </button>

            <div style={{ marginTop: '20px', textAlign: 'center' }}>
              {isSignup ? (
                <>
                  <span style={{ fontSize: '14px', color: '#4b5563' }}>Already have an account? </span>
                  <button
                    onClick={() => setIsSignup(false)}
                    style={{
                      fontSize: '14px',
                      color: '#2563eb',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      textDecoration: 'underline'
                    }}
                  >
                    Sign in
                  </button>
                </>
              ) : (
                <>
                  <span style={{ fontSize: '14px', color: '#4b5563' }}>Don't have an account? </span>
                  <button
                    onClick={() => setIsSignup(true)}
                    style={{
                      fontSize: '14px',
                      color: '#2563eb',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      textDecoration: 'underline'
                    }}
                  >
                    Sign up
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb' }}>
      {/* Mobile menu button */}
      <div style={{ position: 'fixed', top: '16px', left: '16px', zIndex: 50, display: sidebarOpen ? 'block' : 'none' }}>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          style={{
            padding: '8px',
            borderRadius: '6px',
            backgroundColor: 'white',
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {sidebarOpen ? (
              <path d="M18 6L6 18M6 6l12 12" />
            ) : (
              <path d="M3 12h18M3 6h18M3 18h18" />
            )}
          </svg>
        </button>
      </div>

      {/* Sidebar */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: sidebarOpen ? 0 : '-256px',
        width: '256px',
        height: '100vh',
        backgroundColor: '#1e3a8a',
        transition: 'left 0.3s ease',
        zIndex: 40,
        overflowY: 'auto'
      }}>
        <div style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', color: 'white', marginBottom: '32px' }}>
            <div style={{ width: '32px', height: '32px', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '12px' }}>
              <span style={{ fontWeight: 'bold' }}>RG</span>
            </div>
            <div>
              <h1 style={{ fontSize: '20px', fontWeight: 'bold', margin: 0 }}>Client Portal</h1>
              <p style={{ fontSize: '14px', color: '#93bbfb', margin: 0 }}>Law Offices of Rozsa Gyene</p>
            </div>
          </div>
          
          <nav>
            {[
              { id: 'dashboard', label: 'Dashboard' },
              { id: 'matters', label: 'My Matters' },
              { id: 'documents', label: 'Documents' },
              { id: 'messages', label: 'Messages' },
              { id: 'billing', label: 'Billing' },
              { id: 'profile', label: 'Profile' },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setSidebarOpen(false);
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '12px 16px',
                  marginBottom: '4px',
                  fontSize: '14px',
                  fontWeight: '500',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: activeTab === item.id ? '#1e40af' : 'transparent',
                  color: activeTab === item.id ? 'white' : '#cbd5e1',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => {
                  if (activeTab !== item.id) {
                    e.target.style.backgroundColor = 'rgba(255,255,255,0.1)';
                    e.target.style.color = 'white';
                  }
                }}
                onMouseOut={(e) => {
                  if (activeTab !== item.id) {
                    e.target.style.backgroundColor = 'transparent';
                    e.target.style.color = '#cbd5e1';
                  }
                }}
              >
                {item.label}
              </button>
            ))}
          </nav>
          
          <div style={{ position: 'absolute', bottom: '24px', left: '24px', right: '24px' }}>
            <button
              onClick={() => {
                setIsLoggedIn(false);
                setActiveTab('dashboard');
                setSidebarOpen(false);
              }}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                padding: '12px 16px',
                fontSize: '14px',
                fontWeight: '500',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                backgroundColor: 'transparent',
                color: '#cbd5e1',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => {
                e.target.style.backgroundColor = 'rgba(255,255,255,0.1)';
                e.target.style.color = 'white';
              }}
              onMouseOut={(e) => {
                e.target.style.backgroundColor = 'transparent';
                e.target.style.color = '#cbd5e1';
              }}
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div style={{ marginLeft: window.innerWidth >= 1024 ? '256px' : '0', padding: '32px' }}>
        {activeTab === 'dashboard' && (
          <div>
            <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#111827', marginBottom: '24px' }}>Welcome back!</h2>
            
            {/* Stats cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '24px', marginBottom: '32px' }}>
              <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '8px', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)' }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <div style={{ width: '48px', height: '48px', backgroundColor: '#dbeafe', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '16px' }}>
                    <span style={{ fontSize: '24px' }}>📁</span>
                  </div>
                  <div>
                    <p style={{ fontSize: '14px', fontWeight: '500', color: '#6b7280', margin: 0 }}>Active Matters</p>
                    <p style={{ fontSize: '24px', fontWeight: '600', color: '#111827', margin: 0 }}>3</p>
                  </div>
                </div>
              </div>
              
              <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '8px', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)' }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <div style={{ width: '48px', height: '48px', backgroundColor: '#fed7aa', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '16px' }}>
                    <span style={{ fontSize: '24px' }}>⏰</span>
                  </div>
                  <div>
                    <p style={{ fontSize: '14px', fontWeight: '500', color: '#6b7280', margin: 0 }}>Pending Tasks</p>
                    <p style={{ fontSize: '24px', fontWeight: '600', color: '#111827', margin: 0 }}>2</p>
                  </div>
                </div>
              </div>
              
              <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '8px', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)' }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <div style={{ width: '48px', height: '48px', backgroundColor: '#d1fae5', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '16px' }}>
                    <span style={{ fontSize: '24px' }}>💬</span>
                  </div>
                  <div>
                    <p style={{ fontSize: '14px', fontWeight: '500', color: '#6b7280', margin: 0 }}>Unread Messages</p>
                    <p style={{ fontSize: '24px', fontWeight: '600', color: '#111827', margin: 0 }}>1</p>
                  </div>
                </div>
              </div>
              
              <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '8px', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)' }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <div style={{ width: '48px', height: '48px', backgroundColor: '#e9d5ff', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '16px' }}>
                    <span style={{ fontSize: '24px' }}>💵</span>
                  </div>
                  <div>
                    <p style={{ fontSize: '14px', fontWeight: '500', color: '#6b7280', margin: 0 }}>Balance Due</p>
                    <p style={{ fontSize: '24px', fontWeight: '600', color: '#111827', margin: 0 }}>$0</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent activity */}
            <div style={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)' }}>
              <div style={{ padding: '16px 24px', borderBottom: '1px solid #e5e7eb' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '500', color: '#111827', margin: 0 }}>Recent Activity</h3>
              </div>
              <div style={{ padding: '24px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: '20px', marginRight: '12px' }}>⚠️</span>
                    <div>
                      <p style={{ fontSize: '14px', color: '#111827', margin: 0 }}>Document review required for Living Trust</p>
                      <p style={{ fontSize: '14px', color: '#6b7280', margin: '4px 0 0 0' }}>2 hours ago</p>
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: '20px', marginRight: '12px' }}>✅</span>
                    <div>
                      <p style={{ fontSize: '14px', color: '#111827', margin: 0 }}>Property deed uploaded successfully</p>
                      <p style={{ fontSize: '14px', color: '#6b7280', margin: '4px 0 0 0' }}>1 day ago</p>
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: '20px', marginRight: '12px' }}>💬</span>
                    <div>
                      <p style={{ fontSize: '14px', color: '#111827', margin: 0 }}>New message from Attorney Rozsa Gyene</p>
                      <p style={{ fontSize: '14px', color: '#6b7280', margin: '4px 0 0 0' }}>2 days ago</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'matters' && (
          <div>
            <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#111827', marginBottom: '24px' }}>My Matters</h2>
            <div style={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f9fafb' }}>
                    <th style={{ padding: '12px 24px', textAlign: 'left', fontSize: '12px', fontWeight: '500', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Matter</th>
                    <th style={{ padding: '12px 24px', textAlign: 'left', fontSize: '12px', fontWeight: '500', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Type</th>
                    <th style={{ padding: '12px 24px', textAlign: 'left', fontSize: '12px', fontWeight: '500', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</th>
                    <th style={{ padding: '12px 24px', textAlign: 'left', fontSize: '12px', fontWeight: '500', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Last Update</th>
                  </tr>
                </thead>
                <tbody>
                  {matters.map((matter, index) => (
                    <tr key={matter.id} style={{ borderTop: index !== 0 ? '1px solid #e5e7eb' : 'none' }}>
                      <td style={{ padding: '16px 24px', fontSize: '14px', fontWeight: '500', color: '#111827' }}>{matter.title}</td>
                      <td style={{ padding: '16px 24px', fontSize: '14px', color: '#6b7280' }}>{matter.type}</td>
                      <td style={{ padding: '16px 24px' }}>
                        <span style={{
                          display: 'inline-flex',
                          padding: '2px 10px',
                          fontSize: '12px',
                          fontWeight: '600',
                          borderRadius: '9999px',
                          backgroundColor: statusColor(matter.status) + '20',
                          color: statusColor(matter.status)
                        }}>
                          {matter.status}
                        </span>
                      </td>
                      <td style={{ padding: '16px 24px', fontSize: '14px', color: '#6b7280' }}>{matter.lastUpdate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'documents' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#111827' }}>Documents</h2>
              <button style={{
                display: 'flex',
                alignItems: 'center',
                padding: '8px 16px',
                backgroundColor: '#1e3a8a',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer'
              }}>
                <span style={{ marginRight: '8px' }}>⬆️</span>
                Upload Document
              </button>
            </div>
            
            <div style={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f9fafb' }}>
                    <th style={{ padding: '12px 24px', textAlign: 'left', fontSize: '12px', fontWeight: '500', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Document</th>
                    <th style={{ padding: '12px 24px', textAlign: 'left', fontSize: '12px', fontWeight: '500', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</th>
                    <th style={{ padding: '12px 24px', textAlign: 'left', fontSize: '12px', fontWeight: '500', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Upload Date</th>
                    <th style={{ padding: '12px 24px', textAlign: 'left', fontSize: '12px', fontWeight: '500', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Size</th>
                    <th style={{ padding: '12px 24px', textAlign: 'left', fontSize: '12px', fontWeight: '500', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((doc, index) => (
                    <tr key={doc.id} style={{ borderTop: index !== 0 ? '1px solid #e5e7eb' : 'none' }}>
                      <td style={{ padding: '16px 24px', fontSize: '14px', fontWeight: '500', color: '#111827' }}>{doc.name}</td>
                      <td style={{ padding: '16px 24px' }}>
                        <span style={{
                          display: 'inline-flex',
                          padding: '2px 10px',
                          fontSize: '12px',
                          fontWeight: '600',
                          borderRadius: '9999px',
                          backgroundColor: statusColor(doc.status) + '20',
                          color: statusColor(doc.status)
                        }}>
                          {doc.status}
                        </span>
                      </td>
                      <td style={{ padding: '16px 24px', fontSize: '14px', color: '#6b7280' }}>{doc.uploadDate}</td>
                      <td style={{ padding: '16px 24px', fontSize: '14px', color: '#6b7280' }}>{doc.size}</td>
                      <td style={{ padding: '16px 24px' }}>
                        <button style={{ color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px' }}>
                          ⬇️
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'messages' && (
          <div>
            <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#111827', marginBottom: '24px' }}>Messages</h2>
            <div style={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)' }}>
              {messages.map((message, index) => (
                <div key={message.id} style={{
                  padding: '24px',
                  backgroundColor: message.unread ? '#eff6ff' : 'white',
                  borderTop: index !== 0 ? '1px solid #e5e7eb' : 'none',
                  cursor: 'pointer'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
                        <p style={{ fontSize: '14px', fontWeight: '500', color: '#111827', margin: 0 }}>{message.from}</p>
                        {message.unread && (
                          <span style={{
                            marginLeft: '8px',
                            padding: '2px 8px',
                            fontSize: '12px',
                            fontWeight: '500',
                            backgroundColor: '#3b82f6',
                            color: 'white',
                            borderRadius: '9999px'
                          }}>
                            New
                          </span>
                        )}
                      </div>
                      <p style={{ fontSize: '14px', color: '#111827', margin: '4px 0' }}>{message.subject}</p>
                      <p style={{ fontSize: '14px', color: '#6b7280', margin: '4px 0 0 0' }}>{message.date}</p>
                    </div>
                    <span style={{ fontSize: '20px', color: '#9ca3af' }}>💬</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'billing' && (
          <div>
            <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#111827', marginBottom: '24px' }}>Billing & Payments</h2>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
              <div style={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)', padding: '24px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '500', color: '#111827', marginBottom: '16px' }}>Current Balance</h3>
                <p style={{ fontSize: '36px', fontWeight: 'bold', color: '#111827', margin: '0 0 8px 0' }}>$0.00</p>
                <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '16px' }}>All payments are up to date</p>
                <button style={{
                  width: '100%',
                  padding: '8px 16px',
                  backgroundColor: '#1e3a8a',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}>
                  Make a Payment
                </button>
              </div>
              
              <div style={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)', padding: '24px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '500', color: '#111827', marginBottom: '16px' }}>Payment Methods</h3>
                <div style={{ marginBottom: '12px' }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <div style={{
                        width: '48px',
                        height: '32px',
                        backgroundColor: '#e5e7eb',
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: '12px',
                        fontSize: '12px',
                        fontWeight: '500'
                      }}>
                        VISA
                      </div>
                      <span style={{ fontSize: '14px', color: '#111827' }}>•••• 4242</span>
                    </div>
                    <button style={{ fontSize: '14px', color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer' }}>
                      Edit
                    </button>
                  </div>
                </div>
                <button style={{ fontSize: '14px', color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer' }}>
                  + Add payment method
                </button>
              </div>
            </div>
            
            <div style={{ marginTop: '24px', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)' }}>
              <div style={{ padding: '16px 24px', borderBottom: '1px solid #e5e7eb' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '500', color: '#111827', margin: 0 }}>Transaction History</h3>
              </div>
              <div style={{ padding: '24px' }}>
                <p style={{ fontSize: '14px', color: '#6b7280' }}>No transactions to display</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'profile' && (
          <div>
            <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#111827', marginBottom: '24px' }}>Profile Settings</h2>
            
            <div style={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)', padding: '24px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '500', color: '#111827', marginBottom: '16px' }}>Personal Information</h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
                    First Name
                  </label>
                  <input
                    type="text"
                    defaultValue="John"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '16px'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
                    Last Name
                  </label>
                  <input
                    type="text"
                    defaultValue="Smith"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '16px'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
                    Email
                  </label>
                  <input
                    type="email"
                    defaultValue="john.smith@example.com"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '16px'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
                    Phone
                  </label>
                  <input
                    type="tel"
                    defaultValue="(555) 123-4567"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '16px'
                    }}
                  />
                </div>
              </div>
              
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '500', color: '#111827', marginBottom: '16px' }}>Security</h3>
                <button style={{
                  padding: '8px 16px',
                  backgroundColor: '#f3f4f6',
                  color: '#374151',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}>
                  Change Password
                </button>
              </div>
              
              <div>
                <button style={{
                  padding: '8px 16px',
                  backgroundColor: '#1e3a8a',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}>
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Footer */}
      <div style={{ marginLeft: window.innerWidth >= 1024 ? '256px' : '0', padding: '32px' }}>
        <div style={{ paddingTop: '32px', borderTop: '1px solid #e5e7eb' }}>
          <div style={{ textAlign: 'center', fontSize: '14px', color: '#6b7280' }}>
            <p style={{ fontWeight: '500', margin: '0 0 4px 0' }}>Law Offices of Rozsa Gyene</p>
            <p style={{ margin: '0 0 4px 0' }}>450 N Brand Blvd. Suite 600, Glendale, CA 91203</p>
            <p style={{ margin: 0 }}>Phone: (818) 291-6217 | Email: rozsagyenelaw@yahoo.com</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClientPortal;
