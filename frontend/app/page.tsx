"use client";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { YouTubePlayer } from "@/components/youtube-player";

export default function App() {
  const [url, setUrl] = useState("");
  const [startTime, setStartTime] = useState("00:00:00");
  const [endTime, setEndTime] = useState("00:00:00");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [clipPath, setClipPath] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [videoTitle, setVideoTitle] = useState("");

  // Extract video ID from YouTube URL
  const getVideoId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return match && match[2].length === 11 ? match[2] : null;
  };

  // Format time input to ensure HH:MM:SS format
  const formatTimeInput = (time: string) => {
    // If empty, return default
    if (!time) return "00:00:00";
    
    // Remove any non-digit characters
    const digits = time.replace(/\D/g, '');
    
    // If no digits, return default
    if (!digits) return "00:00:00";
    
    // Take only first 6 digits
    const sixDigits = digits.slice(0, 6).padStart(6, '0');
    
    // Format as HH:MM:SS
    return `${sixDigits.slice(0, 2)}:${sixDigits.slice(2, 4)}:${sixDigits.slice(4, 6)}`;
  };

  const handleTimeChange = (value: string, setter: (value: string) => void) => {
    setter(value);
  };

  const handlePreview = () => {
    setShowPreview(true);
  };

  // Fetch video title when URL changes
  useEffect(() => {
    const fetchVideoTitle = async () => {
      const videoId = getVideoId(url);
      if (!videoId) {
        setVideoTitle("");
        return;
      }

      try {
        const response = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
        if (response.ok) {
          const data = await response.json();
          setVideoTitle(data.title);
        }
      } catch (error) {
        console.error("Error fetching video title:", error);
        setVideoTitle("");
      }
    };

    fetchVideoTitle();
  }, [url]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const clipResponse = await fetch("http://localhost:3001/api/clip", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url,
          startTime: formatTimeInput(startTime),
          endTime: formatTimeInput(endTime),
        }),
      });

      if (!clipResponse.ok) {
        // Try to parse error JSON, fallback to text
        let errorMsg = "Failed to process video section";
        try {
          const errorData = await clipResponse.json();
          errorMsg = errorData.details || errorData.error || errorMsg;
        } catch {
          errorMsg = await clipResponse.text();
        }
        throw new Error(errorMsg);
      }

      // Get the blob and trigger download
      const blob = await clipResponse.blob();
      const urlObj = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = urlObj;

      // Create descriptive filename
      const formattedStartTime = formatTimeInput(startTime).replace(/:/g, '-');
      const formattedEndTime = formatTimeInput(endTime).replace(/:/g, '-');
      const safeTitle = videoTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const filename = `${safeTitle}_${formattedStartTime}_to_${formattedEndTime}.mp4`;
      
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(urlObj);
    } catch (err) {
      console.error("Error in handleSubmit:", err);
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const videoId = getVideoId(url);

  return (
    <main className="flex flex-col mx-auto max-w-lg w-full justify-center h-full items-center min-h-screen">
      <section className="flex flex-col w-full gap-12 border-2 border-border/50 p-4 md:p-6 bg-muted/30 rounded-3xl">
        <h1 className="text-2xl font-bold tracking-tight">Video Clipper</h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="space-y-2">
            <Label htmlFor="url">YouTube URL</Label>
            <Input
              type="text"
              id="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="startTime">Start Time (HH:MM:SS)</Label>
            <Input
              type="text"
              id="startTime"
              value={startTime}
              onChange={(e) => handleTimeChange(e.target.value, setStartTime)}
              placeholder="00:00:00"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="endTime">End Time (HH:MM:SS)</Label>
            <Input
              type="text"
              id="endTime"
              value={endTime}
              onChange={(e) => handleTimeChange(e.target.value, setEndTime)}
              placeholder="00:00:00"
              required
            />
          </div>
          <div className="flex gap-4">
            <Button 
              type="button" 
              onClick={handlePreview} 
              className="flex-1" 
              size="lg"
              disabled={!videoId}
            >
              Preview Clip
            </Button>
            <Button 
              type="submit" 
              disabled={loading} 
              className="flex-1" 
              size="lg"
            >
              {loading ? "Processing..." : "Download Clip"}
            </Button>
          </div>
          {error && (
            <div className="text-destructive text-sm mt-2">{error}</div>
          )}
          {clipPath && (
            <div className="text-green-500 text-sm mt-2">
              Clip created successfully! Server path: {clipPath}
            </div>
          )}
        </form>

        {/* Video Preview */}
        {videoId && showPreview && (
          <div className="mt-8">
            <h2 className="text-lg font-semibold mb-4">Preview</h2>
            <YouTubePlayer
              videoId={videoId}
              startTime={formatTimeInput(startTime)}
              endTime={formatTimeInput(endTime)}
            />
          </div>
        )}
      </section>
    </main>
  );
}
