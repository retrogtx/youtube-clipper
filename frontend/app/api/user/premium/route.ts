import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function GET() {
  const incomingHeaders = await headers();
  const session = await auth.api.getSession({ headers: new Headers(incomingHeaders) });

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // TODO: Add your premium check logic here
  return NextResponse.json({ isPremium: true });
}
