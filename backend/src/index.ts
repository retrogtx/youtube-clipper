import express from 'express';
import cors from 'cors';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { promisify } from 'util'; // For fs.unlink

const unlinkAsync = promisify(fs.unlink); // Promisify fs.unlink for async cleanup

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

// // Video download endpoint (REMOVED - integrated into /api/clip)
// app.post('/api/download', async (req, res) => { ... });

// Combined video download and clipping endpoint
app.post('/api/clip', async (req, res) => {
  const timestamp = Date.now();
  // Temporary base name for downloaded streams
  const tempVideoPathBase = path.join(uploadsDir, `temp-video-${timestamp}`);
  const tempAudioPathBase = path.join(uploadsDir, `temp-audio-${timestamp}`);
  let tempVideoPath: string | null = null; // Full path including extension
  let tempAudioPath: string | null = null; // Full path including extension

  // Final output path for the clipped file
  const finalOutputPath = path.join(uploadsDir, `clip-${timestamp}.mp4`);

  try {
    const { url, startTime, endTime } = req.body;

    // Validate inputs
    if (!url || !startTime || !endTime) {
      return res.status(400).json({ 
        error: 'url, startTime, and endTime are required' 
      });
    }
     // TODO: Add more robust validation for startTime and endTime formats (e.g., HH:MM:SS.ms)

    console.log(`Attempting to download full video/audio for clipping from ${url}`);
    console.log(`Using temporary video base: ${tempVideoPathBase}`);
    console.log(`Using temporary audio base: ${tempAudioPathBase}`);

    // --- Step 1: Download Full Video and Audio with yt-dlp ---
    // We need two separate calls because yt-dlp doesn't handle multiple -o flags well

    // Function to run a single yt-dlp download process
    const runYtDlpDownload = (format: string, outputPathBase: string): Promise<string> => {
        return new Promise<string>((resolve, reject) => {
            const outputPathTemplate = outputPathBase + '.%(ext)s';
            let detectedPath: string | null = null;
            console.log(`Starting yt-dlp download for format '${format}' to template '${outputPathTemplate}'`);

            const ytDlp = spawn('yt-dlp', [
                url,
                '-f', format,
                '-o', outputPathTemplate,
                '--no-check-certificates',
                '--no-warnings',
                '--add-header', 'referer:youtube.com',
                '--add-header', 'user-agent:Mozilla/5.0',
                '--verbose', // Keep verbose for debugging
            ]);

            let processStderr = '';
            ytDlp.stderr.on('data', (data) => {
                console.error(`yt-dlp stderr (${format}): ${data}`);
                processStderr += data.toString();
            });

            let processStdout = '';
            ytDlp.stdout.on('data', (data) => {
                const output = data.toString();
                console.log(`yt-dlp stdout (${format}): ${output}`);
                processStdout += output;
                // Look for destination message
                const destinationMatch = output.match(/\[download\] Destination: (.+)/);
                if (destinationMatch && destinationMatch[1]) {
                    const filePath = destinationMatch[1].trim();
                     if (filePath.startsWith(outputPathBase)) { // Check if it matches the base path
                        console.log(`Detected download destination (${format}): ${filePath}`);
                        detectedPath = filePath;
                    }
                }
            });

            ytDlp.on('close', (code) => {
                if (code === 0) {
                    // Check if path was detected via stdout
                    if (detectedPath && fs.existsSync(detectedPath)) {
                         console.log(`yt-dlp download successful (${format}): ${detectedPath}`);
                         resolve(detectedPath);
                         return;
                    }
                    // If not detected, try finding file matching the base name
                    console.log(`Could not determine output file from stdout (${format}), attempting to find files...`);
                    try {
                        const files = fs.readdirSync(uploadsDir);
                        const foundFile = files.find(f => f.startsWith(path.basename(outputPathBase)));
                        if (foundFile) {
                            const fullPath = path.join(uploadsDir, foundFile);
                            if (fs.existsSync(fullPath)) {
                                console.log(`Found downloaded file (${format}) by searching: ${fullPath}`);
                                resolve(fullPath);
                                return;
                            }
                        }
                    } catch (findErr) {
                        console.error(`Error searching for downloaded file (${format}):`, findErr);
                        // Fall through to reject
                    }

                    console.error(`yt-dlp process (${format}) exited code 0 but no output file found.`);
                    reject(new Error(`yt-dlp (${format}) indicated success, but no output file was found. Stderr: ${processStderr}`));
                } else {
                    console.error(`yt-dlp process (${format}) exited with code ${code}. Stderr: ${processStderr}`);
                    reject(new Error(`yt-dlp download (${format}) failed with code ${code}. Stderr: ${processStderr}`));
                }
            });

            ytDlp.on('error', (err) => {
                console.error(`Failed to start yt-dlp process (${format}):`, err);
                reject(new Error(`Failed to start yt-dlp (${format}): ${err.message}`));
            });
        });
    };

    // Run downloads in parallel
    try {
        const [videoPath, audioPath] = await Promise.all([
            runYtDlpDownload('best', tempVideoPathBase), // Use 'best' format for video input
            runYtDlpDownload('ba', tempAudioPathBase)  // Best Audio
        ]);
        tempVideoPath = videoPath;
        tempAudioPath = audioPath;
    } catch (downloadError) {
        // If any download fails, Promise.all rejects
        console.error("One or more yt-dlp downloads failed.", downloadError);
        // Ensure the error is thrown to be caught by the main try/catch
        throw downloadError; 
    }

    // --- Step 2: Clip the downloaded files using FFmpeg ---
    if (!tempVideoPath || !tempAudioPath) {
        // This should not happen if yt-dlp promise resolved, but check defensively
        throw new Error('Missing temporary video or audio path after download.');
    }

    console.log(`Clipping video (${tempVideoPath}) and audio (${tempAudioPath}) from ${startTime} to ${endTime} into ${finalOutputPath}`);

    const ffmpeg = spawn('ffmpeg', [
        // Input files (now come first)
        '-i', tempVideoPath,       // Input video file
        '-i', tempAudioPath,       // Input audio file

        // Input options (now placed after -i for accuracy)
        '-ss', startTime,         // Seek to start time (more accurate after -i)
        '-to', endTime,           // Specify end time relative to the start of the input

        // Output options
        '-map', '0:v:0?',       // Map video stream from first input
        '-map', '1:a:0?',       // Map audio stream from second input
        '-c', 'copy',           // Attempt to copy codecs without re-encoding
        '-copyts',              // Try to copy timestamps (may help sync with -ss after -i)
        // '-avoid_negative_ts', 'make_zero', // May help if timestamp issues occur with copy
        '-y',                   // Overwrite output file if it exists
        finalOutputPath         // Output file path
    ]);

    // Alternative ffmpeg command (if -c copy fails or is inaccurate): Re-encode
    // const ffmpeg = spawn('ffmpeg', [
    //     '-i', tempVideoPath,         // Input video file
    //     '-i', tempAudioPath,         // Input audio file
    //     '-ss', startTime,           // Start time for clipping (more accurate when re-encoding)
    //     '-to', endTime,             // End time for clipping
    //     '-map', '0:v:0?',           // Map video stream
    //     '-map', '1:a:0?',           // Map audio stream
    //     '-c:v', 'libx264',         // Re-encode video (e.g., using H.264)
    //     '-crf', '23',               // Constant Rate Factor (lower means better quality, larger file)
    //     '-preset', 'fast',          // Encoding speed vs. compression trade-off
    //     '-c:a', 'aac',             // Re-encode audio (e.g., using AAC)
    //     '-b:a', '128k',            // Audio bitrate
    //     '-y',                       // Overwrite output file
    //     finalOutputPath             // Output file path
    // ]);

    let ffmpegStderr = '';
    ffmpeg.stderr.on('data', (data) => {
        // Log ffmpeg progress/errors - can be very verbose
        // Consider logging only specific lines or summaries in production
        console.log(`ffmpeg: ${data}`); 
        ffmpegStderr += data.toString();
    });

    await new Promise<void>((resolve, reject) => {
        ffmpeg.on('close', (code) => {
            if (code === 0) {
                if (fs.existsSync(finalOutputPath) && fs.statSync(finalOutputPath).size > 0) {
                    console.log('FFmpeg clipping successful.');
                    resolve();
                } else {
                    console.error(`FFmpeg exited code 0 but output file missing or empty: ${finalOutputPath}`);
                    reject(new Error(`FFmpeg clipping failed: Output file missing or empty. Stderr: ${ffmpegStderr}`));
                }
            } else {
                console.error(`FFmpeg process exited with code ${code}. Stderr: ${ffmpegStderr}`);
                reject(new Error(`FFmpeg clipping failed with code ${code}. Stderr: ${ffmpegStderr}`));
            }
        });
         ffmpeg.on('error', (err) => {
            console.error('Failed to start ffmpeg process:', err);
            reject(new Error(`Failed to start ffmpeg: ${err.message}`));
        });
    });


    console.log(`Processing complete. Final clip available at: ${finalOutputPath}`);

    // Send the path of the final clipped video back to the client
    res.json({ 
      success: true, 
      filePath: finalOutputPath, 
      message: 'Video section processed successfully' 
    });

  } catch (error) { // Catch block needs variable name 'error'
    console.error('Error processing video section:', error);
    res.status(500).json({ 
      error: 'Failed to process video section',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  } finally {
      // --- Cleanup Temporary Full Files ---
      const cleanupPromises: Promise<void>[] = [];
      // Use the paths captured during download
      if (tempVideoPath && fs.existsSync(tempVideoPath)) {
          console.log(`Cleaning up temporary video file: ${tempVideoPath}`);
          cleanupPromises.push(unlinkAsync(tempVideoPath).catch(err => console.error(`Failed to delete temp video: ${err}`)));
      }
      if (tempAudioPath && fs.existsSync(tempAudioPath)) {
          console.log(`Cleaning up temporary audio file: ${tempAudioPath}`);
          cleanupPromises.push(unlinkAsync(tempAudioPath).catch(err => console.error(`Failed to delete temp audio: ${err}`)));
      }
      // Also clean up any potentially leftover .part files from ffmpeg if it failed mid-process
      const partFilePath = finalOutputPath + '.part';
       if (fs.existsSync(partFilePath)) {
           console.log(`Cleaning up partial ffmpeg output: ${partFilePath}`);
           cleanupPromises.push(unlinkAsync(partFilePath).catch(err => console.error(`Failed to delete partial file: ${err}`)));
       }

      await Promise.all(cleanupPromises);
      console.log('Temporary file cleanup finished.');
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
