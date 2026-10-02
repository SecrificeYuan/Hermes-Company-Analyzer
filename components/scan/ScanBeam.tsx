'use client'

import { motion } from 'framer-motion'

/**
 * 霓虹扫描光束：从顶部扫到中部，2.5s 循环。
 * 首页点击公司后的过场动画，也是报告页顶部的"点亮"动效。
 */
export function ScanBeam({ loop = true }: { loop?: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 h-full overflow-hidden">
      <motion.div
        className="scan-beam absolute left-0 h-[2px] w-full"
        initial={{ top: '0%', opacity: 0 }}
        animate={{ top: ['0%', '55%', '0%'], opacity: [0, 1, 0] }}
        transition={{ duration: 2.5, ease: 'easeInOut', repeat: loop ? Infinity : 0 }}
      />
      <motion.div
        className="absolute left-0 h-24 w-full bg-gradient-to-b from-neon/10 to-transparent"
        initial={{ top: '-10%', opacity: 0 }}
        animate={{ top: ['-10%', '45%', '-10%'], opacity: [0, 0.8, 0] }}
        transition={{ duration: 2.5, ease: 'easeInOut', repeat: loop ? Infinity : 0 }}
      />
    </div>
  )
}
