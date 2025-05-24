"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Product = {
  product_id: string;
  name: string;
  description: string;
  price: number;
};

export default function Buy({ product }: { product: Product }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [billingState, setBillingState] = useState("");
  const [street, setStreet] = useState("");
  const [zipcode, setZipcode] = useState("");

  const handleSubscription = async () => {
    setLoading(true);
    try {
      if (product) {
        const subscriptionData = {
          billing: {
            city: city,
            country: country,
            state: billingState,
            street: street,
            zipcode: zipcode
          },
          customer: {
            email: email,
            name: name
          },
          product_id: product.product_id,
          quantity: 1,
          payment_link: true
        };
        
        const response = await fetch(`/api/subscriptions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(subscriptionData),
        });
        
        const data = await response.json();
        
        if (data.payment_link) {
          router.push(data.payment_link);
        } else {
          let checkoutUrl = `https://test.checkout.dodopayments.com/buy/${product.product_id}?quantity=1&redirect_url=${process.env.NEXT_PUBLIC_BASE_URL}`;
          router.push(checkoutUrl);
        }
      } 
    } catch (error) {
      console.error("Subscription error:", error);
      setLoading(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-6 hover:transform hover:scale-105 hover:shadow-xl transition-all duration-300">
      <h2 className="text-xl font-bold text-black">{product.name}</h2>
      <p className="text-gray-700 mt-2">{product.description}</p>
      <p className="text-green-600 font-semibold mt-4">${product.price}</p>
      <button
        className="text-xl font-bold text-black"
        onClick={handleSubscription}
        disabled={loading}
      >
        {loading ? "Processing..." : "Subscribe Now"}
      </button>
    </div>
  );
}