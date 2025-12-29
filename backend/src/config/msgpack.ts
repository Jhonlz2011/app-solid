import { encode, decode } from '@msgpack/msgpack';

/**
 * MessagePack encoder/decoder for high-performance binary serialization
 * Up to 2x faster than JSON with smaller payload sizes
 */
export const msgpack = {
    /**
     * Encode data to MessagePack binary format
     */
    encode: <T>(data: T): Uint8Array => encode(data),

    /**
     * Decode MessagePack binary to object
     */
    decode: <T>(buffer: ArrayLike<number> | BufferSource): T => decode(buffer) as T,

    /**
     * Encode data to Buffer (for Redis storage)
     */
    encodeToBuffer: <T>(data: T): Buffer => Buffer.from(encode(data)),

    /**
     * Decode Buffer from Redis to object
     */
    decodeBuffer: <T>(buffer: Buffer): T => decode(buffer) as T,
};
