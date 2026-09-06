/**
 * Built-in judge roster — the platform's permanent "tenants".
 *
 * Each entry is one judge desk on the network: a themed scorecard route
 * (`/{slug}`), a CSS palette class (`.theme-{…}` in globals.css), branding,
 * and a real channel logo. This is the single source of truth wired into:
 *   - the route pages under src/app/{slug}/page.tsx
 *   - the judge switcher (ThemeNav)
 *   - the home "Judging Panel" roster
 *
 * Palette colors here mirror the `--mosaic-*` values of each theme so the
 * roster tiles can paint themselves in the judge's own brand without
 * re-deriving anything. Keep them in sync with globals.css.
 */
export type BuiltinJudge = {
  /** URL segment + per-judge store/localStorage namespace. */
  slug: string;
  /** Display name (nav label + page eyebrow). */
  name: string;
  /** Title-block line 1 (used only when a judge has no logo). */
  line1: string;
  /** Title-block line 2 (accented). */
  line2: string;
  /** Palette class defined in globals.css. */
  themeClass: string;
  /** Channel logo under /public/logos. Absent → text title block. */
  logoSrc?: string;
  /** Primary brand color — nav dot + roster avatar ring (theme --mosaic-1). */
  swatch: string;
  /** Bright accent for the roster caption text (theme --mosaic-3). */
  accent: string;
  /** Deep companion for the roster tile gradient (theme --mosaic-5). */
  deep: string;
};

export const BUILTIN_JUDGES: BuiltinJudge[] = [
  {
    slug: 'project-bodybuilding',
    name: 'Project: Bodybuilding',
    line1: 'Project:',
    line2: 'Bodybuilding',
    themeClass: 'theme-project-bodybuilding',
    logoSrc: '/logos/project-bodybuilding.jpg',
    swatch: '#ff2f92',
    accent: '#ffe45e',
    deep: '#461052',
  },
  {
    slug: 'supersetman',
    name: 'Supersetman',
    line1: 'Superset',
    line2: 'man',
    themeClass: 'theme-supersetman',
    logoSrc: '/logos/supersetman.jpg',
    swatch: '#ee2b1c',
    accent: '#ffc83d',
    deep: '#5e0f08',
  },
  {
    slug: 'epzeronine',
    name: 'EPzeronine',
    line1: 'EP',
    line2: 'zeronine',
    themeClass: 'theme-epzeronine',
    logoSrc: '/logos/epzeronine.jpg',
    swatch: '#b6f000',
    accent: '#d6ff52',
    deep: '#1a2b05',
  },
  {
    slug: 'marxmaxmuscle',
    name: 'Marx Max Muscle',
    line1: 'Marx Max',
    line2: 'Muscle',
    themeClass: 'theme-marxmaxmuscle',
    logoSrc: '/logos/marxmaxmuscle.jpg',
    swatch: '#c01f1a',
    accent: '#f5d24a',
    deep: '#4a0a08',
  },
  {
    slug: 'xavier',
    name: 'Xavier',
    line1: 'Xavier',
    line2: 'Scorecard',
    themeClass: 'theme-xavier',
    logoSrc: '/logos/xavier.jpg',
    swatch: '#4dd0e1',
    accent: '#ffd166',
    deep: '#103655',
  },
  {
    slug: 'marcus',
    name: 'Marcus',
    line1: 'Marcus',
    line2: 'Scorecard',
    themeClass: 'theme-marcus',
    logoSrc: '/logos/muscle.jpg',
    swatch: '#ff3d8b',
    accent: '#ffd166',
    deep: '#6b2a4a',
  },
  {
    slug: 'superchat',
    name: 'Superchat',
    line1: 'Superchat',
    line2: 'Scorecard',
    themeClass: 'theme-superchat',
    swatch: '#00d2d2',
    accent: '#7be9ec',
    deep: '#1d6e7a',
  },
];

/** Look up a built-in desk by slug. */
export function getBuiltinJudge(slug: string): BuiltinJudge | undefined {
  return BUILTIN_JUDGES.find((j) => j.slug === slug);
}
