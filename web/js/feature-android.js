'use strict';

(() => {
  const native =
    window.Capacitor?.Plugins
      ?.TakeFastNotesVault;

  if (!native) return;

  function receiveSharedText(data) {
    if (!data?.text) return;

    createNote();

    setTimeout(() => {
      titleInput.value =
        data.subject ||
        'Shared Note';

      editTitleBar.textContent =
        titleInput.value;

      bodyInput.innerHTML =
        textToHtml(
          data.text
        );

      commit();
    }, 80);
  }

  async function consumeLaunchData() {
    try {
      const data =
        await native.getPendingShare();

      receiveSharedText(
        data
      );

      if (
        data?.action ===
        'search'
      ) {
        setTimeout(
          () => searchInput.focus(),
          150
        );
      }

      if (
        data?.action ===
        'new'
      ) {
        setTimeout(
          () => createNote(),
          150
        );
      }
    } catch {}
  }

  consumeLaunchData();

  /*
   * App already running.
   */
  window.addEventListener(
    'tfn-share-received',
    event => {
      receiveSharedText(
        event.detail || {}
      );
    }
  );

  window.addEventListener(
    'tfn-launch-action',
    event => {
      const action =
        event.detail?.action;

      if (
        action === 'search'
      ) {
        searchInput.focus();
      } else if (
        action === 'new'
      ) {
        createNote();
      }
    }
  );
})();