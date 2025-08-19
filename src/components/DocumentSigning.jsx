import React, { useState } from 'react';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { db, storage } from '../firebase';
import { collection, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { PenTool, MousePointer, X } from 'lucide-react';

const DocumentSigning = ({ document, user, userProfile, onClose, onSigned }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [step, setStep] = useState(1); // Step 1: Type name, Step 2: Place signature
  const [isSigning, setIsSigning] = useState(false);
  const [typedName, setTypedName] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [signaturePosition, setSignaturePosition] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);

  const handlePdfClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100; // Percentage
    const y = ((e.clientY - rect.top) / rect.height) * 100; // Percentage
    
    setSignaturePosition({ x, y, page: currentPage });
  };

  const proceedToPlacement = () => {
    if (!typedName.trim()) {
      alert('Please type your full legal name');
      return;
    }
    if (!agreedToTerms) {
      alert('Please agree to the terms');
      return;
    }
    setStep(2);
  };

  const handleSign = async () => {
    if (!signaturePosition) {
      alert('Please click on the document where you want to place your signature');
      return;
    }

    setIsSigning(true);

    try {
      // Fetch or create PDF
      let pdfBytes;
      if (document.url) {
        const response = await fetch(document.url);
        pdfBytes = await response.arrayBuffer();
      } else {
        const pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage([612, 792]);
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        page.drawText(document.name || 'Document', {
          x: 50,
          y: 700,
          size: 20,
          font: font,
        });
        pdfBytes = await pdfDoc.save();
      }

      // Load the PDF
      const pdfDoc = await PDFDocument.load(pdfBytes);
      
      // Get the specific page
      const pages = pdfDoc.getPages();
      const pageIndex = signaturePosition.page - 1;
      
      if (pageIndex >= 0 && pageIndex < pages.length) {
        const page = pages[pageIndex];
        const { width, height } = page.getSize();
        
        // Convert percentage position to actual coordinates
        const actualX = (signaturePosition.x / 100) * width;
        const actualY = height - ((signaturePosition.y / 100) * height); // PDF Y is from bottom
        
        // Embed fonts
        const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const helveticaBoldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        
        // Draw signature line
        page.drawLine({
          start: { x: actualX - 50, y: actualY },
          end: { x: actualX + 100, y: actualY },
          thickness: 1,
          color: rgb(0, 0, 0),
        });
        
        // Draw the typed name as signature
        page.drawText(typedName, {
          x: actualX - 40,
          y: actualY + 10,
          size: 20,
          font: helveticaBoldFont,
          color: rgb(0, 0, 0.8),
        });
        
        // Add signature details below
        page.drawText('Electronically Signed by:', {
          x: actualX - 40,
          y: actualY - 15,
          size: 8,
          font: helveticaFont,
          color: rgb(0, 0, 0),
        });
        
        page.drawText(typedName, {
          x: actualX - 40,
          y: actualY - 25,
          size: 10,
          font: helveticaBoldFont,
          color: rgb(0, 0, 0),
        });
        
        const email = user?.email || 'Not provided';
        page.drawText(`Email: ${email}`, {
          x: actualX - 40,
          y: actualY - 35,
          size: 8,
          font: helveticaFont,
          color: rgb(0, 0, 0),
        });
        
        const now = new Date();
        const dateStr = now.toLocaleDateString('en-US');
        page.drawText(`Date: ${dateStr}`, {
          x: actualX - 40,
          y: actualY - 45,
          size: 8,
          font: helveticaFont,
          color: rgb(0, 0, 0),
        });
        
        // Get IP
        let ipAddress = 'Not recorded';
        try {
          const ipResponse = await fetch('https://api.ipify.org?format=json');
          const ipData = await ipResponse.json();
          ipAddress = ipData.ip;
        } catch (e) {
          console.log('Could not get IP');
        }
        
        page.drawText(`IP: ${ipAddress}`, {
          x: actualX - 40,
          y: actualY - 55,
          size: 8,
          font: helveticaFont,
          color: rgb(0, 0, 0),
        });
      }
      
      // Set PDF metadata
      const now = new Date();
      pdfDoc.setTitle(`${document.name} - Electronically Signed`);
      pdfDoc.setAuthor(typedName);
      pdfDoc.setSubject('Electronically Signed Legal Document');
      pdfDoc.setProducer('Law Firm Client Portal');
      pdfDoc.setModificationDate(now);
      
      // Save the PDF
      const signedPdfBytes = await pdfDoc.save();
      const pdfBlob = new Blob([signedPdfBytes], { type: 'application/pdf' });
      
      // Generate filename
      const timestamp = Date.now();
      const fileName = `signed_${document.id}_${timestamp}.pdf`;
      
      // Upload to Firebase Storage
      const storageRef = ref(storage, `signed-documents/${fileName}`);
      await uploadBytes(storageRef, pdfBlob, {
        contentType: 'application/pdf',
        customMetadata: {
          signerName: typedName,
          signerEmail: user?.email || '',
          signedAt: now.toISOString(),
          documentId: document.id
        }
      });
      
      const downloadUrl = await getDownloadURL(storageRef);
      
      // Save to Firestore
      await addDoc(collection(db, 'signatures'), {
        documentId: document.id,
        documentName: document.name,
        signedPdfUrl: downloadUrl,
        signerName: typedName,
        signerEmail: user?.email || '',
        signedAt: serverTimestamp(),
        signaturePosition: signaturePosition,
        userId: user?.uid,
        courtReady: true
      });
      
      // Download the signed PDF
      const link = document.createElement('a');
      link.href = URL.createObjectURL(pdfBlob);
      link.download = `${document.name}_signed.pdf`;
      link.click();
      
      alert('✅ Document signed successfully! The signed PDF has been downloaded.');
      
      // Callback and close
      if (onSigned) {
        onSigned({
          documentId: document.id,
          signedAt: new Date(),
          signedDocumentUrl: downloadUrl
        });
      }
      
      setIsModalOpen(false);
      setStep(1);
      setSignaturePosition(null);
      if (onClose) onClose();
      
    } catch (error) {
      console.error('Error signing:', error);
      alert('Error signing document. Please try again.');
    } finally {
      setIsSigning(false);
    }
  };

  return (
    <>
      {/* Sign Button */}
      <button
        onClick={() => setIsModalOpen(true)}
        className="text-blue-600 hover:text-blue-700 p-2 hover:bg-blue-50 rounded-lg transition-colors"
        title="Sign Document"
      >
        <PenTool className="h-5 w-5" />
      </button>

      {/* Signing Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
            
            {/* Step 1: Enter Name */}
            {step === 1 && (
              <div className="p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  Step 1: Enter Your Signature
                </h3>
                
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Type your full legal name
                  </label>
                  <input
                    type="text"
                    value={typedName}
                    onChange={(e) => setTypedName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="John Smith"
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    This will appear as your signature on the document
                  </p>
                </div>
                
                <div className="mb-6">
                  <label className="flex items-start">
                    <input
                      type="checkbox"
                      checked={agreedToTerms}
                      onChange={(e) => setAgreedToTerms(e.target.checked)}
                      className="mt-1 mr-2"
                    />
                    <span className="text-sm text-gray-700">
                      I agree that my typed name is the legal equivalent of my handwritten 
                      signature and this document is legally binding.
                    </span>
                  </label>
                </div>
                
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={proceedToPlacement}
                    disabled={!typedName.trim() || !agreedToTerms}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    Next: Choose Location
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Click to Place Signature */}
            {step === 2 && (
              <>
                <div className="p-6 border-b">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-medium text-gray-900">
                      Step 2: Click Where to Place Your Signature
                    </h3>
                    <button
                      onClick={() => {
                        setIsModalOpen(false);
                        setStep(1);
                        setSignaturePosition(null);
                      }}
                      className="text-gray-400 hover:text-gray-500"
                    >
                      <X className="h-6 w-6" />
                    </button>
                  </div>
                  
                  <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md flex items-center">
                    <MousePointer className="h-5 w-5 text-blue-600 mr-2" />
                    <span className="text-sm text-blue-900">
                      Click on the document below where you want your signature to appear
                    </span>
                  </div>
                </div>

                <div className="p-6 bg-gray-100" style={{ height: '500px', overflow: 'auto' }}>
                  {/* PDF Preview */}
                  <div className="bg-white shadow-lg mx-auto" style={{ maxWidth: '800px' }}>
                    {document.url ? (
                      <div className="relative">
                        <iframe
                          src={document.url}
                          className="w-full"
                          style={{ height: '600px', border: 'none' }}
                          title="PDF Document"
                        />
                        
                        {/* Clickable overlay */}
                        <div 
                          className="absolute inset-0 cursor-crosshair"
                          onClick={handlePdfClick}
                          style={{ backgroundColor: 'rgba(0,0,0,0.01)' }}
                        >
                          {signaturePosition && (
                            <div
                              className="absolute border-2 border-green-500 bg-green-50 bg-opacity-50 pointer-events-none"
                              style={{
                                left: `${signaturePosition.x}%`,
                                top: `${signaturePosition.y}%`,
                                transform: 'translate(-50%, -50%)',
                                padding: '10px 20px'
                              }}
                            >
                              <span className="text-green-700 font-medium">
                                {typedName}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="p-12 text-center text-gray-500">
                        <p>Preview not available</p>
                        <p className="text-sm mt-2">Click anywhere to place signature</p>
                      </div>
                    )}
                  </div>
                  
                  {/* Page navigation */}
                  <div className="mt-4 flex justify-center items-center space-x-4">
                    <button
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      className="px-3 py-1 border rounded hover:bg-gray-50"
                    >
                      Previous Page
                    </button>
                    <span className="text-sm text-gray-600">
                      Page {currentPage} - Scroll in PDF to see all pages
                    </span>
                    <button
                      onClick={() => setCurrentPage(currentPage + 1)}
                      className="px-3 py-1 border rounded hover:bg-gray-50"
                    >
                      Next Page
                    </button>
                  </div>
                </div>

                <div className="p-6 border-t bg-white">
                  {signaturePosition && (
                    <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded">
                      <p className="text-sm text-green-800">
                        ✓ Signature position selected on page {signaturePosition.page}
                      </p>
                    </div>
                  )}
                  
                  <div className="flex justify-between">
                    <button
                      onClick={() => setStep(1)}
                      className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleSign}
                      disabled={!signaturePosition || isSigning}
                      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                    >
                      {isSigning ? 'Signing...' : 'Complete Signing'}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default DocumentSigning;
