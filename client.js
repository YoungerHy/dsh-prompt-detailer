/**
 * dsh-prompt-detailer — browser half.
 *
 * Registers a "✨ 细化" button in `conversation.input.right`. Clicking it sends
 * the current composer draft to the host route (which calls the configured model), shows the
 * rewritten prompt in a floating preview, and lets the user fill it back into
 * the composer or fill + submit it as the next agent turn.
 *
 * Everything is wrapped so a missing slot or a failed optional wiring step
 * degrades to "button absent" instead of failing the Web boot.
 */
window.__ModuleLoader__.load({
  id: 'dsh-prompt-detailer',
  factory(require) {
    const React = require('react')
    const ReactDOM = require('react-dom')
    const h = React.createElement

    const BASE = '/prompt-detailer'

    const styles = {
      button: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        height: '28px',
        padding: '0 9px',
        borderRadius: '14px',
        border: '1px solid var(--dsw-color-border, rgba(0,0,0,0.14))',
        background: 'var(--dsw-color-surface-raised, rgba(255,255,255,0.9))',
        color: 'var(--dsw-color-text, #1f2328)',
        fontSize: '12px',
        lineHeight: '1',
        cursor: 'pointer',
        userSelect: 'none',
        whiteSpace: 'nowrap',
        flex: '0 0 auto',
      },
      panel: {
        position: 'fixed',
        left: '50%',
        bottom: '132px',
        transform: 'translateX(-50%)',
        width: 'min(760px, 94vw)',
        maxHeight: '72vh',
        overflow: 'auto',
        zIndex: 2147483000,
        boxSizing: 'border-box',
        padding: '16px',
        borderRadius: '16px',
        border: '1px solid var(--dsw-color-border, rgba(0,0,0,0.14))',
        background: 'var(--dsw-color-surface, #ffffff)',
        color: 'var(--dsw-color-text, #1f2328)',
        boxShadow: '0 18px 50px rgba(0,0,0,0.24)',
        fontSize: '13px',
        lineHeight: 1.55,
      },
      header: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '10px',
      },
      title: { fontSize: '14px', fontWeight: 600, flex: '1 1 auto' },
      chip: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '2px 8px',
        borderRadius: '999px',
        fontSize: '11px',
        border: '1px solid rgba(0,0,0,0.12)',
        background: 'rgba(0,0,0,0.03)',
        whiteSpace: 'nowrap',
      },
      close: {
        border: 'none',
        background: 'transparent',
        color: 'inherit',
        fontSize: '18px',
        lineHeight: '18px',
        cursor: 'pointer',
        padding: '0 2px',
      },
      hint: { color: 'var(--dsw-color-text-secondary, #666)', fontSize: '12px', marginBottom: '8px' },
      textarea: {
        width: '100%',
        minHeight: '170px',
        boxSizing: 'border-box',
        resize: 'vertical',
        padding: '10px 12px',
        borderRadius: '10px',
        border: '1px solid var(--dsw-color-border, rgba(0,0,0,0.16))',
        background: 'var(--dsw-color-surface-sunken, #fafafa)',
        color: 'inherit',
        font: 'inherit',
        lineHeight: 1.55,
      },
      draftBox: {
        maxHeight: '120px',
        overflow: 'auto',
        whiteSpace: 'pre-wrap',
        padding: '10px 12px',
        borderRadius: '10px',
        background: 'rgba(0,0,0,0.035)',
        marginBottom: '10px',
      },
      row: { display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px' },
      primary: {
        padding: '7px 14px',
        borderRadius: '9px',
        border: '1px solid #3B82F6',
        background: '#3B82F6',
        color: '#fff',
        fontWeight: 600,
        cursor: 'pointer',
      },
      secondary: {
        padding: '7px 12px',
        borderRadius: '9px',
        border: '1px solid rgba(0,0,0,0.16)',
        background: 'transparent',
        color: 'inherit',
        cursor: 'pointer',
      },
      danger: { color: '#b42318' },
      meta: { marginTop: '8px', fontSize: '11px', color: 'var(--dsw-color-text-secondary, #777)' },
      details: { marginBottom: '8px' },
      summary: {
        cursor: 'pointer',
        fontSize: '12px',
        color: 'var(--dsw-color-text-secondary, #64748b)',
        marginBottom: '6px',
      },
      warn: {
        margin: '0 0 10px',
        padding: '8px 10px',
        borderRadius: '9px',
        background: 'rgba(245,158,11,0.12)',
        border: '1px solid rgba(245,158,11,0.35)',
        fontSize: '12px',
      },
      settings: {
        marginTop: '12px',
        paddingTop: '10px',
        borderTop: '1px dashed rgba(0,0,0,0.14)',
      },
      field: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '7px' },
      label: { width: '92px', flex: '0 0 auto', fontSize: '12px', color: 'var(--dsw-color-text-secondary, #555)' },
      input: {
        flex: '1 1 auto',
        minWidth: 0,
        padding: '6px 8px',
        borderRadius: '7px',
        border: '1px solid var(--dsw-color-border, rgba(0,0,0,0.16))',
        background: 'var(--dsw-color-surface-sunken, #fafafa)',
        color: 'inherit',
        font: 'inherit',
        fontSize: '12px',
      },
      notice: { marginTop: '8px', fontSize: '12px' },
      streamBox: {
        maxHeight: '220px',
        overflow: 'auto',
        whiteSpace: 'pre-wrap',
        padding: '10px 12px',
        borderRadius: '10px',
        border: '1px solid rgba(59,130,246,0.22)',
        background: 'rgba(59,130,246,0.06)',
        fontSize: '12px',
        lineHeight: 1.55,
        marginTop: '10px',
      },
      templates: {
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '6px',
        marginTop: '9px',
      },
      templateLabel: { fontSize: '11px', color: 'var(--dsw-color-text-secondary, #777)' },
      template: {
        padding: '3px 8px',
        borderRadius: '999px',
        border: '1px solid rgba(0,0,0,0.14)',
        background: 'transparent',
        color: 'inherit',
        fontSize: '11px',
        cursor: 'pointer',
      },
      compare: { display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '8px' },
      compareCol: { flex: '1 1 300px', minWidth: 0 },
      compareLabel: {
        fontSize: '11px',
        color: 'var(--dsw-color-text-secondary, #64748b)',
        marginBottom: '5px',
      },
    }

    /** First-run examples: rough, deliberately short, editable in the composer. */
    const TEMPLATES = [
      { label: '记账插件', text: '帮我做个记账插件，能记每天的花销，月底能看汇总' },
      { label: '生成周报', text: '根据我这周的工作记录生成一份周报' },
      { label: '重构代码', text: '把这段代码重构一下，保持行为不变，补上关键注释' },
    ]

    function readJson(response) {
      return response.json().catch(function () { return null })
    }

    function timeText(ms) {
      if (typeof ms !== 'number' || !isFinite(ms)) return ''
      return (ms / 1000).toFixed(1) + 's'
    }

    /** Consume the host's SSE stream; resolves with the done value. */
    function readRefineStream(response, onDelta) {
      return new Promise(function (resolve, reject) {
        if (!response.body || typeof response.body.getReader !== 'function') {
          reject(new Error('当前浏览器不支持流式读取'))
          return
        }
        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let full = ''
        function pump() {
          reader.read().then(function (result) {
            if (result.done) {
              resolve({ text: full })
              return
            }
            buffer += decoder.decode(result.value, { stream: true })
            const separator = /\r?\n\r?\n/
            let match
            while ((match = separator.exec(buffer)) !== null) {
              const frame = buffer.slice(0, match.index)
              buffer = buffer.slice(match.index + match[0].length)
              let event = 'message'
              const data = []
              frame.split(/\r?\n/).forEach(function (line) {
                if (line.indexOf('event:') === 0) event = line.slice(6).trim()
                else if (line.indexOf('data:') === 0) data.push(line.slice(5).trim())
              })
              if (data.length === 0) continue
              let payload
              try {
                payload = JSON.parse(data.join('\n'))
              } catch {
                continue
              }
              if (event === 'delta' || payload.type === 'delta') {
                if (typeof payload.text === 'string' && payload.text !== '') {
                  full += payload.text
                  onDelta(full)
                }
              } else if (event === 'done' || payload.type === 'done') {
                resolve(payload.value || { text: full })
                return
              } else if (event === 'error' || payload.type === 'error') {
                reject(new Error(payload.error && payload.error.message ? payload.error.message : '细化失败'))
                return
              }
            }
            pump()
          }).catch(reject)
        }
        pump()
      })
    }

    function SettingsForm(props) {
      const [form, setForm] = React.useState({
        baseUrl: props.config ? props.config.baseUrl : '',
        model: props.config ? props.config.model : '',
        apiKey: '',
        timeoutMs: props.config ? props.config.timeoutMs : 90000,
      })
      const [saving, setSaving] = React.useState(false)
      const [message, setMessage] = React.useState('')

      React.useEffect(function () {
        if (!props.config) return
        setForm({
          baseUrl: props.config.baseUrl || '',
          model: props.config.model || '',
          apiKey: '',
          timeoutMs: props.config.timeoutMs || 90000,
        })
      }, [props.config])

      const update = function (key) {
        return function (event) {
          const value = event.target.value
          setForm(function (old) {
            const next = Object.assign({}, old)
            next[key] = value
            return next
          })
        }
      }

      const save = function () {
        setSaving(true)
        setMessage('')
        fetch(BASE + '/config', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            baseUrl: form.baseUrl,
            model: form.model,
            apiKey: form.apiKey,
            timeoutMs: Number(form.timeoutMs),
          }),
        })
          .then(readJson)
          .then(function (json) {
            if (json && json.ok) {
              setMessage('已保存。下一次细化立即生效。')
              if (props.onSaved) props.onSaved(json.value)
            } else {
              setMessage((json && json.error && json.error.message) || '保存失败。')
            }
          })
          .catch(function (error) {
            setMessage('保存失败：' + (error && error.message ? error.message : String(error)))
          })
          .finally(function () { setSaving(false) })
      }

      const clearKey = function () {
        setSaving(true)
        setMessage('')
        fetch(BASE + '/config', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ apiKey: null }),
        })
          .then(readJson)
          .then(function (json) {
            if (json && json.ok) {
              setForm(function (old) { return Object.assign({}, old, { apiKey: '' }) })
              setMessage('已清除已保存的 Key。')
              if (props.onSaved) props.onSaved(json.value)
            } else {
              setMessage((json && json.error && json.error.message) || '清除失败。')
            }
          })
          .catch(function (error) {
            setMessage('清除失败：' + (error && error.message ? error.message : String(error)))
          })
          .finally(function () { setSaving(false) })
      }

      return h('div', { style: styles.settings },
        h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '9px' } },
          h('span', { style: { width: '100%', fontSize: '11px', color: 'var(--dsw-color-text-secondary, #777)' } }, '快速预设：'),
          h('button', { type: 'button', style: styles.secondary, onClick: function () { setForm(function (old) { return Object.assign({}, old, { baseUrl: 'http://127.0.0.1:8000/v1', model: 'gpt-4o-mini' }) }) } }, '本地 8000'),
          h('button', { type: 'button', style: styles.secondary, onClick: function () { setForm(function (old) { return Object.assign({}, old, { baseUrl: 'http://127.0.0.1:11434/v1', model: 'qwen2.5:7b' }) }) } }, 'Ollama'),
          h('button', { type: 'button', style: styles.secondary, onClick: function () { setForm(function (old) { return Object.assign({}, old, { baseUrl: 'https://ark.cn-beijing.volces.com/api/v3' }) }) } }, '火山方舟'),
        ),
        h('div', { style: styles.field },
          h('span', { style: styles.label }, '后端地址'),
          h('input', { style: styles.input, value: form.baseUrl, onChange: update('baseUrl'), placeholder: 'http://127.0.0.1:8000/v1' }),
        ),
        h('div', { style: styles.field },
          h('span', { style: styles.label }, '模型'),
          h('input', { style: styles.input, value: form.model, onChange: update('model'), placeholder: 'gpt-4o-mini' }),
        ),
        h('div', { style: styles.field },
          h('span', { style: styles.label }, 'API Key'),
          h('input', {
            style: styles.input,
            type: 'password',
            value: form.apiKey,
            onChange: update('apiKey'),
            placeholder: props.config && props.config.apiKeySet ? '已保存，留空保持不变' : '本地 relay 可留空',
          }),
          props.config && props.config.apiKeySet
            ? h('button', {
              type: 'button',
              style: Object.assign({}, styles.secondary, { padding: '5px 8px', fontSize: '11px', flex: '0 0 auto' }),
              onClick: clearKey,
              disabled: saving,
            }, '清除')
            : null,
        ),
        props.config && props.config.apiKeySet
          ? h('div', { style: { margin: '-3px 0 6px 100px', fontSize: '11px', color: 'var(--dsw-color-text-secondary, #777)' } }, '出于安全，已保存的 Key 不会回显；要换 Key 直接输入新的。')
          : null,
        h('div', { style: styles.field },
          h('span', { style: styles.label }, '超时 (ms)'),
          h('input', { style: styles.input, type: 'number', min: 5000, max: 180000, step: 1000, value: form.timeoutMs, onChange: update('timeoutMs') }),
        ),
        h('div', { style: styles.row },
          h('button', { type: 'button', style: styles.primary, onClick: save, disabled: saving }, saving ? '保存中…' : '保存设置'),
          props.onTest ? h('button', { type: 'button', style: styles.secondary, onClick: props.onTest }, '测试连接') : null,
        ),
        message ? h('div', { style: styles.notice }, message) : null,
      )
    }

    function PromptDetailerButton(props) {
      // The input.right slot always provides both, but a future host that
      // renames the share should degrade to a disabled button, not a crash.
      const useInput = typeof props.useInput === 'function' ? props.useInput : null
      const draft = useInput
        ? useInput(function (state) {
          return state && typeof state.draft === 'string' ? state.draft : ''
        })
        : ''
      const phase = useInput
        ? useInput(function (state) {
          return state && typeof state.phase === 'string' ? state.phase : 'plain'
        })
        : 'plain'
      const inputActions = props.inputActions && typeof props.inputActions === 'object'
        ? props.inputActions
        : {}
      const [view, setView] = React.useState(null)
      const [busy, setBusy] = React.useState(false)
      const [config, setConfig] = React.useState(null)
      const [status, setStatus] = React.useState(null)
      const [settingsOpen, setSettingsOpen] = React.useState(false)
      const [notice, setNotice] = React.useState('')
      const [elapsed, setElapsed] = React.useState(0)
      const [compare, setCompare] = React.useState(false)
      const abortRef = React.useRef(null)

      const loadInfo = React.useCallback(function () {
        fetch(BASE + '/config').then(readJson).then(function (json) {
          if (json && json.ok) setConfig(json.value)
        }).catch(function () {})
        fetch(BASE + '/status').then(readJson).then(function (json) {
          if (json && json.ok) setStatus(json.value)
        }).catch(function () {})
      }, [])

      React.useEffect(function () {
        if (!view || view.kind !== 'loading') return undefined
        setElapsed(0)
        const timer = window.setInterval(function () {
          setElapsed(function (value) { return value + 1 })
        }, 1000)
        return function () { window.clearInterval(timer) }
      }, [view && view.kind])

      React.useEffect(function () { loadInfo() }, [loadInfo])

      React.useEffect(function () {
        if (!view) return undefined
        const onKeyDown = function (event) {
          if (event.key === 'Escape' && !busy) {
            setView(null)
            setSettingsOpen(false)
          }
        }
        document.addEventListener('keydown', onKeyDown, true)
        return function () { document.removeEventListener('keydown', onKeyDown, true) }
      }, [view, busy])

      const open = function () {
        if (view) {
          if (!busy) {
            setView(null)
            setSettingsOpen(false)
          }
          return
        }
        setNotice('')
        setCompare(false)
        setView({ kind: 'start' })
        loadInfo()
      }

      const start = function () {
        const text = draft.trim()
        if (text === '') {
          setNotice('先在输入框写下你的需求，再点“细化”。')
          return
        }
        if (phase !== 'plain') {
          setNotice('输入框正在处理中，等它空闲再试。')
          return
        }
        if (abortRef.current) {
          try { abortRef.current.abort() } catch (error) { /* stale request */ }
        }
        const controller = new AbortController()
        abortRef.current = controller
        setBusy(true)
        setElapsed(0)
        setNotice('')
        setCompare(false)
        setView({ kind: 'loading', original: text, streamText: '' })
        fetch(BASE + '/refine-stream', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ text: text }),
          signal: controller.signal,
        })
          .then(function (response) {
            if (controller.signal.aborted) return null
            const contentType = (response.headers.get('content-type') || '').toLowerCase()
            if (!response.ok || contentType.indexOf('text/event-stream') === -1) {
              return response.json().catch(function () { return null }).then(function (json) {
                if (controller.signal.aborted) return null
                if (response.ok && json && json.ok) {
                  setView({
                    kind: 'result',
                    original: text,
                    prompt: json.value.text,
                    meta: json.value,
                  })
                  return null
                }
                const message = (json && json.error && json.error.message)
                  || ('请求失败（HTTP ' + response.status + '）')
                setView({ kind: 'error', original: text, message: message })
                return null
              })
            }
            return readRefineStream(response, function (partial) {
              setView(function (old) {
                if (!old || old.kind !== 'loading') return old
                return Object.assign({}, old, { streamText: partial })
              })
            }).then(function (value) {
              if (controller.signal.aborted) return
              const prompt = value && typeof value.text === 'string' ? value.text : ''
              if (prompt === '') {
                setView({
                  kind: 'error',
                  original: text,
                  message: '后端返回了空内容，请检查模型名，或换一个后端再试。',
                })
                return
              }
              setView({ kind: 'result', original: text, prompt: prompt, meta: value })
            })
          })
          .catch(function (error) {
            if (controller.signal.aborted) return
            setView({
              kind: 'error',
              original: text,
              message: '细化失败：' + (error && error.message ? error.message : String(error)),
            })
          })
          .finally(function () {
            if (abortRef.current !== controller) return
            abortRef.current = null
            setBusy(false)
          })
      }

      const cancel = function () {
        if (abortRef.current) {
          try { abortRef.current.abort() } catch (error) { /* already settled */ }
          abortRef.current = null
        }
        setBusy(false)
        setView({ kind: 'start' })
        setNotice('已取消，原文未改动。')
      }

      React.useEffect(function () {
        return function () {
          if (abortRef.current) {
            try { abortRef.current.abort() } catch (error) { /* unmounting */ }
          }
        }
      }, [])

      const fill = function () {
        if (!view || view.kind !== 'result') return
        if (typeof inputActions.setDraft !== 'function') {
          setNotice('当前输入框不支持写入草稿，请手动复制。')
          return
        }
        inputActions.setDraft(view.prompt)
        setNotice('已填入输入框。你可以直接发送、继续编辑，或点“恢复原文”。')
      }

      const restoreOriginal = function () {
        if (!view || view.kind !== 'result') return
        if (typeof inputActions.setDraft !== 'function') return
        inputActions.setDraft(view.original)
        setNotice('已恢复原始需求。')
      }

      const fillAndSend = function () {
        if (!view || view.kind !== 'result') return
        if (typeof inputActions.setDraft !== 'function') {
          setNotice('当前输入框不支持写入草稿，请手动复制。')
          return
        }
        const prompt = view.prompt
        inputActions.setDraft(prompt)
        setView(null)
        if (typeof inputActions.submit !== 'function') {
          setNotice('已填入输入框，请按 Enter 发送。')
          return
        }
        window.setTimeout(function () {
          try {
            inputActions.submit()
          } catch (error) {
            console.warn('[prompt-detailer] submit failed', error)
          }
        }, 250)
      }

      const copy = function () {
        if (!view || view.kind !== 'result') return
        try {
          navigator.clipboard.writeText(view.prompt).then(function () {
            setNotice('已复制。')
          }).catch(function () {})
        } catch (error) {
          console.warn('[prompt-detailer] copy failed', error)
        }
      }

      const editPrompt = function (event) {
        const value = event.target.value
        setView(function (old) {
          if (!old || old.kind !== 'result') return old
          return Object.assign({}, old, { prompt: value })
        })
      }

      const reachable = status && status.current && status.current.reachable
      const meta = (view && view.meta) || {}
      const statusText = reachable
        ? '细化后端已连接'
        : (status ? '未连接细化后端' : '检查后端中…')

      const panel = view
        ? ReactDOM.createPortal(
          h('div', { style: styles.panel, role: 'dialog', 'aria-label': '一句话细化' },
            h('div', { style: styles.header },
              h('span', { style: styles.title }, '✨ 一句话细化'),
              h('span', {
                style: Object.assign({}, styles.chip, reachable ? { borderColor: 'rgba(16,163,74,0.4)' } : {}),
                title: config ? config.baseUrl : '',
              }, (reachable ? '● ' : '○ ') + statusText),
              h('button', { type: 'button', style: styles.close, onClick: function () { if (!busy) { setView(null); setSettingsOpen(false) } }, 'aria-label': '关闭' }, '×'),
            ),

            !reachable && view.kind !== 'loading'
              ? h('div', { style: styles.warn },
                '未检测到可用的细化后端（默认 127.0.0.1:8000）。',
                h('div', { style: { marginTop: '4px' } },
                  '可选：① 启动本地 OpenAI 兼容服务（默认 8000，Ollama 为 11434）；② 在下方设置里改为火山方舟 / OpenAI / Ollama 等地址并填 API Key。',
                ),
                h('div', { style: { marginTop: '8px' } },
                  h('button', { type: 'button', style: styles.secondary, onClick: function () { setSettingsOpen(true) } }, '去配置后端'),
                ),
              )
              : null,

            view.kind === 'start'
              ? h('div', null,
                h('div', { style: styles.hint }, '会先把下面这段粗需求改写成一份更详细、可直接执行的提示词。原始需求不会丢，改写结果先给你预览。'),
                draft.trim()
                  ? h('div', { style: styles.draftBox }, draft.trim())
                  : h('div', { style: Object.assign({}, styles.draftBox, styles.danger) }, '输入框是空的，先写下需求。'),
                h('div', { style: styles.templates },
                  h('span', { style: styles.templateLabel }, '没思路？试试：'),
                  TEMPLATES.map(function (item) {
                    return h('button', {
                      key: item.label,
                      type: 'button',
                      style: styles.template,
                      onClick: function () {
                        if (typeof inputActions.setDraft !== 'function') {
                          setNotice('当前输入框不支持写入草稿，请手动输入。')
                          return
                        }
                        inputActions.setDraft(item.text)
                        setNotice('已填入示例，可修改后点“开始细化”。')
                      },
                    }, item.label)
                  }),
                ),
                h('div', { style: styles.row },
                  h('button', { type: 'button', style: styles.primary, onClick: start, disabled: !draft.trim() }, '开始细化'),
                  h('button', { type: 'button', style: styles.secondary, onClick: function () { setView(null) } }, '取消'),
                ),
              )
              : null,

            view.kind === 'loading'
              ? h('div', { style: { padding: '18px 6px' } },
                h('div', { style: { fontSize: '15px', fontWeight: 600, marginBottom: '6px' } },
                  '⏳ 正在写详细提示词…' + (elapsed > 0 ? '（已等待 ' + elapsed + ' 秒）' : ''),
                ),
                h('div', { style: styles.hint }, '通常需要 10–30 秒；首次调用可能更慢。完成后会在这里预览。'),
                view.streamText
                  ? h('div', { style: styles.streamBox }, view.streamText + '▍')
                  : null,
                h('div', { style: styles.hint }, view.streamText ? '已开始实时输出；可以边看边等，取消不会改动原文。' : ''),
                h('div', { style: styles.row },
                  h('button', { type: 'button', style: styles.secondary, onClick: cancel }, '取消'),
                ),
              )
              : null,

            view.kind === 'error'
              ? h('div', null,
                h('div', { style: Object.assign({}, styles.warn, styles.danger, { background: 'rgba(180,35,24,0.08)', borderColor: 'rgba(180,35,24,0.3)' }) },
                  view.message,
                ),
                h('div', { style: styles.row },
                  h('button', { type: 'button', style: styles.primary, onClick: start }, '重试'),
                  h('button', { type: 'button', style: styles.secondary, onClick: function () { setSettingsOpen(true) } }, '检查设置'),
                  h('button', { type: 'button', style: styles.secondary, onClick: function () { setCompare(false); setView({ kind: 'start' }) } }, '返回'),
                ),
              )
              : null,

            view.kind === 'result'
              ? h('div', null,
                h('div', { style: styles.hint }, '下面是改写后的提示词，可直接编辑。点“填入并发送”就把它作为这一轮任务交给 Agent。'),
                compare
                  ? h('div', { style: styles.compare },
                    h('div', { style: styles.compareCol },
                      h('div', { style: styles.compareLabel }, '原始需求'),
                      h('div', { style: Object.assign({}, styles.draftBox, { maxHeight: '360px', marginBottom: 0 }) }, view.original),
                    ),
                    h('div', { style: styles.compareCol },
                      h('div', { style: styles.compareLabel }, '改写结果'),
                      h('textarea', {
                        style: Object.assign({}, styles.textarea, { minHeight: '360px' }),
                        value: view.prompt,
                        onChange: editPrompt,
                        spellCheck: false,
                      }),
                    ),
                  )
                  : h('div', null,
                    h('details', { style: styles.details },
                      h('summary', { style: styles.summary }, '查看原始需求'),
                      h('div', { style: styles.draftBox }, view.original),
                    ),
                    h('textarea', {
                      style: styles.textarea,
                      value: view.prompt,
                      onChange: editPrompt,
                      spellCheck: false,
                    }),
                  ),
                h('div', { style: styles.meta },
                  '由 ' + (meta.backend || config && config.baseUrl || '细化后端')
                  + ' · ' + (meta.model || 'unknown')
                  + ' · ' + timeText(meta.elapsedMs),
                ),
                h('div', { style: styles.row },
                  h('button', { type: 'button', style: styles.primary, onClick: fillAndSend, disabled: phase !== 'plain' }, '填入并发送'),
                  h('button', { type: 'button', style: styles.secondary, onClick: fill, disabled: phase !== 'plain' }, '仅填入'),
                  h('button', { type: 'button', style: styles.secondary, onClick: restoreOriginal, disabled: phase !== 'plain' }, '恢复原文'),
                  h('button', { type: 'button', style: styles.secondary, onClick: copy }, '复制'),
                  h('button', { type: 'button', style: styles.secondary, onClick: function () { setCompare(function (value) { return !value }) } }, compare ? '收起对照' : '并排对照'),
                  h('button', { type: 'button', style: styles.secondary, onClick: function () { setCompare(false); setView({ kind: 'start' }) } }, '重新细化'),
                ),
                phase !== 'plain' ? h('div', { style: styles.hint }, '输入框当前忙，暂不能填入；可以先复制。') : null,
              )
              : null,

            notice ? h('div', { style: styles.notice }, notice) : null,

            h('div', { style: styles.row },
              h('button', {
                type: 'button',
                style: styles.secondary,
                onClick: function () { setSettingsOpen(function (old) { return !old }) },
              }, settingsOpen ? '收起设置' : '后端设置'),
            ),

            settingsOpen
              ? h(SettingsForm, {
                config: config,
                onSaved: function (next) { setConfig(next); loadInfo() },
                onTest: function () { loadInfo() },
              })
              : null,
          ),
          document.body,
        )
        : null

      return h(React.Fragment, null,
        h('button', {
          type: 'button',
          style: styles.button,
          title: busy ? '正在细化…' : '把粗需求细化成详细提示词',
          'aria-label': '把粗需求细化成详细提示词',
          onClick: open,
        }, busy ? '◌ 细化中' : '✨ 细化'),
        panel,
      )
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        try {
          if (!ctx || !ctx.slots) return
          ctx.slots.inject('conversation.input.right', function () {
            try {
              return ctx.slots.register({
                name: 'conversation.input.right',
                id: 'prompt-detailer',
                order: 55,
              }, PromptDetailerButton)
            } catch (error) {
              console.warn('[prompt-detailer] button registration failed', error)
              return function () {}
            }
          })
        } catch (error) {
          console.warn('[prompt-detailer] slots unavailable; button stays off', error)
        }
      },
    }
  },
})
