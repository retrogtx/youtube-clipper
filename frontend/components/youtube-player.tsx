"use client";

import { useEffect, useRef } from "react";

// Add YouTube IFrame API types
declare global {
  interface Window {
    YT: typeof YT;
    onYouTubeIframeAPIReady: () => void;
  }
}

interface YouTubePlayerProps {
  videoId: string;
  startTime: string;
  endTime: string;
}

export function YouTubePlayer({ videoId, startTime, endTime }: YouTubePlayerProps) {
  const playerRef = useRef<YT.Player | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Convert HH:MM:SS to seconds
  const timeToSeconds = (time: string) => {
    const [hours, minutes, seconds] = time.split(":").map(Number);
    return hours * 3600 + minutes * 60 + seconds;
  };

  useEffect(() => {
    // Load the YouTube IFrame API
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName("script")[0];
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

    // Initialize player when API is ready
    window.onYouTubeIframeAPIReady = () => {
      if (containerRef.current && videoId) {
        playerRef.current = new window.YT.Player(containerRef.current, {
          height: "360",
          width: "640",
          videoId: videoId,
          playerVars: {
            start: timeToSeconds(startTime),
            end: timeToSeconds(endTime),
            autoplay: 0,
            controls: 1,
          },
        });
      }
    };

    return () => {
      if (playerRef.current) {
        playerRef.current.destroy();
      }
    };
  }, [videoId, startTime, endTime]);

  if (!videoId) return null;

  return (
    <div className="w-full aspect-video">
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
} 