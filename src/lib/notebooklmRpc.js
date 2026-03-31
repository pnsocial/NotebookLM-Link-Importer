/**
 * NotebookLM batchexecute RPC (LabsTailwindUi) — same protocol as the web app.
 * Token names / RPC id aligned with notebooklm-kit (MIT); update if Google changes the page.
 * @see https://github.com/photon-hq/notebooklm-kit
 */

import { normalizeRpcEmoji } from './notebookDisplay.js'
import { isNotebooklmProjectId, isUuidShape } from './notebooklmProjectId.js'

const NOTEBOOKLM_ORIGIN = 'https://notebooklm.google.com'
const BATCH_PATH = '/_/LabsTailwindUi/data/batchexecute'

/** Primary list RPC (recently viewed notebooks) */
export const RPC_LIST_MY_NOTEBOOKS = 'wXbhsf'
/** Add web URL(s) as sources to a project (batchexecute) */
export const RPC_ADD_URL_SOURCES = 'izAoDd'
/** Create a new notebook project (batchexecute) — notebooklm-kit RPC_CREATE_PROJECT */
export const RPC_CREATE_PROJECT = 'CCqFvf'

const LIST_ARGS = [null, 1, null, [2]]
/** Tail tuple for CCqFvf create payload (matches notebooklm-kit). */
const CREATE_TAIL = [1, null, null, null, null, null, null, null, null, [1]]
/** Source kind for web links (matches NotebookLM web client captures). */
const URL_SOURCE_KIND = [2]

/** batchexecute `at` / `bl` / `fSid` cache — avoids full HTML fetch on every RPC (service worker). */
const AUTH_CACHE_KEY = 'urc:notebooklm_auth_cache'
const AUTH_TTL_MS = 5 * 60 * 1000

let reqSeq = 0
function nextReqId() {
  const base = Math.floor(Math.random() * 9000) + 1000
  const reqid = base + reqSeq * 100000
  reqSeq += 1
  return String(reqid)
}

/**
 * @param {string} html
 * @param {string} key
 * @returns {string|null}
 */
export function extractQuotedField(html, key) {
  const m = new RegExp(`"${key}"\\s*:\\s*"([^"]+)"`).exec(html)
  return m ? m[1] : null
}

function storageGetLocal(keys) {
  return new Promise((resolve, reject) => {
    if (typeof chrome === 'undefined' || !chrome.storage?.local) {
      resolve({})
      return
    }
    chrome.storage.local.get(keys, (result) => {
      if (chrome.runtime.lastError) reject(chrome.runtime.lastError)
      else resolve(result)
    })
  })
}

function storageSetLocal(items) {
  return new Promise((resolve, reject) => {
    if (typeof chrome === 'undefined' || !chrome.storage?.local) {
      resolve()
      return
    }
    chrome.storage.local.set(items, () => {
      if (chrome.runtime.lastError) reject(chrome.runtime.lastError)
      else resolve()
    })
  })
}

/** Clears cached batchexecute tokens (e.g. after sign-out). */
export function clearNotebooklmAuthCache() {
  return new Promise((resolve) => {
    if (typeof chrome === 'undefined' || !chrome.storage?.local) {
      resolve()
      return
    }
    chrome.storage.local.remove(AUTH_CACHE_KEY, () => resolve())
  })
}

/**
 * Fetches NotebookLM homepage HTML and extracts `at` / `bl` / `fSid` (no cache).
 * @returns {Promise<{ at: string, bl: string, fSid: string, authuser: string }>}
 */
async function fetchAuthFromNotebooklmPageFresh(authuser = '0') {
  const url = new URL(NOTEBOOKLM_ORIGIN + '/')
  if (authuser && authuser !== '0') url.searchParams.set('authuser', authuser)

  const ua =
    typeof navigator !== 'undefined' && navigator.userAgent
      ? navigator.userAgent
      : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

  const res = await fetch(url.toString(), {
    credentials: 'include',
    redirect: 'follow',
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'User-Agent': ua,
    },
  })

  if (!res.ok) {
    throw new Error(`NotebookLM page HTTP ${res.status}`)
  }

  const html = await res.text()
  const at = extractQuotedField(html, 'SNlM0e')
  const bl = extractQuotedField(html, 'cfb2h')
  const fSidMatch = /"f\.sid":"([^"]+)"/.exec(html)
  const fSid = fSidMatch?.[1] ?? '-7121977511756781186'

  if (!at || !bl) {
    const err = new Error('NOTEBOOKLM_AUTH')
    err.code = 'NOTEBOOKLM_AUTH'
    throw err
  }

  return { at, bl, fSid, authuser }
}

/**
 * Returns batchexecute auth tokens, using a 5-minute in-storage cache when valid.
 * @returns {Promise<{ at: string, bl: string, fSid: string, authuser: string }>}
 */
export async function fetchAuthFromNotebooklmPage(authuser = '0') {
  const requestedUser = String(authuser ?? '0')
  const now = Date.now()

  try {
    const result = await storageGetLocal([AUTH_CACHE_KEY])
    const cached = result[AUTH_CACHE_KEY]
    if (
      cached &&
      typeof cached.at === 'string' &&
      typeof cached.bl === 'string' &&
      typeof cached.fetchedAt === 'number' &&
      now - cached.fetchedAt < AUTH_TTL_MS &&
      String(cached.authuser ?? '0') === requestedUser
    ) {
      return {
        at: cached.at,
        bl: cached.bl,
        fSid: cached.fSid ?? '-7121977511756781186',
        authuser: requestedUser,
      }
    }
  } catch {
    /* ignore cache read errors */
  }

  try {
    const auth = await fetchAuthFromNotebooklmPageFresh(authuser)
    await storageSetLocal({
      [AUTH_CACHE_KEY]: {
        at: auth.at,
        bl: auth.bl,
        fSid: auth.fSid,
        authuser: String(auth.authuser ?? '0'),
        fetchedAt: Date.now(),
      },
    })
    return auth
  } catch (e) {
    if (e && typeof e === 'object' && 'code' in e && e.code === 'NOTEBOOKLM_AUTH') {
      await clearNotebooklmAuthCache()
    }
    throw e
  }
}

/**
 * Chunked batchexecute body decoder (subset of notebooklm-kit chunked-decoder).
 * @param {string} raw
 * @returns {Array<{ id: string, index: number, data: unknown }>}
 */
export function parseChunkedResponse(raw) {
  let data = raw.trim().replace(/^\)\]\}'/, '')
  const lines = data.split('\n')
  const chunks = []
  let collecting = false
  let chunkSize = 0
  /** @type {string[]} */
  let chunkData = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!collecting && line.trim() === '') continue
    if (!collecting) {
      const size = parseInt(line.trim(), 10)
      if (Number.isNaN(size)) {
        if (line.trim().startsWith('{') || line.trim().startsWith('[')) {
          chunks.push(line)
        }
        continue
      }
      chunkSize = size
      collecting = true
      chunkData = []
      continue
    }
    chunkData.push(line)
    const currentSize = chunkData.join('\n').length
    if (currentSize >= chunkSize) {
      chunks.push(chunkData.join('\n'))
      collecting = false
      chunkSize = 0
      chunkData = []
    }
  }
  if (collecting && chunkData.length > 0) {
    chunks.push(chunkData.join('\n'))
  }
  if (chunks.length === 0 && lines.length > 0) {
    const allData = lines.join('\n')
    if (allData.trim()) chunks.push(allData)
  }

  return processChunks(chunks)
}

/**
 * @param {string[]} chunks
 * @returns {Array<{ id: string, index: number, data: unknown }>}
 */
function processChunks(chunks) {
  if (chunks.length === 0) throw new Error('No chunks in batchexecute response')
  /** @type {Array<{ id: string, index: number, data: unknown }>} */
  const allResponses = []
  for (const chunk of chunks) {
    const trimmed = chunk.trim()
    if (/^\d+$/.test(trimmed) && trimmed.length <= 10) {
      const code = parseInt(trimmed, 10)
      if (code !== 0 && code !== 1) {
        allResponses.push({ index: 0, id: 'numeric', data: code })
      }
      continue
    }
    try {
      let data
      try {
        data = JSON.parse(chunk)
      } catch {
        const unescaped = chunk.replace(/\\"/g, '"').replace(/\\\\/g, '\\')
        data = JSON.parse(unescaped)
      }
      let responseArrays
      if (Array.isArray(data)) {
        responseArrays = data.length > 0 && Array.isArray(data[0]) ? data : [data]
      } else {
        continue
      }
      allResponses.push(...extractResponses(responseArrays))
    } catch {
      if (chunk.includes('wrb.fr')) {
        const manual = extractWrbFromBrokenChunk(chunk)
        if (manual) allResponses.push(manual)
      }
    }
  }
  if (allResponses.length === 0) throw new Error('No valid wrb.fr responses in chunks')
  return allResponses
}

/**
 * @param {unknown[]} data
 */
function extractResponses(data) {
  /** @type {Array<{ id: string, index: number, data: unknown }>} */
  const responses = []
  for (const rpcData of data) {
    if (!Array.isArray(rpcData) || rpcData.length < 3) continue
    if (rpcData[0] !== 'wrb.fr') continue
    const id = rpcData[1]
    if (!id) continue
    const response = { id, index: 0, data: /** @type {unknown} */ (null) }
    let responseData = null
    if (rpcData[2] != null) {
      if (typeof rpcData[2] === 'string') {
        response.data = rpcData[2]
        responseData = rpcData[2]
      } else {
        responseData = rpcData[2]
      }
    }
    if (responseData === null && rpcData.length > 5 && rpcData[5] != null) {
      responseData = rpcData[5]
    }
    if (responseData !== null && response.data === null) {
      response.data = responseData
    }
    if (rpcData.length > 6) {
      if (rpcData[6] === 'generic') response.index = 0
      else if (typeof rpcData[6] === 'string') {
        response.index = parseInt(rpcData[6], 10) || 0
      }
    }
    responses.push(response)
  }
  return responses
}

/**
 * @param {string} chunk
 * @returns {{ id: string, index: number, data: unknown } | null}
 */
function extractWrbFromBrokenChunk(chunk) {
  try {
    const data = JSON.parse(chunk)
    if (Array.isArray(data)) {
      const r = extractResponses([data])
      if (r.length > 0) return r[0]
    }
  } catch {
    /* continue */
  }
  const wrbIndex = chunk.indexOf('wrb.fr')
  if (wrbIndex < 0) return null
  let idStart = wrbIndex + 6
  while (idStart < chunk.length && /[,"\s]/.test(chunk[idStart])) idStart++
  let idEnd = idStart
  while (idEnd < chunk.length && chunk[idEnd] !== '"' && chunk[idEnd] !== ',' && chunk[idEnd] !== ' ') {
    idEnd++
  }
  if (idStart >= idEnd) return null
  const id = chunk.substring(idStart, idEnd)
  const arrayStart = chunk.indexOf('[', idEnd)
  if (arrayStart >= 0) {
    const arrayEnd = findJsonEnd(chunk, arrayStart, '[', ']')
    if (arrayEnd > arrayStart) {
      const jsonData = chunk.substring(arrayStart, arrayEnd)
      try {
        return { index: 0, id, data: JSON.parse(jsonData) }
      } catch {
        return { index: 0, id, data: jsonData }
      }
    }
  }
  return { index: 0, id, data: null }
}

/**
 * @param {string} s
 * @param {number} start
 * @param {string} openChar
 * @param {string} closeChar
 */
function findJsonEnd(s, start, openChar, closeChar) {
  let count = 0
  let inQuotes = false
  let escaped = false
  for (let i = start; i < s.length; i++) {
    const c = s[i]
    if (escaped) {
      escaped = false
      continue
    }
    if (c === '\\' && inQuotes) {
      escaped = true
      continue
    }
    if (c === '"') {
      inQuotes = !inQuotes
      continue
    }
    if (!inQuotes) {
      if (c === openChar) count++
      else if (c === closeChar) {
        count--
        if (count === 0) return i + 1
      }
    }
  }
  return s.length
}

/**
 * Parses the first complete JSON value when the rest of the body is extra chunks (common with `rt=c`).
 * @param {string} text
 * @returns {{ value: unknown, rest: string } | null}
 */
function parseFirstJsonValue(text) {
  const t = text.trim()
  if (!t.length) return null
  const open = t[0]
  if (open !== '[' && open !== '{') return null
  /** @type {string[]} */
  const stack = []
  let inString = false
  let escape = false
  for (let i = 0; i < t.length; i++) {
    const c = t[i]
    if (escape) {
      escape = false
      continue
    }
    if (c === '\\' && inString) {
      escape = true
      continue
    }
    if (c === '"') {
      inString = !inString
      continue
    }
    if (inString) continue
    if (c === '[') stack.push(']')
    else if (c === '{') stack.push('}')
    else if (c === ']' || c === '}') {
      if (stack.length === 0) return null
      const expected = stack.pop()
      if (expected !== c) return null
      if (stack.length === 0) {
        const slice = t.slice(0, i + 1)
        try {
          return { value: JSON.parse(slice), rest: t.slice(i + 1).trim() }
        } catch {
          return null
        }
      }
    }
  }
  return null
}

/**
 * @param {string} raw
 * @returns {Array<{ id: string, index: number, data: unknown }>}
 */
export function decodeBatchexecuteBody(raw) {
  let text = raw.trim().replace(/^\)\]\}'/, '')
  if (!text) throw new Error('Empty batchexecute body')

  if (/^\d/.test(text)) {
    return parseChunkedResponse(raw)
  }

  try {
    const responses = JSON.parse(text)
    return decodeWrbResponseArray(responses)
  } catch (e) {
    const trimmed = text.trim()
    const code = parseInt(trimmed, 10)
    if (!Number.isNaN(code) && trimmed.length <= 10) {
      return [{ index: 0, id: 'numeric', data: code }]
    }

    const first = parseFirstJsonValue(text)
    if (first && Array.isArray(first.value)) {
      const data = first.value
      const responseArrays = data.length > 0 && Array.isArray(data[0]) ? data : [data]
      const firstPart = extractResponses(responseArrays)
      if (firstPart.length > 0) {
        if (!first.rest) return firstPart
        try {
          const more = parseChunkedResponse(first.rest)
          return [...firstPart, ...more]
        } catch {
          return firstPart
        }
      }
    }

    try {
      return parseChunkedResponse(raw)
    } catch {
      throw new Error(`Failed to parse batchexecute JSON: ${e instanceof Error ? e.message : e}`)
    }
  }
}

function decodeWrbResponseArray(responses) {
  if (!Array.isArray(responses)) {
    throw new Error('Unexpected batchexecute shape')
  }

  const result = []
  for (const rpcData of responses) {
    if (!Array.isArray(rpcData) || rpcData.length < 7) continue
    if (rpcData[0] !== 'wrb.fr') continue
    const id = rpcData[1]
    const response = { id, index: 0, data: /** @type {unknown} */ (null) }
    let responseData = null
    if (rpcData[2] != null) {
      if (typeof rpcData[2] === 'string') {
        response.data = rpcData[2]
        responseData = rpcData[2]
      } else {
        responseData = rpcData[2]
      }
    }
    if (responseData === null && rpcData.length > 5 && rpcData[5] != null) {
      responseData = rpcData[5]
    }
    if (responseData !== null && response.data === null) {
      response.data = responseData
    }
    if (rpcData[6] === 'generic') response.index = 0
    else if (typeof rpcData[6] === 'string') {
      response.index = parseInt(rpcData[6], 10) || 0
    }
    result.push(response)
  }
  if (result.length === 0) throw new Error('No wrb.fr entries in batchexecute response')
  return result
}

/**
 * @param {unknown} data
 * @returns {{ id: string, name: string, emoji?: string }[] | null}
 */
export function extractNotebooksFromJson(data) {
  const found = []
  const seen = new Set()
  function walk(obj, depth) {
    if (depth > 22 || obj == null) return
    if (typeof obj !== 'object') return
    if (Array.isArray(obj)) {
      for (const item of obj) walk(item, depth + 1)
      return
    }
    const pid = typeof obj.projectId === 'string' ? obj.projectId : obj.project_id
    const title =
      typeof obj.title === 'string'
        ? obj.title
        : typeof obj.name === 'string'
          ? obj.name
          : ''
    const emojiRaw =
      typeof obj.emoji === 'string'
        ? obj.emoji
        : typeof obj.emojiChar === 'string'
          ? obj.emojiChar
          : undefined
    const emoji = normalizeRpcEmoji(emojiRaw)
    if (
      typeof pid === 'string' &&
      pid.length >= 6 &&
      typeof title === 'string' &&
      title.length > 0 &&
      title.length < 500
    ) {
      if (!seen.has(pid)) {
        seen.add(pid)
        const row = { id: pid, name: title }
        if (emoji) row.emoji = emoji
        found.push(row)
      }
    }
    for (const k of Object.keys(obj)) walk(obj[k], depth + 1)
  }
  walk(data, 0)
  return found.length > 0 ? found : null
}

/**
 * @param {string} text
 * @returns {{ id: string, name: string }[] | null}
 */
export function extractNotebooksFromLooseText(text) {
  if (!text || text.length < 40 || !/projectId|project_id/i.test(text)) return null
  const found = []
  const seen = new Set()
  const add = (id, name) => {
    if (!id || id.length < 6 || !name || seen.has(id)) return
    seen.add(id)
    found.push({ id, name: name.slice(0, 499) })
  }
  const rePair =
    /"projectId"\s*:\s*"([^"\\]{6,})"[\s\S]{0,4000}?"title"\s*:\s*"((?:[^"\\]|\\.)*)"/g
  let m
  while ((m = rePair.exec(text)) !== null) {
    add(m[1], m[2].replace(/\\(.)/g, '$1'))
  }
  const reSnake =
    /"project_id"\s*:\s*"([^"\\]{6,})"[\s\S]{0,4000}?"title"\s*:\s*"((?:[^"\\]|\\.)*)"/g
  while ((m = reSnake.exec(text)) !== null) {
    add(m[1], m[2].replace(/\\(.)/g, '$1'))
  }
  return found.length > 0 ? found : null
}

/**
 * wXbhsf list format: rows like [title, sources[]|null, projectId, emoji, ...] (notebooklm-kit).
 * @param {unknown} data
 * @returns {{ id: string, name: string, emoji?: string }[]}
 */
export function extractNotebooksFromTupleRows(data) {
  const out = []
  const seen = new Set()
  function isUuid(s) {
    return isUuidShape(s)
  }
  function walk(node) {
    if (node == null) return
    if (Array.isArray(node)) {
      if (node.length >= 3) {
        const title = node[0]
        const mid = node[1]
        const pid = node[2]
        if (typeof title === 'string' && (Array.isArray(mid) || mid === null) && isUuid(pid)) {
          if (!seen.has(pid)) {
            seen.add(pid)
            const emoji = node.length >= 4 ? normalizeRpcEmoji(node[3]) : undefined
            const row = { id: pid, name: title.trim() || 'Untitled notebook' }
            if (emoji) row.emoji = emoji
            out.push(row)
          }
        }
      }
      for (const x of node) walk(x)
    }
  }
  walk(data)
  return out
}

/**
 * @param {unknown} data
 * @returns {{ id: string, name: string, emoji?: string }[]}
 */
export function notebooksFromListRpcPayload(data) {
  if (data == null) return []
  if (typeof data === 'string') {
    try {
      let parsed = JSON.parse(data)
      if (typeof parsed === 'string') {
        try {
          parsed = JSON.parse(parsed)
        } catch {
          /* single layer */
        }
      }
      const fromTuple = extractNotebooksFromTupleRows(parsed)
      if (fromTuple.length) return fromTuple
      const fromWalk = extractNotebooksFromJson(parsed)
      if (fromWalk?.length) return fromWalk
    } catch {
      /* loose */
    }
    const loose = extractNotebooksFromLooseText(data)
    return loose ?? []
  }
  const fromTuple = extractNotebooksFromTupleRows(data)
  if (fromTuple.length) return fromTuple
  const fromWalk = extractNotebooksFromJson(data)
  if (fromWalk?.length) return fromWalk
  const loose = extractNotebooksFromLooseText(JSON.stringify(data))
  return loose ?? []
}

/**
 * @param {{ at: string, bl: string, fSid: string, authuser: string }} auth
 * @returns {Promise<{ id: string, name: string }[]>}
 */
/**
 * Inner payload for izAoDd: one URL uses triple-wrapped tuple; multiple URLs use double-wrapped list of tuples.
 * @param {string[]} urls
 * @param {string} projectId
 * @returns {unknown[]}
 */
export function buildAddUrlSourcesInnerPayload(urls, projectId) {
  const tuples = urls.map((u) => [null, null, [u]])
  // Inner JSON must match captures: single `[[[null,null,[url]]],uuid,[2]]` → first slot is [tuple];
  // multi `[[[null,null,[u1]],...],uuid,[2]]` → first slot is tuples[] (no extra [tuples] wrap).
  const head = tuples.length === 1 ? [tuples[0]] : tuples
  return [head, projectId, URL_SOURCE_KIND]
}

/**
 * @param {{ at: string, bl: string, fSid: string, authuser: string }} auth
 * @param {string} projectId NotebookLM project UUID
 * @param {string[]} urls
 * @returns {Promise<void>}
 */
export async function executeAddUrlSourcesRpc(auth, projectId, urls) {
  if (!urls.length) throw new Error('No URLs to add')
  if (!isNotebooklmProjectId(projectId)) throw new Error('Invalid notebook project id')

  const innerPayload = buildAddUrlSourcesInnerPayload(urls, projectId)
  const innerStr = JSON.stringify(innerPayload)

  const url = new URL(NOTEBOOKLM_ORIGIN + BATCH_PATH)
  url.searchParams.set('rpcids', RPC_ADD_URL_SOURCES)
  url.searchParams.set('_reqid', nextReqId())
  url.searchParams.set('bl', auth.bl)
  url.searchParams.set('f.sid', auth.fSid)
  url.searchParams.set('hl', 'en')
  url.searchParams.set('authuser', auth.authuser ?? '0')
  url.searchParams.set('source-path', '/')

  const rpcEnvelope = [[RPC_ADD_URL_SOURCES, innerStr, null, 'generic']]
  const reqBody = JSON.stringify([rpcEnvelope])
  const formData = new URLSearchParams()
  formData.set('f.req', reqBody)
  formData.set('at', auth.at)

  const ua =
    typeof navigator !== 'undefined' && navigator.userAgent
      ? navigator.userAgent
      : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

  const res = await fetch(url.toString(), {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      Origin: NOTEBOOKLM_ORIGIN,
      Referer: NOTEBOOKLM_ORIGIN + '/',
      'X-Same-Domain': '1',
      Accept: '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      'User-Agent': ua,
    },
    body: formData.toString(),
  })

  const bodyText = await res.text()
  if (!res.ok) {
    throw new Error(`batchexecute HTTP ${res.status}`)
  }

  const decoded = decodeBatchexecuteBody(bodyText)
  const match = decoded.find((r) => r.id === RPC_ADD_URL_SOURCES) ?? decoded[0]
  if (!match || match.id === 'numeric') {
    throw new Error('Unexpected add-source RPC response')
  }
}

/**
 * @param {string} projectId
 * @param {string[]} urls
 * @returns {Promise<{ ok: true } | { ok: false, reason: string, hint?: string }>}
 */
export async function importUrlsToNotebooklmProject(projectId, urls) {
  const clean = urls.map((u) => String(u).trim()).filter(Boolean)
  if (!clean.length) {
    return { ok: false, reason: 'empty', hint: 'No URLs to import.' }
  }
  if (!isNotebooklmProjectId(projectId)) {
    return { ok: false, reason: 'invalid_project', hint: 'Not a NotebookLM notebook id.' }
  }
  try {
    const auth = await fetchAuthFromNotebooklmPage('0')
    await executeAddUrlSourcesRpc(auth, projectId, clean)
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (e && typeof e === 'object' && 'code' in e && e.code === 'NOTEBOOKLM_AUTH') {
      return {
        ok: false,
        reason: 'auth',
        hint: 'Sign in to Google and open NotebookLM in Chrome at least once.',
      }
    }
    return { ok: false, reason: 'error', hint: msg }
  }
}

/**
 * @param {unknown} data
 * @returns {string}
 */
function parseProjectIdFromCreateResponse(data) {
  if (data == null) throw new Error('Empty create response')
  let parsed = data
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed)
    } catch {
      /* use as-is */
    }
  }
  const uuidRe = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i
  function findId(x) {
    if (typeof x === 'string' && uuidRe.test(x)) return x
    if (Array.isArray(x)) {
      if (x.length > 2 && typeof x[2] === 'string' && uuidRe.test(x[2])) return x[2]
      for (const item of x) {
        const id = findId(item)
        if (id) return id
      }
    }
    return null
  }
  const id = findId(parsed)
  if (!id) throw new Error('Could not extract project ID from create response')
  return id
}

/**
 * @param {{ at: string, bl: string, fSid: string, authuser: string }} auth
 * @param {string} title
 * @returns {Promise<{ id: string, name: string }>}
 */
export async function executeCreateNotebookRpc(auth, title) {
  const safeTitle =
    typeof title === 'string' && title.trim() ? title.trim().slice(0, 100) : 'Untitled notebook'
  const args = [safeTitle, null, null, [2], CREATE_TAIL]
  const innerStr = JSON.stringify(args)

  const url = new URL(NOTEBOOKLM_ORIGIN + BATCH_PATH)
  url.searchParams.set('rpcids', RPC_CREATE_PROJECT)
  url.searchParams.set('_reqid', nextReqId())
  url.searchParams.set('bl', auth.bl)
  url.searchParams.set('f.sid', auth.fSid)
  url.searchParams.set('hl', 'en')
  url.searchParams.set('authuser', auth.authuser ?? '0')
  url.searchParams.set('source-path', '/')

  const rpcEnvelope = [[RPC_CREATE_PROJECT, innerStr, null, 'generic']]
  const reqBody = JSON.stringify([rpcEnvelope])
  const formData = new URLSearchParams()
  formData.set('f.req', reqBody)
  formData.set('at', auth.at)

  const ua =
    typeof navigator !== 'undefined' && navigator.userAgent
      ? navigator.userAgent
      : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

  const res = await fetch(url.toString(), {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      Origin: NOTEBOOKLM_ORIGIN,
      Referer: NOTEBOOKLM_ORIGIN + '/',
      'X-Same-Domain': '1',
      Accept: '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      'User-Agent': ua,
    },
    body: formData.toString(),
  })

  const bodyText = await res.text()
  if (!res.ok) {
    throw new Error(`batchexecute HTTP ${res.status}`)
  }

  const decoded = decodeBatchexecuteBody(bodyText)
  const match = decoded.find((r) => r.id === RPC_CREATE_PROJECT) ?? decoded[0]
  if (!match || match.id === 'numeric') {
    throw new Error('Unexpected create-notebook RPC response')
  }

  const projectId = parseProjectIdFromCreateResponse(match.data)
  return { id: projectId, name: safeTitle }
}

/**
 * @param {string} title
 * @returns {Promise<{ ok: true, id: string, name: string } | { ok: false, reason?: string, hint?: string }>}
 */
export async function createNotebookOnNotebooklm(title) {
  try {
    const auth = await fetchAuthFromNotebooklmPage('0')
    const notebook = await executeCreateNotebookRpc(auth, title)
    return { ok: true, ...notebook }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (e && typeof e === 'object' && 'code' in e && e.code === 'NOTEBOOKLM_AUTH') {
      return {
        ok: false,
        reason: 'auth',
        hint: 'Sign in to Google and open NotebookLM in Chrome at least once.',
      }
    }
    return { ok: false, reason: 'error', hint: msg }
  }
}

export async function executeListNotebooksRpc(auth) {
  const url = new URL(NOTEBOOKLM_ORIGIN + BATCH_PATH)
  url.searchParams.set('rpcids', RPC_LIST_MY_NOTEBOOKS)
  url.searchParams.set('_reqid', nextReqId())
  url.searchParams.set('bl', auth.bl)
  url.searchParams.set('f.sid', auth.fSid)
  url.searchParams.set('hl', 'en')
  url.searchParams.set('authuser', auth.authuser ?? '0')
  url.searchParams.set('source-path', '/')

  const rpcEnvelope = [[RPC_LIST_MY_NOTEBOOKS, JSON.stringify(LIST_ARGS), null, 'generic']]
  const reqBody = JSON.stringify([rpcEnvelope])
  const formData = new URLSearchParams()
  formData.set('f.req', reqBody)
  formData.set('at', auth.at)

  const ua =
    typeof navigator !== 'undefined' && navigator.userAgent
      ? navigator.userAgent
      : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

  const res = await fetch(url.toString(), {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      Origin: NOTEBOOKLM_ORIGIN,
      Referer: NOTEBOOKLM_ORIGIN + '/',
      'X-Same-Domain': '1',
      Accept: '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      'User-Agent': ua,
    },
    body: formData.toString(),
  })

  const bodyText = await res.text()
  if (!res.ok) {
    throw new Error(`batchexecute HTTP ${res.status}`)
  }

  const decoded = decodeBatchexecuteBody(bodyText)
  const match = decoded.find((r) => r.id === RPC_LIST_MY_NOTEBOOKS) ?? decoded[0]
  if (!match || match.id === 'numeric') {
    throw new Error('Unexpected list RPC response')
  }

  return notebooksFromListRpcPayload(match.data)
}

/**
 * @returns {Promise<{ ok: true, notebooks: { id: string, name: string }[], from: 'rpc' } | { ok: false, reason: string, hint?: string }>}
 */
export async function listNotebooksFromNotebooklm() {
  try {
    const auth = await fetchAuthFromNotebooklmPage('0')
    const notebooks = await executeListNotebooksRpc(auth)
    return { ok: true, notebooks, from: 'rpc' }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (e && typeof e === 'object' && 'code' in e && e.code === 'NOTEBOOKLM_AUTH') {
      return {
        ok: false,
        reason: 'auth',
        hint: 'Sign in to Google and open NotebookLM in Chrome at least once.',
      }
    }
    return {
      ok: false,
      reason: 'error',
      hint: msg,
    }
  }
}
