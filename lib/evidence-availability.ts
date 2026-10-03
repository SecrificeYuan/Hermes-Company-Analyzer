import type { CompanyXRay } from './types'

/** 兼容旧版已知数据；新报告通过显式 false 保留资料缺口。 */
export function pledgeAvailable(xray: CompanyXRay): boolean {
  return xray.def.pledgeAvailable ?? (xray.def.available !== false)
}

export function riskAvailable(xray: CompanyXRay): boolean {
  return xray.hp.available !== false && xray.def.available !== false
}

export function dimensionAvailability(xray: CompanyXRay): boolean[] {
  return [xray.hp.available !== false, xray.def.available !== false, xray.atk.available !== false, xray.morale.available !== false, riskAvailable(xray)]
}

export function completeComparisonData(xray: CompanyXRay): boolean {
  return dimensionAvailability(xray).every(Boolean)
}
