/* Take Fast Notes - native-fs.js
 * Android Storage Access Framework vault bridge.
 */

'use strict';

const NativeFS = (() => {

  const capacitor =
    window.Capacitor || null;

  const plugin =
    capacitor?.Plugins?.TakeFastNotesVault || null;

  const available =
    !!plugin;

  function cleanName(
    value,
    fallback = 'Untitled'
  ) {
    const name =
      String(value ?? '')
        .trim()
        .replace(/[\/\\:*?"<>|]/g, '-')
        .replace(/\s+/g, ' ');

    return name || fallback;
  }

  function noteName(note) {
    return (
      cleanName(
        note?.title,
        'Untitled'
      )
      + '.md'
    );
  }

  function folderPath(folderId) {
    const parts = [];

    let current =
      folderId
        ? byNb(folderId)
        : null;

    const seen =
      new Set();

    while (
      current
      && !seen.has(current.id)
    ) {
      seen.add(current.id);

      parts.unshift(
        cleanName(
          current.name,
          'Untitled folder'
        )
      );

      current =
        current.parent
          ? byNb(current.parent)
          : null;
    }

    return parts.join('/');
  }

  function notePath(note) {
    const folder =
      note?.nb
        ? folderPath(note.nb)
        : '';

    const name =
      noteName(note);

    return folder
      ? folder + '/' + name
      : name;
  }

  async function chooseFolder() {
    if (!available) {
      return {
        success: false,
        unavailable: true
      };
    }

    try {
      return await plugin.chooseFolder();
    } catch (error) {
      console.error(
        'Take Fast Notes: folder selection failed.',
        error
      );

      return {
        success: false,
        cancelled: true,
        error
      };
    }
  }

  async function hasPermission() {
    if (!available) {
      return false;
    }

    try {
      const result =
        await plugin.hasPermission();

      return !!result?.valid;

    } catch {
      return false;
    }
  }

  async function getVault() {
    if (!available) {
      return null;
    }

    try {
      const result =
        await plugin.getVault();

      return result?.valid
        ? result
        : null;

    } catch {
      return null;
    }
  }

  async function initialize() {
    if (!available) {
      return {
        available: false,
        ready: false
      };
    }

    if (await hasPermission()) {
      return {
        available: true,
        ready: true
      };
    }

    const result =
      await chooseFolder();

    if (!result?.success) {
      return {
        available: true,
        ready: false,
        cancelled:
          !!result?.cancelled
      };
    }

    return {
      available: true,
      ready: true
    };
  }

  async function list(path = '') {
    if (!available) {
      return [];
    }

    try {
      const result =
        await plugin.list({
          path
        });

      return Array.isArray(result?.items)
        ? result.items
        : [];

    } catch (error) {
      console.error(
        'Take Fast Notes: list failed.',
        error
      );

      return [];
    }
  }

  async function readFile(path) {
    if (!available) {
      return null;
    }

    try {
      const result =
        await plugin.readFile({
          path
        });

      return result?.data ?? null;

    } catch (error) {
      console.error(
        'Take Fast Notes: read failed.',
        path,
        error
      );

      return null;
    }
  }

  async function writeFile(
    path,
    data
  ) {
    if (!available) {
      return false;
    }

    try {
      await plugin.writeFile({
        path,
        data
      });

      return true;

    } catch (error) {
      console.error(
        'Take Fast Notes: write failed.',
        path,
        error
      );

      return false;
    }
  }

  async function createFolder(path) {
    if (!available) {
      return false;
    }

    try {
      await plugin.createFolder({
        path
      });

      return true;

    } catch (error) {
      console.error(
        'Take Fast Notes: folder creation failed.',
        path,
        error
      );

      return false;
    }
  }

  async function rename(
    path,
    newName
  ) {
    if (!available) {
      return false;
    }

    try {
      await plugin.rename({
        path,
        newName
      });

      return true;

    } catch (error) {
      console.error(
        'Take Fast Notes: rename failed.',
        path,
        error
      );

      return false;
    }
  }

  async function remove(path) {
    if (!available) {
      return false;
    }

    try {
      await plugin.delete({
        path
      });

      return true;

    } catch (error) {
      console.error(
        'Take Fast Notes: delete failed.',
        path,
        error
      );

      return false;
    }
  }

  async function move(
    path,
    destination
  ) {
    if (!available) {
      return false;
    }

    try {
      await plugin.move({
        path,
        destination
      });

      return true;

    } catch (error) {
      console.error(
        'Take Fast Notes: move failed.',
        path,
        destination,
        error
      );

      return false;
    }
  }

  return {
    available,
    initialize,
    chooseFolder,
    hasPermission,
    getVault,
    list,
    readFile,
    writeFile,
    createFolder,
    rename,
    remove,
    move,
    noteName,
    notePath,
    folderPath
  };

})();