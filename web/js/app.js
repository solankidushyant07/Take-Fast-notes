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
  history.pushState({ view: 'settings' }, '');
  switchView({ view: 'settings' });
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

/* ---------- Note Move Function ---------- */
$('#selMove').addEventListener('click', () => {
  const folders = db.notebooks.filter(n => !n.trashed && !n.parent);
  let html = '<button class="sheet-item" data-move-to="root">'
           + ic('doc') + '<span class="nt-name">Home (Root)</span></button>';
           
  folders.forEach(f => {
    html += `<button class="sheet-item" data-move-to="${esc(f.id)}">
               ${ic('folder')} <span class="nt-name">${esc(f.name)}</span>
             </button>`;
  });

  openSheet('Move to Folder', html);
});

// Add this to your existing sheetContent.addEventListener('click') block:
sheetContent.addEventListener('click', e => {
  // ... existing sheet listeners ...
  
  const moveTo = e.target.closest('[data-move-to]');
  if (moveTo) {
    const targetFolder = moveTo.dataset.moveTo === 'root' ? null : moveTo.dataset.moveTo;
    selSet.forEach(id => {
      const n = byId(id);
      if (n) n.nb = targetFolder;
    });
    save();
    closeSheet();
    exitSelection();
    toast('Notes moved');
    return;
  }
});


/* ---------- Page Navigation Listeners ---------- */
$('#folderBackBtn').addEventListener('click', () => history.back());
$('#settingsBackBtn').addEventListener('click', () => history.back());
$('#newFolderPageBtn').addEventListener('click', () => createFolder(null));

// Clicking a folder inside the new Folder Page
$('#folderList').addEventListener('click', e => {
  const btn = e.target.closest('[data-nb-nav]');
  if (!btn) return;
  const target = btn.dataset.nbNav;
  if (target === 'all') nav({ type: 'notes', filter: 'all' });
  else nav({ type: 'notebook', id: target });
});

// Top right menu button now opens Settings
appMenuBtn.addEventListener('click', () => {
  history.pushState({ view: 'settings' }, '');
  switchView({ view: 'settings' });
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

/* ---------- Complex Gestures: Swipe-to-Delete & Long Press ---------- */
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
    mode: 'wait', // 'wait', 'swipe', or 'longpress'
    fired: false
  };

  // Long press timer
  gesture.timer = setTimeout(() => {
    if (!gesture || gesture.mode === 'swipe') return;
    gesture.fired = true;
    gesture.mode = 'longpress';
    if (navigator.vibrate) navigator.vibrate(25);
    enterSelection(id);
  }, 400);
}, { passive: true });

content.addEventListener('touchmove', e => {
  if (!gesture) return;
  
  const dx = e.touches[0].clientX - gesture.startX;
  const dy = e.touches[0].clientY - gesture.startY;
  
  if (gesture.mode === 'wait') {
    // If moving vertically, cancel everything (it's a scroll)
    if (Math.abs(dy) > 15) {
      clearTimeout(gesture.timer);
      gesture = null;
      return;
    }
    // If moving horizontally, trigger swipe mode
    if (dx < -15) {
      clearTimeout(gesture.timer);
      gesture.mode = 'swipe';
      gesture.card.classList.add('dragging');
    }
  }

  if (gesture.mode === 'swipe') {
    e.preventDefault(); // Stop screen from scrolling
    const swipeDistance = Math.max(-80, Math.min(0, dx));
    gesture.card.style.transform = `translateX(${swipeDistance}px)`;
  }
}, { passive: false });

function finishGesture() {
  if (!gesture) return;
  clearTimeout(gesture.timer);
  
  if (gesture.mode === 'swipe') {
    gesture.card.classList.remove('dragging');
    
    // Read the final transform
    const transformMatch = gesture.card.style.transform.match(/translateX\(([-\d.]+)px\)/);
    const finalX = transformMatch ? parseFloat(transformMatch[1]) : 0;
    
    gesture.card.style.transform = ''; // reset inline style
    
    if (finalX < -45) {
      // Trigger Delete
      if (navigator.vibrate) navigator.vibrate(15);
      moveNoteToTrash(gesture.id, true);
    }
  }
  
  if (gesture.fired) suppressClickUntil = Date.now() + 350;
  gesture = null;
}

content.addEventListener('touchend', finishGesture, { passive: true });
content.addEventListener('touchcancel', finishGesture, { passive: true });

/* ---------- Folder Page Long Press ---------- */
let folderGesture = null;

folderList.addEventListener('touchstart', e => {
  if (e.touches.length !== 1) return;
  const item = e.target.closest('[data-nb-nav]');
  if (!item || item.dataset.nbNav === 'all') return;

  folderGesture = {
    id: item.dataset.nbNav,
    fired: false,
    timer: setTimeout(() => {
      folderGesture.fired = true;
      if (navigator.vibrate) navigator.vibrate(25);
      selMode = true;
      selSet = new Set([folderGesture.id]);
      
      // Update topbar for folder selection mode
      $('#selCount').textContent = countLabel(selSet.size, 'folder');
      homeTopbar.hidden = true;
      selBar.hidden = false;
      $('#selMove').hidden = true; // Hide note-specific buttons
      $('#selFav').hidden = true;
      
      renderFolderPage();
    }, 400)
  };
}, { passive: true });

folderList.addEventListener('touchmove', () => {
  if (folderGesture) { clearTimeout(folderGesture.timer); folderGesture = null; }
}, { passive: true });
folderList.addEventListener('touchend', () => {
  if (folderGesture) { clearTimeout(folderGesture.timer); folderGesture = null; }
}, { passive: true });

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

  // Push to history stack instead of just hiding views
  history.pushState({ view: 'editor', id }, '');
  switchView({ view: 'editor', id });

  closeAllOverlays();
  checkFormatStates();

  if (!editingReadonly) {
    const target = focusTitle ? titleInput : bodyInput;
    requestAnimationFrame(() => target.focus({ preventScroll: true }));
  }
}

function closeEditor() {
  clearTimeout(saveTimer);
  commit();
  editing = null;
  editingReadonly = false;
  document.documentElement.style.setProperty('--editor-zoom', '1');
  
  // This automatically pops back to Home or Folder
  history.back(); 
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

/* ---------- Note Creation (Smart Defaults) ---------- */
async function createNote() {
  if (NativeFS.available && !vaultReady) {
    const ready = await ensureVault();
    if (!ready) {
      toast('Choose a notes folder first');
      return;
    }
  }

  // Determine where to create the note
  let targetNb = null;
  if (screen.type === 'notebook') {
    targetNb = screen.id; // Create in current folder if we are inside one
  } else if (db.prefs.defFolder) {
    targetNb = db.prefs.defFolder; // Otherwise use default folder setting
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
    nb: targetNb,
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

/* ---------- Export Functionality ---------- */
function downloadFile(filename, content, type = 'text/plain') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Export multiple selected notes
$('#selExport').addEventListener('click', () => {
  openSheet('Export Selected Notes',
    '<button class="sheet-item" data-export-type="md">' + ic('doc') + '<span class="nt-name">Export as Markdown (.md)</span></button>' +
    '<button class="sheet-item" data-export-type="txt">' + ic('doc') + '<span class="nt-name">Export as Text (.txt)</span></button>'
  );
});

// Handle the sheet clicks for exporting
sheetContent.addEventListener('click', e => {
  const exportTypeTarget = e.target.closest('[data-export-type]');
  if (exportTypeTarget) {
    const format = exportTypeTarget.dataset.exportType;
    let exportedCount = 0;

    selSet.forEach(id => {
      const n = byId(id);
      if (n) {
        const content = format === 'md' ? markdownForNote(n) : plain(n.body);
        const filename = (n.title || 'Untitled').trim().replace(/[\/\\:*?"<>|]/g, '-') + `.${format}`;
        downloadFile(filename, content);
        exportedCount++;
      }
    });

    closeSheet();
    exitSelection();
    toast(`${exportedCount} notes exported`);
    return;
  }
});

// Wire up the main Settings Export button for a full backup
$('#setExportBtn').addEventListener('click', () => {
  exportAllNotes(); // Uses the JSON backup function already in your code
});

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

/* ---------- Folder Selection Actions ---------- */
$('#fSelEdit').addEventListener('click', () => {
  if (selSet.size !== 1) return toast('Select one folder to rename');
  const id = Array.from(selSet)[0];
  const nb = byNb(id);
  const name = prompt('Rename folder', nb.name);
  
  if (name && name.trim()) {
    nb.name = name.trim();
    save();
    renderFolderPage();
    toast('Folder renamed');
  }
  exitSelection();
});

$('#fSelTrash').addEventListener('click', () => {
  const stamp = Date.now();
  selSet.forEach(id => {
    const ids = descSet(id);
    db.notebooks.forEach(nb => { if (ids.has(nb.id) && !nb.trashed) { nb.trashed = stamp; nb.trashedBy = id; } });
    db.notes.forEach(n => { if (ids.has(n.nb) && !n.trashed) { n.trashed = stamp; n.trashedBy = id; } });
  });
  save();
  renderFolderPage();
  exitSelection();
  toast('Moved to Trash');
});

/* ---------- Native Android APK Export ---------- */
async function nativeExportFiles(notesArray, format) {
  if (!NativeFS.available || !vaultReady) {
    toast('Vault access required for native export.');
    return;
  }
  
  toast('Exporting...');
  let count = 0;
  const exportDir = 'TakeFastNotes_Export_' + Date.now();
  await NativeFS.createFolder(exportDir);

  for (const n of notesArray) {
    const content = format === 'md' ? markdownForNote(n) : plain(n.body);
    const filename = (n.title || 'Untitled').trim().replace(/[\/\\:*?"<>|]/g, '-') + `.${format}`;
    const path = `${exportDir}/${filename}`;
    
    const success = await NativeFS.writeFile(path, content);
    if (success) count++;
  }
  toast(`Exported ${count} notes to device folder.`);
}

function exportAllNotes() {
  const validNotes = db.notes.filter(n => !n.trashed);
  nativeExportFiles(validNotes, 'md');
}

// Override the Multi-select Export sheet handler
sheetContent.addEventListener('click', e => {
  const exportTypeTarget = e.target.closest('[data-export-type]');
  if (exportTypeTarget) {
    const format = exportTypeTarget.dataset.exportType;
    const notesToExport = [];
    selSet.forEach(id => {
      const n = byId(id);
      if (n) notesToExport.push(n);
    });
    
    closeSheet();
    exitSelection();
    nativeExportFiles(notesToExport, format);
    return;
  }
  // ... rest of sheet handlers remain intact
});

/* ---------- Settings Page Logic ---------- */
function updateSettingsLabels() {
  $('#startPlaceLabel').textContent = db.prefs.startPlace === 'newNote' ? 'New Note' : 'Home';
  const defFolder = byNb(db.prefs.defFolder);
  $('#defFolderLabel').textContent = defFolder ? defFolder.name : 'Home (Root)';
}

$('#setStartBtn').addEventListener('click', () => {
  db.prefs.startPlace = db.prefs.startPlace === 'home' ? 'newNote' : 'home';
  save();
  updateSettingsLabels();
  toast('Default launch screen updated');
});

$('#setDefFolderBtn').addEventListener('click', () => {
  const folders = db.notebooks.filter(n => !n.trashed && !n.parent);
  let html = '<button class="sheet-item" data-def-folder="root">'
           + ic('doc') + '<span class="nt-name">Home (Root)</span></button>';
           
  folders.forEach(f => {
    html += `<button class="sheet-item" data-def-folder="${esc(f.id)}">
               ${ic('folder')} <span class="nt-name">${esc(f.name)}</span>
             </button>`;
  });

  openSheet('Set Default New-Note Folder', html);
});

// Update sheetContent listener to handle setting the default folder
sheetContent.addEventListener('click', e => {
  const defFolderTarget = e.target.closest('[data-def-folder]');
  if (defFolderTarget) {
    db.prefs.defFolder = defFolderTarget.dataset.defFolder === 'root' ? null : defFolderTarget.dataset.defFolder;
    save();
    updateSettingsLabels();
    closeSheet();
    toast('Default folder updated');
    return;
  }
});

/* ---------- Initialization & Launch ---------- */
async function startApp() {
  if (NativeFS.available) {
    await ensureVault();
  }
  
  applyTheme();
  updateSettingsLabels();

  // Route to the correct starting place
  if (db.prefs.startPlace === 'newNote') {
    createNote();
  } else {
    // History API will handle routing to 'home' automatically
    nav({ type: 'notes', filter: 'all' });
  }
}

startApp();
