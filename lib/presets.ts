/** 首页预设公司 —— 避免现场输入尴尬，点击即扫 */
export interface PresetCompany {
  id: string
  name: string
  tagline: string
  hint: '稳健白马' | '争议成长' | '高危预警'
}

export const PRESET_COMPANIES: PresetCompany[] = [
  { id: 'mock-healthy', name: '赤水河酒业', tagline: '白酒龙头 · 现金奶牛', hint: '稳健白马' },
  { id: 'mock-warning', name: '蓝湾咖啡', tagline: '万店神话 · 争议缠身', hint: '争议成长' },
  { id: 'mock-danger', name: '恒晟地产', tagline: '债务高压 · 暴雷前兆', hint: '高危预警' },
]

/** 首页搜索过滤：空串返回全部；按名称/标语/ID 子串匹配（大小写不敏感） */
export function filterPresets(query: string): PresetCompany[] {
  const q = query.trim().toLowerCase()
  if (!q) return PRESET_COMPANIES
  return PRESET_COMPANIES.filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      c.tagline.toLowerCase().includes(q) ||
      c.id.toLowerCase().includes(q),
  )
}
