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

app.post("/api/clip", async (req, res) => {
  const { url, startTime, endTime, subtitles } = req.body || {};
  if (!url || !startTime || !endTime) {
    return res.status(400).json({ error: "url, startTime, and endTime are required" });
  }

  const id = createJobId();
  const outputPath = path.join(uploadsDir, `clip-${id}.mp4`);
  const job: Job = { id, status: 'processing', filePath: outputPath };
  jobs.set(id, job);

  (async () => {
    try {
      const section = `*${startTime}-${endTime}`;
      const cookiesFilePath = path.join(__dirname, "../src/cookies.txt");

      const ytArgs = [
        url,
        "-f",
        "bv[ext=mp4][vcodec^=avc1][height<=2160][fps<=60]+ba[ext=m4a][acodec^=mp4a]/best[ext=mp4][vcodec^=avc1]",
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
        yt.on('close', code => {
          if (code === 0) resolve();
          else reject(new Error(`yt-dlp exited ${code}`));
        });
        yt.on('error', reject);
      });

      const fastPath = path.join(uploadsDir, `clip-${id}-fast.mp4`);
      const subPath = outputPath.replace(/\.mp4$/, ".en.vtt");
      const subtitlesExist = fs.existsSync(subPath);

      await new Promise<void>((resolve, reject) => {
        const ffmpegArgs = [
          '-y',
          '-i', outputPath,
        ];

        if (subtitles && subtitlesExist) {
          console.log(`[job ${id}] burning subtitles from ${subPath}`);
          ffmpegArgs.push(
            '-vf', `subtitles=${subPath}`,
            '-c:a', 'copy'
          );
        } else {
          ffmpegArgs.push('-c', 'copy');
        }

        ffmpegArgs.push(
          '-movflags', '+faststart',
          fastPath
        );

        console.log(`[job ${id}] running ffmpeg`, ffmpegArgs.join(' '));
        const ff = spawn('ffmpeg', ffmpegArgs);
        ff.stderr.on('data', d => console.error(`[job ${id}] ffmpeg`, d.toString()));
        ff.on('close', c => c === 0 ? resolve() : reject(new Error(`ffmpeg exited ${c}`)));
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
  if (!job) return res.status(404).json({ error: 'job not found'});

  if (download === '1') {
    if (job.status !== 'ready' || !job.filePath) return res.status(409).json({ status: job.status });
    return res.download(job.filePath, 'clip.mp4', async err => {
      if (err) console.error(`[job ${id}] send error`, err);
      try { if (job.filePath) await unlinkAsync(job.filePath); } catch {}
      jobs.delete(id);
    });
  }

  return res.json({ status: job.status, error: job.error });
});

app.get("/", (req, res) => res.send("Server is alive!"));

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
