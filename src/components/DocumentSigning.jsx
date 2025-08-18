import React, { useState, useRef, useEffect } from 'react';
import { FileText, PenTool, Check, Download, AlertCircle, Lock, Calendar, User, Hash, X, Loader, ChevronLeft, ChevronRight, MousePointer, Trash2 } from 'lucide-react';
import { doc, addDoc, collection, serverTimestamp, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db, storage } from '../firebase';
import * as pdfjsLib from 'pdfjs-dist';
import PdfViewer from './PdfViewer';

// Set PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

const DocumentSigning = ({ document, user, userProfile, onClose, onSigned }) => {
  const [signature, setSignature] = useState('');
  const [isDrawing, setIsDrawing] = useState(false);
  const [showSigningModal, setShowSigningModal] = useState(false);
  const [showPlacementModal, setShowPlacementModal] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [ipAddress, setIpAddress] = useState('');
  const [isSigning, setIsSigning] = useState(false);
  const [error, setError] = useState('');
  const canvasRef = useRef(null);
  
  // PDF preview states
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [signaturePlacements, setSignaturePlacements] = useState([]);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  
  // Get user's IP for audit trail
  useEffect(() => {
    fetch('https://api.ipify.org?format=json')
      .then(response => response.json())
      .then(data => setIpAddress(data.ip))
      .catch(() => setIpAddress('Unknown'));
  }, []);

  // Initialize canvas when modal opens
  useEffect(() => {
    if (showSigningModal && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Set up drawing context
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }
  }, [showSigningModal]);

  // Load PDF info when placement modal opens
  useEffect(() => {
    if (showPlacementModal && document.url) {
      loadPdfInfo();
    }
  }, [showPlacementModal]);

  // Load PDF page count
  const loadPdfInfo = async () => {
    setIsLoadingPdf(true);
    try {
      const loadingTask = pdfjsLib.getDocument(document.url);
      const pdf = await loadingTask.promise;
      setTotalPages(pdf.numPages);
      setCurrentPage(1);
    } catch (error) {
      console.error('Error loading PDF:', error);
      setError('Failed to load PDF for preview');
    } finally {
      setIsLoadingPdf(false);
    }
  };

  // Handle page navigation
  const goToPage = (pageNum) => {
    if (pageNum >= 1 && pageNum <= totalPages) {
      setCurrentPage(pageNum);
    }
  };

  // Handle clicking on the PDF to place signature
  const handlePdfClick = ({ x, y, page }) => {
    const newPlacement = {
      page: page,
      x: x,
      y: y,
      id: Date.now()
    };
    
    setSignaturePlacements([...signaturePlacements, newPlacement]);
  };

  // Remove a signature placement
  const removePlacement = (id) => {
    setSignaturePlacements(signaturePlacements.filter(p => p.id !== id));
  };
  
  // Canvas drawing functions
  const startDrawing = (e) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    
    const x = e.type.includes('mouse') ? e.clientX - rect.left : e.touches[0].clientX - rect.left;
    const y = e.type.includes('mouse') ? e.clientY - rect.top : e.touches[0].clientY - rect.top;
    
    ctx.beginPath();
    ctx.moveTo(x, y);
  };
  
  const draw = (e) => {
    if (!isDrawing) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    
    const x = e.type.includes('mouse') ? e.clientX - rect.left : e.touches[0].clientX - rect.left;
    const y = e.type.includes('mouse') ? e.clientY - rect.top : e.touches[0].clientY - rect.top;
    
    ctx.lineTo(x, y);
    ctx.stroke();
  };
  
  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false);
      saveSignature();
    }
  };
  
  const clearSignature = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setSignature('');
  };
  
  const saveSignature = () => {
    const canvas = canvasRef.current;
    const signatureData = canvas.toDataURL('image/png');
    setSignature(signatureData);
  };

  // Continue to placement after drawing signature
  const proceedToPlacement = () => {
    if (!signature) {
      setError('Please draw your signature first');
      return;
    }
    
    setShowSigningModal(false);
    setShowPlacementModal(true);
  };
  
  // Generate document hash for integrity
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
      setError('Please provide your signature and agree to the terms');
      return;
    }
    
    if (signaturePlacements.length === 0) {
      setError('Please click on the document where you want to place your signature');
      return;
    }
    
    setIsSigning(true);
    setError('');
    
    try {
      // First, upload the signature image
      const signatureBlob = await fetch(signature).then(r => r.blob());
      const signatureFileName = `signatures/${user.uid}/${document.id}_signature_${Date.now()}.png`;
      const signatureRef = ref(storage, signatureFileName);
      
      const uploadResult = await uploadBytes(signatureRef, signatureBlob);
      const signatureUrl = await getDownloadURL(uploadResult.ref);
      
      // Call Firebase Function to embed signature in PDF
      const functions = getFunctions();
      const embedSignature = httpsCallable(functions, 'embedSignatureInPDF');
      
      const result = await embedSignature({
        documentId: document.id,
        pdfUrl: document.url,
        signatureUrl: signatureUrl,
        placements: signaturePlacements,
        signerName: userProfile ? `${userProfile.firstName} ${userProfile.lastName}` : user.email,
        ipAddress: ipAddress
      });
      
      if (result.data.success) {
        // Create signature record with the signed PDF URL
        const signatureData = {
          documentId: document.id,
          documentName: document.name,
          signerId: user.uid,
          signerName: userProfile ? `${userProfile.firstName} ${userProfile.lastName}` : user.email,
          signerEmail: user.email,
          signatureImage: signatureUrl,
          signaturePlacements: signaturePlacements,
          signedAt: serverTimestamp(),
          ipAddress: ipAddress,
          userAgent: navigator.userAgent,
          documentHash: await generateDocumentHash(document.content || document.name),
          certificationStatement: `I, ${userProfile ? `${userProfile.firstName} ${userProfile.lastName}` : user.email}, certify that I have read and agree to the terms of this document.`,
          esignConsent: true,
          agreedToTerms: true,
          originalDocumentUrl: document.url,
          signedDocumentUrl: result.data.signedPdfUrl // The PDF with embedded signature
        };
        
        // Save signature record
        const signatureRef2 = await addDoc(collection(db, 'signatures'), signatureData);
        
        // Update document with signed PDF URL
        await updateDoc(doc(db, 'documents', document.id), {
          signed: true,
          signatureId: signatureRef2.id,
          signedAt: serverTimestamp(),
          signedDocumentUrl: result.data.signedPdfUrl, // This is the court-ready PDF
          originalDocumentUrl: document.url
        });
        
        // Create audit trail
        await createAuditTrail('DOCUMENT_SIGNED', {
          signatureId: signatureRef2.id,
          method: 'electronic_signature',
          placementMethod: 'click_to_place',
          signaturePlacements: signaturePlacements,
          signedPdfUrl: result.data.signedPdfUrl
        });
        
        // Generate certificate
        await generateCertificate(signatureRef2.id, signatureData);
        
        // Call callback
        if (onSigned) {
          onSigned({
            documentId: document.id,
            signatureId: signatureRef2.id,
            signedAt: new Date(),
            signedDocumentUrl: result.data.signedPdfUrl
          });
        }
        
        setShowPlacementModal(false);
        alert('Document signed successfully! The signed PDF is ready for court filing.');
        
        if (onClose) onClose();
      }
      
    } catch (error) {
      console.error('Error signing document:', error);
      setError('Error signing document. Please try again.');
    } finally {
      setIsSigning(false);
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
      courtCompliance: 'This electronic signature is legally binding and admissible in court proceedings.',
      signedDocumentUrl: signatureData.signedDocumentUrl
    };
    
    await addDoc(collection(db, 'certificates'), certificate);
  };
  
  return (
    <>
      {/* Sign Document Button */}
      {!showSigningModal && !showPlacementModal && (
        <button
          onClick={() => setShowSigningModal(true)}
          className="text-blue-600 hover:text-blue-700 p-2 hover:bg-blue-50 rounded-lg transition-colors"
          title="Sign Document"
        >
          <PenTool className="h-5 w-5" />
        </button>
      )}
      
      {/* Step 1: Signature Drawing Modal */}
      {showSigningModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">Step 1: Draw Your Signature</h3>
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
            
            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md flex items-center">
                <AlertCircle className="h-5 w-5 text-red-400 mr-2" />
                <span className="text-red-700">{error}</span>
              </div>
            )}
            
            {/* Legal Notice */}
            <div className="bg-blue-50 border border-blue-200 rounded p-4 mb-6">
              <div className="flex items-start">
                <Lock className="h-5 w-5 text-blue-600 mr-2 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-blue-900 mb-1">Legal Electronic Signature</p>
                  <p className="text-blue-700">
                    This electronic signature will be legally binding and court-admissible under the ESIGN Act and UETA.
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
                  <User className="h-4 w-4 mr-2 text-gray-500" />
                  <span>{userProfile ? `${userProfile.firstName} ${userProfile.lastName}` : user.email}</span>
                </div>
              </div>
            </div>
            
            {/* Signature Pad */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Draw your signature below
              </label>
              <div className="border-2 border-gray-300 rounded bg-white">
                <canvas
                  ref={canvasRef}
                  width={600}
                  height={200}
                  className="w-full cursor-crosshair"
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={(e) => {
                    e.preventDefault();
                    const touch = e.touches[0];
                    const mouseEvent = new MouseEvent('mousedown', {
                      clientX: touch.clientX,
                      clientY: touch.clientY
                    });
                    canvasRef.current.dispatchEvent(mouseEvent);
                  }}
                  onTouchMove={(e) => {
                    e.preventDefault();
                    const touch = e.touches[0];
                    const mouseEvent = new MouseEvent('mousemove', {
                      clientX: touch.clientX,
                      clientY: touch.clientY
                    });
                    canvasRef.current.dispatchEvent(mouseEvent);
                  }}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    const mouseEvent = new MouseEvent('mouseup', {});
                    canvasRef.current.dispatchEvent(mouseEvent);
                  }}
                  style={{ touchAction: 'none' }}
                />
              </div>
              <button
                onClick={clearSignature}
                className="mt-2 px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50"
              >
                Clear
              </button>
              {signature && (
                <div className="mt-2 text-sm text-green-600 flex items-center">
                  <Check className="h-4 w-4 mr-1" />
                  Signature captured
                </div>
              )}
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
                onClick={proceedToPlacement}
                disabled={!signature || !agreedToTerms}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next: Place Signature
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Signature Placement Modal */}
      {showPlacementModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium text-gray-900">Step 2: Click Where to Place Your Signature</h3>
                <button
                  onClick={() => {
                    setShowPlacementModal(false);
                    setSignaturePlacements([]);
                    if (onClose) onClose();
                  }}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              {error && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md flex items-center">
                  <AlertCircle className="h-5 w-5 text-red-400 mr-2" />
                  <span className="text-red-700">{error}</span>
                </div>
              )}

              <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                <div className="flex items-start">
                  <MousePointer className="h-5 w-5 text-yellow-600 mr-2 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-yellow-900 mb-1">Instructions</p>
                    <p className="text-yellow-700">
                      Navigate to the page with the signature line and click where you want to place your signature.
                      You can place multiple signatures if needed.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* PDF Preview Area */}
            <div className="flex-1 overflow-auto p-6 bg-gray-100">
              {isLoadingPdf ? (
                <div className="flex items-center justify-center h-full">
                  <Loader className="h-8 w-8 animate-spin text-gray-400" />
                </div>
              ) : (
                <div className="max-w-4xl mx-auto">
                  <PdfViewer
                    pdfUrl={document.url}
                    pageNumber={currentPage}
                    onPageClick={handlePdfClick}
                    signaturePlacements={signaturePlacements}
                  />
                </div>
              )}
            </div>

            {/* Bottom Controls */}
            <div className="p-6 border-t bg-white">
              {/* Page Navigation */}
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="flex items-center px-3 py-2 border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </button>
                
                <div className="text-sm text-gray-600">
                  Page {currentPage} of {totalPages}
                </div>
                
                <button
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="flex items-center px-3 py-2 border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </button>
              </div>

              {/* Signature Placements Summary */}
              {signaturePlacements.length > 0 && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-green-800">
                      <strong>{signaturePlacements.length} signature(s) placed</strong>
                    </p>
                    <button
                      onClick={() => setSignaturePlacements([])}
                      className="text-sm text-red-600 hover:text-red-700 flex items-center"
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Clear all
                    </button>
                  </div>
                  <div className="mt-2 text-xs text-green-700">
                    {signaturePlacements.map((p, i) => (
                      <span key={p.id}>
                        Page {p.page}
                        {i < signaturePlacements.length - 1 ? ', ' : ''}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-between">
                <button
                  onClick={() => {
                    setShowPlacementModal(false);
                    setShowSigningModal(true);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Back to Signature
                </button>
                
                <button
                  onClick={handleSign}
                  disabled={signaturePlacements.length === 0 || isSigning}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  {isSigning ? (
                    <>
                      <Loader className="h-4 w-4 mr-2 animate-spin" />
                      Signing...
                    </>
                  ) : (
                    'Complete Signing'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default DocumentSigning;