import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Step 1: Get the job status and public URL from backend
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
    const statusRes = await fetch(`${backendUrl}/api/clip/${id}`);
    
    if (!statusRes.ok) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }
    
    const jobData = await statusRes.json();
    
    if (jobData.status !== 'ready' || !jobData.url) {
      return NextResponse.json({ error: 'Job not ready' }, { status: 409 });
    }
    
    // Step 2: Download the file from Supabase
    const downloadRes = await fetch(jobData.url);
    if (!downloadRes.ok) {
      return NextResponse.json({ error: 'Failed to download from Supabase' }, { status: 500 });
    }
    
    const blob = await downloadRes.blob();
    
    // Step 3: Clean up the file from Supabase via frontend route
    try {
      const cleanupRes = await fetch(`${request.nextUrl.origin}/api/clip/${id}/cleanup`, {
        method: 'DELETE'
      });
      
      if (!cleanupRes.ok) {
        console.warn(`Failed to clean up job ${id}:`, await cleanupRes.text());
      } else {
        console.log(`Successfully cleaned up job ${id}`);
      }
    } catch (cleanupErr) {
      console.error(`Cleanup error for job ${id}:`, cleanupErr);
    }
    
    // Step 4: Return the file to the client
    return new NextResponse(blob, {
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Disposition': 'attachment; filename="clip.mp4"',
      },
    });
    
  } catch (error) {
    console.error('Download route error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 