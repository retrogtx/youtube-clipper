"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "./ui/button";
import { authClient } from "@/lib/auth-client";

type Product = {
  product_id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
};

export default function Buy({
  product,
  isOpen,
}: {
  product: Product;
  isOpen: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const [billing] = useState({
    name: "",
    email: "",
    city: "",
    country: "",
    state: "",
    street: "",
    zipcode: "",
  });

  const handleSubscription = async () => {
    setLoading(true);
    try {
      if (product) {
        const subscriptionData = {
          billing: {
            city: billing.city,
            country: billing.country,
            state: billing.state,
            street: billing.street,
            zipcode: billing.zipcode,
          },
          customer: {
            email: billing.email,
            name: billing.name,
          },
          product_id: product.product_id,
          quantity: 1,
          payment_link: true,
        };

        const response = await fetch(`/api/subscriptions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(subscriptionData),
        });

        const data = await response.json();

        if (data.payment_link) {
          router.push(data.payment_link);
        } else {
          const checkoutUrl = `https://test.checkout.dodopayments.com/buy/${product.product_id}?quantity=1&redirect_url=${process.env.NEXT_PUBLIC_BASE_URL}`;
          router.push(checkoutUrl);
        }
      }
    } catch (error) {
      console.error("Subscription error:", error);
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="w-full space-y-4 rounded-3xl">
        <DialogTitle className="text-4xl font-bold mb-0">
          {product.currency}
          {product.price}
        </DialogTitle>
        <DialogDescription className="text-lg mb-4">
          {product.description}
        </DialogDescription>
        <ul className="flex flex-col gap-2">
          <li className="flex items-center gap-2">
            <span>✨</span>
            We don&apos;t have sketchy ads or popups
          </li>
          <li className="flex items-center gap-2">
            <span>🚀</span>
            Download unlimited clips
          </li>
          <li className="flex items-center gap-2">
            <span>🧼</span>
            No watermarks, no BS
          </li>
          <li className="flex items-center gap-2">
            <span>❤️</span>
            Support the developers (we&apos;re not rich)
          </li>
        </ul>
        <div className="flex gap-2">
          <Button
            size="lg"
            onClick={handleSubscription}
            disabled={loading}
            className="w-fit"
          >
            {loading ? "Loading..." : "Subscribe"}
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={() => {
              authClient.signOut();
              router.refresh();
            }}
            disabled={loading}
            className="w-fit"
          >
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
