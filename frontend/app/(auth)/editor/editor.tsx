"use client";
import { authClient } from "@/lib/auth-client"; // import the auth client
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Loader2,
  LogOut,
  Monitor,
  Smartphone,
  Square,
  ArrowDown,
} from "lucide-react";
import Image from "next/image";
import Buy from "@/components/buy";
import { motion, AnimatePresence } from "motion/react";

export default function Editor() {
  const [url, setUrl] = useState("");
  const [startTime, setStartTime] = useState("00:00:00");
  const [endTime, setEndTime] = useState("00:00:00");
  const [addSubs, setAddSubs] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [thumbnailError, setThumbnailError] = useState(false);
  const [metadata, setMetadata] = useState<{
    title?: string;
    description?: string;
    thumbnail?: string;
    duration?: string;
    uploader?: string;
  }>({});
  const [cropRatio, setCropRatio] = useState<
    "original" | "vertical" | "square"
  >("original");
  const [formats, setFormats] = useState<{format_id: string, label: string}[]>([]);
  const [selectedFormat, setSelectedFormat] = useState<string>('');
  const [isMetadataLoading, setIsMetadataLoading] = useState(true);
  const { data: session } = authClient.useSession();
  const [downloadCount, setDownloadCount] = useState(0);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const detectPlatform = useCallback((url: string): 'youtube' | 'instagram' | 'unknown' => {
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      return 'youtube';
    }
    if (url.includes('instagram.com')) {
      return 'instagram';
    }
    return 'unknown';
  }, []);

  const getVideoId = useCallback((url: string) => {
    const platform = detectPlatform(url);
    
    if (platform === 'youtube') {
      const regExp =
        /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
      const match = url.match(regExp);
      return match && match[7].length === 11 ? match[7] : null;
    } else if (platform === 'instagram') {
      // Extract Instagram post/reel ID from URL
      const regExp = /instagram\.com\/(p|reel)\/([A-Za-z0-9_-]+)/;
      const match = url.match(regExp);
      return match ? match[2] : null;
    }
    
    return null;
  }, [detectPlatform]);

  const fetchVideoMetadata = useCallback(async (videoId: string | null) => {
    if (!videoId) return;
    setIsMetadataLoading(true);

    try {
      const platform = detectPlatform(url);
      let fetchUrl = '';
      
      if (platform === 'youtube') {
        fetchUrl = `https://www.youtube.com/watch?v=${videoId}`;
      } else if (platform === 'instagram') {
        fetchUrl = url; 
      }
      
      // yt-dlp metadata endpoint for both platforms for consistent rich metadata
      const metadataResponse = await fetch(
        `/api/metadata?url=${encodeURIComponent(fetchUrl)}`
      );
      if (!metadataResponse.ok) throw new Error("Failed to fetch video metadata");
      const metadata = await metadataResponse.json();


      setMetadata({
        title: metadata.title,
        description: metadata.description,
        thumbnail: metadata.thumbnail,
        duration: metadata.duration,
        uploader: metadata.uploader,
      });
      
      if (platform === 'youtube') {
        setThumbnailUrl(
          metadata.image
            ? metadata.image
            : `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
        );
        setThumbnailError(false);
      } else if (platform === 'instagram') {
        setThumbnailUrl(metadata.image || null);
        setThumbnailError(false);
      }

      // Fetch formats
      const formatsResponse = await fetch(`/api/formats?url=${encodeURIComponent(fetchUrl)}`);
      if(formatsResponse.ok) {
        const formatsData = await formatsResponse.json();
        setFormats(formatsData.formats || []);
        if (formatsData.formats?.length > 0) {
          setSelectedFormat(formatsData.formats[0].format_id);
        }
      }

    } catch (error) {
      console.error("Error fetching metadata:", error);
      const platform = detectPlatform(url);
      
      if (platform === 'youtube') {
        // Fallback to YouTube thumbnail
        setThumbnailUrl(
          `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
        );
      } else if (platform === 'instagram') {
        // Set fallback metadata for Instagram
        setMetadata({
          title: url.includes('/reel/') ? 'Instagram Reel' : 'Instagram Post',
          description: 'Instagram content',
        });
        setThumbnailUrl(null);
      }
    } finally {
      setIsMetadataLoading(false);
    }
  }, [url, detectPlatform]);

  useEffect(() => {
    const videoId = getVideoId(url);
    if (videoId) {
      // Show skeleton immediately by setting thumbnailUrl
      setThumbnailUrl("loading");
      setThumbnailError(false);
      setIsMetadataLoading(true);
      fetchVideoMetadata(videoId);
    } else {
      setThumbnailUrl(null);
      setThumbnailError(false);
      setMetadata({});
      setFormats([]);
      setSelectedFormat('');
      setIsMetadataLoading(false);
    }
  }, [url, fetchVideoMetadata, getVideoId]);

  useEffect(() => {
    if (session?.user?.id) {
      const storedCount = localStorage.getItem(`bangers-${session.user.id}`);
      setDownloadCount(storedCount ? parseInt(storedCount) : 0);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    const checkPremiumStatus = async () => {
      try {
        const response = await fetch("/api/user/premium");
        const data = await response.json();
        setIsPremium(data.isPremium);
        setShowPremiumModal(!data.isPremium);
      } catch (error) {
        console.error("Error checking premium status:", error);
      }
    };

    if (session?.user) {
      checkPremiumStatus();
    }
  }, [session]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isPremium) {
      setShowPremiumModal(true);
      return;
    }

    setLoading(true);

    try {
      // Step 1: kick-off processing
      const clipKickoff = await fetch("/api/clip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          startTime,
          endTime,
          cropRatio,
          subtitles: addSubs,
          formatId: selectedFormat,
          userId: session?.user?.id,
        }),
      });

      if (!clipKickoff.ok) {
        const errJson = await clipKickoff.json().catch(() => ({}));
        throw new Error(errJson.error || "Failed to start processing");
      }

      const { id } = (await clipKickoff.json()) as { id: string };

      // Step 2: poll until ready
      type JobStatus = "processing" | "ready" | "error";
      interface JobStatusResponse { 
        status: JobStatus; 
        error?: string; 
        url?: string; 
      }

      let status: JobStatus = "processing";
      while (status === "processing") {
        await new Promise((r) => setTimeout(r, 3000)); // 3-second polling
        const pollRes = await fetch(`/api/clip/${id}`);
        if (!pollRes.ok) throw new Error("Failed to poll job status");
        const pollJson = (await pollRes.json()) as JobStatusResponse;
        status = pollJson.status;
        if (status === "error") throw new Error(pollJson.error || "Processing failed");
      }

      // Step 3: Download via frontend route (handles Supabase download and cleanup)
      const downloadRes = await fetch(`/api/clip/${id}/download`);
      if (!downloadRes.ok) throw new Error("Failed to download clip");

      const blob = await downloadRes.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = "clip.mp4";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      a.remove();

      // Update download count
      const newCount = downloadCount + 1;
      if (session?.user?.id) {
        localStorage.setItem(`bangers-${session.user.id}`, String(newCount));
      }
      setDownloadCount(newCount);
    } catch (err) {
      console.error("Error in handleSubmit:", err);
      // Add user-friendly error handling here
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    authClient.signOut();
  };

  const resolutionOptions = {
    original: { icon: <Monitor className="w-4 h-4" />, label: "Original" },
    vertical: { icon: <Smartphone className="w-4 h-4" />, label: "Vertical" },
    square: { icon: <Square className="w-4 h-4" />, label: "Square" },
  } as const;

  return (
    <main className="flex flex-col w-full h-full min-h-screen p-4 gap-4 max-w-3xl mx-auto items-center justify-center">
      <nav className="flex flex-col w-full gap-4 fixed top-0 left-0 right-0 z-20">
        <div className="flex flex-col gap-6 p-4">
          <div className="flex justify-between items-start">
            <motion.button
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ delay: 0.4 }}
              className="font-medium rounded-full border py-2 bg-card px-4 cursor-pointer hover:bg-card/50"
            >
              👋 Hey, {session?.user.name.split(" ")[0]}!
            </motion.button>
            <motion.span
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ delay: 0.4 }}
            >
              <Button variant="destructive" size="icon" onClick={handleLogout}>
                <LogOut className="h-5 w-5" />
              </Button>
            </motion.span>
          </div>
        </div>
      </nav>

      <section className="flex flex-col w-full gap-4 max-w-xl mx-auto transition-all duration-300">
        <AnimatePresence mode="wait">
          {!isMetadataLoading && thumbnailUrl === null ? (
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="text-2xl lg:text-3xl font-medium tracking-tight text-center mx-auto"
            >
              What do you wanna clip?
            </motion.h1>
          ) : isMetadataLoading ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col gap-6 h-full w-fit mx-auto"
            >
              <div className="flex flex-col md:flex-row gap-4 bg-muted/50 p-2 rounded-lg items-center">
                <div className="w-20 h-[45px] bg-muted animate-pulse rounded-md" />
                <div className="flex flex-col gap-2">
                  <div className="h-6 w-48 bg-muted animate-pulse rounded-md" />
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col gap-6 h-full w-fit mx-auto"
            >
              <div className="flex flex-col md:flex-row gap-4 bg-muted/50 p-2 rounded-lg md:items-center">
                {thumbnailUrl && !thumbnailError && (
                  <div className="relative">
                    <Image
                      unoptimized
                      width={1280}
                      height={720}
                      src={thumbnailUrl}
                      alt="Video thumbnail"
                      className="w-20 object-cover aspect-video rounded-md"
                      onError={(e) => {
                        const platform = detectPlatform(url);
                        const target = e.target as HTMLImageElement;
                        
                        if (platform === 'youtube' && target.src.includes("maxresdefault")) {
                          // For YouTube, try lower quality fallback
                          target.src = target.src.replace(
                            "maxresdefault",
                            "hqdefault"
                          );
                        } else {
                          // For Instagram or failed YouTube fallback, hides the thumbnail
                          setThumbnailError(true);
                        }
                      }}
                    />
                    <div className="absolute top-1 right-1 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
                      {detectPlatform(url) === 'instagram' ? 'IG' : 'YT'}
                    </div>
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-lg line-clamp-1">
                      {metadata.title}
                    </h3>
                    {(thumbnailError || !thumbnailUrl) && (
                      <div className="bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
                        {detectPlatform(url) === 'instagram' ? 'IG' : 'YT'}
                      </div>
                    )}
                  </div>
                  {metadata.uploader && (
                    <p className="text-sm text-muted-foreground">
                      by {metadata.uploader}
                    </p>
                  )}
                  {metadata.duration && (
                    <p className="text-sm text-muted-foreground">
                      Duration: {(() => {
                        const totalSeconds = Number(metadata.duration);
                        const hours = Math.floor(totalSeconds / 3600);
                        const minutes = Math.floor((totalSeconds % 3600) / 60);
                        const seconds = Math.floor(totalSeconds % 60);
                        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
                      })()}
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.form
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          onSubmit={handleSubmit}
          className="flex flex-col gap-12 border p-4 bg-card rounded-3xl"
        >
          <div className="flex items-center gap-2 w-full">
            <input
              type="text"
              id="url"
              placeholder="Paste YouTube or Instagram URL here..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
              className="bg-transparent border-none outline-none w-full"
            />
            <Button type="submit" size="icon" disabled={loading}>
              {loading ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <ArrowDown className="w-6 h-6" />
              )}
            </Button>
          </div>

          <div className="flex flex-col gap-2 w-full">
            <div className="flex gap-3 w-full items-center">
              <div className="flex flex-col gap-2 w-full">
                <Label htmlFor="startTime" className="sr-only">
                  Start Time
                </Label>
                <Input
                  type="text"
                  id="startTime"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  pattern="[0-9]{2}:[0-9]{2}:[0-9]{2}"
                  placeholder="00:00:00"
                  required
                  className="font-mono text-sm"
                />
              </div>
              <span className="text-sm text-muted-foreground">to</span>
              <div className="flex flex-col gap-2 w-full">
                <Label htmlFor="endTime" className="sr-only">
                  End Time
                </Label>
                <Input
                  type="text"
                  id="endTime"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  pattern="[0-9]{2}:[0-9]{2}:[0-9]{2}"
                  placeholder="00:00:00"
                  required
                  className="font-mono text-sm"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2 w-full">
              <Label htmlFor="cropRatio" className="sr-only">
                Crop Ratio
              </Label>
              <div className="flex items-center justify-between p-2 rounded-2xl border relative bg-white/5 backdrop-blur-md">
                {Object.entries(resolutionOptions).map(
                  ([key, { icon, label }]) => (
                    <div
                      key={key}
                      onClick={() => setCropRatio(key as typeof cropRatio)}
                      className="relative cursor-pointer w-full group text-center py-1.5 overflow-visible hover:scale-105 transition-all duration-300 ease-[cubic-bezier(0.175, 0.885, 0.32, 1.275)] px-4"
                    >
                      {cropRatio === key && (
                        <motion.div
                          layoutId="hover"
                          className="absolute inset-0 bg-primary rounded-md"
                          transition={{
                            type: "spring",
                            stiffness: 120,
                            damping: 10,
                            mass: 0.2,
                            ease: [0, 1, 0.35, 0],
                          }}
                        />
                      )}
                      <span
                        className={`relative flex text-xs sm:text-sm items-center gap-2 justify-center ${
                          cropRatio === key
                            ? "text-primary-foreground"
                            : "text-foreground"
                        }`}
                      >
                        {icon}
                        <span>{label}</span>
                      </span>
                    </div>
                  )
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 w-full">
              <div className="flex flex-col gap-2 flex-1">
                <Label htmlFor="quality">Quality</Label>
                <select
                  id="quality"
                  value={selectedFormat}
                  onChange={(e) => setSelectedFormat(e.target.value)}
                  className="bg-transparent border rounded-md p-2 h-10 flex items-center appearance-none bg-no-repeat bg-right bg-[length:16px] pr-8"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                    backgroundPosition: 'right 8px center'
                  }}
                  disabled={formats.length === 0}
                >
                  {formats.length === 0 ? (
                    <option value="">Loading formats...</option>
                  ) : (
                    formats.map((format) => (
                      <option key={format.format_id} value={format.format_id}>
                        {format.label}
                      </option>
                    ))  
                  )}
                </select>
              </div>

              <div className="flex flex-col gap-2 flex-1">
                <Label htmlFor="subtitles-switch">Subtitles</Label>
                <div className="flex items-center space-x-2 h-10">
                  <Switch
                    id="subtitles-switch"
                    checked={addSubs}
                    onCheckedChange={setAddSubs}
                  />
                  <Label htmlFor="subtitles-switch" className="text-sm text-muted-foreground">
                    English only
                  </Label>
                </div>
              </div>
            </div>
          </div>
        </motion.form>
        <AnimatePresence mode="wait">
          {downloadCount > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="text-center mt-4 text-sm text-muted-foreground"
            >
              🔥 {downloadCount} banger{downloadCount > 1 && "s"} clipped
            </motion.div>
          )}
        </AnimatePresence>
      </section>
      {showPremiumModal && (
        <Buy
          isOpen={showPremiumModal}
          setIsOpen={setShowPremiumModal}
          product={{
            product_id: process.env.NEXT_PUBLIC_DODO_PAYMENTS_PRODUCT_ID!,
            name: "Starter",
            description: "Servers don't come cheap 🤷🏻",
            price: "4.20",
            currency: "$",
          }}
        />
      )}
    </main>
  );
}
