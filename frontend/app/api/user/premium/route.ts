import { NextResponse } from "next/server";
import { authClient } from "@/lib/auth-client";

export async function GET() {
  const session = await authClient.useSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // TODO: Add your premium check logic here
  return NextResponse.json({ isPremium: true });
}
