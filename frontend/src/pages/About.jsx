import { useState } from 'react'
import {
  ArrowRight, BarChart3, Code2, Droplets, Globe2, Image as ImageIcon, Leaf, Lightbulb, Microscope, Palette, ScanLine,
  Shapes, ShieldCheck, SlidersHorizontal, Sprout, Timer, TrendingUp, Waves,
} from 'lucide-react'
import { Card, SectionTitle } from '../components/ui.jsx'
import { Formula, Tex } from '../components/Math.jsx'
import { STAGES } from '../content/mathConcepts.js'

const STAGE_ICONS = { Image: ImageIcon, Microscope, SlidersHorizontal, ScanLine, BarChart3, ShieldCheck }

const PIPELINE = [
  ['Leaf photo', 'any size'],
  ['Resize 256²', 'area interpolation'],
  ['Features', 'histograms · GLCM · HOG'],
  ['Standardise', 'z-score'],
  ['SVM', '703 one-vs-one'],
  ['Platt scaling', 'probabilities'],
  ['Safeguards', 'threshold · crop · kNN'],
]

const FEATURES = [
  [Palette, 'Colour: RGB histogram', '96', '32-bin normalised histogram per R, G, B channel. Disease changes leaf pigment: chlorosis turns leaves yellow, necrosis turns them brown.'],
  [Droplets, 'Colour: HSV histogram', '96', '32 bins each for hue, saturation and value. Hue separates "what colour" from "how bright", so it is more robust to lighting.'],
  [Waves, 'Texture: GLCM + Haralick', '26', 'Grey-Level Co-occurrence Matrix at 0°, 45°, 90°, 135° (32 grey levels). 13 Haralick statistics (contrast, correlation, entropy, homogeneity…), averaged plus their range across angles.'],
  [Shapes, 'Shape: HOG', '1,764', 'Histogram of Oriented Gradients: 9 orientation bins on 32×32-pixel cells, 2×2 block normalisation. Captures leaf outline, veins and lesion edges.'],
]

const ALTERNATIVES = [
  ['Convolutional neural network', 'Not used on purpose: the project shows that explainable, hand-crafted features plus a classical classifier work. CNNs score higher on PlantVillage but need a GPU, far more compute and give no human-readable features.'],
  ['k-nearest-neighbour classifier', 'Must compare every upload with all training images (slow) and degrades in 1,982 dimensions. We still use kNN where it is good: the novelty check in 32 PCA dimensions.'],
  ['Random forest / decision trees', 'Axis-aligned splits on single features suit tabular data less well than dense histogram and HOG vectors, where the signal is spread across many correlated dimensions.'],
  ['Logistic regression', 'Linear only and no margin maximisation. The linear SVM covers the same case, and kernels add non-linear options.'],
  ['Naive Bayes', 'Assumes features are independent. Neighbouring histogram bins and HOG cells are strongly correlated, so that assumption is badly wrong here.'],
]

const BENEFITS = [
  [Timer, 'Early detection', 'Spot disease before it spreads across a field, when treatment is cheapest.'],
  [Droplets, 'Less chemical use', 'Treat only what is actually diseased, with the right product, instead of blanket spraying.'],
  [TrendingUp, 'Higher yields', 'Plant diseases cause an estimated 20–40% of global crop losses each year.'],
  [Globe2, 'Expert access anywhere', 'A smartphone puts a first diagnosis in the hands of smallholder farmers far from an agronomist.'],
]

function FormulaTable({ rows }) {
  return (
    <div className="my-3 overflow-x-auto rounded-2xl border border-leaf-600/15 dark:border-white/10">
      <table className="w-full text-sm">
        <tbody>
          {rows.map(([name, tex]) => (
            <tr key={name} className="border-b border-leaf-600/10 last:border-0 odd:bg-leaf-50/70 dark:border-white/5 dark:odd:bg-white/[0.03]">
              <td className="whitespace-nowrap px-4 py-2 font-medium text-gray-700 dark:text-gray-300">{name}</td>
              <td className="px-4 py-2 text-leaf-950 dark:text-leaf-50"><Tex>{tex}</Tex></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ConceptCard({ c, delay }) {
  return (
    <Card delay={delay} className="!p-5 sm:!p-6">
      <h4 className="font-display text-lg font-semibold">{c.name}</h4>
      {c.table && <FormulaTable rows={c.table} />}
      {c.tex?.map((t) => <Formula key={t} tex={t} />)}
      {c.notes?.map((n) => <p key={n} className="mb-2 text-xs text-gray-500 dark:text-gray-400">{n}</p>)}
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl bg-sky-50 p-3 dark:bg-sky-500/10">
          <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-sky-800 dark:text-sky-300"><Code2 className="h-3.5 w-3.5" /> Where it’s used</div>
          <p className="text-sm text-gray-700 dark:text-gray-300">{c.where}</p>
        </div>
        <div className="rounded-2xl bg-amber-50 p-3 dark:bg-amber-500/10">
          <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-800 dark:text-amber-300"><Lightbulb className="h-3.5 w-3.5" /> Why this choice</div>
          <p className="text-sm text-gray-700 dark:text-gray-300">{c.why}</p>
        </div>
      </div>
    </Card>
  )
}

function MathReference() {
  const [stage, setStage] = useState(STAGES[0].id)
  const current = STAGES.find((s) => s.id === stage)
  const total = STAGES.reduce((n, s) => n + s.concepts.length, 0)
  return (
    <section id="maths">
      <SectionTitle eyebrow="Mathematics used in this project" title={`${total} concepts, from pixels to diagnosis`}
        sub="Every formula below is implemented in the code. For each one: the maths, where it is used, and why it was chosen over the alternatives." />

      <div className="sticky top-[84px] z-30 -mx-1 mb-6 overflow-x-auto px-1 pb-1">
        <div className="glass inline-flex min-w-full gap-1 !rounded-2xl p-1.5 sm:min-w-0" role="tablist">
          {STAGES.map((s, i) => {
            const Icon = STAGE_ICONS[s.icon]
            const active = s.id === stage
            return (
              <button key={s.id} role="tab" aria-selected={active} onClick={() => setStage(s.id)}
                className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition
                  ${active ? 'bg-leaf-600 text-white shadow-md shadow-leaf-600/25' : 'hover:bg-leaf-100 dark:hover:bg-white/10'}`}>
                <span className={`grid h-5 w-5 place-items-center rounded-full text-[10px] font-bold ${active ? 'bg-white/25' : 'bg-leaf-900/10 dark:bg-white/10'}`}>{i + 1}</span>
                <Icon className="h-4 w-4" />{s.title}
              </button>
            )
          })}
        </div>
      </div>

      <p className="mb-5 text-gray-600 dark:text-gray-400"><b className="text-gray-900 dark:text-white">{current.title}:</b> {current.summary}</p>
      <div key={stage} className="grid gap-5 xl:grid-cols-2">
        {current.concepts.map((c, i) => <ConceptCard key={c.name} c={c} delay={Math.min(i * 0.05, 0.2)} />)}
      </div>

      <div className="mt-6 flex justify-between gap-3">
        {STAGES.findIndex((s) => s.id === stage) > 0 ? (
          <button className="btn-ghost !py-2 text-sm" onClick={() => setStage(STAGES[STAGES.findIndex((s) => s.id === stage) - 1].id)}>← Previous stage</button>
        ) : <span />}
        {STAGES.findIndex((s) => s.id === stage) < STAGES.length - 1 && (
          <button className="btn-primary !py-2 text-sm" onClick={() => setStage(STAGES[STAGES.findIndex((s) => s.id === stage) + 1].id)}>
            Next: {STAGES[STAGES.findIndex((s) => s.id === stage) + 1].title} <ArrowRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </section>
  )
}

export default function About() {
  return (
    <div className="space-y-16">
      <SectionTitle eyebrow="About the project" title="How the AI plant doctor works"
        sub="A classical computer-vision pipeline: hand-crafted image features fed to a Support Vector Machine. No neural networks, and every number the model sees can be explained." />

      {/* Pipeline overview */}
      <Card className="!p-5">
        <div className="label mb-3">The pipeline</div>
        <ol className="flex flex-wrap items-stretch gap-2">
          {PIPELINE.map(([t, s], i) => (
            <li key={t} className="flex items-center gap-2">
              <div className="rounded-2xl border border-leaf-600/15 bg-white/70 px-3 py-2 dark:border-white/10 dark:bg-white/5">
                <div className="text-sm font-semibold">{t}</div>
                <div className="text-xs text-gray-500">{s}</div>
              </div>
              {i < PIPELINE.length - 1 && <ArrowRight className="h-4 w-4 shrink-0 text-leaf-600" />}
            </li>
          ))}
        </ol>
        <a href="#maths" className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-leaf-700 hover:underline dark:text-leaf-400">
          Jump to the full mathematics reference <ArrowRight className="h-3.5 w-3.5" />
        </a>
      </Card>

      {/* SVM */}
      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h3 className="mb-2 flex items-center gap-2 font-display text-2xl font-bold"><ScanLine className="h-6 w-6 text-leaf-600" /> Support Vector Machine</h3>
          <p className="text-gray-700 dark:text-gray-300">
            An SVM finds the <b>hyperplane</b> that separates two classes with the <b>widest margin</b>. Only the training points that sit on
            or inside the margin (the <i>support vectors</i>) define the boundary, which makes SVMs robust in high-dimensional feature spaces like ours (1,982 dimensions).
          </p>
          <svg viewBox="0 0 320 190" className="mt-4 w-full" role="img" aria-label="Diagram: two classes separated by a maximum-margin hyperplane">
            <line x1="40" y1="180" x2="270" y2="10" className="stroke-leaf-700 dark:stroke-leaf-400" strokeWidth="2.5" />
            <line x1="5" y1="160" x2="235" y2="-10" className="stroke-gray-400" strokeDasharray="5 5" strokeWidth="1.5" />
            <line x1="75" y1="200" x2="305" y2="30" className="stroke-gray-400" strokeDasharray="5 5" strokeWidth="1.5" />
            {[[40, 40], [70, 70], [30, 95], [95, 35], [60, 120], [110, 70]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="7" fill="#16a34a" opacity={i > 3 ? 1 : 0.65} stroke={i > 3 ? '#facc15' : 'none'} strokeWidth="3" />)}
            {[[250, 150], [280, 120], [220, 170], [290, 165], [200, 140], [245, 100]].map(([x, y], i) => <rect key={i} x={x - 7} y={y - 7} width="14" height="14" rx="3" fill="#dc2626" opacity={i > 3 ? 1 : 0.65} stroke={i > 3 ? '#facc15' : 'none'} strokeWidth="3" />)}
            <text x="180" y="60" className="fill-gray-500 text-[11px]">margin = 2 / ‖w‖</text>
            <text x="10" y="186" className="fill-gray-500 text-[10px]">yellow outline = support vectors</text>
          </svg>
        </Card>

        <Card delay={0.05}>
          <h3 className="mb-2 font-display text-xl font-semibold">The mathematics, in short</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">Decision function for a feature vector <Tex>{'\\mathbf x'}</Tex>:</p>
          <Formula tex={String.raw`f(\mathbf x)=\operatorname{sign}(\mathbf w^\top\mathbf x+b)`} />
          <p className="text-sm text-gray-600 dark:text-gray-400">Soft-margin training (primal) maximises the margin while paying a penalty <Tex>C</Tex> for each violation <Tex>{'\\xi_i'}</Tex>:</p>
          <Formula tex={String.raw`\min_{\mathbf w,b,\boldsymbol\xi}\ \tfrac12\lVert\mathbf w\rVert^2+C\sum_i\xi_i\quad\text{s.t.}\quad y_i(\mathbf w^\top\mathbf x_i+b)\ge1-\xi_i,\ \xi_i\ge0`}
            note="Large C → fewer training errors, narrower margin (risk of over-fitting). Small C → wider, smoother margin." />
          <p className="text-sm text-gray-600 dark:text-gray-400">In the dual form, data only appears through dot products, which can be replaced by a <b>kernel</b> (the kernel trick):</p>
          <Formula tex={String.raw`f(\mathbf x)=\operatorname{sign}\Big(\sum_i\alpha_i y_i K(\mathbf x_i,\mathbf x)+b\Big),\qquad 0\le\alpha_i\le C`} note="αᵢ > 0 only for support vectors." />
        </Card>
      </section>

      <section>
        <SectionTitle eyebrow="Kernel comparison" title="Three kernels, one grid search" sub="Each kernel was tuned with GridSearchCV over C ∈ {0.1, 1, 10, 100} and γ ∈ {scale, auto, 0.001, 0.01}, then compared on accuracy, precision, recall, F1 and the confusion matrix." />
        <div className="grid gap-5 md:grid-cols-3">
          <Card>
            <h4 className="font-display text-lg font-semibold">Linear</h4>
            <Formula tex={String.raw`K(\mathbf x,\mathbf z)=\mathbf x^\top\mathbf z`} />
            <p className="text-sm text-gray-600 dark:text-gray-400">A flat hyperplane in feature space. Fast and interpretable; works when classes are (nearly) linearly separable.</p>
          </Card>
          <Card delay={0.05}>
            <h4 className="font-display text-lg font-semibold">Polynomial</h4>
            <Formula tex={String.raw`K(\mathbf x,\mathbf z)=(\gamma\,\mathbf x^\top\mathbf z+r)^d`} />
            <p className="text-sm text-gray-600 dark:text-gray-400">Models interactions between features up to degree d (here d = 3, r = 1), giving curved boundaries.</p>
          </Card>
          <Card delay={0.1}>
            <h4 className="font-display text-lg font-semibold">RBF (Gaussian)</h4>
            <Formula tex={String.raw`K(\mathbf x,\mathbf z)=\exp(-\gamma\lVert\mathbf x-\mathbf z\rVert^2)`} />
            <p className="text-sm text-gray-600 dark:text-gray-400">A similarity that decays with distance; can fit very flexible boundaries. γ controls how local each support vector's influence is.</p>
          </Card>
        </div>
        <Card className="mt-5">
          <h4 className="font-display text-lg font-semibold">From two classes to 38, with confidence scores</h4>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            SVMs are binary. scikit-learn's <code>SVC</code> trains a <b>one-vs-one</b> classifier for every pair of classes:
            k(k−1)/2 = 38·37/2 = <b>703 binary SVMs</b>, and the class with the most votes wins. Confidence percentages come from
            <b> Platt scaling</b>, which fits a sigmoid <Tex>{String.raw`P(y=1\mid\mathbf x)=1/(1+e^{A f(\mathbf x)+B})`}</Tex> to the SVM scores with cross-validation.
            Features are standardised (zero mean, unit variance) first, because kernels depend on distances.
          </p>
        </Card>
      </section>

      {/* Why SVM */}
      <section>
        <SectionTitle eyebrow="Why an SVM?" title="Why this classifier and not another"
          sub="The SVM suits this problem: about 17k training images, 1,982 correlated features, and a need for a convex, reproducible, explainable model." />
        <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
          <Card>
            <h4 className="mb-3 font-display text-lg font-semibold">What the SVM brings</h4>
            <ul className="space-y-2.5 text-sm text-gray-700 dark:text-gray-300">
              {['Convex optimisation: the same data always gives the same, globally optimal model',
                'Maximum margin: strong generalisation with many features and moderate data',
                'Kernel trick: linear and non-linear boundaries from one algorithm, compared fairly',
                'Sparse: the decision depends only on the support vectors',
                'Mature theory (Vapnik, 1995) and a fast, well-tested solver (libsvm)'].map((t) => (
                <li key={t} className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-leaf-500" />{t}</li>
              ))}
            </ul>
          </Card>
          <Card delay={0.05}>
            <h4 className="mb-3 font-display text-lg font-semibold">Alternatives considered</h4>
            <div className="divide-y divide-leaf-900/10 dark:divide-white/10">
              {ALTERNATIVES.map(([m, why]) => (
                <div key={m} className="grid gap-1 py-2.5 sm:grid-cols-[180px_1fr] sm:gap-4">
                  <div className="text-sm font-semibold">{m}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">{why}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </section>

      <section>
        <SectionTitle eyebrow="Feature extraction" title="1,982 numbers per leaf" sub="Every image is resized to 256 × 256, then turned into one vector by concatenating colour, texture and shape descriptors." />
        <div className="grid gap-5 sm:grid-cols-2">
          {FEATURES.map(([Icon, t, dims, d], i) => (
            <Card key={t} delay={i * 0.05}>
              <div className="flex items-start justify-between gap-3">
                <h4 className="flex items-center gap-2 font-display text-lg font-semibold"><Icon className="h-5 w-5 text-leaf-600" />{t}</h4>
                <span className="chip bg-leaf-100 text-leaf-800 dark:bg-leaf-500/15 dark:text-leaf-300">{dims} dims</span>
              </div>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{d}</p>
            </Card>
          ))}
        </div>
        <Card className="mt-5">
          <h4 className="font-display text-lg font-semibold">Haralick texture, briefly</h4>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">With <Tex>{'p(i,j)'}</Tex> the normalised probability that grey level i sits next to grey level j (all 13 features are in the mathematics reference below):</p>
          <div className="grid gap-x-6 md:grid-cols-3">
            <Formula tex={String.raw`\sum_{i,j}(i-j)^2\,p(i,j)`} note="Contrast: local intensity variation (lesion edges)" />
            <Formula tex={String.raw`\sum_{i,j}p(i,j)^2`} note="Energy / ASM: uniformity of the texture" />
            <Formula tex={String.raw`-\sum_{i,j}p(i,j)\log_2 p(i,j)`} note="Entropy: randomness (spots, mould, mosaic)" />
          </div>
        </Card>
      </section>

      <MathReference />

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <h3 className="mb-2 flex items-center gap-2 font-display text-2xl font-bold"><Leaf className="h-6 w-6 text-leaf-600" /> The PlantVillage dataset</h3>
          <p className="text-gray-700 dark:text-gray-300">
            54,305 images of healthy and diseased leaves covering <b>14 crops</b> and <b>26 diseases</b> (38 classes), photographed on plain
            backgrounds under controlled conditions. Released openly by Mohanty, Hughes &amp; Salathé (2016), <i>Using Deep Learning for Image-Based Plant Disease Detection</i>, Frontiers in Plant Science.
          </p>
          <p className="mt-3 text-gray-700 dark:text-gray-300">
            Several photos were taken of each physical leaf, so a random split would put near-duplicates in both train and test. This project uses the
            <b> official leaf-grouped 80/20 split</b>, so test accuracy reflects leaves the model has never seen.
          </p>
          <p className="mt-3 rounded-2xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
            Limitation: lab-style photos. Accuracy drops on field photos with soil, hands or other leaves in the frame, and plants outside the 14 crops cannot be named.
          </p>
          <a href="https://github.com/spMohanty/PlantVillage-Dataset" target="_blank" rel="noreferrer" className="btn-ghost mt-4 !py-2 text-sm"><BarChart3 className="h-4 w-4" /> Dataset on GitHub</a>
        </Card>
        <Card delay={0.05}>
          <h3 className="mb-4 flex items-center gap-2 font-display text-2xl font-bold"><Sprout className="h-6 w-6 text-leaf-600" /> Why AI in agriculture</h3>
          <div className="space-y-4">
            {BENEFITS.map(([Icon, t, d]) => (
              <div key={t} className="flex gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-leaf-100 text-leaf-700 dark:bg-leaf-500/15 dark:text-leaf-300"><Icon className="h-5 w-5" /></span>
                <div><div className="font-semibold">{t}</div><div className="text-sm text-gray-600 dark:text-gray-400">{d}</div></div>
              </div>
            ))}
          </div>
        </Card>
      </section>
    </div>
  )
}
