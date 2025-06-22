import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import db from "@/lib/db";
import { payment } from "@/lib/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const incomingHeaders = await headers();
  const session = await auth.api.getSession({ headers: new Headers(incomingHeaders) });

  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  const userPayment = await db
    .select()
    .from(payment)
    .where(eq(payment.userId, userId))
    .orderBy(payment.createdAt)
    .limit(1);

  if (userPayment.length > 0 && userPayment[0].status === "active") {
    return NextResponse.json({ isPremium: true });
  }

  return NextResponse.json({ isPremium: false });
}
