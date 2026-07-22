import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import { env } from '../config/env';

const r2Client = new S3Client({
  endpoint: env.R2_ENDPOINT,
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  },
  region: 'auto',
  forcePathStyle: true,
});

// Max upload size limits
const MAX_LOGO_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_BG_SIZE = 10 * 1024 * 1024; // 10MB

export const publicStorageService = {
  optimizeAndUploadLogo: async ({ slug, rawFileBuffer }: { slug: string; rawFileBuffer: Buffer }) => {
    if (rawFileBuffer.length > MAX_LOGO_SIZE) {
      throw new Error('El archivo del logo excede el límite de 5MB');
    }

    // Sharp Pipeline: resize max width 400px (withoutEnlargement), strip EXIF, convert to webp quality 85
    const optimizedBuffer = await sharp(rawFileBuffer)
      .resize({
        width: 400,
        withoutEnlargement: true,
      })
      .webp({ quality: 95 })
      .toBuffer();

    const bucketName = env.R2_BUCKET_NAME;
    const timestamp = Date.now();
    const key = `t/${slug}/logo-${timestamp}.webp`;

    await r2Client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: optimizedBuffer,
        ContentType: 'image/webp',
        CacheControl: 'public, max-age=31536000, immutable',
      })
    );

    const cdnUrl = env.NEXT_PUBLIC_CDN_URL;
    return `${cdnUrl}/${key}`;
  },

  optimizeAndUploadLoginBg: async ({ slug, rawFileBuffer, crop, transforms }: { 
    slug: string; 
    rawFileBuffer: Buffer; 
    crop?: { left: number; top: number; width: number; height: number };
    transforms?: { rotate?: number; flipX?: boolean; flipY?: boolean };
  }) => {
    if (rawFileBuffer.length > MAX_BG_SIZE) {
      throw new Error('La imagen de fondo excede el límite de 10MB');
    }

    // Get original metadata for bounds validation
    const metadata = await sharp(rawFileBuffer).metadata();
    let imgW = metadata.width ?? 0;
    let imgH = metadata.height ?? 0;

    let pipeline = sharp(rawFileBuffer);
    
    // Apply transforms BEFORE crop
    if (transforms?.flipX) pipeline = pipeline.flop();
    if (transforms?.flipY) pipeline = pipeline.flip();
    if (transforms?.rotate) {
        pipeline = pipeline.rotate(transforms.rotate);
        // After 90/270 rotation, width and height swap
        if (transforms.rotate % 180 !== 0) {
            [imgW, imgH] = [imgH, imgW];
        }
    }

    // Validate and apply crop with bounds checking
    if (crop) {
        const safeLeft = Math.max(0, Math.min(crop.left, imgW - 1));
        const safeTop = Math.max(0, Math.min(crop.top, imgH - 1));
        const safeWidth = Math.min(crop.width, imgW - safeLeft);
        const safeHeight = Math.min(crop.height, imgH - safeTop);
        
        if (safeWidth > 0 && safeHeight > 0) {
            pipeline = pipeline.extract({ left: safeLeft, top: safeTop, width: safeWidth, height: safeHeight });
        }
    }

    const optimizedBuffer = await pipeline
      .webp({ quality: 90 })
      .toBuffer();

    const bucketName = env.R2_BUCKET_NAME;
    const timestamp = Date.now();
    const key = `t/${slug}/login-bg-${timestamp}.webp`;

    await r2Client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: optimizedBuffer,
        ContentType: 'image/webp',
        CacheControl: 'public, max-age=31536000, immutable',
      })
    );

    const cdnUrl = env.NEXT_PUBLIC_CDN_URL;
    return `${cdnUrl}/${key}`;
  },

  deleteObject: async (url: string) => {
    const cdnUrl = env.NEXT_PUBLIC_CDN_URL;
    if (!url || !url.startsWith(cdnUrl)) return;
    const key = url.replace(`${cdnUrl}/`, '').split('?')[0];
    try {
        await r2Client.send(new DeleteObjectCommand({
            Bucket: env.R2_BUCKET_NAME,
            Key: key,
        }));
    } catch (err) {
        console.warn('[R2] Failed to delete object:', key, err);
    }
  }
};
