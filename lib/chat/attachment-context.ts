// 聊天附件展开：把消息携带的"附件"（报告快照 / 公司主体）展开为系统上下文文本，
// 注入 /api/chat 的消息序列——AI 直接基于快照回答，无需再多次调工具拉取。
// 与"工具调用"互补：附件是用户主动给定的上下文，工具是 AI 主动深挖的手段。
import { getXRay } from '@/lib/get-xray'
import { findCompany, getCompanyHealth } from '@/lib/data/company-health'
import { healthToXray } from '@/lib/data/health-xray'
import { buildFactPayload, buildSignalPayload } from '@/lib/llm/facts'
import type { CompanyXRay } from '@/lib/types'

export interface RawAttachment {
  type: 'report' | 'company'
  id: string
  name?: string
}

async function resolveXRay(id: string): Promise<CompanyXRay | null> {
  // 上市/新三板主体：完整 X 光（getXRay 内部含缓存）
  try {
    return await getXRay(id)
  } catch {
    // 非上市工商主体：回退健康检查链路
  }
  try {
    const identity = await findCompany(id)
    if (!identity) return null
    const health = await getCompanyHealth(identity)
    return healthToXray(health)
  } catch {
    return null
  }
}

function snapshotText(xray: CompanyXRay): string {
  const lamp = xray.overallRisk === 'green' ? '绿灯' : xray.overallRisk === 'yellow' ? '黄灯' : '红灯'
  return [
    `公司：${xray.name}（${xray.stockCode ?? '非上市'}）`,
    `灯色：${lamp}，风险评分 ${xray.riskScore}/100`,
    `结论：${xray.verdict}`,
    `五维事实：${JSON.stringify(buildFactPayload(xray))}`,
    `命中信号：${JSON.stringify(buildSignalPayload(xray))}`,
    `数据基准日：${xray.asOf}`,
  ].join('\n')
}

/**
 * 把附件数组展开成一条 system 消息内容；失败的附件如实标注缺口。
 * 附件按 type+id 去重（同一报告/公司多次附加只展开一次）。
 */
export async function expandAttachments(attachments: RawAttachment[]): Promise<string | null> {
  const unique = new Map<string, RawAttachment>()
  for (const a of attachments) {
    if (!a || typeof a.id !== 'string' || !a.id.trim()) continue
    if (a.type !== 'report' && a.type !== 'company') continue
    unique.set(`${a.type}:${a.id.trim()}`, { ...a, id: a.id.trim() })
  }
  if (!unique.size) return null

  const sections: string[] = []
  for (const a of unique.values()) {
    const xray = await resolveXRay(a.id)
    if (xray) {
      const label = a.type === 'report' ? 'X 光报告快照' : '公司尽调快照'
      sections.push(`【附件 · ${label}：${xray.name}】\n${snapshotText(xray)}`)
    } else {
      sections.push(
        `【附件 · ${a.type === 'report' ? '报告' : '公司'}：${a.name ?? a.id}】\n资料不足：未能取回该主体的数据快照，请如实告知用户。`,
      )
    }
  }

  return [
    '用户为本轮对话附加了以下资料快照（用户主动提供的上下文，直接基于它们回答，无需再调用工具拉取；如需要快照之外的信息才调用工具）：',
    ...sections,
  ].join('\n\n')
}
