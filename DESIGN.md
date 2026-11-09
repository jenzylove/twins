# Visual Design Contract

Twins is a calm, light workbench for one job: see the code that was written more than once, keep one copy, and trust the result.

## Direction

- Palette: porcelain (`#f2f1ed`, `#ebe9e3`, `#e1ded6`) with warm ink text (`#141311`). One accent, ultraviolet `#4a2cff`, marks copies and the primary action. Green `#0e8f61` means kept; red `#e0341f` means Twins said no.
- Type: Funnel Display for headlines, Funnel Sans for text, Martian Mono for code, paths and labels.
- Composition: the landing page is one vertical story, one section at a time, with restrained scroll reveals. The app is a map of the repo beside a ranked list of things written twice and a history of every merge.
- Language: plain words first ("written 3 times", "Your app today: works", "Keep one copy", "would break your app in 4 places"). Raw numbers and compiler errors sit one tap away.
- Motion: copies fly into one when a merge is kept; cells flash and a SAID NO stamp lands when one is refused. Everything respects reduced motion.

## Guardrails

- Light theme only; tokens live in `app/components/twins/twins.css` and `app/global.css`.
- No generic card grids on the landing page; sections open one at a time.
- Every result the UI shows comes from an action, so the page, the assistant and external agents see the same thing.
