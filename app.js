/* Take Fast Notes - app.js | Logic, Events, Gestures, and Editor */
'use strict';

/* ---------- Selection Listeners ---------- */
$('#selClose').addEventListener('click', exitSelection);
$('#selAll').addEventListener('click', () => {
  if (visibleIds.every(id => selSet.has(id))) selSet.clear(); else visibleIds.forEach(id => selSet.add(id));
  if (!selSet.size) exitSelection(); else { renderContent(); selCount.textContent = countLabel(selSet.size,'selected'); }
});
$('#selPin').addEventListener('click', () => { selSet.forEach(id => { const n = byId(id); if (n) n.pinned = true; }); save(); toast('Pinned'); exitSelection(); });
$('#selFav').addEventListener('click', () => { selSet.forEach(id => { const n = byId(id); if (n) n.fav = true; }); save(); toast('Added to favorites'); exitSelection(); });
$('#selTrash').addEventListener('click', () => { const count = selSet.size; selSet.forEach(id => moveNoteToTrash(id, false)); save(); toast(countLabel(count,'note') + ' moved to Trash'); exitSelection(); });

/* ---------- Drawer Listeners ---------- */
sideBtn.addEventListener('click', openDrawer);
drawerBody.addEventListener('click', e => {
  if (Date.now() < suppressClickUntil) return;
  if (e.target.closest('#nbAdd')) { createFolder(null); return; }

  const chev = e.target.closest('[data-chev]');
  if (chev) {
    e.stopPropagation();

    const nb = byNb(chev.dataset.chev);

    if (nb) {
      nb.open = !nb.open;
      save();
      renderDrawer();
    }

    return;
  }

  const go = e.target.closest('[data-go]');

  if (go) {
    const value = go.dataset.go;

    if (value === 'all') nav({type:'notes',filter:'all'});
    else if (value === 'recent') nav({type:'notes',filter:'recent'});
    else if (value === 'favorites') nav({type:'notes',filter:'favorites'});
    else if (value === 'notebooks') nav({type:'notebooks'});
    else if (value === 'tags') nav({type:'tags'});
    else if (value === 'trash') nav({type:'trash'});

    return;
  }

  const nb = e.target.closest('[data-nb]');

  if (nb) {
    nav({
      type:'notebook',
      id:nb.dataset.nb
    });
  }
});

/* ---------- Mobile long-press on Drawer (Contextual Popup) ---------- */
let dGesture = null;

drawerBody.addEventListener('touchstart', e => {
  if (e.touches.length !== 1) return;

  const row = e.target.closest('.d-item[data-nb]');

  if (!row) return;

  dGesture = {
    row,
    x: e.touches[0].clientX,
    y: e.touches[0].clientY,
    fired: false
  };

  dGesture.timer = setTimeout(() => {
    if (!dGesture) return;

    dGesture.fired = true;

    if (navigator.vibrate) navigator.vibrate(20);

    openFolderActions(row.dataset.nb, {
      x: dGesture.x,
      y: dGesture.y
    });
  }, 480);

  row.classList.add('holding');
}, {
  passive: true
});

drawerBody.addEventListener('touchmove', e => {
  if (!dGesture) return;

  const dx = e.touches[0].clientX - dGesture.x;
  const dy = e.touches[0].clientY - dGesture.y;

  if (Math.abs(dy) > 12 || Math.abs(dx) > 12) {
    clearTimeout(dGesture.timer);
    dGesture.row.classList.remove('holding');
    dGesture = null;
  }
}, {
  passive: true
});

function finishDGesture() {
  if (!dGesture) return;

  clearTimeout(dGesture.timer);

  dGesture.row.classList.remove('holding');

  if (dGesture.fired) {
    suppressClickUntil = Date.now() + 350;
  }

  dGesture = null;
}

drawerBody.addEventListener('touchend', finishDGesture, {
  passive: true
});

drawerBody.addEventListener('touchcancel', finishDGesture, {
  passive: true
});

/* ---------- Global edge gestures (Obsidian style) ---------- */
let edgeStart = null;

document.addEventListener('touchstart', e => {
  if (
    homeView.hidden
    || !menuEl.hidden
    || !sheet.hidden
    || e.touches.length !== 1
  ) {
    return;
  }

  edgeStart = {
    x: e.touches[0].clientX,
    y: e.touches[0].clientY
  };
}, {
  passive: true
});

document.addEventListener('touchmove', e => {
  if (!edgeStart) return;

  const dx = e.touches[0].clientX - edgeStart.x;
  const dy = e.touches[0].clientY - edgeStart.y;

  const isDrawerOpen = drawer.classList.contains('open');

  if (!isDrawerOpen) {
    if (dx > 30 && dx > Math.abs(dy) * 1.5) {
      openDrawer();
      edgeStart = null;
    }
  } else {
    if (dx < -30 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      closeDrawer();
      edgeStart = null;
    }
  }
}, {
  passive: true
});

document.addEventListener('touchend', () => {
  edgeStart = null;
}, {
  passive: true
});

/* ---------- Overlays & Menu Handlers ---------- */
scrim.addEventListener('click', closeAllOverlays);

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeAllOverlays();
});

window.addEventListener('jot-storage-error', () => {
  setTimeout(() => {
    toast('Changes could not be saved. Free browser storage and try again.');
  }, 0);
});

menuEl.addEventListener('click', e => {
  const item = e.target.closest('[data-mi]');

  if (!item) return;

  const action = menuItems[Number(item.dataset.mi)];

  if (action?.fn) action.fn();

  closeMenu();
});

/* ---------- Home interactions ---------- */
filterRow.addEventListener('click', e => {
  const chip = e.target.closest('[data-chip]');

  if (!chip) return;

  if (chip.dataset.chip === 'notebooks') {
    nav({type:'notebooks'});
  } else if (chip.dataset.chip === 'tags') {
    nav({type:'tags'});
  } else {
    nav({
      type:'notes',
      filter:chip.dataset.chip
    });
  }
});

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

viewBtn.addEventListener('click', () => {
  db.prefs.viewMode =
    db.prefs.viewMode === 'grid'
      ? 'list'
      : 'grid';

  save();
  renderScreen();
});

sortBtn.addEventListener('click', () => {
  const s = db.prefs.sortBy;

  openSheet(
    'Sort notes',
    [
      ['default','Recently modified'],
      ['updatedOld','Least recently modified'],
      ['alphaAsc','Title A–Z'],
      ['alphaDesc','Title Z–A'],
      ['createdNew','Created newest'],
      ['createdOld','Created oldest'],
      ['viewedNew','Recently opened']
    ]
      .map(([id,label]) =>
        '<button class="sheet-item'
        + (s === id ? ' on' : '')
        + '" data-sort="'
        + id
        + '"><span class="nt-name">'
        + esc(label)
        + '</span>'
        + (s === id ? ic('check','tick') : '')
        + '</button>'
      )
      .join('')
  );
});

appMenuBtn.addEventListener('click', () => openMenu([
  {
    icon:'import',
    label:'Import Markdown',
    fn:() => mdImport.click()
  },
  {
    icon:'export',
    label:'Export all notes',
    fn:exportAllNotes
  },
  {
    icon:'gear',
    label:'Settings',
    fn:openSettings
  }
]));

/* ---------- Content interactions ---------- */
content.addEventListener('click', e => {
  if (Date.now() < suppressClickUntil) return;

  const swipeTrash = e.target.closest('[data-swipe-trash]');

  if (swipeTrash) {
    moveNoteToTrash(
      swipeTrash.dataset.swipeTrash,
      true
    );
    return;
  }

  const addf = e.target.closest('[data-addfolder]');

  if (addf) {
    createFolder(addf.dataset.addfolder || null);
    return;
  }

  if (selMode) {
    const op = e.target.closest('[data-open]');

    if (op) {
      toggleSelection(op.dataset.open);
    }

    return;
  }

  const trashNote = e.target.closest('[data-trow]');

  if (trashNote) {
    trashActionTarget = {
      type:'note',
      id:trashNote.dataset.trow
    };

    openTrashActions();
    return;
  }

  const trashFolder = e.target.closest('[data-tnb]');

  if (trashFolder) {
    trashActionTarget = {
      type:'folder',
      id:trashFolder.dataset.tnb
    };

    openTrashActions();
    return;
  }

  const tag = e.target.closest('[data-tag]');

  if (tag) {
    nav({
      type:'tag',
      tag:tag.dataset.tag
    });

    return;
  }

  const nb = e.target.closest('[data-nb]');

  if (nb) {
    nav({
      type:'notebook',
      id:nb.dataset.nb
    });

    return;
  }

  const op = e.target.closest('[data-open]');

  if (op) {
    openEditor(
      op.dataset.open,
      false,
      false
    );
  }
});

/* ---------- Mobile long-press / swipe on content ---------- */
let gesture = null;

content.addEventListener('touchstart', e => {
  if (
    selMode
    || e.touches.length !== 1
  ) {
    return;
  }

  const row = e.target.closest('.row');

  if (!row) return;

  const id = row.dataset.open;
  const nb = row.dataset.nb;

  if (!id && !nb) return;

  gesture = {
    row,
    wrap:row.closest('.swipe-wrap'),
    x:e.touches[0].clientX,
    y:e.touches[0].clientY,
    mode:'wait',
    fired:false
  };

  gesture.timer = setTimeout(() => {
    if (!gesture) return;

    gesture.fired = true;

    row.classList.remove('holding');

    if (id) {
      enterSelection(id);
    } else if (nb) {
      openFolderActions(
        nb,
        {
          x:gesture.x,
          y:gesture.y
        }
      );
    }

    if (navigator.vibrate) navigator.vibrate(20);
  }, 480);

  row.classList.add('holding');
}, {
  passive:true
});

content.addEventListener('touchmove', e => {
  if (!gesture) return;

  const t = e.touches[0];

  const dx = t.clientX - gesture.x;
  const dy = t.clientY - gesture.y;

  gesture.dx = dx;

  if (gesture.mode === 'wait') {
    if (
      Math.abs(dy) > 12
      || dx > 12
    ) {
      clearTimeout(gesture.timer);
      gesture.mode = 'dead';
      gesture.row.classList.remove('holding');
    }

    else if (
      dx < -12
      && gesture.wrap
      && !content.classList.contains('grid-view')
    ) {
      clearTimeout(gesture.timer);
      gesture.mode = 'swipe';
      gesture.row.classList.remove('holding');
      gesture.row.classList.add('dragging');
    }
  }

  if (gesture.mode === 'swipe') {
    e.preventDefault();

    gesture.row.style.transform =
      'translateX('
      + Math.max(
          -76,
          Math.min(0, dx)
        )
      + 'px)';
  }
}, {
  passive:false
});

function finishGesture() {
  if (!gesture) return;

  clearTimeout(gesture.timer);

  gesture.row.classList.remove('holding');

  if (gesture.mode === 'swipe') {
    gesture.row.classList.remove('dragging');
    gesture.row.style.transform = '';

    if (gesture.dx < -38) {
      content
        .querySelectorAll('.swipe-wrap.open')
        .forEach(w => {
          if (w !== gesture.wrap) {
            w.classList.remove('open');
          }
        });

      gesture.wrap.classList.add('open');
    } else {
      gesture.wrap.classList.remove('open');
    }

    suppressClickUntil = Date.now() + 300;
  }

  if (gesture.fired) {
    suppressClickUntil = Date.now() + 350;
  }

  gesture = null;
}

content.addEventListener(
  'touchend',
  finishGesture,
  {passive:true}
);

content.addEventListener(
  'touchcancel',
  finishGesture,
  {passive:true}
);

/* ---------- Folder actions ---------- */
function createFolder(parent) {
  const name = prompt(
    parent
      ? 'New subfolder name'
      : 'New folder name',
    ''
  );

  if (name === null) return;

  const clean = name.trim();

  if (!clean) {
    return toast('Folder name cannot be empty');
  }

  if (
    db.notebooks.some(
      n =>
        !n.trashed
        && n.parent === parent
        && n.name.toLowerCase() === clean.toLowerCase()
    )
  ) {
    return toast(
      'A folder with that name already exists here'
    );
  }

  const nb = {
    id:uid(),
    name:clean,
    parent:parent || null,
    open:false
  };

  db.notebooks.push(nb);

  if (parent) {
    const p = byNb(parent);

    if (p) p.open = true;
  }

  save();
  renderScreen();
  toast('Folder created');
}

function openFolderActions(id, pos = null) {
  folderActionTarget = id;

  const nb = byNb(id);

  if (!nb) return;

  openMenu([
    {
      icon:'tag',
      label:'Rename',
      fn:() => renameFolder(id)
    },
    {
      icon:'folder',
      label:'Move folder',
      fn:() => moveFolder(id)
    },
    {
      icon:'trash',
      label:'Move to Trash',
      danger:true,
      fn:() => trashFolder(id)
    }
  ], '', pos);
}

function renameFolder(id) {
  const nb = byNb(id);

  if (!nb) return;

  const name = prompt(
    'Rename folder',
    nb.name
  );

  if (name === null) return;

  const clean = name.trim();

  if (!clean) {
    return toast(
      'Folder name cannot be empty'
    );
  }

  if (
    db.notebooks.some(
      n =>
        n.id !== id
        && !n.trashed
        && n.parent === nb.parent
        && n.name.toLowerCase() === clean.toLowerCase()
    )
  ) {
    return toast(
      'A folder with that name already exists here'
    );
  }

  nb.name = clean;

  save();
  renderScreen();

  toast('Folder renamed');
}

function moveFolder(id) {
  const nb = byNb(id);

  if (!nb) return;

  const candidates =
    db.notebooks.filter(
      n =>
        !n.trashed
        && n.id !== id
        && !descSet(id).has(n.id)
    );

  const choices = [
    '(Root)',
    ...candidates.map(n => n.name)
  ];

  const answer = prompt(
    'Move folder to:\n\n'
    + choices
      .map((x,i) => i + '. ' + x)
      .join('\n'),
    '0'
  );

  if (answer === null) return;

  const index = Number(answer);

  if (
    !Number.isInteger(index)
    || index < 0
    || index >= choices.length
  ) {
    return toast('Invalid folder choice');
  }

  nb.parent =
    index === 0
      ? null
      : candidates[index - 1].id;

  save();
  renderScreen();

  toast('Folder moved');
}

function trashFolder(id) {
  const ids = descSet(id);
  const stamp = Date.now();

  db.notebooks.forEach(nb => {
    if (
      ids.has(nb.id)
      && !nb.trashed
    ) {
      nb.trashed = stamp;
      nb.trashedBy = id;
    }
  });

  db.notes.forEach(n => {
    if (
      ids.has(n.nb)
      && !n.trashed
    ) {
      n.trashed = stamp;
      n.trashedBy = id;
    }
  });

  save();

  if (
    screen.type === 'notebook'
    && ids.has(screen.id)
  ) {
    nav({
      type:'notes',
      filter:'all'
    });
  } else {
    renderScreen();
  }

  toast('Folder moved to Trash');
}

/* ---------- Trash ---------- */
function moveNoteToTrash(id, notify = true) {
  const n = byId(id);

  if (!n) return;

  n.trashed = Date.now();
  n.trashedBy = null;

  save();

  if (editing === id) {
    closeEditor();
  }

  if (notify) {
    renderScreen();
    toast('Note moved to Trash');
  }
}

function openTrashActions() {
  if (!trashActionTarget) return;

  const isNote =
    trashActionTarget.type === 'note';

  openSheet(
    'Trash',
    (isNote
      ? '<button class="sheet-item" data-tr-view>View</button>'
      : '')
    + '<button class="sheet-item" data-tr-restore>Restore</button>'
    + '<button class="sheet-item danger" data-tr-delete>Delete forever</button>'
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

  else {
    const nb = byNb(target.id);

    if (nb) {
      const legacyTrash =
        nb.trashedBy === undefined;

      const ids = new Set([nb.id]);

      if (legacyTrash) {
        (function walk(p) {
          db.notebooks
            .filter(
              x =>
                x.trashed
                && x.parent === p
            )
            .forEach(x => {
              ids.add(x.id);
              walk(x.id);
            });
        })(nb.id);
      }

      else {
        db.notebooks.forEach(x => {
          if (x.trashedBy === nb.id) {
            ids.add(x.id);
          }
        });
      }

      db.notebooks.forEach(x => {
        if (ids.has(x.id)) {
          x.trashed = 0;
          delete x.trashedBy;
        }
      });

      db.notes.forEach(n => {
        if (
          (legacyTrash && ids.has(n.nb))
          || n.trashedBy === nb.id
        ) {
          n.trashed = 0;
          delete n.trashedBy;
        }
      });

      save();
    }
  }

  trashActionTarget = null;

  renderScreen();

  toast('Restored');
}

function deleteForever(target) {
  if (target.type === 'note') {
    db.notes =
      db.notes.filter(
        n => n.id !== target.id
      );
  }

  else {
    const root = byNb(target.id);

    const legacyTrash =
      root?.trashedBy === undefined;

    const ids = new Set([target.id]);

    if (legacyTrash) {
      (function walk(p) {
        db.notebooks
          .filter(
            x =>
              x.trashed
              && x.parent === p
          )
          .forEach(x => {
            ids.add(x.id);
            walk(x.id);
          });
      })(target.id);
    }

    else {
      db.notebooks.forEach(x => {
        if (x.trashedBy === target.id) {
          ids.add(x.id);
        }
      });
    }

    db.notes =
      db.notes.filter(
        n =>
          legacyTrash
            ? !ids.has(n.nb)
            : n.trashedBy !== target.id
      );

    db.notebooks =
      db.notebooks.filter(
        n => !ids.has(n.id)
      );
  }

  save();

  trashActionTarget = null;

  renderScreen();

  toast('Deleted permanently');
}

/* ---------- Editor ---------- */
function applyNoteTheme(n) {
  editorScroll.className =
    'editor-scroll bg-'
    + (n.color || 'white');
}

function openEditor(
  id,
  focusTitle = false,
  readonly = false
) {
  const n = byId(id);

  if (!n) return;

  editing = id;
  editingReadonly = !!readonly;

  n.viewed = Date.now();
  save();

  titleInput.value = n.title || '';
  bodyInput.innerHTML = n.body || '';

  titleInput.disabled = editingReadonly;

  bodyInput.contentEditable =
    editingReadonly
      ? 'false'
      : 'true';

  fmtbar.hidden = editingReadonly;
  editMenuBtn.hidden = editingReadonly;

  editTitleBar.textContent =
    titleInput.value.trim()
      || 'Untitled';

  setSave(
    editingReadonly
      ? 'In Trash'
      : 'Saved'
  );

  applyNoteTheme(n);

  document.documentElement.style.setProperty(
    '--editor-zoom',
    (n.zoom || 100) / 100
  );

  homeView.hidden = true;
  editView.hidden = false;

  closeAllOverlays();

  checkFormatStates();

  if (!editingReadonly) {
    const target =
      focusTitle
        ? titleInput
        : bodyInput;

    requestAnimationFrame(() => {
      target.focus({
        preventScroll:true
      });
    });
  }
}

function closeEditor() {
  clearTimeout(saveTimer);

  commit();

  editView.hidden = true;
  homeView.hidden = false;

  editing = null;
  editingReadonly = false;

  document.documentElement.style.setProperty(
    '--editor-zoom',
    '1'
  );

  renderScreen();
}

function setSave(text) {
  saveState.textContent = text;

  saveState.classList.toggle(
    'saving',
    text !== 'Saved'
    && text !== 'In Trash'
  );
}

function commit() {
  if (!editing || editingReadonly) return;

  const n = byId(editing);

  if (!n) return;

  const title =
    titleInput.value.trim();

  const body =
    sanitize(bodyInput.innerHTML);

  if (
    n.title !== title
    || n.body !== body
  ) {
    n.title = title;
    n.body = body;
    n.updated = Date.now();

    if (!save()) {
      setSave('Storage full');
      return;
    }
  }

  setSave('Saved');
}

function scheduleSave() {
  setSave('Saving…');

  clearTimeout(saveTimer);

  saveTimer =
    setTimeout(commit, 450);
}

backBtn.addEventListener(
  'click',
  () => {
    commit();
    closeEditor();
  }
);

titleInput.addEventListener(
  'input',
  () => {
    editTitleBar.textContent =
      titleInput.value.trim()
      || 'Untitled';

    scheduleSave();
  }
);

bodyInput.addEventListener(
  'input',
  () => {
    scheduleSave();
    checkFormatStates();
  }
);

window.addEventListener(
  'pagehide',
  commit
);

document.addEventListener(
  'visibilitychange',
  () => {
    if (document.visibilityState === 'hidden') {
      commit();
    }
  }
);

bodyInput.addEventListener(
  'click',
  e => {
    const cb =
      e.target.closest('.cb');

    if (!cb || editingReadonly) {
      return;
    }

    const li = cb.closest('li');

    if (!li) return;

    li.classList.toggle(
      'done'
    );

    scheduleSave();
  }
);

function checkFormatStates() {
  if (!editing || editingReadonly) {
    return;
  }

  const commands = [
    ['bold','bold'],
    ['italic','italic'],
    ['underline','underline'],
    ['insertUnorderedList','ul'],
    ['insertOrderedList','ol']
  ];

  commands.forEach(
    ([cmd,key]) => {
      const btn =
        $(`.fmt-btn[data-cmd="${key}"]`);

      if (!btn) return;

      let active = false;

      try {
        active =
          document.queryCommandState(cmd);
      } catch {}

      btn.classList.toggle(
        'active',
        active
      );
    }
  );

  const h =
    $('.fmt-btn[data-cmd="heading"]');

  if (h) {
    let value = '';

    try {
      value =
        (
          document.queryCommandValue(
            'formatBlock'
          ) || ''
        ).toUpperCase();
    } catch {}

    h.classList.toggle(
      'active',
      /^H[1-4]$/.test(value)
    );
  }
}

document.addEventListener(
  'selectionchange',
  checkFormatStates
);

function execFormat(
  name,
  value = null
) {
  bodyInput.focus();

  try {
    document.execCommand(
      name,
      false,
      value
    );
  } catch (e) {
    return;
  }

  scheduleSave();
  checkFormatStates();
}

fmtbar.addEventListener(
  'click',
  e => {
    const b =
      e.target.closest('.fmt-btn');

    if (!b || editingReadonly) {
      return;
    }

    const c = b.dataset.cmd;

    if (
      c === 'bold'
      || c === 'italic'
      || c === 'underline'
    ) {
      execFormat(c);
    }

    else if (c === 'ul') {
      execFormat(
        'insertUnorderedList'
      );
    }

    else if (c === 'ol') {
      execFormat(
        'insertOrderedList'
      );
    }

    else if (c === 'heading') {
      let v = '';

      try {
        v =
          (
            document.queryCommandValue(
              'formatBlock'
            ) || ''
          ).toLowerCase();
      } catch {}

      execFormat(
        'formatBlock',
        v === 'h2'
          ? 'h3'
          : v === 'h3'
            ? 'p'
            : 'h2'
      );
    }

    else if (c === 'check') {
      execFormat(
        'insertHTML',
        '<ul class="cl"><li>'
        + '<span class="cb" contenteditable="false"></span>'
        + '&#8203;</li></ul><p><br></p>'
      );
    }

    else if (c === 'link') {
      const url =
        prompt(
          'Link URL',
          'https://'
        );

      if (
        url
        && /^(https?:\/\/|mailto:)/i.test(
          url.trim()
        )
      ) {
        execFormat(
          'createLink',
          url.trim()
        );
      }

      else if (url) {
        toast(
          'Use a valid http(s) or mailto link'
        );
      }
    }

    else if (c === 'more') {
      openMoreFormatting();
    }
  }
);

function openMoreFormatting() {
  openSheet(
    'More formatting',
    '<button class="sheet-item" data-format="quote">Blockquote</button>'
    + '<button class="sheet-item" data-format="code">Code block</button>'
    + '<button class="sheet-item" data-format="clear">Clear formatting</button>'
  );
}

/* ---------- Note menus ---------- */
editMenuBtn.addEventListener(
  'click',
  () => {
    const n = byId(editing);

    if (!n) return;

    openMenu([
      {
        icon:'sun',
        label:'Note color',
        fn:() =>
          openSheet(
            'Note color',
            COLORS
              .map(
                c =>
                  '<button class="sheet-item color-choice'
                  + (n.color === c.id ? ' on' : '')
                  + '" data-nt="'
                  + c.id
                  + '"><span class="swatch sw-'
                  + c.id
                  + '"></span><span class="nt-name">'
                  + esc(c.name)
                  + '</span>'
                  + (
                    n.color === c.id
                      ? ic('check','tick')
                      : ''
                  )
                  + '</button>'
              )
              .join('')
          )
      },

      {
        icon:'tag',
        label:'Edit tags',
        fn:() => editTags(n)
      },

      {
        icon:'heading',
        label:'Text size',
        fn:() => openTextSize(n)
      },

      {
        icon:'star',
        label:
          n.fav
            ? 'Remove favorite'
            : 'Add to favorites',
        fn:() => {
          n.fav = !n.fav;
          save();

          toast(
            n.fav
              ? 'Added to favorites'
              : 'Removed from favorites'
          );
        }
      },

      {
        icon:'pin',
        label:
          n.pinned
            ? 'Unpin note'
            : 'Pin note',
        fn:() => {
          n.pinned = !n.pinned;
          save();

          toast(
            n.pinned
              ? 'Pinned'
              : 'Unpinned'
          );
        }
      },

      {
        icon:'trash',
        label:'Move to Trash',
        danger:true,
        fn:() => {
          moveNoteToTrash(
            n.id,
            true
          );
        }
      }
    ]);
  }
);

function editTags(note) {
  const value =
    prompt(
      'Tags (separate with commas)',
      (note.tags || []).join(', ')
    );

  if (value === null) return;

  note.tags =
    normalizeTags(value);

  save();
  renderScreen();

  toast(
    note.tags.length
      ? 'Tags updated'
      : 'Tags cleared'
  );
}

function openTextSize(note) {
  openSheet(
    'Text size',
    ZOOMS
      .map(
        zoom =>
          '<button class="sheet-item'
          + (
            note.zoom === zoom
              ? ' on'
              : ''
          )
          + '" data-zoom="'
          + zoom
          + '"><span class="nt-name">'
          + (
            zoom === 100
              ? 'Default'
              : zoom + '%'
          )
          + '</span>'
          + (
            note.zoom === zoom
              ? ic('check','tick')
              : ''
          )
          + '</button>'
      )
      .join('')
  );
}

/* ---------- Sheets ---------- */
sheetContent.addEventListener(
  'click',
  e => {
    const t =
      e.target.closest(
        '[data-theme-choice]'
      );

    if (t) {
      db.prefs.theme =
        t.dataset.themeChoice;

      save();
      applyTheme();
      openSettings();

      return;
    }

    const a =
      e.target.closest('[data-action]');

    if (a) {
      if (a.dataset.action === 'export') {
        exportAllNotes();
      }

      if (a.dataset.action === 'import') {
        mdImport.click();
      }

      return;
    }

    const sort =
      e.target.closest('[data-sort]');

    if (sort) {
      db.prefs.sortBy =
        sort.dataset.sort;

      save();
      closeSheet();
      renderScreen();

      return;
    }

    const nt =
      e.target.closest('[data-nt]');

    if (nt && editing) {
      const n = byId(editing);

      if (n) {
        n.color =
          nt.dataset.nt;

        save();
        applyNoteTheme(n);
        closeSheet();
      }

      return;
    }

    const startPlace =
      e.target.closest(
        '[data-start-place]'
      );

    if (startPlace) {
      db.prefs.startPlace =
        startPlace.dataset.startPlace === 'newNote'
          ? 'newNote'
          : 'home';

      save();
      openSettings();

      return;
    }

    const zoom =
      e.target.closest('[data-zoom]');

    if (zoom && editing) {
      const n = byId(editing);

      if (n) {
        n.zoom =
          Number(zoom.dataset.zoom);

        save();

        document.documentElement.style.setProperty(
          '--editor-zoom',
          n.zoom / 100
        );

        closeSheet();
      }

      return;
    }

    const fo =
      e.target.closest('[data-fo]');

    if (fo && folderActionTarget) {
      const id =
        folderActionTarget;

      closeSheet();

      if (fo.dataset.fo === 'rename') {
        renameFolder(id);
      }

      if (fo.dataset.fo === 'move') {
        moveFolder(id);
      }

      if (fo.dataset.fo === 'delete') {
        trashFolder(id);
      }

      folderActionTarget = null;

      return;
    }

    if (
      e.target.closest(
        '[data-tr-restore]'
      )
      && trashActionTarget
    ) {
      const t =
        trashActionTarget;

      closeSheet();
      restoreTrash(t);

      return;
    }

    if (
      e.target.closest(
        '[data-tr-delete]'
      )
      && trashActionTarget
    ) {
      const t =
        trashActionTarget;

      closeSheet();
      deleteForever(t);

      return;
    }

    if (
      e.target.closest(
        '[data-tr-view]'
      )
      && trashActionTarget?.type === 'note'
    ) {
      const t =
        trashActionTarget;

      trashActionTarget = null;

      closeSheet();

      openEditor(
        t.id,
        false,
        true
      );

      return;
    }

    const format =
      e.target.closest('[data-format]');

    if (format) {
      closeSheet();

      if (
        format.dataset.format === 'quote'
      ) {
        execFormat(
          'formatBlock',
          'blockquote'
        );
      }

      else if (
        format.dataset.format === 'code'
      ) {
        execFormat(
          'formatBlock',
          'pre'
        );
      }

      else if (
        format.dataset.format === 'clear'
      ) {
        execFormat(
          'removeFormat'
        );
      }
    }
  }
);

/* ---------- Create / import / export ---------- */
function createNote() {
  const now = Date.now();

  const note = {
    id:uid(),
    title:'',
    body:'',
    created:now,
    updated:now,
    viewed:now,
    pinned:false,
    fav:false,
    nb:
      screen.type === 'notebook'
        ? screen.id
        : null,
    tags:
      screen.type === 'tag'
        ? [screen.tag]
        : [],
    color:'white',
    zoom:100
  };

  db.notes.push(note);

  save();

  openEditor(
    note.id,
    true,
    false
  );
}

fab.addEventListener(
  'click',
  createNote
);

mdImport.addEventListener(
  'change',
  async () => {
    const files =
      Array.from(
        mdImport.files || []
      );

    if (!files.length) return;

    let count = 0;
    let failed = 0;

    for (const file of files) {
      try {
        const text =
          await file.text();

        if (
          file.name
            .toLowerCase()
            .endsWith('.json')
        ) {
          count +=
            importBackup(
              JSON.parse(text)
            );
        }

        else {
          const note = {
            id:uid(),
            title:
              file.name.replace(
                /\.md$/i,
                ''
              ),
            body:'',
            created:Date.now(),
            updated:Date.now(),
            viewed:Date.now(),
            pinned:false,
            fav:false,
            nb:
              screen.type === 'notebook'
                ? screen.id
                : null,
            tags:[],
            color:'white',
            zoom:100
          };

          applyMd(
            note,
            text
          );

          if (!note.title) {
            note.title =
              file.name.replace(
                /\.md$/i,
                ''
              )
              || 'Untitled';
          }

          db.notes.push(note);

          count++;
        }
      }

      catch {
        failed++;
      }
    }

    save();

    mdImport.value = '';

    renderScreen();

    toast(
      countLabel(
        count,
        'item'
      )
      + ' imported'
      + (
        failed
          ? '; '
            + countLabel(
                failed,
                'file'
              )
            + ' could not be read'
          : ''
      )
    );
  }
);

function importBackup(payload) {
  const isBackup =
    payload
    && payload.format === 'take-fast-notes-backup'
    && Array.isArray(payload.notes)
    && Array.isArray(payload.notebooks);

  const isLegacy =
    Array.isArray(payload);

  if (!isBackup && !isLegacy) {
    throw new Error(
      'Unsupported backup'
    );
  }

  const sourceNotes =
    isBackup
      ? payload.notes
      : payload;

  const sourceFolders =
    isBackup
      ? payload.notebooks
      : [];

  const folderMap =
    new Map();

  const importedFolders = [];

  sourceFolders.forEach(
    (folder,index) => {
      if (
        !folder
        || typeof folder.name !== 'string'
      ) {
        return;
      }

      const oldId =
        String(
          folder.id
          ?? 'folder-' + index
        );

      const id = uid();

      folderMap.set(
        oldId,
        id
      );

      importedFolders.push({
        id,
        name:
          folder.name.trim()
          || 'Untitled folder',
        parent:
          folder.parent,
        open:false
      });
    }
  );

  const legacyFolders =
    new Map();

  if (isLegacy) {
    sourceNotes.forEach(
      note => {
        const name =
          String(
            note?.folder || ''
          ).trim();

        if (
          name
          && !legacyFolders.has(name)
        ) {
          const id = uid();

          legacyFolders.set(
            name,
            id
          );

          importedFolders.push({
            id,
            name,
            parent:null,
            open:false
          });
        }
      }
    );
  }

  importedFolders.forEach(
    folder => {
      if (isBackup) {
        folder.parent =
          folderMap.get(
            String(folder.parent)
          )
          || null;
      }

      db.notebooks.push(folder);
    }
  );

  let imported = 0;

  sourceNotes.forEach(
    source => {
      if (
        !source
        || typeof source !== 'object'
      ) {
        return;
      }

      const now = Date.now();

      const created =
        Number(source.created)
        || now;

      const updated =
        Number(source.updated)
        || created;

      const color =
        COLORS.some(
          item =>
            item.id === source.color
        )
          ? source.color
          : 'white';

      const zoom =
        ZOOMS.includes(
          Number(source.zoom)
        )
          ? Number(source.zoom)
          : 100;

      db.notes.push({
        id:uid(),
        title:
          String(
            source.title || ''
          ),
        body:
          source.body !== undefined
            ? sanitize(
                String(source.body)
              )
            : mdToHtml(
                source.markdown || ''
              ),
        created,
        updated,
        viewed:
          Number(source.viewed)
          || updated,
        pinned:
          !!source.pinned,
        fav:
          !!source.fav,
        nb:
          isBackup
            ? folderMap.get(
                String(source.nb)
              ) || null
            : legacyFolders.get(
                String(
                  source.folder || ''
                ).trim()
              ) || null,
        tags:
          normalizeTags(
            source.tags
          ),
        color,
        zoom
      });

      imported++;
    }
  );

  return imported;
}

function downloadBlob(
  name,
  contentText,
  type = 'text/plain'
) {
  const blob =
    new Blob(
      [contentText],
      {type}
    );

  const url =
    URL.createObjectURL(blob);

  const a =
    document.createElement('a');

  a.href = url;
  a.download = name;

  document.body.appendChild(a);

  a.click();

  a.remove();

  setTimeout(
    () =>
      URL.revokeObjectURL(url),
    1000
  );
}

function exportAllNotes() {
  const payload = {
    format:
      'take-fast-notes-backup',

    version:1,

    exportedAt:
      new Date().toISOString(),

    notebooks:
      db.notebooks
        .filter(n => !n.trashed)
        .map(
          n => ({
            id:n.id,
            name:n.name,
            parent:n.parent || null
          })
        ),

    notes:
      db.notes
        .filter(n => !n.trashed)
        .map(
          n => ({
            id:n.id,
            title:n.title,
            body:n.body,
            created:n.created,
            updated:n.updated,
            viewed:n.viewed,
            pinned:!!n.pinned,
            fav:!!n.fav,
            nb:n.nb || null,
            tags:
              normalizeTags(
                n.tags
              ),
            color:
              n.color || 'white',
            zoom:
              n.zoom || 100
          })
        )
  };

  downloadBlob(
    'take-fast-notes-export-'
      + new Date()
          .toISOString()
          .slice(0,10)
      + '.json',
    JSON.stringify(
      payload,
      null,
      2
    ),
    'application/json'
  );

  toast('Export started');
}

/* ---------- Settings ---------- */
function openSettings() {
  const theme =
    db.prefs.theme
    || 'light';

  const startPlace =
    db.prefs.startPlace === 'newNote'
      ? 'newNote'
      : 'home';

  openSheet(
    'Settings',

    '<div class="settings-group">'
    + '<div class="settings-label">Theme</div>'
    + '<div class="seg">'
    + [
        'light',
        'dark',
        'system'
      ]
      .map(
        t =>
          '<button class="'
          + (
            theme === t
              ? 'on'
              : ''
          )
          + '" type="button" data-theme-choice="'
          + t
          + '">'
          + t[0].toUpperCase()
          + t.slice(1)
          + '</button>'
      )
      .join('')
    + '</div>'
    + '</div>'

    + '<div class="settings-group">'
    + '<div class="settings-label">Default start place</div>'

    + '<div class="settings-choice">'

    + '<button class="setting-choice'
    + (
      startPlace === 'home'
        ? ' on'
        : ''
    )
    + '" type="button" data-start-place="home">'

    + '<span>'
    + '<strong>Home screen</strong>'
    + '<small>Open the normal notes screen when the app starts.</small>'
    + '</span>'

    + (
      startPlace === 'home'
        ? ic('check','tick')
        : ''
    )

    + '</button>'

    + '<button class="setting-choice'
    + (
      startPlace === 'newNote'
        ? ' on'
        : ''
    )
    + '" type="button" data-start-place="newNote">'

    + '<span>'
    + '<strong>New note</strong>'
    + '<small>Open a fresh note immediately when the app starts.</small>'
    + '</span>'

    + (
      startPlace === 'newNote'
        ? ic('check','tick')
        : ''
    )

    + '</button>'

    + '</div>'
    + '</div>'

    + '<div class="settings-group">'
    + '<div class="settings-label">Storage</div>'
    + '<div class="sheet-note">Notes are stored locally in this browser/device. Clearing site data can remove them.</div>'
    + '</div>'

    + '<button class="sheet-item" data-action="export">'
    + ic('export')
    + '<span class="nt-name">Export all notes</span>'
    + '</button>'

    + '<button class="sheet-item" data-action="import">'
    + ic('import')
    + '<span class="nt-name">Import Markdown files</span>'
    + '</button>'
  );
}

function applyTheme() {
  const dark =
    db.prefs.theme === 'dark'
    || (
      db.prefs.theme === 'system'
      && matchMedia(
        '(prefers-color-scheme: dark)'
      ).matches
    );

  document.documentElement.dataset.theme =
    dark
      ? 'dark'
      : 'light';

  const meta =
    $('meta[name="theme-color"]');

  if (meta) {
    meta.setAttribute(
      'content',
      dark
        ? '#171614'
        : '#F7F5F1'
    );
  }
}

const colorScheme =
  matchMedia(
    '(prefers-color-scheme: dark)'
  );

const onColorSchemeChange =
  () => {
    if (
      db.prefs.theme === 'system'
    ) {
      applyTheme();
    }
  };

if (colorScheme.addEventListener) {
  colorScheme.addEventListener(
    'change',
    onColorSchemeChange
  );
}

else if (colorScheme.addListener) {
  colorScheme.addListener(
    onColorSchemeChange
  );
}

/* ---------- Visual viewport / Android keyboard ---------- */
function updateKeyboardInset() {
  if (!window.visualViewport) {
    document.documentElement.style.setProperty(
      '--keyboard',
      '0px'
    );

    return;
  }

  const vv =
    visualViewport;

  const keyboard =
    Math.max(
      0,
      window.innerHeight
      - vv.height
      - vv.offsetTop
    );

  document.documentElement.style.setProperty(
    '--keyboard',
    keyboard + 'px'
  );

  if (
    editing
    && !editingReadonly
    && document.activeElement === bodyInput
  ) {
    requestAnimationFrame(
      () => {
        const r =
          bodyInput.getBoundingClientRect();

        const safeBottom =
          vv.height
          + vv.offsetTop
          - 12;

        if (
          r.bottom > safeBottom
        ) {
          editorScroll.scrollTop +=
            r.bottom
            - safeBottom;
        }
      }
    );
  }
}

if (window.visualViewport) {
  visualViewport.addEventListener(
    'resize',
    updateKeyboardInset
  );

  visualViewport.addEventListener(
    'scroll',
    updateKeyboardInset
  );
}

window.addEventListener(
  'resize',
  updateKeyboardInset
);

/* ---------- Init ---------- */
function openDefaultStartPlace() {
  if (
    db.prefs.startPlace === 'newNote'
  ) {
    createNote();
    return;
  }

  renderScreen();
}

applyTheme();
updateKeyboardInset();
openDefaultStartPlace();