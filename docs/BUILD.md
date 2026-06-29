# Webbox Build And Run

## Windows

```powershell
cd H:\oplus\kodbox\webbox
powershell -ExecutionPolicy Bypass -File .\scripts\build.ps1
powershell -ExecutionPolicy Bypass -File .\dist\run-webbox.ps1
```

Open `http://127.0.0.1:8787`.

## Linux

```sh
cd /path/to/webbox
sh ./scripts/build.sh
sh ./dist/run-webbox.sh
```

Open `http://127.0.0.1:8787`.

## Configuration

Set `WEBBOX_PORT`, `WEBBOX_ROOT`, `WEBBOX_DATA`, or `WEBBOX_PLUGIN_ROOT` for the current process before running the script. The scripts only set process-local environment variables and do not modify system configuration, services, Apache, Nginx, PHP, or database settings.

The build scripts also set `ELECTRON_CACHE` inside the project parent cache directory and default `ELECTRON_MIRROR` to `https://npmmirror.com/mirrors/electron/` so Electron can be installed without changing global npm or pnpm settings.
