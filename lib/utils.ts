import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** 万元 → 人类可读（1.2亿 / 8500万） */
export function formatWan(amount: number): string {
  const abs = Math.abs(amount)
  if (abs >= 10000) return `${(amount / 10000).toFixed(1)}亿`
  return `${Math.round(amount)}万`
}
