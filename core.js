/* Take Fast Notes - core.js | Icons, Sanitizing, Markdown, Data, Utilities */
'use strict';

/* ---------- DOM helpers ---------- */

const $ = selector => document.querySelector(selector);
const $$ = selector => Array.from(document.querySelectorAll(selector));

/* ---------- Escaping / IDs ---------- */

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function uid() {
  return (
    'n-'
    + Date.now().toString(36)
    + '-'
    + Math.random().toString(36).slice(2, 8)
  );
}

/* ---------- Icons ---------- */

const I = {
  panel:
    '<rect x="3" y="4" width="18" height="16" rx="2"/>'
    + '<path d="M9 4v16"/>',

  sort:
    '<path d="M8 6h10"/>'
    + '<path d="M8 12h7"/>'
    + '<path d="M8 18h4"/>'
    + '<path d="M4 6h.01"/>'
    + '<path d="M4 12h.01"/>'
    + '<path d="M4 18h.01"/>',

  grid:
    '<rect x="4" y="4" width="6" height="6" rx="1"/>'
    + '<rect x="14" y="4" width="6" height="6" rx="1"/>'
    + '<rect x="4" y="14" width="6" height="6" rx="1"/>'
    + '<rect x="14" y="14" width="6" height="6" rx="1"/>',

  menu:
    '<circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none"/>'
    + '<circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/>'
    + '<circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none"/>',

  search:
    '<circle cx="10.8" cy="10.8" r="6.2"/>'
    + '<path d="M16 16l4.3 4.3"/>',

  x:
    '<path d="M6 6l12 12"/>'
    + '<path d="M18 6L6 18"/>',

  check:
    '<path d="M5 12.5l4.5 4.5L19 7.5"/>',

  plus:
    '<path d="M12 5v14"/>'
    + '<path d="M5 12h14"/>',

  back:
    '<path d="M19 12H5"/>'
    + '<path d="M12 19l-7-7 7-7"/>',

  kebab:
    '<circle cx="12" cy="5" r="1.4" fill="currentColor" stroke="none"/>'
    + '<circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/>'
    + '<circle cx="12" cy="19" r="1.4" fill="currentColor" stroke="none"/>',

  doc:
    '<path d="M6 3h8l4 4v14H6z"/>'
    + '<path d="M14 3v5h5"/>'
    + '<path d="M9 13h6"/>'
    + '<path d="M9 17h6"/>',

  folder:
    '<path d="M3.5 7.5h6l1.6-2H15l1.7 2h3.8v10.2a2.3 2.3 0 0 1-2.3 2.3H5.8a2.3 2.3 0 0 1-2.3-2.3z"/>',

  tag:
    '<path d="M20.5 13.5L13.5 20.5a2 2 0 0 1-2.8 0L4 13.8V5h8.8l7.7 7.7a.9.9 0 0 1 0 .8z"/>'
    + '<circle cx="8.5" cy="8.5" r="1"/>',

  trash:
    '<path d="M4 7h16"/>'
    + '<path d="M9 7V4h6v3"/>'
    + '<path d="M7 7l1 13h8l1-13"/>'
    + '<path d="M10 11v5"/>'
    + '<path d="M14 11v5"/>',

  star:
    '<path d="M12 4.3l2.3 4.7 5.2.8-3.8 3.7.9 5.2-4.6-2.4-4.6 2.4.9-5.2-3.8-3.7 5.2-.8z"/>',

  pin:
    '<path d="M8 4h8l-1.5 5 3.2 3.2H6.3L9.5 9z"/>'
    + '<path d="M12 12.2V21"/>',

  clock:
    '<circle cx="12" cy="12" r="8.5"/>'
    + '<path d="M12 7v5l3.5 2"/>',

  sun:
    '<circle cx="12" cy="12" r="3.5"/>'
    + '<path d="M12 2.5v2"/>'
    + '<path d="M12 19.5v2"/>'
    + '<path d="M2.5 12h2"/>'
    + '<path d="M19.5 12h2"/>'
    + '<path d="M5.3 5.3l1.4 1.4"/>'
    + '<path d="M17.3 17.3l1.4 1.4"/>'
    + '<path d="M18.7 5.3l-1.4 1.4"/>'
    + '<path d="M6.7 17.3l-1.4 1.4"/>',

  gear:
    '<circle cx="12" cy="12" r="3"/>'
    + '<path d="M19 12a7 7 0 0 0-.1-1.2l1.7-1.3-1.8-3-2 .8a7 7 0 0 0-2-1.2L14.5 4h-3l-.3 2.1a7 7 0 0 0-2 1.2l-2-.8-1.8 3 1.7 1.3A7 7 0 0 0 7 12c0 .4 0 .8.1 1.2l-1.7 1.3 1.8 3 2-.8a7 7 0 0 0 2 1.2l.3 2.1h3l.3-2.1a7 7 0 0 0 2-1.2l2 .8 1.8-3-1.7-1.3c.1-.4.1-.8.1-1.2z"/>',

  heading:
    '<path d="M6 5v14"/>'
    + '<path d="M18 5v14"/>'
    + '<path d="M6 12h12"/>',

  bold:
    '<path d="M8 5h5a4 4 0 0 1 0 8H8z"/>'
    + '<path d="M8 13h6a3.5 3.5 0 0 1 0 7H8z"/>',

  italic:
    '<path d="M10 5h8"/>'
    + '<path d="M6 19h8"/>'
    + '<path d="M14 5L10 19"/>',

  underline:
    '<path d="M7 5v6a5 5 0 0 0 10 0V5"/>'
    + '<path d="M6 20h12"/>',

  ul:
    '<path d="M9 6h10"/>'
    + '<path d="M9 12h10"/>'
    + '<path d="M9 18h10"/>'
    + '<circle cx="5" cy="6" r="1" fill="currentColor" stroke="none"/>'
    + '<circle cx="5" cy="12" r="1" fill="currentColor" stroke="none"/>'
    + '<circle cx="5" cy="18" r="1" fill="currentColor" stroke="none"/>',

  ol:
    '<path d="M10 6h9"/>'
    + '<path d="M10 12h9"/>'
    + '<path d="M10 18h9"/>'
    + '<path d="M5 5.5v3"/>'
    + '<path d="M4 5.5h1"/>'
    + '<path d="M4 9h2"/>'
    + '<path d="M4 11.5h2"/>'
    + '<path d="M4 15l1-1v5"/>'
    + '<path d="M4 19h2"/>',

  link:
    '<path d="M10 13.5l4-4"/>'
    + '<path d="M7.5 15.8l-1 1a4 4 0 0 1-5.7-5.7l2.3-2.3a4 4 0 0 1 5.7 5.7"/>'
    + '<path d="M16.5 8.2l1-1a4 4 0 0 0-5.7-5.7L9.5 3.8a4 4 0 0 0 5.7 5.7"/>',

  moreh:
    '<circle cx="5" cy="12" r="1.7" fill="currentColor" stroke="none"/>'
    + '<circle cx="12" cy="12" r="1.7" fill="currentColor" stroke="none"/>'
    + '<circle cx="19" cy="12" r="1.7" fill="currentColor" stroke="none"/>',

  import:
    '<path d="M12 3v12"/>'
    + '<path d="M7 10l5 5 5-5"/>'
    + '<path d="M5 21h14"/>',

  export:
    '<path d="M12 15V3"/>'
    + '<path d="M7 8l5-5 5 5"/>'
    + '<path d="M5 21h14"/>',

  info:
    '<circle cx="12" cy="12" r="9"/>'
    + '<path d="M12 10v6"/>'
    + '<path d="M12 7h.01"/>',

  chev:
    '<path d="M9 6l6 6-6 6"/>'
};

const ic = (name, cls = '') =>
  '<svg class="' + esc(cls)
  + '" viewBox="0 0 24 24" fill="none" stroke="currentColor"'
  + ' stroke-width="1.8" stroke-linecap="round"'
  + ' stroke-linejoin="round" aria-hidden="true">'
  + (I[name] || '')
  + '</svg>';

$$('[data-icon]').forEach(el => {
  el.innerHTML = ic(el.getAttribute('data-icon'));
});

/* ---------- Sanitize & Markdown ---------- */

const ALLOW = new Set([
  'P',
  'DIV',
  'BR',
  'B',
  'STRONG',
  'I',
  'EM',
  'U',
  'H1',
  'H2',
  'H3',
  'H4',
  'UL',
  'OL',
  'LI',
  'A',
  'SPAN',
  'BLOCKQUOTE',
  'PRE'
]);

const KILL = new Set([
  'SCRIPT',
  'STYLE',
  'IFRAME',
  'OBJECT',
  'EMBED',
  'LINK',
  'META',
  'FORM',
  'INPUT',
  'BUTTON',
  'VIDEO',
  'AUDIO',
  'SVG',
  'IMG'
]);

function sanitize(html) {
  const t = document.createElement('div');
  t.innerHTML = html || '';

  for (const el of Array.from(t.querySelectorAll('*'))) {
    if (KILL.has(el.tagName)) {
      el.remove();
      continue;
    }

    if (!ALLOW.has(el.tagName)) {
      el.replaceWith(...el.childNodes);
      continue;
    }

    for (const a of Array.from(el.attributes)) {
      const ok =
        (
          el.tagName === 'A'
          && a.name.toLowerCase() === 'href'
          && /^(https?|mailto):/i.test(a.value || '')
        )
        ||
        (
          a.name.toLowerCase() === 'class'
          && (
            el.tagName === 'LI'
            || el.tagName === 'UL'
            || el.tagName === 'SPAN'
          )
        );

      if (!ok) {
        el.removeAttribute(a.name);
      }
    }

    if (el.tagName === 'A') {
      el.setAttribute('target', '_blank');
      el.setAttribute('rel', 'noopener noreferrer');
    }
  }

  return t.innerHTML;
}

const plain = html => {
  const d = document.createElement('div');
  d.innerHTML = html || '';
  return d.textContent || '';
};

function htmlToMd(html) {
  const t = document.createElement('div');
  t.innerHTML = html || '';

  const inline = node => {
    let out = '';

    node.childNodes.forEach(c => {
      if (c.nodeType === Node.TEXT_NODE) {
        out += c.textContent;
      }

      else if (c.nodeType === Node.ELEMENT_NODE) {
        const tag = c.tagName;

        if (tag === 'BR') {
          out += '\n';
        }
        else if (tag === 'B' || tag === 'STRONG') {
          out += '**' + inline(c) + '**';
        }
        else if (tag === 'I' || tag === 'EM') {
          out += '*' + inline(c) + '*';
        }
        else if (tag === 'U') {
          out += '<u>' + inline(c) + '</u>';
        }
        else if (tag === 'A') {
          out += '['
            + inline(c)
            + ']('
            + (c.getAttribute('href') || '')
            + ')';
        }
        else if (
          tag === 'SPAN'
          && c.classList.contains('cb')
        ) {
          /* handled by list conversion */
        }
        else {
          out += inline(c);
        }
      }
    });

    return out;
  };

  const blocks = Array.from(t.children);
  let md = '';

  blocks.forEach(el => {
    const tag = el.tagName;

    if (tag === 'H1') {
      md += '# ' + inline(el) + '\n\n';
    }

    else if (tag === 'H2') {
      md += '## ' + inline(el) + '\n\n';
    }

    else if (tag === 'H3') {
      md += '### ' + inline(el) + '\n\n';
    }

    else if (tag === 'H4') {
      md += '#### ' + inline(el) + '\n\n';
    }

    else if (
      tag === 'UL'
      && el.classList.contains('cl')
    ) {
      Array.from(el.children).forEach(li => {
        md +=
          '- ['
          + (li.classList.contains('done') ? 'x' : ' ')
          + '] '
          + inline(li).trim()
          + '\n';
      });

      md += '\n';
    }

    else if (tag === 'UL') {
      Array.from(el.children).forEach(li => {
        md += '- ' + inline(li).trim() + '\n';
      });

      md += '\n';
    }

    else if (tag === 'OL') {
      Array.from(el.children).forEach((li, i) => {
        md +=
          (i + 1)
          + '. '
          + inline(li).trim()
          + '\n';
      });

      md += '\n';
    }

    else if (tag === 'BLOCKQUOTE') {
      md +=
        '> '
        + inline(el).replace(/\n/g, '\n> ')
        + '\n\n';
    }

    else if (tag === 'PRE') {
      md +=
        '```\n'
        + el.textContent
        + '\n```\n\n';
    }

    else {
      const s = inline(el).trim();
      if (s) {
        md += s + '\n\n';
      }
    }
  });

  return md.trim();
}

function mdToHtml(md) {
  const lines = String(md || '').split(/\r?\n/);

  let html = '';
  let list = null;
  let quote = false;
  let pre = false;
  let preBuf = [];

  const inline = s =>
    esc(s)
      .replace(
        /\[([^\]]+)\]\((https?:\/\/[^)\s]+|mailto:[^)\s]+)\)/g,
        '<a href="$2">$1</a>'
      )
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/__([^_]+)__/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/_([^_]+)_/g, '<em>$1</em>');

  const closeList = () => {
    if (list) {
      html += '</' + (list === 'ulcl' ? 'ul' : list) + '>';
      list = null;
    }
  };

  const closeQuote = () => {
    if (quote) {
      html += '</blockquote>';
      quote = false;
    }
  };

  for (const line of lines) {
    if (pre) {
      if (/^```/.test(line)) {
        html +=
          '<pre>'
          + esc(preBuf.join('\n'))
          + '</pre>';

        pre = false;
        preBuf = [];
      } else {
        preBuf.push(line);
      }

      continue;
    }

    if (/^\s*```/.test(line)) {
      closeList();
      closeQuote();
      pre = true;
      continue;
    }

    let m;

    if (
      (m = line.match(
        /^\s*[-*]\s+\[( |x|X)\]\s+(.*)$/
      ))
    ) {
      closeQuote();

      if (list !== 'ulcl') {
        closeList();
        html += '<ul class="cl">';
        list = 'ulcl';
      }

      html +=
        '<li'
        + (m[1].toLowerCase() === 'x'
          ? ' class="done"'
          : '')
        + '>'
        + '<span class="cb" contenteditable="false"></span>'
        + inline(m[2])
        + '</li>';

      continue;
    }

    if (
      (m = line.match(/^\s*[-*]\s+(.*)$/))
    ) {
      closeQuote();

      if (list !== 'ul') {
        closeList();
        html += '<ul>';
        list = 'ul';
      }

      html += '<li>' + inline(m[1]) + '</li>';
      continue;
    }

    if (
      (m = line.match(/^\s*\d+\.\s+(.*)$/))
    ) {
      closeQuote();

      if (list !== 'ol') {
        closeList();
        html += '<ol>';
        list = 'ol';
      }

      html += '<li>' + inline(m[1]) + '</li>';
      continue;
    }

    if ((m = line.match(/^>\s?(.*)$/))) {
      closeList();

      if (!quote) {
        html += '<blockquote>';
        quote = true;
      }

      html += inline(m[1]) + '<br>';
      continue;
    }

    if (
      (m = line.match(/^(#{1,4})\s+(.*)$/))
    ) {
      closeList();
      closeQuote();

      const h = m[1].length;

      html +=
        '<h'
        + h
        + '>'
        + inline(m[2])
        + '</h'
        + h
        + '>';

      continue;
    }

    if (!line.trim()) {
      closeList();
      closeQuote();
      continue;
    }

    closeList();
    closeQuote();

    html += '<p>' + inline(line) + '</p>';
  }

  if (pre) {
    html +=
      '<pre>'
      + esc(preBuf.join('\n'))
      + '</pre>';
  }

  closeList();
  closeQuote();

  return sanitize(html);
}

function applyMd(note, text) {
  const lines = String(text || '').split(/\r?\n/);

  let start = 0;

  if (lines[0]?.startsWith('# ')) {
    note.title = lines[0].slice(2).trim();
    start = 1;
  }

  note.body =
    mdToHtml(lines.slice(start).join('\n'));

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
  ].map(n => ({
    ...n,
    open:false
  }));
}

let db = null;

try {
  db = JSON.parse(
    localStorage.getItem(KEY) || 'null'
  );
} catch {
  db = null;
}

if (!db || !Array.isArray(db.notes)) {
  db = {
    notes: [],
    notebooks: seedNB(),
    prefs: {
      theme: 'light',
      viewMode: 'list',
      sortBy: 'default',
      startPlace: 'home'
    }
  };
}

db.prefs = {
  theme: 'light',
  viewMode: 'list',
  sortBy: 'default',
  startPlace: 'home',
  ...(db.prefs || {})
};

if (
  !Array.isArray(db.notebooks)
  || !db.notebooks.length
) {
  db.notebooks = seedNB();
}

db.notebooks.forEach(nb => {
  if (nb.open === undefined) {
    nb.open = false;
  }
});

db.notes.forEach(n => {
  n.body = sanitize(n.body || '');

  n.tags = Array.isArray(n.tags)
    ? n.tags
    : [];

  n.created =
    Number(n.created)
    || Date.now();

  n.updated =
    Number(n.updated)
    || n.created;

  n.viewed =
    Number(n.viewed)
    || n.updated;

  n.zoom =
    Number(n.zoom)
    || 100;

  n.color =
    n.color
    || 'white';
});

const beforePurge =
  db.notes.length
  + db.notebooks.length;

db.notes = db.notes.filter(
  n =>
    !n.trashed
    || Date.now() - n.trashed
      < TRASH_DAYS * 864e5
);

db.notebooks = db.notebooks.filter(
  n =>
    !n.trashed
    || Date.now() - n.trashed
      < TRASH_DAYS * 864e5
);

function save() {
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify(db)
    );

    return true;
  } catch (error) {
    window.dispatchEvent(
      new CustomEvent(
        'take-fast-notes-storage-error'
      )
    );

    return false;
  }
}

if (
  beforePurge
  !== db.notes.length + db.notebooks.length
) {
  save();
}

const byId =
  id => db.notes.find(n => n.id === id);

const byNb =
  id => db.notebooks.find(n => n.id === id);

const nbName =
  id => byNb(id)?.name || '';

const childrenOf =
  parent =>
    db.notebooks.filter(
      n =>
        n.parent === parent
        && !n.trashed
    );

function descSet(id) {
  const result = new Set([id]);

  const walk = parent =>
    childrenOf(parent).forEach(child => {
      if (!result.has(child.id)) {
        result.add(child.id);
        walk(child.id);
      }
    });

  walk(id);

  return result;
}

function notesIn(id) {
  const ids = descSet(id);

  return db.notes.filter(
    n =>
      ids.has(n.nb)
      && !n.trashed
  );
}

function allTags() {
  const map = {};

  db.notes.forEach(n => {
    if (n.trashed) return;

    (n.tags || []).forEach(t => {
      const key = String(t).trim();

      if (key) {
        map[key] =
          (map[key] || 0) + 1;
      }
    });
  });

  return Object.entries(map)
    .sort(
      (a, b) =>
        b[1] - a[1]
        || a[0].localeCompare(b[0])
    );
}

function sortNotesList(list) {
  const s =
    db.prefs.sortBy
    || 'default';

  return list.sort((a, b) => {
    if (a.pinned !== b.pinned) {
      return a.pinned ? -1 : 1;
    }

    if (s === 'alphaAsc') {
      return (
        a.title || ''
      ).localeCompare(
        b.title || ''
      );
    }

    if (s === 'alphaDesc') {
      return (
        b.title || ''
      ).localeCompare(
        a.title || ''
      );
    }

    if (s === 'createdNew') {
      return b.created - a.created;
    }

    if (s === 'createdOld') {
      return a.created - b.created;
    }

    if (s === 'updatedOld') {
      return a.updated - b.updated;
    }

    if (s === 'viewedNew') {
      return (
        b.viewed || 0
      ) - (
        a.viewed || 0
      );
    }

    return b.updated - a.updated;
  });
}

function fmtDate(ts) {
  const d =
    new Date(
      Number(ts)
      || Date.now()
    );

  const now = new Date();

  const sameDay =
    d.toDateString()
    === now.toDateString();

  if (sameDay) {
    return d.toLocaleTimeString(
      [],
      {
        hour: 'numeric',
        minute: '2-digit'
      }
    );
  }

  const diff = now - d;

  if (
    diff >= 0
    && diff < 7 * 864e5
  ) {
    return d.toLocaleDateString(
      [],
      { weekday:'short' }
    );
  }

  return d.toLocaleDateString(
    [],
    {
      month:'short',
      day:'numeric',
      year:
        d.getFullYear()
        === now.getFullYear()
          ? undefined
          : 'numeric'
    }
  );
}