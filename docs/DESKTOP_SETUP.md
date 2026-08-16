# Desktop Client Setup & Packaging Guide

## Development Setup
```bash
# Navigate to desktop app directory
cd apps/desktop

# Install dependencies
pnpm install

# Run Vite dev server + Electron main process
pnpm dev
```

## Packaging Installers (Windows / Mac / Linux)
```bash
# Build production bundle and Electron installer
pnpm build
```
The resulting executable binaries are generated inside `apps/desktop/release/`.
