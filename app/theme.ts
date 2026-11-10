import {createTheme} from '@mantine/core';

/**
 * The Mantine theme of the Modeler and of Storybook: one sans (Geist) and one monospace (Geist Mono) family for every
 * component. The library CSS reads the fonts from `--mantine-font-family` and `--mantine-font-family-monospace`, so
 * this theme is the only place that names a font. `index.html` (and `.storybook/preview-head.html`) load the fonts.
 */
const SANS = 'Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
const MONO = '"Geist Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

export const modelerTheme = createTheme({
    fontFamily: SANS,
    fontFamilyMonospace: MONO,
    headings: {fontFamily: SANS, fontWeight: '600'},
});
