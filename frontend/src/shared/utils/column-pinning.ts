/**
 * Column Pinning Utilities — Shared style helpers for TanStack Table sticky columns.
 *
 * Used by LocationTable and CategoryTable for pinned select/actions columns.
 * Provides consistent sticky positioning and z-index layering.
 */

type CSSProperties = { [key: string]: string | number };

export interface PinningStyles {
    className: string;
    style: CSSProperties;
}

/**
 * Returns sticky positioning styles for a pinned table header column.
 * Headers get z-index: 30 to stay above cell content during scroll.
 */
export function getHeaderPinningStyles(column: any): PinningStyles {
    const isPinned = column.getIsPinned();
    const colSize = column.getSize();

    if (!isPinned) {
        return { className: '', style: { width: `${colSize}px` } };
    }

    const isLeft = isPinned === 'left';
    const position = isLeft ? column.getStart('left') : column.getAfter('right');

    return {
        className: 'sticky z-[30] bg-card',
        style: {
            ...(isLeft ? { left: `${position}px` } : { right: `${position}px` }),
            width: `${colSize}px`,
            minWidth: `${colSize}px`,
            maxWidth: `${colSize}px`,
        },
    };
}

/**
 * Returns sticky positioning styles for a pinned table body cell column.
 * Cells get z-index: 10 to stay above normal cells but below headers.
 */
export function getCellPinningStyles(column: any): PinningStyles {
    const isPinned = column.getIsPinned();
    const colSize = column.getSize();

    if (!isPinned) {
        return { className: '', style: { width: `${colSize}px` } };
    }

    const isLeft = isPinned === 'left';
    const position = isLeft ? column.getStart('left') : column.getAfter('right');

    return {
        className: 'sticky z-[10]',
        style: {
            ...(isLeft ? { left: `${position}px` } : { right: `${position}px` }),
            width: `${colSize}px`,
            minWidth: `${colSize}px`,
            maxWidth: `${colSize}px`,
        },
    };
}
