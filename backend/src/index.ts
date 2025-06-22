import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

// --- Supabase setup ---
const supabaseUrl = process.env.SUPABASE_URL as string;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY as string;
const bucketName = process.env.SUPABASE_BUCKET || 'videos';
if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Supabase credentials are not set in environment variables');
}
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
});

const app = express();
const port = process.env.PORT || 3001;

const allowedOrigin = process.env.NODE_ENV === "production" 
  ? "https://clippa.in" 
  : "http://localhost:3000";

const corsOptions: cors.CorsOptions = {
  origin: allowedOrigin,
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());

const uploadsDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

const jobsDir = path.join(__dirname, "../jobs");
if (!fs.existsSync(jobsDir)) {
  fs.mkdirSync(jobsDir);
}

interface Job {
  id: string;
  status: 'processing' | 'ready' | 'error';
  filePath?: string;
  storagePath?: string;
  publicUrl?: string;
  error?: string;
}
const jobs = new Map<string, Job>();

// Persistent job management
function saveJob(job: Job) {
  const jobFile = path.join(jobsDir, `${job.id}.json`);
  fs.writeFileSync(jobFile, JSON.stringify(job, null, 2));
  jobs.set(job.id, job);
}

function loadJob(id: string): Job | null {
  try {
    const jobFile = path.join(jobsDir, `${id}.json`);
    if (fs.existsSync(jobFile)) {
      const jobData = JSON.parse(fs.readFileSync(jobFile, 'utf-8'));
      jobs.set(id, jobData);
      return jobData;
    }
  } catch (err) {
    console.error(`Error loading job ${id}:`, err);
  }
  return null;
}

function deleteJob(id: string) {
  const jobFile = path.join(jobsDir, `${id}.json`);
  try {
    if (fs.existsSync(jobFile)) {
      fs.unlinkSync(jobFile);
    }
  } catch (err) {
    console.error(`Error deleting job file ${id}:`, err);
  }
  jobs.delete(id);
}

function createJobId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function timeToSeconds(timeStr: string): number {
  const parts = timeStr.split(':');
  return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseFloat(parts[2]);
}

function secondsToTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toFixed(3).padStart(6, '0')}`;
}

async function adjustSubtitleTimestamps(inputPath: string, outputPath: string, startTime: string): Promise<void> {
  const startSeconds = timeToSeconds(startTime);
  const content = await fs.promises.readFile(inputPath, 'utf-8');
  
  // Regex to match VTT timestamp lines (e.g., "00:01:30.000 --> 00:01:35.000")
  const timestampRegex = /(\d{2}:\d{2}:\d{2}\.\d{3}) --> (\d{2}:\d{2}:\d{2}\.\d{3})/g;
  
  const adjustedContent = content.replace(timestampRegex, (match, start, end) => {
    const startSec = timeToSeconds(start) - startSeconds;
    const endSec = timeToSeconds(end) - startSeconds;
    
    // Skip negative timestamps (before clip start)
    if (startSec < 0) return match; // Keep original, will be filtered out by video duration
    
    return `${secondsToTime(startSec)} --> ${secondsToTime(endSec)}`;
  });
  
  await fs.promises.writeFile(outputPath, adjustedContent, 'utf-8');
}

app.post("/api/clip", async (req, res) => {
  const { url, startTime, endTime, subtitles, formatId } = req.body || {};
  if (!url || !startTime || !endTime) {
    return res.status(400).json({ error: "url, startTime, and endTime are required" });
  }

  const id = createJobId();
  const outputPath = path.join(uploadsDir, `clip-${id}.mp4`);
  const job: Job = { id, status: 'processing', filePath: outputPath };
  saveJob(job);
  console.log(`[job ${id}] created and saved to persistent storage. Total jobs:`, jobs.size);

  (async () => {
    try {
      const section = `*${startTime}-${endTime}`;
      const cookiesFilePath = path.join(__dirname, "../src/cookies.txt");

      const ytArgs = [
        url,
      ];
      if (formatId) {
        ytArgs.push("-f", formatId);
      } else {
        ytArgs.push("-f", "bv[ext=mp4][vcodec^=avc1][height<=2160][fps<=60]+ba[ext=m4a][acodec^=mp4a]/best[ext=mp4][vcodec^=avc1]");
      }
      ytArgs.push(
        "--download-sections",
        section,
        "-o",
        outputPath,
        "--merge-output-format",
        "mp4",
        "--no-check-certificates",
        "--no-warnings",
        "--add-header",
        "referer:youtube.com",
        "--add-header",
        "user-agent:Mozilla/5.0",
        "--verbose"
      );
      if (subtitles) {
        ytArgs.push(
          "--write-subs",
          "--write-auto-subs",
          "--sub-lang",
          "en",
          "--sub-format",
          "vtt"
        );
      }
      if (fs.existsSync(cookiesFilePath)) ytArgs.push("--cookies", cookiesFilePath);

      console.log(`[job ${id}] starting yt-dlp`);
      const yt = spawn(path.resolve(__dirname, '../bin/yt-dlp'), ytArgs);
      yt.stderr.on('data', d => console.error(`[job ${id}]`, d.toString()));

      await new Promise<void>((resolve, reject) => {
        yt.on('close', (code, signal) => {
          if (code === 0) {
            resolve();
          } else if (code === null) {
            reject(new Error(`yt-dlp process was killed by signal: ${signal || 'unknown'}`));
          } else {
            reject(new Error(`yt-dlp exited with code ${code}`));
          }
        });
        yt.on('error', reject);
      });

      const fastPath = path.join(uploadsDir, `clip-${id}-fast.mp4`);
      const subPath = outputPath.replace(/\.mp4$/, ".en.vtt");
      const subtitlesExist = fs.existsSync(subPath);

      // Adjust subtitle timestamps if subtitles exist
      if (subtitles && subtitlesExist) {
        const adjustedSubPath = path.join(uploadsDir, `clip-${id}-adjusted.vtt`);
        await adjustSubtitleTimestamps(subPath, adjustedSubPath, startTime);
        // Replace the original subtitle file with the adjusted one
        await fs.promises.rename(adjustedSubPath, subPath);
      }

      await new Promise<void>((resolve, reject) => {
        const ffmpegArgs = [
          '-y',
          '-i', outputPath,
        ];

        if (subtitles && subtitlesExist) {
          console.log(`[job ${id}] burning subtitles from ${subPath}`);
          ffmpegArgs.push(
            '-vf', `subtitles=${subPath}`,
            '-c:v', 'libx264',
            '-c:a', 'aac',
            '-b:a', '128k'
          );
        } else {
          ffmpegArgs.push(
            '-c:v', 'copy',
            '-c:a', 'aac',
            '-b:a', '128k'
          );
        }

        ffmpegArgs.push(
          '-movflags', '+faststart',
          fastPath
        );

        console.log(`[job ${id}] running ffmpeg`, ffmpegArgs.join(' '));
        const ff = spawn('ffmpeg', ffmpegArgs);
        ff.stderr.on('data', d => console.error(`[job ${id}] ffmpeg`, d.toString()));
        ff.on('close', (code, signal) => {
          if (code === 0) {
            resolve();
          } else if (code === null) {
            reject(new Error(`ffmpeg process was killed by signal: ${signal || 'unknown'}`));
          } else {
            reject(new Error(`ffmpeg exited with code ${code}`));
          }
        });
        ff.on('error', reject);
      });

      await fs.promises.unlink(outputPath).catch(()=>{});
      await fs.promises.rename(fastPath, outputPath);
      
      if (subtitlesExist) {
        await fs.promises.unlink(subPath).catch(() => {});
      }

      // ---- Upload processed clip to Supabase ----
      const objectPath = `clip-${id}.mp4`;
      console.log(`[job ${id}] uploading to Supabase: ${objectPath}`);
      const fileBuffer = await fs.promises.readFile(outputPath);
      const { error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(objectPath, fileBuffer, {
          contentType: 'video/mp4',
          upsert: true,
        });
      if (uploadError) throw uploadError;

      console.log(`[job ${id}] upload successful, getting public URL`);
      const { data: pub } = supabase.storage
        .from(bucketName)
        .getPublicUrl(objectPath);

      // Remove local file after upload
      await fs.promises.unlink(outputPath).catch(() => {});

      job.storagePath = objectPath;
      job.publicUrl = pub.publicUrl;

      job.status = 'ready';
      saveJob(job);
      console.log(`[job ${id}] ready - storagePath: ${job.storagePath}, publicUrl: ${job.publicUrl}`);
    } catch (err: unknown) {
      console.error(`[job ${id}] failed`, err);
      job.status = 'error';
      const message = err instanceof Error ? err.message : String(err);
      job.error = message;
      saveJob(job);
    }
  })();

  return res.status(202).json({ id });
});

app.get('/api/clip/:id', async (req, res) => {
  const { id } = req.params;
  const { download } = req.query;
  let job = jobs.get(id);
  
  // If not in memory, try to load from persistent storage
  if (!job) {
    job = loadJob(id) || undefined;
  }
  
  if (!job) {
    console.log(`[job ${id}] not found in memory or persistent storage. Current jobs:`, Array.from(jobs.keys()));
    return res.status(404).json({ error: 'job not found'});
  }

  if (download === '1') {
    // Frontend should handle download directly from Supabase URL
    return res.status(400).json({ 
      error: 'Use the public URL directly. Backend only provides the URL, frontend handles download and cleanup.' 
    });
  }

  return res.json({ 
    status: job.status, 
    error: job.error, 
    url: job.publicUrl,
    storagePath: job.storagePath 
  });
});

// Cleanup endpoint for frontend to delete files after download
app.delete('/api/clip/:id/cleanup', async (req, res) => {
  const { id } = req.params;
  let job = jobs.get(id);
  
  // If not in memory, try to load from persistent storage
  if (!job) {
    job = loadJob(id) || undefined;
  }
  
  if (!job) {
    return res.status(404).json({ error: 'job not found' });
  }

  try {
    // Only clean up job metadata (Supabase cleanup is handled by frontend)
    deleteJob(id);
    console.log(`[job ${id}] job metadata cleaned up successfully`);
    
    return res.json({ success: true });
  } catch (err) {
    console.error(`[job ${id}] job cleanup error:`, err);
    return res.status(500).json({ error: 'Job cleanup failed' });
  }
});

app.get("/api/formats", async (req, res) => {
  const { url } = req.query;
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: "url is required" });
  }

  try {
    const ytDlpPath = path.resolve(__dirname, '../bin/yt-dlp');
    const cookiesFilePath = path.join(__dirname, "../src/cookies.txt");
    
    const ytArgs = [
      '-j', 
      '--no-warnings',
      '--no-check-certificates',
      '--add-header',
      'referer:youtube.com',
      '--add-header',
      'user-agent:Mozilla/5.0',
      url as string
    ];
    
    if (fs.existsSync(cookiesFilePath)) {
      ytArgs.splice(-1, 0, '--cookies', cookiesFilePath);
    }
    
    console.log(`[formats] fetching formats for URL: ${url}`);
    const yt = spawn(ytDlpPath, ytArgs);
    
    // Add timeout for yt-dlp process
    const timeout = setTimeout(() => {
      console.log(`[formats] timeout reached, killing yt-dlp process`);
      yt.kill('SIGKILL');
    }, 30000); // 30 second timeout
    
    let jsonData = '';
    yt.stdout.on('data', (data) => {
      jsonData += data.toString();
    });

    let errorData = '';
    yt.stderr.on('data', (data) => {
        errorData += data.toString();
    });

    yt.on('close', (code, signal) => {
      clearTimeout(timeout);
      if (signal === 'SIGKILL') {
        console.error(`[formats] yt-dlp process timed out after 30 seconds`);
        return res.status(500).json({ error: 'Request timed out - video may be too long or unavailable' });
      }
      if (code !== 0) {
        console.error(`[formats] yt-dlp exited with code ${code}`, errorData);
        return res.status(500).json({ error: `yt-dlp exited with code ${code}` });
      }
      
      try {
        const info = JSON.parse(jsonData);
        
        // Get video-only formats (higher quality) and combined formats
        const videoFormats = info.formats
          .filter((f: any) => f.vcodec !== 'none' && f.height && (f.ext === 'mp4' || f.ext === 'webm'))
          .map((f: any) => ({
            format_id: f.format_id,
            label: `${f.height}p${f.fps > 30 ? f.fps : ''}`,
            height: f.height,
            hasAudio: f.acodec !== 'none',
            ext: f.ext
          }))
          .sort((a: any, b: any) => b.height - a.height);
        
        // Remove duplicates based on height and keep the best format for each resolution
        const uniqueFormats = videoFormats.reduce((acc: any[], current: any) => {
          const existing = acc.find((item) => item.label === current.label);
          if (!existing) {
            acc.push(current);
          } else if (current.hasAudio && !existing.hasAudio) {
            // Prefer formats with audio if available
            const index = acc.findIndex((item) => item.label === current.label);
            acc[index] = current;
          }
          return acc;
        }, []);
        
        // If we need to use video-only formats, we'll use format selection that combines with best audio
        const formatsForUser = uniqueFormats.map((f: any) => ({
          format_id: f.hasAudio ? f.format_id : `${f.format_id}+bestaudio`,
          label: f.label
        }));
        
        return res.json({ formats: formatsForUser });
      } catch (e) {
          console.error('[formats] JSON parse error', e);
          return res.status(500).json({ error: 'Failed to parse yt-dlp output'});
      }
    });

    yt.on('error', (err) => {
        clearTimeout(timeout);
        console.error('[formats] yt-dlp spawn error', err);
        return res.status(500).json({ error: 'Failed to start yt-dlp process' });
    });

  } catch (err: unknown) {
    console.error(`[formats] failed`, err);
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: message });
  }
});

app.get("/", (req, res) => res.send("Server is alive!"));

// Test Supabase connection
app.get("/api/test-supabase", async (req, res) => {
  try {
    console.log("Testing Supabase connection...");
    console.log("Bucket name:", bucketName);
    
    // Test bucket access
    const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
    if (bucketError) {
      console.error("Bucket list error:", bucketError);
      return res.status(500).json({ error: "Failed to list buckets", details: bucketError });
    }
    
    console.log("Available buckets:", buckets?.map(b => b.name));
    
    // Test bucket contents
    const { data: files, error: fileError } = await supabase.storage.from(bucketName).list();
    if (fileError) {
      console.error("File list error:", fileError);
      return res.status(500).json({ error: "Failed to list files", details: fileError });
    }
    
    console.log("Files in bucket:", files?.map(f => f.name));
    
    return res.json({ 
      success: true, 
      bucketName,
      buckets: buckets?.map(b => b.name),
      files: files?.map(f => f.name)
    });
  } catch (err) {
    console.error("Supabase test error:", err);
    return res.status(500).json({ error: "Supabase test failed", details: err });
  }
});

// Clean up old job files on startup
function cleanupOldJobs() {
  try {
    const jobFiles = fs.readdirSync(jobsDir);
    const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago
    
    jobFiles.forEach(file => {
      try {
        const filePath = path.join(jobsDir, file);
        const stats = fs.statSync(filePath);
        if (stats.mtime.getTime() < cutoffTime) {
          fs.unlinkSync(filePath);
          console.log(`Cleaned up old job file: ${file}`);
        }
      } catch (err) {
        console.error(`Error cleaning up job file ${file}:`, err);
      }
    });
  } catch (err) {
    console.error('Error during job cleanup:', err);
  }
}

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
  console.log(`CORS origin: ${allowedOrigin}`);
  cleanupOldJobs();
});
