import { Type, type Static } from '@sinclair/typebox';

// ============================================================================
// STORAGE & PRESIGNED URLS
// ============================================================================

export const PresignedUploadRequestSchema = Type.Object({
    fileName: Type.String({ minLength: 1 }),
    contentType: Type.String({ minLength: 1 }),
});

export const PresignedUploadResponseSchema = Type.Object({
    uploadUrl: Type.String(),
    fileKey: Type.String(),
    publicUrl: Type.String(),
});

export type PresignedUploadRequestType = Static<typeof PresignedUploadRequestSchema>;
export type PresignedUploadResponseType = Static<typeof PresignedUploadResponseSchema>;
