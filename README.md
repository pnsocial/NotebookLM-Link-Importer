# NotebookLM Link Importer

Chrome extension (Manifest V3) that sends **web links** and **open browser tabs** into your [NotebookLM](https://notebooklm.google.com) notebooks. It talks to NotebookLM using the same `batchexecute` flow as the official web app, while you stay signed in with your Google account in the browser.

## Features

- **Popup — quick import**  
  Choose a notebook, add the **current tab’s URL** as a source, or **create a new notebook** (title derived from the active tab) and attach that URL.

- **Bulk import — full-page UI**  
  Open **Bulk Import** from the popup to use a larger view in a **separate tab**: pick a notebook (or create one), then either:
  - paste **multiple URLs** (one per line), or  
  - select from **open tabs** in the current window and import in one go.

- **Notebook list & sync**  
  Fetches your notebooks from NotebookLM (with caching where appropriate) so the dropdown stays usable offline briefly after a successful sync.

- **Open NotebookLM**  
  A control in the header opens `https://notebooklm.google.com` in a new tab when you need the full web UI.

- **Local convenience**  
  Remembers the last selected notebook in extension storage.

## Permissions

| Permission | Why |
|------------|-----|
| `tabs` | Read URLs of the active tab and list tabs for bulk import. |
| `storage` | Persist last notebook choice and sync-related cache. |
| `https://notebooklm.google.com/*` | Call NotebookLM from the background worker (same-origin requests as in the web app). |

No separate API key: authentication follows your **Google session** for NotebookLM in Chrome.

## Install from GitHub Release (no Node.js)

Pre-built ZIP files are attached to **Releases** on this GitHub repository (when maintainers publish a version). Open the repo → **Releases**, or append `/releases` to the repository URL. **You do not need to install Node.js or run `npm run build`.**

1. Open the **Releases** page for this repository and download **`NotebookLM-Link-Importer-vX.Y.Z.zip`** from the latest release.
2. Unzip the file. The extracted folder must contain **`manifest.json`** at the top level (if macOS adds an extra wrapper folder, open it until you see `manifest.json`).
3. In Chrome, go to `chrome://extensions`, turn **Developer mode** on, click **Load unpacked**, and select **that folder** (the one that directly contains `manifest.json`).
4. Pin the extension from the puzzle icon if you like, then sign in to [NotebookLM](https://notebooklm.google.com) in a normal tab so imports can use your account.

To update later, download a newer release ZIP, remove the old extension from `chrome://extensions`, then load unpacked again using the new folder (or use **Reload** if you overwrote the same folder).

---

## Install in Chrome (local, from source)

This extension is not on the Chrome Web Store. You can also build it yourself from this repository.

### 1. Download the project

- **With Git:** clone this repository to your computer.  
  `git clone <your-repo-url>.git` then `cd` into the project folder.
- **Without Git:** on GitHub, use **Code → Download ZIP**, unzip it, and open a terminal in the unzipped folder.

### 2. Install Node.js and build

You need [Node.js](https://nodejs.org/) **18 or newer** (LTS is fine).

```bash
npm install
npm run build
```

This creates a `dist` folder with the packaged extension (manifest, scripts, HTML, icons).

### 3. Load the extension in Chrome

1. Open Chrome and go to `chrome://extensions` (paste it in the address bar).
2. Turn **Developer mode** **on** (top right).
3. Click **Load unpacked**.
4. Choose the **`dist`** folder inside your project — **not** the repository root and **not** `src`.  
   Example path: `…/notebooklm-link-importer/dist`.

Chrome will install the extension. You should see **NotebookLM Link Importer** in the list.

### 4. Pin and sign in (recommended)

- Click the **puzzle piece** icon in Chrome’s toolbar → **pin** the extension so the icon stays visible.
- In a normal tab, open [NotebookLM](https://notebooklm.google.com) and sign in with your Google account if you are not already. The extension uses that session when importing links.

### 5. Updating after you pull new code

```bash
git pull
npm install
npm run build
```

Then open `chrome://extensions` and click **Reload** on this extension’s card.

---

## Project layout

```
notebooklm-link-importer/
├── .github/workflows/
│   └── release.yml        # Tag v* → build ZIP and GitHub Release
├── public/icons/          # Toolbar icons (PNG); regenerate with npm run generate-icons
├── scripts/
│   └── generate-icons.mjs
├── src/
│   ├── background.js      # Service worker: RPC to NotebookLM
│   ├── components/        # Shared UI (buttons, dropdown, tabs)
│   ├── fullpage/          # Bulk import page (separate tab)
│   ├── hooks/
│   ├── lib/               # RPC client, storage, URLs
│   ├── popup/             # Popup UI (React)
│   └── manifest.json
├── package.json
├── vite.config.js
└── README.md
```

## Development

Same requirements as above: **Node.js 18+**, then `npm install` and `npm run build`. Load **`dist`** via **Load unpacked** on `chrome://extensions` (see [Install from source](#install-in-chrome-local-from-source)).

### Publish a release (maintainers)

Pushing a **version tag** matching `v*` (e.g. `v1.0.0`) runs [`.github/workflows/release.yml`](.github/workflows/release.yml): it builds the extension, zips the contents of `dist/`, and creates a GitHub Release with **`NotebookLM-Link-Importer-<tag>.zip`** attached.

```bash
# Align package.json version with the tag if you like, then:
git tag v1.0.0
git push origin v1.0.0
```

Check the **Actions** tab on GitHub for the workflow run, then **Releases** for the downloadable ZIP.

Optional — regenerate toolbar icons after editing `scripts/generate-icons.mjs`:

```bash
npm run generate-icons
```

## Security & what not to commit

- Do **not** commit files that contain **cookies**, **tokens**, or **copy-pasted `curl` captures** from DevTools — they can fully compromise your Google session.
- The repository `.gitignore` excludes common junk (`node_modules`, `dist`, logs, `curl*.txt`, optional `3party/`, env files). Keep secrets out of issues and PRs.

## Disclaimer

This project is an independent tool and is **not** affiliated with Google. NotebookLM and its APIs may change; the extension may need updates when the site does.

## License

See `package.json` for the package name and version. Add a `LICENSE` file when you decide on terms for your repo.
