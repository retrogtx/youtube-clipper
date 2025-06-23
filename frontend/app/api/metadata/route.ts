import { NextResponse } from "next/server";
import { parse } from "node-html-parser";
import { spawn } from "child_process";
import path from "path";

interface VideoMetadata {
  title?: string;
  description?: string;
  image?: string;
  video?: string;
  platform?: string;
  duration?: number;
  uploader?: string;
  upload_date?: string;
  view_count?: number;
  like_count?: number;
  width?: number;
  height?: number;
}

interface YtDlpInfo {
  title?: string;
  description?: string;
  alt_title?: string;
  thumbnail?: string;
  thumbnails?: Array<{
    url: string;
    width?: number;
    height?: number;
  }>;
  duration?: number;
  uploader?: string;
  channel?: string;
  upload_date?: string;
  view_count?: number;
  like_count?: number;
  width?: number;
  height?: number;
}

function detectPlatform(url: string): 'youtube' | 'instagram' | 'unknown' {
  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    return 'youtube';
  }
  if (url.includes('instagram.com')) {
    return 'instagram';
  }
  return 'unknown';
}

function extractInstagramId(url: string): string | null {
  const regExp = /instagram\.com\/(p|reel|tv)\/([A-Za-z0-9_-]+)/;
  const match = url.match(regExp);
  return match ? match[2] : null;
}

function extractMetadataWithYtDlp(url: string): Promise<YtDlpInfo> {
  return new Promise((resolve, reject) => {
    const ytDlpPath = path.resolve(process.cwd(), '../backend/bin/yt-dlp');
    const platform = detectPlatform(url);
    
    const ytArgs = [
      '-j', // JSON output
      '--no-warnings',
      '--no-check-certificates',
      '--skip-download', // Don't download, just get metadata
      '--add-header',
      'user-agent:Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15',
      url
    ];
    
    if (platform === 'instagram') {
      ytArgs.push(
        '--add-header',
        'referer:instagram.com'
      );
    }
    
    const yt = spawn(ytDlpPath, ytArgs);
    
    let jsonData = '';
    let errorData = '';
    
    yt.stdout.on('data', (data) => {
      jsonData += data.toString();
    });
    
    yt.stderr.on('data', (data) => {
      errorData += data.toString();
    });
    
    yt.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`yt-dlp failed: ${errorData}`));
        return;
      }
      
      try {
        const info = JSON.parse(jsonData);
        resolve(info);
      } catch (e) {
        reject(new Error(`JSON parse error: ${e instanceof Error ? e.message : String(e)}`));
      }
    });
    
    // Timeout after 15 seconds
    setTimeout(() => {
      yt.kill('SIGKILL');
      reject(new Error('Timeout'));
    }, 15000);
  });
}

async function extractBasicMetadata(url: string, platform: string): Promise<VideoMetadata> {
  if (platform === 'instagram') {
    // Instagram-specific handling
    const instagramId = extractInstagramId(url);
    
    try {
      // Method 1: fetch with Instagram-specific headers
      const headers = {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.3 Mobile/15E148 Safari/604.1',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Referer': 'https://www.instagram.com/',
        'DNT': '1',
        'Connection': 'keep-alive'
      };

      const res = await fetch(url, { headers });
      const html = await res.text();
      const root = parse(html);

      // Extract Open Graph metadata
      const ogTitle = root.querySelector('meta[property="og:title"]')?.getAttribute("content");
      const ogDescription = root.querySelector('meta[property="og:description"]')?.getAttribute("content");
      const ogImage = root.querySelector('meta[property="og:image"]')?.getAttribute("content");
      const ogVideo = root.querySelector('meta[property="og:video"]')?.getAttribute("content");

      return {
        title: ogTitle || `Instagram ${instagramId ? 'Post' : 'Content'}`,
        description: ogDescription || 'Instagram content',
        image: ogImage,
        video: ogVideo,
        platform: 'instagram'
      };
    } catch (error) {
      console.log('Instagram basic metadata failed:', error instanceof Error ? error.message : String(error));
      return {
        title: `Instagram ${url.includes('/reel/') ? 'Reel' : url.includes('/p/') ? 'Post' : 'Content'}`,
        description: 'Instagram content',
        platform: 'instagram'
      };
    }
  } else {
    // YouTube and other platforms - original logic
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      const html = await res.text();
      const root = parse(html);

      return {
        title: root
          .querySelector('meta[property="og:title"]')
          ?.getAttribute("content"),
        description: root
          .querySelector('meta[property="og:description"]')
          ?.getAttribute("content"),
        image: root
          .querySelector('meta[property="og:image"]')
          ?.getAttribute("content"),
        platform: platform
      };
    } catch (error) {
      console.log('Basic metadata extraction failed:', error instanceof Error ? error.message : String(error));
      return {
        title: platform === 'youtube' ? 'YouTube Video' : 'Video Content',
        description: '',
        platform: platform
      };
    }
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "URL is required" }, { status: 400 });
  }

  const platform = detectPlatform(url);
  
  if (platform === 'unknown') {
    return NextResponse.json({ error: "Unsupported platform" }, { status: 400 });
  }

  try {
    // Primary method: Try yt-dlp for rich metadata (duration, uploader, etc.)
    try {
      const info = await extractMetadataWithYtDlp(url);
      
      // Extract relevant metadata from yt-dlp
      const metadata: VideoMetadata = {
        title: info.title || `${platform === 'instagram' ? 'Instagram' : 'Video'} Content`,
        description: info.description || info.alt_title || '',
        image: info.thumbnail || info.thumbnails?.[0]?.url || undefined,
        duration: info.duration || undefined,
        uploader: info.uploader || info.channel || undefined,
        upload_date: info.upload_date || undefined,
        view_count: info.view_count || undefined,
        like_count: info.like_count || undefined,
        platform: platform,
        width: info.width || undefined,
        height: info.height || undefined
      };
      
      // For Instagram, try to get the best thumbnail
      if (platform === 'instagram' && info.thumbnails && info.thumbnails.length > 0) {
        // Sort thumbnails by quality (prefer larger ones)
        const sortedThumbnails = info.thumbnails.sort((a, b) => {
          const aSize = (a.width || 0) * (a.height || 0);
          const bSize = (b.width || 0) * (b.height || 0);
          return bSize - aSize;
        });
        metadata.image = sortedThumbnails[0]?.url || metadata.image;
      }
      
      return NextResponse.json(metadata);
      
    } catch (ytdlpError) {
      console.log(`yt-dlp extraction failed for ${platform}, falling back to basic scraping:`, ytdlpError instanceof Error ? ytdlpError.message : String(ytdlpError));
      
      // Fallback method: Basic HTML scraping
      const basicMetadata = await extractBasicMetadata(url, platform);
      return NextResponse.json(basicMetadata);
    }
    
  } catch (error) {
    console.error("Error fetching metadata:", error);
    
    // Final fallback metadata
    const fallbackMetadata: VideoMetadata = {
      title: platform === 'instagram' 
        ? `Instagram ${url.includes('/reel/') ? 'Reel' : 'Content'}` 
        : 'Video Content',
      description: '',
      platform: platform
    };
    
    return NextResponse.json(fallbackMetadata);
  }
}
