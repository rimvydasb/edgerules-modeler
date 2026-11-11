// Proposal helpers: <i data-i="name"></i> → inline SVG icon; theme toggle; dismissible notes.
const P = (d) =>
    d
        .split('|')
        .map((x) => `<path d="${x}"/>`)
        .join('');
const ICONS = {
    search: P('M10.5 4a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13z|M15.5 15.5 20 20'),
    plus: P('M12 5v14|M5 12h14'),
    arrow: P('M5 12h14|M13 6l6 6-6 6'),
    copy: P('M8 8h11v11H8z|M5 16V5h11'),
    open: P('M14 4h6v6|M20 4l-9 9|M18 14v6H4V6h6'),
    dots: P('M12 5.5v.01|M12 12v.01|M12 18.5v.01'),
    flow: P('M4 5h6v5H4z|M14 14h6v5h-6z|M7 10v3a2 2 0 0 0 2 2h5'),
    boxed: P('M4 4h16v16H4z|M4 9h16|M4 14h16|M10 9v11'),
    code: P('M9 7l-5 5 5 5|M15 7l5 5-5 5'),
    tests: P('M9 3h6|M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3|M7.5 14h9'),
    gear: P(
        'M12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6z|M12 2v3|M12 19v3|M2 12h3|M19 12h3|M4.9 4.9l2.1 2.1|M17 17l2.1 2.1|M4.9 19.1 7 17|M17 7l2.1-2.1',
    ),
    book: P('M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z|M5 17a3 3 0 0 1 3-3h11'),
    fx: '<text x="12" y="17" text-anchor="middle" font-family="STIX Two Text,serif" font-style="italic" font-size="16" fill="currentColor" stroke="none">ƒ</text>',
    doc: P('M6 3h9l4 4v14H6z|M14 3v5h5|M9 13h7|M9 17h5'),
    type: P('M4 4h7l9 9-7 7-9-9z|M8 8v.01'),
    facts: P('M4 5h16v14H4z|M4 10h16|M9 10v9'),
    decision: P('M12 3l9 9-9 9-9-9z|M12 8v5|M12 16v.01'),
    service: P('M5 12h4|M15 12h4|M9 7h6v10H9z|M12 4v3|M12 17v3'),
    clock: P('M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18z|M12 7v5l3 2'),
    db: P(
        'M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3z|M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6|M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3',
    ),
    moon: P('M20 14A8 8 0 1 1 10 4a6 6 0 0 0 10 10z'),
    chev: P('M6 9l6 6 6-6'),
    close: P('M6 6l12 12|M18 6 6 18'),
    sidebar: P('M4 4h16v16H4z|M9 4v16'),
    library: P('M5 4v16|M10 4v16|M15 4l4 16'),
    home: P('M4 11l8-7 8 7|M6 9.5V20h12V9.5'),
    check: P('M5 12l5 5 9-10'),
    up: P('M12 19V5|M6 11l6-6 6 6'),
    star: P('M12 3v18|M3 12h18|M5.6 5.6l12.8 12.8|M18.4 5.6 5.6 18.4'),
    grid: P('M4 4h7v7H4z|M13 4h7v7h-7z|M4 13h7v7H4z|M13 13h7v7h-7z'),
    list: P('M4 6h16|M4 12h16|M4 18h16'),
    // industries, drawn in sodas geometry: diamonds, pendants, straight threads
    financial: P('M12 3l5 5-5 5-5-5z|M7 13l5 5 5-5|M12 13v8|M10 19h4'),
    insurance: P('M3 12l9-9 9 9|M7 12l5 5 5-5|M12 17v4|M10 19.5h4'),
    health: P('M12 4v16|M4 12h16|M12 8l4 4-4 4-4-4z'),
    logistics: P('M7 8l4 4-4 4-4-4z|M17 8l4 4-4 4-4-4z|M11 12h2'),
    retail: P('M12 3l3 3-3 3-3-3z|M4 11h16l-2 9H6z|M12 9v2'),
    telco: P('M12 3v18|M5 7l14 10|M19 7 5 17|M12 9l3 3-3 3-3-3z'),
    public: P('M3 9l9-6 9 6|M5 9v9|M9.6 9v9|M14.4 9v9|M19 9v9|M3 20h18'),
};
document.querySelectorAll('i[data-i]').forEach((el) => {
    const n = el.dataset.i;
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('fill', 'none');
    s.setAttribute('stroke', 'currentColor');
    s.setAttribute('stroke-width', el.dataset.w || '1.6');
    s.setAttribute('stroke-linecap', 'square');
    s.setAttribute('aria-hidden', 'true');
    s.innerHTML = ICONS[n] || '';
    if (el.className) s.setAttribute('class', el.className);
    el.replaceWith(s);
});
document.querySelectorAll('[data-theme-toggle]').forEach((b) =>
    b.addEventListener('click', () => {
        const r = document.documentElement;
        r.dataset.theme = r.dataset.theme === 'dark' ? 'light' : 'dark';
    }),
);
document
    .querySelectorAll('.proposal-note .x')
    .forEach((x) => x.addEventListener('click', () => x.parentElement.remove()));
