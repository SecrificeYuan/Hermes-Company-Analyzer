// lib/data/snapshot-subjects.ts

/** 非上市演示主体（人工采集快照，PRD 黑客松十家量级）；信号引擎快照落地后替换为同一注册表 */
export interface SnapshotSubject {
  id: string        // slug，URL 与 API 共用
  name: string      // 展示名
  tag: string       // 身份标签，如 "健身房 · 快照"
}

export const SNAPSHOT_SUBJECTS: SnapshotSubject[] = [
  { id: 'mock-gym-danger', name: '鲸川健身（演示）', tag: '健身房 · 快照' },
  { id: 'mock-franchise-unfiled', name: '茶屿加盟（演示）', tag: '加盟品牌 · 快照' },
  { id: 'mock-wealth-unlicensed', name: '恒润理财（演示）', tag: '理财公司 · 快照' },
]
