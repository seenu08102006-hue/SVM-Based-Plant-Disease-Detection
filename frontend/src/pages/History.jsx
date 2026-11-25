import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { FileDown, Search, Trash2, Upload } from 'lucide-react'
import { api, assetUrl, emojiFor } from '../lib/api.js'
import { ErrorBox, SectionTitle, Spinner, StatusBadge } from '../components/ui.jsx'

export default function History() {
  const [items, setItems] = useState(null)
  const [error, setError] = useState(null)
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('All')

  useEffect(() => { api.history(200).then((d) => setItems(d.items)).catch((e) => setError(e.message)) }, [])

  const shown = useMemo(() => (items || []).filter((p) =>
    (filter === 'All' || p.status === filter) &&
    `${p.plant} ${p.disease} ${p.original_name}`.toLowerCase().includes(q.toLowerCase())), [items, q, filter])

  const remove = async (id) => {
    if (!confirm('Delete this prediction from history?')) return
    try { await api.remove(id); setItems((xs) => xs.filter((x) => x.id !== id)) } catch (e) { setError(e.message) }
  }

  const stats = useMemo(() => {
    const xs = items || []
    return { total: xs.length, diseased: xs.filter((x) => x.status === 'Diseased').length,
      avg: xs.length ? xs.reduce((s, x) => s + x.confidence_value, 0) / xs.length : 0 }
  }, [items])

  return (
    <div>
      <SectionTitle eyebrow="Prediction history" title="Your past scans" sub="Every upload is stored with its prediction, date and confidence." />

      <div className="mb-6 grid grid-cols-3 gap-4">
        {[['Total scans', stats.total], ['Diseased', stats.diseased], ['Avg. confidence', `${stats.avg.toFixed(1)}%`]].map(([l, v]) => (
          <div key={l} className="glass !rounded-2xl p-4">
            <div className="label">{l}</div>
            <div className="font-display text-2xl font-bold">{v}</div>
          </div>
        ))}
      </div>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <label className="glass flex flex-1 items-center gap-2 !rounded-2xl px-4 py-2.5">
          <Search className="h-4 w-4 text-gray-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search crop or disease…" className="w-full bg-transparent outline-none placeholder:text-gray-400" />
        </label>
        <div className="glass flex gap-1 !rounded-2xl p-1">
          {['All', 'Diseased', 'Healthy'].map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition ${filter === f ? 'bg-leaf-600 text-white' : 'hover:bg-leaf-100 dark:hover:bg-white/10'}`}>{f}</button>
          ))}
        </div>
      </div>

      {error && <ErrorBox>{error}</ErrorBox>}
      {!items && !error && <div className="glass p-8"><Spinner label="Loading history…" /></div>}
      {items && shown.length === 0 && (
        <div className="glass flex flex-col items-center gap-4 p-12 text-center">
          <div className="text-5xl">🌱</div>
          <p className="text-gray-600 dark:text-gray-400">{items.length ? 'No scans match your filters.' : 'No scans yet.'}</p>
          <Link to="/detect" className="btn-primary"><Upload className="h-4 w-4" /> Upload a leaf</Link>
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <AnimatePresence>
          {shown.map((p, i) => (
            <motion.div key={p.id} layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
              transition={{ delay: Math.min(i * 0.03, 0.3) }} className="glass group overflow-hidden !p-0">
              <Link to={`/result/${p.id}`} className="block">
                <div className="relative aspect-[4/3] overflow-hidden bg-black/5">
                  <img src={assetUrl(p.image_url)} alt={p.plant} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  <div className="absolute left-3 top-3 flex gap-1.5">
                    {p.verdict === 'unrecognised'
                      ? <span className="chip bg-gray-200 text-gray-700">❓ Not recognised</span>
                      : <StatusBadge status={p.status} />}
                    {p.verdict === 'uncertain' && <span className="chip bg-amber-100 text-amber-800">Not sure</span>}
                  </div>
                  <div className="absolute bottom-3 right-3 chip bg-black/55 text-white backdrop-blur">{p.confidence}</div>
                </div>
                <div className="p-4">
                  <div className="font-display text-lg font-semibold">{emojiFor(p.plant)} {p.plant}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">{p.verdict === 'uncertain' ? `Possibly ${p.disease}` : p.disease}</div>
                </div>
              </Link>
              <div className="flex items-center justify-between border-t border-leaf-900/10 px-4 py-2.5 text-xs text-gray-500 dark:border-white/10">
                <span>{new Date(p.created_at).toLocaleString()}</span>
                <div className="flex gap-1">
                  <a href={assetUrl(p.report_url)} download aria-label="Download report" className="rounded-lg p-2 hover:bg-leaf-100 hover:text-leaf-700 dark:hover:bg-white/10"><FileDown className="h-4 w-4" /></a>
                  <button onClick={() => remove(p.id)} aria-label="Delete" className="rounded-lg p-2 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-500/15"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}
