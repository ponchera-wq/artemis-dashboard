// news.js — Multi-source tabbed RSS feed
// ── NEWS FEED — MULTI-SOURCE TABBED ────────────────────────────────
(function() {
  const R2J = 'https://api.rss2json.com/v1/api.json?rss_url=';

  const SOURCES = {
    nasa: [
      { url: 'https://www.nasa.gov/feed/',             name: 'NASA' },
      { url: 'https://www.nasa.gov/blogs/artemis/feed/', name: 'NASA ARTEMIS' },
      { url: 'https://www.nasa.gov/blogs/missions/feed/', name: 'NASA BLOG' },
    ],
    space: [
      { url: 'https://www.space.com/feeds/all',         name: 'SPACE.COM' },
      { url: 'https://spacenews.com/feed/',             name: 'SPACENEWS' },
      { url: 'https://arstechnica.com/space/feed/',     name: 'ARS TECHNICA' },
    ],
    media: [
      { url: 'https://feeds.bbci.co.uk/news/science_and_environment/rss.xml',    name: 'BBC SCI' },
    ],
    partners: [
      { url: 'https://blogs.esa.int/orion/feed/', name: 'ESA ORION' },
      { url: 'https://www.asc-csa.gc.ca/eng/rss/default.xml', name: 'CSA' },
    ],
  };

  const FILTERS = {
    nasa:     ['artemis', 'orion', 'moon'],
    space:    ['artemis', 'orion', 'moon', 'sls'],
    media:    ['artemis', 'orion', 'moon', 'nasa', 'lunar', 'spacecraft', 'astronaut'],
    partners: ['artemis', 'orion', 'moon', 'hansen', 'lunar', 'service module'],
  };

  const cache = { nasa: [], space: [], media: [], partners: [] };
  let activeTab = 'all';

  function stripHtml(s) {
    return (s || '').replace(/<[^>]*>/g, '')
      .replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>')
      .replace(/&nbsp;/g,' ').replace(/&#\d+;/g,'').trim();
  }

  function timeAgo(dateStr) {
    if (!dateStr) return '';
    // rss2json returns dates as "YYYY-MM-DD HH:MM:SS" — no timezone, but always UTC.
    // Standard RSS dates include "GMT" / "+0000" / "Z".
    // If no timezone indicator is present, treat the string as UTC explicitly,
    // because new Date("2026-04-01 13:37:00") parses as LOCAL time in most engines.
    const hasZone = /Z$|[+-]\d{2}:?\d{2}$|GMT|UTC/i.test(dateStr.trim());
    const normalized = hasZone ? dateStr : dateStr.trim().replace(' ', 'T') + 'Z';
    const parsed = new Date(normalized);
    if (isNaN(parsed.getTime())) return '';
    const ms = Date.now() - parsed.getTime();
    if (ms < 0) return 'just now';
    if (ms > 48 * 3600000) return parsed.toUTCString().slice(5, 16); // "02 Apr 2026"
    const min = Math.floor(ms / 60000);
    if (min < 60) return min + 'm ago';
    return Math.floor(min / 60) + 'h ago';
  }

  function matches(item, keys) {
    const cats = Array.isArray(item.categories) ? item.categories.join(' ') : '';
    const txt = ((item.title || '') + ' ' + (item.description || '') + ' ' + cats).toLowerCase();
    return keys.some(k => txt.includes(k));
  }

  async function fetchSource(src, filterKeys) {
    try {
      const res = await fetch(R2J + encodeURIComponent(src.url));
      if (!res.ok) {
        console.warn('[news] HTTP error fetching', src.name, res.status);
        return [];
      }
      const data = await res.json();
      if (data.status !== 'ok' || !Array.isArray(data.items)) {
        console.warn('[news] rss2json error for', src.name, data.message || data.status);
        return [];
      }
      const matched = data.items.filter(item => matches(item, filterKeys));
      console.log('[news]', src.name, '→', data.items.length, 'items,', matched.length, 'matched');
      return matched.map(item => ({ ...item, _src: src.name }));
    } catch (err) {
      console.warn('[news] fetch failed for', src.name, err.message);
      return [];
    }
  }

  function byDate(arr) {
    return arr.slice().sort((a, b) => {
      const ta = new Date(a.pubDate).getTime();
      const tb = new Date(b.pubDate).getTime();
      return (isNaN(tb) ? 0 : tb) - (isNaN(ta) ? 0 : ta); // descending, NaN sinks to bottom
    });
  }

  function dedup(items) {
    const seen = new Set();
    return items.filter(item => {
      const key = (item.title || '').toLowerCase().replace(/\s+/g,' ').slice(0, 50);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function getItems(tab) {
    if (tab === 'all') return dedup(byDate([...cache.nasa, ...cache.space, ...cache.media, ...cache.partners]));
    return byDate(cache[tab] || []);
  }

  function renderTab(tab) {
    activeTab = tab;
    const feed = document.getElementById('news-feed');
    const items = getItems(tab).slice(0, 6);
    if (items.length === 0) {
      feed.innerHTML = '<div class="news-empty">NO MATCHING ARTICLES</div>';
      return;
    }
    feed.innerHTML = '';
    items.forEach(item => {
      const raw     = stripHtml(item.description || item.content || '');
      const excerpt = raw.slice(0, 120) + (raw.length > 120 ? '…' : '');
      const el      = document.createElement('div');
      el.className  = 'news-item';
      const link    = item.link || '#';

      // Build "Published: Apr 2, 10:35 PM AEST" tooltip
      let pubTooltip = '';
      if (item.pubDate) {
        const hasZone = /Z$|[+-]\d{2}:?\d{2}$|GMT|UTC/i.test(item.pubDate.trim());
        const norm    = hasZone ? item.pubDate : item.pubDate.trim().replace(' ', 'T') + 'Z';
        const pd      = new Date(norm);
        if (!isNaN(pd.getTime())) {
          pubTooltip = `Published: ${fmtLocal(pd, true)} ${tzAbbr(pd)}`;
        }
      }

      el.innerHTML  = `
        <div class="news-source"><span class="news-dot"></span>${item._src || 'RSS'}</div>
        <a class="news-title" href="${link}" target="_blank" rel="noopener noreferrer">${stripHtml(item.title || '')}</a>
        ${excerpt ? `<div class="news-desc">${excerpt}</div>` : ''}
        <div class="news-time" ${pubTooltip ? `title="${pubTooltip}"` : ''}>${timeAgo(item.pubDate)}</div>
      `;
      feed.appendChild(el);
    });
  }

  async function refreshAll() {
    const [n, s, m, p] = await Promise.all([
      Promise.all(SOURCES.nasa.map(src      => fetchSource(src, FILTERS.nasa))).then(r => r.flat()),
      Promise.all(SOURCES.space.map(src     => fetchSource(src, FILTERS.space))).then(r => r.flat()),
      Promise.all(SOURCES.media.map(src     => fetchSource(src, FILTERS.media))).then(r => r.flat()),
      Promise.all(SOURCES.partners.map(src  => fetchSource(src, FILTERS.partners))).then(r => r.flat()),
    ]);
    cache.nasa     = byDate(n);
    cache.space    = byDate(s);
    cache.media    = byDate(m);
    cache.partners = byDate(p);
    renderTab(activeTab);
  }

  document.querySelectorAll('.news-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.news-tab').forEach(t => t.classList.remove('active'));
      btn.classList.add('active');
      renderTab(btn.dataset.tab);
    });
  });

  refreshAll();
  setInterval(refreshAll, 15 * 60 * 1000);
})();
