import { NextResponse } from 'next/server';
import { dodopayments } from '@/lib/dodopayments';
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log('Request body:', JSON.stringify(body));

    const incomingHeaders = await headers();
    const session = await auth.api.getSession({ headers: new Headers(incomingHeaders) });

    if (!session || !session.user || !session.user.email) {
      return NextResponse.json({ error: "Unauthorized or user email missing" }, { status: 401 });
    }

    const userId = session.user.id;
    const userEmail = session.user.email;

    const response = await dodopayments.subscriptions.create({
      billing: {
        city: body.billing.city,
        country: body.billing.country || "US",
        state: body.billing.state,
        street: body.billing.street,
        zipcode: body.billing.zipcode,
      },
      customer: {
        email: body.customer.email || userEmail,
        name: body.customer.name,
      },
      product_id: body.product_id,
      quantity: body.quantity,
      payment_link: true,
      metadata: {
        user_id: userId,
      },
    });
    
    return NextResponse.json(response);
  } catch (error) {
    console.error('Subscription error:', error);
    return NextResponse.json(
      { error: 'Failed to create subscription' },
      { status: 500 }
    );
  }
}