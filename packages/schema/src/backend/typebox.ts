import { Type as BaseType, type SchemaOptions, type Static, type TSchema, Kind } from '@sinclair/typebox';

export interface FileOptions extends SchemaOptions {
    type?: string | string[];
    minSize?: number | string;
    maxSize?: number | string;
}
/**
 * Extended TypeBox builder that includes Elysia-compatible types:
 * - Type.File()
 * - Type.Files()
 * - Type.BooleanString()
 * - Type.Numeric()
 */
export const Type = Object.assign({}, BaseType, {
    File: (options: FileOptions = {}) =>
        BaseType.Unsafe<File>({
            ...options,
            [Kind]: 'File',
            type: 'file',
        }),
    Files: (options: FileOptions = {}) =>
        BaseType.Unsafe<File[]>({
            ...options,
            [Kind]: 'Files',
            type: 'files',
        }),
    BooleanString: (options: SchemaOptions = {}) =>
        BaseType.Unsafe<boolean>({
            ...options,
            [Kind]: 'BooleanString',
            type: 'boolean',
        }),
    Numeric: (options: SchemaOptions = {}) =>
        BaseType.Unsafe<number>({
            ...options,
            [Kind]: 'Numeric',
            type: 'number',
        }),
});

export { type Static, type TSchema, Kind };
