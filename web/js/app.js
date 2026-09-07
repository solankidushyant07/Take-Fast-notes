/* Take Fast Notes - app.js
 * App logic. Notes live in the app's local storage. Android file-system access
 * is intentionally not used; import/export is the only file boundary.
 */
'use strict';

/* ---------- General helpers ---------- */
function noteHasTasks(n) {
  return /class=["'](?:cb|cl)["']/.test(n.body || '');
}

function safeFilename(name, fallback = 'Untitled') {
  return String(name || fallback).trim().replace(/[\\/:*?"<>|\x00-\x1F]/g, '-').replace(/\s+/g, ' ').slice(0, 120) || fallback;
}

function folderPath(id) {
  const parts = [];
  const seen = new Set();
  let cur = byNb(id);
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    parts.unshift(cur.name);
    cur = cur.parent ? byNb(cur.parent) : null;
  }
  return parts;
}

function directChildren(parent) {
  return db.notebooks.filter(n => !n.trashed && (n.parent || null) === (parent || null));
}

function folderNoteCount(id) {
  return notesIn(id).length;
}

function refreshSettingsLabels() {
  $('#themeLabel').textContent = db.prefs.theme === 'light' ? 'Light' : 'Dark';
  $('#viewLabel').textContent = db.prefs.viewMode === 'grid' ? 'Grid View' : 'List View';
  const sortNames = {
    default: 'Recently Modified',
    alphaAsc: 'Name (A–Z)',
    alphaDesc: 'Name (Z–A)',
    createdNew: 'Created (Newest)',
    createdOld: 'Created (Oldest)',
    updatedOld: 'Modified (Oldest)',
    viewedNew: 'Viewed (Newest)'
  };
  $('#sortLabel').textContent = sortNames[db.prefs.sortBy] || sortNames.default;
  const def = byNb(db.prefs.defFolder);
  $('#defFolderLabel').textContent = def ? folderPath(def.id).join(' / ') : 'Home (Root)';
  $('#startPlaceLabel').textContent = db.prefs.startPlace === 'newNote' ? 'New Note' : 'Home';
}  $('#setExportBtn small').textContent =
    'Export as Markdown, Text, ZIP or JSON';
  $('#setImportBtn small').textContent =
    'Import Markdown, Text, ZIP or JSON';

function setTheme() {
  const theme = db.prefs.theme === 'dark' ? 'light' : 'dark';
  db.prefs.theme = theme;
  save();
  applyTheme();
  refreshSettingsLabels();
}

function applyTheme() {
  const theme = db.prefs.theme === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.theme = theme;
  const meta = $('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'light' ? '#F7F5F1' : '#121212');
}

/* ---------- Top navigation ---------- */
navTabNotes.addEventListener('click', () => {
  currentTab = 'notes';
  nav({ type: 'notes', filter: 'all' });
});

navTabLibrary.addEventListener('click', () => {
  currentTab = 'library';
  nav({ type: 'library' });
});

navTabTasks.addEventListener('click', () => {
  currentTab = 'tasks';
  nav({ type: 'notes', filter: 'all' });
});

navTabSettings.addEventListener('click', () => {
  history.pushState({ view: 'settings' }, '');
  switchView({ view: 'settings' });
});

fab.addEventListener('click', () => createNote());

/* ---------- Selection ---------- */
$('#selClose').addEventListener('click', exitSelection);
$('#selAll').addEventListener('click', () => {
  if (visibleIds.length && visibleIds.every(id => selSet.has(id))) selSet.clear();
  else visibleIds.forEach(id => selSet.add(id));
  if (!selSet.size) exitSelection();
  else { renderScreen(); }
});

$('#selPin').addEventListener('click', () => {
  selSet.forEach(id => { const n = byId(id); if (n) n.pinned = true; });
  save(); toast('Pinned'); exitSelection();
});

$('#selFav').addEventListener('click', () => {
  selSet.forEach(id => { const n = byId(id); if (n) n.fav = true; });
  save(); toast('Added to favorites'); exitSelection();
});

$('#selTrash').addEventListener('click', () => {
  const count = selSet.size;
  selSet.forEach(id => moveNoteToTrash(id, false));
  save(); exitSelection(); toast(countLabel(count, 'note') + ' moved to Trash');
});

$('#selMove').addEventListener('click', () => openMoveSheet());
$('#selExport').addEventListener('click', () => openExportSheet(Array.from(selSet).map(byId).filter(Boolean), true));

function openMoveSheet() {
  let html = '<button class="sheet-item" data-move-to="root">' + ic('doc') + '<span class="nt-name">Home (Root)</span></button>';
  db.notebooks.filter(n => !n.trashed).forEach(f => {
    const depth = folderPath(f.id).length - 1;
    html += `<button class="sheet-item" data-move-to="${esc(f.id)}"><span style="width:${depth * 16}px"></span>${ic('folder')}<span class="nt-name">${esc(f.name)}</span></button>`;
  });
  openSheet('Move to Folder', html);
}

/* ---------- Search ---------- */
searchInput.addEventListener('input', () => {
  searchClear.hidden = !searchInput.value;
  renderContent();
});
searchClear.addEventListener('click', () => {
  searchInput.value = '';
  searchClear.hidden = true;
  renderContent();
  searchInput.focus();
});

/* ---------- Content click ---------- */
content.addEventListener('click', e => {
  if (Date.now() < suppressClickUntil) return;

  const folder = e.target.closest('[data-folder-action]');
  if (folder) {
    const id = folder.dataset.folderAction;
    if (id) openFolderActions(id);
    return;
  }

  const trashFolder = e.target.closest('[data-trash-folder]');
  if (trashFolder) {
    trashActionTarget = { type: 'folder', id: trashFolder.dataset.trashFolder };
    openTrashFolderActions();
    return;
  }

  const libraryCard = e.target.closest('[data-library-card]');

  if (libraryCard) {
    const type = libraryCard.dataset.libraryCard;

    if (type === 'favorites') {
      currentTab = 'notes';
      nav({ type: 'notes', filter: 'favorites' });
    } else if (type === 'tags') {
      currentTab = 'library';
      nav({ type: 'library', subview: 'tags' });
    }

    return;
  }

  const libraryTag = e.target.closest('[data-library-tag]');

  if (libraryTag) {
    currentTab = 'notes';
    nav({
      type: 'tag',
      tag: libraryTag.dataset.libraryTag
    });
    return;
  }

  const card = e.target.closest('.note-card');
  if (!card) return;
  
  const id = card.dataset.open;
  if (!id) return;

  if (selMode) {
    toggleSelection(id);
    return;
  }

  if (screen.type === 'trash') {
    trashActionTarget = { type: 'note', id };
    openTrashActions();
    return;
  }
  openEditor(id, false, false);
});

/* ---------- Touch gestures ---------- */
let gesture = null;
content.addEventListener('touchstart', e => {
  if (selMode || e.touches.length !== 1) return;
  const card = e.target.closest('.note-card');
  if (!card) return;
  const id = card.dataset.open;
  if (!id) return;
  gesture = {
    card, id,
    startX: e.touches[0].clientX,
    startY: e.touches[0].clientY,
    mode: 'wait', fired: false
  };
  gesture.timer = setTimeout(() => {
    if (!gesture || gesture.mode === 'swipe') return;
    gesture.fired = true;
    gesture.mode = 'longpress';
    navigator.vibrate?.(25);
    enterSelection(id);
  }, 450);
}, { passive: true });

content.addEventListener('touchmove', e => {
  if (!gesture) return;
  const dx = e.touches[0].clientX - gesture.startX;
  const dy = e.touches[0].clientY - gesture.startY;
  if (gesture.mode === 'wait') {
    if (Math.abs(dy) > 15) {
      clearTimeout(gesture.timer); gesture = null; return;
    }
    if (dx < -15) {
      clearTimeout(gesture.timer);
      gesture.mode = 'swipe';
      gesture.card.classList.add('dragging');
    }
  }
  if (gesture.mode === 'swipe') {
    e.preventDefault();
    gesture.card.style.transform = `translateX(${Math.max(-88, Math.min(0, dx))}px)`;
  }
}, { passive: false });

function finishGesture() {
  if (!gesture) return;
  clearTimeout(gesture.timer);
  if (gesture.mode === 'swipe') {
    const m = gesture.card.style.transform.match(/translateX\(([-\d.]+)px\)/);
    const finalX = m ? parseFloat(m[1]) : 0;
    gesture.card.classList.remove('dragging');
    gesture.card.style.transform = '';
    if (finalX < -45) {
      navigator.vibrate?.(15);
      moveNoteToTrash(gesture.id, true);
    }
  }
  if (gesture.fired) suppressClickUntil = Date.now() + 350;
  gesture = null;
}
content.addEventListener('touchend', finishGesture, { passive: true });
content.addEventListener('touchcancel', finishGesture, { passive: true });

/* ---------- Folder browser ---------- */
$('#folderBackBtn').addEventListener('click', () => history.back());
$('#settingsBackBtn').addEventListener('click', () => history.back());
$('#newFolderPageBtn').addEventListener('click', () => createFolder(null));

folderList.addEventListener('click', e => {
  const more = e.target.closest('[data-folder-action]');
  if (more) { openFolderActions(more.dataset.folderAction); return; }
  const btn = e.target.closest('[data-nb-nav]');
  if (!btn) return;
  if (selMode) { toggleFolderSelection(btn.dataset.nbNav); return; }
  const target = btn.dataset.nbNav;
  if (target === 'all') nav({ type: 'notes', filter: 'all' });
  else nav({ type: 'notebook', id: target });
});

folderList.addEventListener('contextmenu', e => e.preventDefault());

let folderGesture = null;
folderList.addEventListener('touchstart', e => {
  if (e.touches.length !== 1) return;
  const item = e.target.closest('[data-nb-nav]');
  if (!item || item.dataset.nbNav === 'all') return;
  folderGesture = {
    id: item.dataset.nbNav,
    timer: setTimeout(() => {
      folderGesture = null;
      navigator.vibrate?.(25);
      openFolderActions(item.dataset.nbNav);
    }, 450)
  };
}, { passive: true });
folderList.addEventListener('touchmove', () => {
  if (folderGesture) { clearTimeout(folderGesture.timer); folderGesture = null; }
}, { passive: true });
folderList.addEventListener('touchend', () => {
  if (folderGesture) { clearTimeout(folderGesture.timer); folderGesture = null; }
}, { passive: true });

function openFolderActions(id) {
  const nb = byNb(id);
  if (!nb) return;
  openMenu([
    { icon: 'edit', label: 'Rename folder', fn: () => renameFolder(id) },
    { icon: 'plus', label: 'New subfolder', fn: () => createFolder(id) },
    { icon: 'trash', label: 'Move to Trash', danger: true, fn: () => moveFolderToTrash(id) }
  ]);
}

function renameFolder(id) {
  const nb = byNb(id);
  if (!nb) return;
  const name = prompt('Rename folder', nb.name);
  if (name === null) return;
  const clean = name.trim();
  if (!clean) return toast('Folder name cannot be empty');
  if (db.notebooks.some(n => !n.trashed && n.id !== id && (n.parent || null) === (nb.parent || null) && n.name.toLowerCase() === clean.toLowerCase())) {
    return toast('A folder with that name already exists');
  }
  nb.name = clean;
  save(); renderScreen(); toast('Folder renamed');
}

function createFolder(parent) {
  const name = prompt(parent ? 'New subfolder name' : 'New folder name', '');
  if (name === null) return;
  const clean = name.trim();
  if (!clean) return toast('Folder name cannot be empty');
  if (db.notebooks.some(n => !n.trashed && (n.parent || null) === (parent || null) && n.name.toLowerCase() === clean.toLowerCase())) {
    return toast('A folder with that name already exists');
  }
  db.notebooks.push({ id: uid(), name: clean, parent: parent || null, open: false, trashed: 0 });
  save();
  if (screen.type === 'notebook' && screen.id === parent) renderScreen(); else renderFolderPage();
  toast('Folder created');
}


function allDescendantFolderIds(id) {
  const result = new Set([id]);
  const walk = parent => db.notebooks.filter(n => n.parent === parent).forEach(child => {
    if (!result.has(child.id)) { result.add(child.id); walk(child.id); }
  });
  walk(id);
  return result;
}

function moveFolderToTrash(id) {
  const ids = descSet(id);
  const stamp = Date.now();
  db.notebooks.forEach(n => { if (ids.has(n.id)) { n.trashed = stamp; n.trashedBy = null; } });
  db.notes.forEach(n => { if (ids.has(n.nb)) { n.trashed = stamp; n.trashedBy = id; } });
  if (db.prefs.defFolder && ids.has(db.prefs.defFolder)) db.prefs.defFolder = null;
  save();
  if (screen.type === 'notebook' && ids.has(screen.id)) nav({ type: 'notes', filter: 'all' }); else renderScreen();
  toast('Folder moved to Trash');
}

/* ---------- Folder/library sheet ---------- */
filterRow.addEventListener('click', e => {
  
  const folderNav = e.target.closest('[data-action="open-folder-browser"]');
if (folderNav) {
  nav({ type: 'notebooks' });
  return;
}
  const allPill = e.target.closest('[data-cat="all"]');
  if (allPill) { nav({ type: 'notes', filter: 'all' }); return; }
  const folderPill = e.target.closest('[data-folder-pill]');
  if (folderPill) nav({ type: 'notebook', id: folderPill.dataset.folderPill });
});

function openFolderBrowserSheet() {
  let html = '<div class="sheet-section-title">Folders</div>';
  html += '<button class="sheet-item" data-action="new-root-folder">' + ic('plus') + '<span class="nt-name" style="color:var(--accent);">Create New Folder</span></button>';
  const folders = db.notebooks.filter(n => !n.trashed);
  folders.forEach(nb => {
    const depth = folderPath(nb.id).length - 1;
    html += `<button class="sheet-item" data-sheet-nb="${esc(nb.id)}"><span style="width:${depth * 16}px"></span>${ic('folder')}<span class="nt-name">${esc(nb.name)}</span><span class="sheet-count">${folderNoteCount(nb.id)}</span></button>`;
  });
  html += '<div class="sheet-divider"></div><div class="sheet-section-title">Library</div>';
  html += '<button class="sheet-item" data-sheet-lib="favorites">' + ic('star') + '<span class="nt-name">Favorites</span></button>';
  html += '<button class="sheet-item" data-sheet-lib="tags">' + ic('tag') + '<span class="nt-name">Tags</span></button>';
  const trashCount = db.notes.filter(n => n.trashed && !n.trashedBy).length + db.notebooks.filter(n => n.trashed && !n.trashedBy).length;
  html += `<button class="sheet-item" data-sheet-lib="trash">${ic('trash')}<span class="nt-name">Trash</span><span class="sheet-count">${trashCount}</span></button>`;
  openSheet('Folders & Library', html);
}

/* ---------- Sheet actions ---------- */
scrim.addEventListener('click', closeAllOverlays);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeAllOverlays(); });
menuEl.addEventListener('click', e => {
  const item = e.target.closest('[data-mi]');
  if (!item) return;
  menuItems[Number(item.dataset.mi)]?.fn?.();
  closeMenu();
});

sheetContent.addEventListener('click', e => {
  const move = e.target.closest('[data-move-to]');
  if (move) {
    const target = move.dataset.moveTo === 'root' ? null : move.dataset.moveTo;
    selSet.forEach(id => { const n = byId(id); if (n) n.nb = target; });
    save(); closeSheet(); exitSelection(); toast('Notes moved'); return;
  }
  const newRoot = e.target.closest('[data-action="new-root-folder"]');
  if (newRoot) { closeSheet(); createFolder(null); return; }
  const nbItem = e.target.closest('[data-sheet-nb]');
  if (nbItem) { closeSheet(); nav({ type: 'notebook', id: nbItem.dataset.sheetNb }); return; }
  const lib = e.target.closest('[data-sheet-lib]');
  if (lib) {
    closeSheet();
    const k = lib.dataset.sheetLib;
    if (k === 'favorites') {
    currentTab = 'notes';
  nav({ type: 'notes', filter: 'favorites' });
    }
    else if (k === 'tags') openTagSheet();
    else if (k === 'trash') nav({ type: 'trash' });
    return;
  }
  const themeChoice = e.target.closest('[data-theme-choice]');
  if (themeChoice) {
    db.prefs.theme = themeChoice.dataset.themeChoice;
    save(); applyTheme(); refreshSettingsLabels(); closeSheet(); return;
  }
  const viewChoice = e.target.closest('[data-view-choice]');
  if (viewChoice) {
    db.prefs.viewMode = viewChoice.dataset.viewChoice;
    save(); refreshSettingsLabels(); closeSheet(); renderScreen(); return;
  }
  const sortChoice = e.target.closest('[data-sort-choice]');
  if (sortChoice) {
    db.prefs.sortBy = sortChoice.dataset.sortChoice;
    save(); refreshSettingsLabels(); closeSheet(); renderContent(); return;
  }
  const color = e.target.closest('[data-note-color]');
  if (color && editing) {
    const n = byId(editing);
    if (n) { n.color = color.dataset.noteColor; save(); applyNoteTheme(n); closeSheet(); }
    return;
  }
  const zoom = e.target.closest('[data-note-zoom]');
  if (zoom && editing) {
    const n = byId(editing);
    if (n) { n.zoom = Number(zoom.dataset.noteZoom) || 100; document.documentElement.style.setProperty('--editor-zoom', n.zoom / 100); save(); closeSheet(); }
    return;
  }
  const tagItem = e.target.closest('[data-sheet-tag]');
  if (tagItem) { closeSheet(); nav({ type: 'tag', tag: tagItem.dataset.sheetTag }); return; }
  const def = e.target.closest('[data-def-folder]');
  if (def) {
    db.prefs.defFolder = def.dataset.defFolder === 'root' ? null : def.dataset.defFolder;
    save(); refreshSettingsLabels(); closeSheet(); return;
  }
  const exp = e.target.closest('[data-export-kind]');
  if (exp) {
    const kind = exp.dataset.exportKind;
    closeSheet();
    exportNotes(exp.dataset.scope === 'selected' ? Array.from(selSet).map(byId).filter(Boolean) : db.notes.filter(n => !n.trashed), kind);
    if (exp.dataset.scope === 'selected') exitSelection();
    return;
  }
  const trRestore = e.target.closest('[data-tr-restore]');
  if (trRestore && trashActionTarget) { restoreTrash(trashActionTarget); closeSheet(); return; }
  const trDelete = e.target.closest('[data-tr-delete]');
  if (trDelete && trashActionTarget) { deleteForever(trashActionTarget); closeSheet(); return; }
  const trFolderRestore = e.target.closest('[data-folder-restore]');
  if (trFolderRestore) { restoreTrash({ type: 'folder', id: trFolderRestore.dataset.folderRestore }); closeSheet(); return; }
  const trFolderDelete = e.target.closest('[data-folder-delete]');
  if (trFolderDelete) { deleteForever({ type: 'folder', id: trFolderDelete.dataset.folderDelete }); closeSheet(); return; }
});

function openTagSheet() {
  const tags = allTags();
  if (!tags.length) { openSheet('Tags', empty('tag', 'No tags yet', 'Add tags from a note’s menu.')); return; }
  openSheet('Tags', tags.map(([tag, count]) => `<button class="sheet-item" data-sheet-tag="${esc(tag)}">${ic('tag')}<span class="nt-name">#${esc(tag)}</span><span class="sheet-count">${count}</span></button>`).join(''));
}

/* ---------- Settings ---------- */
$('#setThemeBtn').addEventListener('click', () => openSheet('Theme',
  '<button class="sheet-item" data-theme-choice="dark">' + ic('gear') + '<span class="nt-name">Dark</span></button>' +
  '<button class="sheet-item" data-theme-choice="light">' + ic('sun') + '<span class="nt-name">Light</span></button>'
));

$('#setViewBtn').addEventListener('click', () => openSheet('Layout',
  '<button class="sheet-item" data-view-choice="list">' + ic('doc') + '<span class="nt-name">List View</span></button>' +
  '<button class="sheet-item" data-view-choice="grid">' + ic('folder') + '<span class="nt-name">Grid View</span></button>'
));

$('#setSortBtn').addEventListener('click', () => openSheet('Sort Notes',
  '<button class="sheet-item" data-sort-choice="default">Recently Modified</button>' +
  '<button class="sheet-item" data-sort-choice="alphaAsc">Name (A–Z)</button>' +
  '<button class="sheet-item" data-sort-choice="alphaDesc">Name (Z–A)</button>' +
  '<button class="sheet-item" data-sort-choice="createdNew">Created (Newest)</button>' +
  '<button class="sheet-item" data-sort-choice="createdOld">Created (Oldest)</button>' +
  '<button class="sheet-item" data-sort-choice="updatedOld">Modified (Oldest)</button>' +
  '<button class="sheet-item" data-sort-choice="viewedNew">Viewed (Newest)</button>'
));

$('#setStartBtn').addEventListener('click', () => {
  db.prefs.startPlace = db.prefs.startPlace === 'home' ? 'newNote' : 'home';
  save(); refreshSettingsLabels(); toast(db.prefs.startPlace === 'newNote' ? 'App will open a new note' : 'App will open Home');
});

$('#setDefFolderBtn').addEventListener('click', () => {
  let html = '<button class="sheet-item" data-def-folder="root">' + ic('doc') + '<span class="nt-name">Home (Root)</span></button>';
  db.notebooks.filter(n => !n.trashed).forEach(f => {
    const depth = folderPath(f.id).length - 1;
    html += `<button class="sheet-item" data-def-folder="${esc(f.id)}"><span style="width:${depth * 16}px"></span>${ic('folder')}<span class="nt-name">${esc(folderPath(f.id).join(' / '))}</span></button>`;
  });
  openSheet('Default New-Note Folder', html);
});

$('#setExportBtn').addEventListener('click', () => openExportSheet(db.notes.filter(n => !n.trashed), false));
$('#setImportBtn').addEventListener('click', () => mdImport.click());

function openExportSheet(notes, selected) {
  const scope = selected ? 'selected' : 'all';
  const count = notes.length;
  openSheet('Export Notes',
    `<div class="sheet-section-title">${countLabel(count, 'note')} selected for export</div>` +
    `<button class="sheet-item" data-export-kind="mdzip" data-scope="${scope}">${ic('export')}<span class="nt-name">Markdown ZIP (.zip)</span></button>` +
    `<button class="sheet-item" data-export-kind="txtzip" data-scope="${scope}">${ic('export')}<span class="nt-name">Text ZIP (.zip)</span></button>` +
    `<button class="sheet-item" data-export-kind="json" data-scope="${scope}">${ic('export')}<span class="nt-name">Backup (.json)</span></button>`
  );
}

/* ---------- Import ---------- */
mdImport.addEventListener('change', async () => {
  const files = Array.from(mdImport.files || []);
  mdImport.value = '';
  if (!files.length) return;
  let imported = 0;
  try {
    for (const file of files) {
      if (/\.zip$/i.test(file.name)) {
        imported += await importZip(file);
      } else if (/\.json$/i.test(file.name)) {
        imported += importJson(await file.text());
      } else {
        imported += importTextFile(file.name, await file.text());
      }
    }
    save(); renderScreen(); toast(imported ? `${imported} ${imported === 1 ? 'note' : 'notes'} imported` : 'Nothing imported');
  } catch (err) {
    console.error(err);
    toast('Could not import the selected file');
  }
});

function uniqueTitle(title, nb) {
  const base = String(title || 'Untitled').trim() || 'Untitled';
  const used = new Set(db.notes.filter(n => !n.trashed && (n.nb || null) === (nb || null)).map(n => (n.title || 'Untitled').toLowerCase()));
  if (!used.has(base.toLowerCase())) return base;
  let i = 2;
  while (used.has(`${base} (${i})`.toLowerCase())) i++;
  return `${base} (${i})`;
}

function addImportedNote(title, body, nb = null) {
  const now = Date.now();
  const n = { id: uid(), title: uniqueTitle(title, nb), body: sanitize(body || ''), created: now, updated: now, viewed: now, pinned: false, fav: false, nb: nb || null, tags: [], color: 'white', zoom: 100, trashed: 0 };
  db.notes.push(n);
  return n;
}

function importTextFile(filename, text) {
  let title = filename.replace(/\.[^.]+$/, '') || 'Untitled';
  let body = textToHtml(text);
  if (/\.md$/i.test(filename)) {
    const lines = String(text || '').split(/\r?\n/);
    if (lines[0]?.match(/^#\s+/)) title = lines.shift().replace(/^#\s+/, '').trim() || title;
    body = mdToHtml(lines.join('\n'));
  }
  const n = addImportedNote(title, body);
  return n ? 1 : 0;
}

function stripLeadingMarkdownTitle(text) {
  const lines = String(text || '').split(/\r?\n/);
  if (lines[0]?.match(/^#\s+/)) return lines.slice(1).join('\n');
  return text;
}

function textToHtml(text) {
  return String(text || '').split(/\r?\n/).map(line => line ? `<p>${esc(line)}</p>` : '<p><br></p>').join('');
}

function importJson(text) {
  const data = JSON.parse(text);
  if (!data || !Array.isArray(data.notes)) throw new Error('Invalid backup');
  const folderMap = new Map();
  if (Array.isArray(data.notebooks)) {
    const pending = [...data.notebooks];
    while (pending.length) {
      let progressed = false;
      for (let i = pending.length - 1; i >= 0; i--) {
        const old = pending[i];
        const parent = old.parent ? folderMap.get(old.parent) : null;
        if (old.parent && !parent) continue;
        const exists = db.notebooks.find(n => !n.trashed && (n.parent || null) === (parent || null) && n.name.toLowerCase() === String(old.name || '').toLowerCase());
        const nb = exists || { id: uid(), name: String(old.name || 'Folder'), parent: parent || null, open: false, trashed: 0 };
        if (!exists) db.notebooks.push(nb);
        folderMap.set(old.id, nb.id);
        pending.splice(i, 1); progressed = true;
      }
      if (!progressed) break;
    }
  }
  let count = 0;
  data.notes.forEach(old => {
    const nb = old.nb ? (folderMap.get(old.nb) || null) : null;
    addImportedNote(old.title, old.body, nb);
    count++;
  });
  return count;
}

async function importZip(file) {
  const buffer = await file.arrayBuffer();
  const entries = readStoredZip(buffer);
  let count = 0;
  const backup = entries.find(e => /(^|\/)take-fast-notes\.json$/i.test(e.name));
  if (backup) {
    try { count += importJson(new TextDecoder().decode(backup.data)); } catch {}
    return count;
  }
  for (const entry of entries) {
    if (entry.name.endsWith('/')) continue;
    if (/\.(md|txt)$/i.test(entry.name)) count += importTextFile(entry.name.split('/').pop(), new TextDecoder().decode(entry.data));
  }
  return count;
}

/* ---------- Editor ---------- */
function applyNoteTheme(n) {
  editorScroll.className = 'editor-scroll bg-' + (n.color || 'white');
}

function openEditor(id, focusTitle = false, readonly = false) {
  const n = byId(id);
  if (!n) return;
  editing = id;
  editingReadonly = !!readonly;
  n.viewed = Date.now(); save();
  titleInput.value = n.title || '';
  bodyInput.innerHTML = sanitize(n.body || '');
  titleInput.disabled = editingReadonly;
  bodyInput.contentEditable = editingReadonly ? 'false' : 'true';
  fmtbar.hidden = editingReadonly;
  editMenuBtn.hidden = editingReadonly;
  editTitleBar.textContent = titleInput.value.trim() || 'Untitled';
  setSave(editingReadonly ? 'In Trash' : 'Saved');
  applyNoteTheme(n);
  document.documentElement.style.setProperty('--editor-zoom', (n.zoom || 100) / 100);
  history.pushState({ view: 'editor', id }, '');
  switchView({ view: 'editor', id });
  closeAllOverlays();
  if (!editingReadonly) requestAnimationFrame(() => (focusTitle ? titleInput : bodyInput).focus({ preventScroll: true }));
}

function closeEditor() {
  clearTimeout(saveTimer);
  commit();
  editing = null;
  editingReadonly = false;
  document.documentElement.style.setProperty('--editor-zoom', '1');
  history.back();
}

function setSave(text) {
  saveState.textContent = text;
  saveState.classList.toggle('saving', text !== 'Saved' && text !== 'In Trash');
}

function commit() {
  if (!editing || editingReadonly) return;
  const n = byId(editing);
  if (!n) return;
  const title = titleInput.value.trim();
  const body = sanitize(bodyInput.innerHTML);
  const changed = n.title !== title || n.body !== body;
  n.title = title;
  n.body = body;
  if (changed) n.updated = Date.now();
  if (!save()) { setSave('Storage full'); return; }
  setSave('Saved');
  if (changed) renderContent();
}

function scheduleSave() {
  setSave('Saving…');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(commit, 450);
}

titleInput.addEventListener('input', () => { editTitleBar.textContent = titleInput.value.trim() || 'Untitled'; scheduleSave(); });
bodyInput.addEventListener('input', scheduleSave);
bodyInput.addEventListener('click', e => {
  const cb = e.target.closest('.cb');
  if (!cb || editingReadonly) return;
  const li = cb.closest('li');
  if (!li) return;
  li.classList.toggle('done');
  scheduleSave();
});

fmtbar.addEventListener('click', e => {
  const b = e.target.closest('.fmt-btn');
  if (!b || editingReadonly) return;
  const c = b.dataset.cmd;
  bodyInput.focus();
  if (c === 'bold' || c === 'italic' || c === 'underline') document.execCommand(c, false, null);
  else if (c === 'ul') document.execCommand('insertUnorderedList', false, null);
  else if (c === 'ol') document.execCommand('insertOrderedList', false, null);
  else if (c === 'heading') document.execCommand('formatBlock', false, 'h2');
  else if (c === 'check') document.execCommand('insertHTML', false, '<ul class="cl"><li><span class="cb" contenteditable="false"></span>&#8203;</li></ul><p><br></p>');
  else if (c === 'link') {
    const url = prompt('Link URL', 'https://');
    if (url && /^(https?:\/\/|mailto:)/i.test(url.trim())) document.execCommand('createLink', false, url.trim());
  } else if (c === 'more') {
    openMenu([
      { icon: 'heading', label: 'Heading', fn: () => document.execCommand('formatBlock', false, 'h2') },
      { icon: 'info', label: 'Code block', fn: () => document.execCommand('formatBlock', false, 'pre') }
    ]);
    return;
  }
  scheduleSave();
});

editMenuBtn.addEventListener('click', () => {
  const n = byId(editing);
  if (!n) return;
  openMenu([
    { icon: 'star', label: n.fav ? 'Remove favorite' : 'Add to favorites', fn: () => { n.fav = !n.fav; save(); toast(n.fav ? 'Added to favorites' : 'Removed from favorites'); } },
    { icon: 'pin', label: n.pinned ? 'Unpin note' : 'Pin note', fn: () => { n.pinned = !n.pinned; save(); toast(n.pinned ? 'Pinned' : 'Unpinned'); } },
    { icon: 'sun', label: 'Note color', fn: () => openNoteColorSheet(n) },
    { icon: 'heading', label: 'Editor zoom', fn: () => openZoomSheet(n) },
    { icon: 'tag', label: 'Edit tags', fn: () => editTags(n) },
    { icon: 'trash', label: 'Move to Trash', danger: true, fn: () => moveNoteToTrash(n.id, true) }
  ]);
});

backBtn.addEventListener('click', closeEditor);

function openNoteColorSheet(n) {
  const html = COLORS.map(c => `<button class="sheet-item ${n.color === c.id ? 'on' : ''}" data-note-color="${esc(c.id)}"><span class="nt-name">${esc(c.name)}</span></button>`).join('');
  openSheet('Note Color', html);
}

function openZoomSheet(n) {
  const html = [85, 100, 115, 130].map(z => `<button class="sheet-item ${Number(n.zoom) === z ? 'on' : ''}" data-note-zoom="${z}"><span class="nt-name">${z}%</span></button>`).join('');
  openSheet('Editor Zoom', html);
}

function editTags(n) {
  const value = prompt('Tags (comma separated)', (n.tags || []).join(', '));
  if (value === null) return;
  n.tags = normalizeTags(value);
  save(); renderContent(); toast(n.tags.length ? 'Tags updated' : 'Tags cleared');
}

/* ---------- Note creation / trash ---------- */
function createNote() {
  let targetNb = null;
  if (screen.type === 'notebook') targetNb = screen.id;
  else if (db.prefs.defFolder && byNb(db.prefs.defFolder) && !byNb(db.prefs.defFolder).trashed) targetNb = db.prefs.defFolder;
  const now = Date.now();
  const note = {
    id: uid(), title: '',
    body: currentTab === 'tasks' ? '<ul class="cl"><li><span class="cb" contenteditable="false"></span>&#8203;</li></ul>' : '',
    created: now, updated: now, viewed: now, pinned: false, fav: false,
    nb: targetNb, tags: screen.type === 'tag' ? [screen.tag] : [], color: 'white', zoom: 100, trashed: 0
  };
  db.notes.push(note);
  save();
  openEditor(note.id, true, false);
}

function moveNoteToTrash(id, notify = true) {
  const n = byId(id); if (!n) return;
  n.trashed = Date.now(); n.trashedBy = null;
  save();
  if (editing === id) { editing = null; editingReadonly = false; history.back(); }
  if (notify) { renderScreen(); toast('Note moved to Trash'); }
}

function openTrashActions() {
  openSheet('Trash Note', '<button class="sheet-item" data-tr-restore>' + ic('check') + '<span class="nt-name">Restore</span></button>' + '<button class="sheet-item danger" data-tr-delete>' + ic('trash') + '<span class="nt-name">Delete Forever</span></button>');
}
function openTrashFolderActions() {
  openSheet('Trash Folder', '<button class="sheet-item" data-folder-restore="' + esc(trashActionTarget.id) + '">' + ic('check') + '<span class="nt-name">Restore Folder</span></button>' + '<button class="sheet-item danger" data-folder-delete="' + esc(trashActionTarget.id) + '">' + ic('trash') + '<span class="nt-name">Delete Forever</span></button>');
}

function restoreTrash(target) {
  if (target.type === 'note') {
    const n = byId(target.id); if (n) { n.trashed = 0; delete n.trashedBy; }
  } else if (target.type === 'folder') {
    const ids = allDescendantFolderIds(target.id);
    db.notebooks.forEach(n => { if (ids.has(n.id)) { n.trashed = 0; delete n.trashedBy; } });
    db.notes.forEach(n => { if (ids.has(n.nb)) { n.trashed = 0; delete n.trashedBy; } });
  }
  save(); trashActionTarget = null; renderScreen(); toast('Restored');
}

function deleteForever(target) {
  if (target.type === 'note') db.notes = db.notes.filter(n => n.id !== target.id);
  else if (target.type === 'folder') {
    const ids = allDescendantFolderIds(target.id);
    db.notes = db.notes.filter(n => !ids.has(n.nb));
    db.notebooks = db.notebooks.filter(n => !ids.has(n.id));
  }
  save(); trashActionTarget = null; renderScreen(); toast('Deleted permanently');
}

/* ---------- Export: app-only file boundary ---------- */
function exportNotes(notes, kind) {
  if (!notes.length) return toast('Nothing to export');
  toast('Preparing export…');
  setTimeout(async () => {
    try {
      if (kind === 'json') {
        const backup = {
          app: 'Take Fast Notes', version: 2, exportedAt: new Date().toISOString(),
          notes: notes.map(n => ({ ...n })),
          notebooks: db.notebooks.map(n => ({ ...n })),
          prefs: { ...db.prefs }
        };
        await downloadFile('take-fast-notes-backup.json', JSON.stringify(backup, null, 2), 'application/json');
      } else {
        const ext = kind === 'txtzip' ? 'txt' : 'md';
        const files = notes.map(n => ({
          name: [...folderPath(n.nb), safeFilename(n.title || 'Untitled') + '.' + ext].join('/'),
          data: new TextEncoder().encode(ext === 'md' ? markdownForNote(n) : plain(n.body))
        }));
        files.push({ name: 'take-fast-notes.json', data: new TextEncoder().encode(JSON.stringify({ app: 'Take Fast Notes', version: 2, notes: notes.map(n => ({ ...n })), notebooks: db.notebooks.map(n => ({ ...n })) }, null, 2)) });
        const zip = makeStoredZip(files);
        await downloadFile(`take-fast-notes-${ext}-${new Date().toISOString().slice(0,10)}.zip`, zip, 'application/zip');
      }
      toast('Export ready');
    } catch (err) {
      console.error(err); toast('Export failed');
    }
  }, 20);
}

async function downloadFile(filename, content, type) {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const isCapacitor = !!window.Capacitor?.isNativePlatform?.();
  const fs = window.Capacitor?.Plugins?.Filesystem;
  if (isCapacitor && fs) {
    try {
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let binary = '';
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
      const base64 = btoa(binary);
      await fs.mkdir({ path: 'Take Fast Notes', directory: 'DOCUMENTS', recursive: true }).catch(() => {});
      await fs.writeFile({ path: `Take Fast Notes/${filename}`, data: base64, directory: 'DOCUMENTS' });
      toast('Export saved in Documents/Take Fast Notes');
      return;
    } catch (err) {
      console.warn('Native export failed; using browser download.', err);
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function markdownForNote(note) {
  const title = String(note.title || 'Untitled').trim().replace(/[\r\n]/g, ' ') || 'Untitled';
  const body = htmlToMd(note.body || '');
  return body ? `# ${title}\n\n${body}\n` : `# ${title}\n`;
}

/* ---------- Minimal ZIP writer/reader (store method, no external library) ---------- */
function crc32(bytes) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) {
    crc ^= bytes[i];
    for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ (0xEDB88320 & -(crc & 1));
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
function u16(v) { return new Uint8Array([v & 255, (v >>> 8) & 255]); }
function u32(v) { return new Uint8Array([v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255]); }
function concatBytes(parts) { const len = parts.reduce((n, p) => n + p.length, 0); const out = new Uint8Array(len); let o = 0; parts.forEach(p => { out.set(p, o); o += p.length; }); return out; }
function dosDateTime(date = new Date()) {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const d = Math.max(0, date.getFullYear() - 1980);
  const day = (d << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return [time, day];
}
function makeStoredZip(files) {
  const enc = new TextEncoder(); const locals = []; const centrals = []; let offset = 0;
  const [time, date] = dosDateTime();
  for (const file of files) {
    const name = enc.encode(file.name.replace(/^\/+/, ''));
    const data = file.data instanceof Uint8Array ? file.data : enc.encode(String(file.data));
    const crc = crc32(data);
    const local = concatBytes([u32(0x04034b50), u16(20), u16(0x800), u16(0), u16(time), u16(date), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), name, data]);
    locals.push(local);
    const central = concatBytes([u32(0x02014b50), u16(20), u16(20), u16(0x800), u16(0), u16(time), u16(date), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), name]);
    centrals.push(central); offset += local.length;
  }
  const centralSize = centrals.reduce((n, p) => n + p.length, 0);
  const end = concatBytes([u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length), u32(centralSize), u32(offset), u16(0)]);
  return new Blob([concatBytes([...locals, ...centrals, end])], { type: 'application/zip' });
}
function readStoredZip(buffer) {
  const bytes = new Uint8Array(buffer); const dec = new TextDecoder(); const entries = []; let p = 0;
  const view = new DataView(buffer);
  while (p + 30 <= bytes.length) {
    const sig = view.getUint32(p, true);
    if (sig === 0x04034b50) {
      const method = view.getUint16(p + 8, true);
      const compSize = view.getUint32(p + 18, true);
      const nameLen = view.getUint16(p + 26, true);
      const extraLen = view.getUint16(p + 28, true);
      const name = dec.decode(bytes.slice(p + 30, p + 30 + nameLen));
      const dataStart = p + 30 + nameLen + extraLen;
      if (method !== 0) throw new Error('This ZIP uses compression not supported by this app');
      entries.push({ name, data: bytes.slice(dataStart, dataStart + compSize) });
      p = dataStart + compSize;
    } else break;
  }
  return entries;
}

/* ---------- Routing ---------- */
function switchView(state) {
  closeAllOverlays();
  homeView.hidden = true; editView.hidden = true; folderView.hidden = true; settingsView.hidden = true;
  const view = state.view || 'home';
  if (view === 'home') {
    screen = { type: state.type || 'notes', filter: state.filter || 'all', id: state.id, tag: state.tag };
    homeView.hidden = false; renderScreen();
  } else if (view === 'folder') {
    if (!byNb(state.id) || byNb(state.id).trashed) { nav({ type: 'notes', filter: 'all' }); return; }
    screen = { type: 'notebook', id: state.id };
    homeView.hidden = false; renderScreen();
  } else if (view === 'folderBrowser') {
    folderView.hidden = false; renderFolderPage();
  } else if (view === 'settings') {
    settingsView.hidden = false; refreshSettingsLabels();
  } else if (view === 'editor') {
    editView.hidden = false;
  }
}

window.addEventListener('popstate', e => {
  if (editing && (!e.state || e.state.view !== 'editor')) {
    clearTimeout(saveTimer); commit(); editing = null; editingReadonly = false;
  }
  switchView(e.state || { view: 'home', type: 'notes', filter: 'all' });
});

function nav(next) {
  if (next.type === 'notebooks') {
    history.pushState({ view: 'folderBrowser' }, ''); switchView({ view: 'folderBrowser' });
  } else if (next.type === 'notebook') {
    history.pushState({ view: 'folder', id: next.id }, ''); switchView({ view: 'folder', id: next.id });
  } else {
    const state = { view: 'home', ...next };
    history.pushState(state, ''); switchView(state);
  }
}

function renderFolderPage() {
  const folders = db.notebooks.filter(n => !n.trashed);
  let html = '<button class="folder-list-item" data-nb-nav="all"><span class="ric">' + ic('doc') + '</span><span class="f-name">All Notes</span></button>';
  function add(parent, depth) {
    folders.filter(n => (n.parent || null) === (parent || null)).forEach(nb => {
      const selected = selMode && selSet.has(nb.id);
      const count = folderNoteCount(nb.id);
      html += `<button class="folder-list-item ${selected ? 'selected' : ''}" data-nb-nav="${esc(nb.id)}" style="padding-left:${24 + depth * 20}px"><span class="ric">${ic('folder')}</span><span class="f-name">${esc(nb.name)}</span><span class="f-count">${count}</span><span class="folder-more" data-folder-action="${esc(nb.id)}" aria-label="Folder actions">${ic('kebab')}</span></button>`;
      add(nb.id, depth + 1);
    });
  }
  add(null, 0);
  folderList.innerHTML = html;
  $('#newFolderPageBtn').parentElement.hidden = selMode;
}

/* ---------- Selection helpers ---------- */
function enterSelection(id) { selMode = true; selSet = new Set([id]); renderScreen(); }
function exitSelection() { selMode = false; selSet.clear(); renderScreen(); }
function toggleSelection(id) {
  if (selSet.has(id)) selSet.delete(id); else selSet.add(id);
  if (!selSet.size) exitSelection(); else renderScreen();
}

/* ---------- Settings / initial state ---------- */
function startApp() {
  applyTheme(); refreshSettingsLabels();
  history.replaceState({ view: 'home', type: 'notes', filter: 'all' }, '');
  if (db.prefs.startPlace === 'newNote') createNote(); else switchView({ view: 'home', type: 'notes', filter: 'all' });
}

window.addEventListener('take-fast-notes-storage-error', () => setTimeout(() => toast('Storage is full. Export a backup and free app storage.'), 0));
startApp();
