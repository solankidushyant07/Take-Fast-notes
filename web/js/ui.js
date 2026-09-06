/* Take Fast Notes - ui.js | DOM, State, Overlays, Cards & Xiaomi Style Rendering */
'use strict';

const homeView = $('#homeView');
const homeTopbar = $('#homeTopbar');
const selBar = $('#selBar');
const selCount = $('#selCount');
const editView = $('#editView');

const navTabNotes = $('#navTabNotes');
const navTabTasks = $('#navTabTasks');
const navTabSettings = $('#navTabSettings');

const searchInput = $('#searchInput');
const searchClear = $('#searchClear');
const filterRow = $('#filterRow');
const content = $('#content');
const fab = $('#fab');

const backBtn = $('#backBtn');
const editTitleBar = $('#editTitleBar');
const saveState = $('#saveState');
const editMenuBtn = $('#editMenuBtn');

const titleInput = $('#titleInput');
const bodyInput = $('#bodyInput');
const fmtbar = $('#fmtbar');
const editorScroll = $('#editorScroll');

const scrim = $('#scrim');
const menuEl = $('#menu');
const sheet = $('#sheet');
const sheetTitle = $('#sheetTitle');
const sheetContent = $('#sheetContent');

const mdImport = $('#mdImport');
const toastEl = $('#toast');

let screen = { type: 'notes', filter: 'all' };
let currentTab = 'notes'; // 'notes' | 'tasks'
let editing = null;
let editingReadonly = false;

let saveTimer = null;
let toastTimer = null;
let menuItems = [];

let selMode = false;
let selSet = new Set();
let visibleIds = [];

let suppressClickUntil = 0;
let folderActionTarget = null;
let trashActionTarget = null;
let sheetCloseTimer = null;

const COLORS = [
  { id: 'white', name: 'Default' },
  { id: 'orange', name: 'Peach' },
  { id: 'pink', name: 'Rose' },
  { id: 'blue', name: 'Blue' },
  { id: 'yellow', name: 'Cream' },
  { id: 'green', name: 'Sage' }
];

const ZOOMS = [85, 100, 115, 130];

function normalizeTags(value) {
  const raw = Array.isArray(value) ? value : String(value ?? '').split(',');
  return [
    ...new Set(
      raw
        .map(tag => String(tag).trim().replace(/^#+/, ''))
        .filter(Boolean)
    )
  ].slice(0, 50);
}

function empty(icon, title, subtitle) {
  return (
    '<div class="empty">'
    + ic(icon)
    + '<p class="e-t">' + esc(title) + '</p>'
    + '<p class="e-s">' + esc(subtitle) + '</p>'
    + '</div>'
  );
}

/* ---------- Note Card HTML (Matches Screenshot 2) ---------- */
function noteCard(n) {
  const snip = plain(n.body)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 140);

  const metaText = [
    fmtDate(n.updated),
    n.nb ? nbName(n.nb) : '',
    (n.tags || []).slice(0, 2).map(t => '#' + t).join(' ')
  ]
    .filter(Boolean)
    .join(' · ');

  const inds =
    (n.pinned ? ' ' + ic('pin', 'mini') : '')
    + (n.fav ? ' ' + ic('star', 'mini fav') : '');

  return (
    '<div class="card-wrap">'
    + '<button class="note-card'
    + (selMode && selSet.has(n.id) ? ' selected' : '')
    + '" data-open="' + esc(n.id) + '">'
    + '<div class="card-title">' + esc(n.title || 'Untitled') + '</div>'
    + '<div class="card-preview">'
    + (esc(snip) || '<span style="opacity:0.4;">No additional text</span>')
    + '</div>'
    + '<div class="card-meta">'
    + '<span>' + esc(metaText) + '</span>'
    + inds
    + '</div>'
    + '</button>'
    + '</div>'
  );
}

/* ---------- Category Pills Row Rendering ---------- */
function renderCategoryRow() {
  const activeNb = screen.type === 'notebook' ? screen.id : null;
  const isAll = screen.type === 'notes' && screen.filter === 'all';

  let html = '<button class="cat-pill' + (isAll ? ' on' : '') + '" data-cat="all">All</button>';

  // Show top root folders as pills
  const rootFolders = db.notebooks.filter(n => !n.parent && !n.trashed);
  rootFolders.forEach(folder => {
    const on = activeNb === folder.id ? ' on' : '';
    html += '<button class="cat-pill' + on + '" data-folder-pill="' + esc(folder.id) + '">'
      + esc(folder.name)
      + '</button>';
  });

  // Dedicated Folder / Library Browser Pill at the end
  html += '<button id="folderNavBtn" class="cat-pill folder-btn" data-action="open-folder-browser" aria-label="Open Folders">'
    + ic('folder')
    + '</button>';

  filterRow.innerHTML = html;
}

/* ---------- Render Cards Content ---------- */
function renderContent() {
  const q = searchInput.value.trim().toLowerCase();
  let html = '';
  visibleIds = [];

  let notes = db.notes.filter(n => !n.trashed);

  // If in tasks mode, filter to notes containing checklists
  if (currentTab === 'tasks') {
    notes = notes.filter(n => (n.body || '').includes('class="cb"') || (n.body || '').includes('class="cl"'));
  } else if (screen.type === 'notebook') {
    const ids = descSet(screen.id);
    notes = notes.filter(n => ids.has(n.nb));
  } else if (screen.type === 'tag') {
    notes = notes.filter(n => (n.tags || []).includes(screen.tag));
  } else if (screen.type === 'notes') {
    if (screen.filter === 'recent') {
      notes = notes.filter(n => Date.now() - n.updated < 7 * 864e5);
    } else if (screen.filter === 'favorites') {
      notes = notes.filter(n => n.fav);
    }
  } else if (screen.type === 'trash') {
    notes = db.notes.filter(n => n.trashed && !n.trashedBy).sort((a, b) => b.trashed - a.trashed);
  }

  if (q) {
    notes = notes.filter(n =>
      ((n.title || '') + ' ' + plain(n.body) + ' ' + (n.tags || []).join(' '))
        .toLowerCase()
        .includes(q)
    );
  }

  notes = sortNotesList(notes);
  visibleIds = notes.map(n => n.id);

  if (notes.length) {
    html = notes.map(noteCard).join('');
  } else {
    html = q
      ? empty('search', 'No matching notes', 'Try a different search term.')
      : (currentTab === 'tasks'
          ? empty('tasksTab', 'No tasks yet', 'Create a note with a checklist.')
          : empty('notesTab', 'No notes yet', 'Tap + to create your first note.'));
  }

  content.innerHTML = html;
}

/* ---------- Screen Render Flow ---------- */
function renderScreen() {
  // Update Top Navigation Icons Active State
  navTabNotes.classList.toggle('active', currentTab === 'notes');
  navTabTasks.classList.toggle('active', currentTab === 'tasks');

  // Handle Selection Mode Visibility
  selBar.hidden = !selMode;
  homeTopbar.hidden = selMode;
  filterRow.hidden = selMode || currentTab === 'tasks';
  fab.hidden = selMode || screen.type === 'trash';

  selCount.textContent = countLabel(selSet.size, 'selected');

  renderCategoryRow();
  renderContent();
}

function countLabel(n, singular, plural = singular + 's') {
  return n + ' ' + (n === 1 ? singular : plural);
}

function nav(next) {
  closeAllOverlays();
  currentTab = 'notes';
  screen = next;
  searchInput.value = '';
  searchClear.hidden = true;
  renderScreen();
  content.scrollTop = 0;
}

/* ---------- Selection Management ---------- */
function enterSelection(id) {
  selMode = true;
  selSet = new Set([id]);
  renderScreen();
}

function exitSelection() {
  selMode = false;
  selSet.clear();
  renderScreen();
}

function toggleSelection(id) {
  if (selSet.has(id)) selSet.delete(id);
  else selSet.add(id);

  if (!selSet.size) exitSelection();
  else {
    renderContent();
    selCount.textContent = countLabel(selSet.size, 'selected');
  }
}

/* ---------- Full Folder & Library Sheet (From 📁 button) ---------- */
function openFolderBrowserSheet() {
  const rootFolders = db.notebooks.filter(n => !n.parent && !n.trashed);

  let html = '<div class="sheet-section-title">Folders</div>';
  html += '<button class="sheet-item" data-action="new-root-folder">'
    + ic('plus')
    + '<span class="nt-name" style="color:var(--accent);">Create New Folder</span>'
    + '</button>';

  rootFolders.forEach(nb => {
    const count = notesIn(nb.id).length;
    const isCurrent = screen.type === 'notebook' && screen.id === nb.id;
    html += '<button class="sheet-item' + (isCurrent ? ' on' : '') + '" data-sheet-nb="' + esc(nb.id) + '">'
      + ic('folder')
      + '<span class="nt-name">' + esc(nb.name) + '</span>'
      + '<span style="font-size:12px;color:var(--text-3);">' + count + '</span>'
      + '</button>';
  });

  html += '<div class="sheet-divider"></div>';
  html += '<div class="sheet-section-title">Library</div>';

  html += '<button class="sheet-item" data-sheet-lib="recent">'
    + ic('clock')
    + '<span class="nt-name">Recent</span>'
    + '</button>';

  html += '<button class="sheet-item" data-sheet-lib="favorites">'
    + ic('star')
    + '<span class="nt-name">Favorites</span>'
    + '</button>';

  html += '<button class="sheet-item" data-sheet-lib="tags">'
    + ic('tag')
    + '<span class="nt-name">Tags</span>'
    + '</button>';

  const trashCount = db.notes.filter(n => n.trashed && !n.trashedBy).length;
  html += '<button class="sheet-item" data-sheet-lib="trash">'
    + ic('trash')
    + '<span class="nt-name">Trash</span>'
    + '<span style="font-size:12px;color:var(--text-3);">' + trashCount + '</span>'
    + '</button>';

  openSheet('Folders & Library', html);
}

/* ---------- Overlays (Sheets & Menus) ---------- */
function closeMenu() {
  menuEl.hidden = true;
  if (!sheet.hidden) return;
  scrim.classList.remove('show');
  document.body.classList.remove('overlay-open');
}

function openMenu(items, customHtml = '', pos = null) {
  menuItems = items || [];
  menuEl.innerHTML =
    customHtml
    + menuItems.map((it, i) =>
      '<button class="menu-item'
      + (it.danger ? ' danger' : '')
      + '" data-mi="' + i + '">'
      + ic(it.icon || 'info')
      + '<span>' + esc(it.label) + '</span>'
      + '</button>'
    ).join('');

  menuEl.hidden = false;
  scrim.classList.add('show');
  document.body.classList.add('overlay-open');

  if (pos) {
    menuEl.style.right = 'auto';
    requestAnimationFrame(() => {
      const rect = menuEl.getBoundingClientRect();
      let top = pos.y;
      let left = pos.x;
      if (top + rect.height > window.innerHeight) top = window.innerHeight - rect.height - 16;
      if (left + rect.width > window.innerWidth) left = window.innerWidth - rect.width - 16;
      menuEl.style.top = top + 'px';
      menuEl.style.left = left + 'px';
    });
  } else {
    menuEl.style.top = '';
    menuEl.style.left = '';
    menuEl.style.right = '20px';
  }
}

function openSheet(title, html) {
  clearTimeout(sheetCloseTimer);
  sheetCloseTimer = null;
  closeMenu();

  sheetTitle.textContent = title;
  sheetContent.innerHTML = html;
  sheet.hidden = false;

  requestAnimationFrame(() => {
    sheet.classList.add('open');
  });

  scrim.classList.add('show');
  document.body.classList.add('overlay-open');
}

function closeSheet() {
  clearTimeout(sheetCloseTimer);
  sheet.classList.remove('open');
  if (menuEl.hidden) scrim.classList.remove('show');
  document.body.classList.remove('overlay-open');

  sheetCloseTimer = setTimeout(() => {
    sheet.hidden = true;
    sheetCloseTimer = null;
  }, 240);
}

function closeAllOverlays() {
  closeMenu();
  closeSheet();
}

function toast(message) {
  toastEl.textContent = message;
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.hidden = true;
  }, 2200);
}
