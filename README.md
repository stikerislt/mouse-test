# Calibra — Mouse Consistency Check

A simple, guided check that tells CS2 players whether their mouse and mousepad are working consistently — in about 3 minutes.

## How to run (important)

**Do not double-click `index.html`** — Chrome blocks the app on `file://` URLs.

### Option A — one click (Windows)

1. Double-click **`serve.bat`** in this folder
2. Open the URL shown in the terminal (usually **http://localhost:5500**)

### Option B — PowerShell

```powershell
cd path\to\mouse-test
.\serve.ps1
```

Then open the URL shown in the terminal.

### Option C — Python

```bash
python -m http.server 8080
```

Then open the URL shown in the terminal.

### Option D — Node

```bash
npm start
```

## What it does

1. **Quick setup** — enter your mouse DPI and pad width
2. **Six guided checks** — connection, sensor at rest, smoothness, lift tracking, swipe consistency, acceleration
3. **Plain-English verdict** — pass/warn/fail per check with tips on what to fix
4. **Save report** — download a PDF summary

## Before you start

- Turn off Windows "Enhance pointer precision"
- Set browser zoom to 100%
- For one check, put two tape marks on your pad (the app tells you how far apart)

## Tech

Vanilla HTML, CSS, JavaScript (ES modules). Pointer Lock API, localStorage. Fully offline once served locally — no frameworks, no analytics.

## Unit tests

Start the local server, then open **http://localhost:8080/test/**
