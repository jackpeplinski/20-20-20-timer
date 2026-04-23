# 20-20-20 Timer

Every 20 minutes, look 20 feet away for 20 seconds.

A small React + TypeScript + Vite app that runs the 20-20-20 cycle with a soft ocean-waves cue during the rest phase, a GitHub-style day grid for tracking rests, and a lightweight task list with complete/edit/delete.

Live: https://jackpeplinski.github.io/20-20-20-timer/

## Features

- 20-minute work / 20-second rest cycle with pause, skip, and cancel
- Ocean-waves audio during the rest phase
- Task list: add with Enter or Add, with 12-hour time, relative "time since", mark complete, edit, delete
- Day-at-a-glance grid of 72 twenty-minute blocks — click any cell to cycle through acknowledged → break → unset

## Development

```bash
npm install
npm run dev       # start dev server
npm test          # run test suite
npm run build     # type-check + production build
npm run preview   # preview the production build locally
```

## Deployment

Pushing to `main` triggers the GitHub Pages workflow in `.github/workflows/deploy.yml`.
