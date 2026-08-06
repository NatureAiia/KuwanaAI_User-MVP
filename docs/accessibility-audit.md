# Accessibility audit

`/trust` claims Kuwana is "Built to WCAG 2.1 AA." This doc is that claim backed by an
actual check, run against the protocol in the AI4I Track 2 Design Proposal (`7. Section
4: Accessibility & Usability`) rather than an ad-hoc pass.

## What's automated

`e2e/accessibility.spec.ts` runs `@axe-core/playwright` (tags `wcag2a`, `wcag2aa`,
`wcag21a`, `wcag21aa`) against every page reachable without an authenticated session —
`/`, `/login`, `/signup`, `/trust`, `/explore`, `/explore/telecom`, `/explore/healthcare`
— in both light and dark mode (dark set via `localStorage.kuwana-theme`, the same key the
app's own theme-init script reads), plus a keyboard test that the skip link actually moves
focus. 15 checks total. Same auth constraint as the rest of `e2e/`: there's no way to get
a real session without a live inbox or the Supabase admin API, so authenticated portal
pages (dashboard, profile, admin, provider, corporate, regulator) aren't covered here and
need a manual pass with a real session.

Run it with `npm run test:e2e -- e2e/accessibility.spec.ts`.

## Findings from the first run, and what was fixed

| Requirement (7.pdf §4) | Finding | Fix |
| --- | --- | --- |
| Keyboard operation — skip link | No skip link existed anywhere; every page made a keyboard user tab through the full header nav before reaching content. | Added `src/components/SkipLink.tsx`, wired into `src/app/layout.tsx`. Every page's content wrapper now carries `id="main-content" tabIndex={-1}` as the landing target (19 page files). |
| Contrast ratio (4.5:1 normal text) | axe flagged `color-contrast` (serious) on `/trust`, `/explore`, `/explore/telecom`, `/explore/healthcare`: the light-mode `--accent-teal` (`#0f8a7a`, 4.25:1 on white) and `--accent-coral` (`#d14a3a`, 4.42:1 on white) tokens fell under 4.5:1, and dropped further (~3.5:1) on the `Badge` component's own 15%-tint background (`src/components/ui/Card.tsx`). | Darkened both tokens in `src/app/globals.css` (`:root` / light mode only — dark mode's `.dark` values were already high-contrast and untouched): `--accent-teal` → `#0d7568`, `--accent-coral` → `#b93a2b`. Both now clear 4.5:1 against white *and* against their own badge tint. `--accent-sky` was already fine (4.77:1 on its badge tint) and wasn't touched. |
| Touch targets (44×44px) | Already handled — `.tap-target` in `globals.css` predates this audit. | No change needed. |
| Screen-reader support / non-colour cues / plain language | Not machine-checkable; needs a manual NVDA/VoiceOver walkthrough and a task-based session per persona, per the proposal's own §4.1 protocol. | Not done in this pass — listed below as follow-up. |

All 15 automated checks (7 pages × light/dark, plus the skip-link test) pass as of this
commit; the full existing `e2e/` suite was re-run and shows no regressions from these
changes.

## Follow-up (not done in this pass — scope was the automatable slice)

- **Authenticated pages**: dashboard, profile, chat, settings, leaderboard, notifications,
  provider/corporate/regulator/admin portals aren't covered by the automated suite (no
  test session available) and haven't had a manual pass either. Same color tokens are used
  there, so the contrast fix above should carry over, but skip-link targets and any
  page-specific contrast issues need verifying once there's a way to run authenticated
  Playwright sessions.
- **Admin portal** (`/admin/*`) has no persistent header/nav at all currently, so there's
  no repeated block for a skip link to bypass — lower priority than the consumer-facing
  pages above.
- **Manual protocol** from 7.pdf §4.1 (screen-reader walkthrough, colour-blind simulation,
  task-based usability testing per persona) — genuinely needs a human, not automatable.
