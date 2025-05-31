import express from "express";
import cors from "cors";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import { promisify } from "util";

const unlinkAsync = promisify(fs.unlink);

const app = express(); // HTTP server
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Health check endpoint
app.get("/", (req, res) => res.send("Server is alive!"));

// Video clipping endpoint using only yt-dlp
app.post("/api/clip", async (req, res) => {
  const timestamp = Date.now();
  const outputPath = path.join(uploadsDir, `clip-${timestamp}.mp4`);

  try {
    const { url, startTime, endTime } = req.body;

    // Validate inputs
    if (!url || !startTime || !endTime) {
      return res.status(400).json({
        error: "url, startTime, and endTime are required",
      });
    }

    console.log(`Attempting to download and clip video from ${url}`);
    console.log(`Output path: ${outputPath}`);

    // Format the download section string for yt-dlp
    const section = `*${startTime}-${endTime}`;
    
    // Get absolute path to cookies file
    const cookiesFilePath = path.join(__dirname, "../src/cookies.txt");
    
    // Build yt-dlp arguments
    const ytDlpArgs = [
      url,
      "-f", 
      "bestvideo[protocol=https][ext=mp4]+bestaudio[protocol=https][ext=m4a]/bestvideo[protocol=https][ext=webm]+bestaudio[protocol=https][ext=webm]/bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo[ext=webm]+bestaudio[ext=webm]/best",
      "--download-sections", 
      section,
      "-o", 
      outputPath,
      "--no-check-certificates",
      "--no-warnings",
      "--add-header", 
      "referer:youtube.com",
      "--add-header", 
      "user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "--merge-output-format", 
      "mp4",
      "--verbose",
      "--no-playlist",
      "--extractor-retries", "3",
      "--ignore-errors",
      "--no-check-certificate",
      "--geo-bypass",
    ];

    // Add cookies argument if cookies.txt exists
    if (fs.existsSync(cookiesFilePath)) {
      console.log(`Using cookies from: ${cookiesFilePath}`);
      // Verify cookies file is readable
      try {
        const cookiesContent = fs.readFileSync(cookiesFilePath, 'utf8');
        console.log(`Cookies file loaded successfully. Size: ${cookiesContent.length} bytes`);
        if (cookiesContent.length < 10) {
          console.warn("Warning: Cookies file seems too small and may be invalid");
        }
        ytDlpArgs.push("--cookies", cookiesFilePath);
      } catch (cookieErr: unknown) {
        console.error(`Error reading cookies file: ${cookieErr instanceof Error ? cookieErr.message : String(cookieErr)}`);
      }
    } else {
      console.warn(`Cookies file not found at ${cookiesFilePath}. Proceeding without cookies.`);
    }

    // Execute yt-dlp to download and clip the video in one step
    const ytDlp = spawn("yt-dlp", ytDlpArgs);

    let processStderr = "";
    ytDlp.stderr.on("data", (data) => {
      console.error(`yt-dlp stderr: ${data}`);
      processStderr += data.toString();
    });

    let processStdout = "";
    ytDlp.stdout.on("data", (data) => {
      const output = data.toString();
      console.log(`yt-dlp stdout: ${output}`);
      processStdout += output;
    });

    await new Promise<void>((resolve, reject) => {
      ytDlp.on("close", (code) => {
        if (code === 0) {
          if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
            console.log(`yt-dlp download and clip successful: ${outputPath}`);
            resolve();
          } else {
            console.error(`yt-dlp exited code 0 but output file missing or empty: ${outputPath}`);
            reject(new Error(`yt-dlp indicated success, but no output file was found. Stderr: ${processStderr}`));
          }
        } else {
          console.error(`yt-dlp process exited with code ${code}. Stderr: ${processStderr}`);
          
          // Check if the error is related to bot detection or cookies
          if (processStderr.includes("Sign in to confirm you're not a bot") || 
              processStderr.includes("cookies")) {
            reject(new Error("YouTube bot detection triggered. The cookies file may be expired or invalid."));
          } else {
            reject(new Error(`yt-dlp failed with code ${code}. Stderr: ${processStderr}`));
          }
        }
      });

      ytDlp.on("error", (err) => {
        console.error(`Failed to start yt-dlp process:`, err);
        reject(new Error(`Failed to start yt-dlp: ${err.message}`));
      });
    });

    console.log(`Processing complete. Clip available at: ${outputPath}`);

    // Send the clipped video file as a download
    res.download(outputPath, "clip.mp4", async (err) => {
      if (err) {
        console.error("Error sending file:", err);
      }
      
      // Cleanup after sending
      try {
        if (fs.existsSync(outputPath)) {
          await unlinkAsync(outputPath);
        }
        
        const partFilePath = outputPath + ".part"; 
        if (fs.existsSync(partFilePath)) {
          await unlinkAsync(partFilePath);
        }
        
        console.log("Temporary file cleanup finished.");
      } catch (cleanupErr) {
        console.error("Cleanup error:", cleanupErr);
      }
    });
  } catch (error) {
    console.error("Error during video processing:", error);
    
    let errorMessage = "Failed to process video.";
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    }

    let errorDetails = "No additional details.";
    if (typeof error === 'object' && error !== null) {
      if ('details' in error && typeof error.details === 'string') {
        errorDetails = error.details;
      } else if ('stderr' in error && typeof error.stderr === 'string') {
        errorDetails = error.stderr;
      }
    }

    res.status(500).json({
      error: errorMessage,
      details: errorDetails,
      fullError: JSON.stringify(error, Object.getOwnPropertyNames(error))
    });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
