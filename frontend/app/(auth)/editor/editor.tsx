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
  ArrowUp,
  ChevronDown,
  Scissors,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function Editor() {
  const [url, setUrl] = useState("");
  const [startTime, setStartTime] = useState("00:00:00");
  const [endTime, setEndTime] = useState("00:00:00");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
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
        data.image || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
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
      setThumbnailUrl("");
      setMetadata({});
      setIsMetadataLoading(false);
    }
  }, [url]);

  useEffect(() => {
    if (!loading) return;
  }, [loading]);

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
          cropRatio,
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
    } catch (err) {
      console.error("Error in handleSubmit:", err);
      setError(err instanceof Error ? err.message : "An error occurred");
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
      <nav className="flex flex-col w-full gap-4 fixed top-0 left-0 right-0 z-50">
        <div className="flex flex-col gap-6 p-4">
          <div className="flex justify-between items-start">
            <button
              className="font-medium rounded-full border py-2 bg-card px-4 cursor-pointer hover:bg-card/50 transition-colors"
              onClick={() => {
                setIsSidebarOpen(!isSidebarOpen);
              }}
            >
              👋 Hey, {session?.user.name.split(" ")[0]}!
            </button>
            <Button variant="destructive" size="icon" onClick={handleLogout}>
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </nav>

      {/* <section className="flex flex-col gap-6 h-full">
        {thumbnailUrl && (
          <>
            <div className="flex flex-col md:flex-row gap-6 bg-muted/50 p-4 rounded-xl">
              {thumbnailUrl === "loading" || isMetadataLoading ? (
                <>
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/2 mt-2" />
                  <div className="mt-4 pt-4 border-t border-border/10">
                    <Skeleton className="h-4 w-1/4 mb-2" />
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-1/3" />
                      <Skeleton className="h-4 w-1/3" />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <Image
                    unoptimized
                    width={1280}
                    height={720}
                    src={thumbnailUrl}
                    alt="Video thumbnail"
                    className="w-full md:w-1/3 object-cover aspect-video rounded-xl"
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
                  <div className="flex flex-col gap-2">
                    <h3 className="font-medium">{metadata.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {metadata.description}
                    </p>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </section> */}

      <section className="flex flex-col w-full gap-4 max-w-3xl mx-auto z-50">
        <div className="flex items-center gap-2 text-center w-full">
          <h1 className="text-2xl lg:text-3xl font-medium tracking-tight text-center mx-auto">
            What do you want to clip?
          </h1>
        </div>
        <form
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
                <ArrowUp className="w-6 h-6" />
              )}
            </Button>
          </div>

          <div className="grid grid-cols-3 items-end gap-2">
            <div className="flex flex-col gap-2 w-full">
              <Label htmlFor="startTime">Start At</Label>
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
            <div className="flex flex-col gap-2 w-full">
              <Label htmlFor="endTime">End At</Label>
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
            <div className="flex flex-col gap-2 w-full">
              <Label htmlFor="cropRatio">Crop Ratio</Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild id="cropRatio">
                  <Button
                    variant="outline"
                    className="flex items-center gap-2 w-full justify-between"
                  >
                    <div className="flex items-center gap-2">
                      {resolutionOptions[cropRatio].icon}
                      <span>{resolutionOptions[cropRatio].label}</span>
                    </div>
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-52">
                  {Object.entries(resolutionOptions).map(
                    ([key, { icon, label }]) => (
                      <DropdownMenuItem
                        key={key}
                        onClick={() => setCropRatio(key as typeof cropRatio)}
                      >
                        <div className="flex items-center gap-2">
                          {icon}
                          <span>{label}</span>
                        </div>
                      </DropdownMenuItem>
                    )
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </form>
      </section>
    </main>
  );
}
