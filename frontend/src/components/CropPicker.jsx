import { useEffect, useState } from 'react'
import { api, emojiFor } from '../lib/api.js'

export const OTHER = '__other__'

/** Crop chooser: "Auto-detect", each supported crop, and "Other / not listed". */
export default function CropPicker({ value, onChange, compact = false, disabled = false }) {
  const [crops, setCrops] = useState([])
  useEffect(() => { api.classes().then((d) => setCrops(Object.keys(d.crops).sort())).catch(() => {}) }, [])

  const chip = (key, label, emoji, title) => {
    const active = value === key
    return (
      <button key={key} type="button" disabled={disabled} onClick={() => onChange(key)} title={title}
        className={`inline-flex items-center gap-1.5 rounded-xl border px-3 ${compact ? 'py-1.5 text-xs' : 'py-2 text-sm'} font-medium transition
          ${active
            ? 'border-leaf-600 bg-leaf-600 text-white shadow-md shadow-leaf-600/25'
            : 'border-leaf-900/10 bg-white/60 hover:border-leaf-500 hover:bg-leaf-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10'}
          disabled:opacity-50`}>
        <span>{emoji}</span>{label}
      </button>
    )
  }

  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Which plant is this?">
      {chip('', 'Auto-detect', '✨', 'Let the model guess the crop')}
      {crops.map((c) => chip(c, c, emojiFor(c), `This is a ${c} leaf`))}
      {chip(OTHER, 'Other / not listed', '❓', 'My plant is not in this list')}
    </div>
  )
}
