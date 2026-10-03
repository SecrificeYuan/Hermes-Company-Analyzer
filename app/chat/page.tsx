'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, MessageSquare, PenSquare, Trash2 } from 'lucide-react'
import { deleteChatThread, hydrateChatThreads, addChatThread, type ChatAttachment, type ChatThread } from '@/lib/chat-history'
import { ChatWindow } from '@/components/chat/ChatWindow'

function formatAt(at: number): string {
  const d = new Date(at)
  const today = new Date()
  const sameDay = d.toDateString() === today.toDateString()
  return sameDay
    ? d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })
}

function ChatPageInner() {
  const router = useRouter()
  const params = useSearchParams()
  const threadId = params.get('thread')
  const company = params.get('company')
  const reportId = params.get('report')
  const reportName = params.get('name')
  const [thread, setThread] = useState<ChatThread | null>(null)
  const [threads, setThreads] = useState<ChatThread[]>([])
  const [checked, setChecked] = useState(false)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  /** 报告页带附件进入时的一次性预置附件，ChatWindow 挂载消费后即清空，避免切线程时串台 */
  const [bootAttach, setBootAttach] = useState<ChatAttachment[]>([])
  const companyBooted = useRef(false)
  const reportBooted = useRef(false)

  const refreshThreads = useCallback(async () => {
    setThreads(await hydrateChatThreads())
  }, [])

  useEffect(() => {
    let cancelled = false
    // 先同步读一次本地列表避免闪烁，再 hydrate 合并服务端会话
    void hydrateChatThreads().then((merged) => {
      if (cancelled) return
      setThreads(merged)
      // 裸开 /chat（无参数）：有历史就落到最近一条，没有就开一条新对话，避免白屏
      if (!threadId) {
        if (company || reportId) return // 交给下方 boot effect 开新线程
        const target = merged[0] ?? {
          id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `t-${Date.now()}`,
          title: '新对话',
          at: Date.now(),
          messages: [],
        }
        if (!merged[0]) setThreads(addChatThread(target))
        router.replace(`/chat?thread=${target.id}`)
        return
      }
      const found = merged.find((t) => t.id === threadId)
      if (!found) {
        router.replace('/')
        return
      }
      setThread(found)
      setChecked(true)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId])

  useEffect(() => {
    // 报告页「追问 AI」入口：/chat?company=xxx → 自动开新线程并注入首条消息，
    // 落到 thread 后 ChatWindow 的 auto-run 机制会自动跑 Agent；company 参数一次性消费
    if (!company || threadId) return
    if (companyBooted.current) return
    companyBooted.current = true
    const fresh: ChatThread = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `t-${Date.now()}`,
      title: company,
      at: Date.now(),
      messages: [{ role: 'user', content: `帮我评估一下「${company}」这家公司，我正考虑付钱给它。` }],
    }
    addChatThread(fresh)
    router.replace(`/chat?thread=${fresh.id}`)
  }, [company, threadId, router])

  useEffect(() => {
    // 报告页「与 AI 聊聊」入口：/chat?report=<id> → 自动开一条空线程，报告快照作为预置附件
    // 只选中在输入框、不代发消息；用户确认后随首条消息发出（ChatWindow 一次性消费 initialAttachments）
    if (!reportId || threadId) return
    if (reportBooted.current) return
    reportBooted.current = true
    const fresh: ChatThread = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `t-${Date.now()}`,
      title: '报告追问',
      at: Date.now(),
      messages: [],
    }
    addChatThread(fresh)
    setBootAttach([{ type: 'report', id: reportId, name: reportName ?? 'X 光报告', addedAt: Date.now() }])
    router.replace(`/chat?thread=${fresh.id}&report=${encodeURIComponent(reportId)}`)
  }, [reportId, reportName, threadId, router])

  /** 新建对话：开一条空消息线程并切入；首条消息发送后 ChatWindow 会补标题 */
  function createThread() {
    const fresh: ChatThread = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `t-${Date.now()}`,
      title: '新对话',
      at: Date.now(),
      messages: [],
    }
    setThreads(addChatThread(fresh))
    router.push(`/chat?thread=${fresh.id}`)
  }

  /** 两步删除：第一次点击进入「确认？」，3s 内再点才真正删 */
  function requestDelete(id: string) {
    if (confirmId === id) {
      setConfirmId(null)
      const rest = deleteChatThread(id)
      setThreads(rest)
      if (id === threadId) {
        router.replace(rest[0] ? `/chat?thread=${rest[0].id}` : '/')
      } else {
        // 服务端可能还有本地未缓存的会话，删完回拉一次保证侧栏准确
        void refreshThreads()
      }
      return
    }
    setConfirmId(id)
    window.setTimeout(() => setConfirmId((v) => (v === id ? null : v)), 3000)
  }

  // 预置附件已被 ChatWindow（key=thread.id）在挂载时消费，这里清空防止后续切线程/重挂载串台
  useEffect(() => {
    if (thread && bootAttach.length) setBootAttach([])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread?.id])

  if (!checked || !thread) return null

  return (
    // MarketTicker 占 2.25rem（h-9），这里扣掉，保证整页不溢出滚动
    <main className="flex h-[calc(100dvh-2.25rem)] overflow-hidden">
      {/* 对话列表 */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-ink-edge md:flex">
        <div className="flex items-center justify-between border-b border-ink-edge px-4 py-3">
          <span className="font-mono text-[10px] tracking-[0.25em] text-slate-500">对话列表</span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={createThread}
              className="flex items-center gap-1 font-mono text-[10px] text-slate-400 transition-colors hover:text-neon"
            >
              <PenSquare className="h-3 w-3" />
              新建对话
            </button>
            <Link
              href="/"
              className="flex items-center gap-1 font-mono text-[10px] text-slate-400 transition-colors hover:text-neon"
            >
              <ArrowLeft className="h-3 w-3" />
              首页
            </Link>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          {threads.length === 0 && (
            <p className="px-4 py-6 text-xs leading-relaxed text-slate-600">
              暂无对话，回首页用「对话」模式发起第一次评估。
            </p>
          )}
          {threads.map((t) => (
            <div
              key={t.id}
              className={`group flex cursor-pointer items-center gap-2 px-4 py-2.5 transition-colors ${
                t.id === threadId
                  ? 'bg-ink-card/60 text-slate-100'
                  : 'text-slate-400 hover:bg-ink-card/30 hover:text-slate-200'
              }`}
              onClick={() => router.push(`/chat?thread=${t.id}`)}
            >
              <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-60" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{t.title}</p>
                <p className="font-mono text-[10px] text-slate-600">{formatAt(t.at)}</p>
              </div>
              <button
                aria-label={confirmId === t.id ? `确认删除对话 ${t.title}` : `删除对话 ${t.title}`}
                className={`shrink-0 rounded p-1 opacity-0 transition-all group-hover:opacity-100 ${
                  confirmId === t.id ? 'font-bold text-red-400' : 'text-slate-600 hover:text-red-400'
                }`}
                onClick={(e) => {
                  e.stopPropagation()
                  requestDelete(t.id)
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </aside>

      {/* 对话主体 */}
      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-4 border-b border-ink-edge px-6 py-3">
          <Link
            href="/"
            className="flex items-center gap-1.5 font-mono text-xs text-slate-400 transition-colors hover:text-slate-100 md:hidden"
          >
            <ArrowLeft className="h-4 w-4" />
            返回首页
          </Link>
          <span className="font-mono text-xs tracking-[0.25em] text-slate-400">HERMES · 对话</span>
        </header>
        <ChatWindow
          key={thread.id}
          thread={thread}
          onThreadUpdate={(updated) => {
            setThread(updated)
            setThreads((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
          }}
          reportId={reportId}
          initialAttachments={bootAttach.length ? bootAttach : undefined}
        />
      </section>
    </main>
  )
}

export default function ChatPage() {
  return (
    <Suspense fallback={null}>
      <ChatPageInner />
    </Suspense>
  )
}
