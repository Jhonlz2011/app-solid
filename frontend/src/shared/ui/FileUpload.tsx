/**
 * FileUpload — Native file upload with drag-and-drop.
 * Replaces Ark UI FileUpload to avoid state conflicts with TanStack Form.
 * Styled to match the design system.
 * Updated: Integrated with Ark UI Image Cropper for advanced cropping before uploading.
 */
import { Component, For, Show, splitProps, JSX, createSignal, onCleanup, createUniqueId } from 'solid-js';
import { ImageCropper } from '@ark-ui/solid';
import Modal from './Modal';
import { cn } from '../lib/utils';
import { XIcon, RectangleHorizontalIcon, SquareIcon, RectangleVerticalIcon } from './icons';
import { SegmentedControl, SegmentedControlItem, SegmentedControlItemLabel, SegmentedControlIndicator, SegmentedControlItemInput } from './SegmentedControl';

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
    /** Enable image cropping before file is added */
    crop?: boolean;
    /** Crop area shape ('rectangle' | 'circle') */
    cropShape?: 'rectangle' | 'circle';
    /** Lock aspect ratio for crop area (e.g., 1 for 1:1, 1.77 for 16:9) */
    cropAspectRatio?: number;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export const FileUploadDropzone: Component<FileUploadProps> = (rawProps) => {
    const [props, _rest] = splitProps(rawProps, [
        'accept', 'maxFiles', 'maxFileSize', 'onFilesChange',
        'disabled', 'class', 'label', 'existingUrls', 'onRemoveUrl', 'showPreview', 'children',
        'crop', 'cropShape', 'cropAspectRatio',
    ]);

    const [isDragging, setIsDragging] = createSignal(false);
    const [pendingPreviews, setPendingPreviews] = createSignal<Array<{ file: File; url: string }>>([]);
    
    // Cropper State
    const [cropImageSrc, setCropImageSrc] = createSignal<string | null>(null);
    const [cropFileName, setCropFileName] = createSignal<string>('image.webp');
    const [cropFileType, setCropFileType] = createSignal<string>('image/webp');
    const [isCropping, setIsCropping] = createSignal(false);
    const [isOwnCropUrl, setIsOwnCropUrl] = createSignal(false);

    let fileInputRef!: HTMLInputElement;
    let dragCounter = 0;

    const maxFiles = () => props.maxFiles ?? 5;
    const maxFileSize = () => props.maxFileSize ?? 5 * 1024 * 1024;
    const acceptStr = () => props.accept?.join(',') ?? 'image/*';

    // Cleanup object URLs on unmount
    onCleanup(() => {
        pendingPreviews().forEach(p => URL.revokeObjectURL(p.url));
        if (cropImageSrc() && isOwnCropUrl()) {
            URL.revokeObjectURL(cropImageSrc()!);
        }
    });

    const validateAndAddFiles = (files: FileList | File[]) => {
        const fileArray = Array.from(files);

        // If crop is enabled, handle single image crop flow
        if (props.crop && fileArray.length > 0 && fileArray[0].type.startsWith('image/')) {
            const file = fileArray[0];
            // Validate size before cropping
            if (file.size > maxFileSize()) {
                console.warn('File too large');
                return;
            }
            
            // Clean up previous crop image source if it exists
            if (cropImageSrc() && isOwnCropUrl()) {
                URL.revokeObjectURL(cropImageSrc()!);
            }

            setCropFileName(file.name);
            setCropFileType(file.type);
            setCropImageSrc(URL.createObjectURL(file));
            setIsOwnCropUrl(true);
            setIsCropping(true);
            return;
        }

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
                multiple={maxFiles() > 1 && !props.crop}
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
                    <Show
                        when={maxFiles() === 1 && (props.existingUrls?.length || pendingPreviews().length) > 0}
                        fallback={
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
                        }
                    >
                        {/* Single File Preview Content COVERING the Dropzone */}
                        <div class="absolute inset-0 w-full h-full">
                            <img
                                src={props.existingUrls?.[0] || pendingPreviews()[0]?.url}
                                class="w-full h-full object-cover rounded-2xl"
                                alt="Vista previa"
                            />
                            {/* Overlay on hover */}
                            <div class="absolute inset-0 bg-black/40 backdrop-blur-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2.5 rounded-2xl">
                                <span class="px-2.5 py-1.5 rounded-xl bg-white/95 text-text text-[11px] font-bold shadow-sm">
                                    Cambiar
                                </span>
                                <Show when={props.crop}>
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            const url = props.existingUrls?.[0] || pendingPreviews()[0]?.url;
                                            const file = pendingPreviews()[0]?.file;
                                            setCropFileName(file?.name || 'logo.png');
                                            setCropFileType(file?.type || 'image/png');
                                            setCropImageSrc(url);
                                            setIsOwnCropUrl(false);
                                            setIsCropping(true);
                                        }}
                                        class="p-2 rounded-xl bg-primary text-white shadow-sm hover:bg-primary-strong transition-all hover:scale-105 active:scale-95 cursor-pointer flex items-center justify-center"
                                        title="Recortar / Ajustar"
                                    >
                                        <svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width={2}>
                                            <path stroke-linecap="round" stroke-linejoin="round" d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z" />
                                        </svg>
                                    </button>
                                </Show>
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (props.existingUrls?.length) {
                                            props.onRemoveUrl?.(props.existingUrls[0]);
                                        } else {
                                            removePending(0);
                                        }
                                    }}
                                    class="p-2 rounded-xl bg-danger text-white shadow-sm hover:bg-danger-strong transition-all hover:scale-105 active:scale-95 cursor-pointer flex items-center justify-center"
                                    title="Eliminar"
                                >
                                    <XIcon class="size-4" />
                                </button>
                            </div>
                        </div>
                    </Show>
                }>
                    {props.children}
                </Show>
            </div>

            {/* Existing URL previews */}
            <Show when={props.existingUrls && props.existingUrls.length > 0 && maxFiles() > 1}>
                <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <For each={props.existingUrls}>
                        {(url) => (
                            <div class="relative group/img rounded-xl overflow-hidden border border-border bg-card aspect-square">
                                <img
                                    src={url}
                                    alt="Vista previa"
                                    class="w-full h-full object-cover"
                                    loading="lazy"
                                />
                                <Show when={props.onRemoveUrl}>
                                    <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); props.onRemoveUrl?.(url); }}
                                        class="absolute top-1 right-1 p-1 rounded-lg bg-danger/90 text-white opacity-0 group-hover/img:opacity-100 transition-opacity hover:bg-danger cursor-pointer"
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
            <Show when={props.showPreview !== false && pendingPreviews().length > 0 && maxFiles() > 1}>
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
                                <div class="absolute bottom-0 inset-x-0 bg-linear-to-t from-black/60 to-transparent p-1.5">
                                    <span class="text-[10px] text-white truncate block">{preview.file.name}</span>
                                </div>
                            </div>
                        )}
                    </For>
                </div>
            </Show>

            {/* Ark UI Image Cropper Modal */}
            <Show when={isCropping() && cropImageSrc()}>
                {(src) => (
                    <ImageCropperDialog
                        src={src()}
                        cropShape={props.cropShape}
                        cropAspectRatio={props.cropAspectRatio}
                        onClose={() => {
                            setIsCropping(false);
                            if (cropImageSrc() && isOwnCropUrl()) {
                                URL.revokeObjectURL(cropImageSrc()!);
                            }
                            setCropImageSrc(null);
                        }}
                        onConfirm={(croppedBlob) => {
                            setIsCropping(false);
                            if (cropImageSrc() && isOwnCropUrl()) {
                                URL.revokeObjectURL(cropImageSrc()!);
                            }
                            setCropImageSrc(null);

                            if (croppedBlob) {
                                const croppedFile = new File([croppedBlob], cropFileName(), { type: cropFileType() });
                                const previewUrl = URL.createObjectURL(croppedFile);

                                if (maxFiles() === 1) {
                                    // Revoke existing pending previews if replacing
                                    pendingPreviews().forEach(p => URL.revokeObjectURL(p.url));
                                    setPendingPreviews([{ file: croppedFile, url: previewUrl }]);
                                } else {
                                    setPendingPreviews(prev => [...prev, { file: croppedFile, url: previewUrl }]);
                                }
                                props.onFilesChange?.([croppedFile]);
                            }
                        }}
                    />
                )}
            </Show>
        </div>
    );
};

// ============================================================================
// IMAGE CROPPER DIALOG (INTERNAL COMPONENT)
// ============================================================================
interface ImageCropperDialogProps {
    src: string;
    cropShape?: 'rectangle' | 'circle';
    cropAspectRatio?: number;
    onClose: () => void;
    onConfirm: (blob: Blob | null) => void;
}

const ASPECTS = [
    { label: '16:9', value: '1.777', num: 16 / 9, icon: RectangleHorizontalIcon },
    { label: '1:1', value: '1', num: 1, icon: SquareIcon },
    { label: '9:16', value: '0.562', num: 9 / 16, icon: RectangleVerticalIcon },
];

const ImageCropperDialog: Component<ImageCropperDialogProps> = (props) => {
    const cropperId = createUniqueId();
    // Use SegmentedControl value as string
    const [aspectRatio, setAspectRatio] = createSignal(props.cropAspectRatio ? String(props.cropAspectRatio) : '1.777');

    return (
        <Modal
            isOpen={true}
            onClose={props.onClose}
            title="Ajustar Imagen"
            description="Arrastra y ajusta el área de recorte"
            size="md"
            class="max-w-[420px]"
        >
            <div class="px-5 py-6 border-b border-white/5">
                <Show when={props.cropShape !== 'circle'}>
                    <div class="flex justify-center mb-6">
                        <SegmentedControl
                            value={aspectRatio()}
                            onChange={setAspectRatio}
                        >
                            <SegmentedControlIndicator />
                            <For each={ASPECTS}>
                                {(aspect) => (
                                    <SegmentedControlItem value={aspect.value}>
                                        <SegmentedControlItemInput />
                                        <SegmentedControlItemLabel>
                                            <aspect.icon class="size-3.5" />
                                            {aspect.label}
                                        </SegmentedControlItemLabel>
                                    </SegmentedControlItem>
                                )}
                            </For>
                        </SegmentedControl>
                    </div>
                </Show>

                {/* ━━━ Ark UI ImageCropper ━━━ */}
                <ImageCropper.Root
                    id={cropperId}
                    aspectRatio={Number(aspectRatio())}
                >
                    <div class="flex justify-center w-full">
                        <div class="w-full">
                            {/* Viewport */}
                            <ImageCropper.Viewport class="relative overflow-hidden w-full aspect-square bg-black/40 dark:bg-black/80 rounded-xl border border-white/10 touch-none shadow-inner">
                                    <ImageCropper.Image
                                        src={props.src}
                                        alt="Imagen a recortar"
                                        // @ts-ignore
                                        crossorigin={null}
                                        class="absolute top-0 left-0 w-full h-full object-contain origin-center select-none pointer-events-none [backface-visibility:hidden]"
                                    />
                                    <ImageCropper.Selection
                                        class={cn(
                                            "box-content outline-none cursor-move [backface-visibility:hidden]",
                                            "shadow-[0_0_0_9999px_rgba(0,0,0,0.65)]",
                                            "border-[1.5px] border-white/50 focus-visible:border-primary",
                                            "data-[dragging]:cursor-grabbing data-[dragging]:border-white/80",
                                            props.cropShape === 'circle' && "rounded-full"
                                        )}
                                    >
                                        {/* Handles */}
                                        <For each={ImageCropper.handles}>
                                            {(position) => (
                                                <ImageCropper.Handle 
                                                    position={position} 
                                                    class={cn(
                                                        "group absolute flex items-center justify-center touch-none w-6 h-6",
                                                        "data-disabled:hidden",
                                                        // Corners
                                                        "[&>div]:transition-all [&>div]:duration-150",
                                                        "data-[position=top-left]:cursor-nwse-resize",
                                                        "data-[position=top-right]:cursor-nesw-resize",
                                                        "data-[position=bottom-right]:cursor-nwse-resize",
                                                        "data-[position=bottom-left]:cursor-nesw-resize",
                                                        // Edges
                                                        "data-[position=top]:cursor-ns-resize",
                                                        "data-[position=bottom]:cursor-ns-resize",
                                                        "data-[position=left]:cursor-ew-resize",
                                                        "data-[position=right]:cursor-ew-resize",
                                                    )}
                                                >
                                                    <div class={cn(
                                                        // Base
                                                        "bg-card shadow-[0_1px_3px_rgba(0,0,0,0.3)]",
                                                        // Corners (L-shapes)
                                                        "group-data-[position=top-left]:w-3.5 group-data-[position=top-left]:h-3.5 group-data-[position=top-left]:border-l-[3px] group-data-[position=top-left]:border-t-[3px] group-data-[position=top-left]:border-primary hover:group-data-[position=top-left]:scale-110",
                                                        "group-data-[position=top-right]:w-3.5 group-data-[position=top-right]:h-3.5 group-data-[position=top-right]:border-r-[3px] group-data-[position=top-right]:border-t-[3px] group-data-[position=top-right]:border-primary hover:group-data-[position=top-right]:scale-110",
                                                        "group-data-[position=bottom-right]:w-3.5 group-data-[position=bottom-right]:h-3.5 group-data-[position=bottom-right]:border-r-[3px] group-data-[position=bottom-right]:border-b-[3px] group-data-[position=bottom-right]:border-primary hover:group-data-[position=bottom-right]:scale-110",
                                                        "group-data-[position=bottom-left]:w-3.5 group-data-[position=bottom-left]:h-3.5 group-data-[position=bottom-left]:border-l-[3px] group-data-[position=bottom-left]:border-b-[3px] group-data-[position=bottom-left]:border-primary hover:group-data-[position=bottom-left]:scale-110",
                                                        // Edges (Dots)
                                                        "group-data-[position=top]:w-1.5 group-data-[position=top]:h-1.5 group-data-[position=top]:bg-primary group-data-[position=top]:rounded-full group-data-[position=top]:opacity-0 hover:group-data-[position=top]:opacity-100",
                                                        "group-data-[position=bottom]:w-1.5 group-data-[position=bottom]:h-1.5 group-data-[position=bottom]:bg-primary group-data-[position=bottom]:rounded-full group-data-[position=bottom]:opacity-0 hover:group-data-[position=bottom]:opacity-100",
                                                        "group-data-[position=left]:w-1.5 group-data-[position=left]:h-1.5 group-data-[position=left]:bg-primary group-data-[position=left]:rounded-full group-data-[position=left]:opacity-0 hover:group-data-[position=left]:opacity-100",
                                                        "group-data-[position=right]:w-1.5 group-data-[position=right]:h-1.5 group-data-[position=right]:bg-primary group-data-[position=right]:rounded-full group-data-[position=right]:opacity-0 hover:group-data-[position=right]:opacity-100",
                                                    )} />
                                                </ImageCropper.Handle>
                                            )}
                                        </For>
                                        <ImageCropper.Grid axis="horizontal" class="absolute inset-y-[33.33%] inset-x-0 border-y border-white/40 pointer-events-none opacity-0 transition-opacity duration-200 data-[dragging]:opacity-100 data-[panning]:opacity-100" />
                                        <ImageCropper.Grid axis="vertical" class="absolute inset-x-[33.33%] inset-y-0 border-x border-white/40 pointer-events-none opacity-0 transition-opacity duration-200 data-[dragging]:opacity-100 data-[panning]:opacity-100" />
                                    </ImageCropper.Selection>
                                </ImageCropper.Viewport>

                                {/* Zoom & Rotation sliders */}
                                <ImageCropper.Context>
                                    {(api) => (
                                        <div class="flex flex-col gap-3 mt-6 p-4 rounded-xl bg-black/5 dark:bg-white/5 border border-white/5 shadow-inner">
                                            <div class="flex items-center gap-3">
                                                <span class="text-[10px] font-bold text-muted w-9 uppercase tracking-widest">Zoom</span>
                                                <input
                                                    type="range"
                                                    min={1}
                                                    max={5}
                                                    step={0.01}
                                                    value={api().zoom}
                                                    onInput={(e) => api().setZoom(parseFloat(e.currentTarget.value))}
                                                    class="flex-1 accent-primary bg-surface/50 rounded-lg h-1.5 appearance-none cursor-pointer"
                                                />
                                                <span class="text-[11px] font-mono text-muted w-10 text-right font-medium">
                                                    {(api().zoom * 100).toFixed(0)}%
                                                </span>
                                            </div>
                                            <div class="flex items-center gap-3">
                                                <span class="text-[10px] font-bold text-muted w-9 uppercase tracking-widest">Girar</span>
                                                <input
                                                    type="range"
                                                    min={0}
                                                    max={360}
                                                    step={1}
                                                    value={api().rotation}
                                                    onInput={(e) => api().setRotation(parseInt(e.currentTarget.value))}
                                                    class="flex-1 accent-primary bg-surface/50 rounded-lg h-1.5 appearance-none cursor-pointer"
                                                />
                                                <span class="text-[11px] font-mono text-muted w-10 text-right font-medium">
                                                    {api().rotation}°
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </ImageCropper.Context>
                            </div>
                        </div>

                        {/* Footer actions */}
                        <ImageCropper.Context>
                            {(api) => (
                                <div class="flex items-center justify-between px-5 py-4 bg-black/10 dark:bg-white/5 border-t border-white/5 rounded-b-[1.25rem] mt-6">
                                    {/* Transform tools */}
                                    <div class="flex items-center gap-1">
                                        <For each={[
                                            { label: "Reflejar horizontalmente", icon: "M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4", action: () => api().flipHorizontally() },
                                            { label: "Reflejar verticalmente", icon: "M7 8v12m0 0l-4-4m4 4l-4 4m6 0V4m0 0l4 4m-4-4l4-4", action: () => api().flipVertically() },
                                            { label: "Girar 90°", icon: "M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89", action: () => api().rotateBy(90) },
                                        ]}>
                                            {(tool) => (
                                                <button
                                                    type="button"
                                                    onClick={tool.action}
                                                    class="p-2 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 text-muted hover:text-text transition-colors cursor-pointer"
                                                    title={tool.label}
                                                >
                                                    <svg class="size-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width={2}>
                                                        <path stroke-linecap="round" stroke-linejoin="round" d={tool.icon} />
                                                    </svg>
                                                </button>
                                            )}
                                        </For>
                                        <div class="w-px h-5 bg-border mx-1.5" />
                                        <button
                                            type="button"
                                            onClick={() => api().reset()}
                                            class="text-[11px] font-bold text-muted hover:text-text px-2.5 py-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition-colors cursor-pointer uppercase tracking-wider"
                                        >
                                            Restaurar
                                        </button>
                                    </div>

                                    {/* Apply / Cancel */}
                                    <div class="flex items-center gap-3">
                                        <button
                                            type="button"
                                            onClick={props.onClose}
                                            class="px-4 py-2 text-xs font-bold text-muted hover:text-text hover:bg-black/10 dark:hover:bg-white/10 rounded-xl transition-all cursor-pointer"
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            type="button"
                                            onClick={async () => {
                                                try {
                                                    const blob = await api().getCroppedImage({ type: 'image/webp' });
                                                    props.onConfirm(blob ? new Blob([blob], { type: 'image/webp' }) : null);
                                                } catch (err) {
                                                    console.error("Error cropping image:", err);
                                                    props.onConfirm(null);
                                                }
                                            }}
                                            class="px-5 py-2 text-xs font-bold bg-primary text-white hover:bg-primary-strong rounded-xl shadow-[0_4px_14px_0_rgba(var(--color-primary),0.39)] transition-all cursor-pointer hover:-translate-y-0.5 active:translate-y-0"
                                        >
                                            Aplicar Recorte
                                        </button>
                                    </div>
                                </div>
                            )}
                        </ImageCropper.Context>
                    </ImageCropper.Root>
            </div>
        </Modal>
    );
};

export default FileUploadDropzone;

