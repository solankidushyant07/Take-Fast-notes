/* Take Fast Notes - native-fs.js
 * Android Markdown vault using Capacitor Filesystem.
 */

'use strict';

const NativeFS = (() => {
  const capacitor = window.Capacitor;

  const filesystem =
    capacitor?.Plugins?.Filesystem || null;

  const available = !!filesystem;

  const DIRECTORY = 'DOCUMENTS';
  const ENCODING = 'utf8';
  const VAULT = 'Take Fast Notes';

  let permissionReady = false;

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

      parts.unshift(
        cleanName(
          current.name,
          'Untitled folder'
        )
      );

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

  async function requestPermission() {
    if (!available) {
      console.warn(
        'Take Fast Notes: Capacitor Filesystem is not available.'
      );

      return false;
    }

    if (permissionReady) {
      return true;
    }

    try {
      const status =
        await filesystem.checkPermissions();

      if (
        status.publicStorage === 'granted'
      ) {
        permissionReady = true;
        return true;
      }

      const requested =
        await filesystem.requestPermissions();

      if (
        requested.publicStorage === 'granted'
      ) {
        permissionReady = true;
        return true;
      }

      console.error(
        'Take Fast Notes: storage permission was not granted.',
        requested
      );

      return false;

    } catch (error) {
      console.error(
        'Take Fast Notes: permission request failed.',
        error
      );

      return false;
    }
  }

  async function mkdir(path) {
    if (!await requestPermission()) {
      return false;
    }

    try {
      await filesystem.mkdir({
        path,
        directory: DIRECTORY,
        recursive: true
      });

      return true;

    } catch (error) {

      const message =
        String(error?.message || '')
          .toLowerCase();

      if (!message.includes('exist')) {
        console.error(
          'Take Fast Notes: mkdir failed.',
          error
        );
      }

      return false;
    }
  }

  async function ensureVault() {
    if (!available) {
      return false;
    }

    if (!await requestPermission()) {
      return false;
    }

    return mkdir(VAULT);
  }

  async function writeNote(note) {
    if (!available || !note) {
      return false;
    }

    if (!await requestPermission()) {
      return false;
    }

    try {
      const path = notePath(note);

      const folder =
        note.nb
          ? folderPath(note.nb)
          : VAULT;

      const folderCreated =
        await mkdir(folder);

      if (!folderCreated) {
        console.error(
          'Take Fast Notes: could not create note folder.',
          folder
        );

        return false;
      }

      const markdown =
        '# ' +
        cleanName(note.title, 'Untitled') +
        '\n\n' +
        htmlToMd(note.body || '');

      const result =
        await filesystem.writeFile({
          path,
          directory: DIRECTORY,
          data: markdown,
          encoding: ENCODING
        });

      note.filePath = path;

      console.log(
        'Take Fast Notes: Markdown created:',
        path,
        result
      );

      return true;

    } catch (error) {

      console.error(
        'Take Fast Notes: could not write Markdown note.',
        error
      );

      return false;
    }
  }

  async function createFolder(folder) {
    if (!available || !folder) {
      return false;
    }

    if (!await requestPermission()) {
      return false;
    }

    try {
      return await mkdir(
        folderPath(folder.id)
      );

    } catch (error) {

      console.error(
        'Take Fast Notes: could not create folder.',
        error
      );

      return false;
    }
  }

  async function renameNoteFile(note, oldPath) {
    if (!available || !note) {
      return false;
    }

    if (!await requestPermission()) {
      return false;
    }

    const newPath =
      notePath(note);

    if (
      !oldPath ||
      oldPath === newPath
    ) {
      return writeNote(note);
    }

    try {

      await mkdir(
        note.nb
          ? folderPath(note.nb)
          : VAULT
      );

      await filesystem.rename({
        from: oldPath,
        to: newPath,
        directory: DIRECTORY
      });

      note.filePath = newPath;

      return true;

    } catch (error) {

      console.warn(
        'Take Fast Notes: rename failed; creating new Markdown file.',
        error
      );

      return writeNote(note);
    }
  }

  async function deleteNote(note) {
    if (
      !available ||
      !note?.filePath
    ) {
      return false;
    }

    if (!await requestPermission()) {
      return false;
    }

    try {

      await filesystem.deleteFile({
        path: note.filePath,
        directory: DIRECTORY
      });

      delete note.filePath;

      return true;

    } catch (error) {

      console.error(
        'Take Fast Notes: could not delete Markdown note.',
        error
      );

      return false;
    }
  }

  return {
    available,
    requestPermission,
    ensureVault,
    createFolder,
    writeNote,
    renameNoteFile,
    deleteNote,
    notePath,
    folderPath
  };
})();