'use client';

import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { countries } from '@/lib/countries'; // Import the new country list

type BillingInfo = {
  city: string;
  state: string;
  street: string;
  zipcode: string;
  country: string;
};

type SubscriptionFormData = {
  billing: BillingInfo;
  customer: {
    name: string;
  };
};

type SubscriptionFormProps = {
  onSubmit: (data: SubscriptionFormData) => void;
  onBack?: () => void; // Optional: if you want a back button managed by the parent
};

export function SubscriptionForm({ onSubmit }: SubscriptionFormProps) { // Removed onBack from props for now, parent handles it
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Error state can be for local validation if needed, or removed if parent handles all errors
  const [error, setError] = useState<string | null>(null); 
  // Success state is removed as parent will handle outcome
  
  const [formData, setFormData] = useState<SubscriptionFormData>({
    billing: {
      city: '',
      state: '',
      street: '',
      zipcode: '',
      country: 'US',
    },
    customer: {
      name: '',
    },
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    if (name.startsWith('billing.')) {
      const field = name.split('.')[1] as keyof BillingInfo;
      setFormData(prev => ({
        ...prev,
        billing: {
          ...prev.billing,
          [field]: value,
        },
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        customer: {
          ...prev.customer,
          [name]: value,
        },
      }));
    }
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Basic validation example (can be more extensive)
    if (!formData.customer.name || !formData.billing.street || !formData.billing.city || !formData.billing.state || !formData.billing.zipcode || !formData.billing.country) {
      setError('Please fill in all required fields.');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    // Call the onSubmit prop passed from the parent
    // The parent (Buy.tsx) will handle the actual API call and subsequent logic
    onSubmit(formData);
    // setIsSubmitting(false); // Parent should manage loading state for the API call
  };

  return (
    <Card className="w-full max-w-md mx-auto shadow-lg">
      <CardHeader className="px-4 py-3 sm:px-6 sm:py-4">
        <CardTitle className="text-xl sm:text-2xl">Billing Information</CardTitle>
        <CardDescription className="text-xs sm:text-sm">Please enter your billing details.</CardDescription>
      </CardHeader>
      <CardContent className="px-4 py-3 sm:px-6 sm:py-4">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="customer.name" className="text-xs sm:text-sm">Full Name</Label>
            <Input
              id="customer.name"
              name="name"
              value={formData.customer.name}
              onChange={handleChange}
              required
              placeholder="John Doe"
              className="h-9 text-xs sm:text-sm"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="billing.street" className="text-xs sm:text-sm">Street Address</Label>
            <Input
              id="billing.street"
              name="billing.street"
              value={formData.billing.street}
              onChange={handleChange}
              required
              placeholder="123 Main St"
              className="h-9 text-xs sm:text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="billing.city" className="text-xs sm:text-sm">City</Label>
              <Input
                id="billing.city"
                name="billing.city"
                value={formData.billing.city}
                onChange={handleChange}
                required
                placeholder="New York"
                className="h-9 text-xs sm:text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="billing.state" className="text-xs sm:text-sm">State / Province</Label>
              <Input
                id="billing.state"
                name="billing.state"
                value={formData.billing.state}
                onChange={handleChange}
                required
                placeholder="NY"
                className="h-9 text-xs sm:text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="billing.zipcode" className="text-xs sm:text-sm">ZIP / Postal Code</Label>
              <Input
                id="billing.zipcode"
                name="billing.zipcode"
                value={formData.billing.zipcode}
                onChange={handleChange}
                required
                placeholder="10001"
                className="h-9 text-xs sm:text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="billing.country" className="text-xs sm:text-sm">Country</Label>
              <select
                id="billing.country"
                name="billing.country"
                value={formData.billing.country}
                onChange={handleChange}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-xs sm:text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {countries.map((country) => (
                  <option key={country.code} value={country.code}>
                    {country.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {error && (
            <div className="p-2 text-xs text-red-700 bg-red-100 rounded-md">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full h-9 text-xs sm:text-sm" disabled={isSubmitting}>
            {isSubmitting ? 'Processing...' : 'Submit Billing Details'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
