import React, { useState } from 'react';
import {
  Upload, X, Send, FileText, Loader, AlertCircle, Trash2
} from 'lucide-react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { storage, db, functions } from '../firebase';
import PdfViewer from './PdfViewer';

const AttorneySignatureSetup = ({ clients, onClose, onSuccess }) => {
  const [step, setStep] = useState(1);
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfUrl, setPdfUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [selectedClient, setSelectedClient] = useState('');
  const [documentTitle, setDocumentTitle] = useState('');
  const [message, setMessage] = useState('Please review and sign this document at your earliest convenience.');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [sendViaEmail, setSendViaEmail] = useState(true);
  const [sendViaSMS, setSendViaSMS] = useState(false);
  const [totalPages, setTotalPages] = useState(1);
  const [signatureFields, setSignatureFields] = useState([]);

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setError('Please select a PDF file');
      return;
    }

    setPdfFile(file);
    setDocumentTitle(file.name.replace('.pdf', ''));
    setUploading(true);
    setError('');

    try {
      const timestamp = Date.now();
      const storageRef = ref(storage, `signature-requests/${timestamp}_${file.name}`);
      const snapshot = await uploadBytes(storageRef, file);
      const url = await getDownloadURL(snapshot.ref);
      setPdfUrl(url);
    } catch (err) {
      console.error('Upload error:', err);
      setError('Failed to upload PDF');
    } finally {
      setUploading(false);
    }
  };

  const handlePageClick = (position) => {
    const newField = {
      id: Date.now(),
      ...position
    };
    setSignatureFields([...signatureFields, newField]);
  };

  const removeSignatureField = (id) => {
    setSignatureFields(signatureFields.filter(f => f.id !== id));
  };

  const handleSendRequest = async (e) => {
    e.preventDefault();

    if (!selectedClient) {
      setError('Please select a client');
      return;
    }

    if (!pdfUrl) {
      setError('Please upload a document first');
      return;
    }

    if (!sendViaEmail && !sendViaSMS) {
      setError('Please select at least one notification method');
      return;
    }

    setSending(true);
    setError('');

    try {
      const client = clients.find(c => c.id === selectedClient);
      if (!client) {
        throw new Error('Client not found');
      }

      const clientName = `${client.firstName} ${client.lastName}`;
      const clientEmail = client.email;
      const clientPhone = client.phone || '';

      const requestData = {
        documentTitle,
        documentUrl: pdfUrl,
        clientId: selectedClient,
        clientName,
        clientEmail,
        clientPhone,
        message,
        signatureFields,
        status: 'pending',
        createdAt: serverTimestamp(),
        signed: false,
        signature: null,
        signedAt: null
      };

      const docRef = await addDoc(collection(db, 'signatureRequests'), requestData);

      try {
        const sendSignatureRequest = httpsCallable(functions, 'sendSignatureRequestNotification');
        await sendSignatureRequest({
          requestId: docRef.id,
          clientName,
          clientEmail,
          clientPhone,
          documentTitle,
          message,
          sendViaEmail,
          sendViaSMS
        });
      } catch (notificationError) {
        console.error('Notification error:', notificationError);
      }

      if (onSuccess) {
        onSuccess();
      }

      alert(`Signature request sent to ${clientName}!${sendViaEmail ? '\n✓ Email notification sent' : ''}${sendViaSMS ? '\n✓ SMS notification sent' : ''}`);

      if (onClose) {
        onClose();
      }
    } catch (err) {
      console.error('Error sending request:', err);
      setError('Failed to send signature request: ' + err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b flex justify-between items-center">
          <div>
            <h3 className="text-xl font-medium text-gray-900">Send Signature Request</h3>
            <p className="text-sm text-gray-500 mt-1">
              Step {step} of 3: {step === 1 ? 'Upload Document' : step === 2 ? 'Mark Signature Fields' : 'Send Request'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-md flex items-center mb-4">
              <AlertCircle className="h-5 w-5 text-red-400 mr-2" />
              <span className="text-red-700">{error}</span>
            </div>
          )}

          {/* Step 1: Upload PDF */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Upload Document (PDF)
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                  <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <label className="cursor-pointer">
                    <span className="text-lg font-medium text-gray-900">Choose PDF to upload</span>
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={handleFileSelect}
                      className="hidden"
                      disabled={uploading}
                    />
                  </label>
                  {pdfFile && (
                    <p className="text-sm text-green-600 mt-2">✓ {pdfFile.name}</p>
                  )}
                  {uploading && (
                    <div className="mt-4 flex items-center justify-center">
                      <Loader className="h-6 w-6 text-blue-600 animate-spin mr-2" />
                      <span className="text-sm text-gray-600">Uploading...</span>
                    </div>
                  )}
                </div>
              </div>

              {pdfUrl && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Document Title</label>
                    <input
                      type="text"
                      value={documentTitle}
                      onChange={(e) => setDocumentTitle(e.target.value)}
                      required
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-900">
                      ✓ PDF uploaded successfully! Click "Next" to mark signature fields.
                    </p>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Step 2: Mark Signature Fields */}
          {step === 2 && pdfUrl && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-900 font-medium">
                  Click on the PDF where you want the client to sign
                </p>
                <p className="text-xs text-blue-700 mt-1">
                  {signatureFields.length} signature field(s) added
                </p>
              </div>

              <div className="text-sm text-gray-600 mb-2">
                Total Pages: {totalPages}
              </div>

              <div className="border border-gray-300 rounded-lg p-4 bg-gray-50 overflow-auto" style={{ maxHeight: '600px' }}>
                <PdfViewer
                  pdfUrl={pdfUrl}
                  onPageClick={handlePageClick}
                  signaturePlacements={signatureFields}
                  onLoadSuccess={(numPages) => setTotalPages(numPages)}
                />
              </div>

              {signatureFields.length > 0 && (
                <div className="border border-gray-200 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Signature Fields:</h4>
                  <div className="space-y-2">
                    {signatureFields.map((field) => (
                      <div key={field.id} className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">
                          Page {field.page} - Position ({field.x.toFixed(0)}%, {field.y.toFixed(0)}%)
                        </span>
                        <button
                          onClick={() => removeSignatureField(field.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Send Request */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700">Select Client</label>
                <select
                  value={selectedClient}
                  onChange={(e) => setSelectedClient(e.target.value)}
                  required
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Choose a client...</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.firstName} {client.lastName} ({client.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Message to Client</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="border-t pt-4">
                <label className="block text-sm font-medium text-gray-700 mb-3">Notification Method</label>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={sendViaEmail}
                      onChange={(e) => setSendViaEmail(e.target.checked)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-700">Send via Email</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={sendViaSMS}
                      onChange={(e) => setSendViaSMS(e.target.checked)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-700">Send via SMS</span>
                  </label>
                </div>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="text-sm font-medium text-green-900 mb-2">Review:</h4>
                <ul className="text-sm text-green-700 space-y-1">
                  <li>• Document: {documentTitle}</li>
                  <li>• Signature Fields: {signatureFields.length}</li>
                  <li>• Notifications: {sendViaEmail && 'Email'}{sendViaEmail && sendViaSMS && ', '}{sendViaSMS && 'SMS'}</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t bg-gray-50 flex justify-between">
          <button
            type="button"
            onClick={() => {
              if (step > 1) {
                setStep(step - 1);
              } else {
                onClose();
              }
            }}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            {step === 1 ? 'Cancel' : 'Back'}
          </button>

          {step < 3 ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={step === 1 && !pdfUrl}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleSendRequest}
              disabled={sending || !pdfUrl || !selectedClient}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center"
            >
              {sending ? (
                <>
                  <Loader className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send Request
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AttorneySignatureSetup;
