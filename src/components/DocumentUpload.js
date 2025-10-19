import React, { useState, useEffect } from 'react';
import { storage, db } from '../firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { collection, addDoc, query, where, getDocs, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { Upload, FileText, Download, Trash2, Eye, PenTool, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';
import DocumentSigning from './DocumentSigning';

const DocumentUpload = ({ clientId, clientName }) => {
  const [uploading, setUploading] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [signingDocument, setSigningDocument] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  useEffect(() => {
    loadDocuments();
  }, [clientId]);
  
  const loadDocuments = async () => {
    try {
      setLoading(true);
      const documentsQuery = query(
        collection(db, 'documents'),
        where('clientId', '==', clientId)
      );
      const documentsSnapshot = await getDocs(documentsQuery);
      const docs = documentsSnapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      }));
      
      const sortedDocs = docs.sort((a, b) => {
        const dateA = a.uploadDate?.toDate ? a.uploadDate.toDate() : new Date(a.uploadedAt || 0);
        const dateB = b.uploadDate?.toDate ? b.uploadDate.toDate() : new Date(b.uploadedAt || 0);
        return dateB - dateA;
      });
      
      setDocuments(sortedDocs);
    } catch (error) {
      console.error('Error loading documents:', error);
      setError('Failed to load documents');
      setTimeout(() => setError(''), 5000);
    } finally {
      setLoading(false);
    }
  };
  
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (file.type !== 'application/pdf') {
      setError('Please upload only PDF files');
      setTimeout(() => setError(''), 5000);
      return;
    }
    
    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB');
      setTimeout(() => setError(''), 5000);
      return;
    }
    
    setUploading(true);
    setError('');
    setSuccess('');
    
    try {
      const timestamp = Date.now();
      const fileName = `${clientId}/${timestamp}-${file.name}`;
      const storageRef = ref(storage, `client-documents/${fileName}`);
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);
      
      const docData = {
        name: file.name,
        url: downloadURL,
        path: fileName,
        size: `${(file.size / 1024).toFixed(2)} KB`,
        uploadDate: serverTimestamp(),
        uploadedAt: new Date().toISOString(),
        type: 'pdf',
        clientId: clientId,
        clientName: clientName,
        uploadedBy: 'client',
        status: 'pending_review',
        signed: false,
        category: 'client_upload'
      };
      
      await addDoc(collection(db, 'documents'), docData);
      
      setSuccess('Document uploaded successfully');
      setTimeout(() => setSuccess(''), 5000);
      
      await loadDocuments();
      e.target.value = '';
    } catch (error) {
      console.error('Error uploading document:', error);
      setError('Failed to upload document');
      setTimeout(() => setError(''), 5000);
    } finally {
      setUploading(false);
    }
  };
  
  const handleDelete = async (document) => {
    if (!window.confirm(`Are you sure you want to delete "${document.name}"?`)) return;
    
    try {
      const storageRef = ref(storage, `client-documents/${document.path}`);
      await deleteObject(storageRef);
      await deleteDoc(doc(db, 'documents', document.id));
      
      setSuccess('Document deleted successfully');
      setTimeout(() => setSuccess(''), 5000);
      
      await loadDocuments();
    } catch (error) {
      console.error('Error deleting document:', error);
      setError('Failed to delete document');
      setTimeout(() => setError(''), 5000);
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
      setSuccess('Download started');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Error downloading document:', error);
      setError('Failed to download document');
      setTimeout(() => setError(''), 5000);
    }
  };
  
  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Documents</h3>
        <p className="text-center text-gray-500">Loading documents...</p>
      </div>
    );
  }
  
  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-medium text-gray-900">Documents</h3>
          <button
            onClick={loadDocuments}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
            title="Refresh documents"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
        
        {error && (
          <div className="mb-4 flex items-center gap-2 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md">
            <AlertCircle size={20} />
            <span>{error}</span>
          </div>
        )}
        
        {success && (
          <div className="mb-4 flex items-center gap-2 p-3 bg-green-50 border border-green-200 text-green-700 rounded-md">
            <CheckCircle size={20} />
            <span>{success}</span>
          </div>
        )}
        
        <div className="mb-6">
          <input
            type="file"
            accept="application/pdf"
            onChange={handleFileUpload}
            disabled={uploading}
            id="file-upload"
            className="hidden"
          />
          <label
            htmlFor="file-upload"
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg cursor-pointer transition-colors font-medium"
          >
            <Upload size={20} />
            <span>{uploading ? 'Uploading...' : 'Upload PDF'}</span>
          </label>
        </div>
        
        <div className="space-y-3">
          {documents.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
              <p className="text-gray-500">No documents uploaded yet</p>
            </div>
          ) : (
            documents.map(doc => (
              <div
                key={doc.id}
                className="flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg transition-all"
              >
                <div className="flex items-center gap-3 flex-1">
                  <FileText size={20} className="text-blue-600" />
                  <div>
                    <p className="font-medium text-gray-900 flex items-center gap-2">
                      {doc.name}
                      {doc.signed && (
                        <span className="px-2 py-0.5 text-xs bg-green-100 text-green-800 rounded">
                          ✓ Signed
                        </span>
                      )}
                    </p>
                    <span className="text-sm text-gray-600">
                      {doc.size || `${(doc.size / 1024).toFixed(2)} KB`} • 
                      {doc.uploadDate?.toDate ? doc.uploadDate.toDate().toLocaleDateString() : new Date(doc.uploadedAt).toLocaleDateString()}
                      {doc.signedBy && ` • Signed by ${doc.signedBy}`}
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleView(doc)}
                    className="p-2 text-gray-600 hover:text-gray-900 hover:bg-white border border-gray-300 rounded transition-colors"
                    title="View"
                  >
                    <Eye size={16} />
                  </button>
                  <button
                    onClick={() => handleDownload(doc)}
                    className="p-2 text-gray-600 hover:text-gray-900 hover:bg-white border border-gray-300 rounded transition-colors"
                    title="Download"
                  >
                    <Download size={16} />
                  </button>
                  {!doc.signed && (
                    <button
                      onClick={() => setSigningDocument(doc)}
                      className="p-2 text-green-600 hover:text-green-800 hover:bg-white border border-gray-300 rounded transition-colors"
                      title="Sign Document"
                    >
                      <PenTool size={16} />
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(doc)}
                    className="p-2 text-red-600 hover:text-red-800 hover:bg-white border border-gray-300 rounded transition-colors"
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
          user={{ uid: clientId }}
          userProfile={{ 
            firstName: clientName.split(' ')[0], 
            lastName: clientName.split(' ').slice(1).join(' ') || '' 
          }}
          onClose={() => setSigningDocument(null)}
          onSigned={(signedDoc) => {
            loadDocuments();
            setSigningDocument(null);
            setSuccess('Document signed successfully!');
            setTimeout(() => setSuccess(''), 5000);
          }}
        />
      )}
    </div>
  );
};

export default DocumentUpload;
