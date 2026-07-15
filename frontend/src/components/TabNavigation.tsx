import React from 'react'
import { motion } from 'motion/react'
import { Radio, Database, Trophy, Calculator } from 'lucide-react'
import type { ActiveTab } from '../store/AppContext'

interface TabNavigationProps {
  activeTab: ActiveTab
  onTabChange: (tab: ActiveTab) => void
  unreadCount?: number
}

const tabs: { id: ActiveTab; label: string; icon: React.ReactNode }[] = [
  { id: 'live', label: 'Live', icon: <Radio className="w-4 h-4" /> },
  { id: 'matches', label: 'Matches', icon: <Database className="w-4 h-4" /> },
  { id: 'sandbox', label: 'Sandbox', icon: <Calculator className="w-4 h-4" /> },
  { id: 'board', label: 'Board', icon: <Trophy className="w-4 h-4" /> },
]

export default function TabNavigation({ activeTab, onTabChange }: TabNavigationProps) {
  return (
    <div className="flex items-center gap-1 bg-[#0C0C0D] border border-zinc-800 rounded-xl p-1">
      {tabs.map(tab => {
        const isActive = activeTab === tab.id
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`relative flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-mono font-black uppercase tracking-wider transition-all cursor-pointer ${
              isActive
                ? 'text-black'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {isActive && (
              <motion.div
                layoutId="tab-indicator"
                className="absolute inset-0 bg-amber-400 rounded-lg"
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-2">
              {tab.icon}
              {tab.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
