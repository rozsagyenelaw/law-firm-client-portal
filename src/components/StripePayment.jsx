import React, { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { CreditCard, DollarSign, Check, AlertCircle, Shield, ExternalLink } from 'lucide-react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db, STRIPE_PUBLISHABLE_KEY } from '../firebase';

// Initialize Stripe with the key from firebase.js
const stripePromise = loadStripe(STRIPE_PUBLISHABLE_KEY);

const StripePayment = ({ user, amount, description, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [customAmount, setCustomAmount] = useState(amount || '');

  // Common payment amounts for estate planning services
  const commonAmounts = [
    { label: 'Initial Consultation', amount: 500 },
    { label: 'Simple Will', amount: 1500 },
    { label: 'Living Trust Package', amount: 3500 },
    { label: 'Trust Administration', amount: 5000 },
  ];

  const handlePayment = async () => {
    if (!customAmount || parseFloat(customAmount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const stripe = await stripePromise;
      
      // For production, you need to:
      // 1. Create a backend endpoint that creates a Stripe Checkout Session
      // 2. Call that endpoint to get a session ID
      // 3. Redirect to Stripe Checkout
      
      // Since we don't have a backend yet, we'll use Stripe Payment Links
      // You need to create payment links in your Stripe Dashboard
      
      // For now, show an alert with instructions
      alert(`To complete payment:
      
1. Amount: $${customAmount}
2. This is a demo - in production, you'll be redirected to Stripe Checkout
3. To set up real payments:
   - Create a backend endpoint for Stripe Checkout Sessions
   - Or use Stripe Payment Links for quick setup
   
Would you like to proceed with a test payment?`);

      // Simulate successful payment for demo
      const proceed = window.confirm('Simulate successful payment for demo purposes?');
      
      if (proceed) {
        // Record the payment in Firestore
        await addDoc(collection(db, 'payments'), {
          userId: user.uid,
          amount: parseFloat(customAmount),
          description: description || 'Legal Services Payment',
          status: 'demo_payment', // Mark as demo
          paymentMethod: paymentMethod,
          createdAt: serverTimestamp()
        });

        setSuccess(true);
        
        if (onSuccess) {
          onSuccess(parseFloat(customAmount));
        }
      }
      
      setLoading(false);

    } catch (err) {
      setError('Payment setup failed. Please try again.');
      setLoading(false);
    }
  };

  const handleStripeCheckout = () => {
    // Direct link to your Stripe payment page
    // You can create different payment links for different amounts in Stripe Dashboard
    const stripePaymentLink = 'https://buy.stripe.com/test_XXXXXXXXX'; // Replace with your actual payment link
    
    window.open(stripePaymentLink, '_blank');
  };

  if (success) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
        <Check className="h-12 w-12 text-green-600 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Payment Recorded!</h3>
        <p className="text-gray-600">
          This was a demo payment of ${customAmount}. 
        </p>
        <p className="text-sm text-gray-500 mt-2">
          In production, you'll receive a receipt via email after completing payment through Stripe.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Quick amount selection */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-3">Select Service or Enter Custom Amount</h4>
        <div className="grid grid-cols-2 gap-3">
          {commonAmounts.map((item) => (
            <button
              key={item.label}
              onClick={() => setCustomAmount(item.amount.toString())}
              className={`p-3 border rounded-lg text-left transition-colors ${
                customAmount === item.amount.toString()
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <p className="text-sm font-medium text-gray-900">{item.label}</p>
              <p className="text-lg font-semibold text-gray-700">${item.amount}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Custom amount input */}
      <div>
        <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-1">
          Payment Amount
        </label>
        <div className="relative">
          <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            id="amount"
            type="number"
            min="0"
            step="0.01"
            value={customAmount}
            onChange={(e) => setCustomAmount(e.target.value)}
            className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            placeholder="0.00"
          />
        </div>
      </div>

      {/* Payment method selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">Payment Method</label>
        <div className="space-y-2">
          <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
            <input
              type="radio"
              value="card"
              checked={paymentMethod === 'card'}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="mr-3"
            />
            <CreditCard className="h-5 w-5 text-gray-600 mr-2" />
            <span className="text-gray-700">Credit/Debit Card</span>
          </label>
          <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
            <input
              type="radio"
              value="ach"
              checked={paymentMethod === 'ach'}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="mr-3"
            />
            <span className="text-gray-700">Bank Transfer (ACH)</span>
          </label>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start">
          <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 mr-2 flex-shrink-0" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Payment options */}
      <div className="space-y-3">
        {/* Demo button */}
        <button
          onClick={handlePayment}
          disabled={loading || !customAmount}
          className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
            loading || !customAmount
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-900 hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
          }`}
        >
          {loading ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Processing...
            </>
          ) : (
            `Demo Payment - $${customAmount || '0.00'}`
          )}
        </button>

        {/* Real Stripe button - uncomment when you have payment links */}
        {/* <button
          onClick={handleStripeCheckout}
          className="w-full flex justify-center items-center py-3 px-4 border border-blue-900 rounded-md shadow-sm text-sm font-medium text-blue-900 bg-white hover:bg-gray-50"
        >
          Pay with Stripe
          <ExternalLink className="ml-2 h-4 w-4" />
        </button> */}
      </div>

      {/* Payment notice */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-sm text-yellow-800">
          <strong>Demo Mode:</strong> This is currently in demo mode. To enable real payments:
        </p>
        <ol className="mt-2 ml-4 text-sm text-yellow-700 list-decimal">
          <li>Create Stripe Payment Links in your Stripe Dashboard</li>
          <li>Or set up a backend server to create Stripe Checkout Sessions</li>
          <li>Update this component with your payment link URLs</li>
        </ol>
      </div>

      {/* Security badges */}
      <div className="flex items-center justify-center space-x-4 text-xs text-gray-500">
        <div className="flex items-center">
          <Shield className="h-4 w-4 mr-1" />
          <span>Secure Payment</span>
        </div>
        <div className="flex items-center">
          <CreditCard className="h-4 w-4 mr-1" />
          <span>Powered by Stripe</span>
        </div>
      </div>
    </div>
  );
};

export default StripePayment;
