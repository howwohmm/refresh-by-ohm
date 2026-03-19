# Refresh

## project name + description
- refresh: Chrome extension that replaces new tab with one AI headline, ranked by signal strength

## who it's for
- AI enthusiasts, developers, and researchers who want signal not noise from AI news

## current status
- shipped — v1.0.0, ready for Chrome Web Store submission (pending submission)

## what was actually built
- 29 RSS/Atom feeds parsed in parallel via custom regex (no DOMParser — service worker limitation)
- Signal score 0–100 calculated from: source tier (15pts) + cross-source coverage (35pts) + HN traction (20pts) + recency (25pts)
- Story type classification: Launch / Research / Funding / Open Source / Developing
- Keyboard shortcuts: ←→ navigate, O open, S save, L reading list, W briefing, M topic map, , mixing board
- Force-directed physics graph on canvas (no D3)
- 48-hour timeline strip
- Ambient mode
- Smart deduplication (URL + fuzzy title matching)
- 3-step onboarding flow
- Mixing board: toggle source groups (AI Labs, Tools, News, Newsletters, HN, Reddit)
- Source groups: OpenAI, Anthropic, Google AI, xAI, HuggingFace, TechCrunch, The Verge, VentureBeat, MIT Tech Review, HN, r/MachineLearning, r/LocalLLaMA, and more

## why it was built
- To replace noisy new tab pages with a single highest-signal AI story — reducing feed fatigue for people following AI closely

## blockers or reasons shelved
- n/a — not shelved; pending Chrome Web Store submission

## wins or progress moments
- Built full signal scoring algorithm (0–100) without any dependencies
- Parsed 29 feeds with custom regex in a Chrome MV3 service worker (no DOM available)
- Full keyboard-driven UI with physics graph, topic map, and briefing view all in vanilla JS

## pain points
- Chrome MV3 service worker limitations required rewriting feed parsing without DOMParser
- Deduplication across 29 sources required both URL normalization and fuzzy title matching

## where claude api / ai was used or planned
- No Claude/AI API used in the product; the extension tracks Anthropic's own RSS feeds as a source

## what would've helped
- Chrome Web Store developer account and submission process time
- A way to automate feed discovery / add user-defined sources

## metrics or traction
- none yet — not submitted to Chrome Web Store
