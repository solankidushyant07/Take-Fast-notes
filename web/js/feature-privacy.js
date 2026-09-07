'use strict';

(() => {
  const F = window.TFNFeatures;

  F.privateUnlocked = false;

  F.css(`
    .tfn-private-view{
      position:fixed;
      inset:0;
      z-index:60;
      background:var(--bg);
      display:flex;
      flex-direction:column;
    }

    .tfn-private-content{
      overflow-y:auto;
      padding:12px 18px 96px;
    }

    .tfn-private-empty{
      text-align:center;
      color:var(--text-2);
      padding:48px 20px;
    }

    .tfn-lock-badge{
      font-size:11px;
      color:var(--accent);
      margin-left:6px;
    }

    .tfn-private-lock{
      position:fixed;
      left:50%;
      top:calc(env(safe-area-inset-top) + 54px);
      transform:translateX(-50%);
      z-index:70;
      width:42px;
      height:42px;
      border-radius:14px;
      background:var(--surface);
      border:1px solid var(--border);
      display:grid;
      place-items:center;
      color:var(--accent);
      box-shadow:var(--shadow-card);
    }
  `);

  async function hash(value) {
    const result =
      await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(value)
      );

    return Array.from(
      new Uint8Array(result)
    )
      .map(
        byte =>
          byte.toString(16).padStart(2, '0')
      )
      .join('');
  }

  async function authenticate() {
    const native = F.native();

    if (native?.authenticate) {
      try {
        await native.authenticate();
        return true;
      } catch {
        return false;
      }
    }

    let stored =
      localStorage.getItem('tfn.pin');

    if (!stored) {
      const first =
        prompt('Create a PIN for protected notes');

      if (first === null || !first) {
        return false;
      }

      const second =
        prompt('Confirm PIN');

      if (first !== second) {
        toast('PINs do not match');
        return false;
      }

      stored = await hash(first);

      localStorage.setItem(
        'tfn.pin',
        stored
      );

      toast('PIN created');

      return true;
    }

    const value = prompt('Enter PIN');

    if (value === null) return false;

    return (
      await hash(value)
    ) === stored;
  }

  F.authenticate = authenticate;

  /*
   * Lock indicator on note cards.
   */
  const originalNoteCard =
    window.noteCard;

  window.noteCard = function (note) {
    let html =
      originalNoteCard(note);

    if (note?.locked) {
      html = html.replace(
        '</div><div class="card-preview">',
        '<span class="tfn-lock-badge">Locked</span>' +
        '</div><div class="card-preview">'
      );
    }

    return html;
  };

  /*
   * Note locking.
   */
  F.editMenuItems.push({
    icon: 'lock',
    label: 'Lock note',
    fn: async () => {
      const note = F.currentNote();

      if (!note) return;

      if (note.locked) {
        note.locked = false;
        save();

        toast('Note unlocked');
        return;
      }

      if (await authenticate()) {
        note.locked = true;
        save();

        toast('Note locked');
      }
    }
  });

  /*
   * Private folder.
   */
  F.editMenuItems.push({
    icon: 'lock',
    label: 'Move to Private',
    fn: async () => {
      const note = F.currentNote();

      if (!note) return;

      if (!(await authenticate())) return;

      note.private = true;
      note.archived = false;

      save();

      toast('Moved to Private');

      history.back();
    }
  });

  /*
   * Locked notes require authentication before opening.
   * Private notes are allowed once the Private page has been unlocked.
   */
  const originalOpenEditor =
    window.openEditor;

  window.openEditor = async function (
    id,
    focusTitle = false,
    readonly = false
  ) {
    const note = byId(id);

    if (!note) return;

    if (
      note.private &&
      !F.privateUnlocked
    ) {
      return;
    }

    if (
      note.locked &&
      !(await authenticate())
    ) {
      return;
    }

    originalOpenEditor(
      id,
      focusTitle,
      readonly
    );
  };

  function privateView() {
    let view =
      $('#tfnPrivateView');

    if (view) return view;

    view =
      document.createElement('section');

    view.id = 'tfnPrivateView';
    view.className =
      'tfn-private-view';
    view.hidden = true;

    view.innerHTML =
      '<header class="topbar">' +
        '<button id="tfnPrivateBack" class="icon-btn" type="button">‹</button>' +
        '<h1 class="screen-title">Private</h1>' +
      '</header>' +
      '<section id="tfnPrivateContent" class="tfn-private-content"></section>';

    document.body.appendChild(view);

    $('#tfnPrivateBack')
      .addEventListener('click', () => {
        F.privateUnlocked = false;

        view.hidden = true;
        homeView.hidden = false;

        renderScreen();
      });

    return view;
  }

  function renderPrivate() {
    const target =
      $('#tfnPrivateContent');

    const notes =
      db.notes.filter(
        note =>
          note.private &&
          !note.trashed
      );

    target.innerHTML =
      notes.length
        ? notes.map(noteCard).join('')
        : '<div class="tfn-private-empty">No private notes.</div>';
  }

  async function showPrivate() {
    if (!(await authenticate())) return;

    F.privateUnlocked = true;

    const view =
      privateView();

    view.hidden = false;
    homeView.hidden = true;

    renderPrivate();
  }

  document.addEventListener('click', event => {
    const lock =
      event.target.closest(
        '#tfnPrivateLock'
      );

    if (lock) {
      showPrivate();
      return;
    }

    const card =
      event.target.closest(
        '#tfnPrivateContent .note-card'
      );

    if (card) {
      const id = card.dataset.open;

      if (id) {
        openEditor(
          id,
          false,
          false
        );
      }
    }
  });

  /*
   * Pull down from the top of Home.
   */
  let pullStartY = 0;
  let privateLock = null;

  homeView.addEventListener(
    'touchstart',
    event => {
      if (event.touches.length !== 1) return;

      pullStartY =
        event.touches[0].clientY;
    },
    { passive: true }
  );

  homeView.addEventListener(
    'touchmove',
    event => {
      if (event.touches.length !== 1) return;

      const distance =
        event.touches[0].clientY -
        pullStartY;

      if (distance < 60) return;

      if (!privateLock) {
        privateLock =
          document.createElement('button');

        privateLock.id =
          'tfnPrivateLock';

        privateLock.className =
          'tfn-private-lock';

        privateLock.type = 'button';

        privateLock.innerHTML =
          ic('lock');

        document.body.appendChild(
          privateLock
        );
      }

      privateLock.hidden = false;
    },
    { passive: true }
  );

  homeView.addEventListener(
    'touchend',
    () => {
      if (!privateLock) return;

      setTimeout(() => {
        if (privateLock) {
          privateLock.hidden = true;
        }
      }, 3000);
    },
    { passive: true }
  );
})();