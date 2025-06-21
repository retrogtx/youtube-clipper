import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db";
import { payment } from "@/lib/schema";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  // 1. Authenticate the request and ensure the user is premium.
  const session = await auth.api.getSession({ headers: new Headers(req.headers) });

  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  // Fetch the latest payment record for the user
  const userPayment = await db
    .select()
    .from(payment)
    .where(eq(payment.userId, userId))
    .orderBy(payment.createdAt)
    .limit(1);

  if (userPayment.length === 0 || userPayment[0].status !== "active") {
    return NextResponse.json({ error: "Forbidden: Premium subscription required" }, { status: 403 });
  }

  const body = await req.json();

  // Forward the request to your backend
  const backendRes = await fetch(`${process.env.BACKEND_API_URL}/api/clip`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // Add any secret headers if needed
    },
    body: JSON.stringify(body),
  });

  // Get the binary data
  const data = await backendRes.arrayBuffer();

  // Copy headers (especially Content-Disposition for downloads)
  const headers = new Headers();
  backendRes.headers.forEach((value, key) => {
    // Only copy relevant headers
    if (
      [
        "content-type",
        "content-length",
        "content-disposition",
        "cache-control",
      ].includes(key.toLowerCase())
    ) {
      headers.set(key, value);
    }
  });

  return new NextResponse(data, {
    status: backendRes.status,
    headers,
  });
} 