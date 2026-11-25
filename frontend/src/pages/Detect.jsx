import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Camera, ImagePlus, Lightbulb, RefreshCw, ScanSearch, X } from 'lucide-react'
import { api } from '../lib/api.js'
import { Card, ErrorBox, SectionTitle } from '../components/ui.jsx'
import CropPicker, { OTHER } from '../components/CropPicker.jsx'

const STAGES = ['Resizing to 256 × 256', 'Computing RGB & HSV histograms', 'Measuring GLCM / Haralick texture',
  'Extracting HOG shape descriptors', 'Running the SVM classifier']
const MAX_MB = 10

export default function Detect() {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [drag, setDrag] = useState(false)
  const [loading, setLoading] = useState(false)
  const [stage, setStage] = useState(0)
  const [error, setError] = useState(null)
  const [modelReady, setModelReady] = useState(null) // null = checking, false = not trained / backend down
  const [backendDown, setBackendDown] = useState(false)
  const [crop, setCrop] = useState('')
  const unsupported = crop === OTHER
  const inputRef = useRef(null)
  const navigate = useNavigate()

  // Poll /health until the model is loaded, so the user never hits "missing model files".
  useEffect(() => {
    let alive = true
    let timer
    const check = async () => {
      try {
        const h = await api.health()
        if (!alive) return
        setBackendDown(false)
        setModelReady(h.model_loaded)
        if (h.model_loaded) return
      } catch {
        if (!alive) return
        setBackendDown(true)
        setModelReady(false)
      }
      timer = setTimeout(check, 10000)
    }
    check()
    return () => { alive = false; clearTimeout(timer) }
  }, [])

  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview])
  useEffect(() => {
    if (!loading) return
    setStage(0)
    const t = setInterval(() => setStage((s) => Math.min(s + 1, STAGES.length - 1)), 450)
    return () => clearInterval(t)
  }, [loading])

  const pick = useCallback((f) => {
    setError(null)
    if (!f) return
    if (!f.type.startsWith('image/')) return setError('Please choose an image file (JPG, PNG, WEBP).')
    if (f.size > MAX_MB * 1024 * 1024) return setError(`Image is larger than ${MAX_MB} MB.`)
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }, [])

  const onDrop = (e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files?.[0]) }
  const reset = () => { setFile(null); setPreview(null); setError(null); if (inputRef.current) inputRef.current.value = '' }

  const detect = async () => {
    if (!file) return
    setLoading(true); setError(null)
    try {
      const res = await api.predict(file, crop)
      navigate(`/result/${res.id}`, { state: { result: res } })
    } catch (e) {
      setError(e.message.includes('Failed to fetch') || /^Request failed \(50[02]\)$/.test(e.message)
        ? 'Cannot reach the backend. Start it with: uvicorn app.main:app --port 8000 (inside backend/).'
        : e.message)
      setLoading(false)
    }
  }

  return (
    <div>
      <SectionTitle eyebrow="Disease detection" title="Upload a leaf image"
        sub="Use a clear photo of one leaf, filling most of the frame. The model was trained on leaves photographed on plain backgrounds." />

      {modelReady === false && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-300/60 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <span className="mt-1 h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-amber-500" />
          {backendDown ? (
            <div><b>Backend not reachable.</b> Start it inside <code>backend/</code> with <code>uvicorn app.main:app --port 8000</code>. This page re-checks every 10 seconds.</div>
          ) : (
            <div><b>The SVM model is not ready yet.</b> Training (<code>python training/train_svm.py</code>) has not saved the model files.
              You can choose an image now; detection unlocks automatically when the model is available.</div>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.4fr_0.6fr]">
        <Card className="!p-4 sm:!p-6">
          <AnimatePresence mode="wait">
            {!preview ? (
              <motion.label key="drop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onDragOver={(e) => { e.preventDefault(); setDrag(true) }} onDragLeave={() => setDrag(false)} onDrop={onDrop}
                className={`flex min-h-[380px] cursor-pointer flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed p-8 text-center transition-all
                  ${drag ? 'scale-[1.01] border-leaf-500 bg-leaf-100/70 dark:bg-leaf-500/10' : 'border-leaf-600/25 hover:border-leaf-500 hover:bg-leaf-50/80 dark:border-white/15 dark:hover:bg-white/5'}`}>
                <motion.div animate={{ y: drag ? -6 : 0 }} className="grid h-20 w-20 place-items-center rounded-3xl bg-gradient-to-br from-leaf-500 to-emerald-600 text-white shadow-xl shadow-leaf-600/30">
                  <ImagePlus className="h-9 w-9" />
                </motion.div>
                <div>
                  <p className="font-display text-xl font-semibold">{drag ? 'Drop it here' : 'Drag & drop a leaf photo'}</p>
                  <p className="mt-1 text-sm text-gray-500">or click to browse · JPG, PNG, WEBP up to {MAX_MB} MB</p>
                </div>
                <span className="btn-ghost !py-2 text-sm"><Camera className="h-4 w-4" /> Choose / take photo</span>
                <input ref={inputRef} type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
              </motion.label>
            ) : (
              <motion.div key="preview" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
                <div className="relative overflow-hidden rounded-2xl bg-black/5 dark:bg-black/30">
                  <img src={preview} alt="Leaf preview" className="mx-auto max-h-[460px] w-full object-contain" />
                  {loading && (
                    <>
                      <div className="absolute inset-0 bg-leaf-950/30 backdrop-blur-[1px]" />
                      <motion.div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-leaf-400 to-transparent shadow-[0_0_30px_6px_rgba(74,222,128,0.7)]"
                        animate={{ top: ['4%', '96%', '4%'] }} transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }} />
                    </>
                  )}
                  {!loading && (
                    <button onClick={reset} aria-label="Remove image"
                      className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-black/50 text-white backdrop-blur transition hover:bg-black/70">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="mt-4 flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
                  <p className="truncate text-sm text-gray-500">{file?.name} · {(file?.size / 1024).toFixed(0)} KB</p>
                  <div className="flex gap-2">
                    <button className="btn-ghost" onClick={reset} disabled={loading}><RefreshCw className="h-4 w-4" /> Change</button>
                    <button className="btn-primary min-w-40" onClick={detect} disabled={loading || !modelReady || unsupported}>
                      {loading ? <span className="flex items-center gap-2"><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />Analysing…</span>
                        : <><ScanSearch className="h-5 w-5" /> Detect disease</>}
                    </button>
                  </div>
                </div>
                {loading && (
                  <div className="mt-5 space-y-2">
                    {STAGES.map((s, i) => (
                      <div key={s} className={`flex items-center gap-3 text-sm transition-opacity ${i <= stage ? 'opacity-100' : 'opacity-35'}`}>
                        <span className={`h-2 w-2 rounded-full ${i < stage ? 'bg-leaf-500' : i === stage ? 'animate-pulse bg-amber-500' : 'bg-gray-400'}`} />
                        {s}
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
          <div className="mt-6 border-t border-leaf-900/10 pt-5 dark:border-white/10">
            <div className="mb-1 font-display font-semibold">Which plant is this?</div>
            <p className="mb-3 text-sm text-gray-500">
              Selecting the crop gives the most reliable result: the plant name comes from you, and the model only chooses among that crop's diseases.
            </p>
            <CropPicker value={crop} onChange={setCrop} disabled={loading} />
            {unsupported && (
              <div className="mt-4 rounded-2xl border border-amber-300/60 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                <b>This plant is not supported.</b> The model was trained only on the 14 crops listed above (PlantVillage dataset).
                It cannot name or diagnose other plants such as roses, and any answer it gave would be a wrong name. Please consult a local plant clinic or agricultural extension officer.
              </div>
            )}
          </div>
          {error && <div className="mt-4"><ErrorBox>{error}</ErrorBox></div>}
        </Card>

        <Card delay={0.1}>
          <h3 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold"><Lightbulb className="h-5 w-5 text-amber-500" /> Tips for accurate results</h3>
          <ul className="space-y-3 text-sm text-gray-600 dark:text-gray-300">
            {['One leaf per photo, centred', 'Plain, uncluttered background', 'Good, even daylight — no harsh shadows',
              'Show the upper surface with symptoms visible', 'Supported crops: apple, blueberry, cherry, corn, grape, orange, peach, bell pepper, potato, raspberry, soybean, squash, strawberry, tomato']
              .map((t) => (
                <li key={t} className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-leaf-500" />{t}</li>
              ))}
          </ul>
          <p className="mt-5 rounded-2xl bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
            The SVM only knows the 38 PlantVillage classes. Photos of other plants, or field photos with busy backgrounds,
            will still be mapped to the closest class, so check the confidence score.
          </p>
        </Card>
      </div>
    </div>
  )
}
