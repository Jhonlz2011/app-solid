import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../config/env';

// S3 Client for R2 Private Bucket
const r2PrivateClient = new S3Client({
    endpoint: env.R2_ENDPOINT_PRIVATE,
    credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID_PRIVATE,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY_PRIVATE,
    },
    region: 'auto',
    forcePathStyle: true,
});

/**
 * Service to manage tenant private files in Cloudflare R2 (`zelys-erp-private`)
 * using presigned URLs for client-side uploads and secure reads.
 */
export const privateStorageService = {
    /**
     * Generates a Presigned PUT URL for client-side image/file uploads directly to R2.
     * Presigned URL expires in 15 minutes (900 seconds).
     */
    getPresignedUploadUrl: async ({ companySlug, fileName, contentType }: {
        companySlug: string;
        fileName: string;
        contentType: string;
    }) => {
        const extension = fileName.includes('.') ? fileName.split('.').pop() : 'webp';
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(2, 9);
        const fileKey = `t/${companySlug}/products/${timestamp}-${randomStr}.${extension}`;

        const bucketName = env.R2_BUCKET_NAME_PRIVATE || 'zelys-erp-private';

        const command = new PutObjectCommand({
            Bucket: bucketName,
            Key: fileKey,
            ContentType: contentType || 'image/webp',
            CacheControl: 'public, max-age=31536000, immutable',
        });

        // Generate signed URL (expires in 15 minutes = 900 seconds)
        const uploadUrl = await getSignedUrl(r2PrivateClient, command, { expiresIn: 900 });

        // Public/CDN URL for stored asset
        const cdnUrl = env.NEXT_PUBLIC_CDN_URL || 'https://cdn.zelys.app';
        const publicUrl = `${cdnUrl}/${fileKey}`;

        return {
            uploadUrl,
            fileKey,
            publicUrl,
        };
    },

    /**
     * Generates a Presigned GET URL for viewing a private object securely (expires in 1 hour).
     */
    getPresignedViewUrl: async (fileKey: string) => {
        const bucketName = env.R2_BUCKET_NAME_PRIVATE || 'zelys-erp-private';

        const command = new GetObjectCommand({
            Bucket: bucketName,
            Key: fileKey,
        });

        return await getSignedUrl(r2PrivateClient, command, { expiresIn: 3600 });
    },

    /**
     * Deletes an object from the private R2 bucket.
     */
    deleteObject: async (fileKeyOrUrl: string) => {
        if (!fileKeyOrUrl) return;

        const cdnUrl = env.NEXT_PUBLIC_CDN_URL;
        let fileKey = fileKeyOrUrl;

        // If a full CDN URL was passed, extract the key relative path
        if (cdnUrl && fileKeyOrUrl.startsWith(cdnUrl)) {
            fileKey = fileKeyOrUrl.replace(`${cdnUrl}/`, '').split('?')[0];
        }

        try {
            await r2PrivateClient.send(new DeleteObjectCommand({
                Bucket: env.R2_BUCKET_NAME_PRIVATE || 'zelys-erp-private',
                Key: fileKey,
            }));
        } catch (err) {
            console.warn('[Private R2] Failed to delete object:', fileKey, err);
        }
    },
};
