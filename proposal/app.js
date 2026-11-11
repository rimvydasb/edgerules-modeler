/* EdgeRules Modeler — browsable design prototype (v2). Hash routes mirror the real app routes. */
const D = window.DATA;
const $app = document.getElementById('app');

/* ───────────── icons (lucide-like strokes) ───────────── */
const P = (s) =>
    s
        .split('|')
        .map((d) => `<path d="${d}"/>`)
        .join('');
const IC = {
    search: P('M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14z|M20 20l-4-4'),
    plus: P('M12 5v14|M5 12h14'),
    arrow: P('M5 12h14|M13 6l6 6-6 6'),
    chev: P('M6 9l6 6 6-6'),
    chevr: P('M9 6l6 6-6 6'),
    copy: P('M9 9h11v11H9z|M5 15V4h11'),
    open: P('M14 4h6v6|M20 4l-9 9|M18 14v6H4V6h6'),
    dots: P('M12 5.5h.01|M12 12h.01|M12 18.5h.01'),
    flow: P('M4 5h6v5H4z|M14 14h6v5h-6z|M7 10v3a2 2 0 0 0 2 2h5'),
    boxed: P('M4 4h16v16H4z|M4 9h16|M4 14h16|M10 9v11'),
    code: P('M9 7l-5 5 5 5|M15 7l5 5-5 5'),
    tests: P('M9 3h6|M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3|M7.5 14h9'),
    gear: P(
        'M12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6z|M12 2v3|M12 19v3|M2 12h3|M19 12h3|M4.9 4.9l2.1 2.1|M17 17l2.1 2.1|M4.9 19.1 7 17|M17 7l2.1-2.1',
    ),
    book: P('M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z|M5 17a3 3 0 0 1 3-3h11'),
    doc: P('M6 3h9l4 4v14H6z|M14 3v5h5|M9 13h7|M9 17h5'),
    clock: P('M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18z|M12 7v5l3 2'),
    db: P(
        'M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3z|M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6|M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3',
    ),
    moon: P('M20 14A8 8 0 1 1 10 4a6 6 0 0 0 10 10z'),
    sidebar: P('M4 4h16v16H4z|M9 4v16'),
    library: P('M4 19V5|M9 19V5|M14 5l5 14'),
    grid: P('M4 4h7v7H4z|M13 4h7v7h-7z|M4 13h7v7H4z|M13 13h7v7h-7z'),
    list: P('M8 6h12|M8 12h12|M8 18h12|M4 6h.01|M4 12h.01|M4 18h.01'),
    check: P('M5 12l5 5 9-10'),
    up: P('M12 19V5|M6 11l6-6 6 6'),
    link: P('M10 14a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-1 1|M14 10a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l1-1'),
    github: P(
        'M9 19c-4 1.5-4-2-6-2.5|M15 22v-3.9a3.4 3.4 0 0 0-1-2.6c3.1-.3 6.4-1.5 6.4-7a5.4 5.4 0 0 0-1.5-3.8 5 5 0 0 0-.1-3.7s-1.2-.4-3.9 1.4a13.4 13.4 0 0 0-7 0C5.2 1.6 4 2 4 2a5 5 0 0 0-.1 3.7A5.4 5.4 0 0 0 2.4 9.5c0 5.4 3.3 6.6 6.4 7a3.4 3.4 0 0 0-1 2.6V22',
    ),
    trash: P('M4 7h16|M10 11v6|M14 11v6|M6 7l1 13h10l1-13|M9 7V4h6v3'),
    edit: P('M4 20h4L19 9l-4-4L4 16z'),
    play: P('M7 5l12 7-12 7z'),
    home: P('M4 11l8-7 8 7|M6 9.5V20h12V9.5'),
    bank: P('M3 9l9-5 9 5|M5 9v9|M10 9v9|M14 9v9|M19 9v9|M3 20h18'),
    shield: P('M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z'),
    heart: P('M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z'),
    truck: P('M3 6h11v10H3z|M14 10h4l3 3v3h-7|M7 19a2 2 0 1 0 0-.1|M17 19a2 2 0 1 0 0-.1'),
    fx: '<text x="12" y="16.5" text-anchor="middle" font-family="Geist,sans-serif" font-style="italic" font-weight="500" font-size="13" fill="currentColor" stroke="none">fx</text>',
    type: P('M4 4h7l9 9-7 7-9-9z|M8 8h.01'),
    facts: P('M4 5h16v14H4z|M4 10h16|M9 10v9'),
    decision: P('M12 3l9 9-9 9-9-9z|M12 8v5|M12 16h.01'),
    table: P('M4 5h16v14H4z|M4 10h16|M4 15h16|M12 10v9'),
    x: P('M6 6l12 12|M18 6 6 18'),
    info: P('M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18z|M12 11v5|M12 8h.01'),
    filter: P('M4 5h16l-6 8v6l-4-2v-4z'),
    enter: P('M20 5v6a3 3 0 0 1-3 3H5|M9 10l-4 4 4 4'),
    split: P('M4 4h16v16H4z|M15 4v16'),
    sitemap: P('M9 3h6v5H9z|M3 16h6v5H3z|M15 16h6v5h-6z|M6 16v-3h12v3|M12 8v5'),
    panelOpen: P('M4 4h16v16H4z|M9 4v16|M13 10l2 2-2 2'),
    panelClose: P('M4 4h16v16H4z|M9 4v16|M15 10l-2 2 2 2'),
    minus: P('M5 12h14'),
    fit: P('M4 9V4h5|M15 4h5v5|M20 15v5h-5|M9 20H4v-5'),
    arrange: P('M4 4v16|M20 4v16|M9 8h6v8H9z'),
    inputN: P('M10 4h8a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-8|M3 12h11|M11 9l3 3-3 3'),
    outputN: P('M14 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8|M21 12H10|M13 9l-3 3 3 3'),
    listN: P('M4 5h5v5H4z|M4 14h5v5H4z|M13 6h7|M13 9h5|M13 15h7|M13 18h5'),
    varx: '<text x="12" y="16.5" text-anchor="middle" font-family="ui-sans-serif,system-ui,sans-serif" font-style="italic" font-size="12" fill="currentColor" stroke="none">(x)</text>',
    fxN: P('M8 20c2 0 2.6-1.6 3-4l1.6-9c.4-2.4 1-3 3.4-3|M8 9h7|M14 13l5 6|M19 13l-5 6'),
    sqrt: P('M3 13h3l3 7 5-16h7|M14 10l5 6|M19 10l-5 6'),
    chart: P('M4 4v16h16|M7 15l4-4 3 3 5-6'),
    ext: P('M14 4h6v6|M20 4l-9 9|M18 14v6H4V6h6'),
};
const ic = (n, cls = 'i') =>
    `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[n] || ''}</svg>`;
const KIND = {
    type: ['var(--k-type)', 'type'],
    facts: ['var(--k-facts)', 'facts'],
    function: ['var(--k-function)', 'fx'],
    ruleset: ['var(--k-ruleset)', 'table'],
    decision: ['var(--k-decision)', 'decision'],
    service: ['var(--k-service)', 'fx'],
    var: ['var(--k-var)', 'code'],
    test: ['var(--k-test)', 'tests'],
    model: ['var(--k-model)', 'book'],
    doc: ['var(--k-var)', 'doc'],
};
const kind = (k, size = '') => `<span class="kind ${size}" style="background:${KIND[k][0]}">${ic(KIND[k][1])}</span>`;
const esc = (s) =>
    String(s ?? '').replace(/[&<>"]/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'})[c]);
const initials = (n) =>
    n
        .replace(/\(.*\)/, '')
        .trim()
        .split(/\s+/)
        .map((w) => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();
const projMark = (p, size = '') => `<span class="kind ${size} pm">${initials(p.name)}</span>`;

/* ───────────── state ───────────── */
const S = {
    exView: 'grid',
    exFeats: new Set(),
    exStatus: 'all',
    exSort: 'Relevance',
    wsView: 'grid',
    wsSource: 'all',
    wsQuery: '',
    wsOrigins: new Set(),
    wsStatus: 'all',
    wsSort: 'Last saved',
    explorerOpen: true,
    openPid: null, // the project open as a tab in the app bar
    notes: false,
    pop: null,
    modal: null,
    toast: null,
};

/* ───────────── helpers over data ───────────── */
const ind = (id) => D.industries.find((i) => i.id === id);
const ex = (id) => D.examples.find((e) => e.id === id);
const proj = (pid) => D.projects.find((p) => p.pid === pid);
const copiesOf = (id) => D.projects.filter((p) => p.origin && p.origin.split('@')[0] === id);
function exStatus(e) {
    const c = copiesOf(e.id);
    if (!c.length) return {k: 'none'};
    const newest = c.some((p) => p.origin.endsWith('@' + e.v));
    return newest ? {k: 'in', n: c.length, latest: c[0]} : {k: 'update', n: c.length, latest: c[0]};
}
function originStatus(p) {
    if (!p.origin) return null;
    const [id, v] = p.origin.split('@');
    const e = ex(id);
    return e && e.v !== v ? {update: e.v} : {update: null};
}
const exUrl = (e) => `#/examples/${e.ind}/${e.id}@${e.v}`;

/* ───────────── router ───────────── */
function parse() {
    const h = location.hash.slice(1) || '/';
    const [path, qs] = h.split('?');
    const q = Object.fromEntries(new URLSearchParams(qs || ''));
    const seg = path.split('/').filter(Boolean);
    return {path, seg, q};
}
function go(h) {
    location.hash = h;
}

/* ───────────── top bar ───────────── */
function logo() {
    return `<a class="logo" href="#/" title="EdgeRules"><span class="mk"><img src="assets/sodas-solid-white.svg" alt=""/></span>EdgeRules</a>`;
}
/*
 * One app bar on every page — it says where you can go, never where you are. The open project is a tab of this bar
 * (as in the app today), so it stays one click away while you browse examples or the workspace. Where you are inside
 * a project is the job of the Shell header row below it (unchanged library component).
 */
function appBar(active) {
    const open = S.openPid && proj(S.openPid);
    return `<header class="bar">
        ${logo()}
        <nav class="nav">
            <a href="#/" class="${active === 'home' ? 'on' : ''}">${ic('home')}<span class="lbl">Home</span></a>
            <a href="#/examples" class="${active === 'examples' ? 'on' : ''}">${ic('library')}<span class="lbl">Examples</span></a>
            <a href="#/workspace" class="${active === 'workspace' ? 'on' : ''}">${ic('db')}<span class="lbl">Workspace</span></a>
            ${
                open
                    ? `<span class="nsep"></span><span class="ptab ${active === 'project' ? 'on' : ''}"><a href="#/project/${open.pid}" title="${esc(open.name)}">${projMark(open, 'xs')}<span class="lbl">${esc(open.name)}</span></a><button data-act="closeproj" title="Close project">${ic('x')}</button></span>`
                    : ''
            }
        </nav>
        <span class="sp"></span>
        <button class="searchbtn" data-act="palette">${ic('search')}<span class="lbl">Search projects and examples</span><span class="k kbd">/</span></button>
        <button class="iconbtn" data-act="theme" title="Theme">${ic('moon')}</button>
    </header>`;
}
/* The Shell header row of the library (src/components/shell): kind square · breadcrumbs · settings · view cells ·
 * split toggle. One project is one model with one name, so the first crumb is the project (= model) name, and it is
 * the project menu ▾ — the separate project menu on the right and the second "model title" name are gone.
 * The gear is the settings of the root path, as ShellSettings today: Model settings at the root, Workbook settings
 * on a workbook. Only the Flow cell reads "Overview" at the project root. */
function shellRow(p, root, view, isHome) {
    const settings = root ? 'Workbook settings' : 'Model settings';
    const views = [
        ['flow', 'Flow', 'flow'],
        ['boxed', 'Boxed', 'boxed'],
        ['code', 'Code', 'code'],
        ['tests', 'Tests', 'tests'],
    ];
    const base = `#/project/${p.pid}${root ? '/' + root : ''}`;
    const crumbs =
        `<button class="sh-proj ${root ? '' : 'cur'}" data-act="projmenu" title="Project menu">${esc(p.name)}${ic('chev')}</button>` +
        (root ? `${ic('chevr', 'i sh-sep')}<span class="sh-cur">${esc(root)}</span>` : '');
    return `<div class="sh-row">
        <a class="sh-kind" href="${base}?view=flow" title="Open in the Flow view">${ic(root ? 'book' : 'sitemap')}</a>
        <nav class="sh-crumbs">${crumbs}</nav>
        <button class="sh-cell sq" data-act="settings" data-root="${esc(root || '*')}" title="${settings}">${ic('gear')}</button>
        <nav class="sh-views">${views
            .map(
                ([v, l, i]) =>
                    `<a class="sh-cell ${view === v ? 'on' : ''}" href="${base}?view=${v}">${ic(i)}${isHome && v === 'flow' ? 'Overview' : l}</a>`,
            )
            .join('')}</nav>
        <button class="sh-cell sq" title="Split screen">${ic('split')}</button>
    </div>`;
}

/* ───────────── shared components ───────────── */
// Feature tags for a card: the first `max`, then a "+N" tag for the rest.
function featTags(feats, max = 3) {
    return (
        feats
            .slice(0, max)
            .map((f) => `<span class="tag">${f}</span>`)
            .join('') + (feats.length > max ? `<span class="tag">+${feats.length - max}</span>` : '')
    );
}
function exCard(e, opts = {}) {
    const st = exStatus(e);
    const feats = featTags(e.feats, opts.maxTags);
    const badge =
        st.k === 'in'
            ? `<span class="badge ok">${ic('check')}In workspace · ${st.n}</span>`
            : st.k === 'update'
              ? `<span class="badge accent">${ic('up')}Update ${e.v}</span>`
              : '';
    const action =
        st.k === 'in'
            ? `<button class="btn sm" data-act="open-copy" data-id="${e.id}">${ic('open')}Open copy</button>`
            : `<button class="btn sm primary" data-act="copy-open" data-id="${e.id}">${ic('copy')}Copy and open</button>`;
    return `<a class="card link excard" href="${exUrl(e)}">
        <div class="cb">
            <div class="row1"><span class="eyebrow">${ind(e.ind).title}</span>${badge}</div>
            <h3>${esc(e.name)}</h3>
            <p class="clamp">${esc(e.desc)}</p>
            <div class="tags" style="margin-top:auto;padding-top:6px">${feats}</div>
        </div>
        <div class="cf"><span class="mono">v${e.v}</span><span>·</span><span>${e.tests} tests</span><span class="sp"></span><span class="hov">${action}</span></div>
    </a>`;
}
function exRow(e) {
    const st = exStatus(e);
    return `<tr data-href="${exUrl(e)}">
        <td><div style="font-weight:600">${esc(e.name)}</div><div class="muted" style="font-size:13px">${esc(e.desc)}</div></td>
        <td class="t2" style="font-size:13px">${ind(e.ind).title}</td>
        <td><div class="tags">${e.feats
            .slice(0, 3)
            .map((f) => `<span class="tag">${f}</span>`)
            .join('')}</div></td>
        <td class="num">v${e.v}</td>
        <td class="num">${e.tests}</td>
        <td>${st.k === 'in' ? `<span class="badge ok">${ic('check')}${st.n}</span>` : st.k === 'update' ? `<span class="badge accent">${ic('up')}update</span>` : ''}</td>
        <td style="text-align:right">${
            st.k === 'in'
                ? `<button class="btn sm" data-act="open-copy" data-id="${e.id}">Open copy</button>`
                : `<button class="btn sm primary" data-act="copy-open" data-id="${e.id}">Copy and open</button>`
        }</td>
    </tr>`;
}
function projCard(p) {
    const os = originStatus(p);
    return `<a class="card link pcard" href="#/project/${p.pid}">
        <div class="cb" style="flex-direction:row;align-items:center;gap:12px">
            ${projMark(p)}
            <div style="min-width:0;flex:1">
                <h3 class="ell">${esc(p.name)}</h3>
                <div class="muted ell" style="font-size:12.5px">${p.origin ? `<span class="mono">${esc(p.origin)}</span>` : 'Own project'}</div>
            </div>
        </div>
        <div class="cf">${ic('clock')}${esc(p.saved)}${os && os.update ? `<span class="sp"></span><span class="badge accent">${ic('up')}${os.update}</span>` : ''}</div>
    </a>`;
}
function footer() {
    return `<footer class="foot">
        <img class="sway" src="assets/sodas.svg" alt="" title="Sodas"/>
        <span>EdgeRules Modeler · engine ${D.engine}</span><span class="sp"></span>
        <a href="https://github.com/rimvydasb/edgerules" target="_blank" rel="noreferrer">GitHub</a>
        <a href="#/design">Design notes</a>
    </footer>`;
}

/* ───────────── pages ───────────── */
function pageHome() {
    const recent = D.projects.slice(0, 4);
    // Featured examples first (in order), then the rest, to fill a row of 4.
    const featured = [...D.examples].sort((a, b) => (a.featured || Infinity) - (b.featured || Infinity)).slice(0, 4);
    const releases = [
        ['2026-11-08', 'modeler', 'Flow Editor', 'Calmer canvas, typed pins and wires.'],
        ['2026-11-08', 'engine', 'Portable format', 'Fields maps and a kinds filter.'],
        ['2026-11-01', 'modeler', 'Workspace', 'Filter by My Projects and Example Projects.'],
        ['2026-10-20', 'engine', 'Execution', 'Faster execute and get on large models.'],
        ['2026-10-12', 'modeler', 'Editors', 'Test Runner and Decision Table Editor improvements.'],
    ];
    return (
        appBar('home') +
        `<main class="page wide home">
        <section class="hero">
            <div class="eyebrow">EdgeRules Modeler</div>
            <h1>Model, test and run<br/>business decisions.</h1>
            <p>Start from a worked example or a blank project. Everything runs and stays in this browser.</p>
            <div class="herosearch" data-act="palette">${ic('search')}<span>Search ${D.examples.length} examples and ${D.projects.length} projects</span><span class="kbd">/</span></div>
            <div class="quick">
                <button class="btn primary" data-act="new-project">${ic('plus')}New project</button>
                <a class="btn" href="#/examples">${ic('library')}Browse examples</a>
            </div>
        </section>

        <div class="sec"><h2>Workspace</h2><span class="cnt">${D.projects.length}</span><a class="more" href="#/workspace">All projects ${ic('arrow')}</a></div>
        <div class="grid">${recent.map((p) => wsCard(p, {maxTags: 2})).join('')}</div>

        <div class="sec"><h2>Examples</h2><span class="cnt">${D.examples.length}</span><a class="more" href="#/examples">All examples ${ic('arrow')}</a></div>
        <div class="grid">${featured.map((e) => exCard(e, {maxTags: 2})).join('')}</div>

        <div class="split2">
            <div>
                <div class="sec"><h2>Industries</h2></div>
                <div class="inds">${D.industries
                    .map((i) => {
                        const n = D.examples.filter((e) => e.ind === i.id).length;
                        return `<a class="ind" href="#/examples/${i.id}"><span class="kind outline">${ic(i.icon)}</span><span><b>${i.title}</b><small>${n} example${n === 1 ? '' : 's'}</small></span>${ic('chevr')}</a>`;
                    })
                    .join('')}</div>
            </div>
            <div>
                <div class="sec"><h2>Release log</h2></div>
                <div class="relog">${releases
                    .map(
                        ([d, p, t, x]) =>
                            `<div class="rel"><span class="rprod ${p}">${p === 'modeler' ? 'Modeler' : 'Rule Engine'}</span><div class="rbody"><div class="rtitle">${t}</div><div class="rtext">${x}</div></div><span class="mono muted">${d}</span></div>`,
                    )
                    .join('')}</div>
            </div>
        </div>
        ${footer()}
    </main>`
    );
}

function pageExamples(industry, q) {
    const query = (q.q || '').toLowerCase();
    let list = D.examples.filter((e) => !industry || e.ind === industry);
    if (query)
        list = list.filter((e) =>
            [e.name, e.desc, e.id, ...e.feats, ind(e.ind).title].join(' ').toLowerCase().includes(query),
        );
    if (S.exFeats.size) list = list.filter((e) => [...S.exFeats].every((f) => e.feats.includes(f)));
    if (S.exStatus !== 'all')
        list = list.filter((e) => (S.exStatus === 'none' ? exStatus(e).k === 'none' : exStatus(e).k !== 'none'));
    if (S.exSort === 'Name') list.sort((a, b) => a.name.localeCompare(b.name));
    if (S.exSort === 'Last release') list.sort((a, b) => (a.released < b.released ? 1 : -1));
    const allFeats = {};
    D.examples
        .filter((e) => !industry || e.ind === industry)
        .forEach((e) => e.feats.forEach((f) => (allFeats[f] = (allFeats[f] || 0) + 1)));
    const chips = [
        ...(industry
            ? [
                  `<span class="badge neutral">${ind(industry).title}<a href="#/examples${query ? '?q=' + encodeURIComponent(query) : ''}">${ic('x')}</a></span>`,
              ]
            : []),
        ...[...S.exFeats].map(
            (f) =>
                `<span class="badge neutral mono">${f}<button data-act="feat" data-f="${f}">${ic('x')}</button></span>`,
        ),
    ];
    return (
        appBar('examples') +
        `<main class="page wide">
        <div class="ph">
            <div><div class="eyebrow">Library · read-only</div><h1>${industry ? ind(industry).title : 'Examples'}</h1></div>
        </div>
        <div class="exlay">
            <aside class="facets">
                <div class="fg"><div class="eyebrow">Industry</div>
                    <a class="${!industry ? 'on' : ''}" href="#/examples">All industries<span>${D.examples.length}</span></a>
                    ${D.industries
                        .map(
                            (i) =>
                                `<a class="${industry === i.id ? 'on' : ''}" href="#/examples/${i.id}">${ic(i.icon)}${i.title}<span>${D.examples.filter((e) => e.ind === i.id).length}</span></a>`,
                        )
                        .join('')}
                </div>
                <div class="fg"><div class="eyebrow">Features</div>
                    ${Object.entries(allFeats)
                        .sort((a, b) => b[1] - a[1])
                        .map(
                            ([f, n]) =>
                                `<label><input type="checkbox" data-act="feat" data-f="${f}" ${S.exFeats.has(f) ? 'checked' : ''}/><code>${f}</code><span>${n}</span></label>`,
                        )
                        .join('')}
                </div>
                <div class="fg"><div class="eyebrow">Workspace</div>
                    ${[
                        ['all', 'Any'],
                        ['none', 'Not copied yet'],
                        ['in', 'In my workspace'],
                    ]
                        .map(
                            ([k, l]) =>
                                `<label><input type="radio" name="st" data-act="status" data-k="${k}" ${S.exStatus === k ? 'checked' : ''}/>${l}</label>`,
                        )
                        .join('')}
                </div>
            </aside>
            <section>
                <div class="toolbar">
                    <label class="input" style="flex:1">${ic('search')}<input id="exq" placeholder="Search name, feature, tag…" value="${esc(q.q || '')}"/><span class="kbd">/</span></label>
                    <button class="select" data-act="sort">Sort <b>${S.exSort}</b>${ic('chev')}</button>
                    <div class="toggle"><button class="${S.exView === 'grid' ? 'on' : ''}" data-act="exview" data-v="grid" title="Cards">${ic('grid')}</button><button class="${S.exView === 'list' ? 'on' : ''}" data-act="exview" data-v="list" title="List">${ic('list')}</button></div>
                </div>
                <div class="resline"><span>${list.length} example${list.length === 1 ? '' : 's'}</span>${chips.join('')}</div>
                ${
                    !list.length
                        ? `<div class="empty"><img class="sway" src="assets/sodas.svg" alt=""/><h4>No examples match</h4>Try fewer filters or another word.</div>`
                        : S.exView === 'grid'
                          ? `<div class="grid">${list.map((e) => exCard(e)).join('')}</div>`
                          : `<table class="table"><thead><tr><th>Example</th><th>Industry</th><th>Features</th><th style="text-align:right">Version</th><th style="text-align:right">Tests</th><th>Copies</th><th></th></tr></thead><tbody>${list.map(exRow).join('')}</tbody></table>`
                }
            </section>
        </div>
    </main>`
    );
}

function pageDetails(industry, coord) {
    const [id, ver] = coord.split('@');
    const e = ex(id);
    if (!e) return page404();
    const st = exStatus(e);
    const copies = copiesOf(e.id);
    const related = D.examples
        .filter((x) => x.id !== e.id && (x.ind === e.ind || x.feats.some((f) => e.feats.includes(f))))
        .slice(0, 3);
    const actions =
        st.k === 'in'
            ? `<button class="btn primary" data-act="open-copy" data-id="${e.id}">${ic('open')}Open copy</button><button class="btn" data-act="copy-open" data-id="${e.id}">${ic('copy')}Copy again</button>`
            : `<button class="btn primary" data-act="copy-open" data-id="${e.id}">${ic('copy')}Copy and open</button><button class="btn" data-act="copy-only" data-id="${e.id}">${ic('plus')}Copy to workspace</button>`;
    const m = {'loan-origination': D.models.lo, 'client-outreach': D.models.co, 'loan-repayment': D.models.lr}[e.id];
    return (
        appBar('examples') +
        `<main class="page wide">
        <nav class="pcrumb"><a href="#/examples">Examples</a>${ic('chevr')}<a href="#/examples/${e.ind}">${ind(e.ind).title}</a>${ic('chevr')}<span>${esc(e.name)}</span></nav>
        <div class="dhead">
            <span class="kind lg outline">${ic(ind(e.ind).icon)}</span>
            <div style="flex:1;min-width:0">
                <h1>${esc(e.name)}</h1>
                <p>${esc(e.desc)}</p>
            </div>
            <div class="dact">
                <button class="select" data-act="version">${ic('clock')}<b>${ver || e.v}</b>${ver === e.v ? '<span class="muted">latest</span>' : ''}${ic('chev')}</button>
                ${actions}
                <button class="iconbtn" data-act="share" title="Copy link">${ic('link')}</button>
            </div>
        </div>
        ${
            copies.length
                ? `<div class="notice">${ic('info')}<span>You have <b>${copies.length} ${copies.length === 1 ? 'copy' : 'copies'}</b> of this example. The newest is <a href="#/project/${copies[0].pid}">${esc(copies[0].name)}</a>, saved ${copies[0].saved}.</span><a class="btn sm ghost" href="#/workspace?q=${e.id}">Show all</a></div>`
                : ''
        }
        <div class="dlay">
            <article class="card readme">
                <div class="rh">${ic('doc')}<span class="mono">README.md</span></div>
                <div class="md">
                    <h2>${esc(m ? m.title : e.name)}</h2>
                    <p>${esc(m ? m.readme : e.desc)}</p>
                    ${e.needs ? `<p>This example needs a <code>${esc(e.needs)}</code>: the Modeler provides HiGHS.</p>` : ''}
                    <h3>Inputs and outputs</h3>
                    <p>The service <code>${m && m.services[0] ? m.services[0].name : 'decide'}</code> takes ${m && m.services[0] ? `<code>${esc(m.services[0].args)}</code>` : 'the request'}.</p>
                    <table><thead><tr><th>Input</th><th>Meaning</th></tr></thead><tbody>
                        <tr><td><code>applicationDate</code>, <code>loanAmount</code></td><td>The date and the requested amount</td></tr>
                        <tr><td><code>propertyValue</code>, <code>termYears</code></td><td>The value of the property and the term in years</td></tr>
                        <tr><td><code>applicants</code></td><td>Per applicant: birth date, employment, income and budget</td></tr>
                    </tbody></table>
                    <p class="muted">… rendered by <code>MarkdownView</code>, as today.</p>
                </div>
            </article>
            <aside class="dside">
                <div class="card"><div class="cb" style="gap:0">
                    <dl class="kv">
                        <dt>Industry</dt><dd>${ind(e.ind).title}</dd>
                        <dt>Version</dt><dd class="mono">${e.v}</dd>
                        <dt>Released</dt><dd class="mono">${e.released}</dd>
                        <dt>Engine</dt><dd class="mono">${esc(e.engine)}</dd>
                        <dt>Tests</dt><dd>${e.tests}</dd>
                        <dt>Lines</dt><dd>${e.lines}</dd>
                        <dt>Id</dt><dd class="mono">${e.id}</dd>
                    </dl>
                </div></div>
                <div class="card"><div class="cb"><div class="eyebrow">Features</div><div class="tags">${e.feats.map((f) => `<a class="tag" href="#/examples?q=${f}">${f}</a>`).join('')}</div></div></div>
                ${e.needs ? `<div class="card warnc"><div class="cb"><div class="eyebrow" style="color:var(--warn)">Requirement</div><span style="font-size:13px">Needs a <b>MILP solver</b> in the host.</span></div></div>` : ''}
                <a class="btn ghost" href="https://github.com/rimvydasb/edgerules-examples" target="_blank" rel="noreferrer" style="justify-content:flex-start">${ic('github')}View on GitHub ${ic('open')}</a>
            </aside>
        </div>
        ${related.length ? `<div class="sec"><h2>Related examples</h2></div><div class="grid">${related.map((r) => exCard(r)).join('')}</div>` : ''}
    </main>`
    );
}

/* Workspace — the same page as Examples: header, facet sidebar, toolbar, result line, cards or list. */
const originId = (p) => (p.origin ? p.origin.split('@')[0] : null);
function wsCard(p, opts = {}) {
    const os = originStatus(p);
    const e = originId(p) && ex(originId(p));
    const m = D.models[p.model];
    const tags = e ? featTags(e.feats, opts.maxTags) : '<span class="tag">blank</span>';
    return `<a class="card link excard" href="#/project/${p.pid}">
        <div class="cb">
            <div class="row1"><span class="eyebrow">${e ? ind(e.ind).title : 'Own project'}</span>${os && os.update ? `<span class="badge accent" title="A newer version of the example exists">${ic('up')}Update ${os.update}</span>` : ''}</div>
            <h3>${esc(p.name)}</h3>
            <p class="clamp">${esc(p.desc) || '<span class="muted">No description</span>'}</p>
            <div class="tags" style="margin-top:auto;padding-top:6px">${tags}</div>
        </div>
        <div class="cf"><span class="saved">${ic('clock')}${esc(p.saved)}</span><span>·</span><span>${m.workbooks.length} workbook${m.workbooks.length === 1 ? '' : 's'}</span><span class="sp"></span><button class="iconbtn sm" data-act="rowmenu" data-pid="${p.pid}" title="More">${ic('dots')}</button></div>
    </a>`;
}
function wsRow(p) {
    const os = originStatus(p);
    const e = originId(p) && ex(originId(p));
    return `<tr data-href="#/project/${p.pid}">
        <td><div style="font-weight:600">${esc(p.name)}</div><div class="muted ell" style="font-size:13px;max-width:420px">${esc(p.desc) || '—'}</div></td>
        <td class="t2" style="font-size:13px">${e ? ind(e.ind).title : 'Own project'}</td>
        <td>${p.origin ? `<span class="tag">${esc(p.origin)}</span>` : ''}</td>
        <td>${os && os.update ? `<span class="badge accent">${ic('up')}${os.update}</span>` : ''}</td>
        <td class="num">${esc(p.saved)}</td>
        <td style="width:48px;text-align:right"><button class="iconbtn" data-act="rowmenu" data-pid="${p.pid}">${ic('dots')}</button></td>
    </tr>`;
}
function pageWorkspace(q) {
    const query = (S.wsQuery || q.q || '').toLowerCase();
    const bySource = (p, k) => k === 'all' || (k === 'ex' ? !!p.origin : !p.origin);
    let list = D.projects.filter((p) => bySource(p, S.wsSource));
    if (query) list = list.filter((p) => [p.name, p.desc, p.origin].join(' ').toLowerCase().includes(query));
    if (S.wsOrigins.size) list = list.filter((p) => S.wsOrigins.has(originId(p)));
    if (S.wsStatus === 'update') list = list.filter((p) => originStatus(p)?.update);
    if (S.wsStatus === 'current') list = list.filter((p) => p.origin && !originStatus(p).update);
    if (S.wsSort === 'Name') list = [...list].sort((a, b) => a.name.localeCompare(b.name));

    const origins = {};
    D.projects.filter((p) => p.origin).forEach((p) => (origins[originId(p)] = (origins[originId(p)] || 0) + 1));
    const nUpdate = D.projects.filter((p) => originStatus(p)?.update).length;
    const chips = [
        ...(S.wsSource !== 'all'
            ? [
                  `<span class="badge neutral">${S.wsSource === 'ex' ? 'Example Projects' : 'My Projects'}<button data-act="wssrc" data-k="all">${ic('x')}</button></span>`,
              ]
            : []),
        ...[...S.wsOrigins].map(
            (o) =>
                `<span class="badge neutral mono">${o}<button data-act="wsorigin" data-o="${o}">${ic('x')}</button></span>`,
        ),
        ...(S.wsStatus !== 'all'
            ? [
                  `<span class="badge neutral">${S.wsStatus === 'update' ? 'Update available' : 'Up to date'}<button data-act="wsstatus" data-k="all">${ic('x')}</button></span>`,
              ]
            : []),
    ];
    return (
        appBar('workspace') +
        `<main class="page wide">
        <div class="ph">
            <div style="flex:1"><div class="eyebrow">Local workspace</div><h1>Workspace</h1></div>
            <button class="btn primary" data-act="new-project">${ic('plus')}New project</button>
        </div>
        <div class="exlay">
            <aside class="facets">
                <div class="fg"><div class="eyebrow">Source</div>
                    ${[
                        ['all', 'All projects', 'db'],
                        ['ex', 'Example Projects', 'library'],
                        ['own', 'My Projects', 'doc'],
                    ]
                        .map(
                            ([k, l, i]) =>
                                `<a class="${S.wsSource === k ? 'on' : ''}" href="#/workspace" data-act="wssrc" data-k="${k}">${ic(i)}${l}<span>${D.projects.filter((p) => bySource(p, k)).length}</span></a>`,
                        )
                        .join('')}
                </div>
                <div class="fg"><div class="eyebrow">Storage</div>
                    <button class="storage-f" data-act="storage">
                        <span class="sf-top">${ic('db')}<span class="mono">150 KB</span><span class="mono muted">of 10 GB</span></span>
                        <span class="meter"><i style="width:4%"></i></span>
                        <span class="badge warn"><span class="dot"></span>Not persistent</span>
                    </button>
                </div>
            </aside>
            <section>
                <div class="toolbar">
                    <label class="input" style="flex:1">${ic('search')}<input id="wsq" placeholder="Search name, description, example…" value="${esc(S.wsQuery || q.q || '')}"/><span class="kbd">/</span></label>
                    <button class="select" data-act="wssort">Sort <b>${S.wsSort}</b>${ic('chev')}</button>
                    <div class="toggle"><button class="${S.wsView === 'grid' ? 'on' : ''}" data-act="wsview" data-v="grid" title="Cards">${ic('grid')}</button><button class="${S.wsView === 'list' ? 'on' : ''}" data-act="wsview" data-v="list" title="List">${ic('list')}</button></div>
                </div>
                <div class="resline"><span>${list.length} project${list.length === 1 ? '' : 's'}</span>${chips.join('')}</div>
                ${
                    !list.length
                        ? `<div class="empty"><img class="sway" src="assets/sodas.svg" alt=""/><h4>No projects match</h4><p style="margin:0 0 14px">Try fewer filters, or start a new one.</p><div style="display:flex;gap:8px;justify-content:center"><a class="btn" href="#/examples">Browse examples</a><button class="btn primary" data-act="new-project">New project</button></div></div>`
                        : S.wsView === 'grid'
                          ? `<div class="grid">${list.map(wsCard).join('')}</div>`
                          : `<table class="table"><thead><tr><th>Project</th><th>Industry</th><th>Example</th><th>Version</th><th style="text-align:right">Last saved</th><th></th></tr></thead><tbody>${list.map(wsRow).join('')}</tbody></table>`
                }
            </section>
        </div>
    </main>`
    );
}

/* ───────────── project ───────────── */
function explorer(p, root) {
    const m = D.models[p.model];
    const sec = (title, items) =>
        `<details open><summary><span>${title}</span><span class="c">${items.length}</span></summary>${items.length ? items.map(([k, n]) => `<a class="ei">${kind(k, 'sm')}<span class="mono">${esc(n)}</span></a>`).join('') : '<div class="ei muted" style="font-size:12px;padding-left:30px">None</div>'}</details>`;
    if (!S.explorerOpen)
        return `<aside class="explorer closed"><button class="ex-toggle" data-act="explorer" title="Show the Project Explorer">${ic('panelOpen')}</button></aside>`;
    return `<aside class="explorer">
        <div class="ex-head"><b>Project</b><button class="ex-toggle" data-act="explorer" title="Hide the Project Explorer">${ic('panelClose')}</button></div>
        <div class="ex-body">
        <label class="input sm">${ic('search')}<input placeholder="Search project"/></label>
        <a class="ei top ${!root ? 'on' : ''}" href="#/project/${p.pid}?view=flow">${ic('home')}<span>Overview</span></a>
        <a class="ei top">${kind('doc', 'sm')}<span>README.md</span></a>
        <details open><summary><span>Workbooks</span><span class="c">${m.workbooks.length}</span></summary>${m.workbooks
            .map(
                (w) =>
                    `<a class="ei ${root === w.id ? 'on' : ''}" href="#/project/${p.pid}/${w.id}?view=flow">${kind('model', 'sm')}<span>${esc(w.name)}</span></a>`,
            )
            .join('')}</details>
        ${Object.entries(m.tree)
            .map(([t, items]) => sec(t, items))
            .join('')}
        </div>
    </aside>`;
}
function projectHome(p) {
    const m = D.models[p.model];
    const os = originStatus(p);
    const counts = [
        ['type', 'Types', m.tree.Types.length],
        ['facts', 'Facts', m.tree['Facts library'].length],
        ['function', 'Methods', m.tree.Methods.length],
        ['decision', 'Decisions', m.tree.Decisions.length],
        ['var', 'Variables', m.tree.Variables.length],
    ];
    return `<div class="phome">
        <div class="phead">
            <div style="flex:1;min-width:0">
                <div class="eyebrow">Project</div>
                <h1>${esc(m.title)}</h1>
                <div class="pmeta">${p.origin ? `<a class="tag" href="#/examples/financial/${p.origin}">${ic('library')}&nbsp;from ${esc(p.origin)}</a>` : '<span class="tag">Own project</span>'}${os && os.update ? `<span class="badge accent">${ic('up')}Update ${os.update} available</span>` : ''}<span class="muted">Saved ${esc(p.saved)}</span></div>
            </div>
            <a class="btn" href="#/project/${p.pid}?view=tests">${ic('play')}Run tests</a>
            <a class="btn" href="#/project/${p.pid}?view=boxed">${ic('boxed')}Whole model</a>
        </div>
        <div class="pgrid">
            <div>
                ${m.readme ? `<div class="card readme-ex"><div class="cb"><p>${esc(m.readme)}</p><a class="lnk" href="#">Read README ${ic('arrow')}</a></div></div>` : `<div class="card"><div class="empty" style="padding:28px"><h4>No README yet</h4><button class="btn sm">${ic('plus')}Add README.md</button></div></div>`}

                <div class="sec"><h2>Entry points</h2><span class="cnt">${m.services.length}</span><span class="muted" style="font-size:12.5px">service methods</span></div>
                <div class="svcs">
                    ${m.services
                        .map(
                            (s) => `<a class="svc" href="#/project/${p.pid}?view=code">
                        ${kind('service')}
                        <div style="min-width:0;flex:1"><div class="sig"><b>${s.name}</b>(<span>${esc(s.args)}</span>)</div><div class="muted" style="font-size:13px">${esc(s.desc)}</div></div>
                        <span class="badge neutral">${ic('tests')}${s.tests} tests</span>${ic('chevr')}
                    </a>`,
                        )
                        .join('')}
                    <button class="svc add">${ic('plus')}New service method</button>
                </div>

                <div class="sec"><h2>Workbooks</h2><span class="cnt">${m.workbooks.length}</span></div>
                <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(260px,1fr))">
                    ${m.workbooks
                        .map(
                            (w) => `<a class="card link wbc" href="#/project/${p.pid}/${w.id}?view=flow">
                        <div class="cb">
                            <div style="display:flex;gap:10px;align-items:center">${kind('model')}<div style="min-width:0"><h3 class="ell">${esc(w.name)}</h3><div class="mono muted" style="font-size:12px">${w.id}</div></div></div>
                            <p class="clamp">${esc(w.desc) || '<span class="muted">No description</span>'}</p>
                        </div>
                        <div class="cf"><span>${esc(w.stats)}</span><span class="sp"></span><span class="hov wlinks"><span>${ic('flow')}Flow</span><span>${ic('boxed')}Boxed</span></span></div>
                    </a>`,
                        )
                        .join('')}
                    <button class="card newc">${ic('plus')}New workbook</button>
                </div>
            </div>
            <aside class="pside">
                <div class="card"><div class="cb">
                    <div class="eyebrow">Model</div>
                    ${counts.map(([k, l, n]) => `<a class="cnt-row">${kind(k, 'sm')}<span>${l}</span><b>${n}</b></a>`).join('')}
                </div></div>
                <div class="card"><div class="cb">
                    <div class="eyebrow">Tests</div>
                    <div class="big"><b>${m.tree.Tests.length}</b> suites · ${m.cases} cases</div>
                    <a class="btn sm" href="#/project/${p.pid}?view=tests">${ic('play')}Run all</a>
                </div></div>
                ${
                    p.origin
                        ? `<div class="card"><div class="cb">
                    <div class="eyebrow">Origin</div>
                    <span class="mono" style="font-size:12.5px">${esc(p.origin)}</span>
                    ${os && os.update ? `<span class="badge accent" style="align-self:flex-start">${ic('up')}${os.update} available</span>` : `<span class="badge ok" style="align-self:flex-start">${ic('check')}Up to date</span>`}
                    <a class="lnk" href="#/examples/financial/${p.origin}">View original example ${ic('arrow')}</a>
                </div></div>`
                        : ''
                }
            </aside>
        </div>
    </div>`;
}
/*
 * Flow Editor mock, drawn after src/components/flow-editor (coreNode.module.css, flowEditor.module.css): the collapsed
 * node palette rail, the dotted canvas, 40px ruled rows, kind tiles, typed pins and wires, controls and minimap. It shows
 * the capacityBook flow of the Mortgage Origination example as http://localhost:5174 renders it.
 */
function flowMock(p, root) {
    const C = {
        input: 'var(--fe-k-input)',
        fn: 'var(--fe-k-fn)',
        expr: 'var(--fe-k-expr)',
        out: 'var(--fe-k-out)',
    };
    const head = (color, icon, title, path) =>
        `<div class="fe-row"><span class="fe-tile" style="background:${color}">${ic(icon)}</span><div class="fe-hs"><div class="fe-hl fe-hfirst"><div class="fe-title"><b>${title}</b><span class="fe-path">${path}</span></div><span class="fe-kebab">${ic('dots')}</span></div></div></div>`;
    const pin = (side, type, on = true) => `<i class="fe-pin ${side} ${type} ${on ? 'on' : ''}"></i>`;
    const desc = (t) => `<div class="fe-row fe-desc"><span>${t}</span></div>`;
    const band = (a, b, wa) =>
        `<div class="fe-row"><div class="fe-track fe-band" style="width:${wa}px">${a}</div><div class="fe-track fe-band fe-band-out">${b}</div></div>`;
    const rk = `<span class="fe-rk">${ic('dots')}</span>`;
    const path = root || 'capacityBook';

    const household = `<div class="fe-node" style="left:0;top:40px;width:400px">
        ${head(C.input, 'inputN', 'Household', `${path}.household`)}
        <div class="fe-row fe-sumrow"><span class="fe-lbl">Input</span><span class="fe-sum">{ monthlyIncome, monthlyDebtPayments, rate }</span>${pin('out', 'rec', false)}</div>
        ${desc('The monthly income, the monthly debt payments and the offered rate of the household')}
        ${band('Fields', 'Values', 260)}
        ${[
            ['monthlyIncome', '6800'],
            ['monthlyDebtPayments', '250'],
            ['rate', '0.0425'],
        ]
            .map(
                ([n, v]) =>
                    `<div class="fe-row"><div class="fe-track fe-name" style="width:260px">${n}${rk}</div><div class="fe-track fe-val">${v}</div>${pin('out', 'num')}</div>`,
            )
            .join('')}
    </div>`;

    const capacity = `<div class="fe-node" style="left:480px;top:40px;width:400px">
        ${head(C.fn, 'fxN', 'Borrowing capacity', `${path}.capacity`)}
        <div class="fe-row fe-sumrow"><span class="fe-lbl">Calls</span><span class="fe-pick"><span class="fe-mini" style="background:${C.fn}">${ic('fxN')}</span>borrowingCapacity${ic('chev')}</span><span class="fe-ext">${ic('ext')}</span><span class="fe-sum" style="margin-left:0">→ object[]</span>${pin('out', 'rec', false)}</div>
        ${desc('The largest affordable payment and loan for each term')}
        ${band('Arguments', 'Result', 260)}
        ${['householdIncome', 'householdDebtPayments', 'rate']
            .map(
                (n, i) =>
                    `<div class="fe-row">${pin('in', 'num')}<div class="fe-track fe-name" style="width:260px">${n}<span class="fe-req">*</span>${rk}</div>${
                        i === 0
                            ? `<div class="fe-track fe-name fe-outname"><i>result</i></div>${pin('out', 'rec')}`
                            : `<div class="fe-track fe-filler"></div>`
                    }</div>`,
            )
            .join('')}
    </div>`;

    const rows = [
        [10, 2810, 239351],
        [15, 2810, 307823],
        [20, 2810, 355527],
        [25, 2810, 388762],
        [30, 2810, 411917],
    ];
    const table = `<div class="fe-node" style="left:960px;top:20px;width:max-content;min-width:340px">
        ${head(C.out, 'outputN', 'Capacity by term', `${path}.capacity`)}
        <div class="fe-row">${pin('in', 'rec')}<div class="fe-track fe-name" style="width:90px">value</div><div class="fe-track fe-tint">5 rows × 3 columns</div></div>
        <table class="fe-table"><thead><tr><th>#</th><th>termYears</th><th>maxPayment</th><th>maxLoan</th></tr></thead><tbody>
            ${rows.map((r, i) => `<tr><td>${i + 1}</td>${r.map((v) => `<td>${v}</td>`).join('')}</tr>`).join('')}
        </tbody></table>
    </div>`;

    // bar chart: x = termYears, y = maxLoan, 0..600K
    const W = 378,
        H = 236,
        L = 58,
        R = 12,
        T = 16,
        B = 44;
    const ph = H - T - B,
        pw = W - L - R,
        bw = pw / rows.length;
    const y = (v) => T + ph - (v / 600000) * ph;
    const svg = `<svg class="fe-chart" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
        ${[0, 200000, 400000, 600000].map((t) => `<line x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}" class="g"/><text x="${L - 6}" y="${y(t) + 3.5}" text-anchor="end">${t ? t / 1000 + 'K' : 0}</text>`).join('')}
        <line x1="${L}" x2="${L}" y1="${T}" y2="${T + ph}" class="ax"/>
        ${rows.map((r, i) => `<rect x="${L + i * bw + bw * 0.12}" y="${y(r[2])}" width="${bw * 0.76}" height="${T + ph - y(r[2])}"/><text x="${L + i * bw + bw / 2}" y="${T + ph + 15}" text-anchor="middle">${r[0]}</text>`).join('')}
        <text x="${L + pw / 2}" y="${H - 8}" text-anchor="middle" class="t">termYears</text>
        <text transform="translate(16 ${T + ph / 2}) rotate(-90)" text-anchor="middle" class="t">maxLoan</text>
    </svg>`;
    const chart = `<div class="fe-node" style="left:960px;top:380px;width:380px">
        ${head(C.expr, 'chart', 'Largest affordable loan', `${path}.capacity`)}
        <div class="fe-row">${pin('in', 'rec')}<div class="fe-track fe-name" style="width:90px">data</div><div class="fe-track fe-sum" style="flex:1;justify-content:flex-end;display:flex;align-items:center">5 rows</div></div>
        <div class="fe-chartbox">${svg}<span class="fe-resize"></span></div>
    </div>`;

    const wire = (x1, y1, x2, y2, cls) => {
        const dx = Math.max(40, (x2 - x1) / 2);
        return `<path class="${cls}" d="M${x1} ${y1} C${x1 + dx} ${y1} ${x2 - dx} ${y2} ${x2} ${y2}"/>`;
    };
    const wires = `<svg class="fe-wires" width="1300" height="700">
        ${[220, 260, 300].map((yy) => wire(406, yy, 474, yy, 'num')).join('')}
        ${wire(886, 220, 954, 80, 'rec')}
        ${wire(886, 220, 954, 440, 'rec')}
    </svg>`;

    const rail = [
        ['input', 'inputN', 'Add object input'],
        ['input', 'listN', 'Add list input'],
        ['input', 'varx', 'Add value input'],
        ['fn', 'fxN', 'Add invocation'],
        ['expr', 'sqrt', 'Add expression'],
        ['out', 'outputN', 'Add output'],
        ['expr', 'chart', 'Add chart'],
    ];
    const mm = (x, yy, w, h, c) => `<rect x="${x}" y="${yy}" width="${w}" height="${h}" rx="2" style="fill:${C[c]}"/>`;
    return `<div class="fe">
        <div class="fe-rail">
            <button class="fe-railbtn" title="Show node palette">${ic('panelOpen')}</button>
            ${rail.map(([c, i, t]) => `<span class="fe-railitem" title="${t}"><span class="fe-rt" style="background:${C[c]}">${ic(i)}</span></span>`).join('')}
        </div>
        <div class="fe-canvas">
            <div class="fe-world">${wires}${household}${capacity}${table}${chart}</div>
            <div class="fe-controls">
                <button title="Zoom in">${ic('plus')}</button><button title="Zoom out">${ic('minus')}</button><button title="Fit view">${ic('fit')}</button><button title="Arrange nodes">${ic('arrange')}</button>
            </div>
            <svg class="fe-minimap" viewBox="-200 -230 1700 1180" width="200" height="150">
                <rect class="vp" x="-200" y="-40" width="1700" height="740"/>
                ${mm(0, 40, 400, 280, 'input')}${mm(480, 40, 400, 280, 'fn')}${mm(960, 20, 340, 320, 'out')}${mm(960, 380, 380, 320, 'expr')}
            </svg>
        </div>
    </div>`;
}
function boxedMock(p) {
    const m = D.models[p.model];
    return `<div class="boxed">
        <div class="note-chip" style="position:static;margin:12px">${ic('info')}Boxed Editor — unchanged, shown for context</div>
        <div class="bx-h">${kind('model', 'sm')}<b>${esc(m.title)}</b></div>
        ${m.tree.Types.map(([, n]) => `<div class="bx-g">${kind('type', 'sm')}<b>${n}</b></div><div class="bx-r"><span>id</span><span class="mono" style="color:var(--k-function)">&lt;string&gt;</span></div><div class="bx-r"><span>name</span><span class="mono" style="color:var(--k-function)">&lt;string&gt;</span></div>`).join('')}
    </div>`;
}
function testsMock(p) {
    const m = D.models[p.model];
    return `<div style="padding:28px;max-width:900px">
        <div class="note-chip" style="position:static;margin-bottom:16px">${ic('info')}Tests Manager — unchanged</div>
        <table class="table"><thead><tr><th>Suite</th><th style="text-align:right">Cases</th><th>Status</th></tr></thead><tbody>
        ${m.tree.Tests.map(([, n], i) => `<tr><td>${kind('test', 'sm')} <span class="mono">${n}</span></td><td class="num">${3 + i}</td><td><span class="badge neutral">not run</span></td></tr>`).join('')}
        </tbody></table></div>`;
}
function codeMock(p) {
    const m = D.models[p.model];
    return `<pre class="codev"><span class="cm">// ${esc(m.title)} — Code view unchanged</span>
${m.tree.Types.map(([, n]) => `<span class="kw">type</span> ${n}: { … }`).join('\n')}

${m.services.map((s) => `<span class="kw">service</span> <b>${s.name}</b>(${esc(s.args)}) { … }`).join('\n')}</pre>`;
}
function pageProject(seg, q) {
    const p = proj(seg[1]);
    if (!p) return page404('The project did not open');
    const root = seg[2] || null;
    const view = q.view || 'flow';
    const isHome = !root;
    S.openPid = p.pid;
    let body;
    if (view === 'flow') body = isHome ? projectHome(p) : flowMock(p, root);
    else if (view === 'boxed') body = boxedMock(p);
    else if (view === 'code') body = codeMock(p);
    else body = testsMock(p);
    return (
        appBar('project') +
        `<div class="shell">${shellRow(p, root, view, isHome)}<div class="shell-body">${explorer(p, root)}<div class="stage ${isHome ? 'dots' : ''}">${body}</div></div></div>`
    );
}

function page404(msg) {
    return (
        appBar('') +
        `<main class="page"><div class="empty" style="padding-top:120px"><img class="sway" src="assets/sodas.svg" alt="" style="width:96px;opacity:.5"/><h4 style="font-size:20px">${msg || 'Nothing hangs here'}</h4><p>The page does not exist.</p><a class="btn" href="#/">Go home</a></div></main>`
    );
}

/* ───────────── design notes page ───────────── */
function pageDesign() {
    const sw = (n, v) => `<div class="sw"><span style="background:var(${v})"></span><b>${n}</b><code>${v}</code></div>`;
    return (
        appBar('') +
        `<main class="page">
        <div class="ph"><div><div class="eyebrow">Proposal v2</div><h1>Design notes</h1><p>A neutral, modern shell around the editors. The editors set the vocabulary (kind squares, hairlines, mono values); the pages around them get out of the way.</p></div></div>
        <div class="notesgrid">
            <div class="card"><div class="cb"><div class="eyebrow">Type</div>
                <div style="font:600 34px/1.1 var(--sans);letter-spacing:-.03em">Geist 600 — titles</div>
                <div style="font:300 26px/1.2 var(--sans);letter-spacing:-.02em">Geist 300 — hero</div>
                <div style="font-size:14px">Geist 400/500 — interface text, 13–15px</div>
                <div class="mono" style="font-size:13px">Geist Mono — values, ids, versions, labels</div>
                <div class="eyebrow">Mono eyebrow · 11px · +0.06em</div>
                <p class="muted" style="font-size:13px;margin:0">Free, on Google Fonts. The closest open pair to Söhne / Söhne Mono (Taktile) and Aeonik + mono labels (Temporal). In the package it would be a Mantine theme font, with system fallback.</p>
            </div></div>
            <div class="card"><div class="cb"><div class="eyebrow">Colour</div>
                <div class="sws">${sw('Background', '--bg')}${sw('Surface', '--surface')}${sw('Subtle', '--subtle')}${sw('Border', '--border')}${sw('Text', '--text')}${sw('Text 3', '--text-3')}${sw('Accent', '--accent')}${sw('Cream', '--cream')}</div>
                <p class="muted" style="font-size:13px;margin:0">Near-black primary buttons, warm-neutral greys, one blue for links and focus. Kind colours are reserved for model elements only — projects get monograms, not kind colours.</p>
            </div></div>
            <div class="card"><div class="cb"><div class="eyebrow">Shape</div>
                <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn primary">Primary</button><button class="btn">Secondary</button><button class="btn ghost">Ghost</button><span class="badge ok">${ic('check')}In workspace · 3</span><span class="badge accent">${ic('up')}Update 1.2.0</span><span class="badge warn"><span class="dot"></span>Not persistent</span><span class="tag">decision-table</span></div>
                <p class="muted" style="font-size:13px;margin:0">Radius 6 (controls) / 8 (cards). 1px borders, no shadows at rest; shadow only on floating menus. Hover = darker border.</p>
            </div></div>
            <div class="card"><div class="cb"><div class="eyebrow">Sodas</div>
                <div style="display:flex;gap:20px;align-items:center"><img class="sway" src="assets/sodas.svg" style="width:64px"/><span class="logo" style="pointer-events:none"><span class="mk"><img src="assets/sodas-solid-white.svg"/></span>EdgeRules</span></div>
                <p class="muted" style="font-size:13px;margin:0">Only the mark. It hangs like a real sodas: hover the logo, the footer mark or an empty state and it sways for a moment. Empty and 404 states show it faintly. Nothing else is folk.</p>
            </div></div>
        </div>
        <div class="sec"><h2>What changes, page by page</h2></div>
        <table class="table"><thead><tr><th>Page</th><th>Today</th><th>Proposal</th></tr></thead><tbody>
            <tr><td><b>Top bar</b></td><td>Host bar + Shell bar, two logos, project as a ✕ tab</td><td>One app bar on every page: Home · Examples · Workspace, the open project as a closable tab, search, theme. It says where you can go. Inside a project the Shell header row says where you are: Project ▾ › workbook, settings of what is open, view cells. One change to the Shell: the project menu moves from the right into the first crumb, because project name = model name. The host bar and the Shell keep their split — no new Shell slot needed.</td></tr>
            <tr><td><b>Search</b></td><td>Search field on Home and Examples</td><td>Global palette (<kbd>/</kbd>, <kbd>⌘K</kbd>): projects, examples, actions — the Home suggestions dropdown of the spec, available everywhere.</td></tr>
            <tr><td><b>Home</b></td><td>700px column, cramped cards</td><td>Short hero with search and two actions, Workspace, Examples, Industries, Release log.</td></tr>
            <tr><td><b>Examples</b></td><td>Tabs + facets row, 3 action cells per card</td><td>Facet sidebar (industry, features, workspace), cards or list, one action on hover, the card opens details. No levels.</td></tr>
            <tr><td><b>Details</b></td><td>Action cells row, metadata table</td><td>Header with version + actions, copies notice, README + facts sidebar, related.</td></tr>
            <tr><td><b>Workspace</b></td><td>Cards, yellow banner, “Open” row</td><td>The Examples page layout: filter sidebar (All / My Projects / Example Projects, storage), cards or list, the card opens the project, ⋮ menu. Storage meter with a calm “Not persistent” badge that explains itself.</td></tr>
            <tr><td><b>Project home</b></td><td>README card + cards on the canvas</td><td>Title, origin, README excerpt, Entry points (service signatures), Workbooks, side panel with Model counts, Tests, Origin. “Overview” label on the Flow tab at the root.</td></tr>
        </tbody></table>
    </main>`
    );
}

/* ───────────── per-page proposal notes ───────────── */
const NOTES = {
    home: [
        'Short hero: one sentence, the search, two actions. No marketing.',
        'Workspace = 4 newest projects (spec: up to 6). Projects use a monogram, not a kind colour.',
        'Examples uses the same card as the Examples page. Industries and the Release log (what is new in the Modeler and the Rule Engine) share one row.',
        'Footer mark sways on hover — the only Sodas besides the logo.',
    ],
    examples: [
        'Facets move to a sidebar; industry tabs disappear (industry is the first facet).',
        'Card = link to details. One action, shown on hover: “Copy and open”, or “Open copy” when copied.',
        'Grid/list toggle: the list view scales to thousands of rows (virtual table).',
        'Insurance, Healthcare and Logistics examples are mock data.',
    ],
    details: [
        'Version selector and actions live in the header, right-aligned.',
        'A notice tells how many copies you have and links the newest — replaces the badge + two buttons.',
        'Level removed. Features link back to a filtered gallery.',
    ],
    workspace: [
        'Same page as Examples: header, facet sidebar, search + sort + cards/list, result line with removable chips.',
        'Filter: All projects / My Projects / Example Projects.',
        'Card = link to the project, same card as an example: industry eyebrow, update badge, name, description, the features of its example; footer has the source coordinate, workbooks, saved time and ⋮ (Open, Rename, Duplicate, View original, Delete).',
        'Storage sits at the bottom of the sidebar; it opens “Projects live only in this browser.” with one action.',
    ],
    project: [
        'Two rows, two jobs. Row 1 is the app bar — the same on every page (Home · Examples · Workspace · open project tab · search). Row 2 is the Shell header row of the library: kind square · Project ▾ › workbook · settings · Flow / Boxed / Code / Tests · split.',
        'One project is one model, with one name. The first crumb is that name and it is the project menu ▾ (recent projects, origin, README, Model settings). Today the Shell shows the model title as a crumb and the project name again as a menu on the right — two names for one thing.',
        'The gear is the settings of what is open, as in the app: Workbook settings (Name, Description) on a workbook, Model settings (Name, Version, Description) at the root. Renaming the model renames the project.',
        'The open project is a tab of the app bar, as in the app today. Go to Examples and back: the tab stays, one click returns to where you were. ✕ closes it.',
        'v2 merged both rows into one bar, so the bar changed shape between Workspace and a project. Now nothing in row 1 moves when you open a project; only row 2 appears.',
        'At the project root the Flow cell reads Overview. The Flow body is drawn after the real Flow Editor (localhost:5174 capacityBook): palette rail, ruled 40px nodes, typed pins and wires, controls, minimap.',
    ],
    design: ['Fonts, colours and the page-by-page change list.'],
};

/* ───────────── render ───────────── */
function render() {
    const {seg, q} = parse();
    let html,
        key = 'home';
    if (!seg.length) html = pageHome();
    else if (seg[0] === 'examples' && seg.length === 3) ((html = pageDetails(seg[1], seg[2])), (key = 'details'));
    else if (seg[0] === 'examples') ((html = pageExamples(seg[1], q)), (key = 'examples'));
    else if (seg[0] === 'workspace') ((html = pageWorkspace(q)), (key = 'workspace'));
    else if (seg[0] === 'project') ((html = pageProject(seg, q)), (key = 'project'));
    else if (seg[0] === 'design') ((html = pageDesign()), (key = 'design'));
    else html = page404();
    document.body.dataset.page = key;
    $app.innerHTML = html + overlays(key);
    const exq = document.getElementById('exq');
    if (exq && S.focus === 'exq') (exq.focus(), exq.setSelectionRange(exq.value.length, exq.value.length));
    const wsq = document.getElementById('wsq');
    if (wsq && S.focus === 'wsq') (wsq.focus(), wsq.setSelectionRange(wsq.value.length, wsq.value.length));
    const pq = document.getElementById('pq');
    if (pq) (pq.focus(), pq.setSelectionRange(pq.value.length, pq.value.length));
}
function overlays(key) {
    let h = '';
    if (S.pop) h += S.pop.html;
    if (S.modal === 'palette') h += palette();
    if (S.modal === 'new') h += newProjectModal();
    if (S.modal === 'settings') h += settingsDialog();
    if (S.toast) h += `<div class="toast">${ic('check')}${S.toast}</div>`;
    h += `<button class="notes-fab" data-act="notes">${ic('info')}Proposal notes</button>`;
    if (S.notes)
        h += `<div class="notes"><h4>Why this page looks like this</h4><ul>${(NOTES[key] || []).map((n) => `<li>${n}</li>`).join('')}</ul><p style="margin:8px 0 0"><a href="#/design" style="text-decoration:underline">Design notes →</a> · <a href="archive-v1/index.html" style="text-decoration:underline">v1 (rejected)</a></p></div>`;
    return h;
}

/* palette */
S.pq = '';
S.psel = 0;
function paletteItems() {
    const q = S.pq.toLowerCase();
    const m = (s) => !q || s.toLowerCase().includes(q);
    const projs = D.projects
        .filter((p) => m(p.name + ' ' + (p.origin || '')))
        .slice(0, 4)
        .map((p) => ({g: 'Projects', icon: projMark(p, 'sm'), t: p.name, s: p.saved, h: `#/project/${p.pid}`}));
    const exs = D.examples
        .filter((e) => m(e.name + ' ' + e.feats.join(' ') + ' ' + e.desc))
        .slice(0, 5)
        .map((e) => ({
            g: 'Examples',
            icon: `<span class="kind sm outline">${ic(ind(e.ind).icon)}</span>`,
            t: e.name,
            s: ind(e.ind).title,
            h: exUrl(e),
        }));
    const acts = [
        {
            g: 'Actions',
            icon: `<span class="kind sm outline">${ic('plus')}</span>`,
            t: 'New project',
            act: 'new-project',
        },
        {
            g: 'Actions',
            icon: `<span class="kind sm outline">${ic('library')}</span>`,
            t: q ? `Search examples for “${S.pq}”` : 'Browse examples',
            h: `#/examples${q ? '?q=' + encodeURIComponent(S.pq) : ''}`,
        },
        {g: 'Actions', icon: `<span class="kind sm outline">${ic('moon')}</span>`, t: 'Toggle dark mode', act: 'theme'},
    ].filter((a) => !q || a.t.toLowerCase().includes(q) || a.t.startsWith('Search'));
    return [...projs, ...exs, ...acts];
}
function palette() {
    const items = paletteItems();
    let g = '';
    const rows = items
        .map((it, i) => {
            const head = it.g !== g ? `<div class="gl eyebrow">${(g = it.g)}</div>` : '';
            return `${head}<div class="row ${i === S.psel ? 'sel' : ''}" data-act="pick" data-i="${i}">${it.icon}<span>${esc(it.t)}</span><span class="s">${esc(it.s || '')}</span></div>`;
        })
        .join('');
    return `<div class="scrim" data-act="close"><div class="modal palette" data-stop>
        <div class="pi">${ic('search')}<input id="pq" placeholder="Search projects, examples, actions…" value="${esc(S.pq)}"/><kbd>esc</kbd></div>
        <div class="res">${rows || '<div class="empty" style="padding:28px">No results</div>'}</div>
        <div class="foot"><span><kbd>↑</kbd> <kbd>↓</kbd> move</span><span><kbd>↵</kbd> open</span><span><kbd>/</kbd> or <kbd>⌘K</kbd> anywhere</span></div>
    </div></div>`;
}
S.newKind = 'blank';
function newProjectModal() {
    return `<div class="scrim" data-act="close"><div class="modal" data-stop>
        <div class="mh"><h3>New project</h3></div>
        <div class="mb">
            <div class="choice">
                <label class="${S.newKind === 'blank' ? 'on' : ''}" data-act="newkind" data-k="blank"><b>${ic('doc')}Blank</b><span>An empty model with one workbook</span></label>
                <label class="${S.newKind === 'example' ? 'on' : ''}" data-act="newkind" data-k="example"><b>${ic('library')}From an example</b><span>Copy a worked model from the library</span></label>
            </div>
            ${
                S.newKind === 'blank'
                    ? `<div class="field"><span>Name</span><label class="input"><input value="Untitled project"/></label></div>`
                    : `<div class="field"><span>Example</span>${D.examples
                          .slice(0, 3)
                          .map(
                              (e) =>
                                  `<button class="mi exopt" data-act="copy-open" data-id="${e.id}">${esc(e.name)}<span class="muted mono" style="margin-left:auto;font-size:12px">v${e.v}</span></button>`,
                          )
                          .join('')}</div>`
            }
        </div>
        <div class="mf"><button class="btn ghost" data-act="close">Cancel</button>${S.newKind === 'blank' ? `<button class="btn primary" data-act="create-blank">Create and open</button>` : ''}</div>
    </div></div>`;
}

/* popovers */
function openPop(anchor, html, align = 'left') {
    const r = anchor.getBoundingClientRect();
    const style =
        align === 'right'
            ? `top:${r.bottom + 6 + scrollY}px;right:${innerWidth - r.right}px`
            : `top:${r.bottom + 6 + scrollY}px;left:${r.left}px`;
    S.pop = {html: `<div class="pop" data-stop style="${style}">${html}</div>`};
    render();
}
/* The settings of the root path, as ShellSettings draws it: a glass sheet with a one-step header, ruled field rows
 * (label | value, hint row below) and Cancel / Save step cells. The model has Name, Version and Description; a
 * workbook has Name (its @Workbook annotation) and Description. The model name is the project name. */
function settingsDialog() {
    const p = proj(parse().seg[1]);
    if (!p) return '';
    const m = D.models[p.model];
    const isModel = S.settingsRoot === '*';
    const wb = !isModel && m.workbooks.find((w) => w.id === S.settingsRoot);
    const field = (label, value, hint, area) =>
        `<div class="st-field"><label>${label}</label><div class="st-cell">${area ? `<textarea rows="4">${esc(value)}</textarea>` : `<input value="${esc(value)}"/>`}</div>${hint ? `<div class="st-hint">${hint}</div>` : ''}</div>`;
    return `<div class="scrim st-scrim" data-act="close"><div class="st-dialog" data-stop>
        <div class="st-head"><span class="st-tile">${ic('gear')}</span><b>${isModel ? 'Model settings' : 'Workbook settings'}</b><button class="st-x" data-act="close" title="Close">${ic('x')}</button></div>
        ${
            isModel
                ? field('Name', p.name, 'The name of the model — and of the project: one project is one model') +
                  field('Version', (p.origin || '@1.0.0').split('@')[1], '') +
                  field('Description', p.desc, '', true)
                : field(
                      'Name',
                      wb ? wb.name : S.settingsRoot,
                      'The name of the @Workbook annotation; empty shows the field name',
                  ) + field('Description', wb ? wb.desc : '', '', true)
        }
        <div class="st-actions"><button data-act="close">Cancel</button><button class="save" data-act="save-settings">Save</button></div>
    </div></div>`;
}
function projMenu() {
    const {seg} = parse();
    const p = proj(seg[1]);
    const others = D.projects.filter((x) => x.pid !== p.pid).slice(0, 5);
    return `<div style="padding:8px 9px 10px"><div style="font-weight:600">${esc(p.name)}</div><div class="muted" style="font-size:12px">Saved ${p.saved}</div>${p.origin ? `<a class="tag" style="margin-top:8px" href="#/examples/financial/${p.origin}">from ${p.origin} ${ic('open')}</a>` : ''}</div>
        <div class="hr"></div>
        <a class="mi" href="#/project/${p.pid}?view=flow">${ic('sitemap')}Overview</a>
        <button class="mi" data-act="settings" data-root="*">${ic('gear')}Model settings…</button>
        <div class="hr"></div><div class="gl eyebrow">Recent projects</div>
        ${others.map((o) => `<a class="mi" href="#/project/${o.pid}">${projMark(o, 'sm')}${esc(o.name)}<span class="r">${o.saved}</span></a>`).join('')}
        <div class="hr"></div>
        <a class="mi" href="#/examples">${ic('library')}Browse examples</a>
        ${p.origin ? `<a class="mi" href="#/examples/financial/${p.origin}">${ic('open')}View original example</a>` : ''}
        <a class="mi">${ic('doc')}Open README</a>
        <a class="mi" data-act="dup">${ic('copy')}Duplicate</a>`;
}

/* ───────────── events ───────────── */
function closeAll() {
    S.pop = null;
    S.modal = null;
}
function toast(msg) {
    S.toast = msg;
    render();
    clearTimeout(S.tt);
    S.tt = setTimeout(() => ((S.toast = null), render()), 2200);
}
function copyExample(id, open) {
    const e = ex(id);
    const n = copiesOf(id).length;
    const pid = `${id}-${Date.now().toString(36).slice(-4)}`;
    const model = {'loan-origination': 'lo', 'client-outreach': 'co', 'loan-repayment': 'lr'}[id] || 'blank';
    D.projects.unshift({
        pid,
        name: n ? `${e.name} (${n + 1})` : e.name,
        model,
        origin: `${id}@${e.v}`,
        saved: 'just now',
        desc: e.desc,
    });
    closeAll();
    if (open) openProject(pid);
    else toast(`Copied to workspace as “${D.projects[0].name}”`);
}
function openProject(pid) {
    // easter egg: while the project opens the sodas sways
    const p = proj(pid);
    $app.insertAdjacentHTML(
        'beforeend',
        `<div class="opening"><img src="assets/sodas.svg" alt=""/><span>Opening ${esc(p.name)}…</span></div>`,
    );
    setTimeout(() => go(`#/project/${pid}`), 650);
}

document.addEventListener('click', (ev) => {
    const tr = ev.target.closest('tr[data-href]');
    const a = ev.target.closest('[data-act]');
    if (a) {
        const act = a.dataset.act;
        if (act === 'close' && ev.target.closest('[data-stop]') && !ev.target.closest('.mf, .st-actions, .st-x'))
            return;
        ev.preventDefault();
        ev.stopPropagation();
        switch (act) {
            case 'theme':
                document.documentElement.dataset.theme =
                    document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
                closeAll();
                return render();
            case 'palette':
                closeAll();
                S.modal = 'palette';
                S.pq = '';
                S.psel = 0;
                return render();
            case 'close':
                closeAll();
                return render();
            case 'notes':
                S.notes = !S.notes;
                return render();
            case 'new-project':
                closeAll();
                S.modal = 'new';
                return render();
            case 'newkind':
                S.newKind = a.dataset.k;
                return render();
            case 'create-blank': {
                const pid = 'untitled-' + Date.now().toString(36).slice(-4);
                D.projects.unshift({
                    pid,
                    name: 'Untitled project',
                    model: 'blank',
                    origin: null,
                    saved: 'just now',
                    desc: '',
                });
                closeAll();
                return openProject(pid);
            }
            case 'copy-open':
                return copyExample(a.dataset.id, true);
            case 'copy-only':
                return copyExample(a.dataset.id, false);
            case 'open-copy':
                return openProject(copiesOf(a.dataset.id)[0].pid);
            case 'share':
                return toast('Link copied');
            case 'dup':
                closeAll();
                return toast('Duplicated — opening the copy');
            case 'exview':
                S.exView = a.dataset.v;
                return render();
            case 'wsview':
                S.wsView = a.dataset.v;
                return render();
            case 'wssrc':
                S.wsSource = a.dataset.k;
                return render();
            case 'feat':
                S.exFeats.has(a.dataset.f) ? S.exFeats.delete(a.dataset.f) : S.exFeats.add(a.dataset.f);
                return render();
            case 'status':
                S.exStatus = a.dataset.k;
                return render();
            case 'explorer':
                S.explorerOpen = !S.explorerOpen;
                return render();
            case 'sort':
                return openPop(
                    a,
                    ['Relevance', 'Name', 'Last release']
                        .map(
                            (s) =>
                                `<button class="mi" data-act="setsort" data-s="${s}">${s}${S.exSort === s ? `<span class="r">${ic('check')}</span>` : ''}</button>`,
                        )
                        .join(''),
                );
            case 'setsort':
                S.exSort = a.dataset.s;
                S.pop = null;
                return render();
            case 'version': {
                const e = ex(parse().seg[2].split('@')[0]);
                return openPop(
                    a,
                    e.versions
                        .map(
                            (v, i) =>
                                `<a class="mi mono" href="#/examples/${e.ind}/${e.id}@${v}">${v}${i === 0 ? '<span class="r">latest</span>' : ''}</a>`,
                        )
                        .join(''),
                );
            }
            case 'projmenu':
                return openPop(a, projMenu());
            case 'settings':
                closeAll();
                S.modal = 'settings';
                S.settingsRoot = a.dataset.root;
                return render();
            case 'save-settings':
                closeAll();
                return toast('Settings saved');
            case 'closeproj': {
                const wasOpen = parse().seg[0] === 'project';
                S.openPid = null;
                closeAll();
                return wasOpen ? go('#/workspace') : render();
            }
            case 'rowmenu': {
                const p = proj(a.dataset.pid);
                return openPop(
                    a,
                    `<a class="mi" href="#/project/${p.pid}">${ic('open')}Open</a><button class="mi">${ic('edit')}Rename…</button><button class="mi" data-act="dup">${ic('copy')}Duplicate</button>${p.origin ? `<a class="mi" href="#/examples/financial/${p.origin}">${ic('library')}View original example</a>` : ''}<div class="hr"></div><button class="mi danger">${ic('trash')}Delete…</button>`,
                    'right',
                );
            }
            case 'storage':
                return openPop(
                    a,
                    `<div style="padding:10px;max-width:300px;font-size:13px"><b>Projects live only in this browser.</b><p class="muted" style="margin:6px 0 10px">The browser may delete them when it runs low on space. Ask it to keep them — the browser may show a prompt.</p><div style="display:flex;justify-content:space-between;font-size:12px" class="mono muted"><span>150 KB used</span><span>10 GB available</span></div><div class="meter" style="width:100%;margin:6px 0 12px"><i style="width:4%"></i></div><button class="btn sm primary" data-act="persist">Keep my projects</button></div>`,
                );
            case 'wsorigin':
                S.wsOrigins.has(a.dataset.o) ? S.wsOrigins.delete(a.dataset.o) : S.wsOrigins.add(a.dataset.o);
                return render();
            case 'wsstatus':
                S.wsStatus = a.dataset.k;
                return render();
            case 'wssort':
                return openPop(
                    a,
                    ['Last saved', 'Name']
                        .map(
                            (s) =>
                                `<button class="mi" data-act="setwssort" data-s="${s}">${s}${S.wsSort === s ? `<span class="r">${ic('check')}</span>` : ''}</button>`,
                        )
                        .join(''),
                );
            case 'setwssort':
                S.wsSort = a.dataset.s;
                S.pop = null;
                return render();
            case 'persist':
                closeAll();
                return toast('Storage is now persistent');
            case 'pick': {
                const it = paletteItems()[+a.dataset.i];
                closeAll();
                if (it.act === 'new-project') {
                    S.modal = 'new';
                    return render();
                }
                if (it.act === 'theme') {
                    document.documentElement.dataset.theme =
                        document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
                    return render();
                }
                if (it.h.startsWith('#/project/')) return openProject(it.h.split('/')[2]);
                return go(it.h);
            }
        }
        return;
    }
    if (S.pop && !ev.target.closest('.pop')) {
        S.pop = null;
        render();
    }
    if (tr && !ev.target.closest('button')) {
        const h = tr.dataset.href;
        if (h.startsWith('#/project/')) openProject(h.split('/')[2]);
        else go(h);
    }
    const link = ev.target.closest('a[href^="#/project/"]');
    if (
        link &&
        !link.closest('.explorer') &&
        !link.closest('.seg') &&
        !link.closest('.bar') &&
        !link.closest('.phome') &&
        !link.closest('.pop')
    ) {
        const pid = link.getAttribute('href').split('/')[2].split('?')[0];
        if (parse().seg[1] !== pid) {
            ev.preventDefault();
            openProject(pid);
        }
    }
});
document.addEventListener('input', (ev) => {
    if (ev.target.id === 'exq') {
        S.focus = 'exq';
        const {seg} = parse();
        history.replaceState(
            null,
            '',
            `#/examples${seg[1] ? '/' + seg[1] : ''}${ev.target.value ? '?q=' + encodeURIComponent(ev.target.value) : ''}`,
        );
        render();
    } else if (ev.target.id === 'wsq') {
        S.focus = 'wsq';
        S.wsQuery = ev.target.value;
        render();
    } else if (ev.target.id === 'pq') {
        S.pq = ev.target.value;
        S.psel = 0;
        render();
    }
});
document.addEventListener('keydown', (ev) => {
    const typing = /INPUT|TEXTAREA/.test(document.activeElement?.tagName);
    if ((ev.key === '/' && !typing) || ((ev.metaKey || ev.ctrlKey) && ev.key === 'k')) {
        ev.preventDefault();
        closeAll();
        S.modal = 'palette';
        S.pq = '';
        S.psel = 0;
        return render();
    }
    if (ev.key === 'Escape' && (S.modal || S.pop)) {
        closeAll();
        return render();
    }
    if (S.modal === 'palette') {
        const n = paletteItems().length;
        if (ev.key === 'ArrowDown') ((S.psel = (S.psel + 1) % n), render(), ev.preventDefault());
        if (ev.key === 'ArrowUp') ((S.psel = (S.psel - 1 + n) % n), render(), ev.preventDefault());
        if (ev.key === 'Enter') document.querySelector(`.palette .row[data-i="${S.psel}"]`)?.click();
    }
});
window.addEventListener('hashchange', () => {
    closeAll();
    S.focus = null;
    render();
    scrollTo(0, 0);
});
render();
