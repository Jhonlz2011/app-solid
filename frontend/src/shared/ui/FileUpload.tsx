/**
 * FileUpload — Native file upload with drag-and-drop.
 * Replaces Ark UI FileUpload to avoid state conflicts with TanStack Form.
 * Styled to match the design system.
 */
import { Component, For, Show, splitProps, JSX, createSignal, onCleanup } from 'solid-js';
import { cn } from '../lib/utils';
import { XIcon } from './icons';

// ============================================================================
// TYPES
// ============================================================================
export interface FileUploadProps {
    /** MIME types to accept (e.g., ['image/jpeg', 'image/png']) */
    accept?: string[];
    /** Max number of files */
    maxFiles?: number;
    /** Max file size in bytes */
    maxFileSize?: number;
    /** Callback when NEW files are added */
    onFilesChange?: (files: File[]) => void;
    /** Whether upload is disabled */
    disabled?: boolean;
    /** Extra class */
    class?: string;
    /** Custom label */
    label?: string;
    /** Existing image URLs to display */
    existingUrls?: string[];
    /** Callback to remove an existing URL */
    onRemoveUrl?: (url: string) => void;
    /** Show image previews */
    showPreview?: boolean;
    /** Child content for the dropzone */
    children?: JSX.Element;
}

// ============================================================================
// COMPONENT
// ============================================================================
export const FileUploadDropzone: Component<FileUploadProps> = (rawProps) => {
    const [props, _rest] = splitProps(rawProps, [
        'accept', 'maxFiles', 'maxFileSize', 'onFilesChange',
        'disabled', 'class', 'label', 'existingUrls', 'onRemoveUrl', 'showPreview', 'children',
    ]);

    const [isDragging, setIsDragging] = createSignal(false);
    const [pendingPreviews, setPendingPreviews] = createSignal<Array<{ file: File; url: string }>>([]);
    let fileInputRef!: HTMLInputElement;
    let dragCounter = 0;

    const maxFiles = () => props.maxFiles ?? 5;
    const maxFileSize = () => props.maxFileSize ?? 5 * 1024 * 1024;
    const acceptStr = () => props.accept?.join(',') ?? 'image/*';

    // Cleanup object URLs on unmount
    onCleanup(() => {
        pendingPreviews().forEach(p => URL.revokeObjectURL(p.url));
    });

    const validateAndAddFiles = (files: FileList | File[]) => {
        const fileArray = Array.from(files);
        const currentCount = pendingPreviews().length + (props.existingUrls?.length ?? 0);
        const remaining = maxFiles() - currentCount;

        if (remaining <= 0) return;

        const accepted: File[] = [];
        for (const file of fileArray.slice(0, remaining)) {
            // Check size
            if (file.size > maxFileSize()) continue;
            // Check MIME
            if (props.accept && props.accept.length > 0) {
                const matches = props.accept.some(mime => {
                    if (mime.endsWith('/*')) {
                        return file.type.startsWith(mime.replace('/*', '/'));
                    }
                    return file.type === mime;
                });
                if (!matches) continue;
            }
            accepted.push(file);
        }

        if (accepted.length > 0) {
            // Create preview URLs
            const newPreviews = accepted.map(file => ({
                file,
                url: URL.createObjectURL(file),
            }));
            setPendingPreviews(prev => [...prev, ...newPreviews]);
            props.onFilesChange?.(accepted);
        }
    };

    const removePending = (index: number) => {
        setPendingPreviews(prev => {
            const next = [...prev];
            URL.revokeObjectURL(next[index].url);
            next.splice(index, 1);
            return next;
        });
    };

    // Drag handlers
    const onDragEnter = (e: DragEvent) => {
        e.preventDefault();
        dragCounter++;
        setIsDragging(true);
    };
    const onDragLeave = (e: DragEvent) => {
        e.preventDefault();
        dragCounter--;
        if (dragCounter <= 0) {
            dragCounter = 0;
            setIsDragging(false);
        }
    };
    const onDragOver = (e: DragEvent) => {
        e.preventDefault();
    };
    const onDrop = (e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter = 0;
        setIsDragging(false);
        if (e.dataTransfer?.files) {
            validateAndAddFiles(e.dataTransfer.files);
        }
    };

    const onFileInputChange = (e: Event) => {
        const input = e.currentTarget as HTMLInputElement;
        if (input.files && input.files.length > 0) {
            validateAndAddFiles(input.files);
        }
        // Reset input so same file can be selected again
        input.value = '';
    };

    return (
        <div class={cn("flex flex-col gap-3", props.class)}>
            {/* Label */}
            <Show when={props.label}>
                <label class="text-sm font-medium text-muted ml-1">
                    {props.label}
                </label>
            </Show>

            {/* Hidden native file input */}
            <input
                ref={fileInputRef}
                type="file"
                accept={acceptStr()}
                multiple={maxFiles() > 1}
                class="sr-only"
                onChange={onFileInputChange}
                disabled={props.disabled}
            />

            {/* Dropzone */}
            <div
                role="button"
                tabIndex={0}
                onClick={() => !props.disabled && fileInputRef.click()}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInputRef.click(); } }}
                onDragEnter={onDragEnter}
                onDragLeave={onDragLeave}
                onDragOver={onDragOver}
                onDrop={onDrop}
                class={cn(
                    "relative flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border-2 border-dashed transition-all duration-200 cursor-pointer group",
                    "bg-card-alt/50 border-border hover:border-primary/40 hover:bg-primary/5",
                    isDragging() && "border-primary bg-primary/10 scale-[1.02]",
                    props.disabled && "opacity-50 cursor-not-allowed",
                )}
            >
                <Show when={props.children} fallback={
                    <>
                        {/* Upload icon */}
                        <div class="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 text-primary group-hover:scale-110 transition-transform">
                            <svg class="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width={1.5}>
                                <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                            </svg>
                        </div>
                        <div class="text-center">
                            <p class="text-sm font-medium text-text">
                                Arrastra imágenes aquí
                            </p>
                            <p class="text-xs text-muted mt-1">
                                o haz clic para seleccionar
                            </p>
                        </div>
                        <p class="text-[10px] text-muted/60">
                            JPG, PNG, WebP • Máx. {(maxFileSize() / 1024 / 1024).toFixed(0)}MB • {maxFiles()} archivos
                        </p>
                    </>
                }>
                    {props.children}
                </Show>
            </div>

            {/* Existing URL previews */}
            <Show when={props.existingUrls && props.existingUrls.length > 0}>
                <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <For each={props.existingUrls}>
                        {(url) => (
                            <div class="relative group/img rounded-xl overflow-hidden border border-border bg-card aspect-square">
                                <img
                                    src={url}
                                    alt="Producto"
                                    class="w-full h-full object-cover"
                                    loading="lazy"
                                />
                                <Show when={props.onRemoveUrl}>
                                    <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); props.onRemoveUrl?.(url); }}
                                        class="absolute top-1 right-1 p-1 rounded-lg bg-danger/90 text-white opacity-0 group-hover/img:opacity-100 transition-opacity hover:bg-danger"
                                    >
                                        <XIcon class="size-3" />
                                    </button>
                                </Show>
                            </div>
                        )}
                    </For>
                </div>
            </Show>

            {/* New file previews (from pending uploads) */}
            <Show when={props.showPreview !== false && pendingPreviews().length > 0}>
                <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <For each={pendingPreviews()}>
                        {(preview, index) => (
                            <div class="relative group/item rounded-xl overflow-hidden border border-primary/30 bg-card aspect-square">
                                <img
                                    src={preview.url}
                                    alt={preview.file.name}
                                    class="w-full h-full object-cover"
                                />
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); removePending(index()); }}
                                    class="absolute top-1 right-1 p-1 rounded-lg bg-danger/90 text-white opacity-0 group-hover/item:opacity-100 transition-opacity hover:bg-danger cursor-pointer"
                                >
                                    <XIcon class="size-3" />
                                </button>
                                <div class="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-1.5">
                                    <span class="text-[10px] text-white truncate block">{preview.file.name}</span>
                                </div>
                            </div>
                        )}
                    </For>
                </div>
            </Show>
        </div>
    );
};

export default FileUploadDropzone;
