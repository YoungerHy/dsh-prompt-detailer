/**
 * dsh-prompt-detailer — Host half.
 *
 * Turns a rough user request into a detailed, executable prompt through any
 * OpenAI-compatible chat endpoint. Use any provider (Volcano Ark, OpenAI,
 * Ollama, a local relay) by setting baseUrl/model/apiKey.
 *
 * The host owns three things:
 *   1. a JSON config file under ~/.dsh/prompt-detailer/config.json;
 *   2. five loopback HTTP routes consumed by the Web client half;
 *   3. a `refine_prompt` tool so the agent can use the same pipeline.
 *
 * All visible failures are mapped to stable error codes; the client renders
 * the message verbatim. Nothing here writes outside the config directory.
 */

import { mkdir, readFile, writeFile, rename } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

export const name = 'dsh-prompt-detailer'

/** The agent-facing tool needs the tools service; web routes are optional. */
export const inject = ['tools']

const CONFIG_DIR = join(homedir(), '.dsh', 'prompt-detailer')
const CONFIG_FILE = join(CONFIG_DIR, 'config.json')

const MAX_BODY_BYTES = 512 * 1024
const MAX_PROMPT_CHARS = 20000
const MIN_TIMEOUT_MS = 5_000
const MAX_TIMEOUT_MS = 180_000

/** Default rewrite strategy. Kept free of backticks so it survives any transport. */
export const DEFAULT_SYSTEM_PROMPT = [
  '你是资深提示词工程师。用户会给你一段口语化的「原始需求」；请把它改写成一份可以直接交给 AI Agent 执行的任务提示词。',
  '',
  '关键：输出的读者是 AI Agent，不是人类产品经理。请用第二人称「你」对执行者说话，写清楚要做什么、怎么做、交付什么，而不是写 PRD 或需求文档。',
  '',
  '结构（按需取舍，不必强行凑满）：',
  '1. 角色与目标',
  '2. 任务与范围',
  '3. 输入与上下文',
  '4. 执行步骤',
  '5. 输出格式',
  '6. 约束与边界',
  '7. 验收标准',
  '8. 待确认信息',
  '',
  '规则：',
  '- 只输出提示词本身：不要解释、不要寒暄、不要用 Markdown 代码围栏包裹整段。',
  '- 保留原始需求中的全部明确信息；缺失的信息不要编造，统一写成【待确认：…】。',
  '- 使用与原始需求相同的语言（默认中文）。',
  '- 把含糊动词改成可验证的动作；能给出文件路径、命令、示例时就给出。',
  '- 控制在 300–1500 字，信息密度优先，不写空话。',
].join('\n')

/**
 * The same rewrite instruction, repeated in the user message. Some local
 * relays (notably Doubao web adapters) drop or ignore the system role, and
 * without this the model answers the request itself instead of rewriting it.
 */
const USER_INSTRUCTION = [
  '你是一名提示词工程师。请把下面的原始需求改写成一份可以直接交给 AI Agent 执行的任务提示词，而不是需求文档/PRD。',
  '用第二人称“你”对执行者说话；按需包含：角色与目标、任务与范围、输入与上下文、执行步骤、输出格式、约束与边界、验收标准；缺失信息用【待确认：…】标出。',
  '只输出改写后的提示词本身，不要解释、不要寒暄、不要用代码围栏包裹。',
].join('')

export const DEFAULT_CONFIG = Object.freeze({
  baseUrl: 'http://127.0.0.1:8000/v1',
  model: 'gpt-4o-mini',
  apiKey: '',
  timeoutMs: 90_000,
  temperature: 0.3,
  maxTokens: 2400,
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
})

/** Candidate local bridges probed by GET /prompt-detailer/status. */
const KNOWN_BACKENDS = [
  'http://127.0.0.1:8000/v1',
  'http://127.0.0.1:11434/v1',
  'http://127.0.0.1:1234/v1',
]

class DshError extends Error {
  constructor(code, message, status = 400) {
    super(message)
    this.code = code
    this.status = status
  }
}

/** Map an upstream HTTP failure to an actionable, localized message. */
function upstreamFailure(status, raw) {
  const detail = String(raw).slice(0, 400).replace(/\s+/g, ' ').trim()
  if (status === 401 || status === 403) {
    return new DshError('auth', `鉴权失败（HTTP ${status}）：请检查 API Key 是否正确、是否拥有该模型权限。`, status)
  }
  if (status === 404) {
    return new DshError('not-found', '接口不存在（HTTP 404）：请检查 baseUrl 是否包含 /v1，或模型名是否写错。', 404)
  }
  if (status === 429) {
    return new DshError('rate-limit', '后端限流或额度不足（HTTP 429）：请稍后重试，或换一个模型/密钥。', 429)
  }
  if (status >= 500) {
    return new DshError('upstream', `后端错误（HTTP ${status}）：${detail}`, 502)
  }
  return new DshError('upstream', `后端返回 HTTP ${status}：${detail}`, 502)
}

function clampInt(value, fallback, min, max) {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.floor(n)))
}

function normalizeBaseUrl(value) {
  const text = typeof value === 'string' ? value.trim() : ''
  if (!/^https?:\/\//i.test(text)) {
    throw new DshError('invalid-config', 'baseUrl 必须是 http(s) 地址，例如 http://127.0.0.1:8000/v1')
  }
  return text.replace(/\/+$/, '')
}

/** Merge a partial update onto a validated config; throws readable errors. */
function mergeConfig(base, patch) {
  const next = { ...base }
  if (patch === null || typeof patch !== 'object') return next
  if ('baseUrl' in patch) next.baseUrl = normalizeBaseUrl(patch.baseUrl)
  if ('model' in patch) {
    const model = typeof patch.model === 'string' ? patch.model.trim() : ''
    if (model === '' || model.length > 200) throw new DshError('invalid-config', 'model 不能为空且不超过 200 字符')
    next.model = model
  }
  if ('apiKey' in patch) {
    const key = typeof patch.apiKey === 'string' ? patch.apiKey.trim() : ''
    if (key.length > 500) throw new DshError('invalid-config', 'apiKey 过长')
    next.apiKey = key
  }
  if ('timeoutMs' in patch) next.timeoutMs = clampInt(patch.timeoutMs, next.timeoutMs, MIN_TIMEOUT_MS, MAX_TIMEOUT_MS)
  if ('temperature' in patch) {
    const t = Number(patch.temperature)
    if (!Number.isFinite(t) || t < 0 || t > 2) throw new DshError('invalid-config', 'temperature 必须在 0–2 之间')
    next.temperature = t
  }
  if ('maxTokens' in patch) next.maxTokens = clampInt(patch.maxTokens, next.maxTokens, 64, 8192)
  if ('systemPrompt' in patch) {
    const text = typeof patch.systemPrompt === 'string' ? patch.systemPrompt.trim() : ''
    if (text.length > 8000) throw new DshError('invalid-config', 'systemPrompt 过长（上限 8000 字符）')
    next.systemPrompt = text === '' ? DEFAULT_SYSTEM_PROMPT : text
  }
  return next
}

function envDefaults() {
  const out = {}
  const base = process.env.DSH_PROMPT_DETAILER_BASE_URL
  const model = process.env.DSH_PROMPT_DETAILER_MODEL
  const key = process.env.DSH_PROMPT_DETAILER_API_KEY
  if (base) out.baseUrl = base
  if (model) out.model = model
  if (key) out.apiKey = key
  return out
}

async function ensureConfigFile() {
  try {
    await mkdir(CONFIG_DIR, { recursive: true })
  } catch {
    return
  }
  try {
    await readFile(CONFIG_FILE, 'utf8')
  } catch {
    try {
      await writeFile(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2) + '\n', 'utf8')
    } catch {
      // A read-only home is not fatal: defaults still work in memory.
    }
  }
}

/** Effective config: defaults <- environment <- config file <- row config. */
async function loadConfig(rowConfig) {
  let fileConfig = {}
  try {
    const raw = await readFile(CONFIG_FILE, 'utf8')
    const parsed = JSON.parse(raw)
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) fileConfig = parsed
  } catch {
    // Missing or malformed file: keep defaults, never fail a request here.
  }
  let cfg = mergeConfig(DEFAULT_CONFIG, fileConfig)
  // Environment overrides the file so a one-off launch can point at a test or
  // alternate bridge without rewriting the user's saved settings.
  cfg = mergeConfig(cfg, envDefaults())
  if (rowConfig !== undefined) cfg = mergeConfig(cfg, rowConfig)
  return cfg
}

/** Persist a partial config atomically and return the merged result. */
async function persistConfig(patch, rowConfig) {
  const current = await loadConfig(rowConfig)
  const next = mergeConfig(current, patch)
  await mkdir(CONFIG_DIR, { recursive: true })
  const tmp = CONFIG_FILE + '.tmp'
  await writeFile(tmp, JSON.stringify(next, null, 2) + '\n', 'utf8')
  await rename(tmp, CONFIG_FILE)
  return next
}

function chatUrl(baseUrl) {
  const base = baseUrl.replace(/\/+$/, '')
  if (/\/chat\/completions$/i.test(base)) return base
  if (/\/(?:v\d+|api\/v\d+)$/i.test(base)) return base + '/chat/completions'
  return base + '/v1/chat/completions'
}

function modelsUrl(baseUrl) {
  const base = baseUrl.replace(/\/+$/, '')
  if (/\/(?:v\d+|api\/v\d+)$/i.test(base)) return base + '/models'
  return base + '/v1/models'
}

function networkErrorMessage(error, baseUrl) {
  const cause = error && typeof error === 'object' && 'cause' in error ? error.cause : undefined
  const code = cause && typeof cause === 'object' && 'code' in cause ? String(cause.code) : ''
  const detail = code === 'ECONNREFUSED' || code === 'ENOTFOUND' || code === 'EAI_AGAIN'
    ? '连接被拒绝，后端进程似乎没有启动'
    : (cause && typeof cause === 'object' && 'message' in cause ? String(cause.message) : String(error?.message ?? error))
  return `无法连接细化后端 ${baseUrl}（${detail}）。请先启动本地 OpenAI 兼容服务，或在设置里改成你的模型地址（如火山方舟、OpenAI、Ollama）。`
}

function contentOf(json) {
  const candidate = json?.choices?.[0]?.message?.content
  if (typeof candidate === 'string') return candidate
  if (Array.isArray(candidate)) {
    return candidate.map((part) => {
      if (typeof part === 'string') return part
      if (part && typeof part === 'object' && typeof part.text === 'string') return part.text
      return ''
    }).join('')
  }
  if (Array.isArray(json?.content)) {
    return json.content.map((part) => (part && typeof part.text === 'string' ? part.text : '')).join('')
  }
  return ''
}

function stripFence(text) {
  let out = String(text).trim()
  const fenced = /^```[A-Za-z0-9_-]*\s*\n([\s\S]*?)\n```$/.exec(out)
  if (fenced !== null) out = fenced[1].trim()
  return out
}

function chatRequestBody(cfg, text, extra, stream) {
  const userText = USER_INSTRUCTION + '\n\n原始需求：\n"""\n' + text + '\n"""'
    + (typeof extra === 'string' && extra.trim() !== '' ? '\n\n补充要求：' + extra.trim() : '')
  return {
    model: cfg.model,
    stream: Boolean(stream),
    temperature: cfg.temperature,
    max_tokens: cfg.maxTokens,
    messages: [
      { role: 'system', content: cfg.systemPrompt },
      { role: 'user', content: userText },
    ],
  }
}

/**
 * Refine one rough request. Exported so local tests can call it without a host.
 * @param {object} cfg effective config
 * @param {string} text the user's rough request
 * @param {string} [extra] optional extra instruction
 */
export async function refineWithConfig(cfg, text, extra) {
  const startedAt = Date.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), cfg.timeoutMs)
  let response
  try {
    response = await fetch(chatUrl(cfg.baseUrl), {
      method: 'POST',
      headers: {
        'content-type': 'application/json; charset=utf-8',
        ...(cfg.apiKey ? { authorization: 'Bearer ' + cfg.apiKey } : {}),
      },
      body: JSON.stringify(chatRequestBody(cfg, text, extra, false)),
      signal: controller.signal,
    })
  } catch (error) {
    if (controller.signal.aborted) {
      throw new DshError('timeout', `细化后端在 ${Math.round(cfg.timeoutMs / 1000)} 秒内没有返回；可以调大设置里的超时时间。`, 504)
    }
    throw new DshError('backend-unreachable', networkErrorMessage(error, cfg.baseUrl), 503)
  } finally {
    clearTimeout(timer)
  }

  const raw = await response.text()
  if (!response.ok) {
    throw upstreamFailure(response.status, raw)
  }
  let json
  try {
    json = JSON.parse(raw)
  } catch {
    throw new DshError('upstream', '细化后端返回的不是 JSON：' + raw.slice(0, 300), 502)
  }
  const content = stripFence(contentOf(json))
  if (content === '') {
    throw new DshError('upstream', '细化后端返回了空内容；请检查模型名和请求格式。', 502)
  }
  return {
    text: content,
    model: typeof json?.model === 'string' ? json.model : cfg.model,
    backend: (() => {
      try {
        return new URL(cfg.baseUrl).host
      } catch {
        return cfg.baseUrl
      }
    })(),
    elapsedMs: Date.now() - startedAt,
    usage: json?.usage ?? null,
  }
}

/**
 * Streaming variant: forwards each upstream delta to `onDelta` and returns the
 * same shape as `refineWithConfig`. Falls back to a single delta when the
 * backend ignores `stream: true` and answers with plain JSON.
 */
export async function streamRefineWithConfig(cfg, text, extra, onDelta, externalSignal) {
  const startedAt = Date.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), cfg.timeoutMs)
  const forwardAbort = () => controller.abort()
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort()
    else externalSignal.addEventListener('abort', forwardAbort, { once: true })
  }
  const emit = (piece) => {
    if (typeof onDelta !== 'function' || piece === '') return
    try {
      onDelta(piece)
    } catch {
      // A dead client must not turn into a backend error.
    }
  }
  try {
    let response
    try {
      response = await fetch(chatUrl(cfg.baseUrl), {
        method: 'POST',
        headers: {
          'content-type': 'application/json; charset=utf-8',
          ...(cfg.apiKey ? { authorization: 'Bearer ' + cfg.apiKey } : {}),
        },
        body: JSON.stringify(chatRequestBody(cfg, text, extra, true)),
        signal: controller.signal,
      })
    } catch (error) {
      if (controller.signal.aborted) {
        if (externalSignal && externalSignal.aborted) throw new DshError('aborted', '已取消', 499)
        throw new DshError('timeout', `细化后端在 ${Math.round(cfg.timeoutMs / 1000)} 秒内没有返回；可以调大设置里的超时时间。`, 504)
      }
      throw new DshError('backend-unreachable', networkErrorMessage(error, cfg.baseUrl), 503)
    }

    if (!response.ok) {
      const raw = await response.text().catch(() => '')
      throw upstreamFailure(response.status, raw)
    }

    const contentType = (response.headers.get('content-type') || '').toLowerCase()
    if (!contentType.includes('text/event-stream')) {
      const raw = await response.text()
      let json
      try {
        json = JSON.parse(raw)
      } catch {
        throw new DshError('upstream', '细化后端返回的不是 JSON 也不是事件流：' + raw.slice(0, 300), 502)
      }
      const content = stripFence(contentOf(json))
      if (content === '') {
        throw new DshError('upstream', '细化后端返回了空内容；请检查模型名和请求格式。', 502)
      }
      emit(content)
      return {
        text: content,
        model: typeof json?.model === 'string' ? json.model : cfg.model,
        backend: (() => {
          try {
            return new URL(cfg.baseUrl).host
          } catch {
            return cfg.baseUrl
          }
        })(),
        elapsedMs: Date.now() - startedAt,
        usage: json?.usage ?? null,
      }
    }

    if (!response.body) throw new DshError('upstream', '细化后端没有返回可读的事件流。', 502)
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let full = ''
    let usage = null
    let model = cfg.model
    let finished = false
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const separator = /\r?\n\r?\n/
        let match
        while ((match = separator.exec(buffer)) !== null) {
          const frame = buffer.slice(0, match.index)
          buffer = buffer.slice(match.index + match[0].length)
          for (const line of frame.split(/\r?\n/)) {
            if (!line.startsWith('data:')) continue
            const data = line.slice(5).trim()
            if (data === '') continue
            if (data === '[DONE]') {
              finished = true
              break
            }
            let json
            try {
              json = JSON.parse(data)
            } catch {
              continue
            }
            if (json && json.error) {
              const message = typeof json.error?.message === 'string'
                ? json.error.message
                : JSON.stringify(json.error)
              throw new DshError('upstream', '后端在事件流中返回错误：' + message, 502)
            }
            if (typeof json?.model === 'string' && json.model !== '') model = json.model
            const delta = json?.choices?.[0]?.delta
            let piece = ''
            if (typeof delta?.content === 'string') piece = delta.content
            else if (Array.isArray(delta?.content)) {
              piece = delta.content.map((part) => {
                if (typeof part === 'string') return part
                return part && typeof part.text === 'string' ? part.text : ''
              }).join('')
            } else if (typeof json?.choices?.[0]?.message?.content === 'string') {
              piece = json.choices[0].message.content
            }
            if (piece !== '') {
              full += piece
              emit(piece)
            }
            if (json?.usage) usage = json.usage
          }
          if (finished) break
        }
        if (finished) {
          try {
            await reader.cancel()
          } catch {
            // The server may close the stream itself.
          }
          break
        }
      }
    } catch (error) {
      if (error instanceof DshError) throw error
      if (controller.signal.aborted) {
        if (externalSignal && externalSignal.aborted) throw new DshError('aborted', '已取消', 499)
        throw new DshError('timeout', `细化后端在 ${Math.round(cfg.timeoutMs / 1000)} 秒内没有返回完整结果。`, 504)
      }
      throw new DshError('upstream', '读取细化事件流失败：' + (error instanceof Error ? error.message : String(error)), 502)
    } finally {
      try {
        reader.releaseLock()
      } catch {
        // Best effort.
      }
    }

    const content = stripFence(full)
    if (content === '') {
      throw new DshError('upstream', '细化后端的事件流没有返回内容；请检查模型名和请求格式。', 502)
    }
    return {
      text: content,
      model,
      backend: (() => {
        try {
          return new URL(cfg.baseUrl).host
        } catch {
          return cfg.baseUrl
        }
      })(),
      elapsedMs: Date.now() - startedAt,
      usage,
    }
  } finally {
    clearTimeout(timer)
    if (externalSignal) externalSignal.removeEventListener('abort', forwardAbort)
  }
}

async function readBody(req) {
  const chunks = []
  let total = 0
  for await (const chunk of req) {
    total += chunk.length
    if (total > MAX_BODY_BYTES) throw new DshError('too-large', '请求体超过 512KB', 413)
    chunks.push(chunk)
  }
  return Buffer.concat(chunks).toString('utf8')
}

function sendJson(res, status, payload) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  res.end(JSON.stringify(payload))
}

function fail(res, error) {
  if (error instanceof DshError) {
    sendJson(res, error.status, { ok: false, error: { code: error.code, message: error.message } })
    return
  }
  const message = error instanceof Error ? error.message : String(error)
  sendJson(res, 500, { ok: false, error: { code: 'internal', message } })
}

async function probe(baseUrl) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 1800)
  try {
    const response = await fetch(modelsUrl(baseUrl), { signal: controller.signal })
    let models = []
    try {
      const json = await response.json()
      const list = Array.isArray(json?.data) ? json.data : (Array.isArray(json?.models) ? json.models : [])
      models = list.map((m) => (typeof m?.id === 'string' ? m.id : (typeof m?.name === 'string' ? m.name : ''))).filter(Boolean)
    } catch {
      // A reachable server with a non-JSON /models body is still reachable.
    }
    return { url: baseUrl, reachable: true, status: response.status, models: models.slice(0, 40) }
  } catch {
    return { url: baseUrl, reachable: false }
  } finally {
    clearTimeout(timer)
  }
}

/** Never hand the stored API key back to the browser. */
function publicConfig(cfg) {
  const { apiKey, ...rest } = cfg
  return { ...rest, apiKey: '', apiKeySet: Boolean(apiKey) }
}

function registerRoutes(ctx, rowConfig) {
  const routes = [
    {
      name: 'prompt-detailer-refine',
      kind: 'exact',
      path: '/prompt-detailer/refine',
      handler: async (req, res) => {
        if (req.method !== 'POST') {
          res.writeHead(405).end()
          return
        }
        try {
          const raw = await readBody(req)
          let body
          try {
            body = JSON.parse(raw)
          } catch {
            throw new DshError('invalid-body', '请求体必须是 JSON', 400)
          }
          const text = typeof body?.text === 'string' ? body.text.trim() : ''
          if (text === '') throw new DshError('empty', '输入框是空的，请先写下你的需求。', 422)
          if (text.length > MAX_PROMPT_CHARS) {
            throw new DshError('too-long', `需求超过 ${MAX_PROMPT_CHARS} 字符，请先删减。`, 422)
          }
          const cfg = await loadConfig(rowConfig)
          const extra = typeof body?.extra === 'string' ? body.extra : ''
          const value = await refineWithConfig(cfg, text, extra)
          sendJson(res, 200, { ok: true, value })
        } catch (error) {
          fail(res, error)
        }
      },
    },
    {
      name: 'prompt-detailer-refine-stream',
      kind: 'exact',
      path: '/prompt-detailer/refine-stream',
      handler: async (req, res) => {
        if (req.method !== 'POST') {
          res.writeHead(405).end()
          return
        }
        let text = ''
        let extra = ''
        try {
          const raw = await readBody(req)
          let body
          try {
            body = JSON.parse(raw)
          } catch {
            throw new DshError('invalid-body', '请求体必须是 JSON', 400)
          }
          text = typeof body?.text === 'string' ? body.text.trim() : ''
          if (text === '') throw new DshError('empty', '输入框是空的，请先写下你的需求。', 422)
          if (text.length > MAX_PROMPT_CHARS) {
            throw new DshError('too-long', `需求超过 ${MAX_PROMPT_CHARS} 字符，请先删减。`, 422)
          }
          extra = typeof body?.extra === 'string' ? body.extra : ''
        } catch (error) {
          fail(res, error)
          return
        }

        res.writeHead(200, {
          'content-type': 'text/event-stream; charset=utf-8',
          'cache-control': 'no-store, no-transform',
          connection: 'keep-alive',
          'x-accel-buffering': 'no',
        })
        if (typeof res.flushHeaders === 'function') res.flushHeaders()

        let ended = false
        const send = (event, payload) => {
          if (ended || res.writableEnded) return
          try {
            res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`)
          } catch {
            ended = true
          }
        }
        const controller = new AbortController()
        const onClose = () => {
          if (!res.writableEnded) {
            try {
              controller.abort()
            } catch {
              // Best effort.
            }
          }
        }
        res.on('close', onClose)
        try {
          const cfg = await loadConfig(rowConfig)
          const value = await streamRefineWithConfig(
            cfg,
            text,
            extra,
            (piece) => send('delta', { type: 'delta', text: piece }),
            controller.signal,
          )
          send('done', { type: 'done', value })
        } catch (error) {
          if (error?.code === 'aborted' || controller.signal.aborted) {
            // The browser closed the stream; there is no reader left.
          } else {
            const code = error instanceof DshError ? error.code : 'internal'
            const message = error instanceof Error ? error.message : String(error)
            send('error', { type: 'error', error: { code, message } })
          }
        } finally {
          if (typeof res.off === 'function') res.off('close', onClose)
          if (!res.writableEnded) res.end()
        }
      },
    },
    {
      name: 'prompt-detailer-config',
      kind: 'exact',
      path: '/prompt-detailer/config',
      handler: async (req, res) => {
        try {
          if (req.method === 'GET') {
            const cfg = await loadConfig(rowConfig)
            sendJson(res, 200, { ok: true, value: publicConfig(cfg) })
            return
          }
          if (req.method === 'POST') {
            const raw = await readBody(req)
            let patch
            try {
              patch = JSON.parse(raw)
            } catch {
              throw new DshError('invalid-body', '请求体必须是 JSON', 400)
            }
            // An empty key means "leave the stored key alone"; the browser never
            // receives the real key, so it cannot send it back unchanged.
            if (patch !== null && typeof patch === 'object' && patch.apiKey === '') delete patch.apiKey
            const cfg = await persistConfig(patch, rowConfig)
            sendJson(res, 200, { ok: true, value: publicConfig(cfg) })
            return
          }
          res.writeHead(405).end()
        } catch (error) {
          fail(res, error)
        }
      },
    },
    {
      name: 'prompt-detailer-status',
      kind: 'exact',
      path: '/prompt-detailer/status',
      handler: async (_req, res) => {
        try {
          const cfg = await loadConfig(rowConfig)
          const urls = [...new Set([cfg.baseUrl, ...KNOWN_BACKENDS])]
          const candidates = await Promise.all(urls.map((url) => probe(url)))
          sendJson(res, 200, {
            ok: true,
            value: {
              baseUrl: cfg.baseUrl,
              model: cfg.model,
              current: candidates.find((item) => item.url === cfg.baseUrl) ?? { url: cfg.baseUrl, reachable: false },
              candidates,
            },
          })
        } catch (error) {
          fail(res, error)
        }
      },
    },
  ]

  const dispose = []
  for (const route of routes) {
    try {
      dispose.push(ctx.webServer.register(route))
    } catch (error) {
      console.warn(`[prompt-detailer] route ${route.path} skipped: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  return () => {
    for (const fn of dispose) {
      try {
        if (typeof fn === 'function') fn()
      } catch {
        // Disposal is best-effort.
      }
    }
  }
}

function registerTool(ctx, rowConfig) {
  ctx.tools.register({
    name: 'refine_prompt',
    description:
      '用任意 OpenAI 兼容模型把一段粗糙需求改写成更详细、可执行的提示词。'
      + '当用户的需求含糊、缺少约束或希望先把需求写清楚再动手时，可以调用它。'
      + '返回的 prompt 是改写结果；本工具不会提交对话。',
    parameters: {
      type: 'object',
      properties: {
        text: { type: 'string', description: '用户的原始需求。' },
        extra: { type: 'string', description: '可选的补充要求，例如“重点写测试步骤”。' },
      },
      required: ['text'],
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: true,
        properties: {
          prompt: { type: 'string', description: '改写后的详细提示词。' },
          model: { type: 'string' },
          backend: { type: 'string' },
          elapsedMs: { type: 'number' },
        },
        required: ['prompt'],
      },
      render(_args, value) {
        return [{ type: 'text', text: value.prompt }]
      },
    },
    async execute(args) {
      const text = typeof args?.text === 'string' ? args.text.trim() : ''
      if (text === '') throw new Error('text is required')
      const cfg = await loadConfig(rowConfig)
      const value = await refineWithConfig(cfg, text, typeof args?.extra === 'string' ? args.extra : '')
      return {
        prompt: value.text,
        model: value.model,
        backend: value.backend,
        elapsedMs: value.elapsedMs,
      }
    },
  })
}

export function apply(ctx, config) {
  const rowConfig = config !== null && typeof config === 'object' ? config : {}
  // Register the tool synchronously. The host snapshots an Agent's tool set
  // when its `tools` service mounts; an async apply that awaits file setup
  // registers a microtask too late and the tool is missing for the session.
  try {
    registerTool(ctx, rowConfig)
  } catch (error) {
    console.warn(`[prompt-detailer] tool registration skipped: ${error instanceof Error ? error.message : String(error)}`)
  }

  // Seeding the config file is housekeeping; it must never gate activation.
  void ensureConfigFile()

  try {
    ctx.inject(['webServer'], (scope) => {
      try {
        return registerRoutes(scope, rowConfig)
      } catch (error) {
        console.warn(`[prompt-detailer] web routes skipped: ${error instanceof Error ? error.message : String(error)}`)
        return undefined
      }
    })
  } catch (error) {
    console.warn(`[prompt-detailer] webServer injection skipped: ${error instanceof Error ? error.message : String(error)}`)
  }
}
