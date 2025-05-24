"use client";
import { authClient } from "@/lib/auth-client" // import the auth client
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import Buy from "@/components/buy";

export default function App() {
  const router = useRouter(); // initialize router
  const [url, setUrl] = useState("");
  const [startTime, setStartTime] = useState("00:00:00");
  const [endTime, setEndTime] = useState("00:00:00");
  const [isCropped, setIsCropped] = useState(false)
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [clipPath, setClipPath] = useState("");

  const {
    data: session,
  } = authClient.useSession();

  useEffect(() => {
    if (!session) {
      router.push("/login");
    }
  }, [session, router]);

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
          startTime,
          endTime,
          isCropped
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
      a.download = "clip.mp4";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(urlObj);
      // Optionally, show a success message
      // setSuccess('Clip downloaded!');
    } catch (err) {
      console.error("Error in handleSubmit:", err);
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex flex-col mx-auto max-w-lg w-full justify-center h-full items-center min-h-screen">
      <section className="flex flex-col w-full gap-12 border-2 border-border/50 p-4 md:p-6 bg-muted/30 rounded-3xl">
        <h1 className="text-2xl font-bold tracking-tight">Video Clipper</h1>
        <Buy product={{
          product_id: process.env.NEXT_PUBLIC_DODO_PAYMENTS_PRODUCT_ID!,
          name: "Basic Subscription",
          description: "Access to all basic features",
          price: 3,
        }} />
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="space-y-2">
            <Label htmlFor="url">YouTube URL</Label>
            <Input
              type="text"
              id="url"
              placeholder="https://youtu.be/sSOxPJD-VNo?si=8eiKNlwqde-WfEzD"
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
              onChange={(e) => setStartTime(e.target.value)}
              pattern="[0-9]{2}:[0-9]{2}:[0-9]{2}"
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
              onChange={(e) => setEndTime(e.target.value)}
              pattern="[0-9]{2}:[0-9]{2}:[0-9]{2}"
              placeholder="00:00:00"
              required
            />
          </div>
          <div className="flex !items-center space-x-2 my-1">
            <Switch
              checked={isCropped}
              onCheckedChange={() => setIsCropped(!isCropped)}
              id="isCropped"
            />
            <Label htmlFor="isCropped">Reel format</Label>
          </div>
          <Button type="submit" disabled={loading} className="w-full" size="lg">
            {loading ? "Processing..." : "Clip Video"}
          </Button>
          {error && (
            <div className="text-destructive text-sm mt-2">{error}</div>
          )}
          {clipPath && (
            <div className="text-green-500 text-sm mt-2">
              Clip created successfully! Server path: {clipPath}
            </div>
          )}
        </form>
      </section>
    </main>
  );
}
