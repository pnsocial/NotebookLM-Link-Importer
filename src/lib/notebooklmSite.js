/** NotebookLM web app (same origin as batchexecute RPC). */
export const NOTEBOOKLM_SITE_URL = 'https://notebooklm.google.com'

export function openNotebooklmSiteInNewTab() {
  chrome.tabs.create({ url: NOTEBOOKLM_SITE_URL })
}
