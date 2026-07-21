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
    const key = `t/${slug}/logo.webp`;

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

  optimizeAndUploadLoginBg: async ({ slug, rawFileBuffer }: { slug: string; rawFileBuffer: Buffer }) => {
    if (rawFileBuffer.length > MAX_BG_SIZE) {
      throw new Error('La imagen de fondo excede el límite de 10MB');
    }

    // Sharp Pipeline: solo optimización a webp (calidad 90), sin redimensionar
    const optimizedBuffer = await sharp(rawFileBuffer)
      .webp({ quality: 90 })
      .toBuffer();

    const bucketName = env.R2_BUCKET_NAME;
    const key = `t/${slug}/login-bg.webp`;

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
