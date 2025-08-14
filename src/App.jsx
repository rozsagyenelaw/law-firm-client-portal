import React, { useState } from 'react';

const ClientPortal = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isSignup, setIsSignup] = useState(false);

  if (!isLoggedIn) {
    return (
      <div style={{ padding: '40px', maxWidth: '400px', margin: '0 auto' }}>
        <h1>Law Offices of Rozsa Gyene</h1>
        <h2>{isSignup ? 'Create Account' : 'Client Portal Login'}</h2>
        
        {isSignup && (
          <>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>First Name</label>
              <input 
                type="text"
                placeholder="Enter your first name"
                style={{
                  width: '100%',
                  padding: '10px',
                  fontSize: '16px',
                  border: '1px solid #ccc',
                  borderRadius: '4px'
                }}
              />
            </div>
            
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>Last Name</label>
              <input 
                type="text"
                placeholder="Enter your last name"
                style={{
                  width: '100%',
                  padding: '10px',
                  fontSize: '16px',
                  border: '1px solid #ccc',
                  borderRadius: '4px'
                }}
              />
            </div>
            
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>Phone Number</label>
              <input 
                type="tel"
                placeholder="Enter your phone number"
                style={{
                  width: '100%',
                  padding: '10px',
                  fontSize: '16px',
                  border: '1px solid #ccc',
                  borderRadius: '4px'
                }}
              />
            </div>
          </>
        )}
        
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>Email</label>
          <input 
            type="email"
            placeholder="Enter your email"
            style={{
              width: '100%',
              padding: '10px',
              fontSize: '16px',
              border: '1px solid #ccc',
              borderRadius: '4px'
            }}
          />
        </div>
        
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>Password</label>
          <input 
            type="password"
            placeholder="Enter your password"
            style={{
              width: '100%',
              padding: '10px',
              fontSize: '16px',
              border: '1px solid #ccc',
              borderRadius: '4px'
            }}
          />
        </div>
        
        {isSignup && (
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>Confirm Password</label>
            <input 
              type="password"
              placeholder="Confirm your password"
              style={{
                width: '100%',
                padding: '10px',
                fontSize: '16px',
                border: '1px solid #ccc',
                borderRadius: '4px'
              }}
            />
          </div>
        )}
        
        <button 
          onClick={() => setIsLoggedIn(true)}
          style={{
            width: '100%',
            padding: '10px',
            fontSize: '16px',
            backgroundColor: '#1e3a8a',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          {isSignup ? 'Create Account' : 'Sign In'}
        </button>
        
        <div style={{ marginTop: '20px', textAlign: 'center' }}>
          {isSignup ? (
            <>
              <span>Already have an account? </span>
              <button 
                onClick={() => setIsSignup(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#1e3a8a',
                  textDecoration: 'underline',
                  cursor: 'pointer'
                }}
              >
                Sign In
              </button>
            </>
          ) : (
            <>
              <span>Don't have an account? </span>
              <button 
                onClick={() => setIsSignup(true)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#1e3a8a',
                  textDecoration: 'underline',
                  cursor: 'pointer'
                }}
              >
                Sign Up
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '40px' }}>
      <h1>Welcome to Your Client Portal</h1>
      <p>Law Offices of Rozsa Gyene</p>
      <p>450 N Brand Blvd. Suite 600, Glendale, CA 91203</p>
      <p>Phone: (818) 291-6217 | Email: rozsagyenelaw@yahoo.com</p>
      
      <div style={{ marginTop: '40px' }}>
        <h2>Dashboard</h2>
        <ul>
          <li>Active Matters: 3</li>
          <li>Pending Tasks: 2</li>
          <li>Unread Messages: 1</li>
          <li>Balance Due: $0</li>
        </ul>
      </div>
      
      <button 
        onClick={() => setIsLoggedIn(false)}
        style={{
          marginTop: '20px',
          padding: '10px 20px',
          backgroundColor: '#dc2626',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer'
        }}
      >
        Sign Out
      </button>
    </div>
  );
};

export default ClientPortal;
