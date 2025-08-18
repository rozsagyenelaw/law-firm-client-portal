const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { PDFDocument, rgb } = require("pdf-lib");
const fetch = require("node-fetch");

admin.initializeApp();

exports.embedSignatureInPDF = functions.https.onCall(async (data, context) => {
  // Verify user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be authenticated");
  }

  try {
    const { documentId, pdfUrl, signatureUrl, placements, signerName, ipAddress } = data;
    
    // Fetch the PDF and signature image
    const pdfBytes = await fetch(pdfUrl).then(res => res.arrayBuffer());
    const signatureBytes = await fetch(signatureUrl).then(res => res.arrayBuffer());
    
    // Load the PDF
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();
    
    // Embed the signature image
    const signatureImage = await pdfDoc.embedPng(signatureBytes);
    
    // Add signature to each placement location
    for (const placement of placements) {
      if (placement.page <= pages.length) {
        const page = pages[placement.page - 1];
        const { width, height } = page.getSize();
        
        // Convert percentage to actual coordinates
        const x = (placement.x / 100) * width;
        const y = height - ((placement.y / 100) * height);
        
        // Draw signature
        page.drawImage(signatureImage, {
          x: x - 75, // Center the 150px wide signature
          y: y - 25, // Center the 50px tall signature
          width: 150,
          height: 50,
        });
        
        // Add signer name below signature
        page.drawText(signerName, {
          x: x - 75,
          y: y - 40,
          size: 10,
          color: rgb(0, 0, 0),
        });
        
        // Add date
        page.drawText(new Date().toLocaleDateString(), {
          x: x - 75,
          y: y - 55,
          size: 10,
          color: rgb(0, 0, 0),
        });
      }
    }
    
    // Add certification on last page
    const lastPage = pages[pages.length - 1];
    const certText = `Electronically signed by ${signerName} on ${new Date().toLocaleString()} | IP: ${ipAddress}`;
    lastPage.drawText(certText, {
      x: 50,
      y: 30,
      size: 8,
      color: rgb(0.5, 0.5, 0.5),
    });
    
    // Save the signed PDF
    const signedPdfBytes = await pdfDoc.save();
    
    // Upload to Firebase Storage
    const bucket = admin.storage().bucket();
    const fileName = `signed_documents/${context.auth.uid}/${documentId}_signed_${Date.now()}.pdf`;
    const file = bucket.file(fileName);
    
    await file.save(Buffer.from(signedPdfBytes), {
      metadata: {
        contentType: "application/pdf",
      },
    });
    
    // Get the download URL
    const [url] = await file.getSignedUrl({
      action: "read",
      expires: "03-01-2500", // Far future date
    });
    
    return { 
      success: true, 
      signedPdfUrl: url,
      fileName: fileName, 
    };
    
  } catch (error) {
    console.error("Error embedding signature:", error);
    throw new functions.https.HttpsError("internal", "Failed to embed signature");
  }
});