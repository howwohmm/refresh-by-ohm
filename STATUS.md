# Refresh

**status:** shipped — v1.0.0, ready for Chrome Web Store submission

**what:** Chrome extension that replaces new tab with one AI headline, ranked by signal strength. Pulls from 29 sources every 5 minutes — OpenAI, Anthropic, Google, xAI, HuggingFace, TechCrunch, HN, Reddit ML, and more.

**for:** AI enthusiasts, devs, researchers who want signal not noise

**built:**
- 29 RSS/Atom feeds parsed in parallel via custom regex (no DOMParser — service worker limitation)
- signal score 0–100: source tier (15) + cross-source coverage (35) + HN traction (20) + recency (25)
- story types: Launch / Research / Funding / Open Source / Developing
- keyboard: ←→ navigate, O open, S save, L reading list, W briefing, M topic map, , mixing board
- force-directed physics graph (canvas, no D3)
- 48hr timeline strip, ambient mode, smart dedup (URL + fuzzy title)
- 3-step onboarding

**tech:** Vanilla JS, Chrome MV3, Chrome Alarms API, zero dependencies

**ai:** none (but tracks Anthropic's own feeds)

**pending:** Chrome Web Store submission
