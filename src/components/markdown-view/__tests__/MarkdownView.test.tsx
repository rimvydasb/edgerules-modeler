import {describe, expect, it, vi} from 'vitest';
import {render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MarkdownView} from '../MarkdownView';
import {transformUrl} from '../markdownDocument';
import {SAMPLE_README} from '../testing/sampleReadme';

function view(markdown: string, props: Partial<Parameters<typeof MarkdownView>[0]> = {}) {
    const {container} = render(<MarkdownView markdown={markdown} {...props} />);
    // The container also holds the style tag of the Mantine provider.
    return container.querySelector<HTMLElement>('[data-markdown-view]')!;
}

describe('MarkdownView — GitHub Flavored Markdown', () => {
    it('renders headings, tables, task lists, strikethrough, quotes and images', () => {
        const container = view(SAMPLE_README);
        expect(screen.getByRole('heading', {level: 1, name: 'Loan Repayment'})).toBeInTheDocument();
        expect(screen.getByRole('heading', {level: 2, name: 'Inputs'})).not.toHaveAttribute('id');

        const table = screen.getByRole('table');
        expect(
            within(table)
                .getAllByRole('columnheader')
                .map((cell) => cell.textContent),
        ).toEqual(['Input', 'Type', 'Example']);
        expect(within(table).getAllByRole('row')).toHaveLength(4);

        const boxes = screen.getAllByRole('checkbox');
        expect(boxes.map((box) => (box as HTMLInputElement).checked)).toEqual([true, false]);
        expect(boxes.every((box) => (box as HTMLInputElement).disabled)).toBe(true);

        expect(container.querySelector('del')).toHaveTextContent('Fixed rate only');
        expect(container.querySelector('blockquote')).toHaveTextContent('The rate is yearly');
        expect(screen.getByRole('img', {name: 'Repayment chart'})).toHaveAttribute('src', 'docs/chart.png');
    });

    it('highlights edgerules fences with the token classes of the code editors', () => {
        const container = view('```edgerules\n{ total: price * 2 }\n```\n\n```json\n{"a": 1}\n```');
        const [edgeRules, json] = [...container.querySelectorAll('pre > code')];
        expect(edgeRules.textContent).toBe('{ total: price * 2 }');
        expect(edgeRules.querySelector('.tok-propertyName')).toHaveTextContent('total');
        expect(edgeRules.querySelector('.tok-number')).toHaveTextContent('2');
        expect(json.textContent).toBe('{"a": 1}');
        expect(json.querySelector('span')).toBeNull();
    });

    it('turns bare https URLs into links', () => {
        view('Visit https://edgerules.dev today.');
        expect(screen.getByRole('link', {name: 'https://edgerules.dev'})).toHaveAttribute(
            'href',
            'https://edgerules.dev',
        );
    });
});

describe('MarkdownView — safety', () => {
    it('drops raw HTML and keeps the text between inline tags', () => {
        const container = view(
            [
                '<div onclick="alert(1)">A raw block</div>',
                '',
                '<script>alert(1)</script>',
                '',
                'Inline <b>bold</b> and <img src=x onerror="alert(1)"> text.',
                '',
                '| Cell |',
                '| ---- |',
                '| <i>in a table</i> |',
                '',
                '> Quoted <span>in a quote</span>',
            ].join('\n'),
        );
        expect(container.querySelector('script, div[onclick], b, i, span, img')).toBeNull();
        expect(container.innerHTML).not.toContain('alert');
        expect(container.textContent).not.toContain('A raw block');
        expect(container.textContent).toContain('Inline bold and  text.');
        expect(screen.getByRole('cell')).toHaveTextContent('in a table');
        expect(container.querySelector('blockquote')).toHaveTextContent('in a quote');
    });

    it('renders javascript:, data:, http: and protocol-relative links as text', () => {
        const container = view(
            [
                '[script](javascript:alert(1))',
                '[tabbed](java\tscript:alert(1))',
                '[data](data:text/html,x)',
                '[plain](http://example.com)',
                '[other host](//example.com)',
                '![pixel](javascript:alert(1))',
            ].join(' '),
        );
        expect(container.querySelector('a, img')).toBeNull();
        expect(container.textContent).toContain('script');
        expect(container.textContent).toContain('other host');
    });

    it('opens https links in a new tab and keeps mailto links', () => {
        view('[site](https://edgerules.dev) [mail](mailto:rules@example.com)');
        expect(screen.getByRole('link', {name: 'site'})).toMatchObject({target: '_blank', rel: 'noopener noreferrer'});
        const mail = screen.getByRole('link', {name: 'mail'});
        expect(mail).toHaveAttribute('href', 'mailto:rules@example.com');
        expect(mail).not.toHaveAttribute('target');
    });
});

describe('MarkdownView — URLs and model links', () => {
    it('rewrites relative images and links with resolveUrl, but not fragments', () => {
        const resolveUrl = vi.fn((relative: string) => `https://files.example.com/abc123/${relative}`);
        view('![chart](docs/chart.png) [guide](./guide.md) [top](#top) [abs](https://x.dev/a)', {resolveUrl});
        expect(screen.getByRole('img', {name: 'chart'})).toHaveAttribute(
            'src',
            'https://files.example.com/abc123/docs/chart.png',
        );
        expect(screen.getByRole('link', {name: 'guide'})).toHaveAttribute(
            'href',
            'https://files.example.com/abc123/./guide.md',
        );
        expect(screen.getByRole('link', {name: 'top'})).toHaveAttribute('href', '#top');
        expect(resolveUrl.mock.calls.map(([relative]) => relative)).toEqual(['docs/chart.png', './guide.md']);
    });

    it('calls onModelLink with the model path of a model: link', async () => {
        const user = userEvent.setup();
        const onModelLink = vi.fn();
        view('See [the payment](model:loan.monthlyPayment).', {onModelLink});
        await user.click(screen.getByRole('link', {name: 'the payment'}));
        expect(onModelLink).toHaveBeenCalledExactlyOnceWith('loan.monthlyPayment');
    });

    it('renders model: links as text without onModelLink', () => {
        const container = view('See [the payment](model:monthlyPayment).');
        expect(container.querySelector('a')).toBeNull();
        expect(container.textContent).toBe('See the payment.');
    });

    it('never offers a model: image', () => {
        expect(transformUrl('model:x', 'image')).toBeNull();
        expect(transformUrl('model:x', 'link')).toBe('model:x');
    });
});
