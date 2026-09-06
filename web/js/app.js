/* Take Fast Notes - app.js | Events, Gestures, Navigation, and Editor */
'use strict';

let vaultReady = false;
let vaultInitializing = false;

/* ---------- Top Navigation Tabs ---------- */
navTabNotes.addEventListener('click', () => {
  currentTab = 'notes';
  nav({ type: 'notes', filter: 'all' });
});

navTabTasks.addEventListener('click', () => {
  currentTab = 'tasks';
  renderScreen();
});

navTabSettings.addEventListener('click', () => {
  openSettings();
});

/* ---------- Selection Listeners ---------- */
$('#selClose').addEventListener('click', exitSelection);

$('#selAll').addEventListener('click', () => {
  if (visibleIds.every(id => selSet.has(id))) selSet.clear();
  else visibleIds.forEach(id => selSet.add(id));

  if (!selSet.size) exitSelection();
  else {
    renderContent();
    selCount.textContent = countLabel(selSet.size, 'selected');
  }
});

$('#selPin').addEventListener('click', () => {
  selSet.forEach(id => { const n = byId(id); if (n) n.pinned = true; });
  save();
  toast('Pinned');
  exitSelection();
});

$('#selFav').addEventListener('click', () => {
  selSet.forEach(id => { const n = byId(id); if (n) n.fav = true; });
  save();
  toast('Added to favorites');
  exitSelection();
});

$('#selTrash').addEventListener('click', () => {
  const count = selSet.size;
  selSet.forEach(id => moveNoteToTrash(id, false));
  save();
  toast(countLabel(count, 'note') + ' moved to Trash');
  exitSelection();
});

/* ---------- Category Row Interactions ---------- */
filterRow.addEventListener('click', e => {
  const folderNav = e.target.closest('[data-action="open-folder-browser"]');
  if (folderNav) {
    openFolderBrowserSheet();
    return;
  }

  const allPill = e.target.closest('[data-cat="all"]');
  if (allPill) {
    nav({ type: 'notes', filter: 'all' });
    return;
  }

  const folderPill = e.target.closest('[data-folder-pill]');
  if (folderPill) {
    nav({ type: 'notebook', id: folderPill.dataset.folderPill });
  }
});

/* ---------- Search Bar ---------- */
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

/* ---------- Content Interactions & Long Press ---------- */
content.addEventListener('click', e => {
  if (Date.now() < suppressClickUntil) return;

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

let cardGesture = null;

content.addEventListener('touchstart', e => {
  if (selMode || e.touches.length !== 1) return;
  const card = e.target.closest('.note-card');
  if (!card) return;

  const id = card.dataset.open;
  if (!id) return;

  cardGesture = {
    card,
    id,
    x: e.touches[0].clientX,
    y: e.touches[0].clientY,
    fired: false
  };

  cardGesture.timer = setTimeout(() => {
    if (!cardGesture) return;
    cardGesture.fired = true;
    if (navigator.vibrate) navigator.vibrate(25);
    enterSelection(id);
  }, 480);
}, { passive: true });

content.addEventListener('touchmove', e => {
  if (!cardGesture) return;
  const dx = e.touches[0].clientX - cardGesture.x;
  const dy = e.touches[0].clientY - cardGesture.y;
  if (Math.abs(dy) > 12 || Math.abs(dx) > 12) {
    clearTimeout(cardGesture.timer);
    cardGesture = null;
  }
}, { passive: true });

function finishCardGesture() {
  if (!cardGesture) return;
  clearTimeout(cardGesture.timer);
  if (cardGesture.fired) suppressClickUntil = Date.now() + 350;
  cardGesture = null;
}

content.addEventListener('touchend', finishCardGesture, { passive: true });
content.addEventListener('touchcancel', finishCardGesture, { passive: true });

/* ---------- Overlays & Menu Handlers ---------- */
scrim.addEventListener('click', closeAllOverlays);

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeAllOverlays();
});

window.addEventListener('take-fast-notes-storage-error', () => {
  setTimeout(() => {
    toast('Storage full. Please free space and try again.');
  }, 0);
});

menuEl.addEventListener('click', e => {
  const item = e.target.closest('[data-mi]');
  if (!item) return;
  const action = menuItems[Number(item.dataset.mi)];
  if (action?.fn) action.fn();
  closeMenu();
});

/* ---------- Sheet Interactions ---------- */
sheetContent.addEventListener('click', e => {
  const newRoot = e.target.closest('[data-action="new-root-folder"]');
  if (newRoot) {
    closeSheet();
    createFolder(null);
    return;
  }

  const nbItem = e.target.closest('[data-sheet-nb]');
  if (nbItem) {
    closeSheet();
    nav({ type: 'notebook', id: nbItem.dataset.sheetNb });
    return;
  }

  const libItem = e.target.closest('[data-sheet-lib]');
  if (libItem) {
    closeSheet();
    const kind = libItem.dataset.sheetLib;
    if (kind === 'recent') nav({ type: 'notes', filter: 'recent' });
    else if (kind === 'favorites') nav({ type: 'notes', filter: 'favorites' });
    else if (kind === 'tags') nav({ type: 'tags' });
    else if (kind === 'trash') nav({ type: 'trash' });
    return;
  }

  const tChoice = e.target.closest('[data-theme-choice]');
  if (tChoice) {
    db.prefs.theme = tChoice.dataset.themeChoice;
    save();
    applyTheme();
    openSettings();
    return;
  }

  const aAction = e.target.closest('[data-action]');
  if (aAction) {
    if (aAction.dataset.action === 'export') exportAllNotes();
    if (aAction.dataset.action === 'import') mdImport.click();
    if (aAction.dataset.action === 'change-vault') changeNotesFolder();
    return;
  }

  const sort = e.target.closest('[data-sort]');
  if (sort) {
    db.prefs.sortBy = sort.dataset.sort;
    save();
    closeSheet();
    renderScreen();
    return;
  }

  const nt = e.target.closest('[data-nt]');
  if (nt && editing) {
    const n = byId(editing);
    if (n) {
      n.color = nt.dataset.nt;
      save();
      applyNoteTheme(n);
      closeSheet();
    }
    return;
  }

  const trRestore = e.target.closest('[data-tr-restore]');
  if (trRestore && trashActionTarget) {
    restoreTrash(trashActionTarget);
    closeSheet();
    return;
  }

  const trDelete = e.target.closest('[data-tr-delete]');
  if (trDelete && trashActionTarget) {
    deleteForever(trashActionTarget);
    closeSheet();
    return;
  }
});

/* ---------- Folder Actions ---------- */
async function createFolder(parent) {
  if (NativeFS.available && !vaultReady) {
    const ready = await ensureVault();
    if (!ready) {
      toast('Choose a notes folder first');
      return;
    }
  }

  const name = prompt(parent ? 'New subfolder name' : 'New folder name', '');
  if (name === null) return;
  const clean = name.trim();
  if (!clean) return toast('Folder name cannot be empty');

  if (db.notebooks.some(n => !n.trashed && n.parent === parent && n.name.toLowerCase() === clean.toLowerCase())) {
    return toast('A folder with that name already exists');
  }

  const nb = { id: uid(), name: clean, parent: parent || null, open: false };
  db.notebooks.push(nb);
  save();
  renderScreen();
  toast('Folder created');
}

/* ---------- Trash Operations ---------- */
function moveNoteToTrash(id, notify = true) {
  const n = byId(id);
  if (!n) return;
  n.trashed = Date.now();
  n.trashedBy = null;
  save();
  if (editing === id) closeEditor();
  if (notify) {
    renderScreen();
    toast('Note moved to Trash');
  }
}

function openTrashActions() {
  if (!trashActionTarget) return;
  openSheet(
    'Trash Note',
    '<button class="sheet-item" data-tr-restore>' + ic('check') + '<span class="nt-name">Restore</span></button>'
    + '<button class="sheet-item danger" data-tr-delete>' + ic('trash') + '<span class="nt-name">Delete Forever</span></button>'
  );
}

function restoreTrash(target) {
  if (target.type === 'note') {
    const n = byId(target.id);
    if (n) {
      n.trashed = 0;
      delete n.trashedBy;
      save();
    }
  }
  trashActionTarget = null;
  renderScreen();
  toast('Restored');
}

function deleteForever(target) {
  if (target.type === 'note') {
    db.notes = db.notes.filter(n => n.id !== target.id);
  }
  save();
  trashActionTarget = null;
  renderScreen();
  toast('Deleted permanently');
}

/* ---------- Editor Workflow ---------- */
function applyNoteTheme(n) {
  editorScroll.className = 'editor-scroll bg-' + (n.color || 'white');
}

function openEditor(id, focusTitle = false, readonly = false) {
  const n = byId(id);
  if (!n) return;

  editing = id;
  editingReadonly = !!readonly;
  n.viewed = Date.now();
  save();

  titleInput.value = n.title || '';
  bodyInput.innerHTML = n.body || '';

  titleInput.disabled = editingReadonly;
  bodyInput.contentEditable = editingReadonly ? 'false' : 'true';

  fmtbar.hidden = editingReadonly;
  editMenuBtn.hidden = editingReadonly;
  editTitleBar.textContent = titleInput.value.trim() || 'Untitled';
  setSave(editingReadonly ? 'In Trash' : 'Saved');

  applyNoteTheme(n);
  document.documentElement.style.setProperty('--editor-zoom', (n.zoom || 100) / 100);

  homeView.hidden = true;
  editView.hidden = false;
  closeAllOverlays();

  if (!editingReadonly) {
    const target = focusTitle ? titleInput : bodyInput;
    requestAnimationFrame(() => target.focus({ preventScroll: true }));
  }
}

function closeEditor() {
  clearTimeout(saveTimer);
  commit();
  editView.hidden = true;
  homeView.hidden = false;
  editing = null;
  editingReadonly = false;
  document.documentElement.style.setProperty('--editor-zoom', '1');
  renderScreen();
}

function setSave(text) {
  saveState.textContent = text;
  saveState.classList.toggle('saving', text !== 'Saved' && text !== 'In Trash');
}

async function commit() {
  if (!editing || editingReadonly) return;
  const n = byId(editing);
  if (!n) return;

  const title = titleInput.value.trim();
  const body = sanitize(bodyInput.innerHTML);
  const changed = n.title !== title || n.body !== body;

  n.title = title;
  n.body = body;
  if (changed) n.updated = Date.now();

  if (!save()) {
    setSave('Storage full');
    return;
  }

  if (NativeFS.available && vaultReady && changed) {
    const success = await writeNoteToVault(n);
    if (!success) {
      setSave('File could not be saved');
      toast('Could not save Markdown file');
      return;
    }
  }

  setSave('Saved');
}

function scheduleSave() {
  setSave('Saving…');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(commit, 450);
}

backBtn.addEventListener('click', () => {
  commit();
  closeEditor();
});

titleInput.addEventListener('input', () => {
  editTitleBar.textContent = titleInput.value.trim() || 'Untitled';
  scheduleSave();
});

bodyInput.addEventListener('input', () => {
  scheduleSave();
});

bodyInput.addEventListener('click', e => {
  const cb = e.target.closest('.cb');
  if (!cb || editingReadonly) return;
  const li = cb.closest('li');
  if (!li) return;
  li.classList.toggle('done');
  scheduleSave();
});

/* Formatting Toolbar Execution */
fmtbar.addEventListener('click', e => {
  const b = e.target.closest('.fmt-btn');
  if (!b || editingReadonly) return;
  const c = b.dataset.cmd;

  bodyInput.focus();
  if (c === 'bold' || c === 'italic' || c === 'underline') {
    document.execCommand(c, false, null);
  } else if (c === 'ul') {
    document.execCommand('insertUnorderedList', false, null);
  } else if (c === 'ol') {
    document.execCommand('insertOrderedList', false, null);
  } else if (c === 'heading') {
    document.execCommand('formatBlock', false, 'h2');
  } else if (c === 'check') {
    document.execCommand('insertHTML', false, '<ul class="cl"><li><span class="cb" contenteditable="false"></span>&#8203;</li></ul><p><br></p>');
  } else if (c === 'link') {
    const url = prompt('Link URL', 'https://');
    if (url && /^(https?:\/\/|mailto:)/i.test(url.trim())) {
      document.execCommand('createLink', false, url.trim());
    }
  }
  scheduleSave();
});

/* Editor kebab menu */
editMenuBtn.addEventListener('click', () => {
  const n = byId(editing);
  if (!n) return;

  openMenu([
    {
      icon: 'star',
      label: n.fav ? 'Remove favorite' : 'Add to favorites',
      fn: () => {
        n.fav = !n.fav;
        save();
        toast(n.fav ? 'Added to favorites' : 'Removed from favorites');
      }
    },
    {
      icon: 'pin',
      label: n.pinned ? 'Unpin note' : 'Pin note',
      fn: () => {
        n.pinned = !n.pinned;
        save();
        toast(n.pinned ? 'Pinned' : 'Unpinned');
      }
    },
    {
      icon: 'trash',
      label: 'Move to Trash',
      danger: true,
      fn: () => moveNoteToTrash(n.id, true)
    }
  ]);
});

/* ---------- Note Creation ---------- */
async function createNote() {
  if (NativeFS.available && !vaultReady) {
    const ready = await ensureVault();
    if (!ready) {
      toast('Choose a notes folder first');
      return;
    }
  }

  const now = Date.now();
  const note = {
    id: uid(),
    title: '',
    body: currentTab === 'tasks' ? '<ul class="cl"><li><span class="cb" contenteditable="false"></span>&nbsp;</li></ul>' : '',
    created: now,
    updated: now,
    viewed: now,
    pinned: false,
    fav: false,
    nb: screen.type === 'notebook' ? screen.id : null,
    tags: screen.type === 'tag' ? [screen.tag] : [],
    color: 'white',
    zoom: 100
  };

  db.notes.push(note);
  if (NativeFS.available && vaultReady) {
    await writeNoteToVault(note);
  }

  save();
  openEditor(note.id, true, false);
}

fab.addEventListener('click', createNote);

/* ---------- Settings Sheet ---------- */
function openSettings() {
  openSheet(
    'Settings',
    '<button class="sheet-item" data-action="export">'
    + ic('export')
    + '<span class="nt-name">Export Backup (JSON)</span>'
    + '</button>'
    + '<button class="sheet-item" data-action="import">'
    + ic('import')
    + '<span class="nt-name">Import Markdown / Backup</span>'
    + '</button>'
    + (NativeFS.available
        ? '<button class="sheet-item" data-action="change-vault"><span class="nt-name">Change Notes Storage Folder</span></button>'
        : '')
  );
}

/* ---------- Theme Application ---------- */
function applyTheme() {
  document.documentElement.dataset.theme = 'dark';
  const meta = $('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', '#121212');
}

/* ---------- Markdown Vault Sync ---------- */
function markdownForNote(note) {
  const title = String(note.title || 'Untitled').trim().replace(/[\r\n\/\\:*?"<>|]/g, ' ') || 'Untitled';
  const body = htmlToMd(note.body || '');
  return body.trim() ? '# ' + title + '\n\n' + body : '# ' + title + '\n';
}

async function writeNoteToVault(note) {
  if (!NativeFS.available || !vaultReady || !note) return true;
  const path = NativeFS.notePath(note);
  return await NativeFS.writeFile(path, markdownForNote(note));
}

async function ensureVault() {
  if (!NativeFS.available || vaultReady) return true;
  if (vaultInitializing) return false;
  vaultInitializing = true;
  try {
    const result = await NativeFS.initialize();
    if (!result.ready) return false;
    vaultReady = true;
    return true;
  } finally {
    vaultInitializing = false;
  }
}

/* ---------- Initialization ---------- */
applyTheme();
renderScreen();

async function startApp() {
  if (NativeFS.available) {
    await ensureVault();
  }
  renderScreen();
}

startApp();
