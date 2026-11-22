/** App name — replaced by the CLI during scaffolding */
export const APP_NAME = 'dot-md'

/** Immutable app identity — data scope keys to this, so renames never
 *  strand your records.
 *
 *  Injected by the build from `DEEPSPACE_APP_ID` in the wrangler config this
 *  build is running against — `deepspaceBuild()` in vite.config.ts supplies the
 *  define (see `deepspace/build`). wrangler.toml is the only source of truth,
 *  so `deepspace dev start`, `vite build`, and `deepspace deploy --env <name>`
 *  each get their own environment's id — not a copy frozen at scaffold time.
 *  Do not replace this with a literal: that is how a staging browser ends up
 *  reading production's rooms. */
declare const __DEEPSPACE_APP_ID__: string
export const APP_ID: string = __DEEPSPACE_APP_ID__

/** Primary scope ID for the app's RecordRoom DO */
export const SCOPE_ID = `app:${APP_ID}`

/** Roles and display config — imported from SDK (single source of truth) */
export { ROLES, ROLE_CONFIG, type Role } from 'deepspace'

/** Copy for the SDK's <AuthOverlay>. Its defaults ("Sign in to DeepSpace")
 *  read as returning-users-only, but the GitHub/Google buttons create an
 *  account on first use — so say that. The overlay's email form only signs in
 *  existing accounts, hence the pointer to GitHub/Google for new people. */
export const AUTH_OVERLAY_COPY = {
  title: 'Sign up or sign in',
  description:
    'New here? Continue with GitHub or Google and your account is created on the spot. Email sign-in is for existing accounts.',
} as const
