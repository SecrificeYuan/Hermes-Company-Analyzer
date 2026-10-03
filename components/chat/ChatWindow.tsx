'use client'

import { useEffect, useRef, useState } from 'react'
import { Building2, ChevronDown, Copy, FileSearch, HeartPulse, Pencil, ScanLine, Search, Send, ShieldCheck, Trash2, Wrench, type LucideIcon } from 'lucide-react'
import { addChatThread, type ChatAttachment, type ChatMessage, type ChatThread } from '@/lib/chat-history'
import { ReportCard, type ReportCardData } from '@/components/chat/ReportCard'
import { AttachmentChips, AttachmentPicker } from '@/components/chat/AttachmentPicker'
import { Markdown } from '@/components/chat/Markdown'

type UiMsg =
  | { role: 'user'; text: string; attachments?: ChatAttachment[] }
  | { role: 'assistant'; text: string }
  | { role: 'tool'; label: string; name?: string; done?: boolean }
  | { role: 'card'; card: ReportCardData }

interface SseEvent {
  type?: string
  name?: string
  text?: string
  label?: string
  message?: string
  reportCard?: ReportCardData
}

/** 每个工具的专属图标（与 lib/chat/agent.ts 的 TOOL_LABELS 对应） */
const TOOL_ICONS: Record<string, LucideIcon> = {
  suggest_companies: Search,
  confirm_company: ShieldCheck,
  run_xray: ScanLine,
  run_health_check: HeartPulse,
  get_market_quote: Search,
  get_fund_flow: Search,
  get_news: Search,
  compare_companies: Search,
  get_announcements: Search,
}

/** 单个工具进度药丸 */
function ToolPill({ label, name, done, active }: { label: string; name?: string; done?: boolean; active?: boolean }) {
  const Icon = (name && TOOL_ICONS[name]) || Wrench
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 transition-colors ${
        done ? 'border-ink-edge/40 bg-ink-card/20' : 'border-ink-edge/60 bg-ink-card/40'
      }`}
    >
      <Icon className={`h-3.5 w-3.5 ${done ? 'text-slate-600' : 'animate-pulse text-neon'}`} />
      <span className={`font-mono text-[11px] tracking-wide ${done ? 'text-slate-600' : 'text-slate-400'}`}>{label}</span>
      {active && <span className="thinking-dot" />}
    </span>
  )
}

/** 连续工具调用折叠：进行中的只显示最新一个；全部完成后收成「N 个工具」可展开列表 */
function ToolCluster({ items }: { items: Extract<UiMsg, { role: 'tool' }>[] }) {
  const [expanded, setExpanded] = useState(false)
  const running = items.some((t) => !t.done)
  if (running) {
    const last = items[items.length - 1]
    return (
      <div className="flex flex-col items-start gap-1.5">
        {items.length > 1 && (
          <span className="pl-1 font-mono text-[10px] text-slate-600">已调用 {items.length - 1} 个工具</span>
        )}
        <ToolPill label={last.label} name={last.name} done={last.done} active />
      </div>
    )
  }
  if (!expanded) {
    return (
      <div className="flex justify-start">
        <button
          onClick={() => setExpanded(true)}
          className="inline-flex items-center gap-1.5 rounded-full border border-ink-edge/40 bg-ink-card/20 px-3.5 py-1.5 font-mono text-[11px] tracking-wide text-slate-600 transition-colors hover:border-ink-edge/70 hover:text-slate-400"
        >
          <Wrench className="h-3.5 w-3.5" />
          已调用 {items.length} 个工具
          <ChevronDown className="h-3 w-3" />
        </button>
      </div>
    )
  }
  return (
    <div className="flex flex-col items-start gap-1.5">
      <button
        onClick={() => setExpanded(false)}
        className="inline-flex items-center gap-1.5 pl-1 font-mono text-[10px] text-slate-600 transition-colors hover:text-slate-400"
      >
        <ChevronDown className="h-3 w-3 rotate-180" />
        收起
      </button>
      {items.map((t, j) => (
        <ToolPill key={j} label={t.label} name={t.name} done />
      ))}
    </div>
  )
}

export function ChatWindow({
  thread,
  onThreadUpdate,
  reportId,
  initialAttachments,
}: {
  thread: ChatThread
  onThreadUpdate: (t: ChatThread) => void
  /** 报告页「追问 AI」入口：把该报告 id 透传给 /api/chat，服务端注入全量事实快照 */
  reportId?: string | null
  /** 一次性预置附件：仅挂载时填入输入区待发送列表，不代发消息 */
  initialAttachments?: ChatAttachment[]
}) {
  const [msgs, setMsgs] = useState<UiMsg[]>(() =>
    thread.messages
      .map((m): UiMsg | null => {
        if (m.role === 'user' || m.role === 'assistant') {
          return m.role === 'user'
            ? { role: 'user', text: m.content ?? '', attachments: m.attachments }
            : { role: 'assistant', text: m.content ?? '' }
        }
        if (m.role === 'tool') return { role: 'tool', label: m.content ?? '检索工具', name: m.name, done: true }
        if (m.role === 'card' && m.content) {
          try {
            return { role: 'card', card: JSON.parse(m.content) as ReportCardData }
          } catch {
            return null
          }
        }
        return null
      })
      .filter((m): m is UiMsg => m !== null)
  )
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)
  const [confirmIdx, setConfirmIdx] = useState<number | null>(null)
  /** 输入区待发送的附件（点回形针搜索添加，随下一条 user 消息发出并持久化） */
  const [pendingAttachments, setPendingAttachments] = useState<ChatAttachment[]>(() => initialAttachments ?? [])
  /** msgs 的命令式镜像：回合结束 finally 里 state 尚未重渲染，必须靠它拿到含 tool/card 的完整序列再落库 */
  const msgsRef = useRef<UiMsg[]>(msgs)
  const updateMsgs = (fn: (prev: UiMsg[]) => UiMsg[]) => {
    setMsgs((prev) => {
      const next = fn(prev)
      msgsRef.current = next
      return next
    })
  }
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const confirmTimer = useRef<number | null>(null)
  /** 本轮流式 AI 气泡在 msgs 中的下标；工具行会移除空气泡，靠它定位而不是从尾部倒搜（否则会改到上一轮的旧气泡） */
  const pendingAiRef = useRef(-1)
  /** 同步并发锁：state busy 异步生效挡不住同一 tick 内的重复触发，曾导致两条流并写、消息重复 */
  const busyLockRef = useRef(false)

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTo({ top: el.scrollHeight })
  }, [msgs])

  /** 把剩余 UI 消息写回 thread 持久化（tool=label、card=JSON，均留痕但不送 LLM；user 消息保留附件） */
  const persistMsgs = (remaining: UiMsg[]) => {
    const messages: ChatMessage[] = remaining.map((m) =>
      m.role === 'user' || m.role === 'assistant'
        ? m.role === 'user'
          ? { role: 'user', content: m.text || null, attachments: m.attachments }
          : { role: 'assistant', content: m.text || null }
        : m.role === 'tool'
          ? { role: 'tool', content: m.label, name: m.name }
          : { role: 'card', content: JSON.stringify(m.card) },
    )
    // 「新建对话」开出的空线程：首条用户消息发送后用它补标题
    const firstUser = messages.find((m) => m.role === 'user' && m.content)
    const title = thread.title === '新对话' && firstUser?.content
      ? firstUser.content.slice(0, 24)
      : thread.title
    const updated: ChatThread = { ...thread, title, at: Date.now(), messages }
    addChatThread(updated)
    onThreadUpdate(updated)
  }

  const copyText = async (text: string, idx: number) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      ta.remove()
    }
    setCopiedIdx(idx)
    window.setTimeout(() => setCopiedIdx((v) => (v === idx ? null : v)), 1500)
  }

  const deleteMsg = (idx: number) => {
    if (busy) return
    const next = msgs.filter((_, j) => j !== idx)
    persistMsgs(next)
    setMsgs(next)
  }

  /** 两步删除：第一次点击进入「确认删除？」，3s 内再点才真正删 */
  const requestDelete = (idx: number) => {
    if (confirmIdx === idx) {
      setConfirmIdx(null)
      deleteMsg(idx)
      return
    }
    setConfirmIdx(idx)
    if (confirmTimer.current) window.clearTimeout(confirmTimer.current)
    confirmTimer.current = window.setTimeout(() => setConfirmIdx((v) => (v === idx ? null : v)), 3000)
  }

  const editMsg = (text: string) => {
    setInput(text)
    inputRef.current?.focus()
  }

  /** 跑一轮 Agent：apiMessages 为送入 /api/chat 的完整消息序列（末条须为 user） */
  const runTurn = async (apiMessages: ChatMessage[]) => {
    if (busyLockRef.current) return
    busyLockRef.current = true
    setBusy(true)
    let aiText = ''

    const fail = (msg: string) => {
      updateMsgs((prev) => [...prev, { role: 'assistant', text: msg }])
    }

    try {
      const attachments = allAttachments()
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: apiMessages,
          reportId: reportId ?? undefined,
          attachments: attachments.length ? attachments : undefined,
        }),
      })
      if (!res.ok || !res.body) {
        let errMsg = '请求失败，请稍后重试。'
        try {
          const data = await res.json()
          if (data?.available === false) errMsg = 'AI 功能未配置（缺少 LLM 环境变量）。'
          else if (typeof data?.error === 'string') errMsg = data.error
        } catch {
          // 保留默认错误文案
        }
        fail(errMsg)
        return
      }

      // 预置一个等待中的 AI 气泡
      updateMsgs((prev) => {
        pendingAiRef.current = prev.length
        return [...prev, { role: 'assistant', text: '' }]
      })

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      let sawCard = false

      const appendToAi = (delta: string) => {
        aiText += delta
        updateMsgs((prev) => {
          const idx = pendingAiRef.current
          if (idx >= 0 && idx < prev.length && prev[idx].role === 'assistant') {
            const next = [...prev]
            next[idx] = { role: 'assistant', text: aiText }
            return next
          }
          // 工具进度行之后首个 delta：空气泡已被移除，在末尾新建
          pendingAiRef.current = prev.length
          return [...prev, { role: 'assistant', text: aiText }]
        })
      }

      /** mode='remove'：工具进度行前移除等待气泡；mode='fallback'：流结束兜底，空白则显示错误文案 */
      const finishAi = (mode: 'remove' | 'fallback') => {
        const idx = pendingAiRef.current
        pendingAiRef.current = -1
        if (idx < 0) return
        updateMsgs((prev) => {
          if (idx >= prev.length || prev[idx].role !== 'assistant') {
            if (mode === 'fallback' && !sawCard) return [...prev, { role: 'assistant', text: '服务暂时无响应，请稍后重试。' }]
            return prev
          }
          const next = [...prev]
          if (next[idx].role === 'assistant' && next[idx].text === '') {
            if (mode === 'remove') next.splice(idx, 1)
            else if (sawCard) next[idx] = { role: 'assistant', text: '（这轮的口播总结没能生成出来，点上面的报告卡看完整 X 光与证据链；也可以直接继续追问。）' }
            else next[idx] = { role: 'assistant', text: '服务暂时无响应，请稍后重试。' }
          }
          return next
        })
      }

      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const blocks = buf.split('\n\n')
        buf = blocks.pop() ?? ''
        for (const block of blocks) {
          const line = block.trim()
          if (!line.startsWith('data:')) continue
          let ev: SseEvent
          try {
            ev = JSON.parse(line.slice(5).trim())
          } catch {
            continue
          }
          if (ev.type === 'delta' && ev.text) {
            appendToAi(ev.text)
          } else if (ev.type === 'tool_start') {
            finishAi('remove')
            updateMsgs((prev) => {
              const next: UiMsg[] = [...prev, { role: 'tool', label: ev.label ?? ev.name ?? '检索工具', name: ev.name }]
              // 工具执行期间也保持尾部有「正在输出」占位（X 光约 6 秒，不能空白）
              if (pendingAiRef.current < 0) {
                pendingAiRef.current = next.length
                next.push({ role: 'assistant', text: '' })
              }
              return next
            })
            // 新气泡是独立的 assistant 发言：aiText 是回合级累加器，必须清零，
            // 否则工具调用后的流式 delta 会把之前气泡里的文字重复进新气泡（「变成两条消息」bug）
            // （finishAi 已把 pendingAiRef 置 -1，这里必定新开占位气泡）
            aiText = ''
          } else if (ev.type === 'tool_end') {
            // 标记最近一条未完成的工具行：停动画、变静态（占位气泡由 tool_start 续上，此处不动）
            updateMsgs((prev) => {
              const next = [...prev]
              for (let i = next.length - 1; i >= 0; i--) {
                const item = next[i]
                if (item.role === 'tool' && !item.done) {
                  next[i] = { ...item, done: true }
                  break
                }
              }
              return next
            })
          } else if (ev.type === 'report_card' && ev.reportCard) {
            sawCard = true
            updateMsgs((prev) => {
              const next = [...prev]
              // 工具执行期间的占位气泡在卡片上方——挪到卡片下面，口播才会流在卡片之后
              const idx = pendingAiRef.current
              if (idx >= 0 && idx < next.length && next[idx].role === 'assistant' && next[idx].text === '') {
                next.splice(idx, 1)
              }
              next.push({ role: 'card', card: ev.reportCard as ReportCardData })
              pendingAiRef.current = next.length
              next.push({ role: 'assistant', text: '' })
              return next
            })
            // 卡片后的口播是新气泡：清零回合级累加器，防止把工具调用前的文字重复进来
            aiText = ''
          } else if (ev.type === 'error') {
            appendToAi(ev.message ?? '出错了')
          }
        }
      }
      finishAi('fallback')
    } catch {
      fail('网络异常，请稍后重试。')
    } finally {
      busyLockRef.current = false
      setBusy(false)
      // 落库必须含本轮的 tool 行与报告卡（apiMessages 只有 user/assistant，是送 LLM 的视图，不能拿来持久化）
      persistMsgs(msgsRef.current)
    }
  }

  const send = async (text: string) => {
    const q = text.trim()
    if (!q || busy) return
    setInput('')
    const outgoing = pendingAttachments
    setPendingAttachments([])
    // 同步推 ref 再 setState：setMsgs 的 updater 在下次 render 才执行，而 runTurn 内的
    // allAttachments() 立即读 msgsRef——异步推会让本轮刚发的附件丢失（AI 看不到附件的 bug）
    const next: UiMsg[] = [...msgsRef.current, { role: 'user', text: q, attachments: outgoing.length ? outgoing : undefined }]
    msgsRef.current = next
    setMsgs(next)
    await runTurn([...llmHistory(), { role: 'user', content: q }])
  }

  // 首页新开会话只落了首条 user 消息，挂载后自动补跑 AI 回复；StrictMode 双跑用 ref 挡住
  const autoRan = useRef(false)
  useEffect(() => {
    if (autoRan.current) return
    autoRan.current = true
    const last = thread.messages[thread.messages.length - 1]
    if (last?.role === 'user') {
      void runTurn(llmHistory())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** 送 LLM 的历史只保留 user/assistant：tool/card 是本地留痕，OpenAI 协议不接受无 tool_call_id 的 tool 消息 */
  function llmHistory(): ChatMessage[] {
    return thread.messages.filter((m) => m.role === 'user' || m.role === 'assistant')
  }

  /** 会话内出现过的全部附件（去重）：随每次请求带给服务端展开为系统上下文 */
  function allAttachments(): ChatAttachment[] {
    const seen = new Set<string>()
    const out: ChatAttachment[] = []
    for (const m of msgsRef.current) {
      if (m.role !== 'user' || !m.attachments) continue
      for (const a of m.attachments) {
        const key = `${a.type}:${a.id}`
        if (seen.has(key)) continue
        seen.add(key)
        out.push(a)
      }
    }
    return out
  }

  // 把连续的工具行合并成簇渲染，避免多轮工具调用把页面撑得很长
  type Row = { kind: 'msg'; m: UiMsg; i: number } | { kind: 'tools'; items: Extract<UiMsg, { role: 'tool' }>[] }
  const rows: Row[] = []
  msgs.forEach((m, i) => {
    if (m.role === 'tool') {
      const last = rows[rows.length - 1]
      if (last?.kind === 'tools') last.items.push(m)
      else rows.push({ kind: 'tools', items: [m] })
    } else {
      rows.push({ kind: 'msg', m, i })
    }
  })

  return (
    <>
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-6 py-6">
        {rows.map((row, ri) =>
          row.kind === 'tools' ? (
            <ToolCluster key={ri} items={row.items} />
          ) : (
            (() => {
              const m = row.m
              const i = row.i
              if (m.role === 'card') {
                // key 必须与外层 rows.map 的 ri 同命名空间：i 是 msgs 下标，工具合并后两套编号会撞号（duplicate key bug）
                return (
                  <div key={ri} className="flex justify-start">
                    <ReportCard card={m.card} />
                  </div>
                )
              }
              if (m.role !== 'user' && m.role !== 'assistant') return null
              return m.role === 'user' ? (
                <div key={ri} className="group flex justify-end">
              <div className="max-w-[80%]">
                {m.attachments && m.attachments.length > 0 && (
                  <div className="mb-1.5 flex flex-wrap justify-end gap-1.5">
                    {m.attachments.map((a) => (
                      <span
                        key={`${a.type}:${a.id}`}
                        className="inline-flex items-center gap-1.5 rounded-full border border-neon/40 bg-ink-card/80 py-1 pl-2.5 pr-3 font-mono text-[11px] text-slate-300"
                      >
                        {a.type === 'report' ? <FileSearch className="h-3 w-3 text-neon" /> : <Building2 className="h-3 w-3 text-neon" />}
                        {a.name}
                        <span className="text-slate-600">{a.type === 'report' ? '报告' : '公司'}</span>
                      </span>
                    ))}
                  </div>
                )}
                <div className="rounded-btn bg-neon px-4 py-2.5 text-sm leading-relaxed text-ink-bg">
                  {m.text}
                </div>
                <div className="mt-1 flex items-center justify-end gap-3 font-mono text-[10px] text-slate-500 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
                  <button onClick={() => void copyText(m.text, i)} className="flex items-center gap-0.5 hover:text-neon">
                    <Copy className="h-3 w-3" />
                    {copiedIdx === i ? '已复制' : '复制'}
                  </button>
                  <button onClick={() => editMsg(m.text)} className="flex items-center gap-0.5 hover:text-neon">
                    <Pencil className="h-3 w-3" />
                    编辑
                  </button>
                  {!busy && (
                    <button
                      onClick={() => requestDelete(i)}
                      className={`flex items-center gap-0.5 ${confirmIdx === i ? 'font-bold text-red-400' : 'hover:text-red-400'}`}
                    >
                      <Trash2 className="h-3 w-3" />
                      {confirmIdx === i ? '确认删除？' : '删除'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div key={ri} className="group flex justify-start">
              <div className="max-w-[85%]">
                <div className="glass-card max-w-[85%] px-4 py-2.5">
                  {m.text ? (
                    <Markdown text={m.text} />
                  ) : (
                    <span className="inline-flex items-center gap-1.5 py-1 text-slate-400" aria-label="正在思考">
                      <span className="thinking-dot" />
                      <span className="thinking-dot" />
                      <span className="thinking-dot" />
                    </span>
                  )}
                </div>
                {m.text !== '' && (
                  <div className="mt-1 flex items-center gap-3 font-mono text-[10px] text-slate-500 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
                    <button onClick={() => void copyText(m.text, i)} className="flex items-center gap-0.5 hover:text-neon">
                      <Copy className="h-3 w-3" />
                      {copiedIdx === i ? '已复制' : '复制'}
                    </button>
                    {!busy && (
                      <button
                        onClick={() => requestDelete(i)}
                        className={`flex items-center gap-0.5 ${confirmIdx === i ? 'font-bold text-red-400' : 'hover:text-red-400'}`}
                      >
                        <Trash2 className="h-3 w-3" />
                        {confirmIdx === i ? '确认删除？' : '删除'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
            })()
          )
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          void send(input)
        }}
        className="border-t border-ink-edge px-6 py-4"
      >
        <div className="glass-card mx-auto flex w-full max-w-2xl items-center gap-3 px-5 py-3.5">
          <AttachmentPicker selected={pendingAttachments} onChange={setPendingAttachments} />
          <AttachmentChips selected={pendingAttachments} onChange={setPendingAttachments} />
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={busy}
            placeholder="继续追问，例如：那这家和 XX 比呢？"
            className="min-w-0 flex-1 bg-transparent font-mono text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={busy}
            className="flex items-center gap-1.5 font-mono text-[11px] tracking-wider text-neon hover:underline disabled:opacity-50 disabled:no-underline"
          >
            <Send className="h-3.5 w-3.5" />
            SEND ⏎
          </button>
        </div>
      </form>
    </>
  )
}
