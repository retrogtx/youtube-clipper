import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import { promisify } from "util";

const unlinkAsync = promisify(fs.unlink);

dotenv.config();

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

interface Job {
  id: string;
  status: 'processing' | 'ready' | 'error';
  filePath?: string;
  error?: string;
}
const jobs = new Map<string, Job>();

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
  jobs.set(id, job);
  console.log(`[job ${id}] created and added to jobs map. Total jobs:`, jobs.size);

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

      job.status = 'ready';
      console.log(`[job ${id}] ready`);
    } catch (err: unknown) {
      console.error(`[job ${id}] failed`, err);
      job.status = 'error';
      const message = err instanceof Error ? err.message : String(err);
      job.error = message;
    }
  })();

  return res.status(202).json({ id });
});

app.get('/api/clip/:id', async (req, res) => {
  const { id } = req.params;
  const { download } = req.query;
  const job = jobs.get(id);
  if (!job) {
    console.log(`[job ${id}] not found in jobs map. Current jobs:`, Array.from(jobs.keys()));
    return res.status(404).json({ error: 'job not found'});
  }

  if (download === '1') {
    if (job.status !== 'ready' || !job.filePath) return res.status(409).json({ status: job.status });
    return res.download(job.filePath, 'clip.mp4', async err => {
      if (err) console.error(`[job ${id}] send error`, err);
      try { if (job.filePath) await unlinkAsync(job.filePath); } catch {}
      jobs.delete(id);
      console.log(`[job ${id}] completed and removed from jobs map. Total jobs:`, jobs.size);
    });
  }

  return res.json({ status: job.status, error: job.error });
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
    
    const yt = spawn(ytDlpPath, ytArgs);
    
    let jsonData = '';
    yt.stdout.on('data', (data) => {
      jsonData += data.toString();
    });

    let errorData = '';
    yt.stderr.on('data', (data) => {
        errorData += data.toString();
    });

    yt.on('close', (code) => {
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

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
