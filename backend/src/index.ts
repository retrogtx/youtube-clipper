import express from 'express';
import cors from 'cors';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Video download endpoint
app.post('/api/download', async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    // Generate a unique filename
    const timestamp = Date.now();
    const outputPath = path.join(uploadsDir, `video-${timestamp}.mp4`);

    // Download the video using yt-dlp
    const ytDlp = spawn('yt-dlp', [
      url,
      '--output', outputPath,
      '--format', 'best',
      '--no-check-certificates',
      '--no-warnings',
      '--prefer-free-formats',
      '--add-header', 'referer:youtube.com',
      '--add-header', 'user-agent:Mozilla/5.0'
    ]);

    // Handle the download process
    await new Promise((resolve, reject) => {
      ytDlp.stdout.on('data', (data) => {
        console.log(`yt-dlp stdout: ${data}`);
      });

      ytDlp.stderr.on('data', (data) => {
        console.error(`yt-dlp stderr: ${data}`);
      });

      ytDlp.on('close', (code) => {
        if (code === 0) {
          resolve(undefined);
        } else {
          reject(new Error(`yt-dlp process exited with code ${code}`));
        }
      });
    });

    // Send the file path back to the client
    res.json({ 
      success: true, 
      filePath: outputPath,
      message: 'Video downloaded successfully' 
    });

  } catch (error) {
    console.error('Error downloading video:', error);
    res.status(500).json({ 
      error: 'Failed to download video',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
