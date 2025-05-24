import { NextResponse } from 'next/server';
import { dodopayments } from '@/lib/dodopayments';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log('Request body:', JSON.stringify(body));
    

    const response = await dodopayments.subscriptions.create({
      billing: {
        city: body.billing.city,
        country: body.billing.country,
        state: body.billing.state,
        street: body.billing.street,
        zipcode: body.billing.zipcode,
      },
      customer: {
        email: body.customer.email,
        name: body.customer.name,
      },
      product_id: body.product_id,
      quantity: body.quantity,
      payment_link: true,
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