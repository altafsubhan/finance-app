import { useState, useEffect } from 'react';

export interface PaymentMethod {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export function usePaymentMethods() {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPaymentMethods();
  }, []);

  const loadPaymentMethods = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/payment-methods', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setPaymentMethods(data);
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to load payment methods');
      }
    } catch (error) {
      console.error('Failed to load payment methods:', error);
      setError('Failed to load payment methods');
    } finally {
      setLoading(false);
    }
  };

  return {
    paymentMethods,
    loading,
    error,
    refetch: loadPaymentMethods,
  };
}

