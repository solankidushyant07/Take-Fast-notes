/* Take Fast Notes - ui.js | DOM references and rendering */
'use strict';

const folderView = $('#folderView');
const settingsView = $('#settingsView');
const folderList = $('#folderList');
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
let currentTab = 'notes';
let editing = null;
let editingReadonly = false;
let saveTimer = null;
let toastTimer = null;
let menuItems = [];
let selMode = false;
let selSet = new Set();
let visibleIds = [];
let suppressClickUntil = 0;
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

function normalizeTags(value) {
  const raw = Array.isArray(value) ? value : String(value ?? '').split(',');
  return [...new Set(raw.map(t => String(t).trim().replace(/^#+/, '')).filter(Boolean))].slice(0, 50);
}

function empty(icon, title, subtitle) {
  return `<div class="empty">${ic(icon)}<p class="e-t">${esc(title)}</p><p class="e-s">${esc(subtitle)}</p></div>`;
}

function noteCard(n) {
  const snip = plain(n.body).replace(/\s+/g, ' ').trim().slice(0, 140);
  const meta = [fmtDate(n.updated), n.nb ? nbName(n.nb) : '', (n.tags || []).slice(0, 2).map(t => '#' + t).join(' ')].filter(Boolean).join(' · ');
  const inds = (n.pinned ? ic('pin', 'mini') : '') + (n.fav ? ic('star', 'mini fav') : '');
  return `<div class="swipe-wrap"><div class="swipe-action-bg">${ic('trash')}</div><button class="note-card swipeable ${selMode && selSet.has(n.id) ? 'selected' : ''}" data-open="${esc(n.id)}"><div class="card-title">${esc(n.title || 'Untitled')}</div><div class="card-preview">${esc(snip) || '<span style="opacity:.4">No additional text</span>'}</div><div class="card-meta"><span>${esc(meta)}</span>${inds}</div></button></div>`;
}

function renderCategoryRow() {
  const activeNb = screen.type === 'notebook' ? screen.id : null;
  let html = `<button class="cat-pill ${screen.type === 'notes' && screen.filter === 'all' ? 'on' : ''}" data-cat="all">All</button>`;
  db.notebooks.filter(n => !n.parent && !n.trashed).forEach(folder => {
    html += `<button class="cat-pill ${activeNb === folder.id ? 'on' : ''}" data-folder-pill="${esc(folder.id)}">${esc(folder.name)}</button>`;
  });
  html += `<button id="folderNavBtn" class="cat-pill folder-btn" data-action="open-folder-browser" aria-label="Open folders">${ic('folder')}</button>`;
  filterRow.innerHTML = html;
}

function renderContent() {
  const q = searchInput.value.trim().toLowerCase();
  let notes = db.notes.filter(n => !n.trashed);

  if (currentTab === 'tasks') {
    notes = notes.filter(noteHasTasks);
  } else if (screen.type === 'notebook') {
    const ids = descSet(screen.id);
    notes = notes.filter(n => ids.has(n.nb));
  } else if (screen.type === 'tag') {
    notes = notes.filter(n => (n.tags || []).includes(screen.tag));
  } else if (screen.type === 'notes') {
    if (screen.filter === 'recent') notes = notes.filter(n => Date.now() - n.updated < 7 * 864e5);
    if (screen.filter === 'favorites') notes = notes.filter(n => n.fav);
  }

  if (q) notes = notes.filter(n => ((n.title || '') + ' ' + plain(n.body) + ' ' + (n.tags || []).join(' ')).toLowerCase().includes(q));
  notes = sortNotesList(notes);
  visibleIds = notes.map(n => n.id);

  if (notes.length) {
    content.classList.toggle('grid-view', db.prefs.viewMode === 'grid');
    content.innerHTML = notes.map(noteCard).join('');
    return;
  }
  content.classList.remove('grid-view');
  content.innerHTML = empty(q ? 'search' : currentTab === 'tasks' ? 'tasksTab' : 'notesTab', q ? 'No matching notes' : currentTab === 'tasks' ? 'No tasks yet' : 'No notes yet', q ? 'Try a different search term.' : currentTab === 'tasks' ? 'Create a note with a checklist.' : 'Tap + to create your first note.');
}

function renderTrash() {
  const notes = db.notes.filter(n => n.trashed && !n.trashedBy).sort((a, b) => b.trashed - a.trashed);
  const folders = db.notebooks.filter(n => n.trashed && !n.trashedBy).sort((a, b) => b.trashed - a.trashed);
  let html = '';
  if (folders.length) {
    html += '<div class="sheet-section-title" style="padding-left:0">Deleted Folders</div>';
    folders.forEach(nb => { html += `<button class="folder-list-item" data-trash-folder="${esc(nb.id)}"><span class="ric">${ic('folder')}</span><span class="f-name">${esc(nb.name)}</span></button>`; });
  }
  if (notes.length) {
    if (folders.length) html += '<div class="sheet-divider"></div>';
    html += '<div class="sheet-section-title" style="padding-left:0">Deleted Notes</div>' + notes.map(noteCard).join('');
  }
  content.classList.remove('grid-view');
  content.innerHTML = html || empty('trash', 'Trash is empty', 'Deleted items stay here for 30 days.');
}

function renderScreen() {
  navTabNotes.classList.toggle('active', currentTab === 'notes');
  navTabTasks.classList.toggle('active', currentTab === 'tasks');
  navTabSettings.classList.toggle('active', settingsView.hidden === false);
  selBar.hidden = !selMode;
  homeTopbar.hidden = selMode;
  filterRow.hidden = selMode || currentTab === 'tasks' || screen.type === 'trash';
  fab.hidden = selMode || screen.type === 'trash';
  selCount.textContent = countLabel(selSet.size, 'selected');
  if (screen.type === 'trash') { renderTrash(); return; }
  renderCategoryRow();
  renderContent();
}

function countLabel(n, singular, plural = singular + 's') { return `${n} ${n === 1 ? singular : plural}`; }

function renderFolderPage() {
  const folders = db.notebooks.filter(n => !n.trashed);
  let html = `<button class="folder-list-item" data-nb-nav="all"><span class="ric">${ic('doc')}</span><span class="f-name">All Notes</span></button>`;
  function add(parent, depth) {
    folders.filter(n => (n.parent || null) === (parent || null)).forEach(nb => {
      const selected = selMode && selSet.has(nb.id);
      html += `<button class="folder-list-item ${selected ? 'selected' : ''}" data-nb-nav="${esc(nb.id)}" style="padding-left:${20 + depth * 20}px"><span class="ric">${ic('folder')}</span><span class="f-name">${esc(nb.name)}</span><span class="f-count">${folderNoteCount(nb.id)}</span><span class="folder-more" data-folder-action="${esc(nb.id)}" aria-label="Folder actions">${ic('kebab')}</span></button>`;
      add(nb.id, depth + 1);
    });
  }
  add(null, 0);
  folderList.innerHTML = html;
  $('#newFolderPageBtn').parentElement.hidden = selMode;
}

/* ---------- Overlays ---------- */
function closeMenu() {
  menuEl.hidden = true;
  if (!sheet.hidden) return;
  scrim.classList.remove('show');
  document.body.classList.remove('overlay-open');
}
function openMenu(items, customHtml = '', pos = null) {
  menuItems = items || [];
  menuEl.innerHTML = customHtml + menuItems.map((it, i) => `<button class="menu-item ${it.danger ? 'danger' : ''}" data-mi="${i}">${ic(it.icon || 'info')}<span>${esc(it.label)}</span></button>`).join('');
  menuEl.hidden = false; scrim.classList.add('show'); document.body.classList.add('overlay-open');
  if (pos) {
    menuEl.style.right = 'auto';
    requestAnimationFrame(() => {
      const r = menuEl.getBoundingClientRect();
      menuEl.style.top = Math.min(pos.y, innerHeight - r.height - 16) + 'px';
      menuEl.style.left = Math.min(pos.x, innerWidth - r.width - 16) + 'px';
    });
  } else { menuEl.style.top = ''; menuEl.style.left = ''; menuEl.style.right = '20px'; }
}
function openSheet(title, html) {
  clearTimeout(sheetCloseTimer); sheetCloseTimer = null; closeMenu();
  sheetTitle.textContent = title; sheetContent.innerHTML = html; sheet.hidden = false;
  requestAnimationFrame(() => sheet.classList.add('open'));
  scrim.classList.add('show'); document.body.classList.add('overlay-open');
}
function closeSheet() {
  clearTimeout(sheetCloseTimer); sheet.classList.remove('open');
  if (menuEl.hidden) scrim.classList.remove('show');
  document.body.classList.remove('overlay-open');
  sheetCloseTimer = setTimeout(() => { sheet.hidden = true; sheetCloseTimer = null; }, 240);
}
function closeAllOverlays() { closeMenu(); closeSheet(); }
function toast(message) {
  toastEl.textContent = message; toastEl.hidden = false; clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastEl.hidden = true; }, 2200);
}
