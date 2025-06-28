import { NextResponse } from "next/server";

export async function GET() {
  const backendApi = process.env.BACKEND_API_URL;
  if (!backendApi) {
    return NextResponse.json(
      { success: false, error: "BACKEND_API_URL not configured" },
      { status: 500 }
    );
  }

  try {
    const res = await fetch(`${backendApi}/api/ping`, { cache: "no-store" });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error("[ping] backend request failed", err);
    return NextResponse.json({ success: false }, { status: 502 });
  }
} 