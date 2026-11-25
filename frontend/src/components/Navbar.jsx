import { useEffect, useState } from 'react'
import { NavLink, Link } from 'react-router-dom'
import { Leaf, Menu, Moon, Sun, X } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'

const LINKS = [
  ['/', 'Home'],
  ['/detect', 'Detect'],
  ['/history', 'History'],
  ['/dashboard', 'Model'],
  ['/about', 'About'],
]

export function useTheme() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    try { localStorage.setItem('theme', dark ? 'dark' : 'light') } catch { /* storage blocked */ }
  }, [dark])
  return [dark, setDark]
}

export default function Navbar() {
  const [dark, setDark] = useTheme()
  const [open, setOpen] = useState(false)
  const linkCls = ({ isActive }) =>
    `rounded-xl px-3.5 py-2 text-sm font-medium transition-colors ${
      isActive
        ? 'bg-leaf-600 text-white shadow-md shadow-leaf-600/30'
        : 'text-gray-700 hover:bg-leaf-100 hover:text-leaf-800 dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-white'
    }`

  return (
    <header className="sticky top-0 z-40 px-4 pt-4 sm:px-6 lg:px-8">
      <nav className="glass mx-auto flex max-w-7xl items-center justify-between !rounded-2xl px-4 py-2.5">
        <Link to="/" className="flex items-center gap-2.5" onClick={() => setOpen(false)}>
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-leaf-500 to-emerald-700 text-white shadow-md shadow-leaf-600/30">
            <Leaf className="h-5 w-5" />
          </span>
          <span className="font-display text-lg font-bold tracking-tight text-leaf-950 dark:text-white">
            Plant<span className="text-leaf-600 dark:text-leaf-400">Doctor</span>
            <span className="ml-1.5 align-middle text-[10px] font-semibold uppercase tracking-widest text-gray-500">AI</span>
          </span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {LINKS.map(([to, label]) => (
            <NavLink key={to} to={to} end={to === '/'} className={linkCls}>{label}</NavLink>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setDark((d) => !d)}
            aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            className="grid h-10 w-10 place-items-center rounded-xl text-gray-700 transition hover:bg-leaf-100 dark:text-gray-200 dark:hover:bg-white/10"
          >
            <motion.span key={dark ? 'm' : 's'} initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }}>
              {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </motion.span>
          </button>
          <Link to="/detect" className="btn-primary hidden !py-2 !text-sm sm:inline-flex">Scan a leaf</Link>
          <button className="grid h-10 w-10 place-items-center rounded-xl md:hidden" onClick={() => setOpen((o) => !o)} aria-label="Menu">
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="glass mx-auto mt-2 flex max-w-7xl flex-col gap-1 !rounded-2xl p-2 md:hidden"
          >
            {LINKS.map(([to, label]) => (
              <NavLink key={to} to={to} end={to === '/'} className={linkCls} onClick={() => setOpen(false)}>{label}</NavLink>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
