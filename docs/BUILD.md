# Webbox Build And Run

Webbox build scripts write deployable artifacts to `out` under the terminal working directory. The source tree does not need package-level `dist` output for deployment.

## Windows

```powershell
cd H:\oplus\kodbox
powershell -ExecutionPolicy Bypass -File .\webbox\scripts\build.ps1
powershell -ExecutionPolicy Bypass -File .\out\run-webbox.ps1
```

Open `http://127.0.0.1:8787`.

## Linux

```sh
cd /path/to/build-directory
sh /path/to/webbox/scripts/build.sh
sh ./out/run-webbox.sh
```

Open `http://127.0.0.1:8787`.

## Artifact Layout

The build output contains:

- `out/web`: React/Vite web assets
- `out/webbox-server.js`: bundled Node.js backend
- `out/server.conf`: runtime configuration
- `out/run-webbox.ps1`: Windows launcher
- `out/run-webbox.sh`: Linux launcher
- `out/webbox-log-timestamps.js`: console timestamp hook
- `out/data`: default data directory
- `out/plugins`: default plugin directory

## Runtime Configuration

Edit `out/server.conf` before starting the service:

```ini
host=127.0.0.1
port=8787
public-url=http://127.0.0.1:8787
data-dir=data
storage-root=data/files
plugin-root=plugins
static-root=web
log-file=webbox.log
```

Relative paths are resolved from the `out` directory. Comment out `log-file=webbox.log` to disable file logging. When enabled, backend logs are written to both the terminal and the configured log file.

The scripts only set process-local environment variables and do not modify system configuration, services, Apache, Nginx, PHP, or database settings.

## Local Cache Behavior

The build scripts default `COREPACK_HOME`, `NPM_CONFIG_CACHE`, and `ELECTRON_CACHE` to directories beside the Webbox source tree. These values can be overridden for the current process. No global npm, pnpm, or Electron configuration is changed.
