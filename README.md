# Calibra — Mouse Consistency Check

A simple, guided check that tells CS2 players whether their mouse and mousepad are working consistently — in about 3 minutes.

## Usage

Open `index.html` in Chrome, Edge, or Firefox. No server or build step required.

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

Vanilla HTML, CSS, JavaScript. Pointer Lock API, localStorage. Fully offline — no frameworks, no analytics.

## Tests

Open `test/index.html` to run unit tests for `stats.js`, `checks.js`, and `scoring.js`.
