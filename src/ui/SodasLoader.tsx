import type {CSSProperties, ReactElement} from 'react';
import * as classes from './sodasLoader.module.css';

/**
 * The EdgeRules mark (the "sodas", after the proposal's `assets/sodas.svg`) hanging and swaying while something loads.
 * The sway is a CSS transform animation that starts mid-swing, so it moves from the first frame and keeps moving while
 * the main thread is busy.
 */
export function SodasLoader({label, size = 56}: {label: string; size?: number}): ReactElement {
    return (
        <svg
            className={classes.sodas}
            style={{width: size, height: size} satisfies CSSProperties}
            viewBox="0 0 500 500"
            fill="none"
            stroke="currentColor"
            strokeWidth={12}
            strokeLinecap="square"
            role="img"
            aria-label={label}
        >
            <path d="M248 128 L415 295 L332 378 L248 295 L165 378 L82 295 Z" />
            <path d="M165 212 L248 295 L332 212" />
            <path d="M248 50 V120 M216 85 H280 M225 62 L271 108 M271 62 L225 108" />
            <path d="M165 386 V446 M150 432 H180" />
            <path d="M248 303 V376 M233 362 H263" />
            <path d="M332 386 V446 M317 432 H347" />
        </svg>
    );
}
