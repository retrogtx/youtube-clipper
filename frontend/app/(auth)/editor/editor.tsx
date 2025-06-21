"use client";
import { authClient } from "@/lib/auth-client"; // import the auth client
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const [loading, setLoading] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<{
    title?: string;
    description?: string;
    thumbnail?: string;
    duration?: string;
  }>({});
  const [cropRatio, setCropRatio] = useState<
    "original" | "vertical" | "square"
  >("original");
  const [isMetadataLoading, setIsMetadataLoading] = useState(true);
  const { data: session } = authClient.useSession();
  const [downloadCount, setDownloadCount] = useState(0);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const getVideoId = (url: string) => {
    const regExp =
      /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
    const match = url.match(regExp);
    return match && match[7].length === 11 ? match[7] : null;
  };

  const fetchVideoMetadata = async (videoId: string | null) => {
    if (!videoId) return;
    setIsMetadataLoading(true);

    try {
      const url = `https://www.youtube.com/watch?v=${videoId}`;
      const response = await fetch(
        `/api/metadata?url=${encodeURIComponent(url)}`
      );
      if (!response.ok) throw new Error("Failed to fetch video metadata");
      const data = await response.json();

      setMetadata({
        title: data.title,
        description: data.description,
        thumbnail: data.thumbnail,
      });
      setThumbnailUrl(
        data.image
          ? data.image
          : `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
      );
    } catch (error) {
      console.error("Error fetching metadata:", error);
      // Fallback to YouTube thumbnail
      setThumbnailUrl(
        `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
      );
    } finally {
      setIsMetadataLoading(false);
    }
  };

  useEffect(() => {
    const videoId = getVideoId(url);
    if (videoId) {
      // Show skeleton immediately by setting thumbnailUrl
      setThumbnailUrl("loading");
      setIsMetadataLoading(true);
      fetchVideoMetadata(videoId);
    } else {
      setThumbnailUrl(null);
      setMetadata({});
      setIsMetadataLoading(false);
    }
  }, [url]);

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
        body: JSON.stringify({ url, startTime, endTime, cropRatio }),
      });

      if (!clipKickoff.ok) {
        const errJson = await clipKickoff.json().catch(() => ({}));
        throw new Error(errJson.error || "Failed to start processing");
      }

      const { id } = (await clipKickoff.json()) as { id: string };

      // Step 2: poll until ready
      let status = "processing" as "processing" | "ready" | "error";
      while (status === "processing") {
        await new Promise((r) => setTimeout(r, 3000)); // 3-second polling
        const pollRes = await fetch(`/api/clip/${id}`);
        if (!pollRes.ok) throw new Error("Failed to poll job status");
        const pollJson = (await pollRes.json()) as { status: string; error?: string };
        status = pollJson.status as any;
        if (status === "error") throw new Error(pollJson.error || "Processing failed");
      }

      // Step 3: download the finished clip
      const downloadRes = await fetch(`/api/clip/${id}?download=1`);
      if (!downloadRes.ok) throw new Error("Failed to download clip");

      const blob = await downloadRes.blob();

      // Extract filename from content-disposition header if available, otherwise default
      const disposition = downloadRes.headers.get("content-disposition");
      let filename = "clip.mp4";
      if (disposition && disposition.indexOf("attachment") !== -1) {
        const filenameRegex = /filename[^;=\n]*=((['"])(.*?)\2|[^;\n]*)/;
        const matches = filenameRegex.exec(disposition);
        if (matches != null && matches[3]) {
          filename = matches[3];
        }
      }
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = filename;
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
                {thumbnailUrl && (
                  <Image
                    unoptimized
                    width={1280}
                    height={720}
                    src={thumbnailUrl}
                    alt="Video thumbnail"
                    className="w-20 object-cover aspect-video rounded-md"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      if (target.src.includes("maxresdefault")) {
                        target.src = target.src.replace(
                          "maxresdefault",
                          "hqdefault"
                        );
                      }
                    }}
                  />
                )}
                <div className="flex flex-col gap-2">
                  <h3 className="font-medium text-lg line-clamp-1">
                    {metadata.title}
                  </h3>
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
              placeholder="Paste video url here..."
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
