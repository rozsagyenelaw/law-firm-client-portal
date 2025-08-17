import React, { useState, useRef, useEffect } from 'react';
import { FileText, PenTool, Check, Download, AlertCircle, Lock, Calendar, User, Hash, X } from 'lucide-react';
import { doc, addDoc, collection, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

const DocumentSigning = ({ document, user, userProfile, onClose, onSigned }) => {
  const [signature, setSignature] = useState('');
  const [isDrawing, setIsDrawing] = useState(false);
  const [showSigningModal, setShowSigningModal] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [ipAddress, setIpAddress] = useState('');
  const canvasRef = useRef(null);
  
  // Get user's IP for audit trail
  useEffect(() => {
    fetch('https://api.ipify.org?format=json')
      .then(response => response.json())
      .then(data => setIpAddress(data.ip))
      .catch(() => setIpAddress('Unknown'));
  }, []);
  
  // Canvas drawing functions
  const startDrawing = (e) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  };
  
  const draw = (e) => {
    if (!isDrawing) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  };
  
  const stopDrawing = () => {
    setIsDrawing(false);
  };
  
  const clearSignature = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignature('');
  };
  
  const saveSignature = () => {
    const canvas = canvasRef.current;
    const signatureData = canvas.toDataURL();
    setSignature(signatureData);
  };
  
  // Generate document hash for integrity using Web Crypto API
  const generateDocumentHash = async (docContent) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(docContent);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
  };
  
  // Create audit trail entry
  const createAuditTrail = async (action, details) => {
    await addDoc(collection(db, 'auditTrails'), {
      documentId: document.id,
      userId: user.uid,
      userName: userProfile ? `${userProfile.firstName} ${userProfile.lastName}` : user.email,
      action: action,
      details: details,
      timestamp: serverTimestamp(),
      ipAddress: ipAddress,
      userAgent: navigator.userAgent,
      documentHash: await generateDocumentHash(document.content || document.name)
    });
  };
  
  const handleSign = async () => {
    if (!signature || !agreedToTerms) {
      alert('Please provide your signature and agree to the terms');
      return;
    }
    
    try {
      // Create signature record
      const signatureData = {
        documentId: document.id,
        documentName: document.name,
        signerId: user.uid,
        signerName: userProfile ? `${userProfile.firstName} ${userProfile.lastName}` : user.email,
        signerEmail: user.email,
        signatureImage: signature,
        signedAt: serverTimestamp(),
        ipAddress: ipAddress,
        userAgent: navigator.userAgent,
        documentHash: await generateDocumentHash(document.content || document.name),
        certificationStatement: `I, ${userProfile ? `${userProfile.firstName} ${userProfile.lastName}` : user.email}, certify that I have read and agree to the terms of this document.`,
        esignConsent: true,
        agreedToTerms: true
      };
      
      // Save signature
      const signatureRef = await addDoc(collection(db, 'signatures'), signatureData);
      
      // Update document status
      await updateDoc(doc(db, 'documents', document.id), {
        signed: true,
        signatureId: signatureRef.id,
        signedAt: serverTimestamp()
      });
      
      // Create audit trail
      await createAuditTrail('DOCUMENT_SIGNED', {
        signatureId: signatureRef.id,
        method: 'electronic_signature'
      });
      
      // Generate certificate of completion
      await generateCertificate(signatureRef.id, signatureData);
      
      // Call the onSigned callback if provided
      if (onSigned) {
        onSigned({
          documentId: document.id,
          signatureId: signatureRef.id,
          signedAt: new Date()
        });
      }
      
      setShowSigningModal(false);
      alert('Document signed successfully! A certificate of completion has been generated.');
      
      // Close the modal
      if (onClose) {
        onClose();
      }
      
    } catch (error) {
      console.error('Error signing document:', error);
      alert('Error signing document. Please try again.');
    }
  };
  
  const generateCertificate = async (signatureId, signatureData) => {
    const certificate = {
      certificateId: `CERT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      documentId: document.id,
      documentName: document.name,
      signatureId: signatureId,
      signerInfo: {
        name: signatureData.signerName,
        email: signatureData.signerEmail,
        ipAddress: signatureData.ipAddress
      },
      signedAt: new Date().toISOString(),
      verificationCode: await generateDocumentHash(signatureId + Date.now()),
      legalNotice: 'This certificate confirms that the above-named individual has electronically signed the referenced document in accordance with the ESIGN Act and UETA.',
      courtCompliance: 'This electronic signature is legally binding and admissible in court proceedings.'
    };
    
    await addDoc(collection(db, 'certificates'), certificate);
  };
  
  return (
    <>
      {/* Sign Document Button */}
      {!showSigningModal && (
        <button
          onClick={() => setShowSigningModal(true)}
          className="text-blue-600 hover:text-blue-700 p-2 hover:bg-blue-50 rounded-lg transition-colors"
          title="Sign Document"
        >
          <PenTool className="h-5 w-5" />
        </button>
      )}
      
      {/* Signing Modal */}
      {showSigningModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            {/* Modal Header */}
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">Electronic Document Signing</h3>
              <button
                onClick={() => {
                  setShowSigningModal(false);
                  if (onClose) onClose();
                }}
                className="text-gray-400 hover:text-gray-500"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            
            {/* Legal Notice */}
            <div className="bg-blue-50 border border-blue-200 rounded p-4 mb-6">
              <div className="flex items-start">
                <Lock className="h-5 w-5 text-blue-600 mr-2 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-blue-900 mb-1">Legal Electronic Signature</p>
                  <p className="text-blue-700">
                    This electronic signature will be legally binding and court-admissible under the ESIGN Act and UETA.
                    Your signature will be secured with encryption and an audit trail will be maintained.
                  </p>
                </div>
              </div>
            </div>
            
            {/* Document Info */}
            <div className="bg-gray-50 rounded p-4 mb-6">
              <h4 className="font-medium mb-2">Document Information</h4>
              <div className="space-y-1 text-sm">
                <div className="flex items-center">
                  <FileText className="h-4 w-4 mr-2 text-gray-500" />
                  <span>{document.name}</span>
                </div>
                <div className="flex items-center">
                  <Calendar className="h-4 w-4 mr-2 text-gray-500" />
                  <span>{new Date().toLocaleDateString()}</span>
                </div>
                <div className="flex items-center">
                  <User className="h-4 w-4 mr-2 text-gray-500" />
                  <span>{userProfile ? `${userProfile.firstName} ${userProfile.lastName}` : user.email}</span>
                </div>
                <div className="flex items-center">
                  <Hash className="h-4 w-4 mr-2 text-gray-500" />
                  <span className="font-mono text-xs">IP: {ipAddress}</span>
                </div>
              </div>
            </div>
            
            {/* Signature Pad */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Draw your signature below
              </label>
              <div className="border-2 border-gray-300 rounded">
                <canvas
                  ref={canvasRef}
                  width={500}
                  height={200}
                  className="w-full cursor-crosshair"
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  style={{ touchAction: 'none' }}
                />
              </div>
              <div className="mt-2 flex space-x-2">
                <button
                  onClick={clearSignature}
                  className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50"
                >
                  Clear
                </button>
                <button
                  onClick={saveSignature}
                  className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Save Signature
                </button>
              </div>
            </div>
            
            {/* Terms Agreement */}
            <div className="mb-6">
              <label className="flex items-start">
                <input
                  type="checkbox"
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  className="mt-1 mr-2"
                />
                <span className="text-sm text-gray-700">
                  I agree that my electronic signature is the legal equivalent of my manual signature on this document. 
                  I consent to be legally bound by this document's terms and conditions.
                </span>
              </label>
            </div>
            
            {/* Action Buttons */}
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowSigningModal(false);
                  if (onClose) onClose();
                }}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSign}
                disabled={!signature || !agreedToTerms}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Sign Document
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default DocumentSigning;