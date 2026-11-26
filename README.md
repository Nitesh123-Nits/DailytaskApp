# Daily Tasks

A calendar-based daily task app (PWA) for your phone. Tap any date, past or future, to see and write
the tasks for that day, tick them off, and keep the full history forever. Works offline; all data stays
on your device.

**Live app:** https://nitesh123-nits.github.io/DailytaskApp/

## Features
- Month calendar with a dot per day (green = all done, amber = pending); swipe to change month; tap the month name to jump to any date or year
- Tasks per date with notes, optional time, and priority (Low / Medium / High, colour-coded)
- Tick-box for done / not done; done items sink to the bottom, strike-through
- Repeating tasks: daily, weekdays, weekly, monthly. They extend automatically; delete one day or "this and all future days"
- Overdue tasks: one tap moves unfinished past tasks to today (with Undo)
- Undo for deletes
- History: every task grouped by day, search text/notes, filter Done / Pending
- Stats: streak, best streak, monthly completion, last 7 days, 12-week heatmap
- Light / dark / auto theme
- Backup: save to Downloads, share to Drive/WhatsApp, restore from file; reminder when a backup is overdue
- Installable, offline, home-screen shortcut "Add task"

## Install on your phone
1. Open the live link in **Chrome** on Android.
2. Chrome menu (⋮) > **Install app** (or Add to Home screen).
3. Open it from the new icon. Installing lets Chrome mark the data as persistent so it isn't auto-cleared.

Clearing site data or uninstalling erases the data, so use **⋮ > Save backup file** now and then.

## Deploy (GitHub Pages)
Repo **Settings > Pages > Build and deployment > Source: GitHub Actions**. Every push to `main`
deploys automatically via `.github/workflows/pages.yml`. No build step; the site is plain HTML/JS.

## Files
- `index.html` the whole app (UI, IndexedDB storage, logic)
- `sw.js` offline cache, `manifest.webmanifest` install metadata, `icons/` app icons
