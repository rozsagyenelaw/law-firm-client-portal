import React, { useState, useEffect } from 'react';
import { storage, db } from '../config/firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { doc, updateDoc, arrayUnion, arrayRemove, getDoc } from 'firebase/firestore';
import { Upload, FileText, Download, Trash2, Eye, PenTool, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import DocumentSigning from './DocumentSigning';

const DocumentUpload = ({ clientId, clientName }) => {
  const [uploading, setUploading] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [signingDocument, setSigningDocument] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    loadDocuments();
  }, [clientId]);
  
  const loadDocuments = async () => {
    try {
      setLoading(true);
      const clientRef = doc(db, 'clients', clientId);
      const clientDoc = await getDoc(clientRef);
      if (clientDoc.exists() && clientDoc.data().documents) {
        setDocuments(clientDoc.data().documents);
      } else {
        setDocuments([]);
      }
    } catch (error) {
      console.error('Error loading documents:', error);
      toast.error('Failed to load documents');
    } finally {
      setLoading(false);
    }
  };
  
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Check if it's a PDF
    if (file.type !== 'application/pdf') {
      toast.error('Please upload only PDF files');
      return;
    }
    
    // Check file size (limit to 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }
    
    setUploading(true);
    
    try {
      // Create a unique filename
      const timestamp = Date.now();
      const fileName = `${clientId}/${timestamp}-${file.name}`;
      
      // Create storage reference
      const storageRef = ref(storage, `client-documents/${fileName}`);
      
      // Upload file
      const snapshot = await uploadBytes(storageRef, file);
      
      // Get download URL
      const downloadURL = await getDownloadURL(snapshot.ref);
      
      // Create document metadata
      const docData = {
        id: timestamp.toString(),
        name: file.name,
        url: downloadURL,
        path: fileName,
        size: file.size,
        uploadedAt: new Date().toISOString(),
        type: 'pdf',
        clientId: clientId,
        clientName: clientName,
        signed: false
      };
      
      // Save metadata to Firestore
      const clientRef = doc(db, 'clients', clientId);
      await updateDoc(clientRef, {
        documents: arrayUnion(docData)
      });
      
      // Update local state
      setDocuments([...documents, docData]);
      
      toast.success('Document uploaded successfully');
      
      // Reset file input
      e.target.value = '';
    } catch (error) {
      console.error('Error uploading document:', error);
      toast.error('Failed to upload document');
    } finally {
      setUploading(false);
    }
  };
  
  const handleDelete = async (document) => {
    if (!window.confirm(`Are you sure you want to delete "${document.name}"?`)) return;
    
    try {
      // Delete from Storage
      const storageRef = ref(storage, `client-documents/${document.path}`);
      await deleteObject(storageRef);
      
      // Remove from Firestore
      const clientRef = doc(db, 'clients', clientId);
      await updateDoc(clientRef, {
        documents: arrayRemove(document)
      });
      
      // Update local state
      setDocuments(documents.filter(d => d.id !== document.id));
      
      toast.success('Document deleted successfully');
    } catch (error) {
      console.error('Error deleting document:', error);
      toast.error('Failed to delete document');
    }
  };
  
  const handleView = (document) => {
    window.open(document.url, '_blank');
  };
  
  const handleDownload = async (document) => {
    try {
      const response = await fetch(document.url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = document.name;
      link.click();
      window.URL.revokeObjectURL(url);
      toast.success('Download started');
    } catch (error) {
      console.error('Error downloading document:', error);
      toast.error('Failed to download document');
    }
  };
  
  if (loading) {
    return (
      <div className="document-upload">
        <div className="upload-section">
          <h3>Documents</h3>
          <p className="text-center text-gray-500">Loading documents...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="document-upload">
      <div className="upload-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ margin: 0 }}>Documents</h3>
          <button
            onClick={loadDocuments}
            style={{
              padding: '8px 12px',
              background: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '14px'
            }}
            title="Refresh documents"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
        
        <div className="upload-area">
          <input
            type="file"
            accept="application/pdf"
            onChange={handleFileUpload}
            disabled={uploading}
            id="file-upload"
            style={{ display: 'none' }}
          />
          <label htmlFor="file-upload" className="upload-button">
            {uploading ? (
              <span>Uploading...</span>
            ) : (
              <>
                <Upload size={20} />
                <span>Upload PDF</span>
              </>
            )}
          </label>
        </div>
        
        <div className="documents-list">
          {documents.length === 0 ? (
            <p className="no-documents">No documents uploaded yet</p>
          ) : (
            documents.map(doc => (
              <div key={doc.id} className="document-item">
                <div className="document-info">
                  <FileText size={20} />
                  <div>
                    <p className="document-name">
                      {doc.name}
                      {doc.signed && (
                        <span style={{
                          marginLeft: '8px',
                          padding: '2px 8px',
                          background: '#d4edda',
                          color: '#155724',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: '500'
                        }}>
                          ✓ Signed
                        </span>
                      )}
                    </p>
                    <span className="document-meta">
                      {(doc.size / 1024).toFixed(2)} KB • 
                      {new Date(doc.uploadedAt).toLocaleDateString()}
                      {doc.signedBy && ` • Signed by ${doc.signedBy}`}
                    </span>
                  </div>
                </div>
                
                <div className="document-actions">
                  <button
                    onClick={() => handleView(doc)}
                    className="btn-icon"
                    title="View"
                  >
                    <Eye size={16} />
                  </button>
                  <button
                    onClick={() => handleDownload(doc)}
                    className="btn-icon"
                    title="Download"
                  >
                    <Download size={16} />
                  </button>
                  {!doc.signed && (
                    <button
                      onClick={() => setSigningDocument(doc)}
                      className="btn-icon"
                      title="Sign Document"
                      style={{ color: '#28a745' }}
                    >
                      <PenTool size={16} />
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(doc)}
                    className="btn-icon danger"
                    title="Delete"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      
      {signingDocument && (
        <DocumentSigning
          document={signingDocument}
          clientId={clientId}
          clientName={clientName}
          onClose={() => setSigningDocument(null)}
          onSigned={(signedDoc) => {
            // Reload documents to show the newly signed document
            loadDocuments();
            setSigningDocument(null);
            toast.success('Document signed successfully!');
          }}
        />
      )}
      
      <style jsx>{`
        .document-upload {
          background: white;
          border-radius: 8px;
          padding: 20px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .upload-section h3 {
          font-size: 20px;
          font-weight: 600;
          color: #333;
        }
        
        .upload-area {
          margin: 20px 0;
        }
        
        .upload-button {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 12px 24px;
          background: #007bff;
          color: white;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 500;
          transition: background 0.2s;
        }
        
        .upload-button:hover {
          background: #0056b3;
        }
        
        .upload-button:active {
          transform: scale(0.98);
        }
        
        .documents-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        
        .no-documents {
          text-align: center;
          color: #666;
          padding: 40px 20px;
          background: #f8f9fa;
          border-radius: 6px;
          border: 2px dashed #dee2e6;
        }
        
        .document-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px;
          background: #f8f9fa;
          border: 1px solid #e9ecef;
          border-radius: 6px;
          transition: all 0.2s;
        }
        
        .document-item:hover {
          background: #e9ecef;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        
        .document-info {
          display: flex;
          align-items: center;
          gap: 12px;
          flex: 1;
        }
        
        .document-info svg {
          color: #007bff;
        }
        
        .document-name {
          font-weight: 500;
          color: #333;
          margin: 0 0 4px 0;
          display: flex;
          align-items: center;
        }
        
        .document-meta {
          font-size: 13px;
          color: #666;
        }
        
        .document-actions {
          display: flex;
          gap: 8px;
        }
        
        .btn-icon {
          padding: 8px;
          background: white;
          border: 1px solid #dee2e6;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .btn-icon:hover {
          background: #f8f9fa;
          border-color: #adb5bd;
        }
        
        .btn-icon.danger {
          color: #dc3545;
        }
        
        .btn-icon.danger:hover {
          background: #fff5f5;
          border-color: #dc3545;
        }
      `}</style>
    </div>
  );
};

export default DocumentUpload;
