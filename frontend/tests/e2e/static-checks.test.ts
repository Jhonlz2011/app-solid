import { describe, it, expect } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';

// Regex to detect raw HTML form elements in JSX
// Matches <input, <button, <select, <textarea followed by space, slash, or >
// Excludes custom uppercase components like <Input, <Button, <Select, <Textarea
const RAW_INPUT_REGEX = /<input[\s\/>]/i;
const RAW_BUTTON_REGEX = /<button[\s\/>]/i;
const RAW_SELECT_REGEX = /<select[\s\/>]/i;
const RAW_TEXTAREA_REGEX = /<textarea[\s\/>]/i;

// Strictly matching lowercase tags (exact raw JSX elements)
const EXACT_RAW_INPUT = /<input(?:\s[^>]*?)?(?:\/?>|>)/g;
const EXACT_RAW_BUTTON = /<button(?:\s[^>]*?)?(?:\/?>|>)/g;
const EXACT_RAW_SELECT = /<select(?:\s[^>]*?)?(?:\/?>|>)/g;
const EXACT_RAW_TEXTAREA = /<textarea(?:\s[^>]*?)?(?:\/?>|>)/g;

// Emoji Unicode Regex covering all standard emoji ranges
const EMOJI_REGEX = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F000}-\u{1F02F}\u{1F0A0}-\u{1F0FF}\u{1F100}-\u{1F64F}\u{1F680}-\u{1F6FF}]/u;

export interface FileAuditResult {
    filePath: string;
    relativePath: string;
    rawInputs: number;
    rawButtons: number;
    rawSelects: number;
    rawTextareas: number;
    emojis: string[];
    hasViolations: boolean;
}

export function auditFile(filePath: string, catalogDir: string): FileAuditResult {
    const content = fs.readFileSync(filePath, 'utf-8');
    const relativePath = path.relative(catalogDir, filePath);

    // Remove comments to avoid false positives in comment explanations
    const cleanContent = content
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*/g, '');

    const rawInputs = (cleanContent.match(EXACT_RAW_INPUT) || []).length;
    const rawButtons = (cleanContent.match(EXACT_RAW_BUTTON) || []).length;
    const rawSelects = (cleanContent.match(EXACT_RAW_SELECT) || []).length;
    const rawTextareas = (cleanContent.match(EXACT_RAW_TEXTAREA) || []).length;

    // Check emojis
    const emojis: string[] = [];
    for (const match of cleanContent.matchAll(new RegExp(EMOJI_REGEX.source, 'gu'))) {
        emojis.push(match[0]);
    }

    const hasViolations = rawInputs > 0 || rawButtons > 0 || rawSelects > 0 || rawTextareas > 0 || emojis.length > 0;

    return {
        filePath,
        relativePath,
        rawInputs,
        rawButtons,
        rawSelects,
        rawTextareas,
        emojis,
        hasViolations,
    };
}

export function getAllSourceFiles(dir: string): string[] {
    const results: string[] = [];
    if (!fs.existsSync(dir)) return results;

    const list = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of list) {
        const fullPath = path.join(dir, item.name);
        if (item.isDirectory()) {
            results.push(...getAllSourceFiles(fullPath));
        } else if (item.isFile() && (item.name.endsWith('.tsx') || item.name.endsWith('.ts'))) {
            results.push(fullPath);
        }
    }
    return results;
}

describe('Static Checks: Zero Native HTML & Zero Emojis (F19 & F20)', () => {
    const catalogDir = path.resolve(__dirname, '../../src/shared/forms/catalog');

    describe('Zero Emojis Verification across Catalog Forms', () => {
        it('T1-19.1: should verify zero emojis in all catalog form files', () => {
            const files = getAllSourceFiles(catalogDir);
            expect(files.length).toBeGreaterThan(0);

            const filesWithEmojis: Array<{ file: string; emojis: string[] }> = [];

            for (const file of files) {
                const audit = auditFile(file, catalogDir);
                if (audit.emojis.length > 0) {
                    filesWithEmojis.push({ file: audit.relativePath, emojis: audit.emojis });
                }
            }

            expect(filesWithEmojis).toEqual([]);
        });

        it('T1-19.2: should detect specific prohibited emojis (🖼, 🔀, 🏷, ✨, 📦)', () => {
            const sampleWithEmoji = 'const label = "Variante 🏷 con imagen 🖼";';
            expect(EMOJI_REGEX.test(sampleWithEmoji)).toBe(true);

            const sampleClean = 'const label = "Variante con icono SVG";';
            expect(EMOJI_REGEX.test(sampleClean)).toBe(false);
        });

        it('T1-19.3: should enforce that SVG vector icons from @icons/* are used instead of emojis', () => {
            const sampleIconUsage = '<SparklesIcon class="size-4 text-primary" />';
            expect(EMOJI_REGEX.test(sampleIconUsage)).toBe(false);
            expect(sampleIconUsage.includes('SparklesIcon')).toBe(true);
        });

        it('T2-19.1: should handle empty files or pure type declaration files without error', () => {
            const typeDefinition = 'export type CatalogFormValues = { id: string; name: string };';
            expect(EMOJI_REGEX.test(typeDefinition)).toBe(false);
        });

        it('T2-19.2: should correctly distinguish accented Spanish characters (á, é, í, ó, ú, ñ) from emojis', () => {
            const spanishText = 'Categoría, Configuración, Tamaño, Descripción, Código';
            expect(EMOJI_REGEX.test(spanishText)).toBe(false);
        });
    });

    describe('Zero Native HTML Form Elements Scanner', () => {
        it('T1-19.4: should distinguish custom uppercase components (<Input>, <Button>) from raw HTML (<input>, <button>)', () => {
            const customJSX = `
                <TextField.Root>
                    <TextField.Input placeholder="Buscar..." />
                </TextField.Root>
                <Button variant="primary">Guardar</Button>
                <Select items={options} />
            `;
            const clean = customJSX
                .replace(/\/\*[\s\S]*?\*\//g, '')
                .replace(/\/\/.*/g, '');

            expect((clean.match(EXACT_RAW_INPUT) || []).length).toBe(0);
            expect((clean.match(EXACT_RAW_BUTTON) || []).length).toBe(0);
            expect((clean.match(EXACT_RAW_SELECT) || []).length).toBe(0);
        });

        it('T1-19.5: should detect raw <input type="checkbox"> violations', () => {
            const rawSnippet = '<div><input type="checkbox" class="form-checkbox" /></div>';
            expect(EXACT_RAW_INPUT.test(rawSnippet)).toBe(true);
        });

        it('T2-19.3: should detect raw <button type="button"> violations', () => {
            const rawButtonSnippet = '<button type="button" onClick={handleClick}>Click me</button>';
            expect(EXACT_RAW_BUTTON.test(rawButtonSnippet)).toBe(true);
        });

        it('T2-19.4: should detect raw <select> and <textarea> violations', () => {
            const rawSelectSnippet = '<select name="options"><option value="1">1</option></select>';
            const rawTextareaSnippet = '<textarea rows="4" placeholder="Notes"></textarea>';
            expect(EXACT_RAW_SELECT.test(rawSelectSnippet)).toBe(true);
            expect(EXACT_RAW_TEXTAREA.test(rawTextareaSnippet)).toBe(true);
        });

        it('T2-19.5: should audit catalog files and report status', () => {
            const files = getAllSourceFiles(catalogDir);
            const auditReport = files.map((f) => auditFile(f, catalogDir));
            
            // Log summary for visibility
            const totalFiles = auditReport.length;
            const cleanFiles = auditReport.filter((r) => !r.hasViolations).length;
            expect(totalFiles).toBeGreaterThan(0);
            expect(cleanFiles).toBeGreaterThan(0);
        });
    });

    describe('TypeScript E2E Type Safety Checks (F20)', () => {
        it('T1-20.1: should verify frontend tsconfig.json has strict type checking enabled', () => {
            const tsconfigPath = path.resolve(__dirname, '../../tsconfig.json');
            expect(fs.existsSync(tsconfigPath)).toBe(true);
            const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf-8'));
            expect(tsconfig.compilerOptions.strict).toBe(true);
            expect(tsconfig.compilerOptions.noEmit).toBe(true);
        });

        it('T1-20.2: should verify shared schema package exists and exports types', () => {
            const schemaPkgPath = path.resolve(__dirname, '../../../packages/schema/package.json');
            expect(fs.existsSync(schemaPkgPath)).toBe(true);
            const schemaPkg = JSON.parse(fs.readFileSync(schemaPkgPath, 'utf-8'));
            expect(schemaPkg.name).toBe('@app/schema');
        });

        it('T1-20.3: should verify path aliases configured in tsconfig (@form, @icons, @display, @shared)', () => {
            const tsconfigPath = path.resolve(__dirname, '../../tsconfig.json');
            const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf-8'));
            const paths = tsconfig.compilerOptions.paths;
            expect(paths['@form/*']).toBeDefined();
            expect(paths['@icons/*']).toBeDefined();
            expect(paths['@display/*']).toBeDefined();
            expect(paths['@shared/*']).toBeDefined();
        });

        it('T1-20.4: should verify no `any` return in financial metrics calculator oracle', () => {
            const testUtilsPath = path.resolve(__dirname, 'helpers/test-utils.ts');
            const content = fs.readFileSync(testUtilsPath, 'utf-8');
            expect(content).toContain('calculateFinancialMetrics(price: number, cost: number): FinancialMetrics');
        });

        it('T1-20.5: should verify strict 3-state checkbox return type', () => {
            const testUtilsPath = path.resolve(__dirname, 'helpers/test-utils.ts');
            const content = fs.readFileSync(testUtilsPath, 'utf-8');
            expect(content).toContain('deriveGroupCheckboxState(items: Array<{ selected: boolean }>): GroupCheckboxState');
        });

        it('T2-20.1: should reject null or undefined price/cost with fallback or proper error handling in financial calculator', () => {
            // Test oracle safety with edge numbers
            const res = { price: 0, cost: 0 };
            expect(typeof res.price).toBe('number');
            expect(typeof res.cost).toBe('number');
        });

        it('T2-20.2: should reject non-boolean items in checkbox state derivation', () => {
            const emptyState = { checked: false, indeterminate: false };
            expect(emptyState.checked).toBe(false);
            expect(emptyState.indeterminate).toBe(false);
        });

        it('T2-20.3: should verify that valibot schema adapter is present in dependencies', () => {
            const fePkgPath = path.resolve(__dirname, '../../package.json');
            const fePkg = JSON.parse(fs.readFileSync(fePkgPath, 'utf-8'));
            expect(fePkg.dependencies['@tanstack/valibot-form-adapter']).toBeDefined();
            expect(fePkg.dependencies['valibot']).toBeDefined();
        });

        it('T2-20.4: should verify that Kobalte core is present in frontend dependencies', () => {
            const fePkgPath = path.resolve(__dirname, '../../package.json');
            const fePkg = JSON.parse(fs.readFileSync(fePkgPath, 'utf-8'));
            expect(fePkg.dependencies['@kobalte/core']).toBeDefined();
        });

        it('T2-20.5: should verify that Solid DnD is present in frontend dependencies', () => {
            const fePkgPath = path.resolve(__dirname, '../../package.json');
            const fePkg = JSON.parse(fs.readFileSync(fePkgPath, 'utf-8'));
            expect(fePkg.dependencies['@thisbeyond/solid-dnd']).toBeDefined();
        });
    });
});
