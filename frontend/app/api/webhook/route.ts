import { Webhook } from "standardwebhooks";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
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
      case "subscription.active":
      case "subscription.renewed": {
        const subscription = await dodopayments.subscriptions.retrieve(payload.data.subscription_id);
        
        console.log("-------SUBSCRIPTION DATA START ---------");
        console.log(subscription);
        console.log("-------SUBSCRIPTION DATA END ---------");

        const existingPayment = await db
          .select()
          .from(payment)
          .where(eq(payment.userId, subscription.metadata.user_id))
          .limit(1);

        if (existingPayment.length > 0) {
          await db
            .update(payment)
            .set({ status: "active", updatedAt: new Date() })
            .where(eq(payment.userId, subscription.metadata.user_id));
        } else {
          await db.insert(payment).values({
            id: uuidv4(),
            userId: subscription.metadata.user_id,
            status: "active",
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }

        break;
      }
      case "subscription.cancelled":
      case "subscription.failed":
      case "subscription.expired":
      case "subscription.on_hold":
      case "subscription.paused": {
        const subscription = await dodopayments.subscriptions.retrieve(payload.data.subscription_id);

        const existingPayment = await db
          .select()
          .from(payment)
          .where(eq(payment.userId, subscription.metadata.user_id))
          .limit(1);

        if (existingPayment.length > 0) {
          await db
            .update(payment)
            .set({ status: payload.type.split(".")[1], updatedAt: new Date() })
            .where(eq(payment.userId, subscription.metadata.user_id));
        } else {
          await db.insert(payment).values({
            id: uuidv4(),
            userId: subscription.metadata.user_id,
            status: payload.type.split(".")[1],
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }

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
