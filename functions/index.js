const functions = require('firebase-functions');
const admin = require('firebase-admin');
const cors = require('cors')({origin: true});

// Initialize admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// Helper function to initialize HelloSign SDK
const getHelloSignClient = () => {
  const apiKey = functions.config().hellosign?.apikey;
  if (!apiKey) {
    throw new Error('HelloSign API key not configured');
  }
  return require('hellosign-sdk')({ key: apiKey });
};

// Create a signature request for uploaded PDF
exports.createSignatureRequest = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      // Check authentication
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const idToken = authHeader.split('Bearer ')[1];
      
      // Verify the Firebase ID token
      let decodedToken;
      try {
        decodedToken = await admin.auth().verifyIdToken(idToken);
      } catch (error) {
        console.error('Token verification failed:', error);
        return res.status(401).json({ error: 'Invalid token' });
      }

      const hellosign = getHelloSignClient();
      const { 
        title, 
        subject, 
        message, 
        signerEmail, 
        signerName, 
        fileUrl,
        useEmail = false 
      } = req.body;

      console.log('Creating signature request for:', signerEmail);

      const opts = {
        test_mode: 1, // Set to 0 for production
        title: title,
        subject: subject,
        message: message,
        signers: [
          {
            email_address: signerEmail,
            name: signerName
          }
        ],
        file_url: [fileUrl]
      };

      // Add client ID for embedded signing
      if (!useEmail) {
        const clientId = functions.config().hellosign?.clientid;
        if (clientId) {
          opts.client_id = clientId;
        }
      }

      const result = await hellosign.signatureRequest.send(opts);

      // Save request info to Firestore
      await db.collection('signatureRequests').doc(result.signature_request.signature_request_id).set({
        requestId: result.signature_request.signature_request_id,
        title: title,
        signerEmail: signerEmail,
        signerName: signerName,
        status: 'sent',
        createdBy: decodedToken.uid,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        useEmail: useEmail,
        signatures: result.signature_request.signatures
      });

      // If embedded signing, get the sign URL
      if (!useEmail && result.signature_request.signatures && result.signature_request.signatures[0]) {
        const signatureId = result.signature_request.signatures[0].signature_id;
        const embeddedResult = await hellosign.embedded.getSignUrl(signatureId);
        
        return res.status(200).json({
          success: true,
          requestId: result.signature_request.signature_request_id,
          signUrl: embeddedResult.embedded.sign_url,
          expiresAt: embeddedResult.embedded.expires_at
        });
      }

      return res.status(200).json({
        success: true,
        requestId: result.signature_request.signature_request_id,
        message: 'Signature request sent via email'
      });

    } catch (error) {
      console.error('Error creating signature request:', error);
      return res.status(500).json({ error: error.message });
    }
  });
});

// Create signature request from template
exports.createTemplateRequest = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      // Check authentication
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const idToken = authHeader.split('Bearer ')[1];
      
      // Verify the Firebase ID token
      let decodedToken;
      try {
        decodedToken = await admin.auth().verifyIdToken(idToken);
      } catch (error) {
        console.error('Token verification failed:', error);
        return res.status(401).json({ error: 'Invalid token' });
      }

      const hellosign = getHelloSignClient();
      const { 
        templateId, 
        signerEmail, 
        signerName,
        customFields = {},
        useEmail = false
      } = req.body;

      console.log('Creating template signature request for:', signerEmail);

      const opts = {
        test_mode: 1, // Set to 0 for production
        template_id: templateId,
        subject: 'Document for Signature',
        message: 'Please sign this document.',
        signers: [
          {
            email_address: signerEmail,
            name: signerName,
            role: 'Client' // Adjust based on your template
          }
        ]
      };

      // Add custom fields if provided
      if (Object.keys(customFields).length > 0) {
        opts.custom_fields = Object.entries(customFields).map(([key, value]) => ({
          name: key,
          value: value
        }));
      }

      // Add client ID for embedded signing
      if (!useEmail) {
        const clientId = functions.config().hellosign?.clientid;
        if (clientId) {
          opts.client_id = clientId;
        }
      }

      const result = await hellosign.signatureRequest.sendWithTemplate(opts);

      // Save to Firestore
      await db.collection('signatureRequests').doc(result.signature_request.signature_request_id).set({
        requestId: result.signature_request.signature_request_id,
        templateId: templateId,
        signerEmail: signerEmail,
        signerName: signerName,
        status: 'sent',
        createdBy: decodedToken.uid,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        useEmail: useEmail,
        signatures: result.signature_request.signatures
      });

      // If embedded signing, get the sign URL
      if (!useEmail && result.signature_request.signatures && result.signature_request.signatures[0]) {
        const signatureId = result.signature_request.signatures[0].signature_id;
        const embeddedResult = await hellosign.embedded.getSignUrl(signatureId);
        
        return res.status(200).json({
          success: true,
          requestId: result.signature_request.signature_request_id,
          signUrl: embeddedResult.embedded.sign_url,
          expiresAt: embeddedResult.embedded.expires_at
        });
      }

      return res.status(200).json({
        success: true,
        requestId: result.signature_request.signature_request_id,
        message: 'Template signature request sent'
      });

    } catch (error) {
      console.error('Error creating template request:', error);
      return res.status(500).json({ error: error.message });
    }
  });
});

// Get signature request status
exports.getSignatureStatus = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      // Check authentication
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const idToken = authHeader.split('Bearer ')[1];
      
      // Verify the Firebase ID token
      try {
        await admin.auth().verifyIdToken(idToken);
      } catch (error) {
        console.error('Token verification failed:', error);
        return res.status(401).json({ error: 'Invalid token' });
      }

      const hellosign = getHelloSignClient();
      const { requestId } = req.body;

      // Get from HelloSign API
      const result = await hellosign.signatureRequest.get(requestId);
      
      // Update Firestore
      await db.collection('signatureRequests').doc(requestId).update({
        status: result.signature_request.is_complete ? 'completed' : 'pending',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return res.status(200).json({
        success: true,
        status: result.signature_request.is_complete ? 'completed' : 'pending',
        signatures: result.signature_request.signatures,
        filesUrl: result.signature_request.files_url
      });

    } catch (error) {
      console.error('Error getting signature status:', error);
      return res.status(500).json({ error: error.message });
    }
  });
});

// Download signed document
exports.downloadSignedDocument = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      // Check authentication
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const idToken = authHeader.split('Bearer ')[1];
      
      // Verify the Firebase ID token
      try {
        await admin.auth().verifyIdToken(idToken);
      } catch (error) {
        console.error('Token verification failed:', error);
        return res.status(401).json({ error: 'Invalid token' });
      }

      const hellosign = getHelloSignClient();
      const { requestId } = req.body;

      // Get download URL from HelloSign
      const result = await hellosign.signatureRequest.download(requestId, { file_type: 'pdf' });
      
      return res.status(200).json({
        success: true,
        downloadUrl: result.file_url,
        expiresAt: result.expires_at
      });

    } catch (error) {
      console.error('Error downloading document:', error);
      return res.status(500).json({ error: error.message });
    }
  });
});

// List all templates
exports.listTemplates = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      // Check authentication
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const idToken = authHeader.split('Bearer ')[1];
      
      // Verify the Firebase ID token
      try {
        await admin.auth().verifyIdToken(idToken);
      } catch (error) {
        console.error('Token verification failed:', error);
        return res.status(401).json({ error: 'Invalid token' });
      }

      const hellosign = getHelloSignClient();
      const result = await hellosign.template.list();
      
      return res.status(200).json({
        success: true,
        templates: result.templates.map(t => ({
          id: t.template_id,
          title: t.title,
          message: t.message,
          signerRoles: t.signer_roles
        }))
      });

    } catch (error) {
      console.error('Error listing templates:', error);
      return res.status(500).json({ error: error.message });
    }
  });
});

// Webhook for signature events
exports.helloSignWebhook = functions.https.onRequest(async (req, res) => {
  try {
    const event = req.body;
    const apiKey = functions.config().hellosign?.apikey;
    
    if (!apiKey) {
      console.error('HelloSign API key not configured');
      return res.status(500).send('Configuration error');
    }

    const hellosign = require('hellosign-sdk')({ key: apiKey });
    
    // Verify the event came from HelloSign
    if (!hellosign.utils.isValidSignature(
      apiKey,
      req.headers['hellosign-signature'],
      JSON.stringify(event)
    )) {
      console.error('Invalid signature on webhook');
      return res.status(401).send('Unauthorized');
    }

    // Handle different event types
    const eventType = event.event.event_type;
    const signatureRequestId = event.signature_request.signature_request_id;

    console.log(`Received ${eventType} event for request ${signatureRequestId}`);

    switch (eventType) {
      case 'signature_request_signed':
        await db.collection('signatureRequests').doc(signatureRequestId).update({
          status: 'signed',
          signedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        break;
        
      case 'signature_request_all_signed':
        await db.collection('signatureRequests').doc(signatureRequestId).update({
          status: 'completed',
          completedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        break;
        
      case 'signature_request_declined':
        await db.collection('signatureRequests').doc(signatureRequestId).update({
          status: 'declined',
          declinedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        break;
    }

    // Return the expected response
    res.status(200).send('Hello API Event Received');
    
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).send('Error processing webhook');
  }
});
