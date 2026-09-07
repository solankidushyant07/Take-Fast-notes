'use strict';

(() => {
  const F = window.TFNFeatures;

  F.editMenuItems.push({
    icon: 'archive',
    label: 'Archive note',
    fn: () => {
      const note =
        F.currentNote();

      if (!note) return;

      note.archived =
        !note.archived;

      save();
      renderScreen();

      toast(
        note.archived
          ? 'Archived'
          : 'Unarchived'
      );
    }
  });

  F.editMenuItems.push({
    icon: 'export',
    label: 'Share note',
    fn: async () => {
      const note =
        F.currentNote();

      if (!note) return;

      await F.share(
        note.title || 'Take Fast Notes',
        plain(note.body)
      );
    }
  });

  F.editMenuItems.push({
    icon: 'folder',
    label: 'Move to Folder',
    fn: () => {
      const note =
        F.currentNote();

      if (!note) return;

      const html =
        `<button class="sheet-item" data-note-move="root">
          ${ic('doc')}
          <span class="nt-name">Home (Root)</span>
        </button>` +

        db.notebooks
          .filter(folder => !folder.trashed)
          .map(
            folder =>
              `<button class="sheet-item" data-note-move="${esc(folder.id)}">
                ${ic('folder')}
                <span class="nt-name">
                  ${esc(folderPath(folder.id).join(' / '))}
                </span>
              </button>`
          )
          .join('');

      openSheet(
        'Move to Folder',
        html
      );
    }
  });

  F.css(`
    .tfn-feature-pills{
      display:flex;
      gap:8px;
      overflow:auto;
      padding:0 18px 10px;
      scrollbar-width:none;
    }

    .tfn-feature-pills::-webkit-scrollbar{
      display:none;
    }

    .tfn-feature-pills button{
      height:36px;
      flex:0 0 auto;
      padding:0 14px;
      border-radius:20px;
      background:var(--surface-pill);
      color:var(--text-2);
    }

    .tfn-feature-pills button.on{
      background:#333;
      color:#fff;
    }
  `);

  function featurePills() {
    let element =
      $('#tfnFeaturePills');

    if (element) return element;

    element =
      document.createElement('div');

    element.id =
      'tfnFeaturePills';

    element.className =
      'tfn-feature-pills';

    filterRow.parentNode.insertBefore(
      element,
      filterRow.nextSibling
    );

    element.addEventListener(
      'click',
      event => {
        const button =
          event.target.closest(
            '[data-feature-filter]'
          );

        if (!button) return;

        nav({
          type: 'notes',
          filter:
            button.dataset
              .featureFilter
        });
      }
    );

    return element;
  }

  /*
   * Add Pinned / Archive without replacing
   * the existing folder category row.
   */
  const originalCategory =
    window.renderCategoryRow;

  window.renderCategoryRow =
    function () {
      originalCategory();

      const pills =
        featurePills();

      const filter =
        screen.filter || 'all';

      pills.innerHTML =
        `<button class="${filter === 'pinned' ? 'on' : ''}" data-feature-filter="pinned">Pinned</button>` +
        `<button class="${filter === 'archive' ? 'on' : ''}" data-feature-filter="archive">Archive</button>`;

      pills.hidden =
        screen.type !== 'notes' ||
        currentTab !== 'notes';
    };

  /*
   * Preserve existing renderer while excluding private/archive
   * notes from normal note screens.
   */
  const originalRenderContent =
    window.renderContent;

  window.renderContent =
    function () {
      if (
        screen.filter === 'pinned' ||
        screen.filter === 'archive'
      ) {
        let notes =
          db.notes.filter(
            note =>
              !note.trashed &&
              !note.private
          );

        if (
          screen.filter === 'pinned'
        ) {
          notes =
            notes.filter(
              note =>
                note.pinned &&
                !note.archived
            );
        } else {
          notes =
            notes.filter(
              note => note.archived
            );
        }

        const query =
          searchInput.value
            .trim()
            .toLowerCase();

        if (query) {
          notes =
            notes.filter(note =>
              `${note.title || ''} ${plain(note.body || '')} ${(note.tags || []).join(' ')}`
                .toLowerCase()
                .includes(query)
            );
        }

        notes =
          sortNotesList(notes);

        visibleIds =
          notes.map(note => note.id);

        content.classList.toggle(
          'grid-view',
          db.prefs.viewMode === 'grid'
        );

        content.innerHTML =
          notes.length
            ? notes.map(noteCard).join('')
            : empty(
                'doc',
                screen.filter === 'archive'
                  ? 'Archive is empty'
                  : 'No pinned notes',
                screen.filter === 'archive'
                  ? 'Archived notes stay here until restored.'
                  : 'Pin notes to keep them here.'
              );

        return;
      }

      if (
        screen.type !== 'trash' &&
        currentTab !== 'library'
      ) {
        const hidden =
          db.notes.filter(
            note =>
              !note.trashed &&
              (
                note.archived ||
                note.private
              )
          );

        hidden.forEach(note => {
          note.__tfnHidden =
            note.trashed;

          note.trashed =
            Date.now();
        });

        try {
          originalRenderContent();
        } finally {
          hidden.forEach(note => {
            note.trashed =
              note.__tfnHidden || 0;

            delete note.__tfnHidden;
          });
        }

        return;
      }

      originalRenderContent();
    };

  /*
   * Manual-only Trash retention.
   *
   * The old application can remove old trash at startup.
   * We preserve trashed items separately and restore them.
   */
  function readTrashBackup() {
    try {
      const value =
        JSON.parse(
          localStorage.getItem(
            'tfn.trash'
          ) || '[]'
        );

      return Array.isArray(value)
        ? value
        : [];
    } catch {
      return [];
    }
  }

  function writeTrashBackup() {
    try {
      localStorage.setItem(
        'tfn.trash',
        JSON.stringify([
          ...db.notes.filter(
            note => note.trashed
          ),
          ...db.notebooks.filter(
            folder => folder.trashed
          )
        ])
      );
    } catch {}
  }

  const originalMoveTrash =
    window.moveNoteToTrash;

  window.moveNoteToTrash =
    function (
      id,
      notify = true
    ) {
      const result =
        originalMoveTrash(
          id,
          notify
        );

      writeTrashBackup();

      return result;
    };

  const trashBackup =
    readTrashBackup();

  if (trashBackup.length) {
    const existingIds =
      new Set(
        [
          ...db.notes,
          ...db.notebooks
        ].map(item => item.id)
      );

    trashBackup.forEach(item => {
      if (existingIds.has(item.id)) {
        return;
      }

      if (
        Object.prototype.hasOwnProperty.call(
          item,
          'nb'
        )
      ) {
        db.notes.push(item);
      } else {
        db.notebooks.push(item);
      }
    });

    save();
  }

  const originalDeleteForever =
    window.deleteForever;

  window.deleteForever =
    function (target) {
      originalDeleteForever(target);
      writeTrashBackup();
    };

  /*
   * Empty Trash.
   */
  const originalRenderTrash =
    window.renderTrash;

  window.renderTrash =
    function () {
      originalRenderTrash();

      let button =
        $('#tfnEmptyTrash');

      if (!button) {
        button =
          document.createElement(
            'button'
          );

        button.id =
          'tfnEmptyTrash';

        button.className =
          'setting-choice';

        button.type =
          'button';

        button.innerHTML =
          '<span>' +
            '<strong>Empty Trash</strong>' +
            '<small>Permanently delete all trashed items</small>' +
          '</span>';

        button.addEventListener(
          'click',
          () => {
            if (
              !confirm(
                'Permanently delete everything in Trash?'
              )
            ) {
              return;
            }

            db.notes =
              db.notes.filter(
                note => !note.trashed
              );

            db.notebooks =
              db.notebooks.filter(
                folder => !folder.trashed
              );

            save();
            writeTrashBackup();
            renderScreen();

            toast(
              'Trash emptied'
            );
          }
        );
      }

      content.prepend(button);
    };

  /*
   * Move note from editor.
   */
  sheetContent.addEventListener(
    'click',
    event => {
      const button =
        event.target.closest(
          '[data-note-move]'
        );

      if (!button) return;

      const note =
        F.currentNote();

      if (!note) return;

      note.nb =
        button.dataset.noteMove === 'root'
          ? null
          : button.dataset.noteMove;

      save();
      closeSheet();
      renderScreen();

      toast('Note moved');
    }
  );

  /*
   * Merge selected notes.
   */
  let mergeButton =
    $('#selMerge');

  if (!mergeButton) {
    mergeButton =
      document.createElement(
        'button'
      );

    mergeButton.id =
      'selMerge';

    mergeButton.className =
      'icon-btn';

    mergeButton.type =
      'button';

    mergeButton.title =
      'Merge selected';

    mergeButton.innerHTML =
      ic('merge');

    $('.sel-actions')
      .insertBefore(
        mergeButton,
        $('#selTrash')
      );

    mergeButton.addEventListener(
      'click',
      mergeSelected
    );
  }

  function mergeSelected() {
    const notes =
      Array.from(selSet)
        .map(byId)
        .filter(
          note =>
            note &&
            !note.trashed &&
            !note.private
        );

    if (notes.length < 2) {
      toast(
        'Select at least 2 notes'
      );
      return;
    }

    const title =
      prompt(
        'Merged note title',
        'Merged Note'
      );

    if (title === null) return;

    const now =
      Date.now();

    db.notes.push({
      id: uid(),
      title:
        title.trim() ||
        'Merged Note',

      body:
        notes
          .map(note => note.body || '')
          .join('<p><br></p>'),

      created: now,
      updated: now,
      viewed: now,

      pinned: false,
      fav: false,

      nb: null,
      tags: [],

      color: 'white',
      zoom: 100,

      trashed: 0
    });

    save();
    exitSelection();
    renderScreen();

    toast('Notes merged');
  }
})();