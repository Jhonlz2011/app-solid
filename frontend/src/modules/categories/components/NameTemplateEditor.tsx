/**
 * NameTemplateEditor — Rich text editor for category name_template.
 *
 * Uses Quill 2 with a custom inline embed blot (AttributeBadgeBlot) to
 * render attribute placeholders as draggable badges within the editor.
 *
 * Features:
 * - Plain text + inline attribute badges (no rich formatting)
 * - Drag & drop badges from external panel into the editor
 * - Internal badge reordering via drag inside the editor
 * - Bidirectional serialization: Quill Delta ↔ template string
 *   e.g. "Perno {material} {diametro} × {longitud}"
 * - Live preview of generated name
 *
 * Data contract:
 * - Persisted value is a plain string with {key} placeholders
 * - Quill is only for editing UX — the stored value is NOT HTML/Delta
 */
import { Component, For, Show, createEffect, createSignal, createMemo, onMount, onCleanup } from 'solid-js';
import Quill from 'quill';
import 'quill/dist/quill.core.css';
import './name-template-editor.css';

// ── Types ────────────────────────────────────────────────────────────

interface AttributeInfo {
    key: string;
    label: string;
    type: string;
}

interface NameTemplateEditorProps {
    /** Current template string (e.g. "Perno {material} {diametro}") */
    value: string | null | undefined;
    /** Called with serialized template string on changes */
    onChange: (template: string | null) => void;
    /** Available attributes from CategoryAttributesPicker */
    assignedAttributes: AttributeInfo[];
}

// ── Custom Quill Blot — Attribute Badge Embed ────────────────────────

const Embed = Quill.import('blots/embed') as any;

class AttributeBadgeBlot extends Embed {
    static blotName = 'attribute-badge';
    static tagName = 'span';
    static className = 'ql-attribute-badge';

    static create(value: { key: string; label: string }) {
        const node = super.create(value) as HTMLElement;
        node.setAttribute('contenteditable', 'false');
        node.setAttribute('data-attr-key', value.key);
        node.setAttribute('data-attr-label', value.label);
        node.setAttribute('draggable', 'true');
        node.textContent = value.label;
        return node;
    }

    static value(domNode: HTMLElement) {
        return {
            key: domNode.getAttribute('data-attr-key') || '',
            label: domNode.getAttribute('data-attr-label') || domNode.textContent || '',
        };
    }
}

Quill.register(AttributeBadgeBlot);

// ── Serialization helpers ────────────────────────────────────────────

interface TemplatePart {
    type: 'text' | 'badge';
    content: string;
    key?: string;
}

/**
 * Parses a template string into segments of text and attribute badges.
 */
function parseTemplate(template: string, attrMap: Map<string, { label: string }>): TemplatePart[] {
    const parts: TemplatePart[] = [];
    const regex = /\{(\w+)\}/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(template)) !== null) {
        // Text before the match
        if (match.index > lastIndex) {
            parts.push({ type: 'text', content: template.slice(lastIndex, match.index) });
        }
        // The badge embed
        const key = match[1];
        const info = attrMap.get(key);
        parts.push({
            type: 'badge',
            content: info?.label ?? key,
            key,
        });

        lastIndex = regex.lastIndex;
    }

    // Remaining text after last match
    if (lastIndex < template.length) {
        parts.push({ type: 'text', content: template.slice(lastIndex) });
    }

    return parts;
}

/**
 * Convert Quill Delta ops → template string.
 * Text inserts become plain text; embed inserts become {key} placeholders.
 */
function deltaToTemplate(ops: any[]): string {
    let result = '';
    for (const op of ops) {
        if (typeof op.insert === 'string') {
            // Strip trailing newlines added by Quill
            result += op.insert;
        } else if (op.insert?.['attribute-badge']) {
            const badge = op.insert['attribute-badge'];
            result += `{${badge.key}}`;
        }
    }
    // Remove trailing newline that Quill always adds
    return result.replace(/\n$/, '').trim();
}

/**
 * Convert template string → Quill Delta ops.
 * Splits on {key} patterns and creates text/embed ops.
 */
function templateToDelta(template: string, attrMap: Map<string, AttributeInfo>): any[] {
    const parts = parseTemplate(template, attrMap);
    const ops: any[] = [];

    for (const part of parts) {
        if (part.type === 'text') {
            ops.push({ insert: part.content });
        } else {
            ops.push({
                insert: {
                    'attribute-badge': {
                        key: part.key!,
                        label: part.content,
                    },
                },
            });
        }
    }

    // Quill requires a trailing newline
    ops.push({ insert: '\n' });
    return ops;
}

// ── Component ────────────────────────────────────────────────────────

const NameTemplateEditor: Component<NameTemplateEditorProps> = (props) => {
    let editorRef: HTMLDivElement | undefined;
    const [quill, setQuill] = createSignal<Quill | null>(null);
    let isInternalChange = false;
    let textChangeHandler: (() => void) | null = null;
    let dragoverHandler: ((e: DragEvent) => void) | null = null;
    let dragleaveHandler: (() => void) | null = null;
    let dropHandler: ((e: DragEvent) => void) | null = null;

    // Create lookup map from attributes
    const attrMap = createMemo(() => {
        const map = new Map<string, AttributeInfo>();
        for (const attr of props.assignedAttributes) {
            map.set(attr.key, attr);
        }
        return map;
    });

    // Initialize Quill
    onMount(() => {
        if (!editorRef) return;

        const q = new Quill(editorRef, {
            modules: {
                toolbar: false, // No toolbar — plain text + badges only
            },
            placeholder: 'Ej: Perno {tipo_hilo} {material} {diametro} × {longitud}',
        });

        // Load initial value
        if (props.value) {
            const ops = templateToDelta(props.value, attrMap());
            q.setContents(ops as any, 'silent');
        }

        // Listen for text changes
        textChangeHandler = () => {
            if (isInternalChange) return;
            const ops = q.getContents().ops ?? [];
            const template = deltaToTemplate(ops);
            props.onChange(template || null);
        };
        q.on('text-change', textChangeHandler);

        // ── DnD: Handle drops from external badge panel ──────────────
        const editorElement = q.root;

        dragoverHandler = (e: DragEvent) => {
            e.preventDefault();
            e.dataTransfer!.dropEffect = 'copy';
            editorElement.classList.add('drop-target');
        };
        editorElement.addEventListener('dragover', dragoverHandler);

        dragleaveHandler = () => {
            editorElement.classList.remove('drop-target');
        };
        editorElement.addEventListener('dragleave', dragleaveHandler);

        dropHandler = (e: DragEvent) => {
            e.preventDefault();
            editorElement.classList.remove('drop-target');

            const attrKey = e.dataTransfer?.getData('text/attr-key');
            const attrLabel = e.dataTransfer?.getData('text/attr-label');
            if (!attrKey || !attrLabel) return;

            // Calculate insertion index from drop position
            let insertIndex = q.getLength() - 1;

            // Try to get cursor position from drop point
            if (document.caretRangeFromPoint) {
                const range = document.caretRangeFromPoint(e.clientX, e.clientY);
                if (range) {
                    const blot = Quill.find(range.startContainer, true) as any;
                    if (blot) {
                        const index = q.getIndex(blot);
                        insertIndex = index + range.startOffset;
                    }
                }
            }

            // Insert the badge embed
            q.insertEmbed(insertIndex, 'attribute-badge', {
                key: attrKey,
                label: attrLabel,
            }, 'user');

            // Move cursor after the inserted badge
            q.setSelection(insertIndex + 1, 0, 'silent');
        };
        editorElement.addEventListener('drop', dropHandler);

        setQuill(q);
    });

    onCleanup(() => {
        const q = quill();
        if (q) {
            if (textChangeHandler) q.off('text-change', textChangeHandler);
            const el = q.root;
            if (dragoverHandler) el.removeEventListener('dragover', dragoverHandler);
            if (dragleaveHandler) el.removeEventListener('dragleave', dragleaveHandler);
            if (dropHandler) el.removeEventListener('drop', dropHandler);
            setQuill(null);
        }
    });

    // Sync external value changes into Quill (e.g. form reset)
    createEffect(() => {
        const q = quill();
        if (!q) return;
        const value = props.value;

        const currentTemplate = deltaToTemplate(q.getContents().ops ?? []);
        if (currentTemplate === (value ?? '')) return;

        isInternalChange = true;
        if (value) {
            const ops = templateToDelta(value, attrMap());
            q.setContents(ops as any, 'silent');
        } else {
            q.setText('', 'silent');
        }
        isInternalChange = false;
    });

    // Update badge labels when attributes change
    createEffect(() => {
        const q = quill();
        if (!q) return;
        const map = attrMap();

        const ops = q.getContents().ops ?? [];
        let needsUpdate = false;

        for (const op of ops) {
            const embed = typeof op.insert === 'object' && op.insert ? (op.insert as any)['attribute-badge'] : null;
            if (embed) {
                const info = map.get(embed.key);
                if (info && info.label !== embed.label) {
                    needsUpdate = true;
                    embed.label = info.label;
                }
                // If attribute was removed, the badge stays but we don't break
            }
        }

        if (needsUpdate) {
            isInternalChange = true;
            q.setContents(ops as any, 'silent');
            isInternalChange = false;
        }
    });

    // ── Source badge drag start handlers ──────────────────────────────
    const handleDragStart = (e: DragEvent & { currentTarget: HTMLElement }, attr: AttributeInfo) => {
        e.dataTransfer!.setData('text/attr-key', attr.key);
        e.dataTransfer!.setData('text/attr-label', attr.label);
        e.dataTransfer!.effectAllowed = 'copy';
        e.currentTarget.setAttribute('data-dragging', 'true');
    };

    const handleDragEnd = (e: DragEvent & { currentTarget: HTMLElement }) => {
        e.currentTarget.removeAttribute('data-dragging');
    };

    // Insert badge on click (alternative to DnD)
    const insertBadge = (attr: AttributeInfo) => {
        const q = quill();
        if (!q) return;
        const selection = q.getSelection();
        const index = selection ? selection.index : q.getLength() - 1;
        q.insertEmbed(index, 'attribute-badge', {
            key: attr.key,
            label: attr.label,
        }, 'user');
        q.setSelection(index + 1, 0, 'silent');
    };

    // Live preview of generated template
    const previewParts = createMemo(() => {
        const template = props.value ?? '';
        if (!template) return [];
        return parseTemplate(template, attrMap());
    });

    return (
        <div class="space-y-3">
            {/* ── Quill Editor Container ── */}
            <div class="ql-template-editor">
                <div ref={editorRef} />
            </div>

            {/* ── Available Attribute Badges (drag source) ── */}
            <Show when={props.assignedAttributes.length > 0}>
                <div class="space-y-1.5">
                    <span class="text-[11px] font-semibold text-muted uppercase tracking-wider ml-1">
                        Atributos — arrastra o haz clic para insertar
                    </span>
                    <div class="flex flex-wrap gap-1.5">
                        <For each={props.assignedAttributes}>
                            {(attr) => (
                                <span
                                    class="template-badge-source"
                                    draggable={true}
                                    onDragStart={(e) => handleDragStart(e as any, attr)}
                                    onDragEnd={(e) => handleDragEnd(e as any)}
                                    onClick={() => insertBadge(attr)}
                                    title={`Insertar {${attr.key}}`}
                                >
                                    <span class="opacity-50">{'{'}</span>
                                    {attr.label}
                                    <span class="opacity-50">{'}'}</span>
                                </span>
                            )}
                        </For>
                    </div>
                </div>
            </Show>

            {/* ── Live Preview ── */}
            <Show when={previewParts().length > 0}>
                <div class="p-2.5 bg-surface/40 border border-border/50 rounded-xl">
                    <span class="text-[10px] font-semibold text-muted uppercase tracking-wider block mb-1">Vista previa</span>
                    <div class="text-sm font-medium text-text/80 font-mono">
                        <For each={previewParts()}>
                            {(part) => (
                                <Show
                                    when={part.type === 'badge'}
                                    fallback={<span>{part.content}</span>}
                                >
                                    <span class="template-preview-badge-empty" title={`Atributo: ${part.key}`}>
                                        {part.content}
                                    </span>
                                </Show>
                            )}
                        </For>
                    </div>
                </div>
            </Show>
        </div>
    );
};

export default NameTemplateEditor;
