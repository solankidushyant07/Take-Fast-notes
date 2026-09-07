'use strict';

(() => {
  const F = window.TFNFeatures;

  const state = {
    read: false,
    wake: null,
    sliderTimer: null,
    selectionText: null
  };

  F.css(`
    .tfn-editor-extra{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:8px;
      padding:4px 18px calc(4px + env(safe-area-inset-bottom));
      color:var(--text-3);
      font-size:12px;
      background:var(--bg);
    }

    .tfn-editor-extra button{
      color:var(--text-2);
      padding:5px 8px;
      border-radius:8px;
    }

    .tfn-editor-extra button:active{
      background:var(--surface-card-active);
      color:var(--text);
    }

    .tfn-position{
      position:fixed;
      right:14px;
      top:72px;
      z-index:35;
      background:var(--surface);
      border:1px solid var(--border);
      border-radius:14px;
      padding:10px 12px;
      box-shadow:var(--shadow-card);
      display:flex;
      align-items:center;
      gap:8px;
    }

    .tfn-position input{
      width:120px;
      accent-color:var(--accent);
    }

    .tfn-position button{
      min-width:28px;
      height:28px;
      padding:0 7px;
      border-radius:8px;
      color:var(--text-2);
    }

    .tfn-selection{
      position:fixed;
      left:50%;
      bottom:calc(64px + env(safe-area-inset-bottom));
      transform:translateX(-50%);
      z-index:90;
      background:var(--surface);
      border:1px solid var(--border);
      border-radius:14px;
      padding:5px;
      display:flex;
      gap:3px;
      box-shadow:var(--shadow-card);
    }

    .tfn-selection button{
      padding:8px 10px;
      border-radius:9px;
      color:var(--text);
    }

    .tfn-selection button:active{
      background:var(--surface-card-active);
    }

    .tfn-read #bodyInput{
      user-select:text;
    }

    .tfn-read .fmtbar{
      display:none !important;
    }

    .tfn-read #titleInput{
      pointer-events:none;
    }
  `);

  function extraBar() {
    let element =
      $('#tfnEditorExtra');

    if (element) return element;

    element =
      document.createElement(
        'div'
      );

    element.id =
      'tfnEditorExtra';

    element.className =
      'tfn-editor-extra';

    element.innerHTML =
      '<span id="tfnCount">0 words · 0 characters</span>' +
      '<button id="tfnReadToggle" type="button">Read</button>';

    $('#noteZone')
      .appendChild(element);

    $('#tfnReadToggle')
      .addEventListener(
        'click',
        () => toggleRead()
      );

    return element;
  }

  function updateCount() {
    const text =
      plain(
        bodyInput.innerHTML
      );

    $('#tfnCount').textContent =
      `${F.words(text)} words · ${text.length} characters`;
  }

  function scrollKey() {
    return `tfn.scroll.${editing}`;
  }

  function saveScroll() {
    if (!editing) return;

    localStorage.setItem(
      scrollKey(),
      String(
        editorScroll.scrollTop
      )
    );
  }

  function restoreScroll() {
    const value =
      Number(
        localStorage.getItem(
          scrollKey()
        ) || 0
      );

    requestAnimationFrame(() => {
      const max =
        Math.max(
          0,
          editorScroll.scrollHeight -
          editorScroll.clientHeight
        );

      editorScroll.scrollTop =
        Math.max(
          0,
          Math.min(value, max)
        );
    });
  }

  function hideSlider() {
    const element =
      $('#tfnPosition');

    if (element) {
      element.hidden = true;
    }
  }

  function showSlider() {
    let box =
      $('#tfnPosition');

    if (!box) {
      box =
        document.createElement(
          'div'
        );

      box.id =
        'tfnPosition';

      box.className =
        'tfn-position';

      box.innerHTML =
        '<button id="tfnPositionTop" type="button">Top</button>' +
        '<input id="tfnPositionRange" type="range" min="0" max="100" value="0" aria-label="Note position">' +
        '<button id="tfnPositionClose" type="button" aria-label="Close">×</button>';

      document.body.appendChild(
        box
      );

      $('#tfnPositionTop')
        .addEventListener(
          'click',
          () => {
            editorScroll.scrollTop = 0;
            hideSlider();
          }
        );

      $('#tfnPositionRange')
        .addEventListener(
          'input',
          event => {
            const max =
              Math.max(
                0,
                editorScroll.scrollHeight -
                editorScroll.clientHeight
              );

            editorScroll.scrollTop =
              max *
              (
                Number(
                  event.target.value
                ) / 100
              );
          }
        );

      $('#tfnPositionClose')
        .addEventListener(
          'click',
          hideSlider
        );
    }

    const max =
      Math.max(
        1,
        editorScroll.scrollHeight -
        editorScroll.clientHeight
      );

    $('#tfnPositionRange').value =
      Math.round(
        editorScroll.scrollTop /
        max *
        100
      );

    box.hidden = false;

    clearTimeout(
      state.sliderTimer
    );

    state.sliderTimer =
      setTimeout(
        hideSlider,
        3800
      );
  }

  function toggleRead(force) {
    state.read =
      force === undefined
        ? !state.read
        : !!force;

    document.body.classList.toggle(
      'tfn-read',
      state.read
    );

    titleInput.disabled =
      state.read;

    bodyInput.contentEditable =
      state.read
        ? 'false'
        : 'true';

    fmtbar.hidden =
      state.read;

    $('#tfnReadToggle').textContent =
      state.read
        ? 'Edit'
        : 'Read';

    if (state.read) {
      releaseWake();
    }
  }

  async function toggleWake() {
    if (state.wake) {
      await state.wake
        .release()
        .catch(() => {});

      state.wake = null;

      toast(
        'Keep screen awake: Off'
      );

      return;
    }

    if (
      !('wakeLock' in navigator)
    ) {
      toast(
        'Keep screen awake is not supported here'
      );

      return;
    }

    try {
      state.wake =
        await navigator.wakeLock.request(
          'screen'
        );

      state.wake.addEventListener?.(
        'release',
        () => {
          state.wake = null;
        }
      );

      toast(
        'Keep screen awake: On'
      );
    } catch {
      toast(
        'Could not keep screen awake'
      );
    }
  }

  async function releaseWake() {
    if (!state.wake) return;

    await state.wake
      .release()
      .catch(() => {});

    state.wake = null;
  }

  function timestamp() {
    return new Date().toLocaleString(
      [],
      {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      }
    );
  }

  function insertTextAtCursor(text) {
    bodyInput.focus();

    document.execCommand(
      'insertText',
      false,
      text
    );

    scheduleSave();
    updateCount();
  }

  function insertTimestamp() {
    insertTextAtCursor(
      timestamp()
    );
  }

  function findReplace() {
    const find =
      prompt(
        'Find:',
        ''
      );

    if (
      find === null ||
      !find
    ) {
      return;
    }

    const replace =
      prompt(
        'Replace with:',
        ''
      );

    if (
      replace === null
    ) {
      return;
    }

    const caseSensitive =
      confirm(
        'Case-sensitive?'
      );

    const escaped =
      find.replace(
        /[.*+?^${}()|[\]\\]/g,
        '\\$&'
      );

    const regex =
      new RegExp(
        escaped,
        caseSensitive
          ? 'g'
          : 'gi'
      );

    const walker =
      document.createTreeWalker(
        bodyInput,
        NodeFilter.SHOW_TEXT
      );

    const nodes = [];

    let node;

    while (
      (node = walker.nextNode())
    ) {
      nodes.push(node);
    }

    nodes.forEach(textNode => {
      textNode.nodeValue =
        textNode.nodeValue.replace(
          regex,
          replace
        );
    });

    scheduleSave();
    updateCount();

    toast(
      'Replace complete'
    );
  }

  function linePrefix() {
    const selection =
      getSelection();

    if (
      !selection ||
      !selection.rangeCount
    ) {
      return '';
    }

    let node =
      selection.anchorNode;

    if (
      node?.nodeType ===
      Node.ELEMENT_NODE
    ) {
      node =
        node.childNodes[
          Math.max(
            0,
            selection.anchorOffset - 1
          )
        ] || node;
    }

    const text =
      (
        node?.textContent || ''
      ).slice(
        0,
        selection.anchorOffset
      );

    return (
      text
        .split(/\n|\u200b/)
        .pop() || ''
    );
  }

  /*
   * Automatic list continuation.
   */
  bodyInput.addEventListener(
    'keydown',
    event => {
      if (
        editingReadonly ||
        state.read
      ) {
        return;
      }

      if (
        event.key !== 'Enter'
      ) {
        return;
      }

      const selection =
        getSelection();

      const anchor =
        selection?.anchorNode
          ?.nodeType ===
        Node.TEXT_NODE
          ? selection.anchorNode.parentElement
          : selection?.anchorNode;

      const li =
        anchor?.closest?.('li');

      /*
       * Existing checklist.
       * Let the browser create the next <li>, then add its checkbox.
       */
      if (
        li?.parentElement
          ?.classList
          .contains('cl')
      ) {
        setTimeout(() => {
          const currentSelection =
            getSelection();

          const currentAnchor =
            currentSelection?.anchorNode
              ?.nodeType ===
            Node.TEXT_NODE
              ? currentSelection.anchorNode.parentElement
              : currentSelection?.anchorNode;

          const currentLi =
            currentAnchor?.closest?.('li');

          if (
            currentLi &&
            currentLi.parentElement
              ?.classList
              .contains('cl') &&
            !currentLi.querySelector(
              '.cb'
            )
          ) {
            const checkbox =
              document.createElement(
                'span'
              );

            checkbox.className =
              'cb';

            checkbox.contentEditable =
              'false';

            currentLi.insertBefore(
              checkbox,
              currentLi.firstChild
            );
          }
        }, 0);

        return;
      }

      const prefix =
        linePrefix();

      const numbered =
        prefix.match(
          /^\s*(\d+)\.\s+(.+)$/
        );

      const bullet =
        prefix.match(
          /^\s*[-*]\s+(.+)$/
        );

      const checkbox =
        prefix.match(
          /^\s*\[[ xX]\]\s+(.+)$/
        );

      if (
        !numbered &&
        !bullet &&
        !checkbox
      ) {
        if (
          localStorage.getItem(
            'tfn.autoTimestamp'
          ) === '1' &&
          !prefix.trim()
        ) {
          insertTimestamp();
        }

        return;
      }

      event.preventDefault();

      if (numbered) {
        document.execCommand(
          'insertHTML',
          false,
          `<div>${Number(numbered[1]) + 1}. </div>`
        );
      } else if (checkbox) {
        document.execCommand(
          'insertHTML',
          false,
          '<div>- [ ] </div>'
        );
      } else {
        document.execCommand(
          'insertHTML',
          false,
          '<div>- </div>'
        );
      }

      scheduleSave();
      updateCount();
    }
  );

  /*
   * Paste images directly into the note.
   */
  bodyInput.addEventListener(
    'paste',
    event => {
      const items =
        Array.from(
          event.clipboardData?.items || []
        );

      const image =
        items.find(
          item =>
            item.type.startsWith(
              'image/'
            )
        );

      if (!image) return;

      event.preventDefault();

      const file =
        image.getAsFile();

      if (!file) return;

      const reader =
        new FileReader();

      reader.onload = () => {
        bodyInput.focus();

        const src =
          String(
            reader.result
          ).replace(
            /"/g,
            '&quot;'
          );

        document.execCommand(
          'insertHTML',
          false,
          `<p><img class="tfn-pasted-image" src="${src}" alt="pasted image"></p>`
        );

        scheduleSave();
        updateCount();
      };

      reader.readAsDataURL(
        file
      );
    }
  );

  /*
   * Tap outside editor = dismiss keyboard.
   */
  document.addEventListener(
    'click',
    event => {
      if (editView.hidden) return;

      if (
        !event.target.closest('#noteZone') &&
        !event.target.closest('#fmtbar') &&
        !event.target.closest('.menu') &&
        !event.target.closest('.sheet')
      ) {
        document.activeElement?.blur();
      }
    }
  );

  /*
   * Remember scroll position.
   */
  editorScroll.addEventListener(
    'scroll',
    saveScroll
  );

  /*
   * Swipe down = temporary position slider.
   */
  let swipeStartY = 0;

  editorScroll.addEventListener(
    'touchstart',
    event => {
      if (
        event.touches.length === 1
      ) {
        swipeStartY =
          event.touches[0].clientY;
      }
    },
    { passive: true }
  );

  editorScroll.addEventListener(
    'touchmove',
    event => {
      if (
        event.touches.length !== 1
      ) {
        return;
      }

      const distance =
        event.touches[0].clientY -
        swipeStartY;

      if (distance > 45) {
        showSlider();

        swipeStartY =
          event.touches[0].clientY;
      }
    },
    { passive: true }
  );

  /*
   * Selection actions.
   */
  function selectionBar() {
    let bar =
      $('#tfnSelection');

    if (bar) return bar;

    bar =
      document.createElement(
        'div'
      );

    bar.id =
      'tfnSelection';

    bar.className =
      'tfn-selection';

    bar.hidden = true;

    bar.innerHTML =
      '<button data-selection-action="copy">Copy</button>' +
      '<button data-selection-action="cut">Cut</button>' +
      '<button data-selection-action="share">Share</button>' +
      '<button data-selection-action="move">Move to note</button>';

    document.body.appendChild(
      bar
    );

    bar.addEventListener(
      'mousedown',
      event =>
        event.preventDefault()
    );

    bar.addEventListener(
      'click',
      async event => {
        const button =
          event.target.closest(
            '[data-selection-action]'
          );

        if (!button) return;

        const selection =
          getSelection();

        if (
          !selection ||
          selection.isCollapsed
        ) {
          return;
        }

        const text =
          selection.toString();

        const action =
          button.dataset
            .selectionAction;

        if (
          action === 'copy'
        ) {
          try {
            await navigator.clipboard
              .writeText(text);

            toast('Copied');
          } catch {
            toast('Could not copy');
          }

          return;
        }

        if (
          action === 'cut'
        ) {
          document.execCommand(
            'cut'
          );

          scheduleSave();
          updateCount();

          return;
        }

        if (
          action === 'share'
        ) {
          await F.share(
            titleInput.value ||
            'Take Fast Notes',
            text
          );

          return;
        }

        if (
          action === 'move'
        ) {
          state.selectionText =
            text;

          openMoveSelectionSheet();
        }
      }
    );

    return bar;
  }

  function openMoveSelectionSheet() {
    const notes =
      db.notes.filter(
        note =>
          !note.trashed &&
          !note.private &&
          note.id !== editing
      );

    if (!notes.length) {
      toast(
        'No other notes'
      );

      return;
    }

    openSheet(
      'Move selection to note',
      notes
        .map(
          note =>
            `<button class="sheet-item" data-move-selection="${esc(note.id)}">
              ${ic('doc')}
              <span class="nt-name">
                ${esc(note.title || 'Untitled')}
              </span>
            </button>`
        )
        .join('')
    );
  }

  document.addEventListener(
    'selectionchange',
    () => {
      const bar =
        selectionBar();

      const selection =
        getSelection();

      const valid =
        editing &&
        !editingReadonly &&
        selection &&
        !selection.isCollapsed &&
        selection.rangeCount &&
        bodyInput.contains(
          selection.anchorNode
        ) &&
        selection.toString().trim();

      bar.hidden =
        !valid;
    }
  );

  sheetContent.addEventListener(
    'click',
    event => {
      const button =
        event.target.closest(
          '[data-move-selection]'
        );

      if (
        !button ||
        !state.selectionText
      ) {
        return;
      }

      const destination =
        byId(
          button.dataset
            .moveSelection
        );

      if (!destination) return;

      const selection =
        getSelection();

      if (
        !selection ||
        !selection.rangeCount
      ) {
        closeSheet();
        return;
      }

      selection
        .getRangeAt(0)
        .deleteContents();

      destination.body =
        (destination.body || '') +
        `<p>${esc(state.selectionText)}</p>`;

      save();
      closeSheet();

      state.selectionText =
        null;

      renderScreen();

      toast(
        'Moved to note'
      );
    }
  );

  /*
   * Editor wrapper.
   */
  const originalOpenEditor =
    window.openEditor;

  window.openEditor =
    async function (
      id,
      focusTitle = false,
      readonly = false
    ) {
      state.read = false;

      document.body.classList.remove(
        'tfn-read'
      );

      originalOpenEditor(
        id,
        focusTitle,
        readonly
      );

      extraBar();
      updateCount();
      restoreScroll();
    };

  const originalCloseEditor =
    window.closeEditor;

  window.closeEditor =
    async function () {
      saveScroll();

      toggleRead(false);

      await releaseWake();

      hideSlider();

      originalCloseEditor();
    };

  const originalCommit =
    window.commit;

  window.commit =
    function () {
      const result =
        originalCommit();

      updateCount();

      return result;
    };

  /*
   * Replace the existing editor menu listener with one combined menu.
   *
   * Capture phase runs before the existing listener from app.js.
   * This preserves every existing editor action while adding features.
   */
  editMenuBtn.addEventListener(
    'click',
    event => {
      event.stopImmediatePropagation();

      const note =
        byId(editing);

      if (!note) return;

      const items = [
        {
          icon: 'star',
          label:
            note.fav
              ? 'Remove favorite'
              : 'Add to favorites',
          fn: () => {
            note.fav =
              !note.fav;

            save();

            toast(
              note.fav
                ? 'Added to favorites'
                : 'Removed from favorites'
            );
          }
        },

        {
          icon: 'pin',
          label:
            note.pinned
              ? 'Unpin note'
              : 'Pin note',
          fn: () => {
            note.pinned =
              !note.pinned;

            save();
          }
        },

        {
          icon: 'sun',
          label: 'Note color',
          fn: () =>
            openNoteColorSheet(note)
        },

        {
          icon: 'heading',
          label: 'Editor zoom',
          fn: () =>
            openZoomSheet(note)
        },

        {
          icon: 'tag',
          label: 'Edit tags',
          fn: () =>
            editTags(note)
        },

        {
          icon: 'edit',
          label:
            state.read
              ? 'Edit mode'
              : 'Read mode',
          fn: () =>
            toggleRead()
        },

        {
          icon: 'sun',
          label:
            'Keep screen awake',
          fn: toggleWake
        },

        {
          icon: 'heading',
          label:
            'Find & Replace',
          fn: findReplace
        },

        {
          icon: 'clock',
          label:
            'Insert date / time',
          fn: insertTimestamp
        },

        {
          icon: 'clock',
          label:
            'Automatic timestamps: ' +
            (
              localStorage.getItem(
                'tfn.autoTimestamp'
              ) === '1'
                ? 'On'
                : 'Off'
            ),
          fn: () => {
            const on =
              localStorage.getItem(
                'tfn.autoTimestamp'
              ) === '1';

            localStorage.setItem(
              'tfn.autoTimestamp',
              on ? '0' : '1'
            );

            toast(
              `Automatic timestamps: ${on ? 'Off' : 'On'}`
            );
          }
        },

        ...(F.editMenuItems || []).map(
          item => ({
            icon: item.icon,
            label: item.label,
            fn: item.fn
          })
        ),

        {
          icon: 'trash',
          label:
            'Move to Trash',
          danger: true,
          fn: () =>
            moveNoteToTrash(
              note.id,
              true
            )
        }
      ];

      openMenu(items);
    },
    true
  );

  /*
   * Capture-phase back handling so our async cleanup
   * happens before the original back listener.
   */
  backBtn.addEventListener(
    'click',
    event => {
      event.stopImmediatePropagation();

      window.closeEditor?.();
    },
    true
  );

  document.addEventListener(
    'visibilitychange',
    () => {
      if (document.hidden) {
        releaseWake();
      }
    }
  );

  window.addEventListener(
    'pagehide',
    releaseWake
  );

  window.addEventListener(
    'load',
    () => {
      extraBar();
    }
  );
})();