import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
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