import { useMemo } from 'react'
import katex from 'katex'
import 'katex/dist/katex.min.css'

/** Renders a TeX string with KaTeX. Content is static and authored in this repo. */
export function Tex({ children, block = false, className = '' }) {
  const html = useMemo(
    () => katex.renderToString(String(children), { displayMode: block, throwOnError: false, strict: false }),
    [children, block],
  )
  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />
}

/** A boxed display formula with an optional caption. */
export function Formula({ tex, note, label }) {
  return (
    <div className="my-3 rounded-2xl border border-leaf-600/15 bg-leaf-50/80 px-4 py-3 dark:border-white/10 dark:bg-white/[0.03]">
      {label && <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-leaf-700 dark:text-leaf-400">{label}</div>}
      <div className="overflow-x-auto overflow-y-hidden text-leaf-950 dark:text-leaf-50">
        <Tex block>{tex}</Tex>
      </div>
      {note && <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{note}</div>}
    </div>
  )
}
