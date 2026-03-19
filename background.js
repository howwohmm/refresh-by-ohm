// ── Config ────────────────────────────────────────────────────────────────────

const CONFIG = {
  feeds: [
    // ── AI lab official feeds (validated) ─────────────────────────────────
    {
      url:     "https://openai.com/news/rss.xml",
      name:    "OpenAI",
      type:    "rss",
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36" },
    },

    // Anthropic — no official RSS, scraped hourly via Olshansk/rss-feeds
    { url: "https://raw.githubusercontent.com/Olshansk/rss-feeds/main/feeds/feed_anthropic_news.xml",                  name: "Anthropic News",     type: "rss" },
    { url: "https://raw.githubusercontent.com/Olshansk/rss-feeds/main/feeds/feed_anthropic_research.xml",              name: "Anthropic Research", type: "rss" },
    { url: "https://raw.githubusercontent.com/Olshansk/rss-feeds/main/feeds/feed_anthropic_engineering.xml",           name: "Anthropic Eng",      type: "rss" },
    { url: "https://raw.githubusercontent.com/Olshansk/rss-feeds/main/feeds/feed_anthropic_changelog_claude_code.xml", name: "Claude Code",        type: "rss" },
    { url: "https://raw.githubusercontent.com/Olshansk/rss-feeds/main/feeds/feed_openai_research.xml",                 name: "OpenAI Research",    type: "rss" },
    { url: "https://raw.githubusercontent.com/Olshansk/rss-feeds/main/feeds/feed_xainews.xml",                         name: "xAI",                type: "rss" },
    { url: "https://raw.githubusercontent.com/Olshansk/rss-feeds/main/feeds/feed_cursor.xml",                          name: "Cursor",             type: "rss" },
    { url: "https://raw.githubusercontent.com/Olshansk/rss-feeds/main/feeds/feed_ollama.xml",                          name: "Ollama",             type: "rss" },
    { url: "https://raw.githubusercontent.com/Olshansk/rss-feeds/main/feeds/feed_the_batch.xml",                       name: "The Batch",          type: "rss" },
    { url: "https://raw.githubusercontent.com/Olshansk/rss-feeds/main/feeds/feed_paulgraham.xml",                      name: "Paul Graham",        type: "rss" },
    { url: "https://raw.githubusercontent.com/Olshansk/rss-feeds/main/feeds/feed_windsurf_changelog.xml",              name: "Windsurf",           type: "rss" },

    { url: "https://blog.google/technology/ai/rss/",     name: "Google AI",       type: "rss" },
    { url: "https://research.google/blog/rss",            name: "Google Research", type: "rss" },
    { url: "https://huggingface.co/blog/feed.xml",        name: "Hugging Face",    type: "rss" },
    { url: "https://machinelearning.apple.com/rss.xml",   name: "Apple ML",        type: "rss" },

    { url: "https://techcrunch.com/category/artificial-intelligence/feed/",        name: "TechCrunch",      type: "rss" },
    { url: "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml",    name: "The Verge",       type: "rss" },
    { url: "https://venturebeat.com/ai/feed/",                                     name: "VentureBeat",     type: "rss" },
    { url: "https://www.wired.com/feed/category/artificial-intelligence/latest/rss", name: "Wired AI",      type: "rss" },
    { url: "https://www.technologyreview.com/topic/artificial-intelligence/feed/", name: "MIT Tech Review", type: "rss" },

    {
      url:  "https://hn.algolia.com/api/v1/search_by_date?query=AI%20LLM%20GPT%20Claude%20Gemini%20OpenAI%20Anthropic&tags=story&hitsPerPage=30",
      name: "Hacker News",
      type: "hn",
    },
    {
      url:  "https://hn.algolia.com/api/v1/search_by_date?query=AI&tags=show_hn&hitsPerPage=20",
      name: "Show HN",
      type: "hn",
    },

    { url: "https://www.ycombinator.com/blog/rss", name: "YC Blog", type: "rss" },
    {
      url:  "https://hn.algolia.com/api/v1/search_by_date?query=YC%20startup%20launch%20founder&tags=story&hitsPerPage=20",
      name: "HN: YC",
      type: "hn",
    },

    { url: "https://www.reddit.com/r/MachineLearning/.rss?limit=25", name: "r/MachineLearning", type: "rss" },
    { url: "https://www.reddit.com/r/singularity/.rss?limit=25",     name: "r/singularity",     type: "rss" },
    { url: "https://www.reddit.com/r/LocalLLaMA/.rss?limit=25",      name: "r/LocalLLaMA",      type: "rss" },
  ],

  FETCH_INTERVAL_MIN:  5,
  RECENCY_WINDOW_MS:   2 * 24 * 60 * 60 * 1000,
  FETCH_TIMEOUT_MS:    10000,
  RETRY_DELAY_MS:      3000,
  DEDUP_WINDOW_MS:     6 * 60 * 60 * 1000,   // 6 hrs — max gap for same-story merging
  DEDUP_SIMILARITY:    0.5,                   // title word-overlap threshold
  ALARM_NAME:          "fetch-ai-news",
};

const ACCEPT_HEADER = "application/rss+xml, application/atom+xml, application/xml, text/xml, application/json, */*";

// ── Story type classifier ─────────────────────────────────────────────────────
// Maps a headline to one of 5 types. Used to drive background color in the UI.

const STORY_TYPES = {
  launch: [
    "released", "releases", "launches", "launch", "introducing", "announce", "announced",
    "new model", "available now", "shipping", "ships", "drops", "just launched", "preview",
    "gpt-", "claude ", "gemini ", "llama ", "mistral ", "grok ", "phi-", "o1", "o3",
  ],
  research: [
    "paper", "research", "study", "arxiv", "we show", "benchmark", "findings",
    "survey", "dataset", "evaluation", "novel", "outperforms", "we propose",
    "technical report", "scaling", "emergent",
  ],
  funding: [
    "raises", "raised", "funding", "valuation", "acquires", "acquisition",
    "billion", "million", "series a", "series b", "series c", "seed round",
    "investment", "investor", "backed", "ipo", "unicorn",
  ],
  drama: [
    "fired", "lawsuit", "safety concern", "banned", "breach", "leak", "resigns",
    "resignation", "controversy", "accuses", "warning", "danger", "risk",
    "backlash", "criticism", "scandal", "under fire", "dispute", "regulatory",
    "ftc", "gdpr", "antitrust", "blocked", "banned",
  ],
  opensource: [
    "open source", "open-source", "open weights", "github", "weights released",
    "mit license", "apache license", "gguf", "ollama", "hugging face release",
    "open model", "free model",
  ],
};

function classifyStory(title) {
  const t = title.toLowerCase();
  for (const [type, keywords] of Object.entries(STORY_TYPES)) {
    if (keywords.some((kw) => t.includes(kw))) return type;
  }
  return "default";
}

// ── Signal score ──────────────────────────────────────────────────────────────
// 0–100. Higher = more important right now.
// Components: source tier + cross-source coverage + HN points + recency

const SOURCE_TIERS = {
  "OpenAI":            15,
  "OpenAI Research":   15,
  "Anthropic News":    15,
  "Anthropic Research":15,
  "Anthropic Eng":     12,
  "Claude Code":       13,
  "Google AI":         12,
  "Google Research":   12,
  "xAI":               10,
  "Hugging Face":      10,
  "The Batch":         10,
  "Paul Graham":       15,
  "YC Blog":           10,
  "Hacker News":        7,
  "Show HN":            7,
  "HN: YC":             7,
  "TechCrunch":         5,
  "The Verge":          5,
  "VentureBeat":        5,
  "Wired AI":           5,
  "MIT Tech Review":    7,
  "Cursor":             8,
  "Ollama":             8,
  "Windsurf":           6,
};

function computeScore(item) {
  const tier      = SOURCE_TIERS[item.source_name] ?? 3;
  const crossBonus = Math.min((item.cross_source_count - 1) * 15, 35);
  const hnPts     = Math.min(Math.round((item.hn_points || 0) * 0.08), 20);

  const ageHr = (Date.now() - new Date(item.published_at).getTime()) / 3_600_000;
  const recency = ageHr < 1 ? 25 : ageHr < 3 ? 18 : ageHr < 12 ? 10 : ageHr < 24 ? 5 : 0;

  return Math.min(Math.round(tier + crossBonus + hnPts + recency), 100);
}

// ── Smart dedup — title similarity ────────────────────────────────────────────
// Groups stories covering the same event from different sources.
// Each group collapses into one story with all source names merged.

const STOPWORDS = new Set([
  "the","a","an","and","or","but","in","on","at","to","for","of","with",
  "is","are","was","were","has","have","its","it","this","that","by","from",
  "as","be","been","will","can","could","how","what","when","why","who",
]);

function tokenize(title) {
  return title.toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

function similarity(a, b) {
  const sa = new Set(tokenize(a));
  const sb = new Set(tokenize(b));
  const shared = [...sa].filter((w) => sb.has(w)).length;
  const denom  = Math.max(sa.size, sb.size);
  return denom === 0 ? 0 : shared / denom;
}

function smartDedup(items) {
  const assigned = new Set();
  const groups   = [];

  for (let i = 0; i < items.length; i++) {
    if (assigned.has(i)) continue;
    const group = [i];
    assigned.add(i);

    for (let j = i + 1; j < items.length; j++) {
      if (assigned.has(j)) continue;
      const timeDiff = Math.abs(
        new Date(items[i].published_at).getTime() -
        new Date(items[j].published_at).getTime()
      );
      if (timeDiff > CONFIG.DEDUP_WINDOW_MS) continue;
      if (similarity(items[i].title, items[j].title) >= CONFIG.DEDUP_SIMILARITY) {
        group.push(j);
        assigned.add(j);
      }
    }

    groups.push(group.map((idx) => items[idx]));
  }

  return groups.map((group) => {
    if (group.length === 1) {
      return { ...group[0], cross_source_count: 1, all_sources: [group[0].source_name] };
    }

    // Earliest published_at wins as the canonical story
    group.sort(
      (a, b) => new Date(a.published_at).getTime() - new Date(b.published_at).getTime()
    );
    const primary     = group[0];
    const allSources  = [...new Set(group.map((s) => s.source_name))];
    const maxHnPoints = Math.max(...group.map((s) => s.hn_points || 0));

    return {
      ...primary,
      all_sources:        allSources,
      source_name:        allSources[0],
      cross_source_count: allSources.length,
      hn_points:          maxHnPoints,
    };
  });
}

// ── Regex XML parser ──────────────────────────────────────────────────────────

function decodeEntities(str) {
  return str
    .replace(/&amp;/g,  "&")
    .replace(/&lt;/g,   "<")
    .replace(/&gt;/g,   ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g,        (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

function getBlocks(xml, tag) {
  const re = new RegExp(`<${tag}[\\s>][\\s\\S]*?<\\/${tag}>`, "gi");
  return xml.match(re) || [];
}

function getTagText(block, tag) {
  const cdataRe = new RegExp(
    `<${tag}(?:\\s[^>]*)?>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*<\\/${tag}>`, "i"
  );
  let m = block.match(cdataRe);
  if (m) return m[1].trim();
  const plainRe = new RegExp(`<${tag}(?:\\s[^>]*)?>([^<]*)<\\/${tag}>`, "i");
  m = block.match(plainRe);
  if (m) return decodeEntities(m[1].trim());
  return "";
}

function getAttr(block, tag, attr) {
  const re = new RegExp(`<${tag}[^>]*\\s${attr}=["']([^"']*)["'][^>]*/?>`, "i");
  const m  = block.match(re);
  return m ? m[1].trim() : "";
}

// ── Feed parsers ──────────────────────────────────────────────────────────────

function parseRSS(text, sourceName) {
  const items = [];

  const entries = getBlocks(text, "entry");
  if (entries.length > 0) {
    for (const entry of entries) {
      const title   = getTagText(entry, "title");
      const url     = getAttr(entry, "link", "href") || getTagText(entry, "link");
      const rawDate = getTagText(entry, "published") || getTagText(entry, "updated");
      const published_at = rawDate && !isNaN(Date.parse(rawDate))
        ? new Date(rawDate).toISOString() : null;
      if (title && url && published_at) {
        items.push({ title, url, source_name: sourceName, published_at, hn_points: 0 });
      }
    }
    console.log(`[AI Tab] ${sourceName}: ${items.length} Atom entries`);
    return items;
  }

  const rssItems = getBlocks(text, "item");
  for (const item of rssItems) {
    const title = getTagText(item, "title");
    let url     = getTagText(item, "link");
    if (!url) {
      const guid = getTagText(item, "guid");
      if (/^https?:\/\//.test(guid)) url = guid;
    }
    const rawDate = getTagText(item, "pubDate") || getTagText(item, "pubdate") || getTagText(item, "dc:date");
    const published_at = rawDate && !isNaN(Date.parse(rawDate))
      ? new Date(rawDate).toISOString() : null;
    if (title && url && published_at) {
      items.push({ title, url, source_name: sourceName, published_at, hn_points: 0 });
    }
  }

  console.log(`[AI Tab] ${sourceName}: ${items.length} RSS items`);
  return items;
}

function parseHN(jsonText, sourceName) {
  let data;
  try { data = JSON.parse(jsonText); }
  catch (e) { console.error("[AI Tab] HN JSON parse failed:", e.message); return []; }

  const items = [];
  for (const hit of (data.hits || [])) {
    const title       = hit.title;
    const url         = hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`;
    const hn_points   = hit.points || 0;
    const rawDate     = hit.created_at;
    const published_at = rawDate && !isNaN(Date.parse(rawDate))
      ? new Date(rawDate).toISOString() : null;
    if (title && url && published_at) {
      items.push({ title, url, source_name: sourceName, published_at, hn_points });
    }
  }

  console.log(`[AI Tab] ${sourceName}: ${items.length} HN stories`);
  return items;
}

// ── Fetch with timeout ────────────────────────────────────────────────────────

async function fetchWithTimeout(url, timeoutMs, extraHeaders = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  console.log("[AI Tab] Fetching:", url.substring(0, 80));
  try {
    const response = await fetch(url, {
      signal:  controller.signal,
      headers: { "Accept": ACCEPT_HEADER, ...extraHeaders },
    });
    console.log("[AI Tab]", response.status, url.substring(0, 60));
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

// ── Per-feed fetch + parse ────────────────────────────────────────────────────

async function fetchFeed(feed) {
  const headers = feed.headers || {};
  let text;
  try {
    text = await fetchWithTimeout(feed.url, CONFIG.FETCH_TIMEOUT_MS, headers);
  } catch (err) {
    console.warn(`[AI Tab] ${feed.name} failed (${err.message}), retrying…`);
    await new Promise((r) => setTimeout(r, CONFIG.RETRY_DELAY_MS));
    try {
      text = await fetchWithTimeout(feed.url, CONFIG.FETCH_TIMEOUT_MS, headers);
    } catch (retryErr) {
      console.error(`[AI Tab] ${feed.name} retry failed: ${retryErr.message}`);
      return { items: [], ok: false };
    }
  }

  try {
    const parser = feed.type === "hn" ? parseHN : parseRSS;
    const items  = parser(text, feed.name);
    if (items.length === 0) {
      console.warn(`[AI Tab] ${feed.name}: 0 items — snippet:`,
        text.substring(0, 200).replace(/\s+/g, " "));
    }
    return { items, ok: true };
  } catch (e) {
    console.error(`[AI Tab] ${feed.name} parse threw:`, e.message);
    return { items: [], ok: false };
  }
}

// ── Main orchestrator ─────────────────────────────────────────────────────────

async function fetchAllFeeds() {
  console.log("[AI Tab] === Fetching", CONFIG.feeds.length, "feeds ===");

  const results = await Promise.allSettled(CONFIG.feeds.map(fetchFeed));

  let liveSources = 0;
  const allItems  = [];

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.status === "fulfilled") {
      if (r.value.ok) liveSources++;
      allItems.push(...r.value.items);
    } else {
      console.error(`[AI Tab] ${CONFIG.feeds[i].name} rejected:`, r.reason);
    }
  }

  console.log("[AI Tab] Total raw:", allItems.length, "| Live sources:", liveSources);

  // Filter to recency window
  const cutoff = Date.now() - CONFIG.RECENCY_WINDOW_MS;
  const recent = allItems.filter(
    (item) => new Date(item.published_at).getTime() >= cutoff
  );
  console.log("[AI Tab] Within 2d window:", recent.length);

  // URL-based dedup first (fast — catches identical articles)
  const urlSeen  = new Set();
  const urlDeduped = [];
  for (const item of recent) {
    if (!urlSeen.has(item.url)) {
      urlSeen.add(item.url);
      urlDeduped.push(item);
    }
  }

  // Title-similarity dedup (merges cross-source coverage of same story)
  const deduped = smartDedup(urlDeduped);
  console.log("[AI Tab] After smart dedup:", deduped.length, "stories");

  // Enrich each story with type + score
  const enriched = deduped.map((item) => ({
    ...item,
    story_type: classifyStory(item.title),
    score:      computeScore(item),
  }));

  // Sort: score descending (recency is already baked into score)
  enriched.sort((a, b) => b.score - a.score);

  console.log("[AI Tab] Final:", enriched.length, "stories — top score:",
    enriched[0]?.score, enriched[0]?.title?.substring(0, 60));

  if (enriched.length === 0) {
    console.warn("[AI Tab] Empty result — keeping cache.");
    const { stories } = await chrome.storage.local.get(["stories"]);
    if (stories?.length) await chrome.storage.local.set({ last_fetched: Date.now(), live_sources: liveSources });
    return;
  }

  await chrome.storage.local.set({
    stories:       enriched,
    last_fetched:  Date.now(),
    current_index: 0,
    live_sources:  liveSources,
    total_stories: enriched.length,
  });
  console.log("[AI Tab] Saved", enriched.length, "stories.");
}

// ── Alarm ─────────────────────────────────────────────────────────────────────

function ensureAlarm() {
  chrome.alarms.get(CONFIG.ALARM_NAME, (alarm) => {
    if (!alarm) {
      chrome.alarms.create(CONFIG.ALARM_NAME, { periodInMinutes: CONFIG.FETCH_INTERVAL_MIN });
      console.log("[AI Tab] Alarm created.");
    }
  });
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === "install") {
    console.log("[AI Tab] First install — setting up.");
    chrome.storage.local.set({ onboarding_done: false });
  } else {
    console.log("[AI Tab] Update — clearing stale cache.");
    chrome.storage.local.remove(["stories", "current_index", "live_sources", "total_stories"]);
  }
  ensureAlarm();
  fetchAllFeeds();
});

chrome.runtime.onStartup.addListener(() => {
  console.log("[AI Tab] onStartup.");
  ensureAlarm();
  fetchAllFeeds();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === CONFIG.ALARM_NAME) fetchAllFeeds();
});

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "fetch-now") {
    console.log("[AI Tab] Manual fetch.");
    fetchAllFeeds();
  }
});
