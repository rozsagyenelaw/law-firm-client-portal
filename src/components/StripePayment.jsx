import React, { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { CreditCard, DollarSign, Check, AlertCircle, Shield } from 'lucide-react';
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
      // In a real implementation, you would:
      // 1. Call your backend to create a PaymentIntent
      // 2. Use Stripe Elements to collect card details
      // 3. Confirm the payment
      
      // For now, we'll show a placeholder that demonstrates the flow
      const stripe = await stripePromise;
      
      // Simulate payment processing
      setTimeout(async () => {
        // Record the payment in Firestore
        await addDoc(collection(db, 'payments'), {
          userId: user.uid,
          amount: parseFloat(customAmount),
          description: description || 'Legal Services Payment',
          status: 'pending', // In real implementation, this would be updated by Stripe webhook
          paymentMethod: paymentMethod,
          createdAt: serverTimestamp()
        });

        setSuccess(true);
        setLoading(false);
        
        if (onSuccess) {
          onSuccess(parseFloat(customAmount));
        }
      }, 2000);

      // In production, you would redirect to Stripe Checkout or use Elements
      // Example:
      // const { error } = await stripe.redirectToCheckout({
      //   lineItems: [{ price: 'price_1234', quantity: 1 }],
      //   mode: 'payment',
      //   successUrl: window.location.origin + '/success',
      //   cancelUrl: window.location.origin + '/cancel',
      // });

    } catch (err) {
      setError('Payment failed. Please try again.');
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
        <Check className="h-12 w-12 text-green-600 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Payment Successful!</h3>
        <p className="text-gray-600">
          Thank you for your payment of ${customAmount}. You will receive a receipt via email.
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

      {/* Payment notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>Note:</strong> This is a secure payment demo. In production, you'll be redirected to Stripe's secure checkout page to complete your payment.
        </p>
      </div>

      {/* Submit button */}
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
          `Pay $${customAmount || '0.00'}`
        )}
      </button>

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
