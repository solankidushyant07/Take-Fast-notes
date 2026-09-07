'use strict';

(() => {
  const F = window.TFNFeatures;

  /*
   * Images are deliberately limited to data:image URLs.
   * This keeps pasted images offline and prevents arbitrary external
   * HTML/image sources from entering the editor.
   */
  window.sanitize = function (html) {
    const t = document.createElement('div');
    t.innerHTML = html || '';

    const allowed = new Set([
      'P', 'DIV', 'BR', 'B', 'STRONG', 'I', 'EM', 'U',
      'H1', 'H2', 'H3', 'H4', 'UL', 'OL', 'LI', 'A',
      'SPAN', 'BLOCKQUOTE', 'PRE', 'IMG'
    ]);

    const kill = new Set([
      'SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED',
      'LINK', 'META', 'FORM', 'INPUT', 'BUTTON',
      'VIDEO', 'AUDIO', 'SVG'
    ]);

    for (const el of Array.from(t.querySelectorAll('*'))) {
      if (kill.has(el.tagName)) {
        el.remove();
        continue;
      }

      if (!allowed.has(el.tagName)) {
        el.replaceWith(...el.childNodes);
        continue;
      }

      for (const attr of Array.from(el.attributes)) {
        const name = attr.name.toLowerCase();
        let ok = false;

        if (
          el.tagName === 'A' &&
          name === 'href' &&
          /^(https?|mailto):/i.test(attr.value || '')
        ) {
          ok = true;
        }

        if (
          el.tagName === 'IMG' &&
          name === 'src' &&
          /^data:image\//i.test(attr.value || '')
        ) {
          ok = true;
        }

        if (
          el.tagName === 'IMG' &&
          name === 'alt'
        ) {
          ok = true;
        }

        if (
          name === 'class' &&
          ['LI', 'UL', 'SPAN', 'IMG'].includes(el.tagName)
        ) {
          ok = true;
        }

        if (!ok) {
          el.removeAttribute(attr.name);
        }
      }

      if (el.tagName === 'A') {
        el.setAttribute('target', '_blank');
        el.setAttribute('rel', 'noopener noreferrer');
      }

      if (el.tagName === 'IMG') {
        el.setAttribute('draggable', 'false');
      }
    }

    return t.innerHTML;
  };

  const originalHtmlToMd = window.htmlToMd;
  const originalMdToHtml = window.mdToHtml;

  window.htmlToMd = function (html) {
    const t = document.createElement('div');
    t.innerHTML = html || '';

    t.querySelectorAll('img[src^="data:image/"]').forEach(img => {
      const alt = img.getAttribute('alt') || 'image';
      const src = img.getAttribute('src');

      img.replaceWith(
        document.createTextNode(`![${alt}](${src})`)
      );
    });

    return originalHtmlToMd(t.innerHTML);
  };

  window.mdToHtml = function (markdown) {
    const images = [];

    const replaced = String(markdown || '').replace(
      /!\[([^\]]*)\]\((data:image\/[^)]+)\)/g,
      (_, alt, src) => {
        const index = images.push({ alt, src }) - 1;
        return `TFN_IMAGE_${index}_TOKEN`;
      }
    );

    let html = originalMdToHtml(replaced);

    images.forEach((image, index) => {
      html = html.replaceAll(
        `TFN_IMAGE_${index}_TOKEN`,
        `<img class="tfn-pasted-image" src="${image.src}" alt="${esc(image.alt)}">`
      );
    });

    return sanitize(html);
  };

  F.css(`
    .tfn-pasted-image {
      display:block;
      max-width:100%;
      height:auto;
      margin:10px 0;
      border-radius:12px;
    }
  `);

  /*
   * URLs already become <a> elements through the existing Markdown
   * renderer. This makes them directly actionable in the editor/read view.
   */
  document.addEventListener('click', event => {
    const link = event.target.closest('#bodyInput a');

    if (!link || !link.href) return;

    window.open(link.href, '_blank', 'noopener');
  });

  /*
   * Single-note export actions.
   */
  F.editMenuItems.push({
    icon: 'export',
    label: 'Export Markdown',
    fn: async () => {
      const note = F.currentNote();

      if (!note) return;

      await F.download(
        `${F.safeName(note.title)}.md`,
        markdownForNote(note),
        'text/markdown'
      );
    }
  });

  F.editMenuItems.push({
    icon: 'export',
    label: 'Export Text',
    fn: async () => {
      const note = F.currentNote();

      if (!note) return;

      await F.download(
        `${F.safeName(note.title)}.txt`,
        plain(note.body),
        'text/plain'
      );
    }
  });

  F.editMenuItems.push({
    icon: 'export',
    label: 'Copy text',
    fn: async () => {
      const note = F.currentNote();

      if (!note) return;

      try {
        await navigator.clipboard.writeText(plain(note.body));
        toast('Copied');
      } catch {
        toast('Could not copy');
      }
    }
  });

  /*
   * Import Folder.
   */
  const folderInput = document.createElement('input');

  folderInput.type = 'file';
  folderInput.id = 'tfnImportFolder';
  folderInput.multiple = true;
  folderInput.webkitdirectory = true;
  folderInput.hidden = true;

  document.body.appendChild(folderInput);

  const importFolderButton = document.createElement('button');

  importFolderButton.className = 'setting-choice';
  importFolderButton.type = 'button';

  importFolderButton.innerHTML =
    '<span>' +
      '<strong>Import Folder</strong>' +
      '<small>Import supported text files from a folder</small>' +
    '</span>';

  $('#setImportBtn').parentElement.appendChild(importFolderButton);

  importFolderButton.addEventListener('click', () => {
    folderInput.click();
  });

  folderInput.addEventListener('change', async () => {
    let count = 0;
    const folderIds = new Map();

    for (const file of Array.from(folderInput.files || [])) {
      if (!/\.(md|txt)$/i.test(file.name)) continue;

      const relative =
        String(file.webkitRelativePath || file.name);

      const parts =
        relative.split('/').slice(0, -1);

      let parent = null;

      for (const part of parts) {
        if (!part) continue;

        const key = `${parent || 'root'}/${part}`;

        let folderId = folderIds.get(key);

        if (!folderId) {
          let folder = db.notebooks.find(
            item =>
              !item.trashed &&
              (item.parent || null) === (parent || null) &&
              item.name === part
          );

          if (!folder) {
            folder = {
              id: uid(),
              name: part,
              parent: parent || null,
              open: false,
              trashed: 0
            };

            db.notebooks.push(folder);
          }

          folderId = folder.id;
          folderIds.set(key, folderId);
        }

        parent = folderId;
      }

      const text = await file.text();

      const note = addImportedNote(
        file.name.replace(/\.[^.]+$/, ''),
        /\.md$/i.test(file.name)
          ? mdToHtml(text)
          : textToHtml(text),
        parent
      );

      if (note) count++;
    }

    folderInput.value = '';

    save();
    renderScreen();

    toast(
      `${count} ${count === 1 ? 'note' : 'notes'} imported`
    );
  });

  /*
   * Export Folder.
   */
  const exportFolderButton = document.createElement('button');

  exportFolderButton.className = 'setting-choice';
  exportFolderButton.type = 'button';

  exportFolderButton.innerHTML =
    '<span>' +
      '<strong>Export Folder</strong>' +
      '<small>Export notes as a normal Markdown folder</small>' +
    '</span>';

  $('#setExportBtn').parentElement.appendChild(exportFolderButton);

  exportFolderButton.addEventListener('click', async () => {
    const notes = db.notes.filter(
      note => !note.trashed && !note.private
    );

    if (!notes.length) {
      toast('Nothing to export');
      return;
    }

    /*
     * Native Android:
     * Documents/Take Fast Notes Export/...
     */
    const fs = window.Capacitor?.Plugins?.Filesystem;

    if (
      window.Capacitor?.isNativePlatform?.() &&
      fs
    ) {
      try {
        for (const note of notes) {
          const path = [
            'Take Fast Notes Export',
            ...folderPath(note.nb),
            `${F.safeName(note.title)}.md`
          ].join('/');

          const parts = path.split('/');

          let dir = '';

          for (let i = 0; i < parts.length - 1; i++) {
            dir = dir
              ? `${dir}/${parts[i]}`
              : parts[i];

            await fs.mkdir({
              path: dir,
              directory: 'DOCUMENTS',
              recursive: true
            }).catch(() => {});
          }

          const bytes =
            new TextEncoder().encode(
              markdownForNote(note)
            );

          let binary = '';

          for (
            let i = 0;
            i < bytes.length;
            i += 0x8000
          ) {
            binary += String.fromCharCode(
              ...bytes.subarray(i, i + 0x8000)
            );
          }

          await fs.writeFile({
            path,
            directory: 'DOCUMENTS',
            data: btoa(binary)
          });
        }

        toast(
          'Folder exported to Documents/Take Fast Notes Export'
        );

        return;
      } catch (error) {
        console.warn(
          'Native folder export failed',
          error
        );
      }
    }

    /*
     * Browser/PWA File System Access API.
     */
    if (window.showDirectoryPicker) {
      try {
        const root =
          await window.showDirectoryPicker();

        for (const note of notes) {
          let dir = root;

          for (const part of folderPath(note.nb)) {
            dir = await dir.getDirectoryHandle(
              F.safeName(part),
              { create: true }
            );
          }

          const handle =
            await dir.getFileHandle(
              `${F.safeName(note.title)}.md`,
              { create: true }
            );

          const writer =
            await handle.createWritable();

          await writer.write(
            markdownForNote(note)
          );

          await writer.close();
        }

        toast('Folder exported');
        return;
      } catch (error) {
        if (error?.name === 'AbortError') return;
      }
    }

    toast(
      'Folder export is not supported here; use Markdown ZIP export.'
    );
  });
})();