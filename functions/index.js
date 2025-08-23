require('dotenv').config();
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const cors = require('cors')({ origin: true });
const docusign = require('docusign-esign');

// Initialize admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// DocuSign configuration - reads from Firebase config first, falls back to .env for local development
const DOCUSIGN_CONFIG = {
  integrationKey: functions.config().docusign?.integration_key || process.env.DOCUSIGN_INTEGRATION_KEY,
  userId: functions.config().docusign?.user_id || process.env.DOCUSIGN_USER_ID,
  accountId: functions.config().docusign?.account_id || process.env.DOCUSIGN_ACCOUNT_ID,
  basePath: functions.config().docusign?.base_path || process.env.DOCUSIGN_BASE_PATH,
  oAuthBasePath: functions.config().docusign?.oauth_base_path || process.env.DOCUSIGN_OAUTH_BASE_PATH,
  privateKey: functions.config().docusign?.private_key || process.env.DOCUSIGN_PRIVATE_KEY,
  redirectUri: 'https://portal.livingtrust-attorneys.com/callback'
};

// Helper function to get DocuSign API client
async function getDocuSignClient() {
  const apiClient = new docusign.ApiClient();
  apiClient.setBasePath(DOCUSIGN_CONFIG.basePath);

  // JWT authentication
  const jwtLifeSec = 10 * 60; // 10 minutes
  const scopes = 'signature impersonation';
  
  try {
    const results = await apiClient.requestJWTUserToken(
      DOCUSIGN_CONFIG.integrationKey,
      DOCUSIGN_CONFIG.userId,
      scopes,
      DOCUSIGN_CONFIG.privateKey,
      jwtLifeSec
    );

    const accessToken = results.body.access_token;
    apiClient.addDefaultHeader('Authorization', 'Bearer ' + accessToken);
    
    return apiClient;
  } catch (error) {
    console.error('DocuSign authentication error:', error);
    console.error('Config values present:', {
      hasIntegrationKey: !!DOCUSIGN_CONFIG.integrationKey,
      hasUserId: !!DOCUSIGN_CONFIG.userId,
      hasAccountId: !!DOCUSIGN_CONFIG.accountId,
      hasBasePath: !!DOCUSIGN_CONFIG.basePath,
      hasOAuthBasePath: !!DOCUSIGN_CONFIG.oAuthBasePath,
      hasPrivateKey: !!DOCUSIGN_CONFIG.privateKey
    });
    throw new functions.https.HttpsError('internal', 'DocuSign authentication failed');
  }
}

// Create envelope for signature - UPDATED WITH BETTER AUTH HANDLING
exports.createSignatureRequest = functions.https.onCall(async (data, context) => {
  // Log the auth context for debugging
  console.log('Function called with auth context:', {
    hasAuth: !!context.auth,
    uid: context.auth?.uid,
    token: context.auth?.token ? 'present' : 'missing',
    authTime: context.auth?.token?.auth_time
  });

  // Check authentication
  if (!context.auth) {
    console.error('No auth context found');
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  if (!context.auth.uid) {
    console.error('Auth context exists but no uid');
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated with valid uid');
  }

  const { 
    title, 
    subject, 
    message, 
    signerEmail, 
    signerName, 
    fileUrl,
    useEmail = false 
  } = data;

  try {
    console.log('Creating DocuSign envelope for:', signerEmail);
    console.log('Authenticated user:', context.auth.uid);
    console.log('Config check:', {
      hasIntegrationKey: !!DOCUSIGN_CONFIG.integrationKey,
      hasUserId: !!DOCUSIGN_CONFIG.userId,
      hasAccountId: !!DOCUSIGN_CONFIG.accountId,
      basePath: DOCUSIGN_CONFIG.basePath,
      oAuthBasePath: DOCUSIGN_CONFIG.oAuthBasePath
    });

    const apiClient = await getDocuSignClient();
    const envelopesApi = new docusign.EnvelopesApi(apiClient);

    // Download the document from Firebase Storage
    const response = await fetch(fileUrl);
    const documentBuffer = await response.buffer();
    const documentBase64 = documentBuffer.toString('base64');

    // Create envelope definition
    const envelope = new docusign.EnvelopeDefinition();
    envelope.emailSubject = subject;
    envelope.emailBlurb = message;
    envelope.status = 'sent';

    // Create document
    const document = new docusign.Document();
    document.documentBase64 = documentBase64;
    document.name = title;
    document.fileExtension = 'pdf';
    document.documentId = '1';

    envelope.documents = [document];

    // Create signer
    const signer = new docusign.Signer();
    signer.email = signerEmail;
    signer.name = signerName;
    signer.recipientId = '1';
    signer.routingOrder = '1';

    // Add signature tab
    const signTab = new docusign.SignHere();
    signTab.documentId = '1';
    signTab.pageNumber = '1';
    signTab.recipientId = '1';
    signTab.tabLabel = 'SignHereTab';
    signTab.xPosition = '195';
    signTab.yPosition = '147';

    signer.tabs = new docusign.Tabs();
    signer.tabs.signHereTabs = [signTab];

    // Set recipient action based on signing method
    if (!useEmail) {
      signer.clientUserId = '1000'; // For embedded signing
    }

    envelope.recipients = new docusign.Recipients();
    envelope.recipients.signers = [signer];

    // Create the envelope
    const envelopeResult = await envelopesApi.createEnvelope(DOCUSIGN_CONFIG.accountId, {
      envelopeDefinition: envelope
    });

    const envelopeId = envelopeResult.envelopeId;

    // Save envelope info to Firestore
    await db.collection('signatureRequests').doc(envelopeId).set({
      requestId: envelopeId,
      title: title,
      signerEmail: signerEmail,
      signerName: signerName,
      status: 'sent',
      createdBy: context.auth.uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      useEmail: useEmail,
      provider: 'docusign'
    });

    let result = {
      requestId: envelopeId,
      status: 'sent'
    };

    // If embedded signing, get the signing URL
    if (!useEmail) {
      const recipientView = new docusign.RecipientViewRequest();
      recipientView.authenticationMethod = 'none';
      recipientView.email = signerEmail;
      recipientView.userName = signerName;
      recipientView.clientUserId = '1000';
      recipientView.returnUrl = 'https://portal.livingtrust-attorneys.com/signing-complete';

      const viewResult = await envelopesApi.createRecipientView(
        DOCUSIGN_CONFIG.accountId,
        envelopeId,
        { recipientViewRequest: recipientView }
      );

      result.signUrl = viewResult.url;
    }

    console.log('DocuSign envelope created successfully:', envelopeId);
    return result;

  } catch (error) {
    console.error('Error creating DocuSign envelope:', error);
    throw new functions.https.HttpsError('internal', `Failed to create signature request: ${error.message}`);
  }
});

// Get envelope status - UPDATED WITH BETTER AUTH HANDLING
exports.getSignatureStatus = functions.https.onCall(async (data, context) => {
  console.log('getSignatureStatus called with auth:', !!context.auth);
  
  if (!context.auth || !context.auth.uid) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { requestId } = data;

  try {
    const apiClient = await getDocuSignClient();
    const envelopesApi = new docusign.EnvelopesApi(apiClient);

    const envelope = await envelopesApi.getEnvelope(DOCUSIGN_CONFIG.accountId, requestId);
    
    // Update Firestore with current status
    await db.collection('signatureRequests').doc(requestId).update({
      status: envelope.status.toLowerCase(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return {
      requestId: requestId,
      status: envelope.status.toLowerCase(),
      statusDateTime: envelope.statusChangedDateTime
    };

  } catch (error) {
    console.error('Error getting envelope status:', error);
    throw new functions.https.HttpsError('internal', 'Failed to get signature status');
  }
});

// Download completed document
exports.getSignedDocument = functions.https.onCall(async (data, context) => {
  if (!context.auth || !context.auth.uid) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { requestId } = data;

  try {
    const apiClient = await getDocuSignClient();
    const envelopesApi = new docusign.EnvelopesApi(apiClient);

    // Get the completed document
    const document = await envelopesApi.getDocument(
      DOCUSIGN_CONFIG.accountId, 
      requestId, 
      'combined'
    );

    // Upload to Firebase Storage
    const bucket = admin.storage().bucket();
    const fileName = `signed-documents/${requestId}-signed.pdf`;
    const file = bucket.file(fileName);

    await file.save(document, {
      metadata: {
        contentType: 'application/pdf'
      }
    });

    // Make file publicly readable
    await file.makePublic();

    const downloadUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;

    // Update Firestore with download URL
    await db.collection('signatureRequests').doc(requestId).update({
      signedDocumentUrl: downloadUrl,
      completedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return {
      downloadUrl: downloadUrl
    };

  } catch (error) {
    console.error('Error downloading signed document:', error);
    throw new functions.https.HttpsError('internal', 'Failed to download signed document');
  }
});

// DocuSign webhook handler
exports.docusignWebhook = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      console.log('DocuSign webhook received:', req.body);

      const eventData = req.body;
      
      if (eventData.event === 'envelope-completed') {
        const envelopeId = eventData.data.envelopeId;
        
        // Update Firestore
        await db.collection('signatureRequests').doc(envelopeId).update({
          status: 'completed',
          completedAt: admin.firestore.FieldValue.serverTimestamp(),
          webhookData: eventData
        });

        console.log('Envelope completed:', envelopeId);
      }

      res.status(200).send('OK');
    } catch (error) {
      console.error('Webhook error:', error);
      res.status(500).send('Error processing webhook');
    }
  });
});

// List user's signature requests
exports.listSignatureRequests = functions.https.onCall(async (data, context) => {
  if (!context.auth || !context.auth.uid) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  try {
    const snapshot = await db.collection('signatureRequests')
      .where('createdBy', '==', context.auth.uid)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    const requests = [];
    snapshot.forEach(doc => {
      requests.push({
        id: doc.id,
        ...doc.data()
      });
    });

    return { requests };

  } catch (error) {
    console.error('Error listing signature requests:', error);
    throw new functions.https.HttpsError('internal', 'Failed to list signature requests');
  }
});

// Cancel envelope
exports.cancelSignatureRequest = functions.https.onCall(async (data, context) => {
  if (!context.auth || !context.auth.uid) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { requestId } = data;

  try {
    const apiClient = await getDocuSignClient();
    const envelopesApi = new docusign.EnvelopesApi(apiClient);

    // Update envelope status to voided
    const envelope = new docusign.Envelope();
    envelope.status = 'voided';
    envelope.voidedReason = 'Cancelled by user';

    await envelopesApi.update(DOCUSIGN_CONFIG.accountId, requestId, {
      envelope: envelope
    });

    // Update Firestore
    await db.collection('signatureRequests').doc(requestId).update({
      status: 'cancelled',
      cancelledAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return { success: true };

  } catch (error) {
    console.error('Error cancelling envelope:', error);
    throw new functions.https.HttpsError('internal', 'Failed to cancel signature request');
  }
});

// Health check endpoint
exports.healthCheck = functions.https.onRequest((req, res) => {
  cors(req, res, () => {
    res.status(200).json({
      status: 'healthy',
      provider: 'docusign',
      timestamp: new Date().toISOString()
    });
  });
});