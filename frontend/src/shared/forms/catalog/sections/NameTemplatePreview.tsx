/**
 * NameTemplatePreview — Displays the generated product name from a category's
 * name_template with attribute values highlighted inline.
 *
 * This is the simplified replacement for the former CategoryAttributeTags component.
 * Only the name template preview functionality is retained.
 *
 * Template placeholders like {material} are resolved against the current shared_attributes
 * and displayed as colored badges (green=filled, amber=empty).
 */
import { Component, Show, For, createMemo } from 'solid-js';

interface NameTemplatePreviewProps {
    /** Category attributes from parent query (needed to resolve placeholder labels) */
    attributes: () => Array<{ key: string; label: string; type: string; required?: boolean; options?: string[] }>;
    /** Current values from shared_attributes */
    values: () => Record<string, unknown>;
    /** Name template from category (e.g. "Platina {material} {medida}") */
    nameTemplate: () => string | null;
}

const NameTemplatePreview: Component<NameTemplatePreviewProps> = (props) => {
    // ▶ CYCLE-SAFE: serialize values to JSON string so the memo only reacts
    //   when actual attribute content changes, NOT when unrelated form fields
    //   trigger the store to emit a new object reference.
    const valuesKey = createMemo(() => JSON.stringify(props.values() ?? {}));

    const templateParts = createMemo(() => {
        const template = props.nameTemplate();
        if (!template) return [];
        const _key = valuesKey(); // track serialized values only
        const currentValues = props.values() ?? {};
        const regex = /\{(\w+)\}/g;
        const parts: Array<{ type: 'text' | 'filled' | 'empty'; content: string }> = [];
        let lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = regex.exec(template)) !== null) {
            if (match.index > lastIndex) {
                parts.push({ type: 'text', content: template.slice(lastIndex, match.index) });
            }
            const key = match[1];
            const val = currentValues[key];
            if (val != null && String(val).trim()) {
                parts.push({ type: 'filled', content: String(val) });
            } else {
                const attrDef = props.attributes().find((a) => a.key === key);
                parts.push({ type: 'empty', content: attrDef?.label ?? key });
            }
            lastIndex = regex.lastIndex;
        }
        if (lastIndex < template.length) {
            parts.push({ type: 'text', content: template.slice(lastIndex) });
        }
        return parts;
    });

    return (
        <Show when={props.nameTemplate()}>
            <div class="bg-surface/30 rounded-2xl border border-border/40 p-4 space-y-2">
                <div class="flex items-center gap-2">
                    <div class="w-1 h-4 rounded-full bg-amber-500" />
                    <span class="text-[10px] font-semibold text-amber-600 uppercase tracking-wider">
                        Nombre Generado
                    </span>
                </div>
                <div class="text-sm font-medium text-text/80 font-mono leading-relaxed p-2.5 bg-amber-500/5 border border-amber-500/20 rounded-xl">
                    <For each={templateParts()}>
                        {(part) => (
                            <>
                                {part.type === 'text' && <span>{part.content}</span>}
                                {part.type === 'filled' && (
                                    <span class="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 font-semibold text-xs">
                                        {part.content}
                                    </span>
                                )}
                                {part.type === 'empty' && (
                                    <span class="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500/70 font-medium text-xs italic">
                                        {part.content}
                                    </span>
                                )}
                            </>
                        )}
                    </For>
                </div>
                <span class="text-[10px] text-muted font-mono block">{props.nameTemplate()}</span>
            </div>
        </Show>
    );
};

export default NameTemplatePreview;
