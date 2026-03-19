(() => {
  "use strict";

  const STALE_THRESHOLD_MS = 15 * 60 * 1000;

  // ── Source groups for mixing board ────────────────────────────────────────
  const SOURCE_GROUPS = [
    { label: "AI Labs", sources: ["OpenAI", "OpenAI Research", "Anthropic News", "Anthropic Research", "Anthropic Eng", "Claude Code", "Google AI", "Google Research", "xAI", "Hugging Face", "Apple ML"] },
    { label: "Tools",   sources: ["Cursor", "Ollama", "Windsurf"] },
    { label: "News",    sources: ["TechCrunch", "The Verge", "VentureBeat", "Wired AI", "MIT Tech Review"] },
    { label: "Newsletters", sources: ["The Batch", "Paul Graham"] },
    { label: "Hacker News", sources: ["Hacker News", "Show HN", "HN: YC", "YC Blog"] },
    { label: "Reddit",  sources: ["r/MachineLearning", "r/singularity", "r/LocalLLaMA"] },
  ];

  const ALL_SOURCES = SOURCE_GROUPS.flatMap((g) => g.sources);

  // ── DOM refs ──────────────────────────────────────────────────────────────
  const stateLoading    = document.getElementById("state-loading");
  const stateEmpty      = document.getElementById("state-empty");
  const stateStory      = document.getElementById("state-story");
  const bottomBar       = document.getElementById("bottom-bar");

  const headlineEl      = document.getElementById("headline");
  const sourceEl        = document.getElementById("source-badge");
  const timeAgoEl       = document.getElementById("time-ago");
  const typePillEl      = document.getElementById("story-type-pill");
  const storyContent    = document.getElementById("story-content");

  const lastFetchedEl   = document.getElementById("last-fetched");
  const staleWarningEl  = document.getElementById("stale-warning");
  const storyCounterEl  = document.getElementById("story-counter");
  const scoreNumberEl   = document.getElementById("score-number");
  const signalScoreEl   = document.getElementById("signal-score");

  const btnPrev         = document.getElementById("btn-prev");
  const btnNext         = document.getElementById("btn-next");
  const btnRefresh      = document.getElementById("btn-refresh");
  const btnRefreshEmpty = document.getElementById("btn-refresh-empty");
  const btnList         = document.getElementById("btn-list");
  const btnMixing       = document.getElementById("btn-mixing");

  const saveToast       = document.getElementById("save-toast");

  const filterBar       = document.getElementById("filter-bar");
  const filterInput     = document.getElementById("filter-input");
  const filterCount     = document.getElementById("filter-count");
  const btnClearFilter  = document.getElementById("btn-clear-filter");

  const readingSidebar  = document.getElementById("reading-sidebar");
  const sidebarItems    = document.getElementById("sidebar-items");
  const sidebarEmptyMsg = document.getElementById("sidebar-empty-msg");
  const btnExportMd     = document.getElementById("btn-export-md");
  const btnCloseSidebar = document.getElementById("btn-close-sidebar");

  const mixingBoard     = document.getElementById("mixing-board");
  const mixingGroups    = document.getElementById("mixing-groups");
  const btnCloseMixing  = document.getElementById("btn-close-mixing");
  const btnResetSources = document.getElementById("btn-reset-sources");

  const onboardingEl     = document.getElementById("onboarding");
  const obStep1          = document.getElementById("ob-step-1");
  const obStep2          = document.getElementById("ob-step-2");
  const obStep3          = document.getElementById("ob-step-3");
  const obSourceGroupsEl = document.getElementById("ob-source-groups");

  const ambientLineEl    = document.getElementById("ambient-line");

  const mapOverlay       = document.getElementById("map-overlay");
  const mapCanvas        = document.getElementById("map-canvas");
  const mapTooltipEl     = document.getElementById("map-tooltip");
  const mapCountEl       = document.getElementById("map-count");
  const btnCloseMap      = document.getElementById("btn-close-map");

  const briefingOverlay  = document.getElementById("briefing-overlay");
  const briefingHeaderEl = document.getElementById("briefing-header");
  const briefingBodyEl   = document.getElementById("briefing-body");

  const timelineBar     = document.getElementById("timeline-bar");
  const timelineTrack   = document.getElementById("timeline-track");
  const timelineDots    = document.getElementById("timeline-dots");
  const timelineCursor  = document.getElementById("timeline-cursor");
  const timelineTooltip = document.getElementById("timeline-tooltip");

  // ── App state ─────────────────────────────────────────────────────────────
  let stories        = [];
  let displayStories = [];   // stories after mute/weight applied
  let currentIndex   = 0;
  let lastFetched    = null;
  let liveSources    = 0;
  let totalStories   = 0;

  let readingList    = [];
  let sourceSettings = {};   // { [sourceName]: { weight: 0-100, muted: bool } }

  let activeFilter    = "";
  let filteredStories = [];
  let sidebarOpen     = false;
  let filterOpen      = false;
  let mixingOpen      = false;

  const TIMELINE_HOURS   = 48;
  const IDLE_TIMEOUT_MS  = 60_000;
  const AMBIENT_ADVANCE_MS = 15_000;

  let timedStories      = []; // { story, ts } pairs within 48hr window
  let obSourceState     = {}; // { groupLabel: true|false }
  let mapOpen           = false;
  let mapNodes          = [];
  let mapSims           = [];
  let ambientActive     = false;
  let ambientAdvTimer   = null;
  let idleTimer         = null;
  let briefingOpen      = false;

  // ── Default source settings ───────────────────────────────────────────────

  function defaultSettings() {
    const s = {};
    for (const name of ALL_SOURCES) s[name] = { weight: 100, muted: false };
    return s;
  }

  function getSourceSetting(name) {
    return sourceSettings[name] ?? { weight: 100, muted: false };
  }

  // ── Compute displayStories from raw stories + settings ────────────────────

  function recomputeDisplay() {
    displayStories = stories
      .filter((s) => !getSourceSetting(s.source_name).muted)
      .map((s) => {
        const w = getSourceSetting(s.source_name).weight;
        return { ...s, _wscore: (s.score ?? 50) * (w / 100) };
      })
      .sort((a, b) => b._wscore - a._wscore);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  function timeAgo(isoString) {
    const ms  = Date.now() - new Date(isoString).getTime();
    const sec = Math.floor(ms / 1000);
    if (sec < 60)  return "just now";
    const min = Math.floor(sec / 60);
    if (min < 60)  return `${min}m`;
    const hr = Math.floor(min / 60);
    if (hr < 24)   return `${hr}h`;
    const days = Math.floor(hr / 24);
    return `${days}d`;
  }

  function formatLastFetched(ts) {
    if (!ts) return "";
    const min = Math.floor((Date.now() - ts) / 60000);
    if (min < 1)   return "just updated";
    if (min === 1) return "1 min ago";
    return `${min} min ago`;
  }

  function show(el) { el.classList.remove("hidden"); }
  function hide(el) { el.classList.add("hidden"); }
  function setActiveState(s) { hide(stateLoading); hide(stateEmpty); hide(stateStory); show(s); }

  function activeStories() {
    return activeFilter ? filteredStories : displayStories;
  }

  const TYPE_LABELS = {
    launch: "launch", research: "research", funding: "funding",
    drama: "developing", opensource: "open source", default: "",
  };

  // ── Background + score ────────────────────────────────────────────────────

  function applyStoryType(type) {
    document.body.dataset.storyType = type || "default";
  }

  function renderScore(score) {
    if (score == null) { hide(signalScoreEl); return; }
    show(signalScoreEl);
    scoreNumberEl.textContent = score;
    scoreNumberEl.dataset.tier =
      score >= 86 ? "peak" : score >= 61 ? "high" : score >= 31 ? "mid" : "low";
  }

  // ── Story render ──────────────────────────────────────────────────────────

  function renderStory(index) {
    const pool  = activeStories();
    const story = pool[index];
    if (!story) return;

    headlineEl.textContent = story.title;
    headlineEl.href        = story.url;
    timeAgoEl.textContent  = timeAgo(story.published_at);

    const sources = story.all_sources?.length > 1
      ? story.all_sources.join(" · ")
      : story.source_name;
    sourceEl.textContent = sources;

    typePillEl.textContent = TYPE_LABELS[story.story_type] || "";
    applyStoryType(story.story_type);
    renderScore(story.score);
    highlightActiveDot(story);
  }

  function highlightActiveDot(story) {
    const dots = timelineDots.children;
    for (let i = 0; i < dots.length; i++) {
      const isActive = timedStories[i]?.story === story;
      dots[i].classList.toggle("active-dot", isActive);
    }
  }

  // ── Bottom bar ────────────────────────────────────────────────────────────

  function renderBottomBar() {
    if (lastFetched === null) { hide(bottomBar); return; }
    show(bottomBar);
    lastFetchedEl.textContent = formatLastFetched(lastFetched);

    const mutedCount = ALL_SOURCES.filter((s) => getSourceSetting(s).muted).length;
    const activeSrc  = ALL_SOURCES.length - mutedCount;
    const total      = displayStories.length;
    storyCounterEl.textContent =
      `${total} stories · ${liveSources} live` +
      (mutedCount > 0 ? ` · ${mutedCount} muted` : "");

    const isStale = (Date.now() - lastFetched) > STALE_THRESHOLD_MS;
    if (isStale) {
      staleWarningEl.textContent = `⚠ stale · ${Math.floor((Date.now() - lastFetched) / 60000)} min`;
      show(staleWarningEl);
    } else {
      hide(staleWarningEl);
    }
  }

  // ── Full render ───────────────────────────────────────────────────────────

  function render() {
    renderBottomBar();
    renderTimeline();
    const pool = activeStories();
    if (pool.length === 0) {
      applyStoryType("default");
      hide(signalScoreEl);
      setActiveState(stateEmpty);
      return;
    }
    if (currentIndex >= pool.length) currentIndex = 0;
    renderStory(currentIndex);
    setActiveState(stateStory);
  }

  // ── Fade transition ───────────────────────────────────────────────────────

  async function transitionToStory(newIndex) {
    const pool = activeStories();
    if (pool.length === 0) return;

    storyContent.classList.add("fade-out");
    storyContent.classList.remove("fade-in");
    await new Promise((r) => setTimeout(r, 200));

    currentIndex = ((newIndex % pool.length) + pool.length) % pool.length;
    renderStory(currentIndex);

    storyContent.classList.remove("fade-out");
    storyContent.classList.add("fade-in");
    chrome.storage.local.set({ current_index: currentIndex });
    if (ambientActive) updateAmbientLine();
  }

  // ── Load from storage ─────────────────────────────────────────────────────

  async function loadFromStorage() {
    const data = await chrome.storage.local.get([
      "stories", "current_index", "last_fetched",
      "live_sources", "total_stories", "reading_list", "source_settings",
      "onboarding_done",
    ]);

    stories        = data.stories        ?? [];
    currentIndex   = data.current_index  ?? 0;
    lastFetched    = data.last_fetched   ?? null;
    liveSources    = data.live_sources   ?? 0;
    totalStories   = data.total_stories  ?? 0;
    readingList    = data.reading_list   ?? [];
    sourceSettings = data.source_settings ?? defaultSettings();

    recomputeDisplay();
    if (currentIndex >= displayStories.length) currentIndex = 0;
    render();

    // First-time onboarding — only when explicitly set false by onInstalled
    if (data.onboarding_done === false) showOnboarding();
  }

  // ── Filter ────────────────────────────────────────────────────────────────

  function openFilter() {
    filterOpen = true;
    show(filterBar);
    filterInput.focus();
  }

  function closeFilter() {
    filterOpen      = false;
    activeFilter    = "";
    filteredStories = [];
    filterInput.value = "";
    hide(filterBar);
    currentIndex = 0;
    render();
  }

  function applyFilter(query) {
    activeFilter = query.trim().toLowerCase();
    if (!activeFilter) { filteredStories = []; filterCount.textContent = ""; currentIndex = 0; render(); return; }
    filteredStories = displayStories.filter((s) =>
      s.title.toLowerCase().includes(activeFilter) ||
      s.source_name.toLowerCase().includes(activeFilter) ||
      (s.all_sources || []).some((src) => src.toLowerCase().includes(activeFilter))
    );
    filterCount.textContent = `${filteredStories.length} result${filteredStories.length !== 1 ? "s" : ""}`;
    currentIndex = 0;
    render();
  }

  filterInput.addEventListener("input", () => applyFilter(filterInput.value));
  btnClearFilter.addEventListener("click", closeFilter);

  // ── Reading list ──────────────────────────────────────────────────────────

  async function saveStory() {
    const story = activeStories()[currentIndex];
    if (!story) return;
    if (readingList.some((i) => i.url === story.url)) { showToast("already in your list."); return; }

    const isFirst = readingList.length === 0;
    readingList.unshift({
      title: story.title, url: story.url,
      source_name: story.source_name, all_sources: story.all_sources ?? [story.source_name],
      published_at: story.published_at, story_type: story.story_type,
      score: story.score, saved_at: Date.now(),
    });
    await chrome.storage.local.set({ reading_list: readingList });

    storyContent.classList.remove("save-pulse");
    void storyContent.offsetWidth;
    storyContent.classList.add("save-pulse");
    showToast(isFirst ? "saved. press L to open your reading list." : "saved.");
  }

  function showToast(msg) {
    saveToast.textContent = msg;
    saveToast.classList.remove("hidden");
    saveToast.classList.add("show");
    setTimeout(() => {
      saveToast.classList.remove("show");
      setTimeout(() => saveToast.classList.add("hidden"), 200);
    }, 1400);
  }

  async function deleteFromList(url) {
    readingList = readingList.filter((i) => i.url !== url);
    await chrome.storage.local.set({ reading_list: readingList });
    renderSidebar();
  }

  // ── Reading list sidebar ──────────────────────────────────────────────────

  function openSidebar()  { sidebarOpen = true;  readingSidebar.classList.add("open"); document.body.classList.add("sidebar-open"); renderSidebar(); }
  function closeSidebar() { sidebarOpen = false; readingSidebar.classList.remove("open"); document.body.classList.remove("sidebar-open"); }
  function toggleSidebar() { sidebarOpen ? closeSidebar() : openSidebar(); }

  function renderSidebar() {
    sidebarItems.innerHTML = "";
    if (readingList.length === 0) { show(sidebarEmptyMsg); return; }
    hide(sidebarEmptyMsg);
    for (const item of readingList) {
      const el = document.createElement("div");
      el.className = "sidebar-item";
      const sources = item.all_sources?.length > 1 ? item.all_sources.join(" · ") : item.source_name;
      el.innerHTML = `
        <div class="item-body">
          <div class="item-title">${escapeHtml(item.title)}</div>
          <div class="item-meta">${escapeHtml(sources)} · ${timeAgo(item.saved_at)}</div>
        </div>
        <button class="item-delete" data-url="${escapeHtml(item.url)}">✕</button>`;
      el.querySelector(".item-body").addEventListener("click", () => { window.location.href = item.url; });
      el.querySelector(".item-delete").addEventListener("click", (e) => { e.stopPropagation(); deleteFromList(item.url); });
      sidebarItems.appendChild(el);
    }
  }

  function escapeHtml(str) {
    return str.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }

  function exportMarkdown() {
    if (readingList.length === 0) { showToast("list is empty"); return; }
    const date  = new Date().toLocaleDateString("en-US", { year:"numeric", month:"long", day:"numeric" });
    const lines = [`# refresh — reading list — ${date}`, `*by ohm.*`, ""];
    for (const item of readingList) {
      lines.push(`## ${item.title}`, `- **Source:** ${item.all_sources?.join(", ") ?? item.source_name}`, `- **Saved:** ${timeAgo(item.saved_at)}`, `- **URL:** ${item.url}`, "");
    }
    navigator.clipboard.writeText(lines.join("\n"))
      .then(() => showToast("copied!"))
      .catch(() => showToast("copy failed"));
  }

  btnCloseSidebar.addEventListener("click", closeSidebar);
  btnList.addEventListener("click", toggleSidebar);
  btnExportMd.addEventListener("click", exportMarkdown);

  // ── Mixing board ──────────────────────────────────────────────────────────

  function openMixing()  { mixingOpen = true;  show(mixingBoard); renderMixingBoard(); }
  function closeMixing() { mixingOpen = false; hide(mixingBoard); }
  function toggleMixing() { mixingOpen ? closeMixing() : openMixing(); }

  function renderMixingBoard() {
    mixingGroups.innerHTML = "";

    for (const group of SOURCE_GROUPS) {
      const groupEl = document.createElement("div");
      groupEl.className = "mixing-group";

      const labelEl = document.createElement("div");
      labelEl.className = "mixing-group-label";
      labelEl.textContent = group.label;
      groupEl.appendChild(labelEl);

      for (const sourceName of group.sources) {
        const settings = getSourceSetting(sourceName);
        const row = document.createElement("div");
        row.className = "source-row" + (settings.muted ? " muted" : "");
        row.dataset.source = sourceName;

        row.innerHTML = `
          <span class="source-name">${escapeHtml(sourceName)}</span>
          <input type="range" class="weight-slider" min="0" max="100"
                 value="${settings.weight}" style="--pct:${settings.weight}%">
          <span class="weight-value">${settings.weight}</span>
          <button class="mute-btn ${settings.muted ? "muted" : ""}" data-source="${escapeHtml(sourceName)}">
            ${settings.muted ? "off" : "on"}
          </button>`;

        // Slider input → update weight live
        const slider   = row.querySelector(".weight-slider");
        const valLabel = row.querySelector(".weight-value");

        slider.addEventListener("input", () => {
          const v = parseInt(slider.value);
          slider.style.setProperty("--pct", v + "%");
          valLabel.textContent = v;
          updateSourceSetting(sourceName, { weight: v });
        });

        // Mute button
        const muteBtn = row.querySelector(".mute-btn");
        muteBtn.addEventListener("click", () => {
          const current = getSourceSetting(sourceName).muted;
          const next    = !current;
          updateSourceSetting(sourceName, { muted: next });
          muteBtn.textContent = next ? "off" : "on";
          muteBtn.classList.toggle("muted", next);
          row.classList.toggle("muted", next);
        });

        groupEl.appendChild(row);
      }

      mixingGroups.appendChild(groupEl);
    }
  }

  // Debounced save — don't hammer storage on every slider pixel
  let settingsSaveTimer = null;

  function updateSourceSetting(sourceName, patch) {
    sourceSettings[sourceName] = { ...getSourceSetting(sourceName), ...patch };
    recomputeDisplay();
    if (activeFilter) applyFilter(activeFilter);
    else render();

    clearTimeout(settingsSaveTimer);
    settingsSaveTimer = setTimeout(() => {
      chrome.storage.local.set({ source_settings: sourceSettings });
    }, 300);
  }

  async function resetAllSources() {
    sourceSettings = defaultSettings();
    await chrome.storage.local.set({ source_settings: sourceSettings });
    recomputeDisplay();
    render();
    renderMixingBoard();
    showToast("reset");
  }

  btnCloseMixing.addEventListener("click", closeMixing);
  btnMixing.addEventListener("click", toggleMixing);
  btnResetSources.addEventListener("click", resetAllSources);

  // Close mixing board on backdrop click
  mixingBoard.addEventListener("click", (e) => {
    if (e.target === mixingBoard) closeMixing();
  });

  // ── Onboarding ────────────────────────────────────────────────────────────

  function showObStep(n) {
    [obStep1, obStep2, obStep3].forEach((el, i) => {
      const active = i + 1 === n;
      el.classList.toggle("hidden", !active);
      // Re-trigger fade animation when becoming visible
      if (active) { el.style.animation = "none"; void el.offsetWidth; el.style.animation = ""; }
    });
  }

  function renderObSources() {
    obSourceGroupsEl.innerHTML = "";
    for (const g of SOURCE_GROUPS) {
      const on      = obSourceState[g.label] !== false;
      const row     = document.createElement("div");
      row.className = "ob-source-row" + (on ? "" : " off");
      row.dataset.group = g.label;

      const preview = g.sources.slice(0, 5).join(" · ") +
        (g.sources.length > 5 ? ` +${g.sources.length - 5} more` : "");

      row.innerHTML = `
        <span class="ob-toggle">${on ? "◉" : "○"}</span>
        <span class="ob-source-label">${escapeHtml(g.label)}</span>
        <span class="ob-source-preview">${escapeHtml(preview)}</span>`;

      row.addEventListener("click", () => {
        obSourceState[g.label] = !obSourceState[g.label];
        renderObSources();
      });

      obSourceGroupsEl.appendChild(row);
    }
  }

  function showOnboarding() {
    // Init all groups as on
    for (const g of SOURCE_GROUPS) obSourceState[g.label] = true;
    show(onboardingEl);
    showObStep(1);
    renderObSources();
  }

  async function finishOnboarding() {
    for (const g of SOURCE_GROUPS) {
      const on = obSourceState[g.label] !== false;
      for (const src of g.sources) {
        sourceSettings[src] = { ...getSourceSetting(src), muted: !on };
      }
    }
    await chrome.storage.local.set({ onboarding_done: true, source_settings: sourceSettings });
    hide(onboardingEl);
    recomputeDisplay();
    render();
    triggerRefresh();
  }

  async function skipOnboarding() {
    await chrome.storage.local.set({ onboarding_done: true });
    hide(onboardingEl);
    render();
    triggerRefresh();
  }

  // Step navigation
  document.getElementById("ob-next-1").addEventListener("click", () => showObStep(2));
  document.getElementById("ob-next-2").addEventListener("click", () => showObStep(3));
  document.getElementById("ob-next-3").addEventListener("click", finishOnboarding);
  document.getElementById("ob-skip-3").addEventListener("click", skipOnboarding);
  document.getElementById("ob-back-2").addEventListener("click", () => showObStep(1));
  document.getElementById("ob-back-3").addEventListener("click", () => showObStep(2));

  // ── Map (M key) ───────────────────────────────────────────────────────────

  const TYPE_DOT_COLORS = {
    launch: "#4466ee", research: "#8844cc", funding: "#339966",
    opensource: "#cc8833", drama: "#cc3333", default: "#555",
  };

  const TYPE_SEED = {
    launch:     [0.68, 0.28], research: [0.50, 0.20],
    funding:    [0.28, 0.50], opensource: [0.68, 0.68],
    drama:      [0.28, 0.70], default: [0.50, 0.50],
  };

  const MAP_STOP = new Set([
    "with","that","this","from","have","will","been","says","said","they",
    "their","about","after","into","over","also","just","more","than","what",
    "when","where","which","while","using","makes","report","shows","finds",
    "could","would","should","like","some","here","there","your","first",
  ]);

  function tokMap(title) {
    return title.toLowerCase().replace(/[^a-z0-9\s]/g," ").split(/\s+/)
      .filter((w) => w.length > 3 && !MAP_STOP.has(w));
  }

  function simPair(a, b) {
    const sa = new Set(tokMap(a));
    const sb = new Set(tokMap(b));
    if (!sa.size || !sb.size) return 0;
    let n = 0;
    for (const w of sa) if (sb.has(w)) n++;
    return n / Math.min(sa.size, sb.size);
  }

  function computeLayout(stories, W, H) {
    const N = stories.length;
    const nodes = stories.map((s) => {
      const [cx, cy] = TYPE_SEED[s.story_type] || TYPE_SEED.default;
      return {
        x:  cx * W + (Math.random() - 0.5) * W * 0.28,
        y:  cy * H + (Math.random() - 0.5) * H * 0.28,
        vx: 0, vy: 0, story: s,
      };
    });

    const sims = Array.from({ length: N }, (_, i) =>
      Array.from({ length: N }, (_, j) =>
        i === j ? 0 : simPair(stories[i].title, stories[j].title)
      )
    );

    for (let iter = 0; iter < 180; iter++) {
      const alpha = Math.max(0.04, 1 - iter / 180);
      for (let i = 0; i < N; i++) {
        let fx = 0, fy = 0;
        for (let j = 0; j < N; j++) {
          if (i === j) continue;
          const dx = nodes[j].x - nodes[i].x;
          const dy = nodes[j].y - nodes[i].y;
          const d2 = dx*dx + dy*dy + 0.1;
          const d  = Math.sqrt(d2);
          // Repulsion
          fx -= (dx / d) * (900 / d2);
          fy -= (dy / d) * (900 / d2);
          // Attraction for similar titles
          const sim = sims[i][j];
          if (sim > 0.15) {
            fx += (dx / d) * sim * 0.045 * d;
            fy += (dy / d) * sim * 0.045 * d;
          }
        }
        // Soft gravity to center
        fx += (W * 0.5 - nodes[i].x) * 0.009;
        fy += (H * 0.5 - nodes[i].y) * 0.009;
        nodes[i].vx = (nodes[i].vx + fx * alpha) * 0.76;
        nodes[i].vy = (nodes[i].vy + fy * alpha) * 0.76;
      }
      for (let i = 0; i < N; i++) {
        nodes[i].x = Math.max(32, Math.min(W - 32, nodes[i].x + nodes[i].vx));
        nodes[i].y = Math.max(48, Math.min(H - 48, nodes[i].y + nodes[i].vy));
      }
    }
    return { nodes, sims };
  }

  function drawMap(hovIdx) {
    const dpr = window.devicePixelRatio || 1;
    const W   = mapCanvas.width  / dpr;
    const H   = mapCanvas.height / dpr;
    const ctx = mapCanvas.getContext("2d");
    ctx.clearRect(0, 0, mapCanvas.width, mapCanvas.height);
    ctx.save();
    ctx.scale(dpr, dpr);

    const N = mapNodes.length;

    // Edges — only between highly similar stories
    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) {
        const sim = mapSims[i][j];
        if (sim < 0.35) continue;
        ctx.beginPath();
        ctx.moveTo(mapNodes[i].x, mapNodes[i].y);
        ctx.lineTo(mapNodes[j].x, mapNodes[j].y);
        ctx.strokeStyle = `rgba(255,255,255,${(sim - 0.35) * 0.22})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
    }

    // Dots
    for (let i = 0; i < N; i++) {
      const n     = mapNodes[i];
      const score = n.story.score ?? 50;
      const r     = 2.5 + (score / 100) * 4.5;
      const color = TYPE_DOT_COLORS[n.story.story_type] || TYPE_DOT_COLORS.default;
      const isHov = i === hovIdx;

      if (isHov) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, r + 10, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.04)";
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(n.x, n.y, isHov ? r * 1.6 : r, 0, Math.PI * 2);
      ctx.fillStyle   = isHov ? "#ffffff" : color;
      ctx.globalAlpha = isHov ? 1 : 0.72;
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  function findNearestDot(mx, my, threshold = 22) {
    let best = -1, bestD = threshold;
    for (let i = 0; i < mapNodes.length; i++) {
      const d = Math.hypot(mapNodes[i].x - mx, mapNodes[i].y - my);
      if (d < bestD) { bestD = d; best = i; }
    }
    return best;
  }

  function openMap() {
    mapOpen = true;
    show(mapOverlay);

    const dpr = window.devicePixelRatio || 1;
    const W   = mapOverlay.clientWidth;
    const H   = mapOverlay.clientHeight;
    mapCanvas.width        = W * dpr;
    mapCanvas.height       = H * dpr;
    mapCanvas.style.width  = W + "px";
    mapCanvas.style.height = H + "px";

    const pool = displayStories.slice(0, 80);
    mapCountEl.textContent = `${pool.length} stories`;
    if (pool.length === 0) return;

    const result = computeLayout(pool, W, H);
    mapNodes = result.nodes;
    mapSims  = result.sims;
    drawMap(-1);
  }

  function closeMap() { mapOpen = false; hide(mapOverlay); }
  function toggleMap() { mapOpen ? closeMap() : openMap(); }

  mapCanvas.addEventListener("mousemove", (e) => {
    const rect = mapCanvas.getBoundingClientRect();
    const mx   = e.clientX - rect.left;
    const my   = e.clientY - rect.top;
    const idx  = findNearestDot(mx, my);

    drawMap(idx);

    if (idx >= 0) {
      const s   = mapNodes[idx].story;
      const src = s.all_sources?.length > 1 ? s.all_sources.join(" · ") : s.source_name;
      mapTooltipEl.innerHTML =
        `<strong>${escapeHtml(s.title)}</strong>` +
        `<span>${escapeHtml(src)} · ${timeAgo(s.published_at)}</span>`;
      const tx = Math.min(mx + 18, mapCanvas.clientWidth - 295);
      const ty = Math.max(my - 60, 60);
      mapTooltipEl.style.left   = tx + "px";
      mapTooltipEl.style.top    = ty + "px";
      mapCanvas.style.cursor    = "pointer";
      show(mapTooltipEl);
    } else {
      hide(mapTooltipEl);
      mapCanvas.style.cursor = "crosshair";
    }
  });

  mapCanvas.addEventListener("mouseleave", () => {
    drawMap(-1);
    hide(mapTooltipEl);
  });

  mapCanvas.addEventListener("click", (e) => {
    const rect = mapCanvas.getBoundingClientRect();
    const idx  = findNearestDot(e.clientX - rect.left, e.clientY - rect.top);
    if (idx < 0) return;
    const feedIdx = displayStories.indexOf(mapNodes[idx].story);
    if (feedIdx >= 0) { closeMap(); transitionToStory(feedIdx); }
  });

  btnCloseMap.addEventListener("click", closeMap);
  mapOverlay.addEventListener("click", (e) => { if (e.target === mapOverlay) closeMap(); });

  // ── Briefing (W key) ──────────────────────────────────────────────────────

  const TYPE_SECTION_LABELS = {
    launch: "launches", research: "research", funding: "funding",
    drama: "developing", opensource: "open source", default: "news",
  };

  function getBriefingWindow() {
    for (const hrs of [2, 6, 12, 24, 48]) {
      const cutoff = Date.now() - hrs * 3600_000;
      const pool   = displayStories.filter(
        (s) => s.published_at && new Date(s.published_at).getTime() > cutoff
      );
      if (pool.length >= 3 || hrs === 48) return { stories: pool, hours: hrs };
    }
    return { stories: displayStories.slice(0, 10), hours: 48 };
  }

  function renderBriefing() {
    const { stories, hours } = getBriefingWindow();

    const windowLabel = hours <= 2 ? "last 2 hours"
                      : hours <= 6 ? "last 6 hours"
                      : `last ${hours} hours`;

    briefingHeaderEl.innerHTML = `
      <div class="briefing-meta">
        <span class="briefing-title">briefing</span>
        <span class="briefing-sep">·</span>
        <span class="briefing-window">${windowLabel}</span>
        <span class="briefing-sep">·</span>
        <span class="briefing-count">${stories.length} stor${stories.length === 1 ? "y" : "ies"}</span>
      </div>
      <button id="btn-close-briefing" class="briefing-close-btn">✕</button>`;

    document.getElementById("btn-close-briefing")
      .addEventListener("click", closeBriefing);

    briefingBodyEl.innerHTML = "";

    if (stories.length === 0) {
      briefingBodyEl.innerHTML = '<div class="briefing-empty">nothing yet. check back later.</div>';
      return;
    }

    // Lead = highest score
    const sorted = [...stories].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    const lead   = sorted[0];
    const rest   = sorted.slice(1);

    const leadEl   = document.createElement("div");
    leadEl.className = "briefing-lead";
    const leadSrc  = lead.all_sources?.length > 1
      ? lead.all_sources.join(" · ") : lead.source_name;
    leadEl.innerHTML = `
      <a class="briefing-lead-title" href="${escapeHtml(lead.url)}">${escapeHtml(lead.title)}</a>
      <div class="briefing-lead-meta">${escapeHtml(leadSrc)} · ${timeAgo(lead.published_at)}</div>`;
    leadEl.querySelector("a").addEventListener("click", (e) => {
      e.preventDefault(); window.location.href = lead.url;
    });
    briefingBodyEl.appendChild(leadEl);

    if (rest.length === 0) return;

    // Group rest by type
    const groups = {};
    for (const s of rest) {
      const t = s.story_type || "default";
      (groups[t] = groups[t] || []).push(s);
    }

    // Largest groups first
    const ordered = Object.entries(groups).sort((a, b) => b[1].length - a[1].length);

    for (const [type, items] of ordered) {
      const sec = document.createElement("div");
      sec.className = "briefing-section";

      const lbl = document.createElement("div");
      lbl.className   = "briefing-section-label";
      lbl.textContent = TYPE_SECTION_LABELS[type] || type;
      sec.appendChild(lbl);

      for (const s of items) {
        const row = document.createElement("div");
        row.className = "briefing-item";
        const src = s.all_sources?.length > 1 ? s.all_sources.join(" · ") : s.source_name;
        row.innerHTML = `
          <a class="briefing-item-title" href="${escapeHtml(s.url)}">${escapeHtml(s.title)}</a>
          <div class="briefing-item-meta">${escapeHtml(src)} · ${timeAgo(s.published_at)}</div>`;
        row.querySelector("a").addEventListener("click", (e) => {
          e.preventDefault(); window.location.href = s.url;
        });
        sec.appendChild(row);
      }

      briefingBodyEl.appendChild(sec);
    }
  }

  function openBriefing() {
    briefingOpen = true;
    show(briefingOverlay);
    renderBriefing();
  }

  function closeBriefing() {
    briefingOpen = false;
    hide(briefingOverlay);
  }

  function toggleBriefing() { briefingOpen ? closeBriefing() : openBriefing(); }

  briefingOverlay.addEventListener("click", (e) => {
    if (e.target === briefingOverlay) closeBriefing();
  });

  // ── Ambient mode ──────────────────────────────────────────────────────────

  function buildContextLine(story) {
    if (!story) return "";
    const srcCount = story.all_sources?.length ?? 1;
    const points   = story.hn_points ?? 0;
    const age      = Math.floor((Date.now() - new Date(story.published_at).getTime()) / 3600_000);
    const total    = displayStories.length;
    const others   = story.all_sources?.filter((s) => s !== story.source_name) ?? [];

    if (points > 500)    return `${points} points on hacker news`;
    if (points > 100)    return `trending on hn · ${points} points`;
    if (srcCount >= 4)   return `${srcCount} sources on this`;
    if (srcCount === 3)  return `also on ${others.slice(0, 2).join(" and ")}`;
    if (srcCount === 2)  return `also on ${others[0]}`;
    if (age === 0)       return `breaking — last hour`;
    if (age === 1)       return `1 hour old`;
    if (age < 6)         return `${age} hours ago`;
    return `${total} stories today`;
  }

  function updateAmbientLine() {
    const story = activeStories()[currentIndex];
    ambientLineEl.textContent = buildContextLine(story);
  }

  function enterAmbient() {
    if (activeStories().length === 0 || mixingOpen || sidebarOpen || filterOpen) return;
    ambientActive = true;
    document.body.classList.add("ambient");
    updateAmbientLine();
    ambientAdvTimer = setInterval(() => {
      transitionToStory(currentIndex + 1);
      setTimeout(updateAmbientLine, 250);
    }, AMBIENT_ADVANCE_MS);
  }

  function exitAmbient() {
    if (!ambientActive) return;
    ambientActive = false;
    document.body.classList.remove("ambient");
    clearInterval(ambientAdvTimer);
    ambientAdvTimer = null;
  }

  function resetIdle() {
    exitAmbient();
    clearTimeout(idleTimer);
    idleTimer = setTimeout(enterAmbient, IDLE_TIMEOUT_MS);
  }

  // Start idle timer + reset on any activity
  document.addEventListener("mousemove", resetIdle, { passive: true });
  document.addEventListener("keydown",   resetIdle, { passive: true });
  document.addEventListener("click",     resetIdle, { passive: true });

  // ── Timeline ──────────────────────────────────────────────────────────────

  function renderTimeline() {
    timelineDots.innerHTML = "";
    if (displayStories.length === 0) { hide(timelineBar); return; }

    const now    = Date.now();
    const oldest = now - TIMELINE_HOURS * 3600_000;

    timedStories = displayStories
      .filter((s) => s.published_at)
      .map((s) => ({ story: s, ts: new Date(s.published_at).getTime() }))
      .filter(({ ts }) => ts >= oldest);

    if (timedStories.length === 0) { hide(timelineBar); return; }
    show(timelineBar);

    for (let i = 0; i < timedStories.length; i++) {
      const { story, ts } = timedStories[i];
      const pct = ((ts - oldest) / (now - oldest)) * 100;
      const dot = document.createElement("div");
      dot.className   = "timeline-dot";
      dot.style.left  = pct + "%";
      dot.dataset.type  = story.story_type || "default";
      dot.dataset.idx   = i;
      timelineDots.appendChild(dot);
    }
  }

  function timelineXtoPct(clientX) {
    const rect = timelineBar.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  }

  timelineBar.addEventListener("mousemove", (e) => {
    const pct       = timelineXtoPct(e.clientX);
    const now       = Date.now();
    const oldest    = now - TIMELINE_HOURS * 3600_000;
    const hoveredTs = oldest + pct * (now - oldest);
    const windowMs  = 1.5 * 3600_000;

    // Move cursor
    timelineCursor.style.left = (pct * 100) + "%";

    // Find near stories
    const near = timedStories
      .map(({ story, ts }, i) => ({ story, ts, i, diff: Math.abs(ts - hoveredTs) }))
      .filter(({ diff }) => diff < windowMs)
      .sort((a, b) => a.diff - b.diff);

    // Highlight dots
    const dots = timelineDots.children;
    for (let i = 0; i < dots.length; i++) {
      const isNear = near.some((n) => n.i === i);
      dots[i].classList.toggle("near", isNear);
    }

    // Tooltip content
    const topStory = near[0]?.story;
    const d = new Date(hoveredTs);
    const timeLabel = d.toLocaleString("en-US", {
      month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit", hour12: false,
    });

    if (topStory) {
      timelineTooltip.innerHTML =
        `<strong>${escapeHtml(topStory.title)}</strong>` +
        `${timeLabel} · ${near.length} stor${near.length === 1 ? "y" : "ies"}`;
    } else {
      timelineTooltip.innerHTML = timeLabel;
    }

    // Position tooltip (clamp to viewport)
    const rect    = timelineBar.getBoundingClientRect();
    const relX    = e.clientX - rect.left;
    const tipLeft = Math.max(4, Math.min(relX - 60, rect.width - 290));
    timelineTooltip.style.left = tipLeft + "px";
    show(timelineTooltip);
  });

  timelineBar.addEventListener("mouseleave", () => {
    hide(timelineTooltip);
    for (const dot of timelineDots.children) dot.classList.remove("near");
  });

  timelineBar.addEventListener("click", (e) => {
    if (timedStories.length === 0) return;
    const pct       = timelineXtoPct(e.clientX);
    const now       = Date.now();
    const oldest    = now - TIMELINE_HOURS * 3600_000;
    const clickedTs = oldest + pct * (now - oldest);

    let closest = timedStories[0];
    let minDiff = Infinity;
    for (const item of timedStories) {
      const diff = Math.abs(item.ts - clickedTs);
      if (diff < minDiff) { minDiff = diff; closest = item; }
    }

    if (closest) {
      const idx = displayStories.indexOf(closest.story);
      if (idx >= 0) transitionToStory(idx);
    }
  });

  // ── Navigation buttons ────────────────────────────────────────────────────

  btnPrev.addEventListener("click", () => transitionToStory(currentIndex - 1));
  btnNext.addEventListener("click", () => transitionToStory(currentIndex + 1));

  headlineEl.addEventListener("click", (e) => {
    e.preventDefault();
    const url = headlineEl.href;
    if (url && url !== location.href) window.location.href = url;
  });

  // ── Keyboard ──────────────────────────────────────────────────────────────

  document.addEventListener("keydown", (e) => {
    const tag = document.activeElement?.tagName;
    if (filterOpen && tag === "INPUT") {
      if (e.key === "Escape") { e.preventDefault(); closeFilter(); }
      return;
    }
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    switch (e.key) {
      case "ArrowLeft":
        e.preventDefault(); transitionToStory(currentIndex - 1); break;
      case "ArrowRight":
      case " ":
        e.preventDefault(); transitionToStory(currentIndex + 1); break;
      case "o": case "O": {
        const url = activeStories()[currentIndex]?.url;
        if (url) window.location.href = url;
        break;
      }
      case "s": case "S": saveStory(); break;
      case "l": case "L": toggleSidebar(); break;
      case "f": case "F": e.preventDefault(); filterOpen ? closeFilter() : openFilter(); break;
      case "r": case "R": triggerRefresh(); break;
      case "w": case "W": toggleBriefing(); break;
      case "m": case "M": toggleMap(); break;
      case ",":           toggleMixing(); break;
      case "Escape":
        if (mapOpen)      { closeMap();      break; }
        if (briefingOpen) { closeBriefing(); break; }
        if (mixingOpen)   { closeMixing();   break; }
        if (sidebarOpen)  { closeSidebar();  break; }
        if (filterOpen)   { closeFilter();   break; }
        break;
    }
  });

  // ── Refresh ───────────────────────────────────────────────────────────────

  async function triggerRefresh() {
    btnRefresh.classList.add("spinning");
    btnRefreshEmpty.disabled = true;
    chrome.runtime.sendMessage({ type: "fetch-now" }).catch(() => {});
    await new Promise((r) => setTimeout(r, 4000));
    await loadFromStorage();
    btnRefresh.classList.remove("spinning");
    btnRefreshEmpty.disabled = false;
  }

  btnRefresh.addEventListener("click", triggerRefresh);
  btnRefreshEmpty.addEventListener("click", triggerRefresh);

  // ── Live storage updates ──────────────────────────────────────────────────

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    let changed = false;
    if (changes.stories)        { stories        = changes.stories.newValue        ?? []; changed = true; }
    if (changes.last_fetched)   { lastFetched    = changes.last_fetched.newValue   ?? null; changed = true; }
    if (changes.live_sources)   { liveSources    = changes.live_sources.newValue   ?? 0;  changed = true; }
    if (changes.total_stories)  { totalStories   = changes.total_stories.newValue  ?? 0;  changed = true; }
    if (changes.source_settings){ sourceSettings = changes.source_settings.newValue ?? defaultSettings(); changed = true; }
    if (changes.current_index)  { currentIndex   = changes.current_index.newValue  ?? 0; }
    if (changes.reading_list)   { readingList    = changes.reading_list.newValue   ?? []; if (sidebarOpen) renderSidebar(); }
    if (changed) {
      recomputeDisplay();
      if (activeFilter) applyFilter(activeFilter);
      else render();
    }
  });

  setInterval(() => renderBottomBar(), 30_000);

  // ── Boot ──────────────────────────────────────────────────────────────────
  idleTimer = setTimeout(enterAmbient, IDLE_TIMEOUT_MS);
  loadFromStorage();
})();
