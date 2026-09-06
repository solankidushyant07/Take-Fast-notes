# Take Fast Notes

Take Fast Notes is an Android-first local note app.

## Storage model

- Notes, folders, settings and trash live inside the app's local `localStorage` database.
- The app does **not** create or maintain Markdown note files for normal editing.
- Android file access is used only at the export boundary through Capacitor Filesystem.
- Import reads files selected by the Android file picker and adds their contents to the app database.

## Import / export

Supported imports:
- Markdown `.md`
- Text `.txt`
- JSON backup `.json`
- Take Fast Notes ZIP exports `.zip`

Supported exports:
- Markdown ZIP: one `.md` file per note plus a backup manifest
- Text ZIP: one `.txt` file per note plus a backup manifest
- JSON backup: complete app note/folder data

On Android, exports are saved to `Documents/Take Fast Notes` when the native Filesystem plugin is available. A browser download is used as a fallback.

## Build

GitHub Actions contains `.github/workflows/build-apk.yml`.

It creates the Capacitor Android project during the workflow, syncs the `web/` app, generates the Android icon, and uploads `Take-Fast-Notes.apk` as an artifact.
