import { motion } from 'framer-motion'
import { AlertTriangle, CheckCircle2, Loader2, ShieldAlert } from 'lucide-react'

export function Card({ className = '', children, delay = 0, ...rest }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.45, delay, ease: 'easeOut' }}
      className={`glass p-6 ${className}`}
      {...rest}
    >
      {children}
    </motion.div>
  )
}

export function StatusBadge({ status }) {
  const healthy = status === 'Healthy'
  return (
    <span className={`chip ${healthy
      ? 'bg-leaf-100 text-leaf-800 dark:bg-leaf-500/15 dark:text-leaf-300'
      : 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300'}`}>
      {healthy ? <CheckCircle2 className="h-3.5 w-3.5" /> : <ShieldAlert className="h-3.5 w-3.5" />}
      {status}
    </span>
  )
}

export function ConfidenceRing({ value, size = 132 }) {
  const r = (size - 14) / 2
  const c = 2 * Math.PI * r
  const color = value >= 80 ? '#16a34a' : value >= 50 ? '#d97706' : '#dc2626'
  return (
    <div className="relative" style={{ width: size, height: size }} role="img" aria-label={`Confidence ${value.toFixed(1)} percent`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth="10" fill="none" className="stroke-leaf-900/10 dark:stroke-white/10" />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r} strokeWidth="10" fill="none" stroke={color} strokeLinecap="round"
          strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - value / 100) }}
          transition={{ duration: 1.1, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="font-display text-3xl font-bold text-gray-900 dark:text-white">{value.toFixed(1)}<span className="text-lg">%</span></div>
          <div className="label !text-[10px]">confidence</div>
        </div>
      </div>
    </div>
  )
}

export function Spinner({ label }) {
  return (
    <div className="flex items-center gap-3 text-gray-600 dark:text-gray-300">
      <Loader2 className="h-5 w-5 animate-spin text-leaf-600" /> {label}
    </div>
  )
}

export function ErrorBox({ children }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
      <div>{children}</div>
    </div>
  )
}

export function SectionTitle({ eyebrow, title, sub }) {
  return (
    <div className="mb-8 max-w-2xl">
      {eyebrow && <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-leaf-600 dark:text-leaf-400">{eyebrow}</p>}
      <h2 className="h-section">{title}</h2>
      {sub && <p className="mt-3 text-gray-600 dark:text-gray-400">{sub}</p>}
    </div>
  )
}
