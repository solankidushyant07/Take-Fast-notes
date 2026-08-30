/* Take Fast Notes - ui.js | DOM, State, Overlays, and Rendering */
'use strict';

const homeView = $('#homeView');
const homeTopbar = $('#homeTopbar');
const selBar = $('#selBar');
const selCount = $('#selCount');
const editView = $('#editView');

const sideBtn = $('#sideBtn');
const screenTitle = $('#screenTitle');
const appMenuBtn = $('#appMenuBtn');
const viewBtn = $('#viewBtn');
const sortBtn = $('#sortBtn');

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
const drawer = $('#drawer');
const drawerBody = $('#drawerBody');

const menuEl = $('#menu');
const sheet = $('#sheet');
const sheetTitle = $('#sheetTitle');
const sheetContent = $('#sheetContent');

const mdImport = $('#mdImport');
const toastEl = $('#toast');

let screen = { type:'notes', filter:'all' };
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
  {id:'white', name:'Default'},
  {id:'orange', name:'Peach'},
  {id:'pink', name:'Rose'},
  {id:'blue', name:'Blue'},
  {id:'yellow', name:'Cream'},
  {id:'green', name:'Sage'}
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

/* ---------- Formatting / rendering helpers ---------- */

function fmtDateRender(ts) {
  return fmtDate(ts);
}

function countLabel(n, singular, plural = singular + 's') {
  return n + ' ' + (n === 1 ? singular : plural);
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

function noteRow(n) {
  const snip = plain(n.body)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 150);

  const meta = [
    fmtDateRender(n.updated),
    n.nb ? nbName(n.nb) : '',
    (n.tags || []).slice(0, 3).map(t => '#' + t).join(' ')
  ]
    .filter(Boolean)
    .join(' · ');

  const inds =
    (n.pinned ? ic('pin', 'mini') : '')
    + (n.fav ? ic('star', 'mini fav') : '');

  return (
    '<div class="swipe-wrap">'
    + '<button class="row-action" data-swipe-trash="' + esc(n.id) + '" aria-label="Move to trash">'
    + ic('trash')
    + '</button>'

    + '<button class="row note-row'
    + (selMode && selSet.has(n.id) ? ' selected' : '')
    + '" data-open="' + esc(n.id) + '">'

    + '<span class="row-top">'
    + '<span class="row-title">' + esc(n.title || 'Untitled') + '</span>'
    + inds
    + '</span>'

    + '<span class="row-snip">'
    + (
      esc(snip)
      || '<span class="muted">No additional text</span>'
    )
    + '</span>'

    + '<span class="row-meta">'
    + esc(meta)
    + '</span>'

    + '</button>'
    + '</div>'
  );
}

function folderRow(nb) {
  const children = childrenOf(nb.id).length;

  return (
    '<button class="row folder" data-nb="' + esc(nb.id) + '">'
    + ic('folder', 'ric')
    + '<span class="f-name">' + esc(nb.name) + '</span>'
    + '<span class="f-count">'
    + countLabel(notesIn(nb.id).length, 'note')
    + (children ? ' · ' + countLabel(children, 'folder') : '')
    + '</span>'
    + (children ? ic('chev', 'chev') : '')
    + '</button>'
  );
}

function addFolderRow(pid) {
  return (
    '<button class="row folder add-row" data-addfolder="' + esc(pid || '') + '">'
    + ic('plus', 'ric')
    + '<span class="f-name">New ' + (pid ? 'subfolder' : 'folder') + '</span>'
    + '</button>'
  );
}

function trashNoteRow(n) {
  const left = Math.max(
    0,
    TRASH_DAYS - Math.floor((Date.now() - n.trashed) / 864e5)
  );

  return (
    '<button class="row" data-trow="' + esc(n.id) + '">'
    + '<span class="row-top">'
    + '<span class="row-title">' + esc(n.title || 'Untitled') + '</span>'
    + ic('trash', 'mini')
    + '</span>'

    + '<span class="row-snip">'
    + (
      esc(
        plain(n.body)
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 150)
      )
      || 'No additional text'
    )
    + '</span>'

    + '<span class="row-meta">'
    + 'Deleted ' + esc(fmtDateRender(n.trashed))
    + ' · ' + left + 'd left'
    + '</span>'

    + '</button>'
  );
}

function trashFolderRow(nb) {
  const left = Math.max(
    0,
    TRASH_DAYS - Math.floor((Date.now() - nb.trashed) / 864e5)
  );

  return (
    '<button class="row folder" data-tnb="' + esc(nb.id) + '">'
    + ic('folder', 'ric')
    + '<span class="f-name">' + esc(nb.name) + '</span>'
    + '<span class="f-count">Deleted · ' + left + 'd left</span>'
    + '</button>'
  );
}

function renderContent() {
  const q = searchInput.value.trim().toLowerCase();
  let html = '';

  visibleIds = [];

  if (screen.type === 'notebooks') {
    let folders = db.notebooks
      .filter(n => !n.parent && !n.trashed);

    if (q) {
      folders = folders.filter(n =>
        n.name.toLowerCase().includes(q)
      );
    }

    html =
      addFolderRow(null)
      + (
        folders.length
          ? folders.map(folderRow).join('')
          : empty(
              'folder',
              'No folders',
              'Create a folder to organize your notes.'
            )
      );
  }

  else if (screen.type === 'tags') {
    let tags = allTags();

    if (q) {
      tags = tags.filter(([tag]) =>
        tag.toLowerCase().includes(q)
      );
    }

    html = tags.length
      ? tags.map(([tag, count]) =>
          '<button class="row folder" data-tag="' + esc(tag) + '">'
          + ic('tag', 'ric')
          + '<span class="f-name">#' + esc(tag) + '</span>'
          + '<span class="f-count">' + countLabel(count, 'note') + '</span>'
          + ic('chev', 'chev')
          + '</button>'
        ).join('')
      : empty(
          'tag',
          'No tags yet',
          'Add tags from a note\'s options.'
        );
  }

  else if (screen.type === 'trash') {
    let notes = db.notes
      .filter(n => n.trashed && !n.trashedBy)
      .sort((a, b) => b.trashed - a.trashed);

    let folders = db.notebooks
      .filter(n => n.trashed && !n.trashedBy)
      .sort((a, b) => b.trashed - a.trashed);

    if (q) {
      notes = notes.filter(n =>
        ((n.title || '') + ' ' + plain(n.body))
          .toLowerCase()
          .includes(q)
      );

      folders = folders.filter(n =>
        n.name.toLowerCase().includes(q)
      );
    }

    if (folders.length) {
      html +=
        '<div class="sec-label">Folders</div>'
        + folders.map(trashFolderRow).join('');
    }

    if (notes.length) {
      html +=
        '<div class="sec-label">Notes</div>'
        + notes.map(trashNoteRow).join('');
    }

    if (!html) {
      html = empty(
        'trash',
        'Trash is empty',
        'Deleted items are kept for 30 days.'
      );
    }
  }

  else {
    if (screen.type === 'notebook') {
      const kids = childrenOf(screen.id);

      if (kids.length) {
        html +=
          '<div class="section-block">'
          + kids.map(folderRow).join('')
          + '</div>';
      }

      html += addFolderRow(screen.id);

      if (kids.length) {
        html += '<div class="sec-label">Notes in this folder</div>';
      }
    }

    let notes = db.notes.filter(n => !n.trashed);

    if (screen.type === 'notes') {
      if (screen.filter === 'recent') {
        notes = notes.filter(
          n => Date.now() - n.updated < 7 * 864e5
        );
      }

      if (screen.filter === 'favorites') {
        notes = notes.filter(n => n.fav);
      }
    }

    else if (screen.type === 'notebook') {
      const ids = descSet(screen.id);
      notes = notes.filter(n => ids.has(n.nb));
    }

    else if (screen.type === 'tag') {
      notes = notes.filter(
        n => (n.tags || []).includes(screen.tag)
      );
    }

    if (q) {
      notes = notes.filter(n =>
        (
          (n.title || '')
          + ' '
          + plain(n.body)
          + ' '
          + (n.tags || []).join(' ')
        )
          .toLowerCase()
          .includes(q)
      );
    }

    notes = sortNotesList(notes);
    visibleIds = notes.map(n => n.id);

    const noteLabel =
      screen.type === 'notes'
        ? (
            screen.filter === 'recent'
              ? 'Recent notes'
              : screen.filter === 'favorites'
                ? 'Favorites'
                : 'Notes'
          )
        : 'Notes';

    html +=
      '<div class="notes-heading">'
      + esc(noteLabel)
      + '</div>';

    html += notes.length
      ? notes.map(noteRow).join('')
      : (
          q
            ? empty(
                'search',
                'No results',
                'Try a different search term.'
              )
            : empty(
                'doc',
                screen.type === 'notes'
                  && screen.filter === 'favorites'
                  ? 'No favorites yet'
                  : 'No notes yet',
                'Tap + to create your first note.'
              )
        );
  }

  content.innerHTML = html;

  const gridAllowed = [
    'notes',
    'notebook',
    'tag'
  ].includes(screen.type);

  content.className =
    'content '
    + (
      db.prefs.viewMode === 'grid' && gridAllowed
        ? 'grid-view'
        : ''
    );
}

function currentScreenTitle() {
  if (screen.type === 'notebooks') return 'Folders';
  if (screen.type === 'tags') return 'Tags';
  if (screen.type === 'trash') return 'Trash';
  if (screen.type === 'notebook') return nbName(screen.id) || 'Folder';
  if (screen.type === 'tag') return '#' + screen.tag;
  if (screen.filter === 'recent') return 'Recent';
  if (screen.filter === 'favorites') return 'Favorites';

  return 'All Notes';
}

function renderScreen() {
  screenTitle.textContent = currentScreenTitle();

  const chip =
    screen.type === 'notes'
      ? screen.filter
      : null;

  filterRow.hidden =
    selMode || chip === null;

  $$('.chip').forEach(c => {
    c.classList.toggle(
      'on',
      c.dataset.chip === chip
    );
  });

  fab.hidden =
    selMode || screen.type === 'trash';

  selBar.hidden = !selMode;
  homeTopbar.hidden = selMode;

  selCount.textContent =
    countLabel(selSet.size, 'selected');

  viewBtn.hidden = ![
    'notes',
    'notebook',
    'tag'
  ].includes(screen.type);

  sortBtn.hidden = ![
    'notes',
    'notebook',
    'tag'
  ].includes(screen.type);

  renderContent();
  renderDrawer();
}

function nav(next) {
  closeAllOverlays();

  screen = next;

  searchInput.value = '';
  searchClear.hidden = true;

  renderScreen();

  content.scrollTop = 0;
}

/* ---------- Selection ---------- */

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
  if (selSet.has(id)) {
    selSet.delete(id);
  } else {
    selSet.add(id);
  }

  if (!selSet.size) {
    exitSelection();
  } else {
    renderContent();
    selCount.textContent =
      countLabel(selSet.size, 'selected');
  }
}

/* ---------- Drawer ---------- */

function tree(depth, parent, ancestors = new Set()) {
  return childrenOf(parent)
    .filter(nb => !ancestors.has(nb.id))
    .map(nb => {
      const kids = childrenOf(nb.id);

      const active =
        screen.type === 'notebook'
        && screen.id === nb.id;

      const chev = kids.length
        ? (
            '<span class="tree-chev'
            + (nb.open ? ' open' : '')
            + '" data-chev="' + esc(nb.id) + '">'
            + ic('chev')
            + '</span>'
          )
        : '<span class="tree-chev none"></span>';

      let row =
        '<button class="d-item tree'
        + (active ? ' active' : '')
        + '" data-nb="' + esc(nb.id) + '"'
        + ' style="--depth:' + depth + '">'
        + chev
        + ic('folder')
        + '<span class="d-label">'
        + esc(nb.name)
        + '</span>'
        + '</button>';

      if (kids.length && nb.open) {
        row += tree(
          depth + 1,
          nb.id,
          new Set([...ancestors, nb.id])
        );
      }

      return row;
    })
    .join('');
}

function renderDrawer() {
  const on =
    s => screen.type === s ? ' active' : '';

  const onF =
    f =>
      screen.type === 'notes'
      && screen.filter === f
        ? ' active'
        : '';

  drawerBody.innerHTML =
    '<div class="drawer-section">'

    + '<button class="d-item'
    + onF('all')
    + '" data-go="all">'
    + ic('doc')
    + '<span>All Notes</span>'
    + '</button>'

    + '<button class="d-item'
    + onF('recent')
    + '" data-go="recent">'
    + ic('clock')
    + '<span>Recent</span>'
    + '</button>'

    + '<button class="d-item'
    + onF('favorites')
    + '" data-go="favorites">'
    + ic('star')
    + '<span>Favorites</span>'
    + '</button>'

    + '</div>'

    + '<div class="d-label">Organize</div>'

    + '<button class="d-item'
    + on('notebooks')
    + '" data-go="notebooks">'
    + ic('folder')
    + '<span>Folders</span>'
    + '</button>'

    + '<button class="d-item'
    + on('tags')
    + '" data-go="tags">'
    + ic('tag')
    + '<span>Tags</span>'
    + '</button>'

    + '<button class="d-item'
    + on('trash')
    + '" data-go="trash">'
    + ic('trash')
    + '<span>Trash</span>'
    + '<span class="d-count">'
    + (
      db.notes.filter(
        n => n.trashed && !n.trashedBy
      ).length
      +
      db.notebooks.filter(
        n => n.trashed && !n.trashedBy
      ).length
    )
    + '</span>'
    + '</button>'

    + '<div class="d-label addrow">'
    + '<span>Folders</span>'
    + '<button class="mini-btn" id="nbAdd" aria-label="New folder">'
    + ic('plus')
    + '</button>'
    + '</div>'

    + (
      tree(0, null)
      || '<div class="drawer-empty">No folders</div>'
    );
}

function openDrawer() {
  renderDrawer();

  drawer.classList.add('open');
  drawer.setAttribute('aria-hidden', 'false');

  scrim.classList.add('show');
  document.body.classList.add('overlay-open');
}

function closeDrawer() {
  drawer.classList.remove('open');
  drawer.setAttribute('aria-hidden', 'true');

  document.body.classList.remove('overlay-open');

  if (menuEl.hidden && sheet.hidden) {
    scrim.classList.remove('show');
  }
}

/* ---------- Overlays ---------- */

function closeMenu() {
  menuEl.hidden = true;

  if (
    drawer.classList.contains('open')
    || !sheet.hidden
  ) {
    return;
  }

  scrim.classList.remove('show');
  document.body.classList.remove('overlay-open');
}

function openMenu(items, customHtml = '', pos = null) {
  menuItems = items || [];

  menuEl.innerHTML =
    customHtml
    +
    menuItems.map((it, i) =>
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

      if (top + rect.height > window.innerHeight) {
        top = window.innerHeight - rect.height - 16;
      }

      if (left + rect.width > window.innerWidth) {
        left = window.innerWidth - rect.width - 16;
      }

      menuEl.style.top = top + 'px';
      menuEl.style.left = left + 'px';
    });
  } else {
    menuEl.style.top = '';
    menuEl.style.left = '';
    menuEl.style.right = '';
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

  if (
    !drawer.classList.contains('open')
    && menuEl.hidden
  ) {
    scrim.classList.remove('show');
  }

  document.body.classList.remove('overlay-open');

  sheetCloseTimer = setTimeout(() => {
    sheet.hidden = true;
    sheetCloseTimer = null;
  }, 240);
}

function closeAllOverlays() {
  closeMenu();
  closeSheet();
  closeDrawer();
}

function toast(message) {
  toastEl.textContent = message;
  toastEl.hidden = false;

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    toastEl.hidden = true;
  }, 2200);
}
