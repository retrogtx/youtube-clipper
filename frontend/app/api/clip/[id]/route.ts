import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const backendBase = `${process.env.BACKEND_API_URL}/api/clip/${id}`;
  const url = new URL(request.url);
  // Preserve query string (e.g. ?download=1)
  const target = backendBase + url.search;

  const backendRes = await fetch(target);

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