import { Webhook } from "standardwebhooks";
import { headers } from "next/headers";
import { dodopayments } from "@/lib/dodopayments";
import db from "@/lib/db";
import { payment } from "@/lib/schema";
import { v4 as uuidv4 } from "uuid";

const webhook = new Webhook(process.env.DODO_PAYMENTS_WEBHOOK_KEY!);

export async function POST(request: Request) {
  const headersList = await headers();

  try {
    const rawBody = await request.text();
    const webhookHeaders = {
      "webhook-id": headersList.get("webhook-id") || "",
      "webhook-signature": headersList.get("webhook-signature") || "",
      "webhook-timestamp": headersList.get("webhook-timestamp") || "",
    };

    await webhook.verify(rawBody, webhookHeaders);
    const payload = JSON.parse(rawBody);

    switch (payload.type) {
      case "subscription.active": {
        const subscription = await dodopayments.subscriptions.retrieve(payload.data.subscription_id);
        
        console.log("-------SUBSCRIPTION DATA START ---------");
        console.log(subscription);
        console.log("-------SUBSCRIPTION DATA END ---------");

        await db.insert(payment).values({
          id: uuidv4(),
          userId: subscription.metadata.user_id,
          status: "active",
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        break;
      }
    }

    return Response.json({ message: "Webhook processed successfully" }, { status: 200 });

  } catch (error) {
    console.error("----- Webhook verification failed -----");
    console.error(error);
    return Response.json({ message: "Webhook failed" }, { status: 400 });
  }
}
