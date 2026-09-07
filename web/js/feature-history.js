'use strict';

(() => {
  const F = window.TFNFeatures;

  const STORAGE_KEY =
    'tfn.versions.v1';

  const THRESHOLD_KEY =
    'tfn.versionThreshold';

  const session = {
    id: null,
    lastText: null,
    changedWords: 0
  };

  function readVersions() {
    try {
      const value =
        JSON.parse(
          localStorage.getItem(
            STORAGE_KEY
          ) || '{}'
        );

      return value &&
        typeof value === 'object'
        ? value
        : {};
    } catch {
      return {};
    }
  }

  function writeVersions(value) {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(value)
      );
    } catch {}
  }

  function threshold() {
    return Number(
      localStorage.getItem(
        THRESHOLD_KEY
      ) || 75
    );
  }

  function tokenCounts(text) {
    const map = new Map();

    const words =
      String(text || '')
        .toLowerCase()
        .match(/\S+/g) || [];

    words.forEach(word => {
      map.set(
        word,
        (map.get(word) || 0) + 1
      );
    });

    return map;
  }

  function wordDifference(a, b) {
    const A = tokenCounts(a);
    const B = tokenCounts(b);

    let difference = 0;

    for (const [word, count] of A) {
      difference += Math.abs(
        count - (B.get(word) || 0)
      );
    }

    for (const [word, count] of B) {
      if (!A.has(word)) {
        difference += count;
      }
    }

    return Math.ceil(
      difference / 2
    );
  }

  function saveVersion(note) {
    if (!note) return;

    const versions =
      readVersions();

    const list =
      Array.isArray(versions[note.id])
        ? versions[note.id]
        : [];

    list.push({
      at: Date.now(),
      title: note.title || 'Untitled',
      body: note.body || ''
    });

    while (list.length > 10) {
      list.shift();
    }

    versions[note.id] = list;

    writeVersions(versions);
  }

  /*
   * Begin one editing session.
   */
  const originalOpenEditor =
    window.openEditor;

  window.openEditor = async function (
    id,
    focusTitle = false,
    readonly = false
  ) {
    const note = byId(id);

    session.id = id;
    session.lastText =
      note ? plain(note.body) : '';

    session.changedWords = 0;

    const result =
      originalOpenEditor(
        id,
        focusTitle,
        readonly
      );

    if (editing !== id) {
      session.id = null;
      session.lastText = null;
      session.changedWords = 0;
    }

    return result;
  };

  /*
   * Accumulate changes during the session.
   */
  const originalCommit =
    window.commit;

  window.commit = function () {
    const note =
      F.currentNote();

    if (
      note &&
      session.id === note.id &&
      !editingReadonly
    ) {
      const current =
        plain(bodyInput.innerHTML);

      session.changedWords +=
        wordDifference(
          session.lastText || '',
          current
        );

      session.lastText = current;
    }

    return originalCommit();
  };

  /*
   * Store only when leaving the note and only if the
   * cumulative editing-session threshold was reached.
   */
  const originalCloseEditor =
    window.closeEditor;

  window.closeEditor = async function () {
    const note =
      F.currentNote();

    const shouldSave =
      session.changedWords >=
      threshold();

    const result =
      originalCloseEditor();

    if (shouldSave && note) {
      saveVersion(note);
    }

    session.id = null;
    session.lastText = null;
    session.changedWords = 0;

    return result;
  };

  /*
   * Android/system back can bypass closeEditor().
   */
  window.addEventListener(
    'popstate',
    () => {
      if (
        session.id &&
        session.lastText !== null
      ) {
        const note =
          byId(session.id);

        if (
          note &&
          session.changedWords >=
          threshold()
        ) {
          saveVersion({
            ...note,
            body:
              bodyInput?.innerHTML ||
              note.body
          });
        }

        session.id = null;
        session.lastText = null;
        session.changedWords = 0;
      }
    },
    true
  );

  function openHistory() {
    const note =
      F.currentNote();

    if (!note) return;

    const versions =
      readVersions()[note.id] || [];

    let html =
      `<button class="sheet-item" data-version-threshold>
        <span class="nt-name">
          Version threshold: ${threshold()} words
        </span>
      </button>`;

    if (!versions.length) {
      html +=
        '<div class="sheet-section-title">No versions yet</div>';
    }

    versions
      .slice()
      .reverse()
      .forEach((version, index) => {
        const number =
          versions.length - index;

        html +=
          `<button class="sheet-item" data-version="${number - 1}">
            <span class="nt-name">
              v${number}
              <small>${esc(new Date(version.at).toLocaleString())}</small>
            </span>
          </button>`;
      });

    openSheet(
      'Version History',
      html
    );
  }

  function openThresholdSheet() {
    openSheet(
      'Version Threshold',
      [50, 75, 100]
        .map(
          value =>
            `<button class="sheet-item" data-version-threshold-value="${value}">
              <span class="nt-name">
                ${value} changed words
              </span>
            </button>`
        )
        .join('')
    );
  }

  F.editMenuItems.push({
    icon: 'clock',
    label: 'Version History',
    fn: openHistory
  });

  sheetContent.addEventListener(
    'click',
    event => {
      const thresholdButton =
        event.target.closest(
          '[data-version-threshold]'
        );

      if (thresholdButton) {
        openThresholdSheet();
        return;
      }

      const thresholdValue =
        event.target.closest(
          '[data-version-threshold-value]'
        );

      if (thresholdValue) {
        localStorage.setItem(
          THRESHOLD_KEY,
          thresholdValue.dataset
            .versionThresholdValue
        );

        closeSheet();

        toast(
          `Version threshold: ${thresholdValue.dataset.versionThresholdValue} words`
        );

        return;
      }

      const versionButton =
        event.target.closest(
          '[data-version]'
        );

      if (!versionButton) return;

      const note =
        F.currentNote();

      if (!note) return;

      const versions =
        readVersions()[note.id] || [];

      const version =
        versions[
          Number(versionButton.dataset.version)
        ];

      if (!version) return;

      openSheet(
        `v${Number(versionButton.dataset.version) + 1}`,
        `<div style="padding:12px;color:var(--text-2);white-space:pre-wrap">
          ${esc(plain(version.body))}
        </div>
        <button class="sheet-item" data-restore-version="${Number(versionButton.dataset.version)}">
          ${ic('check')}
          <span class="nt-name">Restore this version</span>
        </button>`
      );

      return;
    }
  );

  sheetContent.addEventListener(
    'click',
    event => {
      const restore =
        event.target.closest(
          '[data-restore-version]'
        );

      if (!restore) return;

      const note =
        F.currentNote();

      if (!note) return;

      const versions =
        readVersions()[note.id] || [];

      const version =
        versions[
          Number(
            restore.dataset
              .restoreVersion
          )
        ];

      if (!version) return;

      bodyInput.innerHTML =
        version.body;

      titleInput.value =
        version.title;

      editTitleBar.textContent =
        version.title;

      save();

      closeSheet();

      toast('Version restored');
    }
  );
})();