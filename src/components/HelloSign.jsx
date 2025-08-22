import React, { useState, useEffect } from 'react';
import { Upload, FileText, Send, Mail, CheckCircle, XCircle, Download, Loader } from 'lucide-react';
import { auth, storage, db } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';

const DocuSign = ({ user }) => {
  const [activeTab, setActiveTab] = useState('upload');
  const [loading, setLoading] = useState(false);
  const [requests, setRequests] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    subject: 'Document for Signature',
    message: 'Please review and sign this document.',
    signerEmail: '',
    signerName: '',
    useEmail: false
  });

  // DocuSign Firebase Functions
  const createSignatureRequest = httpsCallable(functions, 'createSignatureRequest');
  const getSignatureStatus = httpsCallable(functions, 'getSignatureStatus');
  const getSignedDocument = httpsCallable(functions, 'getSignedDocument');
  const listSignatureRequests = httpsCallable(functions, 'listSignatureRequests');
  const cancelSignatureRequest = httpsCallable(functions, 'cancelSignatureRequest');

  // Load signature requests on mount
  useEffect(() => {
    loadRequests();
  }, []);

  // Load signature requests using Firebase Functions
  const loadRequests = async () => {
    if (!user) return;
    
    try {
      const result = await listSignatureRequests();
      if (result.data && result.data.requests) {
        setRequests(result.data.requests);
      }
    } catch (error) {
      console.error('Error loading signature requests:', error);
    }
  };

  // Handle file selection
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file);
      setFormData({ ...formData, title: file.name.replace('.pdf', '') });
    } else {
      alert('Please select a PDF file');
    }
  };

  // Upload file and create signature request
  const handleUploadAndSign = async () => {
    if (!selectedFile || !formData.signerEmail || !formData.signerName) {
      alert('Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      // Upload file to Firebase Storage
      const storageRef = ref(storage, `signature-docs/${Date.now()}_${selectedFile.name}`);
      const snapshot = await uploadBytes(storageRef, selectedFile);
      const fileUrl = await getDownloadURL(snapshot.ref);

      // Create signature request using DocuSign
      const result = await createSignatureRequest({
        ...formData,
        fileUrl: fileUrl
      });

      if (result.data) {
        if (result.data.signUrl && !formData.useEmail) {
          // Open embedded signing
          openEmbeddedSigning(result.data.signUrl);
        } else {
          alert('Signature request sent successfully via email!');
        }
        
        // Reset form
        setSelectedFile(null);
        setFormData({
          title: '',
          subject: 'Document for Signature',
          message: 'Please review and sign this document.',
          signerEmail: '',
          signerName: '',
          useEmail: false
        });
        document.getElementById('file-upload').value = '';
        
        // Reload requests
        loadRequests();
      }
    } catch (error) {
      console.error('Error creating signature request:', error);
      alert('Error creating signature request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Open embedded signing iframe
  const openEmbeddedSigning = (signUrl) => {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    modal.innerHTML = `
      <div class="bg-white rounded-lg w-full max-w-4xl h-5/6 p-4">
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-xl font-semibold">Sign Document</h3>
          <button onclick="this.closest('.fixed').remove()" class="text-gray-500 hover:text-gray-700">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
        <iframe src="${signUrl}" class="w-full h-full border-0"></iframe>
      </div>
    `;
    document.body.appendChild(modal);
    
    // Refresh requests when modal is closed
    setTimeout(() => {
      const closeButton = modal.querySelector('button');
      closeButton.addEventListener('click', () => {
        setTimeout(loadRequests, 1000);
      });
    }, 100);
  };

  // Check signature status
  const checkStatus = async (requestId) => {
    setLoading(true);
    try {
      const result = await getSignatureStatus({ requestId });
      if (result.data) {
        alert(`Status: ${result.data.status}`);
        loadRequests(); // Refresh list
      }
    } catch (error) {
      console.error('Error checking status:', error);
      alert('Error checking status');
    } finally {
      setLoading(false);
    }
  };

  // Download signed document
  const downloadDocument = async (requestId) => {
    setLoading(true);
    try {
      const result = await getSignedDocument({ requestId });
      if (result.data && result.data.downloadUrl) {
        window.open(result.data.downloadUrl, '_blank');
      }
    } catch (error) {
      console.error('Error downloading document:', error);
      alert('Error downloading document');
    } finally {
      setLoading(false);
    }
  };

  // Cancel signature request
  const cancelRequest = async (requestId) => {
    if (!confirm('Are you sure you want to cancel this signature request?')) {
      return;
    }
    
    setLoading(true);
    try {
      await cancelSignatureRequest({ requestId });
      alert('Signature request cancelled successfully');
      loadRequests(); // Refresh list
    } catch (error) {
      console.error('Error cancelling request:', error);
      alert('Error cancelling request');
    } finally {
      setLoading(false);
    }
  };

  // Format date
  const formatDate = (timestamp) => {
    if (!timestamp) return 'Unknown';
    
    // Handle both Firestore timestamp and regular timestamp
    const date = timestamp.seconds ? new Date(timestamp.seconds * 1000) : new Date(timestamp);
    return date.toLocaleString();
  };

  // Get status color
  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'completed':
        return 'text-green-600';
      case 'sent':
        return 'text-blue-600';
      case 'viewed':
        return 'text-yellow-600';
      case 'cancelled':
      case 'declined':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  // Get status icon
  const getStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
      case 'completed':
        return <CheckCircle className="text-green-600" size={20} />;
      case 'cancelled':
      case 'declined':
        return <XCircle className="text-red-600" size={20} />;
      default:
        return <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-bold mb-6">Document Signing</h2>

      {/* Tabs */}
      <div className="flex space-x-4 mb-6 border-b">
        <button
          onClick={() => setActiveTab('upload')}
          className={`pb-2 px-1 ${activeTab === 'upload' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'}`}
        >
          Upload & Sign
        </button>
        <button
          onClick={() => setActiveTab('requests')}
          className={`pb-2 px-1 ${activeTab === 'requests' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'}`}
        >
          Signature Requests
        </button>
      </div>

      {/* Upload & Sign Tab */}
      {activeTab === 'upload' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Upload PDF Document
            </label>
            <input
              id="file-upload"
              type="file"
              accept=".pdf"
              onChange={handleFileSelect}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            {selectedFile && (
              <p className="mt-2 text-sm text-green-600">
                Selected: {selectedFile.name}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Document Title
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="Enter document title"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Signer Name *
              </label>
              <input
                type="text"
                value={formData.signerName}
                onChange={(e) => setFormData({ ...formData, signerName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="John Doe"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Signer Email *
              </label>
              <input
                type="email"
                value={formData.signerEmail}
                onChange={(e) => setFormData({ ...formData, signerEmail: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="john@example.com"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Message to Signer
            </label>
            <textarea
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              rows="3"
              placeholder="Please review and sign this document..."
            />
          </div>

          <div className="flex items-center space-x-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.useEmail}
                onChange={(e) => setFormData({ ...formData, useEmail: e.target.checked })}
                className="mr-2"
              />
              <span className="text-sm">Send via email (instead of embedded signing)</span>
            </label>
          </div>

          <button
            onClick={handleUploadAndSign}
            disabled={!selectedFile || loading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {loading ? (
              <Loader className="animate-spin mr-2" size={20} />
            ) : formData.useEmail ? (
              <Mail className="mr-2" size={20} />
            ) : (
              <Send className="mr-2" size={20} />
            )}
            {loading ? 'Processing...' : formData.useEmail ? 'Send for Signature' : 'Open for Signature'}
          </button>
        </div>
      )}

      {/* Requests Tab */}
      {activeTab === 'requests' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Your Signature Requests</h3>
            <button
              onClick={loadRequests}
              disabled={loading}
              className="text-sm text-blue-600 hover:text-blue-800 disabled:text-gray-400"
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
          
          {requests.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <FileText size={48} className="mx-auto mb-4 text-gray-300" />
              <p>No signature requests yet</p>
              <p className="text-sm mt-2">Upload a document to get started</p>
            </div>
          ) : (
            <div className="space-y-3">
              {requests.map((request) => (
                <div key={request.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h4 className="font-semibold">{request.title || 'Signature Request'}</h4>
                      <p className="text-sm text-gray-600">
                        To: {request.signerName} ({request.signerEmail})
                      </p>
                      <p className="text-sm text-gray-500">
                        Created: {formatDate(request.createdAt)}
                      </p>
                      {request.provider && (
                        <p className="text-xs text-blue-600 mt-1">
                          Provider: {request.provider.toUpperCase()}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(request.status)}
                      <span className={`text-sm font-medium capitalize ${getStatusColor(request.status)}`}>
                        {request.status || 'unknown'}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 flex space-x-2 flex-wrap">
                    <button
                      onClick={() => checkStatus(request.id)}
                      className="text-sm text-blue-600 hover:text-blue-800"
                      disabled={loading}
                    >
                      Check Status
                    </button>
                    {request.status === 'completed' && (
                      <button
                        onClick={() => downloadDocument(request.id)}
                        className="text-sm text-green-600 hover:text-green-800 flex items-center"
                        disabled={loading}
                      >
                        <Download size={14} className="mr-1" />
                        Download
                      </button>
                    )}
                    {request.status !== 'completed' && request.status !== 'cancelled' && (
                      <button
                        onClick={() => cancelRequest(request.id)}
                        className="text-sm text-red-600 hover:text-red-800"
                        disabled={loading}
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DocuSign;