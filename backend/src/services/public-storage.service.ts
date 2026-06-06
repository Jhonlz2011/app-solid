import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
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

export const publicStorageService = {
  optimizeAndUploadLogo: async ({ tenantId, rawFileBuffer }: { tenantId: string; rawFileBuffer: Buffer }) => {
    // Sharp Pipeline: resize max width 400px (withoutEnlargement), strip EXIF, convert to webp quality 85
    const optimizedBuffer = await sharp(rawFileBuffer)
      .resize({
        width: 400,
        withoutEnlargement: true,
      })
      .webp({ quality: 85 })
      .toBuffer();

    const bucketName = env.R2_BUCKET_NAME;
    const key = `tenants/${tenantId}/public/logo_login.webp`;

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
    const timestamp = Date.now();
    return `${cdnUrl}/${key}?t=${timestamp}`;
  },

  optimizeAndUploadLoginBg: async ({ tenantId, rawFileBuffer }: { tenantId: string; rawFileBuffer: Buffer }) => {
    // Sharp Pipeline: resize max width 1920px (withoutEnlargement), strip EXIF, convert to webp quality 80
    const optimizedBuffer = await sharp(rawFileBuffer)
      .resize({
        width: 1920,
        withoutEnlargement: true,
      })
      .webp({ quality: 80 })
      .toBuffer();

    const bucketName = env.R2_BUCKET_NAME;
    const key = `tenants/${tenantId}/public/login_bg.webp`;

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
    const timestamp = Date.now();
    return `${cdnUrl}/${key}?t=${timestamp}`;
  }
};
