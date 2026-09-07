'use strict';

(() => {
  const F = window.TFNFeatures;

  let caseSensitive = false;

  const index =
    new Map();

  F.css(`
    .tfn-search-opt{
      width:32px;
      height:32px;
      border-radius:9px;
      display:grid;
      place-items:center;
      color:var(--text-2);
      flex:0 0 32px;
      font-size:12px;
      font-weight:700;
    }

    .tfn-search-opt.on{
      color:var(--accent);
      background:var(--accent-soft);
    }
  `);

  function rebuildIndex() {
    index.clear();

    db.notes.forEach(note => {
      if (!note?.id) return;

      index.set(
        note.id,
        `${note.title || ''}
${plain(note.body || '')}
${(note.tags || []).join(' ')}`
      );
    });
  }

  rebuildIndex();

  const originalSave =
    window.save;

  window.save =
    function () {
      const result =
        originalSave();

      rebuildIndex();

      return result;
    };

  const button =
    document.createElement(
      'button'
    );

  button.id =
    'tfnSearchOptions';

  button.className =
    'tfn-search-opt';

  button.type =
    'button';

  button.textContent =
    'Aa';

  button.title =
    'Case-sensitive search';

  searchContainer
    .querySelector('.searchbar')
    .appendChild(button);

  button.addEventListener(
    'click',
    () => {
      caseSensitive =
        !caseSensitive;

      button.classList.toggle(
        'on',
        caseSensitive
      );

      renderSearch();
    }
  );

  const originalRender =
    window.renderContent;

  function inScope(note) {
    if (
      note.trashed ||
      note.private ||
      note.archived
    ) {
      return false;
    }

    if (
      currentTab === 'tasks'
    ) {
      return noteHasTasks(note);
    }

    if (
      screen.type === 'notebook'
    ) {
      return descSet(
        screen.id
      ).has(note.nb);
    }

    if (
      screen.type === 'tag'
    ) {
      return (
        note.tags || []
      ).includes(
        screen.tag
      );
    }

    if (
      screen.filter === 'favorites'
    ) {
      return note.fav;
    }

    if (
      screen.filter === 'pinned'
    ) {
      return (
        note.pinned &&
        !note.archived
      );
    }

    return true;
  }

  function renderSearch() {
    const query =
      searchInput.value.trim();

    if (
      !query ||
      !caseSensitive
    ) {
      return originalRender();
    }

    let notes =
      db.notes
        .filter(inScope)
        .filter(note =>
          (
            index.get(note.id) || ''
          ).includes(query)
        );

    notes =
      sortNotesList(notes);

    visibleIds =
      notes.map(
        note => note.id
      );

    content.classList.toggle(
      'grid-view',
      db.prefs.viewMode === 'grid'
    );

    content.innerHTML =
      notes.length
        ? notes.map(noteCard).join('')
        : empty(
            'search',
            'No matching notes',
            'Try a different search term.'
          );
  }

  searchInput.addEventListener(
    'input',
    event => {
      if (!caseSensitive) {
        return;
      }

      event.stopImmediatePropagation();

      renderSearch();
    },
    true
  );

  F.search = {
    isCaseSensitive:
      () => caseSensitive
  };
})();