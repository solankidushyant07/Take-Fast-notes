'use strict';

(() => {
  const BACKUP_KEY = 'tfn.note-backups.v1';

  function readBackups() {
    try {
      const value =
        JSON.parse(
          localStorage.getItem(BACKUP_KEY) || '{}'
        );

      return value && typeof value === 'object'
        ? value
        : {};
    } catch {
      return {};
    }
  }

  function writeBackups(value) {
    try {
      localStorage.setItem(
        BACKUP_KEY,
        JSON.stringify(value)
      );
    } catch {}
  }

  function snapshotNotes() {
    const backups = readBackups();

    db.notes.forEach(note => {
      if (!note?.id) return;

      backups[note.id] = {
        ...note
      };
    });

    writeBackups(backups);
  }

  /*
   * Existing save remains the real application save.
   * This adds an individual-note recovery copy.
   */
  const originalSave = window.save;

  window.save = function () {
    const result = originalSave();

    snapshotNotes();

    return result;
  };

  /*
   * Recover from a completely broken main database only if
   * the main database itself is actually invalid/missing.
   */
  const backups = readBackups();

  let mainDatabaseBroken = false;

  try {
    const raw =
      localStorage.getItem('fastnote.v2');

    const parsed =
      raw ? JSON.parse(raw) : null;

    mainDatabaseBroken =
      !parsed ||
      !Array.isArray(parsed.notes);
  } catch {
    mainDatabaseBroken = true;
  }

  if (
    mainDatabaseBroken &&
    !db.notes.length
  ) {
    const restored =
      Object.values(backups)
        .filter(note =>
          note &&
          note.id &&
          !note.trashed
        );

    if (restored.length) {
      db.notes = restored;
      save();
      renderScreen();
    }
  }

  /*
   * Isolate an individual bad note.
   */
  db.notes.forEach(note => {
    try {
      note.body = sanitize(note.body || '');
    } catch {
      note.corrupted = true;

      note.body =
        '<p>This note could not be read safely. ' +
        'Your other notes are still available.</p>';
    }
  });

  /*
   * Keep individual recovery copies synchronized when a note
   * is permanently deleted.
   */
  const originalDeleteForever =
    window.deleteForever;

  window.deleteForever = function (target) {
    originalDeleteForever(target);

    const backups = readBackups();

    if (target?.type === 'note') {
      delete backups[target.id];
    }

    writeBackups(backups);
  };
})();