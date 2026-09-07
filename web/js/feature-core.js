'use strict';

window.TFNFeatures = window.TFNFeatures || {};

const F = window.TFNFeatures;

I.archive =
  I.archive ||
  '<path d="M4 7h16v13H4z"/><path d="M4 7l2-3h12l2 3M9 12h6"/>';

I.lock =
  I.lock ||
  '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>';

I.merge =
  I.merge ||
  '<path d="M7 7h10M7 17h10M7 7l-3 3 3 3M17 17l3-3-3-3"/>';

F.css = function (css) {
  let style = document.getElementById('tfn-feature-style');

  if (!style) {
    style = document.createElement('style');
    style.id = 'tfn-feature-style';
    document.head.appendChild(style);
  }

  style.textContent += css;
};

F.noteText = note => plain(note?.body || '');

F.words = text => {
  const value = String(text || '').trim();
  return value ? value.split(/\s+/).length : 0;
};

F.safeName = name =>
  String(name || 'Untitled')
    .trim()
    .replace(/[\\/:*?"<>|\x00-\x1F]/g, '-')
    .replace(/\s+/g, ' ')
    .slice(0, 120) || 'Untitled';

if (window.Capacitor?.registerPlugin) {
  try {
    window.Capacitor.Plugins = window.Capacitor.Plugins || {};

    if (!window.Capacitor.Plugins.TakeFastNotesVault) {
      window.Capacitor.Plugins.TakeFastNotesVault =
        window.Capacitor.registerPlugin('TakeFastNotesVault');
    }
  } catch {}
}

F.native = () =>
  window.Capacitor?.Plugins?.TakeFastNotesVault || null;

F.currentNote = () =>
  typeof editing !== 'undefined' && editing
    ? byId(editing)
    : null;

F.download = async (name, text, type = 'text/plain') => {
  const blob =
    text instanceof Blob
      ? text
      : new Blob([text], { type });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');

  a.href = url;
  a.download = name;

  document.body.appendChild(a);
  a.click();
  a.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1500);
};

F.share = async (title, text) => {
  if (navigator.share) {
    try {
      await navigator.share({
        title,
        text
      });

      return true;
    } catch (error) {
      if (error?.name === 'AbortError') return true;
    }
  }

  try {
    await navigator.clipboard.writeText(text);
    toast('Copied to clipboard');
  } catch {
    toast('Sharing is not available');
  }

  return false;
};

F.editMenuItems = [];
F.privateUnlocked = false;