// ==UserScript==
// @name         HN Glider Skin
// @namespace    https://github.com/outmanos/hn-glider-skin
// @version      1.2.0
// @description  Reskins Hacker News with a modern, Glider-inspired Material look: card-based rows, clean typography, upvote/comment counts as stat chips, light/dark/auto theme toggle and an data export function.
// @author       outmanos
// @license      GPLv3
// @match        https://news.ycombinator.com/*
// @match        https://hn.algolia.com/*
// @icon         https://news.ycombinator.com/favicon.ico
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @connect      hn.algolia.com
// @connect      news.ycombinator.com
// @run-at       document-start
// ==/UserScript==

(function () {
  'use strict';

  console.info('[HN Glider] v1.2.0 loaded on', location.href);

  /* ------------------------------------------------------------------
   * 1. THEME STATE
   * ------------------------------------------------------------------
   * Three modes: 'light' | 'dark' | 'auto' (follows prefers-color-scheme)
   * Persisted via GM_setValue so it survives across HN's plain page loads.
   * ------------------------------------------------------------------ */

  const THEME_KEY = 'hn-glider-theme';
  const KARMA_CACHE_KEY = 'hn-glider-karma-cache';
  const MODES = ['auto', 'light', 'dark'];

  function getStoredMode() {
    try {
      return GM_getValue(THEME_KEY, 'auto');
    } catch (e) {
      return localStorage.getItem(THEME_KEY) || 'auto';
    }
  }

  function setStoredMode(mode) {
    try {
      GM_setValue(THEME_KEY, mode);
    } catch (e) {
      localStorage.setItem(THEME_KEY, mode);
    }
  }

  function systemPrefersDark() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  function resolveTheme(mode) {
    if (mode === 'auto') return systemPrefersDark() ? 'dark' : 'light';
    return mode;
  }

  function applyTheme(mode) {
    const resolved = resolveTheme(mode);
    document.documentElement.setAttribute('data-hn-glider-theme', resolved);
    document.documentElement.setAttribute('data-hn-glider-mode', mode);
    updateToggleUI(mode, resolved);
  }

  let currentMode = getStoredMode();

  function markPageType() {
    if (!document.documentElement) return;
    if (location.hostname === 'hn.algolia.com') {
      document.documentElement.classList.add('hng-algolia');
    }
    if (
      location.hostname === 'news.ycombinator.com' &&
      (location.pathname === '/user' || document.documentElement.getAttribute('op') === 'user')
    ) {
      document.documentElement.classList.add('hng-user-page');
    }
  }

  markPageType();
  document.addEventListener('DOMContentLoaded', markPageType);

  // Apply as early as possible (document-start) to avoid a flash of
  // unstyled/light content. We re-apply once <html> exists.
  const earlyApply = () => applyTheme(currentMode);
  if (document.documentElement) earlyApply();
  document.addEventListener('DOMContentLoaded', earlyApply);

  // React to system theme changes when in 'auto' mode.
  if (window.matchMedia) {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      if (currentMode === 'auto') applyTheme('auto');
    };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else if (mq.addListener) mq.addListener(onChange);
  }

  /* ------------------------------------------------------------------
   * 2. STYLES
   * ------------------------------------------------------------------
   * Glider's look: airy Material cards, an orange accent that still nods
   * to HN branding, chip-style stats for points/comments, soft dividers
   * instead of heavy borders, and a proper dark theme (not just inverted).
   * ------------------------------------------------------------------ */

  const css = `
  :root {
    --hng-radius: 10px;
    --hng-radius-sm: 6px;
    --hng-accent: #ff6600;
    --hng-accent-ink: #ffffff;
    --hng-font: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    --hng-mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  }

  html[data-hn-glider-theme="light"] {
    --hng-bg: #f4f5f7;
    --hng-surface: #ffffff;
    --hng-surface-2: #fbfbfc;
    --hng-border: #e6e7eb;
    --hng-text: #1c1c1e;
    --hng-text-dim: #6b6f76;
    --hng-text-faint: #9a9ea6;
    --hng-link-visited: #7c4dff;
    --hng-shadow: 0 1px 2px rgba(20, 20, 30, 0.04), 0 1px 1px rgba(20, 20, 30, 0.03);
    --hng-chip-bg: #f1f2f4;
    --hng-chip-up-bg: #fff1e6;
    --hng-chip-up-ink: #c9550a;
    --hng-selected: #fff1e6;
    --hng-favorite: #e5484d;
  }

  html[data-hn-glider-theme="dark"] {
    --hng-bg: #14151a;
    --hng-surface: #1c1e24;
    --hng-surface-2: #21232a;
    --hng-border: #2c2f38;
    --hng-text: #e7e8ea;
    --hng-text-dim: #a2a6b0;
    --hng-text-faint: #74787f;
    --hng-link-visited: #b39ddb;
    --hng-shadow: 0 1px 2px rgba(0, 0, 0, 0.3), 0 1px 1px rgba(0, 0, 0, 0.2);
    --hng-chip-bg: #2a2c34;
    --hng-chip-up-bg: #3a2717;
    --hng-chip-up-ink: #ff9a52;
    --hng-selected: #2a2116;
    --hng-favorite: #ff7b7b;
  }

  html[data-hn-glider-theme="light"] {
    color-scheme: light;
  }

  html[data-hn-glider-theme="dark"] {
    color-scheme: dark;
  }

  /* ---------- Pixel avatars ----------
     Each user's pattern is a per-user mask; its hue comes from the same
     hash. Saturation/lightness are theme tokens, so switching themes just
     recolors every avatar without regenerating anything. */
  html[data-hn-glider-theme="light"] {
    --hng-av-s: 58%;
    --hng-av-l: 47%;
    --hng-av-bg-s: 70%;
    --hng-av-bg-l: 93%;
  }

  html[data-hn-glider-theme="dark"] {
    --hng-av-s: 62%;
    --hng-av-l: 67%;
    --hng-av-bg-s: 24%;
    --hng-av-bg-l: 23%;
  }

  /* Avatars are tiny inline SVGs (HN's Content Security Policy blocks
     data: images, so CSS masks/backgrounds can't be used). */
  html[data-hn-glider-theme] svg.hng-avatar {
    display: inline-block;
    flex-shrink: 0;
    width: 18px;
    height: 18px;
    border-radius: 4px;
    overflow: hidden;
    vertical-align: middle;
    shape-rendering: crispEdges;
    background-color: hsl(var(--hng-av-h, 0) var(--hng-av-bg-s) var(--hng-av-bg-l));
  }

  html[data-hn-glider-theme] svg.hng-avatar path {
    fill: hsl(var(--hng-av-h, 0) var(--hng-av-s) var(--hng-av-l));
  }

  html[data-hn-glider-theme] svg.hng-avatar-comment {
    width: 18px;
    height: 18px;
    margin: -2px 5px 0 0;
  }

  html[data-hn-glider-theme] svg.hng-avatar-story {
    width: 16px;
    height: 16px;
    margin: -2px 4px 0 2px;
    border-radius: 3px;
  }

  html[data-hn-glider-theme] svg.hng-avatar-topbar {
    width: 16px;
    height: 16px;
  }

  html[data-hn-glider-theme] svg.hng-avatar-profile {
    width: 54px;
    height: 54px;
    border-radius: 16px;
  }

  html[data-hn-glider-theme] body {
    background: var(--hng-bg) !important;
    font-family: var(--hng-font) !important;
    color: var(--hng-text) !important;
  }

  html[data-hn-glider-theme] center > table {
    background: transparent !important;
    max-width: 800px;
    margin: 0 auto;
  }

  /* ---------- Top bar ---------- */
  html[data-hn-glider-theme] #hnmain {
    background: transparent !important;
    border: none !important;
  }

  html[data-hn-glider-theme] .hng-topbar {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    background: var(--hng-surface) !important;
    border-radius: var(--hng-radius-sm);
    box-shadow: var(--hng-shadow);
    padding: 6px 10px;
    margin: 8px 8px 6px 8px;
    border: 1px solid var(--hng-border);
  }

  html[data-hn-glider-theme] #hnmain > tbody > tr:first-child {
    display: none; /* hide stock orange bar, we render our own topbar */
  }

  html[data-hn-glider-theme] .hng-topbar .hng-logo {
    width: 20px;
    height: 20px;
    border-radius: 5px;
    background: var(--hng-accent);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-weight: 700;
    font-size: 11px;
    flex-shrink: 0;
  }

  html[data-hn-glider-theme] .hng-topbar a.hng-site-title {
    font-weight: 700;
    font-size: 13px;
    color: var(--hng-text) !important;
    text-decoration: none;
    margin-right: 2px;
    white-space: nowrap;
  }

  html[data-hn-glider-theme] .hng-topbar nav {
    display: flex;
    align-items: center;
    gap: 0px;
    flex-wrap: wrap;
    flex: 1 1 auto;
    min-width: 0;
  }

  html[data-hn-glider-theme] .hng-topbar nav a {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: var(--hng-text-dim) !important;
    text-decoration: none;
    font-size: 11.5px;
    font-weight: 600;
    padding: 4px 7px;
    border-radius: var(--hng-radius-sm);
    transition: background 0.12s ease, color 0.12s ease;
  }

  html[data-hn-glider-theme] .hng-topbar nav a svg {
    width: 12px;
    height: 12px;
    flex-shrink: 0;
    display: block;
  }

  html[data-hn-glider-theme] .hng-topbar nav .hng-nav-separator {
    width: 1px;
    height: 14px;
    margin: 0 4px;
    background: var(--hng-border);
    flex-shrink: 0;
  }

  html[data-hn-glider-theme] .hng-topbar nav a:hover {
    background: var(--hng-chip-bg) !important;
    color: var(--hng-text) !important;
  }

  html[data-hn-glider-theme] .hng-topbar .hng-user {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 11.5px;
    color: var(--hng-text-dim) !important;
    text-decoration: none;
    padding: 4px 7px;
    white-space: nowrap;
  }

  html[data-hn-glider-theme] .hng-topbar .hng-user:hover {
    color: var(--hng-text) !important;
  }

  /* ---------- User shortcuts ---------- */
  html[data-hn-glider-theme] .hng-topbar .hng-user-actions {
    display: flex;
    align-items: center;
    gap: 1px;
    flex-shrink: 0;
  }

  html[data-hn-glider-theme] .hng-topbar .hng-user-actions a {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    padding: 0;
    border-radius: var(--hng-radius-sm);
    color: var(--hng-text-faint) !important;
    text-decoration: none;
    transition: background 0.12s ease, color 0.12s ease;
  }

  html[data-hn-glider-theme] .hng-topbar .hng-user-actions a:hover {
    background: var(--hng-chip-bg) !important;
    color: var(--hng-accent) !important;
  }

  html[data-hn-glider-theme] .hng-topbar .hng-user-actions svg {
    width: 13px;
    height: 13px;
    display: block;
  }

  html[data-hn-glider-theme] .hng-topbar .hng-user-action-favorites svg {
    fill: none;
  }

  /* ---------- Topbar search ---------- */
  html[data-hn-glider-theme] .hng-topbar .hng-search {
    display: flex;
    align-items: center;
    gap: 2px;
    flex: 0 1 210px;
    min-width: 150px;
    height: 26px;
    box-sizing: border-box;
    margin: 0 0 0 auto;
    padding: 0 2px 0 10px;
    background: var(--hng-surface-2);
    border: 1px solid var(--hng-border);
    border-radius: 999px;
    transition: border-color 0.12s ease, box-shadow 0.12s ease;
  }

  html[data-hn-glider-theme] .hng-topbar .hng-search:focus-within {
    border-color: var(--hng-accent);
    box-shadow: 0 0 0 2px rgba(255, 102, 0, 0.14);
  }

  html[data-hn-glider-theme] .hng-topbar .hng-search input[type="search"] {
    flex: 1;
    min-width: 0;
    height: 24px;
    margin: 0;
    padding: 0;
    border: 0 !important;
    border-radius: 0 !important;
    background: transparent !important;
    box-shadow: none !important;
    outline: none;
    color: var(--hng-text) !important;
    font-family: var(--hng-font);
    font-size: 12px;
    -webkit-appearance: none;
    appearance: none;
  }

  html[data-hn-glider-theme] .hng-topbar .hng-search input[type="search"]::placeholder {
    color: var(--hng-text-faint);
  }

  html[data-hn-glider-theme] .hng-topbar .hng-search button {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 22px;
    height: 22px;
    padding: 0;
    border: 0;
    border-radius: 999px;
    background: transparent;
    color: var(--hng-text-dim);
    cursor: pointer;
    transition: background 0.12s ease, color 0.12s ease;
  }

  html[data-hn-glider-theme] .hng-topbar .hng-search button:hover {
    background: var(--hng-chip-bg);
    color: var(--hng-accent);
  }

  html[data-hn-glider-theme] .hng-topbar .hng-search button svg {
    width: 13px;
    height: 13px;
    display: block;
  }

  @media (max-width: 640px) {
    html[data-hn-glider-theme] .hng-topbar .hng-search {
      flex: 1 1 100%;
      order: 10;
      max-width: none;
      margin: 0;
    }
  }
  /* HN also renders a search form in the footer. The topbar owns search now. */
  html[data-hn-glider-theme] #hnmain form[action*="hn.algolia.com"] {
    display: none !important;
  }

  /* ---------- Theme toggle ---------- */
  .hng-toggle {
    display: flex;
    align-items: center;
    background: var(--hng-chip-bg);
    border-radius: 999px;
    padding: 2px;
    gap: 1px;
    flex-shrink: 0;
  }

  .hng-toggle button {
    border: none;
    background: transparent;
    color: var(--hng-text-dim);
    line-height: 0;
    padding: 5px;
    width: 22px;
    height: 22px;
    border-radius: 999px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--hng-font);
    transition: background 0.12s ease, color 0.12s ease;
  }

  .hng-toggle button svg {
    width: 13px;
    height: 13px;
    flex-shrink: 0;
    display: block;
  }

  .hng-toggle button:hover {
    color: var(--hng-text);
  }

  .hng-toggle button.hng-active {
    background: var(--hng-surface);
    color: var(--hng-accent);
    box-shadow: var(--hng-shadow);
  }

  /* ---------- Story list (Glider-style cards) ---------- */
  html[data-hn-glider-theme] table.itemlist {
    border-collapse: separate !important;
    border-spacing: 0 4px !important;
    padding: 0 8px;
  }

  html[data-hn-glider-theme] table.itemlist tr.athing {
    background: var(--hng-surface) !important;
  }

  html[data-hn-glider-theme] table.itemlist tr.athing td {
    padding-top: 5px !important;
  }

  html[data-hn-glider-theme] table.itemlist tr.athing td.title {
    padding-top: 5px !important;
  }

  /* rounded card corners: apply to first/last cell */
  html[data-hn-glider-theme] table.itemlist tr.athing > td:first-child {
    border-top-left-radius: var(--hng-radius-sm);
    border-bottom-left-radius: var(--hng-radius-sm);
  }
  html[data-hn-glider-theme] table.itemlist tr.athing > td:last-child {
    border-top-right-radius: var(--hng-radius-sm);
  }

  html[data-hn-glider-theme] table.itemlist tr.athing + tr {
    background: var(--hng-surface) !important;
  }
  html[data-hn-glider-theme] table.itemlist tr.athing + tr > td.subtext {
    padding-bottom: 5px !important;
    padding-top: 1px !important;
    border-bottom-left-radius: var(--hng-radius-sm);
    border-bottom-right-radius: var(--hng-radius-sm);
    box-shadow: var(--hng-shadow);
  }

  html[data-hn-glider-theme] table.itemlist tr.athing > td:last-child {
    box-shadow: var(--hng-shadow);
  }

  html[data-hn-glider-theme] table.itemlist tr.athing > td:first-child {
    box-shadow: var(--hng-shadow);
  }

  /* spacer rows between items become invisible, true gap done via border-spacing */
  html[data-hn-glider-theme] table.itemlist tr[style*="height"] {
    display: none !important;
  }

  html[data-hn-glider-theme] .titleline {
    font-size: 13.5px;
  }

  html[data-hn-glider-theme] .titleline > a {
    color: var(--hng-text) !important;
    font-weight: 600;
    text-decoration: none;
  }

  html[data-hn-glider-theme] .titleline > a:visited {
    color: var(--hng-text-dim) !important;
  }

  html[data-hn-glider-theme] .titleline > a:hover {
    text-decoration: underline;
  }

  /* ---------- Favorite heart ---------- */
  html[data-hn-glider-theme] table.itemlist tr.athing td.title.hng-title-has-fav {
    position: relative;
    padding-right: 32px !important;
  }

  html[data-hn-glider-theme] .hng-favorite {
    position: absolute;
    top: 1px;
    right: 1px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    padding: 0;
    border: 0;
    border-radius: 999px;
    background: transparent;
    color: var(--hng-text-faint);
    opacity: 0.6;
    cursor: pointer;
    transition: background 0.12s ease, color 0.12s ease, opacity 0.12s ease;
  }

  html[data-hn-glider-theme] .hng-favorite:hover {
    background: var(--hng-chip-up-bg);
    color: var(--hng-favorite);
    opacity: 1;
  }

  html[data-hn-glider-theme] .hng-favorite.hng-favorited {
    color: var(--hng-favorite);
    opacity: 1;
  }

  html[data-hn-glider-theme] .hng-favorite svg {
    width: 14px;
    height: 14px;
    display: block;
    fill: none;
    transition: fill 0.12s ease, transform 0.12s ease;
  }

  html[data-hn-glider-theme] .hng-favorite.hng-favorited svg {
    fill: currentColor;
  }

  html[data-hn-glider-theme] .hng-favorite:active svg {
    transform: scale(0.88);
  }

  html[data-hn-glider-theme] .hng-favorite.hng-favorite-busy {
    opacity: 0.35;
    pointer-events: none;
  }

  html[data-hn-glider-theme] .hng-favorite.hng-favorite-error {
    color: #d33;
    opacity: 1;
  }

  html[data-hn-glider-theme] .sitebit,
  html[data-hn-glider-theme] .sitestr {
    color: var(--hng-text-faint) !important;
    font-size: 12px;
  }

  /* ---------- Story rank + upvote button ---------- */
  html[data-hn-glider-theme] .rank {
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    width: 22px !important;
    min-width: 22px !important;
    height: 22px !important;
    padding: 0 !important;
    box-sizing: border-box !important;
    border-radius: 999px !important;
    background: var(--hng-chip-bg) !important;
    color: var(--hng-text-dim) !important;
    font-size: 9.5px !important;
    font-weight: 700 !important;
    line-height: 1 !important;
    letter-spacing: -0.15px !important;
    font-variant-numeric: tabular-nums;
  }

  /* Item pages render an empty rank span; don't show a blank chip. */
  html[data-hn-glider-theme] .rank:empty,
  html[data-hn-glider-theme] .rank.hng-rank-empty {
    display: none !important;
  }

  html[data-hn-glider-theme] .votelinks {
    position: relative;
  }

  html[data-hn-glider-theme] .votelinks center {
    display: flex;
    justify-content: center;
  }

  html[data-hn-glider-theme] .votelinks a {
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    width: 22px !important;
    height: 22px !important;
    padding: 4px !important;
    box-sizing: border-box !important;
    margin-right: 5px !important;
    border-radius: 999px !important;
    color: var(--hng-text-faint) !important;
    text-decoration: none !important;
    line-height: 0 !important;
    opacity: 0.6;
    filter: none;
    cursor: pointer;
    transition: background 0.12s ease, color 0.12s ease, opacity 0.12s ease;
  }

  html[data-hn-glider-theme] .votelinks a:hover {
    background: var(--hng-chip-up-bg) !important;
    color: var(--hng-accent) !important;
    opacity: 1;
  }

  /* Replace HN's old arrow sprite with a crisp themed triangle. */
  html[data-hn-glider-theme] .votelinks a .votearrow {
    width: 0 !important;
    height: 0 !important;
    margin: 0 !important;
    border-left: 5px solid transparent !important;
    border-right: 5px solid transparent !important;
    border-bottom: 8px solid currentColor !important;
    background: none !important;
    transition: transform 0.12s ease;
  }

  html[data-hn-glider-theme] .votelinks a:active .votearrow {
    transform: scale(0.85);
  }

  /* Upvoted state: the arrow stays visible and turns accent orange,
     like a filled heart. Clicking it again unvotes. */
  html[data-hn-glider-theme] .votelinks a.hng-voted {
    visibility: visible !important;
    color: var(--hng-accent) !important;
    opacity: 1;
  }

  html[data-hn-glider-theme] .votelinks a.hng-voted:hover {
    background: var(--hng-chip-up-bg) !important;
  }

  html[data-hn-glider-theme] .votelinks a.hng-vote-busy {
    opacity: 0.35;
    pointer-events: none;
  }

  html[data-hn-glider-theme] .votelinks a.hng-vote-error {
    color: #d33 !important;
    opacity: 1;
  }

  /* HN's separate "unvote" link is redundant now that the arrow toggles. */
  html[data-hn-glider-theme] .hng-unv-hidden {
    display: none !important;
  }

  /* ---------- Subtext -> stat chip row ---------- */
  html[data-hn-glider-theme] .subtext {
    font-size: 12px;
    color: var(--hng-text-faint) !important;
  }

  html[data-hn-glider-theme] .subtext a {
    color: var(--hng-text-dim) !important;
    text-decoration: none;
  }

  html[data-hn-glider-theme] .subtext a:hover {
    text-decoration: underline;
  }

  html[data-hn-glider-theme] .hng-karma {
    display: inline-flex;
    align-items: center;
    margin-left: 3px;
    padding: 1px 5px;
    border-radius: 999px;
    background: var(--hng-chip-bg);
    color: var(--hng-text-faint) !important;
    font-size: 9.5px;
    font-weight: 600;
    line-height: 1.25;
    white-space: nowrap;
    vertical-align: middle;
  }

  html[data-hn-glider-theme] .hng-karma[hidden] {
    display: none !important;
  }

  html[data-hn-glider-theme] .hng-stats {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    margin-right: 3px;
  }

  html[data-hn-glider-theme] .hng-chip {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    background: var(--hng-chip-bg);
    color: var(--hng-text-dim);
    font-weight: 600;
    font-size: 10.5px;
    line-height: 1;
    padding: 2px 6px;
    border-radius: 999px;
    text-decoration: none !important;
    white-space: nowrap;
  }

  html[data-hn-glider-theme] .hng-chip.hng-chip-points {
    background: var(--hng-chip-up-bg);
    color: var(--hng-chip-up-ink);
  }

  html[data-hn-glider-theme] .hng-chip svg {
    width: 9px;
    height: 9px;
    flex-shrink: 0;
    display: block;
  }

  /* ---------- Comment page ---------- */
  html[data-hn-glider-theme] tr.athing.comtr {
    background: transparent !important;
  }

  /* Story header and comment tree share one width so the title, the
     add-comment box and top-level comment cards line up. */
  html[data-hn-glider-theme] table.fatitem,
  html[data-hn-glider-theme] .comment-tree,
  html[data-hn-glider-theme] table.comment-tree {
    width: 100% !important;
    box-sizing: border-box !important;
    padding: 0 8px;
  }

  html[data-hn-glider-theme] .commtext {
    color: var(--hng-text) !important;
    font-size: 13.5px;
    line-height: 1.55;
  }

  html[data-hn-glider-theme] .comhead {
    color: var(--hng-text-faint) !important;
    font-size: 11.5px;
  }

  html[data-hn-glider-theme] .comhead a {
    color: var(--hng-text-dim) !important;
    text-decoration: none;
  }

  html[data-hn-glider-theme] .comhead a:hover {
    text-decoration: underline;
  }

  html[data-hn-glider-theme] .commtext a {
    color: var(--hng-accent) !important;
  }

  html[data-hn-glider-theme] .commtext pre {
    background: var(--hng-surface-2) !important;
    border: 1px solid var(--hng-border);
    border-radius: var(--hng-radius-sm);
    padding: 8px;
    overflow-x: auto;
  }

  html[data-hn-glider-theme] .comment {
    background: var(--hng-surface) !important;
    border-radius: var(--hng-radius-sm);
    padding: 6px 9px !important;
    box-shadow: var(--hng-shadow);
  }

  /* Glider-esque indent guides instead of spacer gifs */
  html[data-hn-glider-theme] .ind {
    position: relative;
  }

  html[data-hn-glider-theme] .comtr .ind img {
    filter: none;
  }

  html[data-hn-glider-theme] tr.athing.comtr > td.default {
    padding: 3px 0;
  }

  html[data-hn-glider-theme] .togg {
    color: var(--hng-text-faint) !important;
  }

  /* ---------- User profile ---------- */
  html.hng-user-page[data-hn-glider-theme] .hng-profile-old-row {
    display: none !important;
  }

  html.hng-user-page[data-hn-glider-theme] #bigbox > td {
    width: 100% !important;
    box-sizing: border-box;
  }

  html.hng-user-page[data-hn-glider-theme] #bigbox > td > table,
  html.hng-user-page[data-hn-glider-theme] #bigbox > td > form {
    width: 100% !important;
    max-width: 720px !important;
    margin-left: auto !important;
    margin-right: auto !important;
    box-sizing: border-box !important;
  }

  html.hng-user-page[data-hn-glider-theme] textarea {
    display: block !important;
    width: 100% !important;
    max-width: 100% !important;
    min-height: 150px !important;
    box-sizing: border-box !important;
    resize: vertical !important;
  }

  html.hng-user-page[data-hn-glider-theme] #bigbox > td > br {
    display: none !important;
  }

  html.hng-user-page[data-hn-glider-theme] .hng-profile {
    width: 100%;
    max-width: 720px;
    margin: 18px auto 12px auto;
    padding: 22px;
    box-sizing: border-box;
    background: var(--hng-surface);
    border: 1px solid var(--hng-border);
    border-radius: var(--hng-radius);
    box-shadow: var(--hng-shadow);
  }

  html.hng-user-page[data-hn-glider-theme] .hng-profile-head {
    display: flex;
    align-items: center;
    gap: 14px;
    flex-wrap: wrap;
  }

  html.hng-user-page[data-hn-glider-theme] .hng-profile-avatar {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 54px;
    height: 54px;
    border-radius: 16px;
    background: linear-gradient(135deg, var(--hng-accent), #ff9a52);
    color: #fff;
    font-size: 19px;
    font-weight: 700;
    letter-spacing: 0.5px;
    box-shadow: 0 4px 12px rgba(255, 102, 0, 0.22);
  }

  /* Profile header uses the user's pixel avatar instead of initials. */
  html.hng-user-page[data-hn-glider-theme] svg.hng-profile-avatar.hng-avatar {
    display: block;
    background: hsl(var(--hng-av-h, 0) var(--hng-av-bg-s) var(--hng-av-bg-l));
    box-shadow: var(--hng-shadow);
  }

  html.hng-user-page[data-hn-glider-theme] .hng-profile-identity {
    flex: 1 1 180px;
    min-width: 0;
  }

  html.hng-user-page[data-hn-glider-theme] .hng-profile-name {
    margin: 0;
    color: var(--hng-text);
    font-size: 22px;
    line-height: 1.15;
    font-weight: 700;
  }

  html.hng-user-page[data-hn-glider-theme] .hng-profile-name a {
    color: var(--hng-text) !important;
    text-decoration: none;
  }

  html.hng-user-page[data-hn-glider-theme] .hng-profile-name a:hover {
    text-decoration: underline;
  }

  html.hng-user-page[data-hn-glider-theme] .hng-profile-joined {
    margin-top: 4px;
    color: var(--hng-text-faint);
    font-size: 12px;
  }

  html.hng-user-page[data-hn-glider-theme] .hng-profile-joined a {
    color: var(--hng-text-faint) !important;
    text-decoration: none;
  }

  html.hng-user-page[data-hn-glider-theme] .hng-profile-joined a:hover {
    color: var(--hng-text-dim) !important;
    text-decoration: underline;
  }

  html.hng-user-page[data-hn-glider-theme] .hng-profile-karma {
    display: inline-flex;
    align-items: baseline;
    gap: 4px;
    margin-top: 5px;
    padding: 0;
    background: transparent;
    color: var(--hng-text-faint);
    line-height: 1.2;
  }

  html.hng-user-page[data-hn-glider-theme] .hng-profile-karma strong {
    color: var(--hng-text-dim);
    font-size: 12px;
    font-weight: 700;
  }

  html.hng-user-page[data-hn-glider-theme] .hng-profile-karma span {
    margin-top: 0;
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0;
    text-transform: lowercase;
  }

  html.hng-user-page[data-hn-glider-theme] .hng-profile-about {
    margin-top: 18px;
    padding-top: 16px;
    border-top: 1px solid var(--hng-border);
    color: var(--hng-text);
    font-size: 13.5px;
    line-height: 1.6;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  html.hng-user-page[data-hn-glider-theme] .hng-profile-about a {
    color: var(--hng-accent) !important;
    text-decoration: none;
  }

  html.hng-user-page[data-hn-glider-theme] .hng-profile-about a:hover {
    text-decoration: underline;
  }

  html.hng-user-page[data-hn-glider-theme] .hng-profile-actions {
    display: flex;
    align-items: center;
    flex-wrap: nowrap;
    gap: 6px;
    margin-top: 16px;
    padding-bottom: 2px;
    overflow-x: auto;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
  }

  html.hng-user-page[data-hn-glider-theme] .hng-profile-actions::-webkit-scrollbar {
    display: none;
  }

  html.hng-user-page[data-hn-glider-theme] .hng-profile-actions a {
    display: inline-flex;
    align-items: center;
    flex: 0 0 auto;
    gap: 4px;
    padding: 6px 10px;
    border-radius: 999px;
    background: var(--hng-chip-bg);
    color: var(--hng-text-dim) !important;
    font-size: 11.5px;
    font-weight: 600;
    text-decoration: none;
    white-space: nowrap;
    transition: background 0.12s ease, color 0.12s ease;
  }

  html.hng-user-page[data-hn-glider-theme] .hng-profile-actions a:hover {
    background: var(--hng-chip-up-bg);
    color: var(--hng-chip-up-ink) !important;
  }

  /* ---------- Profile settings form (own profile) ---------- */
  html.hng-user-page[data-hn-glider-theme] .hng-profile form.hng-profile-form {
    display: block !important;
    width: 100% !important;
    max-width: none !important;
    margin: 18px 0 0 0 !important;
    padding: 16px 0 0 0;
    border-top: 1px solid var(--hng-border);
    box-sizing: border-box;
  }

  html.hng-user-page[data-hn-glider-theme] .hng-profile-form table.hng-profile-fields {
    width: 100% !important;
    max-width: none !important;
    margin: 0 !important;
    border-collapse: separate !important;
    border-spacing: 0 10px !important;
  }

  html.hng-user-page[data-hn-glider-theme] .hng-profile-fields td {
    padding: 0 !important;
    vertical-align: top;
    color: var(--hng-text);
  }

  html.hng-user-page[data-hn-glider-theme] .hng-profile-fields td.hng-field-label {
    width: 96px;
    padding: 8px 14px 0 0 !important;
    color: var(--hng-text-dim);
    font-size: 12px;
    font-weight: 600;
    text-align: left;
    white-space: nowrap;
  }

  html.hng-user-page[data-hn-glider-theme] .hng-profile-fields td.hng-field-label label {
    cursor: pointer;
  }

  html.hng-user-page[data-hn-glider-theme] .hng-profile-fields tr.hng-field-checkbox > td {
    vertical-align: middle;
  }

  html.hng-user-page[data-hn-glider-theme] .hng-profile-fields tr.hng-field-checkbox > td.hng-field-label {
    padding-top: 0 !important;
  }

  html.hng-user-page[data-hn-glider-theme] .hng-profile-fields input[type="text"],
  html.hng-user-page[data-hn-glider-theme] .hng-profile-fields input:not([type]) {
    width: 100% !important;
    max-width: 180px !important;
    box-sizing: border-box !important;
  }

  html.hng-user-page[data-hn-glider-theme] .hng-profile-fields input[name="uemail"] {
    max-width: none !important;
  }

  html.hng-user-page[data-hn-glider-theme] .hng-profile-fields a[href="formatdoc"] {
    display: inline-block;
    margin-top: 4px;
    font-size: 11px;
    color: var(--hng-text-faint) !important;
    text-decoration: none;
  }

  html.hng-user-page[data-hn-glider-theme] .hng-profile-fields a[href="formatdoc"] font {
    color: inherit !important;
  }

  html.hng-user-page[data-hn-glider-theme] .hng-email-note {
    margin-top: 5px;
    color: var(--hng-text-faint);
    font-size: 11px;
    line-height: 1.4;
  }

  html.hng-user-page[data-hn-glider-theme] select.hng-select-hidden {
    display: none !important;
  }

  html.hng-user-page[data-hn-glider-theme] input.hng-checkbox {
    display: inline-grid !important;
    place-content: center !important;
    flex-shrink: 0 !important;
    width: 18px !important;
    height: 18px !important;
    margin: 0 !important;
    padding: 0 !important;
    border: 1px solid var(--hng-border) !important;
    border-radius: 4px !important;
    background: var(--hng-surface-2) !important;
    cursor: pointer;
    vertical-align: middle;
    -webkit-appearance: none !important;
    appearance: none !important;
    transition: background 0.12s ease, border-color 0.12s ease;
  }

  html.hng-user-page[data-hn-glider-theme] input.hng-checkbox::before {
    content: "";
    width: 11px;
    height: 11px;
    background: #fff;
    clip-path: polygon(14% 44%, 0 65%, 45% 100%, 100% 16%, 82% 0, 43% 62%);
    transform: scale(0);
    transform-origin: center;
    transition: transform 0.1s ease;
  }

  html.hng-user-page[data-hn-glider-theme] input.hng-checkbox:checked {
    border-color: var(--hng-accent) !important;
    background: var(--hng-accent) !important;
  }

  html.hng-user-page[data-hn-glider-theme] input.hng-checkbox:checked::before {
    transform: scale(1);
  }

  html.hng-user-page[data-hn-glider-theme] input.hng-checkbox:focus-visible {
    outline: 2px solid var(--hng-accent) !important;
    outline-offset: 2px !important;
  }

  html.hng-user-page[data-hn-glider-theme] .hng-profile-form-actions {
    display: flex;
    justify-content: flex-end;
    margin-top: 6px;
  }

  html.hng-user-page[data-hn-glider-theme] .hng-profile-form-actions input[type="submit"] {
    margin: 0 !important;
  }

  html.hng-user-page[data-hn-glider-theme] .hng-profile-export-panel {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 16px;
    margin-top: 18px;
    padding-top: 16px;
    border-top: 1px solid var(--hng-border);
  }

  html.hng-user-page[data-hn-glider-theme] .hng-profile-export-copy {
    flex: 1 1 300px;
    min-width: 0;
  }

  html.hng-user-page[data-hn-glider-theme] .hng-profile-export-copy h2 {
    margin: 0;
    color: var(--hng-text);
    font-size: 14px;
    font-weight: 700;
  }

  html.hng-user-page[data-hn-glider-theme] .hng-profile-export-copy p {
    margin: 3px 0 0 0;
    color: var(--hng-text-faint);
    font-size: 11.5px;
    line-height: 1.45;
  }

  html.hng-user-page[data-hn-glider-theme] button.hng-profile-export {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    flex-shrink: 0;
    padding: 8px 14px;
    border: 0;
    border-radius: 8px;
    background: var(--hng-accent);
    color: #fff;
    font-family: var(--hng-font);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.12s ease, color 0.12s ease, opacity 0.12s ease;
  }

  html.hng-user-page[data-hn-glider-theme] button.hng-profile-export:hover {
    background: var(--hng-chip-up-ink);
    color: #fff;
  }

  html.hng-user-page[data-hn-glider-theme] button.hng-profile-export:disabled {
    opacity: 0.55;
    cursor: wait;
  }

  html.hng-user-page[data-hn-glider-theme] button.hng-profile-export svg {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
  }

  html.hng-user-page[data-hn-glider-theme] button.hng-profile-export span {
    white-space: nowrap;
  }

  html.hng-user-page[data-hn-glider-theme] .hng-profile-export-only {
    margin-top: 0 !important;
  }

  html.hng-user-page[data-hn-glider-theme] .hng-profile-export-only .hng-profile-export-panel {
    margin-top: 0;
    padding-top: 0;
    border-top: 0;
  }

  html.hng-user-page[data-hn-glider-theme] .hng-profile-actions svg {
    width: 12px;
    height: 12px;
    flex-shrink: 0;
  }

  html.hng-user-page[data-hn-glider-theme] .hng-profile-action-favorites svg {
    fill: none;
  }

  @media (max-width: 560px) {
    html.hng-user-page[data-hn-glider-theme] .hng-profile {
      margin: 16px 8px 24px 8px;
      padding: 18px;
    }

    html.hng-user-page[data-hn-glider-theme] .hng-profile-form table.hng-profile-fields,
    html.hng-user-page[data-hn-glider-theme] .hng-profile-fields tbody {
      display: block;
    }

    html.hng-user-page[data-hn-glider-theme] .hng-profile-fields tr {
      display: block;
      margin-bottom: 12px;
    }

    html.hng-user-page[data-hn-glider-theme] .hng-profile-fields td {
      display: block;
    }

    html.hng-user-page[data-hn-glider-theme] .hng-profile-fields td.hng-field-label {
      width: auto;
      padding: 0 0 4px 0 !important;
    }

    html.hng-user-page[data-hn-glider-theme] .hng-profile-fields tr.hng-field-checkbox {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    html.hng-user-page[data-hn-glider-theme] .hng-profile-fields tr.hng-field-checkbox > td.hng-field-label {
      padding: 0 !important;
    }
  }

  /* ---------- Algolia search page ---------- */
  html.hng-algolia[data-hn-glider-theme] body {
    background: var(--hng-bg) !important;
  }

  html.hng-algolia[data-hn-glider-theme] main > div,
  html.hng-algolia[data-hn-glider-theme] .experimental,
  html.hng-algolia[data-hn-glider-theme] .default {
    background: transparent !important;
    color: var(--hng-text) !important;
  }

  html.hng-algolia[data-hn-glider-theme] .container {
    width: 100% !important;
    max-width: 800px !important;
    margin: 0 auto !important;
    padding: 0 8px !important;
    box-sizing: border-box !important;
  }

  html.hng-algolia[data-hn-glider-theme] .SearchHeader.container {
    position: sticky !important;
    top: 0 !important;
    z-index: 50 !important;
    padding: 8px 0 6px 0 !important;
    background: var(--hng-bg) !important;
  }

  html.hng-algolia[data-hn-glider-theme] .SearchHeader_search {
    display: flex !important;
    align-items: center !important;
    justify-content: flex-start !important;
    gap: 8px !important;
    height: auto !important;
    min-height: 40px !important;
    padding: 6px 10px !important;
    box-sizing: border-box !important;
    background: var(--hng-surface) !important;
    border: 1px solid var(--hng-border) !important;
    border-radius: var(--hng-radius-sm) !important;
    box-shadow: var(--hng-shadow) !important;
  }

  html.hng-algolia[data-hn-glider-theme] .SearchHeader_logo {
    flex: 0 0 auto !important;
    max-width: none !important;
    display: flex !important;
    align-items: center !important;
    gap: 6px !important;
  }

  html.hng-algolia[data-hn-glider-theme] .SearchHeader_logo img {
    width: 24px !important;
    margin-right: 0 !important;
    border-radius: 5px !important;
  }

  html.hng-algolia[data-hn-glider-theme] .SearchHeader_label {
    color: var(--hng-text) !important;
    font-size: 11px !important;
    line-height: 1.1 !important;
    font-weight: 700 !important;
    white-space: nowrap;
  }

  html.hng-algolia[data-hn-glider-theme] .SearchHeader_container {
    position: relative !important;
    display: flex !important;
    align-items: center !important;
    flex: 1 1 220px !important;
    width: auto !important;
    min-width: 0 !important;
    margin: 0 !important;
  }

  html.hng-algolia[data-hn-glider-theme] .SearchHeader .SearchIcon {
    left: 10px !important;
    top: 50% !important;
    transform: translateY(-50%) !important;
    color: var(--hng-text-faint) !important;
    font-size: 0 !important;
    pointer-events: none;
  }

  html.hng-algolia[data-hn-glider-theme] .SearchHeader .SearchIcon svg {
    width: 14px;
    height: 14px;
  }

  html.hng-algolia[data-hn-glider-theme] .SearchInput {
    flex: 1 1 auto !important;
    width: 100% !important;
    height: 30px !important;
    padding: 0 12px 0 32px !important;
    box-sizing: border-box !important;
    border: 1px solid var(--hng-border) !important;
    border-radius: 999px !important;
    background: var(--hng-surface-2) !important;
    color: var(--hng-text) !important;
    font-family: var(--hng-font) !important;
    font-size: 12px !important;
    font-weight: 400 !important;
    box-shadow: none !important;
  }

  html.hng-algolia[data-hn-glider-theme] .SearchInput::placeholder {
    color: var(--hng-text-faint) !important;
  }

  html.hng-algolia[data-hn-glider-theme] .SearchInput:focus {
    border-color: var(--hng-accent) !important;
    box-shadow: 0 0 0 2px rgba(255, 102, 0, 0.14) !important;
    outline: none !important;
  }

  html.hng-algolia[data-hn-glider-theme] .SearchHeader .PoweredBy {
    position: static !important;
    transform: none !important;
    display: flex !important;
    align-items: center !important;
    margin-left: 2px !important;
    color: var(--hng-text-faint) !important;
    font-size: 0 !important;
    white-space: nowrap;
  }

  html.hng-algolia[data-hn-glider-theme] .SearchHeader .PoweredBy > span {
    display: none !important;
  }

  html.hng-algolia[data-hn-glider-theme] .SearchHeader .PoweredBy a {
    margin: 0 3px !important;
  }

  html.hng-algolia[data-hn-glider-theme] .SearchHeader .PoweredBy img {
    height: 10px !important;
    opacity: 0.72;
  }

  html.hng-algolia[data-hn-glider-theme] .SearchInput::-webkit-search-cancel-button {
    display: none !important;
    -webkit-appearance: none;
    appearance: none;
  }

  html.hng-algolia[data-hn-glider-theme] .SearchHeader .hng-search-clear {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 22px;
    width: 22px;
    height: 22px;
    padding: 0;
    border: 0;
    border-radius: 999px;
    background: transparent;
    color: var(--hng-text-faint);
    cursor: pointer;
    transition: background 0.12s ease, color 0.12s ease;
  }

  html.hng-algolia[data-hn-glider-theme] .SearchHeader .hng-search-clear[hidden] {
    display: none !important;
  }

  html.hng-algolia[data-hn-glider-theme] .SearchHeader .hng-search-clear:hover {
    background: var(--hng-chip-bg);
    color: var(--hng-accent);
  }

  html.hng-algolia[data-hn-glider-theme] .SearchHeader .hng-search-clear svg {
    width: 12px;
    height: 12px;
    display: block;
  }

  html.hng-algolia[data-hn-glider-theme] .SearchHeader_settings {
    display: flex !important;
    align-items: center !important;
    gap: 4px !important;
    margin: 0 !important;
    font-size: 0 !important;
  }

  html.hng-algolia[data-hn-glider-theme] .SearchHeader_settings a {
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    width: 30px !important;
    min-width: 30px !important;
    height: 30px !important;
    padding: 0 !important;
    border-radius: var(--hng-radius-sm) !important;
    color: var(--hng-text-dim) !important;
    background: transparent !important;
  }

  html.hng-algolia[data-hn-glider-theme] .SearchHeader_settings a:hover {
    background: var(--hng-chip-bg) !important;
    color: var(--hng-accent) !important;
  }

  html.hng-algolia[data-hn-glider-theme] .SearchHeader_settings svg {
    width: 16px !important;
    height: 16px !important;
    margin: 0 !important;
    color: currentColor !important;
  }

  html.hng-algolia[data-hn-glider-theme] .SearchHeader .hng-toggle {
    flex-shrink: 0;
    margin-left: auto;
  }

  /* Algolia filters */
  html.hng-algolia[data-hn-glider-theme] .SearchFilters {
    position: static !important;
    top: auto !important;
    height: auto !important;
    min-height: 38px !important;
    margin: 0 0 6px 0 !important;
    padding: 5px 10px !important;
    box-sizing: border-box !important;
    background: var(--hng-surface) !important;
    border: 1px solid var(--hng-border) !important;
    border-radius: var(--hng-radius-sm) !important;
    box-shadow: var(--hng-shadow) !important;
    color: var(--hng-text-dim) !important;
    z-index: 1 !important;
  }

  html.hng-algolia[data-hn-glider-theme] .SearchFilters_text,
  html.hng-algolia[data-hn-glider-theme] .SearchFilters_engineProcessingTime,
  html.hng-algolia[data-hn-glider-theme] .SearchFilters_meta {
    color: var(--hng-text-faint) !important;
    font-size: 11px !important;
  }

  html.hng-algolia[data-hn-glider-theme] .SearchFilters .Dropdown {
    position: relative;
    margin-left: 4px !important;
  }

  html.hng-algolia[data-hn-glider-theme] .SearchFilters .Dropdown_label {
    display: inline-flex !important;
    align-items: center !important;
    gap: 3px !important;
    padding: 4px 8px !important;
    border: 0 !important;
    border-radius: 6px !important;
    background: var(--hng-chip-bg) !important;
    color: var(--hng-text) !important;
    font-size: 11.5px !important;
    cursor: pointer;
  }

  html.hng-algolia[data-hn-glider-theme] .SearchFilters .Dropdown_label svg {
    width: 12px !important;
    height: 12px !important;
  }

  html.hng-algolia[data-hn-glider-theme] .SearchFilters .Dropdown_list {
    min-width: 130px;
    margin: 4px 0 0 0 !important;
    padding: 4px !important;
    list-style: none;
    background: var(--hng-surface) !important;
    border: 1px solid var(--hng-border) !important;
    border-radius: 8px !important;
    box-shadow: var(--hng-shadow) !important;
    z-index: 60 !important;
  }

  html.hng-algolia[data-hn-glider-theme] .SearchFilters .Dropdown_list li button {
    width: 100%;
    padding: 6px 8px !important;
    border: 0 !important;
    border-radius: 5px !important;
    background: transparent !important;
    color: var(--hng-text-dim) !important;
    font-size: 11.5px !important;
    text-align: left;
    cursor: pointer;
  }

  html.hng-algolia[data-hn-glider-theme] .SearchFilters .Dropdown_list li button:hover {
    background: var(--hng-chip-bg) !important;
    color: var(--hng-text) !important;
  }

  html.hng-algolia[data-hn-glider-theme] .SearchFilters_menu {
    background: var(--hng-surface) !important;
    border: 1px solid var(--hng-border) !important;
    box-shadow: var(--hng-shadow) !important;
  }

  html.hng-algolia[data-hn-glider-theme] .SearchFilters_menu li a {
    color: var(--hng-text-dim) !important;
  }

  html.hng-algolia[data-hn-glider-theme] .SearchFilters_menu li a:hover,
  html.hng-algolia[data-hn-glider-theme] .SearchFilters_menu li a.active {
    background: var(--hng-chip-bg) !important;
    color: var(--hng-text) !important;
  }

  /* Algolia result cards */
  html.hng-algolia[data-hn-glider-theme] .SearchResults {
    min-height: 0 !important;
    padding: 0 !important;
    background: transparent !important;
  }

  html.hng-algolia[data-hn-glider-theme] .SearchResults_container {
    display: flex !important;
    flex-direction: column !important;
    gap: 4px !important;
    border-radius: 0 !important;
  }

  html.hng-algolia[data-hn-glider-theme] .Story {
    display: block !important;
    min-height: 0 !important;
    margin: 0 !important;
    padding: 10px 12px !important;
    box-sizing: border-box !important;
    background: var(--hng-surface) !important;
    border: 1px solid var(--hng-border) !important;
    border-radius: var(--hng-radius-sm) !important;
    box-shadow: var(--hng-shadow) !important;
  }

  html.hng-algolia[data-hn-glider-theme] .Story_container {
    display: flex !important;
    align-items: flex-start !important;
    width: 100% !important;
  }

  html.hng-algolia[data-hn-glider-theme] .Story_image {
    display: none !important;
  }

  html.hng-algolia[data-hn-glider-theme] .Story_data {
    width: 100% !important;
    min-width: 0 !important;
    margin: 0 !important;
  }

  html.hng-algolia[data-hn-glider-theme] .Story_title {
    width: 100% !important;
    margin: 0 0 3px 0 !important;
  }

  html.hng-algolia[data-hn-glider-theme] .Story_title a {
    color: var(--hng-text) !important;
    font-size: 13.5px !important;
    font-weight: 600 !important;
    text-decoration: none !important;
  }

  html.hng-algolia[data-hn-glider-theme] .Story_title a:hover {
    text-decoration: underline !important;
  }

  html.hng-algolia[data-hn-glider-theme] .Story_title .Story_link {
    color: var(--hng-text-faint) !important;
    font-size: 11.5px !important;
  }

  html.hng-algolia[data-hn-glider-theme] .Story_meta {
    color: var(--hng-text-faint) !important;
    font-size: 11px !important;
  }

  html.hng-algolia[data-hn-glider-theme] .Story_meta a {
    color: var(--hng-text-dim) !important;
  }

  html.hng-algolia[data-hn-glider-theme] .Story_separator {
    margin: 0 4px !important;
    color: var(--hng-text-faint) !important;
  }

  html.hng-algolia[data-hn-glider-theme] .Story_comment {
    padding: 6px 0 0 0 !important;
    color: var(--hng-text) !important;
    font-size: 12.5px !important;
    line-height: 1.55 !important;
    background: transparent !important;
  }

  html.hng-algolia[data-hn-glider-theme] .Story_comment a {
    color: var(--hng-accent) !important;
  }

  html.hng-algolia[data-hn-glider-theme] .Story em {
    background: var(--hng-chip-up-bg) !important;
    color: var(--hng-chip-up-ink) !important;
    font-style: normal !important;
  }

  html.hng-algolia[data-hn-glider-theme] .NoResults {
    padding: 24px !important;
    background: var(--hng-surface) !important;
    border: 1px solid var(--hng-border) !important;
    border-radius: var(--hng-radius-sm) !important;
    box-shadow: var(--hng-shadow) !important;
    color: var(--hng-text-dim) !important;
  }

  html.hng-algolia[data-hn-glider-theme] .NoResults a {
    color: var(--hng-accent) !important;
  }

  /* Algolia pagination + footer */
  html.hng-algolia[data-hn-glider-theme] .Pagination {
    gap: 3px;
    padding: 12px 0 4px 0 !important;
    margin-top: 4px !important;
    background: transparent !important;
  }

  html.hng-algolia[data-hn-glider-theme] .Pagination_item button {
    min-width: 30px !important;
    height: 28px !important;
    border: 1px solid var(--hng-border) !important;
    border-radius: 999px !important;
    background: var(--hng-surface) !important;
    color: var(--hng-text-dim) !important;
    font-size: 11.5px !important;
    cursor: pointer;
  }

  html.hng-algolia[data-hn-glider-theme] .Pagination_item-current button {
    border-color: var(--hng-accent) !important;
    background: var(--hng-accent) !important;
    color: #fff !important;
  }

  html.hng-algolia[data-hn-glider-theme] .Pagination svg {
    width: 12px !important;
    height: 12px !important;
  }

  html.hng-algolia[data-hn-glider-theme] .Footer {
    padding: 8px 0 20px 0 !important;
    background: transparent !important;
  }

  html.hng-algolia[data-hn-glider-theme] .Footer_list li,
  html.hng-algolia[data-hn-glider-theme] .Footer_list a {
    color: var(--hng-text-faint) !important;
    font-size: 11.5px !important;
  }

  html.hng-algolia[data-hn-glider-theme] .Footer_list a:hover {
    color: var(--hng-accent) !important;
  }

  html.hng-algolia[data-hn-glider-theme] .Sidebar {
    display: none !important;
  }

  @media (max-width: 700px) {
    html.hng-algolia[data-hn-glider-theme] .SearchHeader_label,
    html.hng-algolia[data-hn-glider-theme] .SearchHeader .PoweredBy {
      display: none !important;
    }

    html.hng-algolia[data-hn-glider-theme] .SearchHeader_search {
      gap: 6px !important;
      padding: 5px 8px !important;
    }

    html.hng-algolia[data-hn-glider-theme] .Story {
      padding: 9px 10px !important;
    }
  }

  /* Algolia settings page */
  html.hng-algolia[data-hn-glider-theme] .SearchHeader_settings a.SearchHeader_back {
    width: auto !important;
    min-width: 0 !important;
    height: 30px !important;
    padding: 0 10px !important;
    gap: 5px !important;
    font-size: 12px !important;
    font-weight: 600 !important;
    color: var(--hng-text-dim) !important;
  }

  html.hng-algolia[data-hn-glider-theme] .SearchHeader_back svg {
    width: 14px !important;
    height: 14px !important;
    margin: 0 !important;
  }

  html.hng-algolia[data-hn-glider-theme] .SearchFilters-settings {
    justify-content: flex-start !important;
  }

  html.hng-algolia[data-hn-glider-theme] .SearchFilters_settings {
    margin: 0 !important;
    color: var(--hng-text) !important;
    font-size: 12px !important;
    font-weight: 700 !important;
  }

  html.hng-algolia[data-hn-glider-theme] .Settings {
    width: 100% !important;
    margin: 0 0 24px 0 !important;
    padding: 0 !important;
    background: transparent !important;
    color: var(--hng-text) !important;
  }

  html.hng-algolia[data-hn-glider-theme] .Settings form {
    display: flex !important;
    flex-direction: column !important;
    gap: 10px !important;
  }

  html.hng-algolia[data-hn-glider-theme] .Settings_fieldset {
    margin: 0 !important;
    padding: 18px !important;
    box-sizing: border-box !important;
    background: var(--hng-surface) !important;
    border: 1px solid var(--hng-border) !important;
    border-radius: var(--hng-radius-sm) !important;
    box-shadow: var(--hng-shadow) !important;
  }

  html.hng-algolia[data-hn-glider-theme] .Settings_display {
    margin: 0 0 12px 0 !important;
    padding-bottom: 10px !important;
    color: var(--hng-text) !important;
    font-size: 15px !important;
    font-weight: 700 !important;
    border-bottom: 1px solid var(--hng-border) !important;
  }

  html.hng-algolia[data-hn-glider-theme] .Settings_row {
    display: flex !important;
    align-items: center !important;
    justify-content: space-between !important;
    gap: 16px !important;
    padding: 9px 0 !important;
    border-top: 1px solid var(--hng-border) !important;
  }

  html.hng-algolia[data-hn-glider-theme] .Settings_row + .Settings_row {
    border-top: 1px solid var(--hng-border) !important;
  }

  html.hng-algolia[data-hn-glider-theme] .Settings_display + .Settings_row {
    border-top: 0 !important;
  }

  html.hng-algolia[data-hn-glider-theme] .Settings_row > label {
    flex: 1 1 auto !important;
    width: auto !important;
    margin-right: 0 !important;
    color: var(--hng-text-dim) !important;
    font-size: 12.5px !important;
    line-height: 1.35 !important;
    text-align: left !important;
  }

  html.hng-algolia[data-hn-glider-theme] .Settings_inputContainer {
    flex: 0 0 auto !important;
    width: auto !important;
  }

  html.hng-algolia[data-hn-glider-theme] .Settings_inputContainer select,
  html.hng-algolia[data-hn-glider-theme] .Settings_inputContainer input[type="text"] {
    height: 31px !important;
    min-width: 150px !important;
    padding: 0 9px !important;
    box-sizing: border-box !important;
    background: var(--hng-surface-2) !important;
    border: 1px solid var(--hng-border) !important;
    border-radius: 6px !important;
    color: var(--hng-text) !important;
    font-family: var(--hng-font) !important;
    font-size: 12px !important;
  }

  html.hng-algolia[data-hn-glider-theme] .Settings_inputContainer input[type="checkbox"] {
    display: inline-grid !important;
    place-content: center !important;
    flex-shrink: 0 !important;
    width: 18px !important;
    height: 18px !important;
    margin: 0 !important;
    padding: 0 !important;
    border: 1px solid var(--hng-border) !important;
    border-radius: 4px !important;
    background: var(--hng-surface-2) !important;
    cursor: pointer;
    -webkit-appearance: none !important;
    appearance: none !important;
  }

  html.hng-algolia[data-hn-glider-theme] .Settings_inputContainer input[type="checkbox"]::before {
    content: "" !important;
    width: 11px !important;
    height: 11px !important;
    background: #fff !important;
    clip-path: polygon(14% 44%, 0 65%, 45% 100%, 100% 16%, 82% 0, 43% 62%);
    transform: scale(0);
    transform-origin: center;
    transition: transform 0.1s ease;
  }

  html.hng-algolia[data-hn-glider-theme] .Settings_inputContainer input[type="checkbox"]:checked {
    border-color: var(--hng-accent) !important;
    background: var(--hng-accent) !important;
  }

  html.hng-algolia[data-hn-glider-theme] .Settings_inputContainer input[type="checkbox"]:checked::before {
    transform: scale(1);
  }

  html.hng-algolia[data-hn-glider-theme] .Settings_inputContainer input[type="checkbox"]:focus-visible {
    outline: 2px solid var(--hng-accent) !important;
    outline-offset: 2px !important;
  }

  html.hng-algolia[data-hn-glider-theme] .Settings_inputContainer input[type="checkbox"]:disabled {
    opacity: 0.5 !important;
    cursor: not-allowed !important;
  }

  html.hng-algolia[data-hn-glider-theme] .Settings_actions {
    display: flex !important;
    justify-content: flex-end !important;
    margin-top: 4px !important;
    padding: 0 !important;
    background: transparent !important;
  }

  html.hng-algolia[data-hn-glider-theme] .Settings_actions button {
    padding: 8px 18px !important;
    border: 0 !important;
    border-radius: 8px !important;
    background: var(--hng-accent) !important;
    color: #fff !important;
    font-family: var(--hng-font) !important;
    font-size: 12px !important;
    font-weight: 600 !important;
    cursor: pointer;
  }

  html.hng-algolia[data-hn-glider-theme] .Settings_actions button:disabled {
    opacity: 0.45 !important;
    cursor: not-allowed !important;
  }

  @media (max-width: 560px) {
    html.hng-algolia[data-hn-glider-theme] .Settings_fieldset {
      padding: 14px !important;
    }

    html.hng-algolia[data-hn-glider-theme] .Settings_row {
      align-items: flex-start !important;
      flex-direction: column !important;
      gap: 7px !important;
    }

    html.hng-algolia[data-hn-glider-theme] .Settings_inputContainer,
    html.hng-algolia[data-hn-glider-theme] .Settings_inputContainer select,
    html.hng-algolia[data-hn-glider-theme] .Settings_inputContainer input[type="text"] {
      width: 100% !important;
    }
  }

  /* ---------- Misc ---------- */
  html[data-hn-glider-theme] .pagetop {
    color: var(--hng-text-dim) !important;
  }

  html[data-hn-glider-theme] a {
    color: var(--hng-accent);
  }

  html[data-hn-glider-theme] .yclinks a,
  html[data-hn-glider-theme] .toptext {
    color: var(--hng-text-dim) !important;
  }

  html[data-hn-glider-theme] textarea,
  html[data-hn-glider-theme] input[type="text"],
  html[data-hn-glider-theme] input[type="submit"],
  html[data-hn-glider-theme] input[type="password"] {
    background: var(--hng-surface) !important;
    color: var(--hng-text) !important;
    border: 1px solid var(--hng-border) !important;
    border-radius: var(--hng-radius-sm) !important;
    font-family: var(--hng-font) !important;
    padding: 6px 8px !important;
    font-size: 13px !important;
  }

  html[data-hn-glider-theme] select {
    background: var(--hng-surface) !important;
    color: var(--hng-text) !important;
    border: 1px solid var(--hng-border) !important;
    border-radius: var(--hng-radius-sm) !important;
    font-family: var(--hng-font) !important;
    padding: 6px 8px !important;
    font-size: 13px !important;
  }

  html[data-hn-glider-theme] select option {
    background: var(--hng-surface) !important;
    color: var(--hng-text) !important;
  }

  html[data-hn-glider-theme] input[type="submit"] {
    background: var(--hng-accent) !important;
    color: #fff !important;
    border: none !important;
    font-weight: 600 !important;
    cursor: pointer;
    padding: 7px 14px !important;
  }

  /* ---------- Reply / comment forms ---------- */
  /* HN ships textareas with cols="60" and lets a "help" link sit beside
     them; we cap the width, make it responsive, and stack help below. */
  html[data-hn-glider-theme] form textarea,
  html[data-hn-glider-theme] textarea[name="text"] {
    display: block !important;
    width: 100% !important;
    max-width: 600px !important;
    min-height: 120px !important;
    box-sizing: border-box !important;
    resize: vertical !important;
  }

  html[data-hn-glider-theme] form:has(textarea) {
    display: block;
    max-width: 600px;
  }

  html[data-hn-glider-theme] form:has(textarea) br {
    display: none;
  }

  html[data-hn-glider-theme] form:has(textarea) input[type="submit"] {
    display: inline-block;
    margin-top: 8px;
  }

  /* Add-comment / reply form: textarea on top, then one compact row with
     "help" on the left and the submit button on the right. The cell holding
     the form is widened in JS to line up with the comment cards. */
  html[data-hn-glider-theme] form[action$="comment"] {
    display: flex !important;
    flex-flow: row wrap;
    align-items: center;
    gap: 6px 10px;
    width: 100%;
    max-width: none !important;
    margin: 0 !important;
  }

  html[data-hn-glider-theme] form[action$="comment"] textarea {
    order: -1;
    flex: 0 0 100%;
    max-width: none !important;
    margin: 0 !important;
  }

  html[data-hn-glider-theme] form[action$="comment"] > *:not(textarea) {
    margin-top: 0 !important;
    margin-bottom: 0 !important;
  }

  html[data-hn-glider-theme] form[action$="comment"] input[type="submit"] {
    order: 2;
    margin: 0 0 0 auto !important;
    padding: 6px 14px !important;
  }

  html[data-hn-glider-theme] form[action$="comment"] a[href*="formatdoc"],
  html[data-hn-glider-theme] form[action$="comment"] a[href*="formatdoc"] font {
    color: var(--hng-text-faint) !important;
    font-size: 11px;
    text-decoration: none;
  }

  html[data-hn-glider-theme] td.hng-comment-form-cell {
    padding-top: 4px !important;
    padding-bottom: 4px !important;
  }

  /* HN separates the story and the comments with <br>s; use one margin. */
  html[data-hn-glider-theme] table.fatitem ~ br {
    display: none;
  }

  html[data-hn-glider-theme] table.fatitem ~ table.comment-tree {
    margin-top: 14px;
  }

  /* Keep HN's footer divider to a true 1px line. */
  html[data-hn-glider-theme] #hnmain table[cellspacing="0"][cellpadding="1"] {
    height: 1px !important;
    border-collapse: collapse !important;
    line-height: 0 !important;
    font-size: 0 !important;
  }

  html[data-hn-glider-theme] #hnmain table[cellspacing="0"][cellpadding="1"] > tbody > tr > td[bgcolor="#ff6600"] {
    height: 1px !important;
    padding: 0 !important;
    line-height: 0 !important;
    font-size: 0 !important;
    background-color: var(--hng-accent) !important;
  }

  html[data-hn-glider-theme] .yclinks {
    display: block !important;
    margin-top: 6px;
    font-size: 11.5px;
    color: var(--hng-text-faint) !important;
  }

  html[data-hn-glider-theme] table.itemlist tr.athing > td.title:has(span.titleline) {
    padding-bottom: 2px !important;
  }

  .score {
    display: none;
  }
  `;

  try {
    GM_addStyle(css);
  } catch (e) {
    const styleEl = document.createElement('style');
    styleEl.textContent = css;
    document.documentElement.appendChild(styleEl);
  }

  /* ------------------------------------------------------------------
   * 3. ICONS (inline SVG, currentColor-friendly)
   * ------------------------------------------------------------------ */

  const ICON_UP =
    '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 4l8 9h-5v7h-6v-7H4z"/></svg>';
  const ICON_COMMENT =
    '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 4h16v12H7l-3 3z"/></svg>';
  const ICON_SUN =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
  const ICON_MOON =
    '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.5 14.5a8.5 8.5 0 1 1-9-13 7 7 0 0 0 9 13z"/></svg>';
  const ICON_AUTO =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a10 10 0 1 0 0 20z" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="9.5"/></svg>';
  const ICON_SEARCH =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>';
  const ICON_HEART =
    '<svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>';
  const ICON_LIST =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h10"/></svg>';
  const ICON_X =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  const ICON_DOWNLOAD =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M5 21h14"/></svg>';
  const ICON_NAV_NEW =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 16l.7 1.8L21.5 18.5l-1.8.7L19 21l-.7-1.8L16.5 18.5l1.8-.7z"/></svg>';
  const ICON_NAV_COMMENT =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/></svg>';
  const ICON_NAV_ASK =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9.1 9a3 3 0 1 1 4.9 2.4c-.9.6-2 1.1-2 2.1v.5"/><circle cx="12" cy="17" r="1" fill="currentColor" stroke="none"/></svg>';
  const ICON_NAV_SHOW =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M10 8l6 4-6 4z" fill="currentColor" stroke="none"/></svg>';
  const ICON_NAV_JOB =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18"/></svg>';
  const ICON_NAV_SUBMIT =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg>';
  const ICON_NAV_CATCHUP =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 19l-7-7 7-7M20 19l-7-7 7-7"/></svg>';

  /* ------------------------------------------------------------------
   * 4. TOP BAR REBUILD
   * ------------------------------------------------------------------
   * Stock HN header is a single orange table row. We hide it (done in
   * CSS above) and render a clean replacement with the same links, plus
   * the theme toggle, so nothing functional is lost.
   * ------------------------------------------------------------------ */

  function getUsernameFromHref(href) {
    try {
      const url = new URL(href || '', location.origin);
      if (url.pathname !== '/user') return null;
      return url.searchParams.get('id');
    } catch (e) {
      return null;
    }
  }

  function isHNLoginOrUserHref(href) {
    try {
      const url = new URL(href || '', location.origin);
      return url.pathname === '/login' || url.pathname === '/user';
    } catch (e) {
      return /^(?:\/)?(login|user\?id=)/.test(href || '');
    }
  }

  function buildUserActions(username) {
    const wrap = document.createElement('div');
    wrap.className = 'hng-user-actions';

    const actions = [
      {
        className: 'hng-user-action-upvoted',
        href: 'upvoted?id=' + encodeURIComponent(username),
        commentsHref: 'upvoted?id=' + encodeURIComponent(username) + '&comments=t',
        icon: ICON_UP,
        label: 'Upvoted submissions',
      },
      {
        className: 'hng-user-action-favorites',
        href: 'favorites?id=' + encodeURIComponent(username),
        commentsHref: 'favorites?id=' + encodeURIComponent(username) + '&comments=t',
        icon: ICON_HEART,
        label: 'Favorite submissions',
      },
    ];

    actions.forEach((action) => {
      const link = document.createElement('a');
      link.className = 'hng-user-action ' + action.className;
      link.href = action.href;
      link.dataset.commentsHref = action.commentsHref;
      link.title = action.label + ' — Shift-click for comments';
      link.setAttribute('aria-label', action.label + ' (Shift-click for comments)');
      link.innerHTML = action.icon;

      link.addEventListener('click', (event) => {
        if (event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) {
          event.preventDefault();
          location.href = action.commentsHref;
        }
      });

      wrap.appendChild(link);
    });

    return wrap;
  }

  function buildTopbar() {
    const oldBar = document.querySelector('#hnmain > tbody > tr:first-child td');
    if (!oldBar) return;

    const links = Array.from(oldBar.querySelectorAll('a'));
    // Typical order: y18 logo | hnname "Hacker News" | new | past | comments | ask | show | jobs | submit ... login
    const bar = document.createElement('div');
    bar.className = 'hng-topbar';

    const logo = document.createElement('div');
    logo.className = 'hng-logo';
    logo.textContent = 'Y';
    bar.appendChild(logo);

    const titleLink = links.find((a) => /news$/i.test(a.getAttribute('href') || '') && a.textContent.trim() === '') || links[1] || links[0];
    const title = document.createElement('a');
    title.className = 'hng-site-title';
    title.href = '/news';
    title.textContent = 'Hacker News';
    bar.appendChild(title);

    const nav = document.createElement('nav');
    const navItems = [
      { href: 'newest', icon: ICON_NAV_NEW, label: 'new' },
      { href: 'newcomments', icon: ICON_NAV_COMMENT, label: 'comments' },
      { href: 'ask', icon: ICON_NAV_ASK, label: 'ask' },
      { href: 'show', icon: ICON_NAV_SHOW, label: 'show' },
      { href: 'jobs', icon: ICON_NAV_JOB, label: 'jobs' },
      { href: 'submit', icon: ICON_NAV_SUBMIT, label: 'submit' },
    ];
    const usedLinks = new Set();
    let userLink = null;

    navItems.forEach((item) => {
      const source = links.find((a) => {
        if (usedLinks.has(a)) return false;
        return (a.getAttribute('href') || '').startsWith(item.href);
      });
      if (!source) return;

      usedLinks.add(source);
      const link = source.cloneNode(true);
      link.innerHTML = item.icon + '<span>' + item.label + '</span>';
      nav.appendChild(link);
    });

    const catchUpSource = links.find((a) => {
      if (usedLinks.has(a)) return false;
      return (a.getAttribute('href') || '').startsWith('front');
    });
    if (catchUpSource) {
      const separator = document.createElement('span');
      separator.className = 'hng-nav-separator';
      separator.setAttribute('aria-hidden', 'true');
      nav.appendChild(separator);

      const catchUp = catchUpSource.cloneNode(true);
      catchUp.innerHTML = ICON_NAV_CATCHUP + '<span>catch up</span>';
      catchUp.title = 'Catch up on past front pages';
      catchUp.setAttribute('aria-label', 'Catch up on past front pages');
      nav.appendChild(catchUp);
    }

    links.forEach((a) => {
      const href = a.getAttribute('href') || '';
      if (isHNLoginOrUserHref(href)) {
        userLink = a.cloneNode(true);
        userLink.classList.add('hng-user');
      }
    });

    bar.appendChild(nav);
    bar.appendChild(buildSearch());
    bar.appendChild(buildToggle());
    if (userLink) {
      const username = getUsernameFromHref(userLink.getAttribute('href'));
      if (username) bar.appendChild(buildUserActions(username));
      bar.appendChild(userLink);
    }

    const hnmain = document.querySelector('#hnmain');
    if (hnmain) hnmain.parentNode.insertBefore(bar, hnmain);
  }

  function buildSearch() {
    const form = document.createElement('form');
    form.className = 'hng-search';
    form.action = 'https://hn.algolia.com/';
    form.method = 'get';
    form.setAttribute('role', 'search');

    const input = document.createElement('input');
    input.type = 'search';
    input.name = 'q';
    input.placeholder = 'Search';
    input.setAttribute('aria-label', 'Search Hacker News');
    input.autocomplete = 'off';
    input.spellcheck = false;

    const button = document.createElement('button');
    button.type = 'submit';
    button.title = 'Search Hacker News';
    button.setAttribute('aria-label', 'Search Hacker News');
    button.innerHTML = ICON_SEARCH;

    form.appendChild(input);
    form.appendChild(button);

    form.addEventListener('submit', (event) => {
      input.value = input.value.trim();
      if (!input.value) {
        event.preventDefault();
        input.focus();
      }
    });

    return form;
  }

  function buildToggle() {
    const wrap = document.createElement('div');
    wrap.className = 'hng-toggle';

    const defs = [
      { mode: 'light', icon: ICON_SUN, label: 'Light theme' },
      { mode: 'auto', icon: ICON_AUTO, label: 'Match system theme' },
      { mode: 'dark', icon: ICON_MOON, label: 'Dark theme' },
    ];

    defs.forEach((d) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.mode = d.mode;
      btn.title = d.label;
      btn.innerHTML = d.icon;
      btn.addEventListener('click', () => {
        currentMode = d.mode;
        setStoredMode(d.mode);
        applyTheme(d.mode);
      });
      wrap.appendChild(btn);
    });

    return wrap;
  }

  function updateToggleUI(mode) {
    document.querySelectorAll('.hng-toggle button').forEach((btn) => {
      btn.classList.toggle('hng-active', btn.dataset.mode === mode);
    });
  }

  /* ------------------------------------------------------------------
   * 5. STORY LIST: stat chips (points + comments), Glider-style
   * ------------------------------------------------------------------
   * HN already prints "N points by X Y ago | hide | N comments" in the
   * .subtext row. We parse the existing text/links (no extra requests)
   * and prepend two compact chips, similar to Glider's card footer.
   * ------------------------------------------------------------------ */

  function getHNUsername() {
    const userLink =
      document.querySelector('.hng-topbar a[href*="user?id="]') ||
      document.querySelector('#hnmain .pagetop a[href*="user?id="]');
    if (!userLink) return null;
    return getUsernameFromHref(userLink.getAttribute('href'));
  }

  function getAuthFromDocument(doc) {
    const link = doc.querySelector('a[href*="auth="]');
    if (!link) return null;
    const match = (link.getAttribute('href') || '').match(/[?&]auth=([^&]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  }

  async function requestHN(url) {
    const absoluteUrl = new URL(url, location.href).href;

    // Same-origin fetch keeps the HN session cookies and is the most
    // reliable path inside a userscript sandbox.
    try {
      const res = await fetch(absoluteUrl, {
        credentials: 'include',
        cache: 'no-store',
        headers: { Accept: 'text/html,application/xhtml+xml' },
      });
      return {
        status: res.status,
        finalUrl: res.url || absoluteUrl,
        text: await res.text(),
      };
    } catch (fetchError) {
      if (typeof GM_xmlhttpRequest !== 'function') throw fetchError;

      return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
          method: 'GET',
          url: absoluteUrl,
          onload: (res) => resolve({
            status: res.status,
            finalUrl: res.finalUrl || absoluteUrl,
            text: res.responseText || '',
          }),
          onerror: reject,
          ontimeout: reject,
          timeout: 10000,
        });
      });
    }
  }

  function isLoginResponse(res) {
    return /You have to be logged in|name="acct"/i.test(res.text || '') ||
      /\/login\b/i.test(res.finalUrl || '');
  }

  function findFavoriteLink(doc, itemId) {
    const wanted = String(itemId);
    return Array.from(doc.querySelectorAll('a[href*="fave?id="]')).find((link) => {
      const match = (link.getAttribute('href') || '').match(/[?&]id=(\d+)/);
      return match && match[1] === wanted;
    }) || null;
  }

  async function getHNFavoriteUrl(itemId, forceRefresh) {
    if (!forceRefresh) {
      const currentLink = findFavoriteLink(document, itemId);
      if (currentLink) return new URL(currentLink.getAttribute('href'), location.href).href;
    }

    const res = await requestHN('/item?id=' + encodeURIComponent(itemId));
    if (isLoginResponse(res)) return null;

    const doc = new DOMParser().parseFromString(res.text, 'text/html');
    const itemLink = findFavoriteLink(doc, itemId);
    if (itemLink) return new URL(itemLink.getAttribute('href'), location.href).href;

    // Fallback for markup variants: build HN's favorite URL from the auth
    // token found anywhere in the item page (vote/fave links share it).
    const auth = getAuthFromDocument(doc) || getAuthFromDocument(document);
    if (!auth) return null;
    return new URL(
      '/fave?id=' + encodeURIComponent(itemId) + '&auth=' + encodeURIComponent(auth),
      location.href
    ).href;
  }

  // Fire-and-forget same-origin GET with the HN session cookies. This is
  // how HN's own hn.js sends votes, and our fallback when fetch fails.
  function sendHNBeacon(url) {
    return new Promise((resolve) => {
      const img = new Image();
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      img.onload = finish;
      img.onerror = finish;
      img.src = url + (url.includes('?') ? '&' : '?') + '_hng=' + Date.now();
      setTimeout(finish, 3000);
    });
  }

  async function toggleHNFavorite(itemId) {
    let favoriteUrl = await getHNFavoriteUrl(itemId, false);
    if (!favoriteUrl) {
      console.debug('[HN Glider] No HN favorite link/auth found for item', itemId);
      return { loginRequired: true };
    }

    let res;
    try {
      console.debug('[HN Glider] Favoriting via HN', favoriteUrl);
      res = await requestHN(favoriteUrl);
    } catch (requestError) {
      // The HN favorite endpoint may be blocked by the userscript sandbox's
      // fetch. A same-origin image request still performs the real GET with
      // the HN session cookies, so use that as a last resort.
      console.debug('[HN Glider] fetch failed, using HN favorite beacon', requestError);
      await sendHNBeacon(favoriteUrl);
      return { loginRequired: false, unverified: true };
    }

    if (isLoginResponse(res)) {
      favoriteUrl = await getHNFavoriteUrl(itemId, true);
      if (!favoriteUrl) return { loginRequired: true };

      res = await requestHN(favoriteUrl);
    }

    if (isLoginResponse(res)) return { loginRequired: true };
    if (res.status >= 400) throw new Error('HN favorite request failed: ' + res.status);
    return { loginRequired: false };
  }
  function redirectToHNLogin() {
    const goto = location.pathname + location.search;
    location.href = '/login?goto=' + encodeURIComponent(goto);
  }

  let hnFavoriteIds = new Set();
  let favoriteIdsPromise = null;

  function syncFavoriteButton(button) {
    const active = hnFavoriteIds.has(button.dataset.storyId);
    button.classList.toggle('hng-favorited', active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
    button.title = active ? 'Remove from HN favorites' : 'Favorite on Hacker News';
    button.setAttribute('aria-label', active ? 'Remove from HN favorites' : 'Favorite on Hacker News');
  }

  function syncAllFavoriteButtons() {
    document.querySelectorAll('.hng-favorite').forEach(syncFavoriteButton);
  }

  function loadHNFavoriteIds() {
    if (favoriteIdsPromise) return favoriteIdsPromise;

    const username = getHNUsername();
    if (!username) {
      console.debug('[HN Glider] No logged-in HN user; favorites need a login');
      favoriteIdsPromise = Promise.resolve(hnFavoriteIds);
      return favoriteIdsPromise;
    }

    console.debug('[HN Glider] Loading HN favorites for', username);
    favoriteIdsPromise = Promise.all([
      requestHN('/favorites?id=' + encodeURIComponent(username)),
      requestHN('/favorites?id=' + encodeURIComponent(username) + '&comments=t'),
    ])
      .then((responses) => {
        const ids = new Set();
        responses.forEach((res) => {
          if (isLoginResponse(res)) return;

          const doc = new DOMParser().parseFromString(res.text, 'text/html');
          doc.querySelectorAll('tr.athing[id]').forEach((row) => ids.add(String(row.id)));

          // Depending on the HN markup version, favorited item ids may also
          // appear in the fave/unfave links on the favorites page.
          doc.querySelectorAll('a[href*="fave?id="], a[href*="unfave?id="]').forEach((link) => {
            const match = (link.getAttribute('href') || '').match(/[?&]id=(\d+)/);
            if (match) ids.add(match[1]);
          });
        });

        hnFavoriteIds = ids;
        console.debug('[HN Glider] Loaded', ids.size, 'HN favorite ids');
        syncAllFavoriteButtons();
        return hnFavoriteIds;
      })
      .catch((error) => {
        console.debug('[HN Glider] Could not load HN favorites', error);
        return hnFavoriteIds;
      });

    return favoriteIdsPromise;
  }

  function addFavoriteButton(athing) {
    // First td.title in the row (the rank cell): the heart sits beside the
    // rank chip and vote arrow.
    const titleCell = athing.querySelector('td.title');
    if (!titleCell || titleCell.querySelector('.hng-favorite')) return;

    const id = athing.id;
    if (!id) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'hng-favorite';
    button.dataset.storyId = String(id);
    button.innerHTML = ICON_HEART;
    button.setAttribute('aria-label', 'Favorite on Hacker News');
    button.setAttribute('aria-pressed', 'false');

    button.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (button.classList.contains('hng-favorite-busy')) return;

      button.classList.add('hng-favorite-busy');
      button.disabled = true;

      try {
        if (!getHNUsername()) {
          redirectToHNLogin();
          return;
        }

        await loadHNFavoriteIds();
        const result = await toggleHNFavorite(String(id));
        if (result.loginRequired) {
          redirectToHNLogin();
          return;
        }

        // Update immediately, then reconcile against the real favorites page.
        if (hnFavoriteIds.has(String(id))) hnFavoriteIds.delete(String(id));
        else hnFavoriteIds.add(String(id));
        syncFavoriteButton(button);

        favoriteIdsPromise = null;
        loadHNFavoriteIds().then(syncAllFavoriteButtons);
      } catch (e) {
        console.warn('[HN Glider] HN favorite failed', e);
        button.classList.add('hng-favorite-error');
        button.title = 'Could not update HN favorites';
        button.setAttribute('aria-label', 'Could not update HN favorites');
        setTimeout(() => {
          button.classList.remove('hng-favorite-error');
          syncFavoriteButton(button);
        }, 2000);
      } finally {
        button.classList.remove('hng-favorite-busy');
        button.disabled = false;
      }
    });

    syncFavoriteButton(button);
    titleCell.classList.add('hng-title-has-fav');
    titleCell.style.position = 'relative';
    titleCell.style.paddingRight = '28px';
    titleCell.appendChild(button);
  }
  function enhanceStoryList() {
    document.querySelectorAll('tr.athing:not(.comtr)').forEach((athing) => {
      addFavoriteButton(athing);

      const rankEl = athing.querySelector('.rank');
      if (rankEl && !rankEl.dataset.hngDone) {
        rankEl.dataset.hngDone = '1';
        rankEl.textContent = rankEl.textContent.replace(/\.\s*$/, '');
        // Item pages have an empty rank; hide the chip but keep the cell,
        // since the favorite heart lives there.
        if (!rankEl.textContent.trim()) rankEl.classList.add('hng-rank-empty');
      }

      const subtextRow = athing.nextElementSibling;
      if (!subtextRow) return;
      const subtext = subtextRow.querySelector('.subtext');
      if (!subtext || subtext.dataset.hngDone) return;
      subtext.dataset.hngDone = '1';

      const scoreEl = subtext.querySelector('.score');
      const points = scoreEl ? parseInt(scoreEl.textContent, 10) : null;

      // Comments link is the last <a> in subtext whose text matches
      // "N comments" / "discuss" / "N comment"; job posts have neither.
      const allLinks = Array.from(subtext.querySelectorAll('a'));
      const commentsLink = allLinks.find((a) => /comment|discuss/.test(a.textContent));
      let commentCount = 0;
      if (commentsLink) {
        const m = commentsLink.textContent.match(/(\d+)/);
        commentCount = m ? parseInt(m[1], 10) : 0;
      }

      const chipWrap = document.createElement('span');
      chipWrap.className = 'hng-stats';

      if (points !== null) {
        const chip = document.createElement('span');
        chip.className = 'hng-chip hng-chip-points';
        chip.innerHTML = ICON_UP + '<span>' + points + '</span>';
        chipWrap.appendChild(chip);
      }

      if (commentsLink) {
        const chip = document.createElement('a');
        chip.className = 'hng-chip hng-chip-comments';
        chip.href = commentsLink.getAttribute('href');
        chip.innerHTML = ICON_COMMENT + '<span>' + commentCount + '</span>';
        chipWrap.appendChild(chip);
      }

      subtext.insertBefore(chipWrap, subtext.firstChild);
    });

    loadHNFavoriteIds();
  }

  /* ------------------------------------------------------------------
   * 5b. UPVOTES AS TOGGLE BUTTONS
   * ------------------------------------------------------------------
   * HN hides the arrow after voting and adds a separate "unvote" link.
   * We keep the arrow visible, color it with the accent when voted, and
   * let a second click unvote, the same way the favorite heart works.
   * ------------------------------------------------------------------ */

  function getVoteItemId(link) {
    const match = (link.id || '').match(/^up_(\d+)$/);
    return match ? match[1] : null;
  }

  function syncVoteLink(link, voted) {
    const id = link.dataset.hngVoteId;
    link.dataset.hngVoted = voted ? '1' : '0';
    link.classList.toggle('hng-voted', voted);
    link.classList.remove('nosee');
    link.setAttribute('role', 'button');
    link.setAttribute('aria-pressed', voted ? 'true' : 'false');
    link.title = voted ? 'Remove upvote' : 'Upvote';
    link.setAttribute('aria-label', link.title);

    // HN hides the downvote arrow while an item is upvoted; keep that.
    const down = document.getElementById('down_' + id);
    if (down) down.classList.toggle('nosee', voted);
  }

  function enhanceVoteLinks() {
    document.querySelectorAll('.votelinks a[id^="up_"]').forEach((link) => {
      if (link.dataset.hngVoteId) return;
      const id = getVoteItemId(link);
      if (!id) return;

      const unv = document.getElementById('unv_' + id);
      const unvText = unv ? unv.textContent : '';
      // A downvoted comment shows "undown"; leave HN's own controls alone.
      if (/undown/i.test(unvText)) return;

      link.dataset.hngVoteId = id;
      const voted = link.classList.contains('nosee') || /unvote/i.test(unvText);
      if (unv) unv.classList.add('hng-unv-hidden');
      syncVoteLink(link, voted);
    });
  }

  function adjustStoryPoints(id, delta) {
    const scoreEl = document.getElementById('score_' + id);
    if (!scoreEl) return;
    const current = parseInt(scoreEl.textContent, 10);
    if (!Number.isFinite(current)) return;

    const next = Math.max(0, current + delta);
    scoreEl.textContent = next + (next === 1 ? ' point' : ' points');

    const subtext = scoreEl.closest('.subtext');
    const chipValue = subtext ? subtext.querySelector('.hng-chip-points > span') : null;
    if (chipValue) chipValue.textContent = String(next);
  }

  function buildVoteUrl(link, how) {
    const id = link.dataset.hngVoteId;
    if (how === 'un') {
      const un = document.getElementById('un_' + id);
      if (un && un.getAttribute('href')) return new URL(un.getAttribute('href'), location.href).href;
    }
    const url = new URL(link.getAttribute('href'), location.href);
    url.searchParams.set('how', how);
    return url.href;
  }

  async function sendHNVote(url) {
    let res;
    try {
      // redirect: 'manual' stops us downloading the whole goto page.
      res = await fetch(url, { credentials: 'include', cache: 'no-store', redirect: 'manual' });
    } catch (fetchError) {
      console.debug('[HN Glider] vote fetch failed, using beacon', fetchError);
      await sendHNBeacon(url);
      return;
    }
    if (res.type === 'opaqueredirect' || res.ok) return;
    throw new Error('HN vote request failed: ' + res.status);
  }

  async function toggleHNVote(link) {
    if (link.classList.contains('hng-vote-busy')) return;

    const id = link.dataset.hngVoteId;
    const wasVoted = link.dataset.hngVoted === '1';
    const url = buildVoteUrl(link, wasVoted ? 'un' : 'up');

    link.classList.add('hng-vote-busy');
    syncVoteLink(link, !wasVoted);
    adjustStoryPoints(id, wasVoted ? -1 : 1);

    try {
      await sendHNVote(url);
    } catch (e) {
      console.warn('[HN Glider] HN vote failed', e);
      syncVoteLink(link, wasVoted);
      adjustStoryPoints(id, wasVoted ? 1 : -1);
      link.classList.add('hng-vote-error');
      link.title = 'Could not update vote';
      link.setAttribute('aria-label', link.title);
      setTimeout(() => {
        link.classList.remove('hng-vote-error');
        syncVoteLink(link, link.dataset.hngVoted === '1');
      }, 2000);
    } finally {
      link.classList.remove('hng-vote-busy');
    }
  }

  function onVoteClick(event) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const target = event.target;
    const link = target && target.closest ? target.closest('.votelinks a[data-hng-vote-id]') : null;
    if (!link) return;

    // Logged-out arrows carry no auth token; let HN send them to login.
    if (!/[?&]auth=/.test(link.getAttribute('href') || '')) return;

    // Capture phase on window runs before HN's own vote handler, so we
    // fully own the click.
    event.preventDefault();
    event.stopImmediatePropagation();
    toggleHNVote(link);
  }

  /* ------------------------------------------------------------------
   * 5c. ADD-COMMENT FORM WIDTH
   * ------------------------------------------------------------------
   * HN puts the form in the title column, behind two empty cells. We let
   * its cell span the whole row (the heart / arrow / title rows above are
   * untouched), then indent it so it starts where the comment cards do.
   * ------------------------------------------------------------------ */

  function alignCommentForm() {
    const cell = document.querySelector('td.hng-comment-form-cell');
    if (!cell) return;
    cell.style.paddingLeft = '';

    const card = Array.from(document.querySelectorAll('.comment-tree tr.comtr .comment'))
      .find((el) => el.getBoundingClientRect().width > 0);
    if (!card) return;

    const offset = Math.round(card.getBoundingClientRect().left - cell.getBoundingClientRect().left);
    if (offset > 0 && offset < 240) cell.style.setProperty('padding-left', offset + 'px', 'important');

    // Shift the heart + upvote arrow (and the title with them) so the heart
    // starts exactly above the textarea's left edge.
    const textarea = cell.querySelector('textarea');
    const storyCell = cell.closest('table.fatitem')
      ? cell.closest('table.fatitem').querySelector('tr.athing > td:first-child')
      : null;
    if (!textarea || !storyCell) return;
    storyCell.style.removeProperty('padding-left');
    const anchor = storyCell.querySelector('.hng-favorite') || storyCell;
    const delta = Math.round(textarea.getBoundingClientRect().left - anchor.getBoundingClientRect().left);
    if (delta > 0 && delta < 240) storyCell.style.setProperty('padding-left', delta + 'px', 'important');
  }

  function widenCommentForm() {
    document.querySelectorAll('table.fatitem form[action$="comment"]').forEach((form) => {
      const cell = form.closest('td');
      const row = cell ? cell.parentElement : null;
      if (!row || row.dataset.hngWide) return;
      row.dataset.hngWide = '1';

      let extraSpan = 0;
      Array.from(row.cells).forEach((other) => {
        if (other === cell || other.textContent.trim() || other.children.length) return;
        extraSpan += other.colSpan || 1;
        other.remove();
      });
      cell.colSpan = (cell.colSpan || 1) + extraSpan;
      cell.classList.add('hng-comment-form-cell');
    });

    alignCommentForm();

    let queued = false;
    const realign = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        alignCommentForm();
      });
    };
    window.addEventListener('resize', realign);
    window.addEventListener('load', realign, { once: true });
  }

  /* ------------------------------------------------------------------
   * 5d. PIXEL AVATARS
   * ------------------------------------------------------------------
   * A deterministic 5x5, left-right mirrored pattern per username (like
   * Glider / GitHub identicons). Each username is hashed once; the
   * pattern becomes a cached SVG mask string and the hue a number. One
   * <span> per avatar, colors come from theme tokens in CSS.
   * ------------------------------------------------------------------ */

  const avatarCache = new Map();

  function hashUsername(str, seed) {
    let h = (0x811c9dc5 ^ seed) >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    // Final avalanche so similar names get very different patterns.
    h ^= h >>> 16;
    h = Math.imul(h, 0x85ebca6b);
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35);
    h ^= h >>> 16;
    return h >>> 0;
  }

  function countBits(value) {
    let count = 0;
    while (value) {
      count += value & 1;
      value >>>= 1;
    }
    return count;
  }

  function getAvatarData(username) {
    if (avatarCache.has(username)) return avatarCache.get(username);

    const a = hashUsername(username, 0);
    const b = hashUsername(username, 0x9e3779b9);

    // 15 bits = 5 rows x 3 columns (the right two columns mirror the left).
    let bits = a & 0x7fff;
    if (countBits(bits) < 5) bits |= b & 0x7fff;
    if (countBits(bits) > 11) bits &= b & 0x7fff | 0x1249;

    let path = '';
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 3; col++) {
        if (!(bits & (1 << (row * 3 + col)))) continue;
        const cols = col === 2 ? [2] : [col, 4 - col];
        cols.forEach((x) => {
          path += 'M' + x + ' ' + row + 'h1v1h-1z';
        });
      }
    }

    // Build the SVG once per user and clone it for every occurrence.
    const SVG_NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(SVG_NS, 'svg');
    // Half a cell of padding around the 5x5 grid.
    svg.setAttribute('viewBox', '-0.5 -0.5 6 6');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.style.setProperty('--hng-av-h', String(b % 360));
    const shape = document.createElementNS(SVG_NS, 'path');
    shape.setAttribute('d', path);
    svg.appendChild(shape);

    avatarCache.set(username, svg);
    return svg;
  }

  function createAvatar(username, sizeClass) {
    const avatar = getAvatarData(username).cloneNode(true);
    avatar.setAttribute('class', 'hng-avatar ' + sizeClass);
    return avatar;
  }

  function addAvatarBefore(link, sizeClass) {
    if (link.dataset.hngAvatar) return;
    const username = link.textContent.trim();
    if (!username) return;
    link.dataset.hngAvatar = '1';
    link.insertAdjacentElement('beforebegin', createAvatar(username, sizeClass));
  }

  function enhanceAvatars() {
    document.querySelectorAll('.comhead a.hnuser').forEach((link) => {
      addAvatarBefore(link, 'hng-avatar-comment');
    });
    document.querySelectorAll('.subtext a.hnuser').forEach((link) => {
      addAvatarBefore(link, 'hng-avatar-story');
    });

    const topbarUser = document.querySelector('.hng-topbar .hng-user[href*="user?id="]');
    if (topbarUser && !topbarUser.dataset.hngAvatar) {
      const username = getUsernameFromHref(topbarUser.getAttribute('href'));
      if (username) {
        topbarUser.dataset.hngAvatar = '1';
        topbarUser.insertBefore(createAvatar(username, 'hng-avatar-topbar'), topbarUser.firstChild);
      }
    }
  }

  /* ------------------------------------------------------------------
   * 6. COMMENT PAGE: reply count + upvote count chips
   * ------------------------------------------------------------------
   * Reply count: HN doesn't expose it in the DOM, so we derive it
   * client-side from the indent structure of following rows.
   *
   * Upvote count: HN's own comment HTML doesn't include per-comment
   * score at all (not a selector issue - the number simply isn't sent
   * to the browser). We pull it from the public, unauthenticated
   * Algolia HN API (hn.algolia.com), which mirrors every item's score,
   * and merge it in once it arrives.
   * ------------------------------------------------------------------ */

  function getIndentLevel(row) {
    const indImg = row.querySelector('.ind img');
    if (!indImg) return 0;
    const w = parseInt(indImg.getAttribute('width') || '0', 10);
    return Math.round(w / 40); // HN uses 40px indent steps
  }

  function gmFetchJson(url) {
    return new Promise((resolve, reject) => {
      if (typeof GM_xmlhttpRequest === 'function') {
        GM_xmlhttpRequest({
          method: 'GET',
          url,
          onload: (res) => {
            try {
              resolve(JSON.parse(res.responseText));
            } catch (e) {
              reject(e);
            }
          },
          onerror: reject,
          ontimeout: reject,
          timeout: 8000,
        });
      } else {
        fetch(url)
          .then((r) => r.json())
          .then(resolve)
          .catch(reject);
      }
    });
  }

  const KARMA_CACHE_TTL = 24 * 60 * 60 * 1000;
  let karmaCacheData = null;
  let karmaSaveTimer = null;
  const karmaPending = new Map();
  const karmaQueue = [];
  let karmaActiveRequests = 0;

  function getKarmaCache() {
    if (karmaCacheData) return karmaCacheData;

    let raw = '{}';
    try {
      raw = GM_getValue(KARMA_CACHE_KEY, '{}');
    } catch (e) {
      raw = localStorage.getItem(KARMA_CACHE_KEY) || '{}';
    }

    try {
      karmaCacheData = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (!karmaCacheData || typeof karmaCacheData !== 'object') karmaCacheData = {};
    } catch (e) {
      karmaCacheData = {};
    }
    return karmaCacheData;
  }

  function scheduleKarmaCacheSave() {
    if (karmaSaveTimer) clearTimeout(karmaSaveTimer);
    karmaSaveTimer = setTimeout(() => {
      karmaSaveTimer = null;
      const cache = getKarmaCache();
      const entries = Object.entries(cache).sort((a, b) => (a[1].ts || 0) - (b[1].ts || 0));
      if (entries.length > 500) {
        karmaCacheData = Object.fromEntries(entries.slice(-500));
      }

      const value = JSON.stringify(karmaCacheData);
      try {
        GM_setValue(KARMA_CACHE_KEY, value);
      } catch (e) {
        localStorage.setItem(KARMA_CACHE_KEY, value);
      }
    }, 800);
  }

  function processKarmaQueue() {
    while (karmaActiveRequests < 4 && karmaQueue.length) {
      const job = karmaQueue.shift();
      karmaActiveRequests++;

      gmFetchJson('https://hn.algolia.com/api/v1/users/' + encodeURIComponent(job.username))
        .then((data) => {
          if (data && typeof data.karma === 'number') job.resolve(data.karma);
          else job.reject(new Error('No karma for ' + job.username));
        })
        .catch(job.reject)
        .finally(() => {
          karmaActiveRequests--;
          processKarmaQueue();
        });
    }
  }

  function fetchUserKarma(username) {
    const cache = getKarmaCache();
    const cached = cache[username];
    if (cached && typeof cached.karma === 'number' &&
        Date.now() - (cached.ts || 0) < KARMA_CACHE_TTL) {
      return Promise.resolve(cached.karma);
    }

    if (karmaPending.has(username)) return karmaPending.get(username);

    const promise = new Promise((resolve, reject) => {
      karmaQueue.push({ username, resolve, reject });
      processKarmaQueue();
    });

    karmaPending.set(username, promise);
    promise
      .then((karma) => {
        cache[username] = { karma, ts: Date.now() };
        scheduleKarmaCacheSave();
      })
      .catch(() => {})
      .finally(() => karmaPending.delete(username));

    return promise;
  }

  function formatKarma(value) {
    if (value >= 1000000) {
      return (value / 1000000).toFixed(value >= 10000000 ? 0 : 1).replace(/\.0$/, '') + 'm';
    }
    if (value >= 1000) {
      return (value / 1000).toFixed(value >= 10000 ? 0 : 1).replace(/\.0$/, '') + 'k';
    }
    return String(value);
  }

  function enhanceUserKarma() {
    document.querySelectorAll(
      '.hng-topbar .hng-user[href*="user?id="]'
    ).forEach((link) => {
      if (link.dataset.hngKarmaDone) return;

      let username = '';
      try {
        username = new URL(link.getAttribute('href'), location.origin).searchParams.get('id') || '';
      } catch (e) {
        username = link.textContent.trim();
      }
      if (!username) return;

      link.dataset.hngKarmaDone = '1';
      const badge = document.createElement('span');
      badge.className = 'hng-karma';
      badge.hidden = true;
      link.appendChild(badge);

      fetchUserKarma(username)
        .then((karma) => {
          badge.textContent = formatKarma(karma);
          badge.title = karma.toLocaleString('en-US') + ' karma';
          badge.setAttribute('aria-label', karma.toLocaleString('en-US') + ' karma');
          badge.hidden = false;
        })
        .catch(() => badge.remove());
    });
  }

  function addPointsChip(row, points) {
    if (row.querySelector('.hng-chip-points')) return;
    const comhead = row.querySelector('.comhead');
    if (!comhead) return;
    const chip = document.createElement('span');
    chip.className = 'hng-chip hng-chip-points';
    chip.style.marginLeft = '6px';
    chip.innerHTML = ICON_UP + '<span>' + points + '</span>';
    comhead.appendChild(chip);
  }

  function fetchAndApplyPoints(rootId) {
    const url = 'https://hn.algolia.com/api/v1/items/' + encodeURIComponent(rootId);
    gmFetchJson(url)
      .then((data) => {
        const pointsById = new Map();
        (function walk(node) {
          if (!node) return;
          if (typeof node.points === 'number' && node.id != null) {
            pointsById.set(String(node.id), node.points);
          }
          if (Array.isArray(node.children)) node.children.forEach(walk);
        })(data);

        document.querySelectorAll('tr.athing.comtr[id]').forEach((row) => {
          const pts = pointsById.get(row.id);
          if (typeof pts === 'number') addPointsChip(row, pts);
        });
      })
      .catch(() => {
        /* Algolia unreachable or item not yet indexed - fail silently,
           reply-count chips still show. */
      });
  }

  function enhanceComments() {
    const rows = Array.from(document.querySelectorAll('tr.athing.comtr'));
    if (!rows.length) return;

    rows.forEach((row, i) => {
      if (row.dataset.hngDone) return;
      row.dataset.hngDone = '1';

      const level = getIndentLevel(row);
      let replies = 0;
      for (let j = i + 1; j < rows.length; j++) {
        const nextLevel = getIndentLevel(rows[j]);
        if (nextLevel <= level) break;
        if (nextLevel === level + 1) replies++;
      }

      if (replies > 0) {
        const comhead = row.querySelector('.comhead');
        if (comhead) {
          const chip = document.createElement('span');
          chip.className = 'hng-chip hng-chip-comments';
          chip.style.marginLeft = '6px';
          chip.innerHTML = ICON_COMMENT + '<span>' + replies + '</span>';
          comhead.appendChild(chip);
        }
      }
    });

    // Root item id lives in the querystring (?id=NNNN) on comment pages.
    const params = new URLSearchParams(window.location.search);
    const itemId = params.get('id');
    if (itemId) fetchAndApplyPoints(itemId);
  }

  /* ------------------------------------------------------------------
   * 7. INIT + MUTATION SAFETY NET
   * ------------------------------------------------------------------ */

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function hnAbsoluteUrl(href) {
    try {
      return new URL(href, location.origin).href;
    } catch (e) {
      return href || '';
    }
  }

  function parseStoriesFromDoc(doc) {
    return Array.from(doc.querySelectorAll('tr.athing:not(.comtr)')).map((row) => {
      const subtext = row.nextElementSibling ? row.nextElementSibling.querySelector('.subtext') : null;
      const titleLink = row.querySelector('.titleline > a') || row.querySelector('td.title a');
      const authorLink = subtext ? subtext.querySelector('a.hnuser') : null;
      const scoreEl = subtext ? subtext.querySelector('.score') : null;
      const ageEl = subtext ? subtext.querySelector('.age') : null;
      const ageLink = ageEl ? ageEl.querySelector('a') : null;
      const links = subtext ? Array.from(subtext.querySelectorAll('a')) : [];
      const commentsLink = links.find((a) => /comment|discuss/i.test(a.textContent));
      const rankEl = row.querySelector('.rank');

      return {
        type: 'story',
        id: row.id,
        rank: rankEl ? rankEl.textContent.trim().replace(/\.\s*$/, '') : '',
        title: titleLink ? titleLink.textContent.trim() : '',
        url: titleLink ? hnAbsoluteUrl(titleLink.getAttribute('href')) : '',
        hnUrl: 'https://news.ycombinator.com/item?id=' + row.id,
        author: authorLink ? authorLink.textContent.trim() : '',
        points: scoreEl ? parseInt(scoreEl.textContent, 10) : null,
        createdAt: ageEl
          ? (ageEl.getAttribute('title') || (ageLink ? ageLink.textContent.trim() : ''))
          : '',
        comments: commentsLink ? commentsLink.textContent.trim() : '',
        site: (() => {
          const site = row.querySelector('.sitestr');
          return site ? site.textContent.trim() : '';
        })(),
      };
    }).filter((item) => item.id);
  }

  function parseCommentsFromDoc(doc) {
    return Array.from(doc.querySelectorAll('tr.athing.comtr')).map((row) => {
      const comhead = row.querySelector('.comhead');
      const authorLink = comhead ? comhead.querySelector('a.hnuser') : null;
      const ageEl = comhead ? comhead.querySelector('.age') : null;
      const textEl = row.querySelector('.commtext');
      const parentLink = comhead
        ? Array.from(comhead.querySelectorAll('a')).find((a) => /^parent$/i.test(a.textContent.trim()))
        : null;

      return {
        type: 'comment',
        id: row.id,
        author: authorLink ? authorLink.textContent.trim() : '',
        createdAt: ageEl ? (ageEl.getAttribute('title') || ageEl.textContent.trim()) : '',
        text: textEl ? (textEl.innerText || textEl.textContent || '').trim() : '',
        hnUrl: 'https://news.ycombinator.com/item?id=' + row.id,
        parentId: parentLink ? (() => {
          try {
            return new URL(parentLink.getAttribute('href'), location.origin).searchParams.get('id');
          } catch (e) {
            return null;
          }
        })() : null,
      };
    }).filter((item) => item.id);
  }

  function getNextHNExportPage(doc) {
    const more = doc.querySelector('a.morelink[rel="next"], a.morelink');
    return more ? hnAbsoluteUrl(more.getAttribute('href')) : null;
  }

  async function collectHNExportPages(startUrl, parser, label, onProgress) {
    const items = [];
    const seen = new Set();
    let next = hnAbsoluteUrl(startUrl);
    let page = 0;

    while (next && page < 200) {
      if (page > 0) await sleep(400);

      const res = await requestHN(next);
      if (isLoginResponse(res)) throw new Error('Login required for ' + label);

      const doc = new DOMParser().parseFromString(res.text, 'text/html');
      parser(doc).forEach((item) => {
        if (item.id && !seen.has(item.id)) {
          seen.add(item.id);
          items.push(item);
        }
      });

      page++;
      if (onProgress) onProgress(label, page, items.length);
      next = getNextHNExportPage(doc);
    }

    return items;
  }

  function csvEscape(value) {
    if (value === null || value === undefined) return '';
    const text = String(value);
    return /[",\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
  }

  function buildCSV(headers, rows) {
    const lines = [headers.map(csvEscape).join(',')];
    rows.forEach((row) => {
      lines.push(headers.map((header) => csvEscape(row[header])).join(','));
    });
    return '﻿' + lines.join('\r\n') + '\r\n';
  }

  function encodeUTF8(text) {
    const bytes = [];
    for (let i = 0; i < text.length; i++) {
      let code = text.charCodeAt(i);
      if (code < 0x80) {
        bytes.push(code);
      } else if (code < 0x800) {
        bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
      } else if (code >= 0xd800 && code <= 0xdbff && i + 1 < text.length) {
        const next = text.charCodeAt(++i);
        const point = 0x10000 + ((code - 0xd800) << 10) + (next - 0xdc00);
        bytes.push(
          0xf0 | (point >> 18),
          0x80 | ((point >> 12) & 0x3f),
          0x80 | ((point >> 6) & 0x3f),
          0x80 | (point & 0x3f)
        );
      } else {
        bytes.push(
          0xe0 | (code >> 12),
          0x80 | ((code >> 6) & 0x3f),
          0x80 | (code & 0x3f)
        );
      }
    }
    return new Uint8Array(bytes);
  }

  function createZipBlob(files) {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let value = i;
      for (let j = 0; j < 8; j++) {
        value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
      }
      table[i] = value;
    }

    const crc32 = (bytes) => {
      let crc = 0xffffffff;
      for (let i = 0; i < bytes.length; i++) {
        crc = (crc >>> 8) ^ table[(crc ^ bytes[i]) & 0xff];
      }
      return (crc ^ 0xffffffff) >>> 0;
    };

    const now = new Date();
    const dosTime = ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)) & 0xffff;
    const dosDate = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xffff;

    const localParts = [];
    const centralParts = [];
    let offset = 0;

    files.forEach((file) => {
      const nameBytes = encodeUTF8(file.name);
      const dataBytes = encodeUTF8(file.content);
      const crc = crc32(dataBytes);

      const local = new Uint8Array(30 + nameBytes.length + dataBytes.length);
      const localView = new DataView(local.buffer);
      localView.setUint32(0, 0x04034b50, true);
      localView.setUint16(4, 20, true);
      localView.setUint16(6, 0x0800, true);
      localView.setUint16(8, 0, true);
      localView.setUint16(10, dosTime, true);
      localView.setUint16(12, dosDate, true);
      localView.setUint32(14, crc, true);
      localView.setUint32(18, dataBytes.length, true);
      localView.setUint32(22, dataBytes.length, true);
      localView.setUint16(26, nameBytes.length, true);
      localView.setUint16(28, 0, true);
      local.set(nameBytes, 30);
      local.set(dataBytes, 30 + nameBytes.length);
      localParts.push(local);

      const central = new Uint8Array(46 + nameBytes.length);
      const centralView = new DataView(central.buffer);
      centralView.setUint32(0, 0x02014b50, true);
      centralView.setUint16(4, 20, true);
      centralView.setUint16(6, 20, true);
      centralView.setUint16(8, 0x0800, true);
      centralView.setUint16(10, 0, true);
      centralView.setUint16(12, dosTime, true);
      centralView.setUint16(14, dosDate, true);
      centralView.setUint32(16, crc, true);
      centralView.setUint32(20, dataBytes.length, true);
      centralView.setUint32(24, dataBytes.length, true);
      centralView.setUint16(28, nameBytes.length, true);
      centralView.setUint16(30, 0, true);
      centralView.setUint16(32, 0, true);
      centralView.setUint16(34, 0, true);
      centralView.setUint16(36, 0, true);
      centralView.setUint32(38, 0, true);
      centralView.setUint32(42, offset, true);
      central.set(nameBytes, 46);
      centralParts.push(central);

      offset += local.length;
    });

    const centralStart = offset;
    const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
    const end = new Uint8Array(22);
    const endView = new DataView(end.buffer);
    endView.setUint32(0, 0x06054b50, true);
    endView.setUint16(4, 0, true);
    endView.setUint16(6, 0, true);
    endView.setUint16(8, files.length, true);
    endView.setUint16(10, files.length, true);
    endView.setUint32(12, centralSize, true);
    endView.setUint32(16, centralStart, true);
    endView.setUint16(20, 0, true);

    return new Blob([...localParts, ...centralParts, end], { type: 'application/zip' });
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function buildAccountExportFiles(data) {
    const storyHeaders = [
      '#', 'Title', 'URL', 'Timestamp', 'Author', 'Points',
      'Comments', 'Site', 'HN URL', 'HN ID', 'Rank', 'Type'
    ];
    const commentHeaders = [
      '#', 'Author', 'Timestamp', 'Comment', 'HN URL', 'HN ID', 'Parent ID', 'Type'
    ];

    const storyRows = (items) => items.map((item, index) => ({
      '#': index + 1,
      Title: item.title,
      URL: item.url,
      Timestamp: item.createdAt,
      Author: item.author,
      Points: item.points,
      Comments: item.comments,
      Site: item.site,
      'HN URL': item.hnUrl,
      'HN ID': item.id,
      Rank: item.rank,
      Type: item.type,
    }));

    const commentRows = (items) => items.map((item, index) => ({
      '#': index + 1,
      Author: item.author,
      Timestamp: item.createdAt,
      Comment: item.text,
      'HN URL': item.hnUrl,
      'HN ID': item.id,
      'Parent ID': item.parentId,
      Type: item.type,
    }));

    const profileRows = [
      { field: 'username', value: data.profile.username },
      { field: 'joined', value: data.profile.joined },
      { field: 'karma', value: data.profile.karma },
      { field: 'about', value: data.profile.about },
      { field: 'exportedAt', value: data.exportedAt },
    ];

    const files = [
      { name: 'profile.csv', content: buildCSV(['field', 'value'], profileRows) },
      { name: 'favorites_posts.csv', content: buildCSV(storyHeaders, storyRows(data.favorites.stories)) },
      { name: 'favorites_comments.csv', content: buildCSV(commentHeaders, commentRows(data.favorites.comments)) },
      { name: 'submissions.csv', content: buildCSV(storyHeaders, storyRows(data.submissions)) },
      { name: 'comments.csv', content: buildCSV(commentHeaders, commentRows(data.comments)) },
      { name: 'upvoted_posts.csv', content: buildCSV(storyHeaders, storyRows(data.upvoted.stories)) },
      { name: 'upvoted_comments.csv', content: buildCSV(commentHeaders, commentRows(data.upvoted.comments)) },
      {
        name: 'errors.csv',
        content: buildCSV(
          ['Section', 'Message'],
          data.errors.map((error) => ({ Section: error.section, Message: error.message }))
        )
      },
    ];

    const readme = [
      'HN account export',
      '',
      'Username: ' + data.profile.username,
      'Exported at: ' + data.exportedAt,
      'Favorite posts: ' + data.favorites.stories.length,
      'Favorite comments: ' + data.favorites.comments.length,
      'Submissions: ' + data.submissions.length,
      'Comments: ' + data.comments.length,
      'Upvoted posts: ' + data.upvoted.stories.length,
      'Upvoted comments: ' + data.upvoted.comments.length,
      '',
      'CSV files are UTF-8 with a BOM for spreadsheet compatibility.',
    ].join('\r\n');
    files.push({ name: 'README.txt', content: readme });

    return files;
  }

  function downloadAccountZip(data, username) {
    const files = buildAccountExportFiles(data);
    const blob = createZipBlob(files);
    const date = data.exportedAt.slice(0, 10);
    const safeUsername = String(username).replace(/[^a-z0-9._-]+/gi, '_');
    downloadBlob(blob, 'hn-account-' + safeUsername + '-' + date + '.zip');
  }
  async function exportHNAccountData(profileData, onProgress) {
    const username = profileData.username;
    const errors = [];
    const result = {
      exportedAt: new Date().toISOString(),
      profile: profileData,
      favorites: { stories: [], comments: [] },
      submissions: [],
      comments: [],
      upvoted: { stories: [], comments: [] },
      errors,
    };

    const load = async (label, path, parser) => {
      try {
        return await collectHNExportPages(path, parser, label, onProgress);
      } catch (e) {
        errors.push({ section: label, message: e.message || String(e) });
        return [];
      }
    };

    const user = encodeURIComponent(username);
    result.favorites.stories = await load(
      'favorite stories', '/favorites?id=' + user, parseStoriesFromDoc
    );
    result.favorites.comments = await load(
      'favorite comments', '/favorites?id=' + user + '&comments=t', parseCommentsFromDoc
    );
    result.submissions = await load(
      'submissions', '/submitted?id=' + user, parseStoriesFromDoc
    );
    result.comments = await load(
      'comments', '/threads?id=' + user, parseCommentsFromDoc
    );
    result.upvoted.stories = await load(
      'upvoted stories', '/upvoted?id=' + user, parseStoriesFromDoc
    );
    result.upvoted.comments = await load(
      'upvoted comments', '/upvoted?id=' + user + '&comments=t', parseCommentsFromDoc
    );

    return result;
  }
  function findHNProfileTable() {
    const direct = document.querySelector('#bigbox > td > table');
    if (direct &&
        direct.querySelector('a[href*="user?id="]') &&
        /karma\s*:/i.test(direct.textContent || '')) {
      return direct;
    }

    const tables = Array.from(document.querySelectorAll('#bigbox table'));
    return tables.find((table) => {
      return table.querySelector('a[href*="user?id="]') &&
        /karma\s*:/i.test(table.textContent || '');
    }) || direct;
  }

  function readProfileDataFromTable(table, username) {
    const values = new Map();
    if (table) {
      Array.from(table.rows).forEach((row) => {
        if (!row.cells[0] || !row.cells[1]) return;
        const label = row.cells[0].textContent.replace(':', '').trim().toLowerCase();
        if (label) values.set(label, row.cells[1]);
      });
    }

    const createdCell = values.get('created');
    const karmaCell = values.get('karma');
    const aboutCell = values.get('about');
    const karmaText = karmaCell ? karmaCell.textContent.trim() : '';
    const karmaNumber = Number(karmaText.replace(/,/g, ''));
    const aboutTextarea = aboutCell ? aboutCell.querySelector('textarea') : null;

    return {
      username,
      joined: createdCell ? createdCell.textContent.trim() : null,
      karma: Number.isFinite(karmaNumber) && karmaText ? karmaNumber : null,
      about: aboutTextarea
        ? aboutTextarea.value.trim()
        : (aboutCell ? aboutCell.textContent.trim() : null),
    };
  }

  function ensureProfileExportButton() {
    if (location.hostname !== 'news.ycombinator.com' || location.pathname !== '/user') return;
    if (document.querySelector('.hng-profile-export')) return;

    const table = findHNProfileTable();
    const params = new URLSearchParams(location.search);
    const pageUserLink = table ? table.querySelector('a[href*="user?id="]') : null;
    const pageUsername = (pageUserLink ? pageUserLink.textContent.trim() : params.get('id')) || '';
    const loggedIn = getHNUsername();
    const hasLogout = !!document.querySelector('a[href*="logout"]');
    const sameUser = !!(loggedIn && pageUsername &&
      loggedIn.toLowerCase() === pageUsername.toLowerCase());
    const canExport = (!!loggedIn && sameUser) || (!loggedIn && hasLogout);
    if (!canExport) return;

    const exportUsername = loggedIn || pageUsername;
    if (!exportUsername) return;

    const panel = createProfileExportPanel(readProfileDataFromTable(table, exportUsername));
    const wrap = document.createElement('div');
    wrap.className = 'hng-profile hng-profile-export-only';
    wrap.appendChild(panel);

    const target =
      document.querySelector('#bigbox > td') ||
      document.querySelector('#hnmain') ||
      document.body;
    target.appendChild(wrap);
  }
  function scheduleProfileExportCheck() {
    if (location.hostname !== 'news.ycombinator.com' || location.pathname !== '/user') return;

    const retry = () => {
      buildProfileCard();
      ensureProfileExportButton();
    };

    retry();
    window.addEventListener('load', retry, { once: true });
    setTimeout(retry, 400);
    setTimeout(retry, 1500);

    const observer = new MutationObserver(() => ensureProfileExportButton());
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => observer.disconnect(), 6000);
  }
  function createProfileExportButton(profileData) {
    const exportButton = document.createElement('button');
    exportButton.type = 'button';
    exportButton.className = 'hng-profile-export';
    exportButton.innerHTML = ICON_DOWNLOAD;

    const exportLabel = document.createElement('span');
    exportLabel.textContent = 'Export my data';
    exportButton.appendChild(exportLabel);

    exportButton.addEventListener('click', async () => {
      if (exportButton.disabled) return;

      exportButton.disabled = true;
      exportLabel.textContent = 'Exporting…';
      exportButton.title = 'Export in progress';

      try {
        const data = await exportHNAccountData(profileData, (section, page, count) => {
          exportButton.title = section + ' - page ' + page + ', ' + count + ' items';
        });
        downloadAccountZip(data, data.profile.username);
        exportLabel.textContent = 'Exported';
        exportButton.title = 'Account data ZIP exported';

        if (data.errors.length) {
          console.warn('[HN Glider] Export completed with warnings', data.errors);
        }
      } catch (e) {
        console.warn('[HN Glider] Account export failed', e);
        exportLabel.textContent = 'Export failed';
        exportButton.title = 'Export failed';
      } finally {
        exportButton.disabled = false;
        setTimeout(() => {
          exportLabel.textContent = 'Export my data';
          exportButton.title = 'Download your HN account data as a ZIP of CSV files';
        }, 2500);
      }
    });

    return exportButton;
  }
  function createProfileExportPanel(profileData) {
    const panel = document.createElement('div');
    panel.className = 'hng-profile-export-panel';

    const copy = document.createElement('div');
    copy.className = 'hng-profile-export-copy';

    const heading = document.createElement('h2');
    heading.textContent = 'Account data';

    const description = document.createElement('p');
    description.textContent =
      'Download favorites, submissions, comments, and upvotes as CSV files in a ZIP file.';

    copy.appendChild(heading);
    copy.appendChild(description);
    panel.appendChild(copy);
    panel.appendChild(createProfileExportButton(profileData));
    return panel;
  }

  /* ---------- Own-profile settings form ---------- */

  // HN prints "Only admins see your email below..." as its own line above
  // the email field. Pull that text out and show it small, under the input.
  function moveEmailNote(form) {
    const email = form.querySelector('input[name="uemail"]') ||
      Array.from(form.querySelectorAll('input')).find((input) => /email/i.test(input.name || ''));
    if (!email || form.querySelector('.hng-email-note')) return;

    const walker = document.createTreeWalker(form, NodeFilter.SHOW_TEXT);
    let textNode = null;
    while (walker.nextNode()) {
      if (/only admins see your email/i.test(walker.currentNode.nodeValue || '')) {
        textNode = walker.currentNode;
        break;
      }
    }
    if (!textNode) return;

    // Climb to the largest wrapper that holds only the note (no form fields).
    let target = textNode;
    let el = textNode.parentElement;
    while (el && el !== form && !el.querySelector('input, select, textarea')) {
      target = el;
      el = el.parentElement;
    }

    const text = (target.textContent || '').replace(/\s+/g, ' ').trim();
    if (!text) return;

    if (target.nodeType === 1 && target.tagName === 'TR') {
      target.classList.add('hng-profile-old-row');
      target.style.setProperty('display', 'none', 'important');
    } else if (target.nodeType === 1 && (target.tagName === 'TD' || target.tagName === 'TH')) {
      target.textContent = '';
    } else {
      const prev = target.previousSibling;
      const next = target.nextSibling;
      target.remove();
      [prev, next].forEach((node) => {
        if (node && node.nodeName === 'BR') node.remove();
      });
    }

    const note = document.createElement('div');
    note.className = 'hng-email-note';
    note.textContent = text;
    email.insertAdjacentElement('afterend', note);
  }

  // showdead / noprocrast are yes/no selects. Show a checkbox instead and
  // keep the (hidden) select in sync so the form still submits the same.
  function convertYesNoSelects(form) {
    form.querySelectorAll('select').forEach((select) => {
      if (select.dataset.hngCheckbox) return;
      const options = Array.from(select.options);
      const valueOf = (option) => (option.value || option.textContent || '').trim();
      const yes = options.find((option) => /^yes$/i.test(valueOf(option)));
      const no = options.find((option) => /^no$/i.test(valueOf(option)));
      if (!yes || !no || options.length !== 2) return;
      select.dataset.hngCheckbox = '1';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'hng-checkbox';
      checkbox.id = 'hng-cb-' + (select.name || Math.random().toString(36).slice(2));
      checkbox.checked = yes.selected;

      checkbox.addEventListener('change', () => {
        yes.selected = checkbox.checked;
        no.selected = !checkbox.checked;
        select.dispatchEvent(new Event('change', { bubbles: true }));
      });

      const row = select.closest('tr');
      const labelCell = row && row.cells.length >= 2 ? row.cells[0] : null;
      if (labelCell && !labelCell.querySelector('label')) {
        const label = document.createElement('label');
        label.htmlFor = checkbox.id;
        while (labelCell.firstChild) label.appendChild(labelCell.firstChild);
        labelCell.appendChild(label);
        checkbox.setAttribute('aria-label', label.textContent.replace(':', '').trim());
      }
      if (row) row.classList.add('hng-field-checkbox');

      select.classList.add('hng-select-hidden');
      select.insertAdjacentElement('afterend', checkbox);
    });
  }

  function enhanceProfileForm(form, table) {
    if (form.dataset.hngFormDone) return;
    form.dataset.hngFormDone = '1';
    form.classList.add('hng-profile-form');
    table.classList.add('hng-profile-fields');

    Array.from(table.rows).forEach((row) => {
      if (row.cells.length >= 2) row.cells[0].classList.add('hng-field-label');
    });

    moveEmailNote(form);
    convertYesNoSelects(form);

    // Move the update button into a right-aligned row at the end of the form.
    const submit = form.querySelector('input[type="submit"]');
    if (submit) {
      const actions = document.createElement('div');
      actions.className = 'hng-profile-form-actions';
      form.appendChild(actions);
      actions.appendChild(submit);
    }
  }

  function buildProfileCard() {
    if (
      document.documentElement.getAttribute('op') !== 'user' &&
      !document.documentElement.classList.contains('hng-user-page')
    ) return;

    const oldTable = findHNProfileTable();
    if (!oldTable || oldTable.dataset.hngProfileDone) return;

    const userLink = oldTable.querySelector('a[href*="user?id="]');
    const params = new URLSearchParams(location.search);
    const username = (userLink ? userLink.textContent.trim() : params.get('id')) || 'User';

    const values = new Map();
    Array.from(oldTable.rows).forEach((row) => {
      if (!row.cells[0] || !row.cells[1]) return;
      const label = row.cells[0].textContent.replace(':', '').trim().toLowerCase();
      if (label) values.set(label, row.cells[1]);
    });

    const card = document.createElement('section');
    card.className = 'hng-profile';

    const head = document.createElement('div');
    head.className = 'hng-profile-head';

    const avatar = createAvatar(username, 'hng-avatar-profile');
    avatar.classList.add('hng-profile-avatar');

    const identity = document.createElement('div');
    identity.className = 'hng-profile-identity';

    const name = document.createElement('h1');
    name.className = 'hng-profile-name';
    if (userLink) {
      const nameLink = userLink.cloneNode(true);
      nameLink.classList.add('hng-profile-name-link');
      name.appendChild(nameLink);
    } else {
      name.textContent = username;
    }
    identity.appendChild(name);

    const createdCell = values.get('created');
    if (createdCell && createdCell.textContent.trim()) {
      const joined = document.createElement('div');
      joined.className = 'hng-profile-joined';
      joined.appendChild(document.createTextNode('Joined '));

      const createdLink = createdCell.querySelector('a');
      if (createdLink) {
        joined.appendChild(createdLink.cloneNode(true));
      } else {
        joined.appendChild(document.createTextNode(createdCell.textContent.trim()));
      }
      identity.appendChild(joined);
    }

    const karmaCell = values.get('karma');
    const karmaText = karmaCell ? karmaCell.textContent.trim() : '';
    const karmaNumber = Number(karmaText.replace(/,/g, ''));
    const karma = document.createElement('div');
    karma.className = 'hng-profile-karma';
    const karmaValue = document.createElement('strong');
    karmaValue.textContent = Number.isFinite(karmaNumber) && karmaText
      ? karmaNumber.toLocaleString('en-US')
      : karmaText;
    const karmaLabel = document.createElement('span');
    karmaLabel.textContent = 'karma';
    karma.appendChild(karmaValue);
    karma.appendChild(karmaLabel);

    head.appendChild(avatar);
    head.appendChild(identity);
    if (karmaText) identity.appendChild(karma);
    card.appendChild(head);

    // Pills go right under the username / joined / karma block.
    const actionDefs = [
      { key: 'submissions', label: 'submissions', match: (href) => /(?:^|\/)submitted\?id=/.test(href) },
      { key: 'comments', label: 'comments', match: (href) => /(?:^|\/)threads\?id=/.test(href) },
      { key: 'favorites', label: 'favorites', match: (href) => /(?:^|\/)favorites\?id=/.test(href) },
      { key: 'upvoted-submissions', label: 'upvoted submissions', match: (href) => /(?:^|\/)upvoted\?id=/.test(href) && !/[?&]comments=t(?:&|$)/.test(href) },
      { key: 'upvoted-comments', label: 'upvoted comments', match: (href) => /(?:^|\/)upvoted\?id=/.test(href) && /[?&]comments=t(?:&|$)/.test(href) },
    ];
    const anchorList = Array.from(oldTable.querySelectorAll('a[href]'));
    const actionLinks = actionDefs.map((def) => {
      const link = anchorList.find((a) => def.match(a.getAttribute('href') || ''));
      return link ? { def, link } : null;
    }).filter(Boolean);

    if (actionLinks.length) {
      const actions = document.createElement('div');
      actions.className = 'hng-profile-actions';

      actionLinks.forEach(({ def, link: oldLink }) => {
        const link = document.createElement('a');
        link.className = 'hng-profile-action hng-profile-action-' + def.key;
        link.href = oldLink.getAttribute('href');

        if (def.key === 'favorites') link.innerHTML = ICON_HEART;
        else if (def.key === 'comments' || def.key === 'upvoted-comments') link.innerHTML = ICON_COMMENT;
        else if (def.key === 'upvoted-submissions') link.innerHTML = ICON_UP;
        else link.innerHTML = ICON_LIST;

        const span = document.createElement('span');
        span.textContent = def.label;
        link.appendChild(span);
        actions.appendChild(link);
      });

      card.appendChild(actions);
    }

    // On someone else's profile "about" is plain text, shown in the card.
    // On your own profile it's an editable textarea that stays in the form.
    const aboutCell = values.get('about');
    const aboutEditable = !!(aboutCell && aboutCell.querySelector('textarea'));
    const aboutText = aboutCell ? aboutCell.textContent.trim() : '';
    if (aboutText && aboutCell && !aboutEditable) {
      const about = document.createElement('div');
      about.className = 'hng-profile-about';
      Array.from(aboutCell.childNodes).forEach((node) => {
        about.appendChild(node.cloneNode(true));
      });
      card.appendChild(about);
    }

    oldTable.dataset.hngProfileDone = '1';
    oldTable.classList.add('hng-profile-old');

    const replacedLabels = new Set(['user', 'created', 'karma', 'about']);
    Array.from(oldTable.rows).forEach((row) => {
      const label = row.cells[0]
        ? row.cells[0].textContent.replace(':', '').trim().toLowerCase()
        : '';
      const hasActionLink = !!row.querySelector(
        'a[href*="submitted?id="], a[href*="threads?id="], a[href*="favorites?id="], a[href*="upvoted?id="]'
      );
      const keepEditableAbout = label === 'about' && aboutEditable;
      if ((replacedLabels.has(label) && !keepEditableAbout) || hasActionLink) {
        row.classList.add('hng-profile-old-row');
        row.style.setProperty('display', 'none', 'important');
      }
    });

    const profileForm = oldTable.closest('form');
    if (profileForm && profileForm.parentNode) {
      // Own profile: the settings form lives inside the card, under the pills.
      profileForm.parentNode.insertBefore(card, profileForm);
      card.appendChild(profileForm);
      enhanceProfileForm(profileForm, oldTable);
    } else {
      oldTable.parentNode.insertBefore(card, oldTable);
    }
  }

  function enhanceAlgoliaPage() {
    if (location.hostname !== 'hn.algolia.com') return;

    const addSearchClearButton = () => {
      const input = document.querySelector('.SearchHeader .SearchInput');
      if (!input || !input.parentElement || input.parentElement.querySelector('.hng-search-clear')) return;

      const clear = document.createElement('button');
      clear.type = 'button';
      clear.className = 'hng-search-clear';
      clear.title = 'Clear search';
      clear.setAttribute('aria-label', 'Clear search');
      clear.innerHTML = ICON_X;

      const sync = () => {
        clear.hidden = !input.value;
      };

      clear.addEventListener('click', () => {
        const valueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          'value'
        ).set;
        valueSetter.call(input, '');
        input.dispatchEvent(new Event('input', { bubbles: true }));
        sync();
        input.focus();
      });

      input.addEventListener('input', sync);
      input.insertAdjacentElement('afterend', clear);
      sync();
    };

    const addThemeToggle = () => {
      const searchBar = document.querySelector('.SearchHeader_search');
      if (!searchBar) return false;

      if (!searchBar.querySelector('.hng-toggle')) {
        const toggle = buildToggle();
        const settings = searchBar.querySelector('.SearchHeader_settings');
        if (settings) searchBar.insertBefore(toggle, settings);
        else searchBar.appendChild(toggle);
      }

      updateToggleUI(currentMode);
      addSearchClearButton();
      return true;
    };

    addThemeToggle();

    let refreshQueued = false;
    const scheduleRefresh = () => {
      if (refreshQueued) return;
      refreshQueued = true;
      const run = () => {
        refreshQueued = false;
        if (location.hostname === 'hn.algolia.com') addThemeToggle();
      };
      if (typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(run);
      } else {
        setTimeout(run, 16);
      }
    };

    // Algolia is a single-page app. Keep watching so the theme toggle and
    // search clear button come back after React route changes.
    const observer = new MutationObserver(scheduleRefresh);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('popstate', scheduleRefresh);
  }

  function init() {
    applyTheme(currentMode);
    buildTopbar();
    buildProfileCard();
    scheduleProfileExportCheck();
    enhanceAlgoliaPage();
    enhanceStoryList();
    enhanceComments();
    enhanceUserKarma();
    enhanceAvatars();

    if (location.hostname === 'news.ycombinator.com') {
      widenCommentForm();
      enhanceVoteLinks();
      window.addEventListener('click', onVoteClick, true);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();