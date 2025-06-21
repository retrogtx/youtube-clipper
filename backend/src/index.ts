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

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Job storage (in-memory). For production you might switch to Redis or DB.
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

// Kick-off clip creation – returns a job id immediately
app.post("/api/clip", async (req, res) => {
  const { url, startTime, endTime } = req.body || {};
  if (!url || !startTime || !endTime) {
    return res.status(400).json({ error: "url, startTime, and endTime are required" });
  }

  const id = createJobId();
  const outputPath = path.join(uploadsDir, `clip-${id}.mp4`);
  const job: Job = { id, status: 'processing', filePath: outputPath };
  jobs.set(id, job);

  // Start async worker (non-blocking)
  (async () => {
    try {
      const section = `*${startTime}-${endTime}`;
      const cookiesFilePath = path.join(__dirname, "../src/cookies.txt");

      const ytArgs = [
        url,
        "-f",
        "bestvideo[protocol=https][ext=mp4]+bestaudio[protocol=https][ext=m4a]/best[ext=mp4]/best",
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
        "--verbose",
      ];
      if (fs.existsSync(cookiesFilePath)) ytArgs.push("--cookies", cookiesFilePath);

      console.log(`[job ${id}] starting yt-dlp`);
      const yt = spawn(path.resolve(__dirname, '../bin/yt-dlp'), ytArgs);
      yt.stderr.on('data', d => console.error(`[job ${id}]`, d.toString()));

      await new Promise<void>((resolve, reject) => {
        yt.on('close', code => {
          if (code === 0) resolve();
          else reject(new Error(`yt-dlp exited ${code}`));
        });
        yt.on('error', reject);
      });

      // faststart – relocate moov atom to head for compatibility
      const fastPath = path.join(uploadsDir, `clip-${id}-fast.mp4`);
      await new Promise<void>((resolve, reject) => {
        const ff = spawn('ffmpeg', [
          '-y',
          '-i', outputPath,
          '-c', 'copy',
          '-movflags', '+faststart',
          fastPath,
        ]);
        ff.stderr.on('data', d => console.error(`[job ${id}] ffmpeg`, d.toString()));
        ff.on('close', c => c === 0 ? resolve() : reject(new Error(`ffmpeg exited ${c}`)));
        ff.on('error', reject);
      });
      // Replace original
      await fs.promises.unlink(outputPath).catch(()=>{});
      await fs.promises.rename(fastPath, outputPath);

      job.status = 'ready';
      console.log(`[job ${id}] ready`);
    } catch (err: any) {
      console.error(`[job ${id}] failed`, err);
      job.status = 'error';
      job.error = err?.message ?? 'unknown';
    }
  })();

  return res.status(202).json({ id });
});

// Poll job status or download when ready
app.get('/api/clip/:id', async (req, res) => {
  const { id } = req.params;
  const { download } = req.query;
  const job = jobs.get(id);
  if (!job) return res.status(404).json({ error: 'job not found'});

  if (download === '1') {
    if (job.status !== 'ready' || !job.filePath) return res.status(409).json({ status: job.status });
    return res.download(job.filePath, 'clip.mp4', async err => {
      if (err) console.error(`[job ${id}] send error`, err);
      // clean up after send
      try { if (job.filePath) await unlinkAsync(job.filePath); } catch {}
      jobs.delete(id);
    });
  }

  return res.json({ status: job.status, error: job.error });
});

app.get("/", (req, res) => res.send("Server is alive!"));

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
