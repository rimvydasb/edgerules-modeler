// Deterministic architecture rules. Run with `npm run depcruise`; the Stop/SubagentStop hook runs it after every agent
// task. Each rule's `comment` is printed with a violation, so it says how to fix it, not only what is wrong.
// Rules mirror docs/architecture.md "Dependency rules" — change both together.
// Known violations are recorded in .dependency-cruiser-known-violations.json (`npm run depcruise:baseline`) and do not
// fail the run; new ones do. Fix recorded ones and re-run the baseline so the file only shrinks.

const COMPONENT = '^src/components/';
// Test code and fixtures: may use dev-only packages and other components' internals.
const TEST_CODE = '(^|/)(__tests__|testing)/|\\.test\\.tsx?$';

/**
 * Forbids `component` from importing any other component except `allowed`. `sharedPaths` are folders of other
 * components it may still import, such as the shared code-editor language tooling.
 */
function componentAllowlist(component, allowed, section, sharedPaths = []) {
  const others = allowed.length ? `only ${allowed.join(', ')}` : 'no other component';
  return {
    name: `component-deps-${component}`,
    comment:
      `${component} may use ${others} (docs/architecture.md, "${section}"). Pass the dependency in through ` +
      'props or a service interface instead, or move the shared code to src/lib (logic) or src/ui (primitives). ' +
      'If the new dependency is intended, update the allowlist here and the architecture.md table together.',
    severity: 'error',
    from: {path: `${COMPONENT}${component}/`, pathNot: TEST_CODE},
    to: {
      path: COMPONENT,
      pathNot: [
        ...[component, ...allowed].map((name) => `${COMPONENT}${name}/`),
        ...sharedPaths.map((p) => `${COMPONENT}${p}`),
      ],
    },
  };
}

const WEBMCP = `${COMPONENT}webmcp/`;

/**
 * One layer of the webmcp component (docs/stories/webmcp-story.md, "Component architecture"): code in `webmcp/<layer>/`
 * must not import `forbidden` paths, except the webmcp folders in `allowedLayers`.
 */
function webmcpLayer(layer, forbidden, allowedLayers, why) {
  return {
    name: `webmcp-layer-${layer}`,
    comment: `webmcp ${why}`,
    severity: 'error',
    from: {path: `${WEBMCP}${layer}/`, pathNot: TEST_CODE},
    to: {path: forbidden, pathNot: allowedLayers.map((folder) => `${WEBMCP}${folder}`)},
  };
}

/** Restricts `pkg` (a node_modules path prefix) to the source folders in `owners`; tests may use it anywhere. */
function packageOwner(name, pkg, owners, why) {
  return {
    name,
    comment: `${pkg} may only be imported under ${owners.join(', ')}: ${why}`,
    severity: 'error',
    from: {path: '^src/', pathNot: [TEST_CODE, ...owners.map((owner) => `^${owner}`)]},
    to: {path: `^node_modules/${pkg}`},
  };
}

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    // --- Documentation -------------------------------------------------------------------------------------------
    {
      name: 'markdown-file-name',
      comment:
        'Markdown file names must be lowercase, words separated by "-" (e.g. "flow-editor-story.md"). ' +
        'Tool-mandated names (README.md, CLAUDE.md, AGENTS.md, SKILL.md, CHANGELOG.md) are exempt. ' +
        'Rename with `git mv` and update every link to the file.',
      severity: 'error',
      // Markdown files have no dependencies, so they are always orphans.
      from: {
        orphan: true,
        path: '\\.md$',
        pathNot: ['(^|/)[a-z0-9][a-z0-9-]*\\.md$', '(^|/)(README|CLAUDE|AGENTS|SKILL|CHANGELOG)\\.md$'],
      },
      to: {},
    },

    // --- Layers --------------------------------------------------------------------------------------------------
    {
      name: 'shared-code-not-to-components',
      comment:
        'src/lib and src/ui are the shared bottom layer and must not import src/components. Move the needed ' +
        'type or helper down into src/lib or src/ui, and let the component import it from there.',
      severity: 'error',
      from: {path: '^src/(lib|ui)/'},
      to: {path: COMPONENT},
    },
    {
      name: 'component-public-api',
      comment:
        'Import another component only through its index.ts (the npm subpath API) or its internal.ts (shared ' +
        'with other components of this package, not published), never its other files. Export what you need from ' +
        "that component's internal.ts; use index.ts only for what consumers of the npm package need. Generic " +
        'helpers with no component knowledge belong in src/lib or src/ui. Exception: code-editor/language/ is ' +
        'the documented shared language tooling.',
      severity: 'error',
      from: {path: `${COMPONENT}([^/]+)/`, pathNot: TEST_CODE},
      to: {
        path: `${COMPONENT}[^/]+/`,
        pathNot: [`${COMPONENT}$1/`, `${COMPONENT}[^/]+/(index|internal)\\.tsx?$`, `${COMPONENT}code-editor/language/`],
      },
    },
    componentAllowlist('code-editor', [], 'Main React components'),
    componentAllowlist('code-editor-cell', ['code-editor'], 'Main React components'),
    componentAllowlist('project-explorer', [], 'Shell owns cross-editor navigation'),
    componentAllowlist('markdown-view', [], 'Main React components', ['code-editor/language/']),
    componentAllowlist('documentation-service', [], 'Main React components'),
    componentAllowlist('test-cases-service', [], 'Main React components'),
    componentAllowlist('decision-table', ['code-editor', 'code-editor-cell'], 'Main React components'),
    componentAllowlist(
      'tests-manager',
      ['code-editor', 'code-editor-cell', 'test-cases-service'],
      'Main React components',
    ),
    componentAllowlist(
      'boxed-editor',
      ['code-editor', 'code-editor-cell', 'documentation-service', 'test-cases-service', 'tests-manager'],
      'Main React components',
    ),
    componentAllowlist(
      'flow-editor',
      ['boxed-editor', 'code-editor-cell', 'documentation-service'],
      'Main React components',
    ),
    componentAllowlist(
      'project-session',
      ['documentation-service', 'test-cases-service'],
      'Project state architecture',
    ),
    componentAllowlist(
      'example-library',
      ['project-session', 'markdown-view'],
      'Package placement of the page components',
    ),
    componentAllowlist(
      'local-workspace',
      ['project-session', 'example-library'],
      'Package placement of the page components',
    ),
    componentAllowlist(
      'modeler-home',
      ['project-session', 'example-library', 'local-workspace'],
      'Package placement of the page components',
    ),
    componentAllowlist(
      'shell',
      [
        'code-editor',
        'markdown-view',
        'boxed-editor',
        'flow-editor',
        'project-explorer',
        'project-session',
        'documentation-service',
        'test-cases-service',
        'tests-manager',
      ],
      'Main React components',
    ),
    componentAllowlist(
      'webmcp',
      ['project-session', 'project-explorer', 'tests-manager', 'test-cases-service'],
      'WebMCP tools',
    ),
    webmcpLayer(
      'core',
      ['^src/components/'],
      ['core/'],
      'core/ is the transport-neutral bottom layer: it may import only @edgerules/portable types and #lib. Move the ' +
        'code that needs another layer or component up into project/, or pass the value in as a parameter.',
    ),
    webmcpLayer(
      'project',
      ['^src/components/webmcp/(protocol|tools|platform)/'],
      [],
      'project/ holds the use cases and knows no WebMCP: it must not import protocol/, tools/ or platform/. Move the ' +
        'shared type down into core/, or let the tool in tools/ adapt the project/ result.',
    ),
    webmcpLayer(
      'protocol',
      ['^src/components/', '^src/lib/', '^node_modules/@edgerules/'],
      ['core/', 'protocol/'],
      'protocol/ is the tool contract and may import only core/. Make the type generic (as ToolDefinition is over its ' +
        'context) instead of importing project/, or move the shared type down into core/.',
    ),
    webmcpLayer(
      'tools',
      ['^src/components/', '^node_modules/@edgerules/'],
      ['core/', 'protocol/', 'project/', 'tools/'],
      'A tool validates its input, calls one project/ method and returns its ToolResult: it may import only core/, ' +
        'protocol/ and project/. Move engine and ProjectSession access into a project/ service.',
    ),
    webmcpLayer(
      'platform',
      ['^src/components/', '^src/lib/', '^node_modules/@edgerules/'],
      ['core/', 'protocol/', 'platform/'],
      'platform/ is the WebMCP adapter and may import only core/ and protocol/. The composition root ' +
        '(registerProjectTools.ts) passes it the tools and the context; do not import project/ or tools/ here.',
    ),
    {
      name: 'no-circular',
      comment:
        'Circular import. Break it by moving the shared types into their own module that both sides ' +
        'import, or by passing the dependency in (props, context, a service interface). Exception: the ' +
        'boxed-editor rows/ cycle is intentional recursive rendering (RowSwitch renders rows that render ' +
        'RowSwitch).',
      severity: 'error',
      from: {},
      to: {circular: true, viaOnly: {pathNot: '^src/components/boxed-editor/rows/'}},
    },

    // --- Engine boundary -----------------------------------------------------------------------------------------
    packageOwner(
      'engine-web-only-in-project-session',
      '@edgerules/web',
      ['src/components/project-session/engine/'],
      'components receive the engine as a service from the host (docs/architecture.md, "The engine remains ' +
        'the model authority"). Depend on a service interface typed with @edgerules/portable instead.',
    ),
    {
      name: 'engine-node-only-in-tests',
      comment:
        '@edgerules/node is a dev dependency for tests, fixtures and stories; shipped code must not import ' +
        'it. Accept a service interface (typed with @edgerules/portable) and let the host pass the engine.',
      severity: 'error',
      from: {path: '^src/', pathNot: TEST_CODE},
      to: {path: '^node_modules/@edgerules/node/'},
    },

    {
      name: 'no-router-in-library',
      comment:
        'The library has no router: page-level components report navigation through callbacks and the host owns ' +
        'the routes (docs/stories/examples-library-story.md, "Package placement of the page components"). ' +
        '@tanstack/react-router is a dev dependency of the local Modeler host in app/ only.',
      severity: 'error',
      from: {path: '^src/'},
      to: {path: '^node_modules/@tanstack/react-router'},
    },

    // --- Optional peer dependencies stay inside their component ---------------------------------------------------
    packageOwner(
      'peer-xyflow-only-in-flow-editor',
      '@xyflow/',
      ['src/components/flow-editor/'],
      'it is an optional peer dependency of the flow-editor subpath; importing it elsewhere makes every ' +
        'consumer of that other subpath install it.',
    ),
    packageOwner(
      'peer-tanstack-charts-only-in-flow-editor',
      '@tanstack/charts/',
      ['src/components/flow-editor/'],
      'it is an optional peer dependency of the flow-editor subpath; importing it elsewhere makes every ' +
        'consumer of that other subpath install it.',
    ),
    packageOwner(
      'peer-tanstack-markdown-only-in-markdown-view',
      '@tanstack/markdown/',
      ['src/components/markdown-view/'],
      'it is an optional peer dependency of the markdown-view subpath. Other components render MarkdownView ' +
        'instead of using the Markdown renderer directly.',
    ),
    packageOwner(
      'peer-codemirror-only-in-code-editors',
      '(@codemirror|@lezer)/',
      ['src/components/code-editor/', 'src/components/code-editor-cell/'],
      'it is an optional peer dependency of the code-editor subpaths. Other components render ' +
        'CodeEditorCell or HighlightedCode instead of using CodeMirror directly.',
    ),
    packageOwner(
      'peer-mantine-notifications-only-in-tests-manager',
      '@mantine/notifications/',
      ['src/components/tests-manager/'],
      'it is an optional peer dependency of the tests-manager subpath; importing it elsewhere makes every ' +
        'consumer of that other subpath install it.',
    ),
    packageOwner(
      'dnd-kit-only-in-grid-editors',
      '@dnd-kit/',
      ['src/components/boxed-editor/', 'src/components/tests-manager/'],
      'drag and drop is owned by the boxed-editor and tests-manager grids. Reuse their dnd/ hooks, or ' +
        'discuss moving a shared drag primitive to src/ui first.',
    ),

    // --- Test isolation ------------------------------------------------------------------------------------------
    {
      name: 'not-to-test-code',
      comment:
        'Shipped code must not import tests, test fixtures (testing/) or test libraries. Move the needed ' +
        'code out of the test folder into the component, or keep the import inside tests.',
      severity: 'error',
      from: {path: '^src/', pathNot: TEST_CODE},
      to: {path: [TEST_CODE, '^node_modules/(vitest|@testing-library|@vitest)/']},
    },
    {
      name: 'not-to-dev-dep',
      comment:
        'Shipped code imports a package that is only a devDependency, so consumers will not have it. Add it ' +
        'to dependencies or (optional) peerDependencies in package.json, or keep the import in tests.',
      severity: 'error',
      from: {path: '^src/', pathNot: [TEST_CODE, '\\.stories\\.tsx?$']},
      to: {dependencyTypes: ['npm-dev'], dependencyTypesNot: ['npm-peer', 'type-only']},
    },

    // --- Required coverage ---------------------------------------------------------------------------------------
    {
      name: 'component-has-story',
      comment:
        'No Storybook story reaches this component, but every component needs one (AGENTS.md, "Coding ' +
        'Standards"). Add stories/components/<component>/<Component>.stories.tsx that imports the component ' +
        'from its index.ts.',
      severity: 'error',
      // Transitive: a component that only another component's story renders also passes.
      from: {path: '^stories/.+\\.stories\\.tsx$'},
      to: {path: `${COMPONENT}[^/]+/index\\.ts$`, reachable: false},
    },

    // --- Hygiene -------------------------------------------------------------------------------------------------
    {
      name: 'not-to-unresolvable',
      comment:
        'This import does not resolve to a file or package, so the dependency graph (and every rule above) ' +
        'is incomplete. Fix the path, or install and declare the package.',
      severity: 'error',
      from: {},
      // Vite asset imports (`x?url`, `x?raw`) resolve at build time, not on disk.
      to: {couldNotResolve: true, pathNot: '\\?(url|raw|inline|worker)$'},
    },
    {
      name: 'no-non-package-json',
      comment:
        'This package is not declared in package.json; it only works because something else installs it. ' +
        'Add it to dependencies, peerDependencies or devDependencies.',
      severity: 'error',
      from: {},
      to: {dependencyTypes: ['npm-no-pkg', 'npm-unknown']},
    },
    {
      name: 'not-to-deprecated',
      comment: 'This package is deprecated. Upgrade it or replace it with its successor.',
      severity: 'warn',
      from: {},
      to: {dependencyTypes: ['deprecated']},
    },
    {
      name: 'no-orphans',
      comment:
        'Nothing imports this module. Delete it if it is dead code, or import it where it is needed. ' +
        '(Warning only: absence checks give false positives.)',
      severity: 'warn',
      from: {
        orphan: true,
        path: '^src/',
        pathNot: ['\\.d\\.ts$', '\\.md$', TEST_CODE, '^src/index\\.ts$', '^src/components/[^/]+/index\\.ts$'],
      },
      to: {},
    },
  ],
  options: {
    // Markdown is not JavaScript; scan it so the naming rule sees every .md file.
    extraExtensionsToScan: ['.md'],
    exclude: {
      // Anchored to the repo root: packages ship from node_modules/*/dist/, which must stay in the graph.
      path: '^(dist|app/dist|storybook-static|coverage|test-results|playwright-report|\\.git|\\.idea)/',
    },
    // Not `exclude`: excluding node_modules would drop every npm import from the graph, so the package
    // rules could never fire. doNotFollow keeps the edges but does not descend into the packages.
    doNotFollow: {path: 'node_modules'},
    // The tsc parser does not support typescript@7 yet; swc parses .ts/.tsx without it and keeps `import type`
    // edges. Do not set `tsPreCompilationDeps`: it requires tsc and only adds a misleading warning.
    parser: 'swc',
    tsConfig: {fileName: 'tsconfig.json'},
    enhancedResolveOptions: {
      // @edgerules/portable and @tanstack/charts subpaths are only reachable through `exports` conditions.
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      mainFields: ['module', 'main', 'types', 'typings'],
    },
    reporterOptions: {
      text: {highlightFocused: true},
    },
  },
};
