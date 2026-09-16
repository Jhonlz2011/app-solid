/**
 * Shared Test Utilities for E2E Test Suite (Tiers 1-4 & Static Checks)
 * 100% Type-Safe, No Browser Required (Bun / Pure Simulated DOM)
 */

export interface MockElementOptions {
    id?: string;
    tagName?: string;
    className?: string;
    value?: string;
    disabled?: boolean;
    readOnly?: boolean;
}

export class MockInputElement {
    public id: string;
    public tagName: string = 'INPUT';
    public className: string;
    public value: string;
    public disabled: boolean;
    public readOnly: boolean;
    public selectionStart: number = 0;
    public selectionEnd: number = 0;
    public dataset: Record<string, string> = {};
    public selected: boolean = false;
    public selectCallCount: number = 0;
    public parentElement: MockInputElement | null = null;
    public eventListeners: Record<string, Array<(event: any) => void>> = {};

    constructor(options: MockElementOptions = {}) {
        this.id = options.id || 'mock-input';
        this.className = options.className || '';
        this.value = options.value || '';
        this.disabled = options.disabled || false;
        this.readOnly = options.readOnly || false;
        this.selectionEnd = this.value.length;
    }

    public select(): void {
        this.selectCallCount++;
        this.selected = true;
        this.selectionStart = 0;
        this.selectionEnd = this.value.length;
    }

    public addEventListener(event: string, handler: (e: any) => void): void {
        if (!this.eventListeners[event]) {
            this.eventListeners[event] = [];
        }
        this.eventListeners[event].push(handler);
    }

    public dispatchEvent(event: { type: string; [key: string]: any }): void {
        const handlers = this.eventListeners[event.type] || [];
        for (const handler of handlers) {
            handler({ ...event, currentTarget: this, target: this });
        }
    }

    public closest(selector: string): MockInputElement | null {
        if (selector.startsWith('.') && this.className.includes(selector.slice(1))) {
            return this;
        }
        return this.parentElement ? this.parentElement.closest(selector) : null;
    }

    public scrollIntoView(_options?: any): void {
        // Mock scrollIntoView
    }
}

export class MockIntersectionObserver {
    public static instances: MockIntersectionObserver[] = [];
    public root: any;
    public rootMargin: string;
    public threshold: number | number[];
    public callback: (entries: any[], observer: MockIntersectionObserver) => void;
    public observedElements: any[] = [];
    public disconnected: boolean = false;

    constructor(callback: (entries: any[], observer: MockIntersectionObserver) => void, options: any = {}) {
        this.callback = callback;
        this.root = options.root || null;
        this.rootMargin = options.rootMargin || '';
        this.threshold = options.threshold || 0;
        MockIntersectionObserver.instances.push(this);
    }

    public observe(element: any): void {
        this.observedElements.push(element);
    }

    public unobserve(element: any): void {
        this.observedElements = this.observedElements.filter((el) => el !== element);
    }

    public disconnect(): void {
        this.disconnected = true;
        this.observedElements = [];
    }

    public trigger(entries: Array<{ target: any; isIntersecting: boolean }>): void {
        this.callback(entries, this);
    }
}

// ============================================================================
// FINANCIAL CALCULATION ORACLE (Shopify / Enterprise Standard)
// ============================================================================

export interface FinancialMetrics {
    profit: number;
    margin: number; // percentage
    markup: number; // percentage
}

/**
 * Derives financial metrics according to PROJECT.md §F15:
 * Net Profit = price - cost
 * Gross Margin % = ((price - cost) / price) * 100
 * Markup % = ((price - cost) / cost) * 100
 */
export function calculateFinancialMetrics(price: number, cost: number): FinancialMetrics {
    const profit = Math.round((price - cost) * 100) / 100;
    
    // Gross Margin %: division by price
    let margin = 0;
    if (price > 0) {
        margin = Math.round(((price - cost) / price) * 10000) / 100;
    } else if (cost > 0) {
        margin = -100;
    }

    // Markup %: division by cost
    let markup = 0;
    if (cost > 0) {
        markup = Math.round(((price - cost) / cost) * 10000) / 100;
    } else if (price > 0) {
        markup = 100;
    }

    return { profit, margin, markup };
}

// ============================================================================
// 3-STATE CHECKBOX MODEL ORACLE
// ============================================================================

export interface GroupCheckboxState {
    checked: boolean;
    indeterminate: boolean;
}

/**
 * Derives group checkbox state according to PROJECT.md §F13:
 * - All checked -> checked: true, indeterminate: false
 * - Some checked -> checked: false, indeterminate: true
 * - None checked -> checked: false, indeterminate: false
 * - Empty -> checked: false, indeterminate: false
 */
export function deriveGroupCheckboxState(items: Array<{ selected: boolean }>): GroupCheckboxState {
    if (!items || items.length === 0) {
        return { checked: false, indeterminate: false };
    }
    const selectedCount = items.filter((i) => i.selected).length;
    if (selectedCount === items.length) {
        return { checked: true, indeterminate: false };
    }
    if (selectedCount > 0) {
        return { checked: false, indeterminate: true };
    }
    return { checked: false, indeterminate: false };
}

// ============================================================================
// NUMERIC SANITIZER ORACLE
// ============================================================================

export interface NumericSanitizerOptions {
    allowNegative?: boolean;
    allowDecimal?: boolean;
    step?: number;
    min?: number;
    max?: number;
}

export function sanitizeNumericInput(raw: string | number | null | undefined, options: NumericSanitizerOptions = {}): number | null {
    if (raw == null || raw === '') return null;
    let str = String(raw).trim();
    if (str === '' || str === '-' || str === '.' || str === ',') return null;

    // Replace comma with dot
    str = str.replace(',', '.');

    // Remove any trailing dot
    if (str.endsWith('.')) {
        str = str.slice(0, -1);
    }
    if (str === '' || str === '-') return null;

    // Filter disallowed chars
    const allowNegative = options.allowNegative ?? false;
    const allowDecimal = options.allowDecimal ?? true;

    let clean = '';
    let hasDot = false;
    let hasSign = false;

    for (let i = 0; i < str.length; i++) {
        const char = str[i];
        if (char >= '0' && char <= '9') {
            clean += char;
        } else if (char === '-' && i === 0 && allowNegative && !hasSign) {
            clean += char;
            hasSign = true;
        } else if (char === '.' && allowDecimal && !hasDot) {
            clean += char;
            hasDot = true;
        }
    }

    if (clean === '' || clean === '-') return null;
    let num = parseFloat(clean);
    if (isNaN(num)) return null;

    // Handle min/max boundaries
    if (options.min !== undefined && num < options.min) {
        num = options.min;
    }
    if (options.max !== undefined && num > options.max) {
        num = options.max;
    }

    return num;
}

export function stepNumericValue(current: number | null, direction: 'up' | 'down', step: number = 1, options: NumericSanitizerOptions = {}): number {
    const base = current ?? (options.min ?? 0);
    const delta = direction === 'up' ? step : -step;
    
    // Decimal precision compensation
    const stepDecimals = (step.toString().split('.')[1] || '').length;
    const rawNew = base + delta;
    let rounded = parseFloat(rawNew.toFixed(Math.max(stepDecimals, 2)));

    if (options.min !== undefined && rounded < options.min) {
        rounded = options.min;
    }
    if (options.max !== undefined && rounded > options.max) {
        rounded = options.max;
    }
    return rounded;
}

// ============================================================================
// VARIANT MATRIX GENERATOR ORACLE
// ============================================================================

export interface OptionAxis {
    name: string;
    values: string[];
}

export interface GeneratedVariant {
    id: string;
    sku: string;
    title: string;
    attributes: Record<string, string>;
    price: number;
    cost: number;
    stock: number;
    status: 'active' | 'draft' | 'archived';
    sort_order: number;
}

export function generateVariantMatrix(baseSku: string, basePrice: number, baseCost: number, axes: OptionAxis[]): GeneratedVariant[] {
    if (!axes || axes.length === 0) return [];

    let combinations: Array<Record<string, string>> = [{}];

    for (const axis of axes) {
        const next: Array<Record<string, string>> = [];
        for (const existing of combinations) {
            for (const val of axis.values) {
                next.push({ ...existing, [axis.name]: val });
            }
        }
        combinations = next;
    }

    return combinations.map((combo, idx) => {
        const values = Object.values(combo);
        const skuSuffix = values.map((v) => v.toUpperCase().replace(/\s+/g, '-')).join('-');
        return {
            id: `var-${idx + 1}`,
            sku: `${baseSku}-${skuSuffix}`,
            title: values.join(' / '),
            attributes: combo,
            price: basePrice,
            cost: baseCost,
            stock: 0,
            status: 'active',
            sort_order: idx + 1,
        };
    });
}
