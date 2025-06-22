import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Initialize Supabase client
    const supabaseUrl = process.env.SUPABASE_URL as string;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY as string;
    const bucketName = process.env.SUPABASE_BUCKET || 'videos';
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });
    
    // Verify bucket access first
    console.log(`[cleanup] Verifying access to bucket: ${bucketName}`);
    const { data: bucketList, error: bucketError } = await supabase.storage.listBuckets();
    if (bucketError) {
      console.error(`[cleanup] Bucket access error:`, bucketError);
      return NextResponse.json({ error: 'Cannot access storage buckets' }, { status: 500 });
    }
    
    const targetBucket = bucketList?.find(b => b.name === bucketName);
    if (!targetBucket) {
      console.error(`[cleanup] Bucket ${bucketName} not found. Available buckets:`, bucketList?.map(b => b.name));
      return NextResponse.json({ error: `Bucket ${bucketName} not found` }, { status: 500 });
    }
    
    console.log(`[cleanup] Bucket ${bucketName} found and accessible`);
    
    // Get job info from backend to find the storage path
    const backendUrl = process.env.BACKEND_API_URL || 'http://localhost:3001';
    const statusRes = await fetch(`${backendUrl}/api/clip/${id}`);
    
    if (!statusRes.ok) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }
    
    const jobData = await statusRes.json();
    
    console.log(`[cleanup] Job data for ${id}:`, jobData);
    
    if (!jobData.storagePath) {
      console.error(`[cleanup] No storagePath found for job ${id}`);
      return NextResponse.json({ error: 'No file to clean up' }, { status: 400 });
    }
    
    console.log(`[cleanup] Attempting to delete ${jobData.storagePath} from bucket ${bucketName}`);
    
    // Delete the file from Supabase storage
    const { data: deleteData, error: deleteError } = await supabase.storage
      .from(bucketName)
      .remove([jobData.storagePath]);
    
    console.log(`[cleanup] Supabase delete response:`, { deleteData, deleteError });
    
    if (deleteError) {
      console.error(`[cleanup] Failed to delete ${jobData.storagePath}:`, deleteError);
      return NextResponse.json({ error: 'Failed to delete file from storage' }, { status: 500 });
    }
    
    console.log(`[cleanup] Supabase delete operation completed. Response data:`, deleteData);
    
    // Verify the file was actually deleted
    try {
      const { data: verifyData } = await supabase.storage
        .from(bucketName)
        .list('', {
          search: jobData.storagePath
        });
      
      console.log(`[cleanup] Verification - files matching ${jobData.storagePath}:`, verifyData);
      
      if (verifyData && verifyData.length > 0) {
        console.error(`[cleanup] File still exists after delete operation!`);
        return NextResponse.json({ error: 'File deletion failed - file still exists' }, { status: 500 });
      } else {
        console.log(`[cleanup] Verification successful - file confirmed deleted`);
      }
    } catch (verifyErr) {
      console.warn(`[cleanup] Verification failed:`, verifyErr);
    }
    
    // Tell backend to clean up its job metadata
    try {
      console.log(`[cleanup] Calling backend cleanup for job ${id}`);
      const backendCleanupRes = await fetch(`${backendUrl}/api/clip/${id}/cleanup`, {
        method: 'DELETE'
      });
      
      if (!backendCleanupRes.ok) {
        console.warn(`[cleanup] Backend cleanup failed for ${id}:`, await backendCleanupRes.text());
      } else {
        console.log(`[cleanup] Backend cleanup successful for ${id}`);
      }
    } catch (backendCleanupErr) {
      console.warn(`[cleanup] Backend cleanup error for ${id}:`, backendCleanupErr);
    }
    
    return NextResponse.json({ success: true });
    
  } catch (error) {
    console.error('[cleanup] Route error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 