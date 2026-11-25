import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { AlertTriangle, ArrowLeft, BookOpen, Calendar, FileDown, HelpCircle, ScanSearch, ShieldCheck, Stethoscope } from 'lucide-react'
import CropPicker, { OTHER } from '../components/CropPicker.jsx'
import { api, assetUrl, emojiFor } from '../lib/api.js'
import { Card, ConfidenceRing, ErrorBox, Spinner, StatusBadge } from '../components/ui.jsx'

function ListCard({ icon: Icon, title, items, tone, delay }) {
  const tones = {
    green: 'bg-leaf-100 text-leaf-700 dark:bg-leaf-500/15 dark:text-leaf-300',
    blue: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
  }
  return (
    <Card delay={delay}>
      <h3 className="mb-4 flex items-center gap-3 font-display text-lg font-semibold">
        <span className={`grid h-10 w-10 place-items-center rounded-xl ${tones[tone]}`}><Icon className="h-5 w-5" /></span>{title}
      </h3>
      <ol className="space-y-3">
        {items.map((t, i) => (
          <motion.li key={t} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: delay + 0.1 + i * 0.06 }}
            className="flex gap-3 text-sm text-gray-700 dark:text-gray-300">
            <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold ${tones[tone]}`}>{i + 1}</span>
            <span className="pt-0.5">{t}</span>
          </motion.li>
        ))}
      </ol>
    </Card>
  )
}

export default function Result() {
  const { id } = useParams()
  const { state } = useLocation()
  const [r, setR] = useState(state?.result?.id === id ? state.result : null)
  const [error, setError] = useState(null)
  const [pick, setPick] = useState(null)
  const [rechecking, setRechecking] = useState(false)
  const [recheckError, setRecheckError] = useState(null)

  useEffect(() => {
    if (r) return
    api.item(id).then(setR).catch((e) => setError(e.message))
  }, [id, r])

  if (error) return <ErrorBox>{error} <Link to="/history" className="underline">Back to history</Link></ErrorBox>
  if (!r) return <div className="glass p-10"><Spinner label="Loading result…" /></div>

  const verdict = r.verdict || 'confident'
  const unknown = verdict === 'unrecognised'
  const unsure = verdict === 'uncertain'
  const healthy = r.status === 'Healthy'

  const recheck = async (crop) => {
    setPick(crop)
    if (crop === OTHER) return
    setRechecking(true); setRecheckError(null)
    try { setR(await api.recheck(r.id, crop)) } catch (e) { setRecheckError(e.message) } finally { setRechecking(false) }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/detect" className="btn-ghost !py-2 text-sm"><ArrowLeft className="h-4 w-4" /> New scan</Link>
        <div className="flex gap-2">
          <a href={assetUrl(r.report_url)} className="btn-primary !py-2 text-sm" download><FileDown className="h-4 w-4" /> Download PDF report</a>
        </div>
      </div>

      {r.notes?.length > 0 && (
        <div className={`flex items-start gap-3 rounded-2xl border p-4 text-sm ${unknown
          ? 'border-red-300/60 bg-red-50 text-red-900 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200'
          : 'border-amber-300/60 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200'}`}>
          {unknown ? <HelpCircle className="mt-0.5 h-5 w-5 shrink-0" /> : <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />}
          <div className="space-y-1.5">{r.notes.map((n) => <p key={n}>{n}</p>)}</div>
        </div>
      )}

      {verdict !== 'confident' || pick !== null ? (
        <Card className="!p-5">
          <div className="mb-1 font-display font-semibold">Wrong plant? Tell the model which crop this is</div>
          <p className="mb-3 text-sm text-gray-500">The scan is re-checked using only that crop's diseases. No need to upload again.</p>
          <CropPicker value={pick ?? (r.crop_hint || '')} onChange={recheck} compact disabled={rechecking} />
          {rechecking && <div className="mt-3"><Spinner label="Re-checking…" /></div>}
          {recheckError && <div className="mt-3"><ErrorBox>{recheckError}</ErrorBox></div>}
          {pick === OTHER && (
            <p className="mt-3 rounded-2xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
              <b>This plant is not supported.</b> The model only knows the 14 crops above, so it cannot give the correct name or disease for
              this leaf. Please ask a local plant clinic or agricultural extension officer.
            </p>
          )}
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <Card className="!p-4">
          <div className="overflow-hidden rounded-2xl bg-black/5 dark:bg-black/30">
            <img src={assetUrl(r.image_url)} alt={`Uploaded leaf: ${r.plant}`} className="mx-auto max-h-[440px] w-full object-contain" />
          </div>
          <div className="mt-3 flex items-center gap-2 px-1 text-xs text-gray-500">
            <Calendar className="h-3.5 w-3.5" /> {new Date(r.created_at).toLocaleString()} {r.original_name && <>· {r.original_name}</>}
          </div>
        </Card>

        <div className="space-y-6">
          <Card delay={0.05} className="relative overflow-hidden">
            <div className={`absolute inset-x-0 top-0 h-1.5 ${unknown ? 'bg-gray-400' : unsure ? 'bg-gradient-to-r from-amber-400 to-yellow-400'
              : healthy ? 'bg-gradient-to-r from-leaf-400 to-emerald-500' : 'bg-gradient-to-r from-red-400 to-orange-400'}`} />
            <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
              {unknown
                ? <div className="grid h-[132px] w-[132px] shrink-0 place-items-center rounded-full border-[10px] border-gray-300 text-5xl dark:border-white/10">❓</div>
                : <ConfidenceRing value={r.confidence_value} />}
              <div className="flex-1 space-y-4 text-center sm:text-left">
                <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
                  {unknown ? <span className="chip bg-gray-200 text-gray-700 dark:bg-white/10 dark:text-gray-200"><HelpCircle className="h-3.5 w-3.5" /> Not recognised</span>
                    : <StatusBadge status={r.status} />}
                  {unsure && <span className="chip bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300"><AlertTriangle className="h-3.5 w-3.5" /> Not sure</span>}
                  {r.crop_hint && <span className="chip bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300">Crop chosen by you</span>}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="label">Crop</div>
                    <div className="font-display text-2xl font-bold">{unknown && !r.crop_hint ? '❓' : emojiFor(r.plant)} {r.plant}</div>
                  </div>
                  <div>
                    <div className="label">{unsure ? 'Possible disease' : 'Disease'}</div>
                    <div className={`font-display text-2xl font-bold ${unknown ? 'text-gray-500' : healthy ? 'text-leaf-700 dark:text-leaf-400' : 'text-red-600 dark:text-red-400'}`}>
                      {unsure ? `Possibly ${r.disease}` : r.disease}
                    </div>
                  </div>
                  <div><div className="label">Confidence</div><div className="font-semibold">{unknown ? '—' : r.confidence}</div></div>
                  <div><div className="label">Health status</div><div className="font-semibold">{unknown ? 'Unknown' : unsure ? `${r.status}?` : r.status}</div></div>
                </div>
              </div>
            </div>
          </Card>

          <Card delay={0.1}>
            <h3 className="mb-1 font-display text-lg font-semibold">{verdict === 'confident' ? 'Top predictions' : 'Closest matches'}</h3>
            <p className="mb-4 text-xs text-gray-500">{verdict === 'confident'
              ? 'Among the 38 classes the model knows.'
              : 'Nearest of the 38 known classes. Not a diagnosis.'}</p>
            <div className="space-y-3" role="list">
              {r.top_predictions.map((p, i) => (
                <div key={p.class_name} role="listitem">
                  <div className="mb-1 flex justify-between gap-3 text-sm">
                    <span className={i === 0 ? 'font-semibold' : 'text-gray-600 dark:text-gray-400'}>{emojiFor(p.plant)} {p.plant} — {p.disease}</span>
                    <span className="tabular-nums font-medium">{p.confidence.toFixed(1)}%</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-leaf-900/10 dark:bg-white/10">
                    <motion.div className="h-full rounded-full" style={{ background: i === 0 ? 'var(--brand-bar)' : 'var(--chart-muted)' }}
                      initial={{ width: 0 }} animate={{ width: `${Math.max(p.confidence, 0.5)}%` }} transition={{ duration: 0.9, delay: 0.2 + i * 0.1 }} />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <Card delay={0.1}>
        <h3 className="mb-3 flex items-center gap-3 font-display text-lg font-semibold">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"><BookOpen className="h-5 w-5" /></span>
          {unsure ? `About ${r.disease} (if the diagnosis is right)` : unknown ? 'Why no diagnosis' : 'Disease information'}
        </h3>
        <p className="leading-relaxed text-gray-700 dark:text-gray-300">{r.description}</p>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <ListCard icon={Stethoscope} title="Treatment" items={r.treatment} tone="blue" delay={0.15} />
        <ListCard icon={ShieldCheck} title="Prevention" items={r.prevention} tone="green" delay={0.2} />
      </div>

      <div className="flex flex-wrap justify-center gap-3 pt-2">
        <Link to="/detect" className="btn-primary"><ScanSearch className="h-5 w-5" /> Scan another leaf</Link>
        <Link to="/history" className="btn-ghost">View history</Link>
      </div>
      <p className="text-center text-xs text-gray-500">Guidance only. Confirm with a local agronomist before applying chemical treatments.</p>
    </div>
  )
}
