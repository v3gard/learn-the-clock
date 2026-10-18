# Development

## Run locally

Requires [Bun](https://bun.sh/).

```sh
bun install
bun run dev
```

Production build: `bun run build`. Preview with `bun run preview` at
`http://localhost:4173/learn-the-clock/`.

## Tests

Run lint and domain tests:

```sh
bun run lint
bun test
```

Install Playwright's Chromium browser once, then run the browser tests:

```sh
bunx playwright install chromium
bun run test:e2e
```

On Linux, use `bunx playwright install --with-deps chromium` to install system
dependencies too. Playwright starts its own local Vite server on port 4174.
Use `bun run test:e2e --headed` to watch the tests. Failed tests save screenshots
and traces in `test-results/`.

The browser tests cover a perfect-score ten-question Easy + Digital quiz,
confetti rendering, resizing, cleanup, reduced motion, and dragging both analog
hands to update the digital time. Quiz fixtures use fixed whole-hour questions,
including midnight, noon, and afternoon times. Question injection is enabled
only in Vite's `e2e` mode; development and production builds generate their own
questions.

Domain tests live in `tests/`. Playwright tests live in `e2e/` and use
`.e2e.ts` filenames so `bun test` does not collect them.

## Install and use offline

Open the game and choose **Install app** in the top toolbar for installation
instructions. On iPhone/iPad, use Safari's **Share → Add to Home Screen**.
On Android, use Chrome's install action or browser menu. Desktop installation
is available in supporting browsers.

Open the installed app once while online and wait for **Ready to use offline**.
The clocks, quizzes, tutorial, languages, and backgrounds then work without
internet, including after closing and reopening the app. External support links
still need a connection. Browsers can remove offline data when storage is low
or site data is cleared.

Updates never automatically reload an activity. Choose **Update app**, close
other app tabs/windows, and confirm when ready to start a fresh activity.
Preferences are saved; unfinished quizzes and clock edits are not.


### Production PWA checks

The service worker is enabled only in production builds, not the Vite
development server or the existing E2E mode. Test the built app separately:

```sh
bunx playwright install chromium webkit
bun run test:pwa
```

This builds the app and starts a production preview on port 4175. The `.pwa.ts`
checks run in Chromium and WebKit, covering install metadata/icons, offline
launches and reloads on both routes, preference persistence, installation help,
update checks on return, multi-window update safety, and retrying failed setup
or updates. They temporarily modify only `dist/sw.js` to simulate deployments
and restore it after each test. Do not run another build or preview of `dist`
at the same time. Run this suite separately from `test:e2e`, since Playwright
cleans their shared `test-results/` directory.

CI runs the Chromium PWA checks within the existing required E2E job, using
`bun run test:pwa --project chromium`.

**Real-device verification is still pending:** automated WebKit is not an
iPhone/iPad home-screen installation. Before declaring mobile installation
verified, perform these checks on iPhone/iPad Safari and Android Chrome:

1. Install from the deployed HTTPS URL using the app's instructions.
2. Open the installed app online and wait for the offline-ready confirmation.
3. Close it, enable airplane mode, and launch it again. Try both screens,
   a quiz, the tutorial, preferences, and portrait/landscape layouts.
4. Reconnect and deploy an update. Confirm that a running quiz is not reloaded,
   another open app window blocks the update, and the explicit update action
   reloads only the confirming window after the other windows are closed.

## Offline behavior

The manifest and worker are scoped to `/learn-the-clock/`, matching GitHub
Pages. `vite-plugin-pwa` injects the production assets into `sw.ts`; Workbox
precaches the whole learning app and serves cached navigation within that scope.
There is no runtime caching of external links.

`pwaRuntime.ts` registers the worker, checks readiness, and checks for updates
on launch and when returning to the foreground (at most once per hour).
Updates wait for explicit confirmation. The waiting worker checks live
in-scope app windows before allowing activation; the app never reloads in
response to a global `controllerchange` event. A failed update leaves the
working cache intact. Retrying a failed first installation resets only this
app's partial cache when no active or waiting worker exists.
For an incomplete active cache, retry restores only missing assets. Build-time
SHA-256 integrity checks prevent caching a different deployment under an older
worker's keys. If a newer deployment exists, its update takes precedence.

`Pwa.tsx` provides accessible installation help and update/error controls,
including standalone mode. Strings live in `pwaText.ts`. Readiness is announced
once per browser storage profile, using `learn-the-clock.offlineReadyNotified`.
Browsers may evict stored data; offline availability is not permanent storage.
After eviction, reopen the app online to set it up again. An incomplete cache
is reported as a setup failure rather than advertised as ready.

## Code layout

`App.tsx` owns navigation, language, theme, and page tools. Both screens stay
mounted when navigating so their progress and unfinished edits are preserved.

| Area | Files in `src/` |
| --- | --- |
| Freestyle clock screen and input behavior | `FreestyleClock.tsx` |
| Pointer capture and analog dragging | `useClockDrag.ts` |
| Shared clock rendering | `Clocks.tsx` |
| Time formatting, editing reducer, and clock geometry | `clock.ts` |
| Quiz flow and answer submission | `Quiz.tsx` |
| Answer rendering and restart dialog focus handling | `QuizAnswers.tsx`, `QuizRestartDialog.tsx` |
| Local canvas particle animation, reduced-motion handling, and cleanup | `useConfetti.ts` |
| Question generation and quiz reducer | `quizModel.ts` |
| Localized interface text | `i18n.ts`, `quizText.ts` |
| Background selection and donation information | `Personalization.tsx`, `Support.tsx` |
| Shared popover title and close button | `ToolbarPanelHeading.tsx` |
| Validated localStorage preferences and persistence hook | `preferences.ts` |
| Hands-on tutorial, spotlight, and localized instructions | `Tutorial.tsx`, `useTutorial.ts`, `tutorialText.ts` |
| Installation help, offline readiness, and explicit updates | `Pwa.tsx`, `pwaRuntime.ts`, `pwaMessages.ts`, `pwaText.ts`, `../sw.ts` |

Screen-specific buttons, flags, and clock details are private components in their
owning modules. Components are exported only when another module uses them.

## Preferences and layout

Language, light/dark mode, background, quiz difficulty, and clock display mode
are remembered in localStorage. Clock time, unfinished edits, and quiz progress
are not saved across reloads.

The default language is Norwegian for browsers whose preferred language is
Norwegian (`nb`, `nn`, or `no`), and English otherwise. A Norway region alone
(for example, `en-NO`) does not select Norwegian. A saved choice takes precedence.
Clear the site's browser data to restore defaults. If storage is unavailable,
preferences work for the current session and a warning is logged in the console.

The layout fits laptops and large portrait phones without scrolling. On phones,
secondary options are under **More controls**. Very small screens retain
vertical scrolling.

## Deployment

Select **Settings → Pages → Source → GitHub Actions** in the GitHub repository.
Pushing to `main` builds and deploys automatically.

Pull requests run lint, domain tests, browser tests, and the production build
without deploying. The workflow reports separate `test` and `test:e2e` checks;
both must pass before the build and deployment can run.

The **Required PR tests** repository ruleset requires both checks before merging
into the default branch, including for administrators. Existing review and
other repository rules remain unchanged.
