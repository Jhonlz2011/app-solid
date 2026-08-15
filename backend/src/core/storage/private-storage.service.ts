import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../../config/env';

const r2PrivateClient = new S3Client({
    endpoint: env.R2_ENDPOINT_PRIVATE,
    credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID_PRIVATE,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY_PRIVATE,
    },
    region: 'auto',
    forcePathStyle: true,
});

export const privateStorageService = {
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

        const uploadUrl = await getSignedUrl(r2PrivateClient as any, command, { expiresIn: 900 });
        const cdnUrl = env.NEXT_PUBLIC_CDN_URL || 'https://cdn.zelys.app';
        const publicUrl = `${cdnUrl}/${fileKey}`;

        return {
            uploadUrl,
            fileKey,
            publicUrl,
        };
    },

    getPresignedViewUrl: async (fileKey: string) => {
        const bucketName = env.R2_BUCKET_NAME_PRIVATE || 'zelys-erp-private';

        const command = new GetObjectCommand({
            Bucket: bucketName,
            Key: fileKey,
        });

        return await getSignedUrl(r2PrivateClient as any, command, { expiresIn: 3600 });
    },

    deleteObject: async (fileKeyOrUrl: string) => {
        if (!fileKeyOrUrl) return;

        const cdnUrl = env.NEXT_PUBLIC_CDN_URL;
        let fileKey = fileKeyOrUrl;

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
