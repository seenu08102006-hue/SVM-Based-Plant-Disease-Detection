import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, BarChart3, Brain, FileDown, History, Microscope, ScanLine, Sparkles, Upload } from 'lucide-react'
import { api, emojiFor } from '../lib/api.js'
import { Card, SectionTitle } from '../components/ui.jsx'

const FALLBACK_CROPS = ['Apple', 'Blueberry', 'Cherry', 'Corn', 'Grape', 'Orange', 'Peach', 'Pepper bell', 'Potato',
  'Raspberry', 'Soybean', 'Squash', 'Strawberry', 'Tomato']

const STEPS = [
  [Upload, 'Upload a leaf', 'Drop a photo of a single leaf on a plain background.'],
  [Microscope, 'Extract features', '1,982 hand-crafted numbers: colour histograms, GLCM texture and HOG shape.'],
  [Brain, 'SVM classifies', 'A kernel Support Vector Machine picks one of 38 crop–disease classes.'],
  [FileDown, 'Act on it', 'Get a description, treatment and prevention plan as a PDF report.'],
]

export default function Home() {
  const [crops, setCrops] = useState(null)
  const [stats, setStats] = useState(null)
  useEffect(() => {
    api.classes().then((d) => setCrops(d.crops)).catch(() => {})
    api.metrics().then(setStats).catch(() => {})
  }, [])
  const cropList = crops ? Object.keys(crops).sort() : FALLBACK_CROPS

  return (
    <div className="space-y-24">
      {/* Hero */}
      <section className="grid items-center gap-10 pt-6 lg:grid-cols-[1.1fr_0.9fr] lg:pt-14">
        <div>
          <motion.span initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="chip mb-5 border border-leaf-600/20 bg-white/70 text-leaf-800 dark:border-white/10 dark:bg-white/5 dark:text-leaf-300">
            <Sparkles className="h-3.5 w-3.5" /> Classical machine learning · no deep learning
          </motion.span>
          <motion.h1 initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            className="font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-leaf-950 sm:text-5xl lg:text-6xl dark:text-white">
            Your AI plant doctor,<br />
            <span className="bg-gradient-to-r from-leaf-600 via-emerald-500 to-lime-500 bg-clip-text text-transparent">diagnosing leaves in seconds.</span>
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="mt-6 max-w-xl text-lg text-gray-600 dark:text-gray-300">
            Upload a photo of a leaf. A Support Vector Machine trained on the PlantVillage dataset identifies
            the crop, the disease and how confident it is, then gives you treatment and prevention steps.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            className="mt-8 flex flex-wrap gap-3">
            <Link to="/detect" className="btn-primary text-base"><Upload className="h-5 w-5" /> Upload a leaf image</Link>
            <Link to="/dashboard" className="btn-ghost text-base"><BarChart3 className="h-5 w-5" /> Model performance</Link>
          </motion.div>
          <div className="mt-10 grid max-w-lg grid-cols-3 gap-4">
            {[
              [stats ? stats.n_images_total.toLocaleString() : '54,305', 'leaf images'],
              [stats ? stats.n_classes : 38, 'classes'],
              [stats ? `${(stats.deployed.accuracy * 100).toFixed(1)}%` : '—', 'test accuracy'],
            ].map(([v, l]) => (
              <div key={l}>
                <div className="font-display text-2xl font-bold text-leaf-800 sm:text-3xl dark:text-leaf-300">{v}</div>
                <div className="text-sm text-gray-500">{l}</div>
              </div>
            ))}
          </div>
        </div>

        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.15, duration: 0.6 }}
          className="relative mx-auto w-full max-w-md">
          <div className="glass relative overflow-hidden p-6">
            <div className="relative aspect-square overflow-hidden rounded-2xl bg-gradient-to-br from-leaf-200 via-emerald-100 to-lime-100 dark:from-leaf-900 dark:via-emerald-950 dark:to-[#0b1f14]">
              <div className="absolute inset-0 grid place-items-center text-[9rem] drop-shadow-xl sm:text-[11rem]">🍃</div>
              <motion.div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-leaf-500 to-transparent shadow-[0_0_24px_4px_rgba(34,197,94,0.6)]"
                animate={{ top: ['8%', '92%', '8%'] }} transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }} />
              <div className="absolute left-3 top-3 chip bg-white/80 text-leaf-800 dark:bg-black/40 dark:text-leaf-300"><ScanLine className="h-3.5 w-3.5" /> scanning</div>
            </div>
            <div className="mt-5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="label">Prediction</div>
                  <div className="font-display text-xl font-bold">🍅 Tomato · Early blight</div>
                </div>
                <span className="chip bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300">Diseased</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-leaf-900/10 dark:bg-white/10">
                <motion.div className="h-full rounded-full bg-gradient-to-r from-leaf-500 to-emerald-400"
                  initial={{ width: 0 }} animate={{ width: '94%' }} transition={{ delay: 0.6, duration: 1.2 }} />
              </div>
              <p className="text-xs text-gray-500">Illustrative example</p>
            </div>
          </div>
        </motion.div>
      </section>

      {/* How it works */}
      <section>
        <SectionTitle eyebrow="How it works" title="From photo to diagnosis"
          sub="Every step is explainable: the model sees measurable colour, texture and shape, not a black box." />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(([Icon, t, d], i) => (
            <Card key={t} delay={i * 0.07}>
              <div className="mb-4 flex items-center justify-between">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-leaf-100 text-leaf-700 dark:bg-leaf-500/15 dark:text-leaf-300"><Icon className="h-5 w-5" /></span>
                <span className="font-display text-3xl font-bold text-leaf-900/10 dark:text-white/10">0{i + 1}</span>
              </div>
              <h3 className="font-display text-lg font-semibold">{t}</h3>
              <p className="mt-1.5 text-sm text-gray-600 dark:text-gray-400">{d}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Supported crops */}
      <section>
        <SectionTitle eyebrow="Multi-crop" title={`${cropList.length} supported crops`}
          sub="Classes are discovered automatically from the dataset folders. Healthy and diseased leaves for each crop." />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-7">
          {cropList.map((c, i) => {
            const list = crops?.[c] || []
            const diseases = list.filter((d) => d.status !== 'Healthy').length
            return (
              <motion.div key={c} initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                transition={{ delay: i * 0.03 }} whileHover={{ y: -4 }}
                className="glass flex flex-col items-center !rounded-2xl p-4 text-center" title={list.map((d) => d.disease).join(', ')}>
                <div className="text-4xl">{emojiFor(c)}</div>
                <div className="mt-2 font-semibold">{c}</div>
                {crops && <div className="text-xs text-gray-500">{diseases ? `${diseases} disease${diseases > 1 ? 's' : ''}` : 'healthy only'}</div>}
              </motion.div>
            )
          })}
        </div>
      </section>

      {/* CTA */}
      <section className="glass relative overflow-hidden p-8 sm:p-12">
        <div className="absolute -right-10 -top-10 text-[10rem] opacity-10 select-none">🌱</div>
        <div className="relative flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div>
            <h2 className="h-section">Check a leaf now</h2>
            <p className="mt-2 max-w-xl text-gray-600 dark:text-gray-400">Every scan is saved to your history with a downloadable PDF report.</p>
          </div>
          <div className="flex gap-3">
            <Link to="/detect" className="btn-primary">Start detection <ArrowRight className="h-4 w-4" /></Link>
            <Link to="/history" className="btn-ghost"><History className="h-4 w-4" /> History</Link>
          </div>
        </div>
      </section>
    </div>
  )
}
