// Add this import at the top of AdminDashboard.jsx
import emailjs from '@emailjs/browser';

// Initialize EmailJS (add this after the imports)
emailjs.init('tlwGhvG0aPvocwYcO');

// Update the handleSendMessage function in AdminDashboard.jsx
// Replace the existing handleSendMessage function with this:

const handleSendMessage = async (e) => {
  e.preventDefault();
  
  if (!selectedClient || !messageSubject || !messageContent) {
    alert('Please fill in all fields');
    return;
  }

  try {
    // Get client details
    const clientQuery = query(collection(db, 'users'), where('uid', '==', selectedClient));
    const clientSnapshot = await getDocs(clientQuery);
    const clientData = clientSnapshot.docs[0].data();
    const clientName = `${clientData.firstName} ${clientData.lastName}`;
    const clientEmail = clientData.email;

    // Save message to Firestore
    await addDoc(collection(db, 'messages'), {
      clientId: selectedClient,
      clientName: clientName,
      from: 'Law Offices of Rozsa Gyene',
      subject: messageSubject,
      message: messageContent,
      date: serverTimestamp(),
      unread: true
    });

    // Send email notification to client
    const emailParams = {
      client_name: clientName,
      client_email: clientEmail,
      message_preview: messageContent.substring(0, 150) + (messageContent.length > 150 ? '...' : '')
    };

    await emailjs.send(
      'service_1y5vmr2',
      'template_ita6dzu',
      emailParams
    );

    // Clear form
    setSelectedClient('');
    setMessageSubject('');
    setMessageContent('');
    setShowMessageModal(false);
    
    // Reload messages
    await loadMessages();
    
    alert('Message sent successfully!');
  } catch (error) {
    console.error('Error sending message:', error);
    alert('Failed to send message');
  }
};
