/**
 * Architecture enforcement. See docs/architecture/decisions/0011-*.md
 *
 * Every rule here is `error`: a violation fails the build. A warning is a
 * violation that gets merged anyway, which is documentation with colours
 * rather than enforcement.
 */

const API_MODULE = '^apps/api/src/modules/([^/]+)/';

module.exports = {
  forbidden: [
    // ---- Layer rules, within apps/api ----------------------------------

    {
      name: 'domain-is-self-contained',
      comment:
        'A module\'s domain/ may import only from its own domain/. Nothing ' +
        'else: no other layer, no other module, no npm package, no workspace ' +
        'package, no Node builtin.\n' +
        'This is expressed as an allowlist on purpose. The denylist version - ' +
        'enumerating forbidden frameworks or npm dependency types - silently ' +
        'missed an import that resolved as "npm-no-pkg" because it was ' +
        'declared in the root package.json rather than the app\'s. An ' +
        'allowlist cannot have that gap, and there is no list to keep current.\n' +
        'Consequence: domain tests need no mocks. When a business rule appears ' +
        'to need the clock, a UUID or a database, the hexagonal answer is a ' +
        'port in application/ - and this rule is what surfaces that need ' +
        'instead of letting it leak inward.',
      severity: 'error',
      from: { path: '^apps/api/src/modules/([^/]+)/domain/' },
      to: { pathNot: '^apps/api/src/modules/$1/domain/' },
    },

    {
      name: 'application-must-not-depend-on-infrastructure',
      comment:
        'application/ declares ports; infrastructure/ implements them. A use ' +
        'case importing an adapter directly defeats the whole indirection.',
      severity: 'error',
      from: { path: '^apps/api/src/modules/[^/]+/application/' },
      to: { path: '^apps/api/src/modules/[^/]+/infrastructure/' },
    },

    {
      name: 'no-cross-module-internals',
      comment:
        'Bounded contexts talk through published application ports or domain ' +
        'events, never by reaching into another context. The $1 backreference ' +
        'makes this one rule cover every module, including ones added later.',
      severity: 'error',
      from: { path: API_MODULE },
      to: {
        path: '^apps/api/src/modules/([^/]+)/(domain|infrastructure)/',
        pathNot: '^apps/api/src/modules/$1/',
      },
    },

    // ---- Package rules, across the monorepo -----------------------------

    {
      name: 'contracts-must-not-depend-on-apps',
      comment:
        'packages/contracts is the shared foundation both apps depend on. ' +
        'Importing upward inverts the dependency and drags backend code into ' +
        'the frontend bundle. Nobody writes this deliberately; editor ' +
        'auto-import does.',
      severity: 'error',
      from: { path: '^packages/contracts/' },
      to: { path: '^apps/' },
    },

    {
      name: 'apps-must-not-depend-on-each-other',
      comment:
        'apps/api and apps/web share code only through packages/*.',
      severity: 'error',
      from: { path: '^apps/([^/]+)/' },
      to: { path: '^apps/([^/]+)/', pathNot: '^apps/$1/' },
    },

    // ---- General --------------------------------------------------------

    {
      name: 'no-circular',
      comment: 'A cycle is a boundary that was never really there.',
      severity: 'error',
      from: {},
      to: { circular: true },
    },

    {
      name: 'no-orphans',
      comment:
        'A module nothing imports is usually dead code left behind by a ' +
        'refactor. Exempt: config files, type declarations, and entry points. ' +
        'An entry point is reached by the runtime or by a package consumer ' +
        'rather than by a sibling module, so being an orphan is its normal ' +
        'state - not an unenforced boundary.',
      severity: 'error',
      from: {
        orphan: true,
        pathNot: [
          '(^|/)[.][^/]+[.](?:js|cjs|mjs|ts|cts|mts|json)$',
          '[.]d[.]ts$',
          '(^|/)tsconfig[.]json$',
          '(^|/)(?:babel|webpack|vite|turbo)[.]config[.](?:js|cjs|mjs|ts)$',
          // Package entry barrels, declared in package.json "exports".
          '^packages/[^/]+/src/index[.]ts$',
          // Application entry points, invoked by the runtime.
          '^apps/[^/]+/src/(main|index)[.]tsx?$',
        ],
      },
      to: {},
    },
  ],

  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '(^|/)(dist|build|coverage)/' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      extensions: ['.js', '.mjs', '.cjs', '.ts', '.mts', '.cts', '.tsx'],
    },
    reporterOptions: {
      text: { highlightFocused: true },
    },
  },
};
