/* Take Fast Notes - native-fs.js
 * Android Markdown vault using Capacitor Filesystem.
 */

'use strict';

const NativeFS = (() => {
  const filesystem =
    window.Capacitor?.Plugins?.Filesystem;

  // The web version does not have the native Filesystem plugin.
  // This lets the same code continue working on the web.
  const available = !!filesystem;

  const DIRECTORY = 'DOCUMENTS';
  const ENCODING = 'utf8';
  const VAULT = 'Take Fast Notes';

  function cleanName(value, fallback = 'Untitled') {
    const name = String(value ?? '')
      .trim()
      .replace(/[\/\\:*?"<>|]/g, '-')
      .replace(/\s+/g, ' ');

    return name || fallback;
  }

  function noteName(note) {
    return cleanName(note.title, 'Untitled') + '.md';
  }

  function folderPath(id) {
    const parts = [];
    let current = id ? byNb(id) : null;
    const seen = new Set();

    while (current && !seen.has(current.id)) {
      seen.add(current.id);
      parts.unshift(cleanName(current.name, 'Untitled folder'));
      current = current.parent
        ? byNb(current.parent)
        : null;
    }

    return parts.length
      ? VAULT + '/' + parts.join('/')
      : VAULT;
  }

  function notePath(note) {
    const folder =
      note.nb
        ? folderPath(note.nb)
        : VAULT;

    return folder + '/' + noteName(note);
  }

  async function mkdir(path) {
    if (!available) return false;

    try {
      await filesystem.mkdir({
        path,
        directory: DIRECTORY,
        recursive: true
      });

      return true;
    } catch (error) {
      // "Directory already exists" is harmless.
      if (
        !String(error?.message || '')
          .toLowerCase()
          .includes('exist')
      ) {
        console.error(
          'Take Fast Notes: mkdir failed',
          error
        );
      }

      return false;
    }
  }

  async function ensureVault() {
    if (!available) return false;
    return mkdir(VAULT);
  }

  async function writeNote(note) {
    if (!available || !note) return false;

    try {
      const path = notePath(note);

      await mkdir(
        note.nb
          ? folderPath(note.nb)
          : VAULT
      );

      const markdown =
        '# ' +
        cleanName(note.title, 'Untitled') +
        '\n\n' +
        htmlToMd(note.body || '');

      await filesystem.writeFile({
        path,
        directory: DIRECTORY,
        data: markdown,
        encoding: ENCODING
      });

      note.filePath = path;

      return true;
    } catch (error) {
      console.error(
        'Take Fast Notes: could not write Markdown note',
        error
      );

      return false;
    }
  }

  async function createFolder(folder) {
    if (!available || !folder) return false;

    try {
      await mkdir(folderPath(folder.id));
      return true;
    } catch (error) {
      console.error(
        'Take Fast Notes: could not create folder',
        error
      );

      return false;
    }
  }

  async function renameNoteFile(note, oldPath) {
    if (!available || !note) return false;

    const newPath = notePath(note);

    if (!oldPath || oldPath === newPath) {
      return writeNote(note);
    }

    try {
      await filesystem.rename({
        from: oldPath,
        to: newPath,
        directory: DIRECTORY
      });

      note.filePath = newPath;

      return true;
    } catch {
      // If the old file does not exist, simply create the new one.
      return writeNote(note);
    }
  }

  async function deleteNote(note) {
    if (!available || !note?.filePath) return false;

    try {
      await filesystem.deleteFile({
        path: note.filePath,
        directory: DIRECTORY
      });

      delete note.filePath;

      return true;
    } catch {
      return false;
    }
  }

  return {
    available,
    ensureVault,
    createFolder,
    writeNote,
    renameNoteFile,
    deleteNote,
    notePath,
    folderPath
  };
})();