import React, { useState, useEffect, useRef } from 'react';
import { Shield, FileText, AlertCircle, CheckCircle, Loader, Trash2, X } from 'lucide-react';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import * as pdfjsLib from 'pdfjs-dist';

// Set worker
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

// PDF Viewer component with signature field overlays
const PdfViewerWithSignatures = ({ pdfUrl, signatureFields, signedFields, onSignField }) => {
  const containerRef = useRef(null);
  const [pdf, setPdf] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [renderedPages, setRenderedPages] = useState([]);
  const canvasRefs = useRef([]);

  useEffect(() => {
    loadPdf();
  }, [pdfUrl]);

  useEffect(() => {
    if (pdf) {
      renderAllPages();
    }
  }, [pdf]);

  const loadPdf = async () => {
    setLoading(true);
    setError(null);
    try {
      const loadingTask = pdfjsLib.getDocument(pdfUrl);
      const pdfDoc = await loadingTask.promise;
      setPdf(pdfDoc);
      setLoading(false);
    } catch (error) {
      console.error('Error loading PDF:', error);
      setError(error.message);
      setLoading(false);
    }
  };

  const renderAllPages = async () => {
    if (!pdf) return;

    const numPages = pdf.numPages;
    const pages = [];

    canvasRefs.current = Array(numPages).fill(null).map(() => React.createRef());

    for (let i = 1; i <= numPages; i++) {
      pages.push({ pageNum: i });
    }

    setRenderedPages(pages);

    setTimeout(async () => {
      for (let i = 1; i <= numPages; i++) {
        await renderPage(i);
      }
    }, 100);
  };

  const renderPage = async (pageNum) => {
    if (!pdf) return;

    try {
      const page = await pdf.getPage(pageNum);
      const canvas = canvasRefs.current[pageNum - 1];
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      const viewport = page.getViewport({ scale: 1.5 });

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const renderContext = {
        canvasContext: ctx,
        viewport: viewport
      };

      await page.render(renderContext).promise;
    } catch (error) {
      console.error(`Error rendering page ${pageNum}:`, error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading PDF...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-12 border border-red-300 bg-red-50 rounded">
        <div className="text-center">
          <p className="text-red-600 font-medium">Error loading PDF</p>
          <p className="text-red-500 text-sm mt-2">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="space-y-4">
      {renderedPages.map((pageInfo, index) => {
        const pageNum = pageInfo.pageNum;
        const pageSignatures = signatureFields.filter(f => f.page === pageNum);

        return (
          <div key={pageNum} className="relative inline-block">
            <div className="absolute top-2 left-2 bg-blue-900 text-white px-2 py-1 rounded text-xs font-medium z-10">
              Page {pageNum}
            </div>

            <canvas
              ref={el => canvasRefs.current[index] = el}
              className="border border-gray-300 block"
            />

            {/* Signature fields for this page */}
            {pageSignatures.map((field) => {
              const fieldIndex = signatureFields.indexOf(field);
              return (
                <div
                  key={fieldIndex}
                  className="absolute cursor-pointer"
                  style={{
                    left: `${field.x}%`,
                    top: `${field.y}%`,
                    transform: 'translate(-50%, -50%)'
                  }}
                  onClick={() => onSignField(fieldIndex)}
                >
                  {signedFields[fieldIndex] ? (
                    <div className="relative">
                      <img
                        src={signedFields[fieldIndex]}
                        alt="Signature"
                        className="border-2 border-green-500 bg-white rounded"
                        style={{ width: '150px', height: '50px' }}
                      />
                      <div className="absolute -top-2 -right-2 bg-green-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs">
                        ✓
                      </div>
                    </div>
                  ) : (
                    <div className="border-2 border-blue-500 bg-blue-50 hover:bg-blue-100 rounded px-4 py-2 flex items-center justify-center transition-colors" style={{ width: '150px', height: '50px' }}>
                      <span className="text-blue-700 text-sm font-medium">Click to Sign</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};

const ClientSignaturePage = () => {
  const [loading, setLoading] = useState(true);
  const [signatureRequest, setSignatureRequest] = useState(null);
  const [error, setError] = useState('');
  const [signing, setSigning] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const canvasRef = useRef(null);
  const [signatureData, setSignatureData] = useState(null);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [currentFieldIndex, setCurrentFieldIndex] = useState(0);
  const [signedFields, setSignedFields] = useState([]);

  useEffect(() => {
    const fetchSignatureRequest = async () => {
      try {
        // Get the request ID from the URL path
        const pathParts = window.location.pathname.split('/');
        const requestId = pathParts[pathParts.length - 1];

        if (!requestId || requestId === 'sign') {
          setError('Invalid signature request link');
          setLoading(false);
          return;
        }

        // Fetch the signature request from Firestore
        const docRef = doc(db, 'signatureRequests', requestId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setSignatureRequest({ id: docSnap.id, ...docSnap.data() });
        } else {
          setError('Signature request not found');
        }
      } catch (err) {
        console.error('Error fetching signature request:', err);
        setError('Failed to load signature request');
      } finally {
        setLoading(false);
      }
    };

    fetchSignatureRequest();
  }, []);

  // Signature canvas handlers
  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setIsDrawing(true);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    if (canvasRef.current) {
      setSignatureData(canvasRef.current.toDataURL());
    }
  };

  // Touch event handlers for mobile devices
  const startDrawingTouch = (e) => {
    e.preventDefault(); // Prevent scrolling
    const touch = e.touches[0];
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;

    setIsDrawing(true);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const drawTouch = (e) => {
    if (!isDrawing) return;
    e.preventDefault(); // Prevent scrolling

    const touch = e.touches[0];
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.stroke();
  };

  const stopDrawingTouch = (e) => {
    e.preventDefault();
    stopDrawing();
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignatureData(null);
  };

  const handleSignField = (fieldIndex) => {
    setCurrentFieldIndex(fieldIndex);
    setShowSignatureModal(true);
    // Clear previous signature when opening modal
    setTimeout(() => {
      if (canvasRef.current) {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setSignatureData(null);
      }
    }, 100);
  };

  const handleApplySignature = () => {
    if (!signatureData) {
      alert('Please draw your signature first');
      return;
    }

    // Add this signature to the signed fields
    const newSignedFields = [...signedFields];
    newSignedFields[currentFieldIndex] = signatureData;
    setSignedFields(newSignedFields);
    setShowSignatureModal(false);
    setSignatureData(null);
  };

  const handleSubmitAllSignatures = async () => {
    // Check if all fields are signed
    const totalFields = signatureRequest.signatureFields?.length || 0;
    if (signedFields.filter(s => s).length !== totalFields) {
      alert(`Please sign all ${totalFields} required field(s) before submitting.`);
      return;
    }

    setSigning(true);
    try {
      // First, generate the signed PDF with embedded signatures
      const { httpsCallable } = await import('firebase/functions');
      const { functions } = await import('../firebase');

      const generateSignedPdf = httpsCallable(functions, 'generateSignedPdf');

      console.log('Generating signed PDF...');
      const result = await generateSignedPdf({
        originalPdfUrl: signatureRequest.documentUrl,
        signatures: signedFields,
        signatureFields: signatureRequest.signatureFields,
        requestId: signatureRequest.id
      });

      const signedPdfUrl = result.data.signedPdfUrl;
      console.log('Signed PDF generated:', signedPdfUrl);

      // Update Firestore with signed status and signed PDF URL
      const docRef = doc(db, 'signatureRequests', signatureRequest.id);
      await updateDoc(docRef, {
        signed: true,
        signatures: signedFields,
        signedPdfUrl: signedPdfUrl,
        signedAt: serverTimestamp(),
        status: 'signed'
      });

      setSignatureRequest({
        ...signatureRequest,
        signed: true,
        signatures: signedFields,
        signedPdfUrl: signedPdfUrl,
        signedAt: new Date()
      });

      alert('Document signed successfully! Thank you.');
    } catch (err) {
      console.error('Error signing document:', err);
      alert('Failed to sign document. Please try again. Error: ' + err.message);
    } finally {
      setSigning(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Shield className="h-12 w-12 text-blue-900 animate-pulse mx-auto mb-4" />
          <p className="text-gray-600">Loading your document...</p>
        </div>
      </div>
    );
  }

  if (error || !signatureRequest) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Unable to Load Document</h2>
            <p className="text-gray-600 mb-6">
              {error || 'The signature request you are looking for could not be found.'}
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-900 font-medium mb-2">Need Help?</p>
              <p className="text-sm text-blue-700">
                Please contact our office for assistance
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show the signature request details
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center mb-4">
            <Shield className="h-8 w-8 text-blue-900 mr-3" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Document Signature Request</h1>
              <p className="text-sm text-gray-600">Law Offices of Rozsa Gyene</p>
            </div>
          </div>

          {signatureRequest.signed ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center">
              <CheckCircle className="h-6 w-6 text-green-600 mr-3" />
              <div>
                <p className="font-medium text-green-900">Document Already Signed</p>
                <p className="text-sm text-green-700">
                  This document was signed on {signatureRequest.signedAt?.toDate().toLocaleDateString()}
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-900">
                <strong>Status:</strong> Awaiting your signature ({signedFields.filter(s => s).length} of {signatureRequest.signatureFields?.length || 0} signed)
              </p>
            </div>
          )}
        </div>

        {/* Document Info */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <FileText className="h-5 w-5 mr-2" />
            {signatureRequest.documentTitle}
          </h2>

          {signatureRequest.message && (
            <div className="mb-4">
              <p className="text-sm font-medium text-gray-600">Message from Attorney:</p>
              <p className="text-gray-900 bg-blue-50 border border-blue-200 rounded p-3 mt-2">{signatureRequest.message}</p>
            </div>
          )}

          <p className="text-sm text-gray-600">
            Please review the document below and click on each signature field to sign.
          </p>
        </div>

        {/* PDF with Signature Fields */}
        {!signatureRequest.signed && signatureRequest.documentUrl && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Document for Signature</h3>
            <div className="border border-gray-300 rounded-lg p-4 bg-gray-50 overflow-auto" style={{ maxHeight: '800px' }}>
              <PdfViewerWithSignatures
                pdfUrl={signatureRequest.documentUrl}
                signatureFields={signatureRequest.signatureFields || []}
                signedFields={signedFields}
                onSignField={handleSignField}
              />
            </div>

            {/* Submit Button */}
            <div className="mt-6 flex justify-center">
              <button
                onClick={handleSubmitAllSignatures}
                disabled={signing || signedFields.filter(s => s).length !== (signatureRequest.signatureFields?.length || 0)}
                className="flex items-center px-8 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-lg font-medium"
              >
                {signing ? (
                  <>
                    <Loader className="h-5 w-5 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-5 w-5 mr-2" />
                    Submit Signed Document
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Already Signed - Show Signed Document */}
        {signatureRequest.signed && signatureRequest.documentUrl && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Signed Document</h3>
            <a
              href={signatureRequest.documentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-4 py-2 bg-blue-900 text-white rounded-md hover:bg-blue-800 transition-colors"
            >
              <FileText className="h-4 w-4 mr-2" />
              View Signed Document
            </a>
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-gray-500">
          <p>© {new Date().getFullYear()} Law Offices of Rozsa Gyene. All rights reserved.</p>
          <p className="mt-1">Estate Planning & Probate Attorney</p>
        </div>
      </div>

      {/* Signature Modal */}
      {showSignatureModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">Draw Your Signature</h3>
              <button
                onClick={() => setShowSignatureModal(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <p className="text-sm text-gray-600 mb-4">
              Please sign in the box below using your mouse or touchscreen:
            </p>

            <div className="border-2 border-gray-300 rounded-lg bg-white mb-4">
              <canvas
                ref={canvasRef}
                width={700}
                height={200}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawingTouch}
                onTouchMove={drawTouch}
                onTouchEnd={stopDrawingTouch}
                className="w-full cursor-crosshair"
                style={{ touchAction: 'none' }}
              />
            </div>

            <div className="flex justify-between">
              <button
                onClick={clearSignature}
                className="flex items-center px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Clear
              </button>
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowSignatureModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApplySignature}
                  disabled={!signatureData}
                  className="flex items-center px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Apply Signature
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientSignaturePage;
