'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { getChatThreads, type ChatThread } from '@/lib/chat-history'
import { ChatWindow } from '@/components/chat/ChatWindow'

function ChatPageInner() {
  const router = useRouter()
  const params = useSearchParams()
  const [thread, setThread] = useState<ChatThread | null>(null)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    const id = params.get('thread')
    const found = id ? getChatThreads().find((t) => t.id === id) : undefined
    if (!found) {
      router.replace('/')
      return
    }
    setThread(found)
    setChecked(true)
  }, [params, router])

  if (!checked || !thread) return null

  return (
    <main className="flex min-h-screen flex-col">
      <header className="flex items-center gap-4 border-b border-ink-edge px-6 py-3">
        <Link
          href="/"
          className="flex items-center gap-1.5 font-mono text-xs text-slate-400 transition-colors hover:text-slate-100"
        >
          <ArrowLeft className="h-4 w-4" />
          返回首页
        </Link>
        <span className="font-mono text-xs tracking-[0.25em] text-slate-400">HERMES · 对话</span>
      </header>
      <ChatWindow thread={thread} onThreadUpdate={setThread} />
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
