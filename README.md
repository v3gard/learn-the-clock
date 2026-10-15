# Learn the Clock

Learn analog and digital clocks through freestyle play and quizzes. Norwegian
and English, four difficulty levels, light/dark mode, and three backgrounds.

Fits laptop and large portrait phone viewports without scrolling. On phones,
secondary options are under **More controls**. Very small screens retain
vertical scrolling. No accounts.

Language, light/dark mode, background, quiz difficulty, and clock display mode
are remembered in your browser's localStorage. Clock time, unfinished edits,
and quiz progress are not saved across reloads. The default is Norwegian for
browsers whose preferred language is Norwegian (`nb`, `nn`, or `no`), and English
otherwise. A Norway region alone (for example, `en-NO`) does not select Norwegian.
A saved language choice takes precedence. Clear this site's browser data
to restore the defaults. If storage is unavailable, preferences still work for
the current session and a warning is logged in the browser console.

[GitHub Pages](https://v3gard.github.io/learn-the-clock/)

Donations are appreciated and help fund future educational games:
[buymeacoffee.com/v3gard](https://buymeacoffee.com/v3gard).

## Screenshots

![Freestyle play with synchronized digital and analog clocks](docs/screenshots/freestyle.png)

![Ultra hard quiz with two-part answers, dark mode, and a space background](docs/screenshots/quiz.png)

## Run locally

Requires [Bun](https://bun.sh/).

```sh
bun install
bun run dev
```

Production build: `bun run build`. Preview with `bun run preview` at
`http://localhost:4173/learn-the-clock/`.

Checks: `bun run lint` and `bun test`.

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
| Celebration animation and cleanup | `useConfetti.ts` |
| Question generation and quiz reducer | `quizModel.ts` |
| Localized interface text | `i18n.ts`, `quizText.ts` |
| Background selection and donation information | `Personalization.tsx`, `Support.tsx` |
| Shared popover title and close button | `ToolbarPanelHeading.tsx` |
| Validated localStorage preferences and persistence hook | `preferences.ts` |

Screen-specific buttons, flags, and clock details are private components in their
owning modules. Components are exported only when another module uses them.

Domain tests live in `tests/clock.test.ts` and `tests/quiz.test.ts`.

## Deployment

Select **Settings → Pages → Source → GitHub Actions** in the GitHub repository.
Pushing to `main` builds and deploys automatically. A manual **Deploy to GitHub
Pages** run on `main` with an empty `candidate_sha` also deploys.

### Non-publishing checks

Pull requests run the same frozen dependency install, lint, tests, and production
build on the exact PR head commit (not GitHub's synthetic merge commit). The build
job has only read permissions. Pages configuration, artifact upload, and the
deployment job run **only** for a push or manual run on `main` with no
`candidate_sha`. PRs and manual runs on any other branch never publish. Check-only
runs have separate concurrency groups, so they cannot cancel or queue behind a
live deployment.

For exact-revision validation before merging, manually run this workflow from a
validation branch and set `candidate_sha` to the candidate's full 40-character
commit SHA. A nonempty candidate input disables all publishing even when the
workflow is run from `main`; invalid SHA formats fail before checkout. Leaving
the input empty on a validation branch checks that branch's commit without
publishing.

The **Report revisions** step logs the **workflow SHA** (which defines the action
versions and checks) separately from the **checked-out SHA** (the source and
dependencies being tested). A candidate checkout does not load that candidate's
workflow or action versions. To validate an action upgrade on a GitHub runner,
the workflow on the validation branch must itself contain the upgraded `uses:`
version; checking out an action-upgrade candidate alone is not sufficient.
