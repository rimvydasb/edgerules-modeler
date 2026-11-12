import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
    type KeyboardEvent,
    type ReactElement,
    type ReactNode,
} from 'react';

export interface VirtualGridProps<T> {
    items: readonly T[];
    itemKey: (item: T) => string;
    renderItem: (item: T, index: number, tabIndex: 0 | -1) => ReactNode;
    rowHeight: number; // px, the same for every row
    minColumnWidth?: number; // px; the number of columns follows the width
    gap?: number; // px
    label: string;
}

const OVERSCAN = 2;
const FALLBACK_COLUMNS = 3; // before the first measurement, and where nothing is laid out
const FALLBACK_HEIGHT = 900;

/** The nearest ancestor that scrolls, or null when the page (window) does. */
function scrollParent(element: HTMLElement): HTMLElement | null {
    for (let node = element.parentElement; node; node = node.parentElement) {
        const {overflowY} = getComputedStyle(node);
        if (overflowY === 'auto' || overflowY === 'scroll') return node;
    }
    return null;
}

/**
 * A grid that renders the visible rows only, so 5 000 panels do not slow the page. It has no scroll area of its own: it grows to its full height
 * and the page scrolls. Arrow keys move the focus between
 * items: left and right by one, up and down by one row.
 */
export function VirtualGrid<T>({
    items,
    itemKey,
    renderItem,
    rowHeight,
    minColumnWidth = 280,
    gap = 12,
    label,
}: VirtualGridProps<T>): ReactElement {
    const container = useRef<HTMLDivElement>(null);
    const [size, setSize] = useState({width: 0, height: 0});
    const [scrollTop, setScrollTop] = useState(0);
    const [active, setActive] = useState(0);
    const pendingFocus = useRef<number | undefined>(undefined);

    // The grid scrolls with the page: the offset is how far its top edge is above the scroll viewport's top edge.
    useLayoutEffect(() => {
        const element = container.current;
        if (!element) return;
        const parent = scrollParent(element);
        const measure = () => {
            const viewportTop = parent ? parent.getBoundingClientRect().top : 0;
            const viewportHeight = parent ? parent.clientHeight : window.innerHeight;
            setSize({width: element.clientWidth, height: viewportHeight});
            setScrollTop(Math.max(0, viewportTop - element.getBoundingClientRect().top));
        };
        measure();
        const target: HTMLElement | Window = parent ?? window;
        target.addEventListener('scroll', measure, {passive: true});
        window.addEventListener('resize', measure);
        const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measure);
        observer?.observe(element);
        return () => {
            target.removeEventListener('scroll', measure);
            window.removeEventListener('resize', measure);
            observer?.disconnect();
        };
    }, []);

    const columns =
        size.width > 0 ? Math.max(1, Math.floor((size.width + gap) / (minColumnWidth + gap))) : FALLBACK_COLUMNS;
    const viewport = size.height > 0 ? size.height : FALLBACK_HEIGHT;
    const rowCount = Math.ceil(items.length / columns);
    const first = Math.max(0, Math.floor(scrollTop / rowHeight) - OVERSCAN);
    const last = Math.min(rowCount - 1, Math.ceil((scrollTop + viewport) / rowHeight) + OVERSCAN);
    const current = Math.min(active, Math.max(0, items.length - 1));

    useEffect(() => {
        const target = pendingFocus.current;
        if (target === undefined) return;
        const element = container.current?.querySelector<HTMLElement>(`[data-index="${target}"] [tabindex]`);
        if (element) {
            pendingFocus.current = undefined;
            element.focus();
        }
    });

    const move = useCallback(
        (event: KeyboardEvent<HTMLDivElement>) => {
            const step = {ArrowLeft: -1, ArrowRight: 1, ArrowUp: -columns, ArrowDown: columns}[event.key];
            const from = (event.target as HTMLElement).closest<HTMLElement>('[data-index]');
            if (step === undefined || !from || items.length === 0) return;
            event.preventDefault();
            const target = Math.min(items.length - 1, Math.max(0, Number(from.dataset.index) + step));
            // Scroll the page so the target row is mounted; the focus then moves to it.
            const element = container.current;
            if (element) {
                const parent = scrollParent(element);
                const viewportTop = parent ? parent.getBoundingClientRect().top : 0;
                const viewportHeight = parent ? parent.clientHeight : window.innerHeight;
                const rowTop =
                    element.getBoundingClientRect().top - viewportTop + Math.floor(target / columns) * rowHeight;
                const delta =
                    rowTop < 0 ? rowTop : rowTop + rowHeight > viewportHeight ? rowTop + rowHeight - viewportHeight : 0;
                if (delta !== 0) (parent ?? window).scrollBy({top: delta});
            }
            pendingFocus.current = target;
            setActive(target);
        },
        [columns, items.length, rowHeight],
    );

    const rows: ReactElement[] = [];
    for (let row = first; row <= last; row += 1) {
        const cells = items.slice(row * columns, (row + 1) * columns);
        rows.push(
            <div
                key={row}
                role="presentation"
                style={{
                    position: 'absolute',
                    top: row * rowHeight,
                    left: 0,
                    right: 0,
                    height: rowHeight - gap,
                    display: 'grid',
                    gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                    gap,
                }}
            >
                {cells.map((item, offset) => {
                    const index = row * columns + offset;
                    return (
                        <div key={itemKey(item)} role="listitem" data-index={index} style={{minWidth: 0}}>
                            {renderItem(item, index, index === current ? 0 : -1)}
                        </div>
                    );
                })}
            </div>,
        );
    }

    return (
        <div ref={container} role="list" aria-label={label} style={{position: 'relative'}} onKeyDown={move}>
            <div style={{position: 'relative', height: rowCount * rowHeight, minHeight: 1}}>{rows}</div>
        </div>
    );
}
