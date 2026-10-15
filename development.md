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
