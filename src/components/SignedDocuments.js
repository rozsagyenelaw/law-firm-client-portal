import React from 'react';
import { FileCheck, Download, Calendar, User, Eye } from 'lucide-react';
import toast from 'react-hot-toast';

const SignedDocuments = ({ documents }) => {
  // Filter for signed documents
  const signedDocs = documents.filter(doc => 
    doc.signed === true || doc.signedBy || doc.name.includes('SIGNED') || doc.name.includes('CLIENT-SIGNED')
  );

  const handleDownload = async (doc) => {
    try {
      const response = await fetch(doc.url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = doc.name;
      link.click();
      window.URL.revokeObjectURL(url);
      toast.success('Download started');
    } catch (error) {
      console.error('Error downloading document:', error);
      toast.error('Failed to download document');
    }
  };

  if (signedDocs.length === 0) {
    return (
      <div style={{
        padding: '30px',
        textAlign: 'center',
        background: '#f8f9fa',
        borderRadius: '8px',
        border: '2px dashed #dee2e6'
      }}>
        <FileCheck size={48} color="#6c757d" style={{ marginBottom: '15px' }} />
        <p style={{ margin: 0, color: '#6c757d' }}>
          No signed documents yet. When you sign documents, they'll appear here.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h3 style={{ 
        marginBottom: '20px', 
        display: 'flex', 
        alignItems: 'center', 
        gap: '10px',
        fontSize: '20px',
        fontWeight: '600'
      }}>
        <FileCheck size={24} color="#28a745" />
        Signed Documents ({signedDocs.length})
      </h3>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        {signedDocs.map((doc) => (
          <div
            key={doc.id}
            style={{
              padding: '20px',
              background: 'white',
              border: '2px solid #28a745',
              borderRadius: '8px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                marginBottom: '10px'
              }}>
                <FileCheck size={20} color="#28a745" />
                <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '500' }}>{doc.name}</h4>
                <span style={{
                  padding: '2px 8px',
                  background: '#d4edda',
                  color: '#155724',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: '500'
                }}>
                  ✓ Signed
                </span>
              </div>
              
              <div style={{
                display: 'flex',
                gap: '20px',
                fontSize: '14px',
                color: '#666'
              }}>
                {doc.signedBy && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <User size={14} />
                    <span>Signed by: {doc.signedBy}</span>
                  </div>
                )}
                {doc.signedAt && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Calendar size={14} />
                    <span>On: {new Date(doc.signedAt).toLocaleDateString()}</span>
                  </div>
                )}
                {doc.size && (
                  <div style={{ fontSize: '13px' }}>
                    {(doc.size / 1024).toFixed(2)} KB
                  </div>
                )}
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => window.open(doc.url, '_blank')}
                style={{
                  padding: '8px 16px',
                  background: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '14px',
                  fontWeight: '500',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#0056b3';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#007bff';
                }}
              >
                <Eye size={16} />
                View
              </button>
              <button
                onClick={() => handleDownload(doc)}
                style={{
                  padding: '8px 16px',
                  background: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '14px',
                  fontWeight: '500',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#218838';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#28a745';
                }}
              >
                <Download size={16} />
                Download
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SignedDocuments;
