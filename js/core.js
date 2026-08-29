/* Jot - core.js | Data, icons, sanitizing and local storage */
'use strict';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const uid = () => (window.crypto?.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 10));

const I = {
  panel:'<rect x="3.5" y="5" width="17" height="14" rx="3.5"/><line x1="8.5" y1="9" x2="8.5" y2="15"/>',
  menu:'<line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="20" y2="17"/>',
  search:'<circle cx="11" cy="11" r="7"/><line x1="20" y1="20" x2="16.5" y2="16.5"/>',
  x:'<line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>',
  plus:'<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  minus:'<line x1="5" y1="12" x2="19" y2="12"/>',
  back:'<path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/>',
  kebab:'<circle cx="12" cy="5" r="1.7" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.7" fill="currentColor" stroke="none"/><circle cx="12" cy="19" r="1.7" fill="currentColor" stroke="none"/>',
  star:'<path d="M12 4l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4L4.2 9.7l5.4-.8z"/>',
  pin:'<path d="M12 16v6"/><path d="M9 3h6v8l3 3H6l3-3z"/>',
  folder:'<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  chev:'<path d="M9 6l6 6-6 6"/>',
  tag:'<path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z"/><line x1="7" y1="7" x2="7.01" y2="7"/>',
  gear:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>',
  moon:'<path d="M20.5 15.2A8.5 8.5 0 0 1 8.8 3.5 8.5 8.5 0 1 0 20.5 15.2z"/>',
  sync:'<path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.5 9a9 9 0 0 1 14.9-3.4L23 10"/><path d="M1 14l4.6 4.4A9 9 0 0 0 20.5 15"/>',
  clock:'<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  doc:'<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
  trash:'<path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>',
  restore:'<polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>',
  grid:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  sort:'<line x1="4" y1="6" x2="16" y2="6"/><line x1="4" y1="12" x2="10" y2="12"/><line x1="4" y1="18" x2="6" y2="18"/><polyline points="19 15 21 17 23 15"/><line x1="21" y1="17" x2="21" y2="7"/>',
  bold:'<path d="M7 5h6a3.5 3.5 0 0 1 0 7H7z"/><path d="M7 12h7a3.5 3.5 0 0 1 0 7H7z"/>',
  italic:'<line x1="10" y1="5" x2="15" y2="5"/><line x1="9" y1="19" x2="14" y2="19"/><line x1="12.5" y1="5" x2="11.5" y2="19"/>',
  underline:'<path d="M7 4v7a5 5 0 0 0 10 0V4"/><line x1="6" y1="20" x2="18" y2="20"/>',
  heading:'<path d="M7 5v14"/><path d="M17 5v14"/><path d="M7 12h10"/>',
  ul:'<line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><circle cx="4.5" cy="6" r="1.1" fill="currentColor" stroke="none"/><circle cx="4.5" cy="12" r="1.1" fill="currentColor" stroke="none"/><circle cx="4.5" cy="18" r="1.1" fill="currentColor" stroke="none"/>',
  ol:'<text x="3" y="8.5" font-size="7" fill="currentColor" stroke="none">1</text><text x="3" y="14.5" font-size="7" fill="currentColor" stroke="none">2</text><text x="3" y="20.5" font-size="7" fill="currentColor" stroke="none">3</text><line x1="10" y1="6" x2="20" y2="6"/><line x1="10" y1="12" x2="20" y2="12"/><line x1="10" y1="18" x2="20" y2="18"/>',
  check:'<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M9 12.5l2.2 2.2L15.5 10"/>',
  link:'<path d="M10 14a4 4 0 0 1 0-5.7l2.3-2.3a4 4 0 0 1 5.7 5.7L16.8 13"/><path d="M14 10a4 4 0 0 1 0 5.7l-2.3 2.3a4 4 0 0 1-5.7-5.7L7.2 11"/>',
  moreh:'<circle cx="5" cy="12" r="1.7" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.7" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.7" fill="currentColor" stroke="none"/>',
  import:'<path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M5 21h14"/>',
  export:'<path d="M12 15V3"/><path d="M7 8l5-5 5 5"/><path d="M5 21h14"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 10v6"/><path d="M12 7h.01"/>'
};
const ic = (name, cls = '') => '<svg class="' + esc(cls) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (I[name] || '') + '</svg>';
$$('[data-icon]').forEach(el => { el.innerHTML = ic(el.getAttribute('data-icon')); });

/* ---------- Sanitize & Markdown ---------- */
const ALLOW = new Set(['P','DIV','BR','B','STRONG','I','EM','U','H1','H2','H3','H4','UL','OL','LI','A','SPAN','BLOCKQUOTE','PRE']);
const KILL = new Set(['SCRIPT','STYLE','IFRAME','OBJECT','EMBED','LINK','META','FORM','INPUT','BUTTON','VIDEO','AUDIO','SVG','IMG']);
function sanitize(html) {
  const t = document.createElement('div');
  t.innerHTML = html || '';
  for (const el of Array.from(t.querySelectorAll('*'))) {
    if (KILL.has(el.tagName)) { el.remove(); continue; }
    if (!ALLOW.has(el.tagName)) { el.replaceWith(...el.childNodes); continue; }
    for (const a of Array.from(el.attributes)) {
      const ok = (el.tagName === 'A' && a.name.toLowerCase() === 'href' && /^(https?|mailto):/i.test(a.value || ''))
        || (a.name.toLowerCase() === 'class' && (el.tagName === 'LI' || el.tagName === 'UL' || el.tagName === 'SPAN'));
      if (!ok) el.removeAttribute(a.name);
    }
    if (el.tagName === 'A') { el.setAttribute('target','_blank'); el.setAttribute('rel','noopener noreferrer'); }
  }
  return t.innerHTML;
}
const plain = html => { const d = document.createElement('div'); d.innerHTML = html || ''; return d.textContent || ''; };

function htmlToMd(html) {
  const t = document.createElement('div'); t.innerHTML = html || '';
  const inline = node => {
    let out = '';
    node.childNodes.forEach(c => {
      if (c.nodeType === Node.TEXT_NODE) out += c.textContent;
      else if (c.nodeType === Node.ELEMENT_NODE) {
        const tag = c.tagName;
        if (tag === 'BR') out += '\n';
        else if (tag === 'B' || tag === 'STRONG') out += '**' + inline(c) + '**';
        else if (tag === 'I' || tag === 'EM') out += '*' + inline(c) + '*';
        else if (tag === 'U') out += '<u>' + inline(c) + '</u>';
        else if (tag === 'A') out += '[' + inline(c) + '](' + (c.getAttribute('href') || '') + ')';
        else if (tag === 'SPAN' && c.classList.contains('cb')) { /* checkbox marker handled by list */ }
        else out += inline(c);
      }
    });
    return out;
  };
  const blocks = Array.from(t.children);
  let md = '';
  blocks.forEach(el => {
    const tag = el.tagName;
    if (tag === 'H1') md += '# ' + inline(el) + '\n\n';
    else if (tag === 'H2') md += '## ' + inline(el) + '\n\n';
    else if (tag === 'H3') md += '### ' + inline(el) + '\n\n';
    else if (tag === 'H4') md += '#### ' + inline(el) + '\n\n';
    else if (tag === 'UL' && el.classList.contains('cl')) {
      Array.from(el.children).forEach(li => md += '- [' + (li.classList.contains('done') ? 'x' : ' ') + '] ' + inline(li).trim() + '\n');
      md += '\n';
    } else if (tag === 'UL') {
      Array.from(el.children).forEach(li => md += '- ' + inline(li).trim() + '\n'); md += '\n';
    } else if (tag === 'OL') {
      Array.from(el.children).forEach((li, i) => md += (i + 1) + '. ' + inline(li).trim() + '\n'); md += '\n';
    } else if (tag === 'BLOCKQUOTE') md += '> ' + inline(el).replace(/\n/g, '\n> ') + '\n\n';
    else if (tag === 'PRE') md += '```\n' + el.textContent + '\n```\n\n';
    else { const s = inline(el).trim(); if (s) md += s + '\n\n'; }
  });
  return md.trim();
}

function mdToHtml(md) {
  const lines = String(md || '').split(/\r?\n/);
  let html = '', list = null, quote = false, pre = false, preBuf = [];
  const inline = s => esc(s)
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+|mailto:[^)\s]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+)__/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/_([^_]+)_/g, '<em>$1</em>');
  const closeList = () => { if (list) { html += '</' + (list === 'ulcl' ? 'ul' : list) + '>'; list = null; } };
  const closeQuote = () => { if (quote) { html += '</blockquote>'; quote = false; } };
  for (const line of lines) {
    if (pre) { if (/^```/.test(line)) { html += '<pre>' + esc(preBuf.join('\n')) + '</pre>'; pre = false; preBuf = []; } else preBuf.push(line); continue; }
    if (/^\s*```/.test(line)) { closeList(); closeQuote(); pre = true; continue; }
    let m;
    if ((m = line.match(/^\s*[-*]\s+\[( |x|X)\]\s+(.*)$/))) {
      closeQuote(); if (list !== 'ulcl') { closeList(); html += '<ul class="cl">'; list = 'ulcl'; }
      html += '<li' + (m[1].toLowerCase() === 'x' ? ' class="done"' : '') + '><span class="cb" contenteditable="false"></span>' + inline(m[2]) + '</li>'; continue;
    }
    if ((m = line.match(/^\s*[-*]\s+(.*)$/))) {
      closeQuote(); if (list !== 'ul') { closeList(); html += '<ul>'; list = 'ul'; }
      html += '<li>' + inline(m[1]) + '</li>'; continue;
    }
    if ((m = line.match(/^\s*\d+\.\s+(.*)$/))) {
      closeQuote(); if (list !== 'ol') { closeList(); html += '<ol>'; list = 'ol'; }
      html += '<li>' + inline(m[1]) + '</li>'; continue;
    }
    if ((m = line.match(/^>\s?(.*)$/))) {
      closeList(); if (!quote) { html += '<blockquote>'; quote = true; }
      html += inline(m[1]) + '<br>'; continue;
    }
    if ((m = line.match(/^(#{1,4})\s+(.*)$/))) {
      closeList(); closeQuote(); const h = m[1].length; html += '<h' + h + '>' + inline(m[2]) + '</h' + h + '>'; continue;
    }
    if (!line.trim()) { closeList(); closeQuote(); continue; }
    closeList(); closeQuote(); html += '<p>' + inline(line) + '</p>';
  }
  if (pre) html += '<pre>' + esc(preBuf.join('\n')) + '</pre>';
  closeList(); closeQuote();
  return sanitize(html);
}

function applyMd(note, text) {
  const lines = String(text || '').split(/\r?\n/);
  let start = 0;
  if (lines[0]?.startsWith('# ')) { note.title = lines[0].slice(2).trim(); start = 1; }
  note.body = mdToHtml(lines.slice(start).join('\n'));
  note.updated = Date.now();
}

/* ---------- Local data ---------- */
const KEY = 'fastnote.v2';
const TRASH_DAYS = 30;
function seedNB() {
  return [
    { id:'nb0', name:'00 INBOX & CAPTURE', parent:null },
    { id:'nb1', name:'01 CURRENT PROJECTS', parent:null },
    { id:'nb2', name:'02 IDEAS & BRAINSTORMING', parent:null },
    { id:'nb3', name:'03 MEDIA & INTERESTS', parent:null },
    { id:'nb4', name:'04 KNOWLEDGE', parent:null },
    { id:'nb5', name:'05 PERSONAL & LIFE', parent:null },
    { id:'nb6', name:'06 ARCHIVE', parent:null }
  ].map(n => ({ ...n, open:false }));
}

let db = null;
try { db = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { db = null; }
if (!db || !Array.isArray(db.notes)) db = { notes:[], notebooks:seedNB(), prefs:{ theme:'light', viewMode:'list', sortBy:'default' } };
db.prefs = { theme:'light', viewMode:'list', sortBy:'default', ...(db.prefs || {}) };
if (!Array.isArray(db.notebooks) || !db.notebooks.length) db.notebooks = seedNB();
db.notebooks.forEach(nb => { if (nb.open === undefined) nb.open = false; });
db.notes.forEach(n => {
  n.body = sanitize(n.body || '');
  n.tags = Array.isArray(n.tags) ? n.tags : [];
  n.created = Number(n.created) || Date.now();
  n.updated = Number(n.updated) || n.created;
  n.viewed = Number(n.viewed) || n.updated;
  n.zoom = Number(n.zoom) || 100;
  n.color = n.color || 'white';
  n.paper = n.paper || 'none';
});
const beforePurge = db.notes.length + db.notebooks.length;
db.notes = db.notes.filter(n => !n.trashed || Date.now() - n.trashed < TRASH_DAYS * 864e5);
db.notebooks = db.notebooks.filter(n => !n.trashed || Date.now() - n.trashed < TRASH_DAYS * 864e5);
function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
    return true;
  } catch (error) {
    window.dispatchEvent(new CustomEvent('jot-storage-error'));
    return false;
  }
}
if (beforePurge !== db.notes.length + db.notebooks.length) save();

const byId = id => db.notes.find(n => n.id === id);
const byNb = id => db.notebooks.find(n => n.id === id);
const nbName = id => byNb(id)?.name || '';
const childrenOf = parent => db.notebooks.filter(n => n.parent === parent && !n.trashed);
function descSet(id) {
  const result = new Set([id]);
  const walk = parent => childrenOf(parent).forEach(child => { if (!result.has(child.id)) { result.add(child.id); walk(child.id); } });
  walk(id); return result;
}
function notesIn(id) { const ids = descSet(id); return db.notes.filter(n => ids.has(n.nb) && !n.trashed); }
function allTags() {
  const map = {};
  db.notes.forEach(n => { if (!n.trashed) (n.tags || []).forEach(t => { const key = String(t).trim(); if (key) map[key] = (map[key] || 0) + 1; }); });
  return Object.entries(map).sort((a,b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}
function sortNotesList(list) {
  const s = db.prefs.sortBy || 'default';
  return list.sort((a,b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    if (s === 'alphaAsc') return (a.title || '').localeCompare(b.title || '');
    if (s === 'alphaDesc') return (b.title || '').localeCompare(a.title || '');
    if (s === 'createdNew') return b.created - a.created;
    if (s === 'createdOld') return a.created - b.created;
    if (s === 'updatedOld') return a.updated - b.updated;
    if (s === 'viewedNew') return (b.viewed || 0) - (a.viewed || 0);
    return b.updated - a.updated;
  });
}
function fmtDate(ts) {
  const d = new Date(Number(ts) || Date.now());
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString([], { hour:'numeric', minute:'2-digit' });
  const diff = now - d;
  if (diff >= 0 && diff < 7 * 864e5) return d.toLocaleDateString([], { weekday:'short' });
  return d.toLocaleDateString([], { month:'short', day:'numeric', year:d.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
}
