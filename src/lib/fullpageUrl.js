/** Path to full-page UI relative to extension root (must match dist output). */
export const FULLPAGE_HTML_PATH = 'src/fullpage/index.html'

export function openFullPageInTab() {
  const url = chrome.runtime.getURL(FULLPAGE_HTML_PATH)
  chrome.tabs.create({ url })
}
