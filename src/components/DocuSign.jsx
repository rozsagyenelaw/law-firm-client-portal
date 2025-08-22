// src/components/DocuSign.jsx
import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  updateDoc,
  addDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { db, auth, functions } from '../firebase';
import { httpsCallable, connectFunctionsEmulator } from 'firebase/functions';
import { Upload, FileText, Send, CheckCircle, Clock, X, Eye, RefreshCw } from 'lucide-react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';

function DocuSign({ user }) {
  const [activeTab, setActiveTab] = useState('upload');
  const [documents, setDocuments] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    signerName: '',
    signerEmail: '',
    message: 'Please review and sign this document.',
    sendViaEmail: false
  });

  useEffect(() => {
    if (!user) return;

    // Listen to DocuSign requests
    const q = query(
      collection(db, 'docusignRequests'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const reqs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setRequests(reqs);
    }, (error) => {
      console.error('Error loading DocuSign requests:', error);
    });

    return () => unsubscribe();
  }, [user]);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
      setUploadFile(file);
    } else {
      alert('Please select a PDF file');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!uploadFile) {
      alert('Please select a PDF file');
      return;
    }

    setLoading(true);
    try {
      // Make sure user is authenticated
      if (!auth.currentUser) {
        throw new Error('You must be logged in to create signature requests');
      }

      // Get the ID token to ensure authentication
      const idToken = await auth.currentUser.getIdToken();
      console.log('User authenticated:', auth.currentUser.uid);

      // Upload PDF to Firebase Storage
      const storageRef = ref(storage, `signatures/${user.uid}/${Date.now()}_${uploadFile.name}`);
      const snapshot = await uploadBytes(storageRef, uploadFile);
      const fileUrl = await getDownloadURL(snapshot.ref);

      // Create DocuSign envelope
      const createEnvelope = httpsCallable(functions, 'createSignatureRequest');
      const result = await createEnvelope({
        title: formData.title || uploadFile.name,
        subject: `Please sign: ${formData.title || uploadFile.name}`,
        message: formData.message,
        signerEmail: formData.signerEmail,
        signerName: formData.signerName,
        fileUrl: fileUrl,
        useEmail: formData.sendViaEmail
      });

      if (result.data.requestId) {
        // Save request to Firestore
        await addDoc(collection(db, 'docusignRequests'), {
          userId: user.uid,
          envelopeId: result.data.requestId,
          documentTitle: formData.title || uploadFile.name,
          signerName: formData.signerName,
          signerEmail: formData.signerEmail,
          status: 'sent',
          createdAt: serverTimestamp(),
          embeddedUrl: result.data.signUrl || null
        });

        alert('Document sent for signature successfully!');
        
        // Reset form
        setFormData({
          title: '',
          signerName: '',
          signerEmail: '',
          message: 'Please review and sign this document.',
          sendViaEmail: false
        });
        setUploadFile(null);
        
        // Reset file input
        const fileInput = document.querySelector('input[type="file"]');
        if (fileInput) fileInput.value = '';
        
        // If embedded signing, open the signing URL
        if (!formData.sendViaEmail && result.data.signUrl) {
          window.open(result.data.signUrl, '_blank');
        }
      } else {
        throw new Error('Failed to create signature request');
      }
    } catch (error) {
      console.error('Error creating signature request:', error);
      alert(`Failed to create signature request: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const checkStatus = async (envelopeId, requestId) => {
    try {
      const getStatus = httpsCallable(functions, 'getSignatureStatus');
      const result = await getStatus({ requestId: envelopeId });
      
      if (result.data) {
        // Update status in Firestore
        await updateDoc(doc(db, 'docusignRequests', requestId), {
          status: result.data.status,
          lastChecked: serverTimestamp()
        });
        alert(`Document status: ${result.data.status}`);
      }
    } catch (error) {
      console.error('Error checking status:', error);
      alert(`Failed to check status: ${error.message}`);
    }
  };

  const getStatusIcon = (status) => {
    switch(status?.toLowerCase()) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'sent':
      case 'delivered':
        return <Clock className="w-5 h-5 text-yellow-500" />;
      case 'declined':
      case 'voided':
        return <X className="w-5 h-5 text-red-500" />;
      default:
        return <FileText className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusText = (status) => {
    if (!status) return 'Pending';
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Document Signing</h1>

      {/* Tabs */}
      <div className="flex space-x-1 mb-6 border-b">
        <button
          onClick={() => setActiveTab('upload')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'upload'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Upload & Sign
        </button>
        <button
          onClick={() => setActiveTab('requests')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'requests'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Signature Requests ({requests.length})
        </button>
      </div>

      {/* Upload Tab */}
      {activeTab === 'upload' && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* File Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Upload PDF Document
              </label>
              <div className="flex items-center space-x-4">
                <label className="cursor-pointer bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2">
                  <Upload className="w-5 h-5" />
                  <span>Choose File</span>
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={handleFileSelect}
                    className="hidden"
                    required
                  />
                </label>
                <span className="text-gray-600">
                  {uploadFile ? uploadFile.name : 'No file chosen'}
                </span>
              </div>
            </div>

            {/* Document Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Document Title
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
                placeholder="Enter document title"
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Signer Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Signer Name *
                </label>
                <input
                  type="text"
                  value={formData.signerName}
                  onChange={(e) => setFormData({...formData, signerName: e.target.value})}
                  placeholder="John Doe"
                  required
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Signer Email *
                </label>
                <input
                  type="email"
                  value={formData.signerEmail}
                  onChange={(e) => setFormData({...formData, signerEmail: e.target.value})}
                  placeholder="john@example.com"
                  required
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Message */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Message to Signer
              </label>
              <textarea
                value={formData.message}
                onChange={(e) => setFormData({...formData, message: e.target.value})}
                rows={3}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Send Options */}
            <div className="flex items-center">
              <input
                type="checkbox"
                id="sendViaEmail"
                checked={formData.sendViaEmail}
                onChange={(e) => setFormData({...formData, sendViaEmail: e.target.checked})}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="sendViaEmail" className="ml-2 text-sm text-gray-700">
                Send via email (instead of embedded signing)
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !uploadFile}
              className={`w-full py-3 px-4 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2 ${
                loading || !uploadFile
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  <span>Open for Signature</span>
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {/* Requests Tab */}
      {activeTab === 'requests' && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Signature Requests</h2>
          
          {requests.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No signature requests yet</p>
          ) : (
            <div className="space-y-4">
              {requests.map((request) => (
                <div key={request.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">{request.documentTitle}</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        Signer: {request.signerName} ({request.signerEmail})
                      </p>
                      <p className="text-sm text-gray-500 mt-1">
                        Created: {request.createdAt?.toDate?.()?.toLocaleDateString() || 'Recently'}
                      </p>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center space-x-1">
                        {getStatusIcon(request.status)}
                        <span className="text-sm font-medium">{getStatusText(request.status)}</span>
                      </div>
                      <button
                        onClick={() => checkStatus(request.envelopeId, request.id)}
                        className="text-blue-600 hover:text-blue-800 transition-colors"
                        title="Check Status"
                      >
                        <RefreshCw className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default DocuSign;