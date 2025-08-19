const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { PDFDocument, rgb } = require('pdf-lib');
const fetch = require('node-fetch');
const crypto = require('crypto');

admin.initializeApp();

exports.embedSignatureInPDFv2 = functions.https.onCall(async (data, context) => {
  // Add logging to debug
  console.log('Function called with context.auth:', !!context.auth);
  
  // Verify authentication
  if (!context.auth) {
    console.error('Authentication failed - no context.auth');
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  console.log('User authenticated:', context.auth.uid);
  const { documentId, pdfUrl, signatureUrl, placements, signerName, ipAddress } = data;

  try {
    console.log('Starting PDF signature embedding for document:', documentId);
    console.log('PDF URL:', pdfUrl);
    console.log('Signature URL:', signatureUrl);
    
    // Download the original PDF
    console.log('Downloading PDF...');
    const pdfResponse = await fetch(pdfUrl);
    if (!pdfResponse.ok) {
      throw new Error(`Failed to download PDF: ${pdfResponse.status} ${pdfResponse.statusText}`);
    }
    const pdfBuffer = await pdfResponse.arrayBuffer();
    console.log('PDF downloaded, size:', pdfBuffer.byteLength);
    
    // Download the signature image
    console.log('Downloading signature...');
    const signatureResponse = await fetch(signatureUrl);
    if (!signatureResponse.ok) {
      throw new Error(`Failed to download signature: ${signatureResponse.status} ${signatureResponse.statusText}`);
    }
    const signatureBuffer = await signatureResponse.arrayBuffer();
    console.log('Signature downloaded, size:', signatureBuffer.byteLength);
    
    // Rest of your existing code continues here...
    // Load the PDF
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    
    // Embed the signature image
    const signatureImage = await pdfDoc.embedPng(signatureBuffer);
    const signatureDims = signatureImage.scale(0.5);
    
    // Add document metadata for court compliance
    pdfDoc.setTitle(`${pdfDoc.getTitle() || 'Document'} - Electronically Signed`);
    pdfDoc.setSubject('Electronically Signed Legal Document');
    pdfDoc.setKeywords(['electronically signed', 'legal document', 'court filing', documentId]);
    pdfDoc.setProducer('Law Firm Client Portal - Electronic Signature System');
    pdfDoc.setCreator(`${signerName} via Electronic Signature`);
    pdfDoc.setModificationDate(new Date());
    
    // Get pages
    const pages = pdfDoc.getPages();
    
    // Generate verification hash
    const verificationHash = crypto
      .createHash('sha256')
      .update(`${documentId}${signerName}${Date.now()}${context.auth.uid}`)
      .digest('hex')
      .substring(0, 10)
      .toUpperCase();
    
    // Place signatures on each specified location
    for (const placement of placements) {
      const pageIndex = placement.page - 1;
      if (pageIndex >= 0 && pageIndex < pages.length) {
        const page = pages[pageIndex];
        const { width, height } = page.getSize();
        
        // Convert percentage coordinates to actual coordinates
        const x = Math.max(10, (placement.x / 100) * width - (signatureDims.width / 2));
        const y = Math.max(50, height - ((placement.y / 100) * height) - (signatureDims.height / 2));
        
        // Draw the signature
        page.drawImage(signatureImage, {
          x: x,
          y: y,
          width: signatureDims.width,
          height: signatureDims.height,
        });
        
        // Add legal signature block below signature
        const fontSize = 7;
        const textColor = rgb(0.2, 0.2, 0.2);
        
        page.drawText(`Electronically signed by: ${signerName}`, {
          x: x,
          y: y - 15,
          size: fontSize,
          color: textColor,
        });
        
        page.drawText(`Date/Time: ${new Date().toLocaleString('en-US', { 
          timeZone: 'America/New_York',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        })} EST`, {
          x: x,
          y: y - 25,
          size: fontSize,
          color: textColor,
        });
        
        page.drawText(`IP Address: ${ipAddress}`, {
          x: x,
          y: y - 35,
          size: fontSize,
          color: textColor,
        });
        
        page.drawText(`Verification: ${verificationHash}`, {
          x: x,
          y: y - 45,
          size: fontSize,
          color: textColor,
        });
        
        // Add legal notice at bottom of page (only on first signature page)
        if (placements.indexOf(placement) === 0) {
          page.drawText(
            'This document has been electronically signed in accordance with the E-Sign Act and UETA.',
            {
              x: 50,
              y: 30,
              size: 6,
              color: rgb(0.4, 0.4, 0.4),
            }
          );
          
          page.drawText(
            `Document ID: ${documentId} | Signer ID: ${context.auth.uid}`,
            {
              x: 50,
              y: 20,
              size: 6,
              color: rgb(0.4, 0.4, 0.4),
            }
          );
        }
      }
    }
    
    // Save the PDF with embedded signatures
    console.log('Saving PDF with signatures...');
    const signedPdfBytes = await pdfDoc.save();
    
    // Upload the signed PDF to Firebase Storage
    const bucket = admin.storage().bucket();
    const signedFileName = `signed-documents/${documentId}_signed_${Date.now()}.pdf`;
    const file = bucket.file(signedFileName);
    
    console.log('Uploading to Firebase Storage...');
    await file.save(Buffer.from(signedPdfBytes), {
      metadata: {
        contentType: 'application/pdf',
        metadata: {
          originalDocument: documentId,
          signerName: signerName,
          signerUID: context.auth.uid,
          signerEmail: context.auth.token?.email || 'Not provided',
          signedAt: new Date().toISOString(),
          ipAddress: ipAddress,
          signatureCount: placements.length.toString(),
          verificationHash: verificationHash,
          legalCompliance: 'E-Sign Act and UETA compliant',
          documentType: 'Legal Document - Court Filing'
        }
      }
    });
    
    // Make the file publicly accessible
    await file.makePublic();
    
    // Get the public URL
    const signedPdfUrl = `https://storage.googleapis.com/${bucket.name}/${signedFileName}`;
    
    console.log('PDF signature embedding completed:', signedPdfUrl);
    
    return {
      success: true,
      signedPdfUrl: signedPdfUrl,
      verificationHash: verificationHash,
      message: 'Document signed successfully and ready for court filing'
    };
    
  } catch (error) {
    console.error('Detailed error in embedSignatureInPDFv2:', error);
    console.error('Error stack:', error.stack);
    throw new functions.https.HttpsError('internal', `Failed to embed signature in PDF: ${error.message}`);
  }
});
