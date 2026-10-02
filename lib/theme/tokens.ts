// 兼容层：旧 import 路径暂保留，后续任务迁移完成后删除本文件。
import { scoreColor as scoreColorByTokens } from './index'
import { liteTokens } from './themes/lite'

export const colors = { ...liteTokens.colors, neon: liteTokens.colors.accent }
export { liteTokens }
export const riskColor = liteTokens.riskColor

/** 旧签名：单参数，基于 lite 主题 */
export function scoreColor(score: number): string {
  return scoreColorByTokens(liteTokens, score)
}
