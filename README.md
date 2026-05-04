# Tab Out

**[English](README.md) | [中文](README_CN.md)**

**Keep tabs on your tabs.**

Tab Out is a Chrome extension that replaces your new tab page with a dashboard of everything you have open. Tabs are grouped by domain, with homepages (Gmail, X, LinkedIn, etc.) pulled into their own group. Close tabs with a satisfying swoosh + confetti.

No server. No account. No external API calls. Just a Chrome extension.

---

## Install with a coding agent

Send your coding agent (Claude Code, Codex, etc.) this repo and say **"install this"**:

```
https://github.com/zarazhangrui/tab-out
```

The agent will walk you through it. Takes about 1 minute.

---

## Features

### Tab Management
- **See all your tabs at a glance** on a clean grid, grouped by domain
- **Homepages group** pulls Gmail inbox, X home, YouTube, LinkedIn, GitHub homepages into one card
- **Close tabs with style** with swoosh sound + confetti burst
- **Duplicate detection** flags when you have the same page open twice, with one-click cleanup
- **Click any tab to jump to it** across windows, no new tab opened
- **Close all tabs** per domain group or everything at once
- **Localhost grouping** shows port numbers next to each tab so you can tell your vibe coding projects apart
- **Expandable groups** show the first 8 tabs with a clickable "+N more"
- **Smart titles** cleans up noisy tab titles — strips notification counts, email addresses, and redundant site names

### Save for Later
- **Bookmark tabs to a checklist** before closing them
- **Check off** items when done — they move to a searchable archive
- **Dismiss** items you no longer need
- Data persists across browser sessions via `chrome.storage.local`

### Search Bar
- **Integrated search** with Google, Bing, and Baidu — switchable with one click
- **Autocomplete suggestions** fetched in real time as you type
- Search results open in a new tab

### Shortcuts
- **Editable shortcuts grid** similar to Chrome's default new tab page
- Add, edit, and remove your favorite sites
- Stored locally — no sync needed

### Utility Panels (right sidebar)
- **Recently Closed** — see tabs you just closed, one-click restore via `chrome.sessions`
- **Tab Stats** — total tabs, domains, duplicates count, and a top-5 domain bar chart
- **Focus Timer** — 25-minute Pomodoro timer with start/pause/reset and completion chime
- **Quick Notes** — auto-saving scratchpad backed by `chrome.storage.local`

### Appearance
- **Dark / Light / System** theme switcher with instant toggle
- Anti-flash mechanism prevents white flash in dark mode on page load
- **Live clock** in the header showing date and time (24h, updated every second)

### General
- **Three-column layout** adapts to wide monitors — left sidebar, center tabs, right utility panels
- **Responsive** — stacks to single column on narrow screens (< 1100px)
- **100% local** — your data never leaves your machine
- **Pure Chrome extension** — no server, no Node.js, no npm, no setup beyond loading the extension

---

## Manual Setup

**1. Clone the repo**

```bash
git clone https://github.com/zarazhangrui/tab-out.git
```

**2. Load the Chrome extension**

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Navigate to the `extension/` folder inside the cloned repo and select it

**3. Open a new tab**

You'll see Tab Out.

---

## How it works

```
You open a new tab
  -> Tab Out shows your open tabs grouped by domain
  -> Homepages (Gmail, X, etc.) get their own group at the top
  -> Click any tab title to jump to it
  -> Close groups you're done with (swoosh + confetti)
  -> Save tabs for later before closing them
```

Everything runs inside the Chrome extension. No external server, no API calls, no data sent anywhere. Saved tabs are stored in `chrome.storage.local`.

---

## Tech stack

| What | How |
|------|-----|
| Extension | Chrome Manifest V3 |
| Storage | chrome.storage.local (theme, shortcuts, notes, saved tabs, search engine preference) |
| Sessions | chrome.sessions API (recently closed tabs) |
| Sound | Web Audio API (synthesized swoosh + chime, no files) |
| Animations | CSS transitions + JS confetti particles |
| Search suggestions | Proxied via service worker to bypass CORS (Google, Bing, Baidu) |
| Theming | CSS custom properties + `data-theme` attribute, system preference detection |

---

## License

MIT

---

Built by [Zara](https://x.com/zarazhangrui)
