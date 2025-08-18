const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { PDFDocument, rgb } = require('pdf-lib');
const fetch = require('node-fetch');

admin.initializeApp();

exports.embedSignatureInPDF = functions.https.onCall(async (data, context) => {
  // Remove the authentication check for now to test
  // if (!context.auth) {
  //   throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  // }

  const { documentId, pdfUrl, signatureUrl, placements, signerName, ipAddress } = data;

  try {
    console.log('Starting PDF signature embedding for document:', documentId);
    
    // Download the original PDF
    const pdfResponse = await fetch(pdfUrl);
    const pdfBuffer = await pdfResponse.arrayBuffer();
    
    // Download the signature image
    const signatureResponse = await fetch(signatureUrl);
    const signatureBuffer = await signatureResponse.arrayBuffer();
    
    // Load the PDF
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    
    // Embed the signature image
    const signatureImage = await pdfDoc.embedPng(signatureBuffer);
    const signatureDims = signatureImage.scale(0.5);
    
    // Get pages
    const pages = pdfDoc.getPages();
    
    // Place signatures on each specified location
    for (const placement of placements) {
      const pageIndex = placement.page - 1;
      if (pageIndex >= 0 && pageIndex < pages.length) {
        const page = pages[pageIndex];
        const { width, height } = page.getSize();
        
        // Convert percentage coordinates to actual coordinates
        const x = (placement.x / 100) * width - (signatureDims.width / 2);
        const y = height - ((placement.y / 100) * height) - (signatureDims.height / 2);
        
        // Draw the signature
        page.drawImage(signatureImage, {
          x: x,
          y: y,
          width: signatureDims.width,
          height: signatureDims.height,
        });
        
        // Add timestamp and signer info below signature
        page.drawText(`Signed by: ${signerName}`, {
          x: x,
          y: y - 15,
          size: 8,
          color: rgb(0, 0, 0),
        });
        
        page.drawText(`Date: ${new Date().toLocaleString()}`, {
          x: x,
          y: y - 25,
          size: 8,
          color: rgb(0, 0, 0),
        });
        
        page.drawText(`IP: ${ipAddress}`, {
          x: x,
          y: y - 35,
          size: 8,
          color: rgb(0, 0, 0),
        });
      }
    }
    
    // Save the PDF with embedded signatures
    const signedPdfBytes = await pdfDoc.save();
    
    // Upload the signed PDF to Firebase Storage
    const bucket = admin.storage().bucket();
    const signedFileName = `signed-documents/${documentId}_signed_${Date.now()}.pdf`;
    const file = bucket.file(signedFileName);
    
    await file.save(Buffer.from(signedPdfBytes), {
      metadata: {
        contentType: 'application/pdf',
        metadata: {
          originalDocument: documentId,
          signerName: signerName,
          signedAt: new Date().toISOString(),
          ipAddress: ipAddress,
          signatureCount: placements.length.toString()
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
      message: 'Document signed successfully'
    };
    
  } catch (error) {
    console.error('Error embedding signature:', error);
    throw new functions.https.HttpsError('internal', 'Failed to embed signature in PDF: ' + error.message);
  }
});