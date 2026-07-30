# Refresh

A Chrome extension that replaces your new tab with one AI headline. It ranks stories by signal strength, not recency.

**Status:** Shipped. v1.0.0 is ready for Chrome Web Store submission.

## What it does

Every time you open a new tab, you get the single most important AI story right now. Not a feed. Not a firehose. One headline.

It fetches 29 RSS/Atom feeds in parallel every 5 minutes. Sources include OpenAI, Anthropic, Google, xAI, HuggingFace, TechCrunch, Hacker News, Reddit ML, and more. It scores each story from 0 to 100 on:

- Source tier (15 pts)
- Cross-source coverage: the same story across multiple outlets (35 pts)
- HN traction (20 pts)
- Recency (25 pts)

## Features

- Story types: Launch / Research / Funding / Open Source / Developing
- Keyboard nav: `←→` navigate, `O` open, `S` save, `L` reading list, `W` briefing, `M` topic map, `,` mixing board
- Force-directed physics graph (canvas, no D3) for topic relationships
- 48hr timeline strip
- Ambient mode
- Smart dedup: URL + fuzzy title matching
- 3-step onboarding

## Tech

Vanilla JS, Chrome MV3, Chrome Alarms API. Zero dependencies. Custom regex RSS parser (the service worker cannot use DOMParser).

## Install

Not yet on the Chrome Web Store. To load it locally:
1. Go to `chrome://extensions`
2. Enable Developer Mode
3. Load unpacked → select this folder
