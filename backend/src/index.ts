import express from "express";
import cors from "cors";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import { promisify } from "util"; // For fs.unlink

const unlinkAsync = promisify(fs.unlink); // Promisify fs.unlink for async cleanup

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// // Video download endpoint (REMOVED - integrated into /api/clip)
// app.post('/api/download', async (req, res) => { ... });

// Combined video download and clipping endpoint
app.post("/api/clip", async (req, res) => {
  const timestamp = Date.now();
  // Temporary base name for downloaded stream
  const tempMuxedPathBase = path.join(uploadsDir, `temp-muxed-${timestamp}`);
  let tempMuxedPath: string | null = null; // Full path including extension

  // Final output path for the clipped file
  const finalOutputPath = path.join(uploadsDir, `clip-${timestamp}.mp4`);

  try {
    const { url, startTime, endTime, isCropped } = req.body;

    // Validate inputs
    if (!url || !startTime || !endTime) {
      return res.status(400).json({
        error: "url, startTime, and endTime are required",
      });
    }
    // TODO: Add more robust validation for startTime and endTime formats (e.g., HH:MM:SS.ms)

    console.log(
      `Attempting to download muxed video/audio for clipping from ${url}`
    );
    console.log(`Using temporary muxed base: ${tempMuxedPathBase}`);

    // --- Step 1: Download muxed video+audio with yt-dlp (only the desired segment) ---
    const runYtDlpDownload = (
      outputPathBase: string,
      startTime: string,
      endTime: string
    ): Promise<string> => {
      return new Promise<string>((resolve, reject) => {
        const outputPathTemplate = outputPathBase + ".%(ext)s";
        let detectedPath: string | null = null;
        console.log(
          `Starting yt-dlp partial download for muxed format to template '${outputPathTemplate}'`
        );

        // Format the download section string for yt-dlp
        const section = `*${startTime}-${endTime}`;

        const ytDlp = spawn("yt-dlp", [
          url,
          "-f",
          "bestvideo[protocol=https][ext=mp4]+bestaudio[protocol=https][ext=m4a]/bestvideo[protocol=https][ext=webm]+bestaudio[protocol=https][ext=webm]/bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo[ext=webm]+bestaudio[ext=webm]/best",
          "--download-sections",
          section,
          "-o",
          outputPathTemplate,
          "--no-check-certificates",
          "--no-warnings",
          "--add-header",
          "referer:youtube.com",
          "--add-header",
          "user-agent:Mozilla/5.0",
          "--merge-output-format",
          "mp4",
          "--verbose",
        ]);

        let processStderr = "";
        ytDlp.stderr.on("data", (data) => {
          console.error(`yt-dlp stderr (muxed): ${data}`);
          processStderr += data.toString();
        });

        let processStdout = "";
        ytDlp.stdout.on("data", (data) => {
          const output = data.toString();
          console.log(`yt-dlp stdout (muxed): ${output}`);
          processStdout += output;
          // Look for destination message
          const destinationMatch = output.match(
            /\[download\] Destination: (.+)/
          );
          if (destinationMatch && destinationMatch[1]) {
            const filePath = destinationMatch[1].trim();
            if (filePath.startsWith(outputPathBase)) {
              console.log(`Detected download destination (muxed): ${filePath}`);
              detectedPath = filePath;
            }
          }
        });

        ytDlp.on("close", (code) => {
          if (code === 0) {
            if (detectedPath && fs.existsSync(detectedPath)) {
              console.log(
                `yt-dlp download successful (muxed): ${detectedPath}`
              );
              resolve(detectedPath);
              return;
            }
            // If not detected, try finding file matching the base name
            console.log(
              `Could not determine output file from stdout (muxed), attempting to find files...`
            );
            try {
              const files = fs.readdirSync(uploadsDir);
              const foundFile = files.find((f) =>
                f.startsWith(path.basename(outputPathBase))
              );
              if (foundFile) {
                const fullPath = path.join(uploadsDir, foundFile);
                if (fs.existsSync(fullPath)) {
                  console.log(
                    `Found downloaded file (muxed) by searching: ${fullPath}`
                  );
                  resolve(fullPath);
                  return;
                }
              }
            } catch (findErr) {
              console.error(
                `Error searching for downloaded file (muxed):`,
                findErr
              );
            }
            console.error(
              `yt-dlp process (muxed) exited code 0 but no output file found.`
            );
            reject(
              new Error(
                `yt-dlp (muxed) indicated success, but no output file was found. Stderr: ${processStderr}`
              )
            );
          } else {
            console.error(
              `yt-dlp process (muxed) exited with code ${code}. Stderr: ${processStderr}`
            );
            reject(
              new Error(
                `yt-dlp download (muxed) failed with code ${code}. Stderr: ${processStderr}`
              )
            );
          }
        });

        ytDlp.on("error", (err) => {
          console.error(`Failed to start yt-dlp process (muxed):`, err);
          reject(new Error(`Failed to start yt-dlp (muxed): ${err.message}`));
        });
      });
    };

    // Download muxed file (only the segment)
    try {
      tempMuxedPath = await runYtDlpDownload(
        tempMuxedPathBase,
        startTime,
        endTime
      );
    } catch (downloadError) {
      console.error("yt-dlp muxed download failed.", downloadError);
      throw downloadError;
    }

    // --- Step 2: Optionally, do a final trim with FFmpeg for frame accuracy ---
    if (!tempMuxedPath) {
      throw new Error("Missing temporary muxed path after download.");
    }

    // If you want to skip FFmpeg and just return the yt-dlp output, you can do so here.
    // But for frame-accurate trimming, use FFmpeg as before:
    console.log(
      `Clipping muxed file (${tempMuxedPath}) from ${startTime} to ${endTime} into ${finalOutputPath}`
    );

    // Re-encode for Twitter compatibility
    const ffmpegArgs = ["-i", tempMuxedPath];

    if (isCropped) {
      ffmpegArgs.push(
        "-vf",
        "crop='min(in_w,in_h*9/16)':'min(in_h,in_w*16/9)',scale=1080:1920"
      );
    }

    ffmpegArgs.push(
      "-c:v", "libx264",
      "-profile:v", "high",
      "-level", "4.0",
      "-pix_fmt", "yuv420p",
      "-c:a", "aac",
      "-b:a", "128k",
      "-movflags", "+faststart",
      "-y",
      finalOutputPath
    );

    const ffmpeg = spawn("ffmpeg", ffmpegArgs);

    let ffmpegStderr = "";
    ffmpeg.stderr.on("data", (data) => {
      console.log(`ffmpeg: ${data}`);
      ffmpegStderr += data.toString();
    });

    await new Promise<void>((resolve, reject) => {
      ffmpeg.on("close", (code) => {
        if (code === 0) {
          if (
            fs.existsSync(finalOutputPath) &&
            fs.statSync(finalOutputPath).size > 0
          ) {
            console.log("FFmpeg remux successful.");
            resolve();
          } else {
            console.error(
              `FFmpeg exited code 0 but output file missing or empty: ${finalOutputPath}`
            );
            reject(
              new Error(
                `FFmpeg remux failed: Output file missing or empty. Stderr: ${ffmpegStderr}`
              )
            );
          }
        } else {
          console.error(
            `FFmpeg process exited with code ${code}. Stderr: ${ffmpegStderr}`
          );
          reject(
            new Error(
              `FFmpeg remux failed with code ${code}. Stderr: ${ffmpegStderr}`
            )
          );
        }
      });
      ffmpeg.on("error", (err) => {
        console.error("Failed to start ffmpeg process:", err);
        reject(new Error(`Failed to start ffmpeg: ${err.message}`));
      });
    });

    console.log(
      `Processing complete. Final clip available at: ${finalOutputPath}`
    );

    // Send the final clipped video file as a download
    res.download(finalOutputPath, "clip.mp4", async (err) => {
      if (err) {
        console.error("Error sending file:", err);
        // Don't send another response, just log
      }
      // Cleanup after sending
      try {
        if (fs.existsSync(finalOutputPath)) {
          await unlinkAsync(finalOutputPath);
        }
        if (tempMuxedPath && fs.existsSync(tempMuxedPath)) {
          await unlinkAsync(tempMuxedPath);
        }
        const partFilePath = finalOutputPath + ".part";
        if (fs.existsSync(partFilePath)) {
          await unlinkAsync(partFilePath);
        }
        console.log("Temporary file cleanup finished.");
      } catch (cleanupErr) {
        console.error("Cleanup error:", cleanupErr);
      }
    });
    return;
  } catch (error) {
    // Catch block needs variable name 'error'
    console.error("Error processing video section:", error);
    res.status(500).json({
      error: "Failed to process video section",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
