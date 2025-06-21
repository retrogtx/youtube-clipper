import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const backendBase = `${process.env.BACKEND_API_URL}/api/clip/${params.id}`;
  const url = new URL(req.url);
  // Preserve query string (e.g. ?download=1)
  const target = backendBase + url.search;

  const backendRes = await fetch(target, {
    method: "GET",
  });

  // If this is the download request (?download=1) we need to pipe the stream & headers
  if (url.searchParams.get("download") === "1") {
    const headers = new Headers();
    backendRes.headers.forEach((value, key) => {
      if ([
        "content-type",
        "content-length",
        "content-disposition",
        "cache-control",
      ].includes(key.toLowerCase())) {
        headers.set(key, value);
      }
    });
    return new NextResponse(backendRes.body, {
      status: backendRes.status,
      headers,
    });
  }

  // Otherwise it's a polling request; just forward the JSON status
  const json = await backendRes.json();
  return NextResponse.json(json, { status: backendRes.status });
} 