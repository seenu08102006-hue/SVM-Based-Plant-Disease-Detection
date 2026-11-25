import { useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, LabelList, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Activity, Award, Cpu, Database, Gauge, Layers, Target } from 'lucide-react'
import { api } from '../lib/api.js'
import { Card, ErrorBox, SectionTitle, Spinner } from '../components/ui.jsx'

const KERNELS = ['linear', 'poly', 'rbf']
const KERNEL_NAME = { linear: 'Linear', poly: 'Polynomial (d=3)', rbf: 'RBF (Gaussian)' }
const KERNEL_COLOR = { linear: 'var(--series-1)', poly: 'var(--series-2)', rbf: 'var(--series-3)' }
const pct = (v, d = 1) => `${(v * 100).toFixed(d)}%`

function useIsDark() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))
  useEffect(() => {
    const o = new MutationObserver(() => setDark(document.documentElement.classList.contains('dark')))
    o.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => o.disconnect()
  }, [])
  return dark
}

// Sequential single-hue ramp (green), light -> dark on the light surface; inverted steps on dark.
function seq(t, dark) {
  const a = dark ? [11, 26, 18] : [240, 253, 244]
  const b = dark ? [74, 222, 128] : [20, 83, 45]
  const k = Math.max(0, Math.min(1, t)) ** 0.6
  return `rgb(${a.map((x, i) => Math.round(x + (b[i] - x) * k)).join(',')})`
}

function ChartTooltip({ active, payload, label, fmt = (v) => pct(v) }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-black/5 bg-white/95 px-3 py-2 text-xs shadow-lg dark:border-white/10 dark:bg-[#0f2318]/95">
      <div className="mb-1 font-semibold">{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: p.color || p.fill }} />
          <span className="text-gray-500">{p.name}</span><span className="ml-auto pl-3 font-semibold tabular-nums">{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

function Kpi({ icon: Icon, label, value, sub }) {
  return (
    <div className="glass !rounded-2xl p-5">
      <div className="flex items-center gap-2 text-gray-500"><Icon className="h-4 w-4 text-leaf-600" /><span className="label">{label}</span></div>
      <div className="mt-2 font-display text-3xl font-bold tabular-nums">{value}</div>
      {sub && <div className="mt-1 text-xs text-gray-500">{sub}</div>}
    </div>
  )
}

function GridHeatmap({ kernel, rows, dark }) {
  const Cs = [...new Set(rows.map((r) => r.params.C))]
  const gammas = [...new Set(rows.map((r) => String(r.params.gamma ?? '—')))]
  const vals = rows.map((r) => r.cv_accuracy)
  const lo = Math.min(...vals), hi = Math.max(...vals)
  const best = Math.max(...vals)
  const get = (C, g) => rows.find((r) => r.params.C === C && String(r.params.gamma ?? '—') === g)?.cv_accuracy
  return (
    <div>
      <div className="mb-2 text-sm font-semibold">{KERNEL_NAME[kernel]}</div>
      <table className="w-full border-separate border-spacing-0.5 text-xs">
        <thead><tr><th className="text-left font-medium text-gray-500">C \ γ</th>{gammas.map((g) => <th key={g} className="font-medium text-gray-500">{g}</th>)}</tr></thead>
        <tbody>
          {Cs.map((C) => (
            <tr key={C}>
              <th className="pr-2 text-left font-medium text-gray-500">{C}</th>
              {gammas.map((g) => {
                const v = get(C, g)
                const t = hi > lo ? (v - lo) / (hi - lo) : 1
                return (
                  <td key={g} title={`C=${C}, γ=${g}: CV accuracy ${pct(v)}`}
                    className={`rounded-md py-2 text-center tabular-nums ${v === best ? 'ring-2 ring-amber-500' : ''}`}
                    style={{ background: seq(t, dark), color: dark ? (t > 0.55 ? '#052e16' : '#e5efe8') : (t > 0.55 ? '#ffffff' : '#1f2937') }}>
                    {pct(v)}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ConfusionMatrix({ cm, labels, dark }) {
  const [hover, setHover] = useState(null)
  const norm = cm.map((row) => { const s = row.reduce((a, b) => a + b, 0) || 1; return row.map((v) => v / s) })
  const n = labels.length
  return (
    <div>
      <div className="mb-3 min-h-10 text-sm" aria-live="polite">
        {hover ? (
          <span>True <b>{labels[hover[0]]}</b> → predicted <b>{labels[hover[1]]}</b>: {cm[hover[0]][hover[1]]} images ({pct(norm[hover[0]][hover[1]])} of row)</span>
        ) : <span className="text-gray-500">Hover a cell. Rows = true class, columns = predicted class, shaded by share of the row (recall on the diagonal).</span>}
      </div>
      <div className="overflow-x-auto pb-2">
        <div className="inline-grid gap-px" style={{ gridTemplateColumns: `minmax(160px,220px) repeat(${n}, minmax(14px, 1fr))`, minWidth: 160 + n * 15 }}
          onMouseLeave={() => setHover(null)}>
          <div />
          {labels.map((_, j) => <div key={j} className="text-center text-[9px] text-gray-500">{j + 1}</div>)}
          {norm.map((row, i) => (
            <div key={i} className="contents">
              <div className={`truncate pr-2 text-[11px] leading-[16px] ${hover?.[0] === i ? 'font-semibold text-leaf-700 dark:text-leaf-300' : 'text-gray-600 dark:text-gray-400'}`} title={labels[i]}>
                <span className="mr-1 text-gray-400">{i + 1}</span>{labels[i]}
              </div>
              {row.map((v, j) => (
                <div key={j} onMouseEnter={() => setHover([i, j])}
                  className={`aspect-square min-h-[14px] rounded-[2px] ${hover?.[0] === i && hover?.[1] === j ? 'outline outline-2 outline-amber-500' : ''}`}
                  style={{ background: v === 0 ? (dark ? 'rgba(255,255,255,0.03)' : 'rgba(20,83,45,0.04)') : seq(v, dark) }} />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
        0%<div className="h-2 w-40 rounded-full" style={{ background: `linear-gradient(90deg, ${[0, 0.25, 0.5, 0.75, 1].map((t) => seq(t, dark)).join(',')})` }} />100%
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [m, setM] = useState(null)
  const [error, setError] = useState(null)
  const [cmSource, setCmSource] = useState('deployed')
  const [sortKey, setSortKey] = useState('f1')
  const dark = useIsDark()
  useEffect(() => { api.metrics().then(setM).catch((e) => setError(e.message)) }, [])

  const comparison = useMemo(() => m && [
    ['Accuracy', 'accuracy'], ['Precision', 'precision_macro'], ['Recall', 'recall_macro'], ['F1-score', 'f1_macro'],
  ].map(([name, k]) => ({ name, ...Object.fromEntries(KERNELS.map((kr) => [kr, m.kernels[kr].test[k]])) })), [m])

  const distribution = useMemo(() => m && m.classes.map((c, i) => ({ name: m.class_labels[i], count: m.class_distribution[c] }))
    .sort((a, b) => b.count - a.count), [m])

  const perClass = useMemo(() => m && [...m.per_class].sort((a, b) => sortKey === 'label' ? a.label.localeCompare(b.label) : a[sortKey] - b[sortKey]), [m, sortKey])

  if (error) return <ErrorBox>{error}. Train the model with <code>python training/train_svm.py</code> and start the backend.</ErrorBox>
  if (!m) return <div className="glass p-10"><Spinner label="Loading model metrics…" /></div>

  const best = m.kernels[m.best_kernel]
  const cm = cmSource === 'deployed' ? m.confusion_matrix : m.kernels[cmSource].confusion_matrix
  const axis = { stroke: 'var(--chart-muted)', fontSize: 12, tickLine: false, axisLine: { stroke: 'var(--chart-grid)' } }

  return (
    <div className="space-y-8">
      <SectionTitle eyebrow="Model performance" title="SVM evaluation dashboard"
        sub={`Held-out test set of ${m.n_test.toLocaleString()} images (${m.split} split), trained ${m.trained_at}.`} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi icon={Target} label="Accuracy" value={pct(m.deployed.accuracy)} sub="deployed model, test set" />
        <Kpi icon={Gauge} label="Precision" value={pct(m.deployed.precision_macro)} sub="macro average" />
        <Kpi icon={Activity} label="Recall" value={pct(m.deployed.recall_macro)} sub="macro average" />
        <Kpi icon={Award} label="F1-score" value={pct(m.deployed.f1_macro)} sub="macro average" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={Cpu} label="Selected kernel" value={KERNEL_NAME[m.best_kernel]} sub={Object.entries(m.best_params).map(([k, v]) => `${k}=${v}`).join(', ')} />
        <Kpi icon={Layers} label="Feature vector" value={m.feature_dim.toLocaleString()} sub="RGB+HSV hist · Haralick · HOG" />
        <Kpi icon={Database} label="Training images" value={m.n_train_used.toLocaleString()} sub={`≤${m.train_per_class_cap}/class of ${m.n_train_available.toLocaleString()}`} />
        <Kpi icon={Target} label="Support vectors" value={best.n_support_vectors.toLocaleString()} sub={`${m.n_classes} classes · one-vs-one`} />
      </div>

      <Card>
        <h3 className="font-display text-xl font-semibold">Kernel comparison</h3>
        <p className="mb-4 text-sm text-gray-500">Each kernel's best hyper-parameters (by 3-fold CV) refit on the training set, scored on the test set (macro averages).</p>
        <div className="h-80">
          <ResponsiveContainer>
            <BarChart data={comparison} barGap={2} barCategoryGap="22%" margin={{ top: 22, right: 8, left: -8, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
              <XAxis dataKey="name" {...axis} />
              <YAxis {...axis} domain={[0, 1]} tickFormatter={(v) => `${Math.round(v * 100)}%`} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--chart-grid)', opacity: 0.4 }} />
              <Legend iconType="square" wrapperStyle={{ fontSize: 13, color: 'var(--chart-text)' }} formatter={(v) => <span style={{ color: 'var(--chart-text)' }}>{v}</span>} />
              {KERNELS.map((k) => (
                <Bar key={k} dataKey={k} name={KERNEL_NAME[k]} fill={KERNEL_COLOR[k]} radius={[4, 4, 0, 0]} maxBarSize={44}>
                  <LabelList dataKey={k} position="top" formatter={(v) => `${(v * 100).toFixed(0)}`} style={{ fill: 'var(--chart-text)', fontSize: 11 }} />
                </Bar>
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead><tr className="border-b border-leaf-900/10 text-left text-xs uppercase tracking-wider text-gray-500 dark:border-white/10">
              {['Kernel', 'Best params', 'CV acc.', 'Test acc.', 'Precision', 'Recall', 'F1', 'Support vectors', 'Fit time'].map((h) => <th key={h} className="py-2 pr-3 font-semibold">{h}</th>)}
            </tr></thead>
            <tbody>
              {KERNELS.map((k) => {
                const r = m.kernels[k]
                return (
                  <tr key={k} className="border-b border-leaf-900/5 tabular-nums dark:border-white/5">
                    <td className="py-2.5 pr-3 font-medium"><span className="mr-2 inline-block h-2.5 w-2.5 rounded-sm" style={{ background: KERNEL_COLOR[k] }} />{KERNEL_NAME[k]}
                      {k === m.best_kernel && <span className="chip ml-2 bg-amber-100 !py-0.5 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">selected</span>}</td>
                    <td className="pr-3 text-gray-600 dark:text-gray-400">{Object.entries(r.best_params).map(([a, b]) => `${a}=${b}`).join(', ')}</td>
                    <td className="pr-3">{pct(r.cv_accuracy)}</td><td className="pr-3">{pct(r.test.accuracy)}</td>
                    <td className="pr-3">{pct(r.test.precision_macro)}</td><td className="pr-3">{pct(r.test.recall_macro)}</td>
                    <td className="pr-3 font-semibold">{pct(r.test.f1_macro)}</td><td className="pr-3">{r.n_support_vectors.toLocaleString()}</td>
                    <td className="pr-3">{r.fit_seconds.toFixed(0)} s</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <h3 className="font-display text-xl font-semibold">GridSearchCV: cross-validation accuracy</h3>
        <p className="mb-5 text-sm text-gray-500">3-fold CV on a stratified subset of {m.grid_search_samples.toLocaleString()} training images. Darker is better; the outlined cell is each kernel's best.</p>
        <div className="grid gap-6 lg:grid-cols-3">
          {KERNELS.map((k) => <GridHeatmap key={k} kernel={k} rows={m.kernels[k].grid} dark={dark} />)}
        </div>
      </Card>

      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-display text-xl font-semibold">Confusion matrix</h3>
          <div className="flex flex-wrap gap-1 rounded-2xl bg-leaf-900/5 p-1 dark:bg-white/5">
            {[['deployed', 'Deployed model'], ...KERNELS.map((k) => [k, KERNEL_NAME[k]])].map(([k, l]) => (
              <button key={k} onClick={() => setCmSource(k)}
                className={`rounded-xl px-3 py-1.5 text-xs font-medium transition ${cmSource === k ? 'bg-leaf-600 text-white' : 'hover:bg-white/70 dark:hover:bg-white/10'}`}>{l}</button>
            ))}
          </div>
        </div>
        <ConfusionMatrix cm={cm} labels={m.class_labels} dark={dark} />
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <h3 className="font-display text-xl font-semibold">Class distribution</h3>
          <p className="mb-4 text-sm text-gray-500">{m.n_images_total.toLocaleString()} colour images across {m.n_classes} classes. The dataset is imbalanced, which is why training is capped per class.</p>
          <div style={{ height: distribution.length * 22 + 30 }}>
            <ResponsiveContainer>
              <BarChart data={distribution} layout="vertical" margin={{ top: 0, right: 48, left: 0, bottom: 0 }} barCategoryGap={2}>
                <CartesianGrid horizontal={false} stroke="var(--chart-grid)" />
                <XAxis type="number" {...axis} />
                <YAxis type="category" dataKey="name" width={210} {...axis} fontSize={11} interval={0} />
                <Tooltip content={<ChartTooltip fmt={(v) => `${v.toLocaleString()} images`} />} cursor={{ fill: 'var(--chart-grid)', opacity: 0.4 }} />
                <Bar dataKey="count" name="Images" fill="var(--brand-bar)" radius={[0, 4, 4, 0]}>
                  <LabelList dataKey="count" position="right" style={{ fill: 'var(--chart-muted)', fontSize: 10 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-display text-xl font-semibold">Per-class scores</h3>
            <select value={sortKey} onChange={(e) => setSortKey(e.target.value)}
              className="rounded-xl border border-leaf-900/10 bg-white/70 px-3 py-1.5 text-sm dark:border-white/10 dark:bg-white/5">
              <option value="f1">Sort: lowest F1 first</option><option value="recall">Sort: lowest recall first</option>
              <option value="precision">Sort: lowest precision first</option><option value="label">Sort: name</option>
            </select>
          </div>
          <div className="max-h-[860px] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white/90 backdrop-blur dark:bg-[#0b1a12]/90"><tr className="text-left text-xs uppercase tracking-wider text-gray-500">
                <th className="py-2 pr-2">Class</th><th className="pr-2">Precision</th><th className="pr-2">Recall</th><th className="w-36">F1</th><th className="pl-2 text-right">n</th></tr></thead>
              <tbody>
                {perClass.map((r) => (
                  <tr key={r.class} className="border-t border-leaf-900/5 tabular-nums dark:border-white/5">
                    <td className="py-1.5 pr-2">{r.label}</td><td className="pr-2">{pct(r.precision)}</td><td className="pr-2">{pct(r.recall)}</td>
                    <td><div className="flex items-center gap-2"><div className="h-1.5 flex-1 rounded-full bg-leaf-900/10 dark:bg-white/10">
                      <div className="h-full rounded-full" style={{ width: `${r.f1 * 100}%`, background: 'var(--brand-bar)' }} /></div><span className="w-11 text-right">{pct(r.f1)}</span></div></td>
                    <td className="pl-2 text-right text-gray-500">{r.support}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  )
}
