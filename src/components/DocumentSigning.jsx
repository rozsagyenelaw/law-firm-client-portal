import React, { useState, useRef, useEffect } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { PDFDocument, rgb } from 'pdf-lib';
import { db, storage } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useAuth } from '../contexts/AuthContext';

function DocumentSigning() {
  const [documents, setDocuments] = useState([]);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [signaturePlacements, setSignaturePlacements] = useState([]);
  const [isSigning, setIsSigning] = useState(false);
  const [signedDocumentUrl, setSignedDocumentUrl] = useState(null);
  const sigCanvas = useRef({});
  const { currentUser } = useAuth();

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    // Fetch documents from your database
    // This is a placeholder - adjust based on your actual data structure
    const mockDocuments = [
      { id: '1', name: 'Living Trust Agreement', url: '/sample.pdf' },
      // Add more documents
    ];
    setDocuments(mockDocuments);
  };

  const clearSignature = () => {
    sigCanvas.current.clear();
  };

  const saveSignature = async () => {
    if (sigCanvas.current.isEmpty()) {
      alert('Please provide a signature');
      return;
    }

    setIsSigning(true);
    try {
      // Get signature as data URL
      const signatureDataUrl = sigCanvas.current.getTrimmedCanvas().toDataURL('image/png');
      
      // Convert signature to blob
      const signatureBlob = await fetch(signatureDataUrl).then(r => r.blob());
      
      // Fetch the original PDF
      const pdfResponse = await fetch(selectedDocument.url);
      const pdfArrayBuffer = await pdfResponse.arrayBuffer();
      
      // Load the PDF with pdf-lib
      const pdfDoc = await PDFDocument.load(pdfArrayBuffer);
      
      // Convert signature data URL to bytes
      const signatureImageBytes = await fetch(signatureDataUrl)
        .then(res => res.arrayBuffer());
      
      // Embed the signature image
      const signatureImage = await pdfDoc.embedPng(signatureImageBytes);
      const signatureDims = signatureImage.scale(0.3);
      
      // Get the first page (modify as needed for multi-page)
      const pages = pdfDoc.getPages();
      const firstPage = pages[0];
      const { width, height } = firstPage.getSize();
      
      // Place signature (adjust position as needed)
      firstPage.drawImage(signatureImage, {
        x: width / 2 - signatureDims.width / 2,
        y: 100,
        width: signatureDims.width,
        height: signatureDims.height,
      });
      
      // Add signature metadata
      firstPage.drawText(`Signed by: ${currentUser.displayName || currentUser.email}`, {
        x: width / 2 - 100,
        y: 80,
        size: 10,
        color: rgb(0, 0, 0),
      });
      
      firstPage.drawText(`Date: ${new Date().toLocaleDateString()}`, {
        x: width / 2 - 100,
        y: 65,
        size: 10,
        color: rgb(0, 0, 0),
      });
      
      // Save the PDF
      const pdfBytes = await pdfDoc.save();
      const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
      
      // Upload to Firebase Storage
      const fileName = `signed_${selectedDocument.id}_${Date.now()}.pdf`;
      const storageRef = ref(storage, `signed-documents/${fileName}`);
      const uploadResult = await uploadBytes(storageRef, pdfBlob);
      const downloadUrl = await getDownloadURL(uploadResult.ref);
      
      // Save signature record to Firestore
      await addDoc(collection(db, 'signatures'), {
        documentId: selectedDocument.id,
        documentName: selectedDocument.name,
        signedPdfUrl: downloadUrl,
        signatureImageUrl: signatureDataUrl,
        signedBy: currentUser.email,
        signedAt: serverTimestamp(),
        userId: currentUser.uid,
        ipAddress: await fetch('https://api.ipify.org?format=json')
          .then(r => r.json())
          .then(data => data.ip)
          .catch(() => 'Unknown')
      });
      
      setSignedDocumentUrl(downloadUrl);
      alert('Document signed successfully!');
      
      // Download the signed document
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = fileName;
      link.click();
      
      // Clear and close
      clearSignature();
      setIsModalOpen(false);
      setSelectedDocument(null);
      
    } catch (error) {
      console.error('Error signing document:', error);
      alert('Error signing document. Please try again.');
    } finally {
      setIsSigning(false);
    }
  };

  const openSigningModal = (document) => {
    setSelectedDocument(document);
    setIsModalOpen(true);
  };

  return (
    <div className="document-signing">
      <h2>Documents to Sign</h2>
      
      <div className="documents-list">
        {documents.map(doc => (
          <div key={doc.id} className="document-item">
            <span>{doc.name}</span>
            <button 
              onClick={() => openSigningModal(doc)}
              className="sign-btn"
            >
              Sign Document
            </button>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Sign Document: {selectedDocument?.name}</h3>
            
            <div className="signature-area">
              <p>Please sign below:</p>
              <SignatureCanvas
                ref={sigCanvas}
                canvasProps={{
                  className: 'signature-canvas',
                  width: 500,
                  height: 200,
                  style: { border: '2px solid #000' }
                }}
              />
            </div>

            <div className="modal-actions">
              <button onClick={clearSignature}>Clear</button>
              <button 
                onClick={saveSignature} 
                disabled={isSigning}
                className="save-btn"
              >
                {isSigning ? 'Signing...' : 'Save Signature'}
              </button>
              <button onClick={() => setIsModalOpen(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .document-signing {
          padding: 20px;
        }
        
        .documents-list {
          margin-top: 20px;
        }
        
        .document-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 15px;
          border: 1px solid #ddd;
          margin-bottom: 10px;
          border-radius: 5px;
        }
        
        .sign-btn {
          background: #007bff;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
        }
        
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }
        
        .modal-content {
          background: white;
          padding: 30px;
          border-radius: 10px;
          max-width: 600px;
          width: 90%;
        }
        
        .signature-area {
          margin: 20px 0;
        }
        
        .modal-actions {
          display: flex;
          gap: 10px;
          justify-content: flex-end;
          margin-top: 20px;
        }
        
        .modal-actions button {
          padding: 8px 16px;
          border-radius: 4px;
          border: 1px solid #ddd;
          cursor: pointer;
        }
        
        .save-btn {
          background: #28a745;
          color: white;
          border: none;
        }
        
        .save-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}

export default DocumentSigning;
