import { NextResponse } from "next/server";
import { parse } from "node-html-parser";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const videoId = searchParams.get("videoId");

  if (!videoId) {
    return NextResponse.json(
      { error: "Video ID is required" },
      { status: 400 }
    );
  }

  try {
    const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`);
    const html = await res.text();
    const root = parse(html);

    // Duration is stored in the meta tag as ISO 8601 duration format
    const duration = root
      .querySelector('meta[itemprop="duration"]')
      ?.getAttribute("content");

    // Convert ISO duration (PT1H2M10S) to HH:MM:SS format
    const formatDuration = (isoDuration: string) => {
      const matches = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
      if (!matches) return null;

      const hours = matches[1] ? matches[1].padStart(2, "0") : "00";
      const minutes = matches[2] ? matches[2].padStart(2, "0") : "00";
      const seconds = matches[3] ? matches[3].padStart(2, "0") : "00";

      return `${hours}:${minutes}:${seconds}`;
    };

    const metadata = {
      title: root
        .querySelector('meta[property="og:title"]')
        ?.getAttribute("content"),
      description: root
        .querySelector('meta[property="og:description"]')
        ?.getAttribute("content"),
      duration: duration ? formatDuration(duration) : null,
      thumbnail: root
        .querySelector('meta[property="og:image"]')
        ?.getAttribute("content"),
    };

    return NextResponse.json(metadata);
  } catch (error) {
    console.error("Error fetching metadata:", error);
    return NextResponse.json(
      { error: "Failed to fetch metadata" },
      { status: 500 }
    );
  }
}
