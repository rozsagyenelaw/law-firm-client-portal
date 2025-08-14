import React, { useState } from 'react';

const TestInput = () => {
  const [value1, setValue1] = useState('');
  const [value2, setValue2] = useState('');
  const [value3, setValue3] = useState('');

  return (
    <div style={{ padding: '40px', fontFamily: 'Arial, sans-serif' }}>
      <h1>Input Field Test</h1>
      
      <div style={{ marginBottom: '20px' }}>
        <p>Test 1: Basic uncontrolled input (no React state)</p>
        <input 
          type="text" 
          placeholder="Type here - uncontrolled"
          style={{
            width: '300px',
            padding: '10px',
            fontSize: '16px',
            border: '2px solid #ccc'
          }}
        />
      </div>

      <div style={{ marginBottom: '20px' }}>
        <p>Test 2: Controlled input with inline onChange</p>
        <input 
          type="text" 
          placeholder="Type here - controlled"
          value={value1}
          onChange={(e) => setValue1(e.target.value)}
          style={{
            width: '300px',
            padding: '10px',
            fontSize: '16px',
            border: '2px solid #ccc'
          }}
        />
        <p>Value: {value1}</p>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <p>Test 3: Password field</p>
        <input 
          type="password" 
          placeholder="Password"
          value={value2}
          onChange={(e) => setValue2(e.target.value)}
          style={{
            width: '300px',
            padding: '10px',
            fontSize: '16px',
            border: '2px solid #ccc'
          }}
        />
        <p>Length: {value2.length}</p>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <p>Test 4: No styles at all</p>
        <input 
          type="text" 
          placeholder="Plain input"
          value={value3}
          onChange={(e) => setValue3(e.target.value)}
        />
        <p>Value: {value3}</p>
      </div>

      <div style={{ marginTop: '40px', padding: '20px', backgroundColor: '#f0f0f0' }}>
        <h3>Debug Info:</h3>
        <p>React Version: {React.version}</p>
        <p>User Agent: {navigator.userAgent}</p>
      </div>
    </div>
  );
};

export default TestInput;
