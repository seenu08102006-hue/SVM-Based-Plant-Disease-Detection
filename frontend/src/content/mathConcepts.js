// Every mathematical concept used by the project: formula(s), where it is used in the code, and why it was chosen.
// Formulas are TeX (rendered with KaTeX). Numbers quoted are measured on the 10,709-image leaf-grouped test set.
const T = String.raw

export const STAGES = [
  {
    id: 'image',
    title: 'Image preparation',
    icon: 'Image',
    summary: 'Turn any uploaded photo into a fixed-size, comparable input.',
    concepts: [
      {
        name: 'Area-interpolation resizing',
        tex: [T`I'(u,v)=\frac{1}{|A_{uv}|}\sum_{(x,y)\in A_{uv}} I(x,y)`],
        notes: ['Each output pixel is the average of the block of input pixels A it covers.'],
        where: 'backend/app/features.py → extract_features() resizes every image to 256 × 256 (cv2.INTER_AREA).',
        why: 'The SVM needs a vector of the same length for every image, so every image must be the same size. Area averaging is the correct way to shrink an image: it low-pass filters while resizing, so fine lesion texture does not alias into false patterns (nearest-neighbour or bilinear shrinking can).',
      },
      {
        name: 'Greyscale (luminance) conversion',
        tex: [T`Y = 0.299\,R + 0.587\,G + 0.114\,B`],
        where: 'features.py: the input to GLCM texture and HOG shape features.',
        why: 'Texture and shape are about intensity changes, not colour. One channel is 3× cheaper than three, and the ITU-R BT.601 weights follow the eye’s sensitivity (most to green), which suits leaf images.',
      },
      {
        name: 'RGB → HSV colour space',
        tex: [
          T`V=\max(R,G,B),\qquad \Delta = V-\min(R,G,B),\qquad S=\frac{\Delta}{V}`,
          T`H=60^\circ\times\begin{cases}\dfrac{G-B}{\Delta}\bmod 6 & V=R\\[4pt]\dfrac{B-R}{\Delta}+2 & V=G\\[4pt]\dfrac{R-G}{\Delta}+4 & V=B\end{cases}`,
        ],
        notes: ['OpenCV stores H/2, so hue runs 0–179.'],
        where: 'features.py → color_features(): the HSV histograms.',
        why: 'In RGB, a shadow changes all three channels. HSV separates what colour it is (hue) from how bright it is (value), so yellowing (chlorosis) and browning (necrosis) are visible as a hue shift even under different lighting.',
      },
    ],
  },
  {
    id: 'features',
    title: 'Feature extraction',
    icon: 'Microscope',
    summary: '1,982 hand-crafted numbers per leaf: colour, texture and shape.',
    concepts: [
      {
        name: 'Normalised histograms (colour features)',
        tex: [T`h_k=\frac{n_k}{N},\qquad \sum_{k=1}^{32} h_k = 1`],
        notes: ['n_k = number of pixels whose value falls in bin k, N = total pixels. 6 channels × 32 bins = 192 dimensions.'],
        where: 'features.py → color_features(): R, G, B, H, S, V histograms.',
        why: 'A histogram describes how much of each colour is present no matter where it is in the image (translation-invariant), and normalising makes it independent of image size. 32 bins is a balance: 256 bins would be noisy and sparse, 8 bins would merge healthy green with yellowing green.',
      },
      {
        name: 'Grey-Level Co-occurrence Matrix (GLCM)',
        tex: [
          T`P_{d,\theta}(i,j)=\#\{(p,q): I(p)=i,\; I(q)=j,\; q=p+d\,(\cos\theta,\sin\theta)\}`,
          T`p(i,j)=\frac{P(i,j)+P(j,i)}{\sum_{i,j}\big(P(i,j)+P(j,i)\big)}`,
        ],
        notes: ['d = 1 pixel, θ ∈ {0°, 45°, 90°, 135°}, grey levels quantised to N_g = 32.'],
        where: 'features.py → texture_features() via skimage graycomatrix (symmetric, normalised).',
        why: 'Two leaves can have exactly the same colour histogram, one with fine spots and one with a single big blotch. A histogram cannot tell them apart; the GLCM can, because it records which grey levels sit next to each other. Quantising to 32 levels keeps the matrix 32×32 and well populated (256×256 would be almost all zeros).',
      },
      {
        name: 'Haralick texture features (all 13)',
        table: [
          ['f₁ Angular second moment (energy)', T`\sum_{i,j} p(i,j)^2`],
          ['f₂ Contrast', T`\sum_{i,j}(i-j)^2\,p(i,j)`],
          ['f₃ Correlation', T`\dfrac{\sum_{i,j} i\,j\,p(i,j)-\mu_x\mu_y}{\sigma_x\sigma_y}`],
          ['f₄ Variance', T`\sum_{i,j}(i-\mu_x)^2\,p(i,j)`],
          ['f₅ Inverse difference moment', T`\sum_{i,j}\dfrac{p(i,j)}{1+(i-j)^2}`],
          ['f₆ Sum average', T`\sum_{k=0}^{2N_g-2} k\,p_{x+y}(k)`],
          ['f₇ Sum variance', T`\sum_{k}(k-f_6)^2\,p_{x+y}(k)`],
          ['f₈ Sum entropy', T`-\sum_{k} p_{x+y}(k)\log_2 p_{x+y}(k)`],
          ['f₉ Entropy', T`-\sum_{i,j} p(i,j)\log_2 p(i,j)`],
          ['f₁₀ Difference variance', T`\sum_{k}(k-\mu_{x-y})^2\,p_{x-y}(k)`],
          ['f₁₁ Difference entropy', T`-\sum_{k} p_{x-y}(k)\log_2 p_{x-y}(k)`],
          ['f₁₂ Info. measure of correlation 1', T`\dfrac{f_9-HXY1}{\max(HX,HY)}`],
          ['f₁₃ Info. measure of correlation 2', T`\sqrt{1-e^{-2(HXY2-f_9)}}`],
        ],
        tex: [T`p_{x+y}(k)=\!\!\sum_{i+j=k}\!\! p(i,j),\quad p_{x-y}(k)=\!\!\sum_{|i-j|=k}\!\! p(i,j),\quad HXY1=-\sum_{i,j}p(i,j)\log_2\!\big(p_x(i)p_y(j)\big)`],
        notes: ['Each feature is computed for all 4 angles; the mean and the range (max − min) over angles are kept: 13 × 2 = 26 dimensions. f₇ uses f₆ (the corrected form of Haralick’s 1973 definition).'],
        where: 'features.py → _haralick_from_glcm(), implemented with NumPy.',
        why: 'Haralick statistics compress a 32×32 matrix (1,024 numbers) into 13 interpretable ones: contrast picks up lesion edges, entropy picks up irregular spotting and mosaic, energy is high on smooth healthy tissue. Averaging over the four angles makes them tolerant to leaf rotation; the range keeps directional information such as parallel veins and streaks (corn blight).',
      },
      {
        name: 'Histogram of Oriented Gradients (HOG): shape features',
        tex: [
          T`G_x = I(x{+}1,y)-I(x{-}1,y),\qquad G_y = I(x,y{+}1)-I(x,y{-}1)`,
          T`m=\sqrt{G_x^2+G_y^2},\qquad \theta=\arctan\!\frac{G_y}{G_x}\ \ (\bmod 180^\circ)`,
          T`\text{L2-Hys:}\quad v\leftarrow\frac{v}{\sqrt{\lVert v\rVert_2^2+\varepsilon^2}},\ \ v_i\leftarrow\min(v_i,0.2),\ \ \text{renormalise}`,
        ],
        notes: ['9 orientation bins (20° each), votes weighted by m, 32×32-pixel cells, 2×2-cell blocks: 7 × 7 blocks × 4 cells × 9 bins = 1,764 dimensions.'],
        where: 'features.py → shape_features() via skimage.feature.hog.',
        why: 'HOG describes the leaf outline, serrated edges, vein pattern and lesion borders. Block normalisation makes it robust to lighting and contrast changes. It is the classic hand-crafted shape descriptor (Dalal & Triggs, 2005) and works well with linear SVMs.',
      },
      {
        name: 'Feature concatenation',
        tex: [T`\mathbf{x}=\big[\,\underbrace{h_{RGB}}_{96}\;\big|\;\underbrace{h_{HSV}}_{96}\;\big|\;\underbrace{f_{\text{Haralick}}}_{26}\;\big|\;\underbrace{h_{HOG}}_{1764}\,\big]\in\mathbb{R}^{1982}`],
        where: 'features.py → extract_features(). The same function is used in training and in the API, so the features always match.',
        why: 'Colour, texture and shape fail in different ways (for example, two diseases with the same colour but different spotting), so combining them gives the classifier complementary evidence.',
      },
    ],
  },
  {
    id: 'prep',
    title: 'Data preparation',
    icon: 'SlidersHorizontal',
    summary: 'Put every feature on the same scale and balance the classes.',
    concepts: [
      {
        name: 'Standardisation (z-score)',
        tex: [T`z_j=\frac{x_j-\mu_j}{\sigma_j},\qquad \mu_j=\frac1n\sum_i x_{ij},\quad \sigma_j=\sqrt{\tfrac1n\textstyle\sum_i (x_{ij}-\mu_j)^2}`],
        where: 'training/train_svm.py (StandardScaler fitted on training data only), saved as scaler.pkl and applied to every upload.',
        why: 'SVM kernels are built from dot products and distances. Unscaled, a Haralick sum-variance in the hundreds would drown out HOG values around 0.1. Fitting μ and σ on training data only keeps test information out of the model.',
      },
      {
        name: 'Per-class sampling cap',
        tex: [T`n'_c=\min(n_c,\;500)`],
        notes: ['Classes range from 152 (healthy potato) to 5,507 (orange HLB) images.'],
        where: 'train_svm.py → cap_per_class(); 17,228 of 43,596 training images used.',
        why: 'Without a cap the SVM would be biased towards the largest classes. Kernel SVM training also costs between O(n²) and O(n³), so a balanced 17k sample trains in minutes instead of hours with little loss in accuracy.',
      },
      {
        name: 'Leaf-grouped train/test split',
        tex: [T`\text{leaf}(a)=\text{leaf}(b)\;\Rightarrow\;\text{split}(a)=\text{split}(b)`],
        where: 'Official PlantVillage split files in dataset/splits/, 80% / 20%.',
        why: 'PlantVillage has several photos of the same physical leaf. A random split would put near-duplicates in both train and test and inflate accuracy. Grouping by leaf measures performance on leaves the model has never seen.',
      },
    ],
  },
  {
    id: 'svm',
    title: 'Support Vector Machine',
    icon: 'ScanLine',
    summary: 'The classifier: a maximum-margin boundary in 1,982-dimensional space.',
    concepts: [
      {
        name: 'Soft-margin SVM (primal) and hinge loss',
        tex: [
          T`\min_{\mathbf w,b,\boldsymbol\xi}\ \tfrac12\lVert\mathbf w\rVert^2 + C\sum_{i=1}^{n}\xi_i\quad\text{s.t.}\quad y_i(\mathbf w^\top\mathbf x_i+b)\ge 1-\xi_i,\ \ \xi_i\ge 0`,
          T`\Longleftrightarrow\quad \min_{\mathbf w,b}\ \tfrac12\lVert\mathbf w\rVert^2 + C\sum_i \max\!\big(0,\;1-y_i(\mathbf w^\top\mathbf x_i+b)\big)`,
        ],
        notes: ['The margin width is 2/‖w‖, so minimising ‖w‖ maximises the margin. C trades margin width against training errors.'],
        where: 'train_svm.py via scikit-learn SVC (libsvm, SMO solver).',
        why: 'The problem is convex, so the solver always finds the global optimum (no random restarts as in neural networks). Maximising the margin is a strong guard against over-fitting, which matters with 1,982 features and about 17k samples.',
      },
      {
        name: 'Dual problem and the kernel trick',
        tex: [
          T`\max_{\boldsymbol\alpha}\ \sum_i\alpha_i-\tfrac12\sum_{i,j}\alpha_i\alpha_j y_i y_j K(\mathbf x_i,\mathbf x_j)\quad\text{s.t.}\ \ 0\le\alpha_i\le C,\ \ \sum_i\alpha_i y_i=0`,
          T`f(\mathbf x)=\operatorname{sign}\Big(\sum_{i\in SV}\alpha_i y_i K(\mathbf x_i,\mathbf x)+b\Big)`,
        ],
        notes: ['Only support vectors have αᵢ > 0. The deployed model keeps about 13k of them.'],
        where: 'Inside SVC; the support vectors are stored in model.pkl.',
        why: 'Data appears only through K(xᵢ, xⱼ), so a non-linear boundary can be learned by swapping the kernel, without ever computing the high-dimensional mapping φ(x).',
      },
      {
        name: 'The three kernels compared',
        table: [
          ['Linear', T`K(\mathbf x,\mathbf z)=\mathbf x^\top\mathbf z`],
          ['Polynomial (d = 3, r = 1)', T`K(\mathbf x,\mathbf z)=(\gamma\,\mathbf x^\top\mathbf z+r)^d`],
          ['RBF (Gaussian)', T`K(\mathbf x,\mathbf z)=\exp\!\big(-\gamma\lVert\mathbf x-\mathbf z\rVert^2\big)`],
          ['γ = "scale"', T`\gamma=\dfrac{1}{d\cdot\operatorname{Var}(X)}`],
          ['γ = "auto"', T`\gamma=\dfrac{1}{d}`],
        ],
        notes: ['Test accuracy: linear 86.5%, polynomial 88.8%, RBF 88.2%. The kernel is selected by cross-validation score, not test score.'],
        where: 'train_svm.py → GridSearchCV per kernel; compared on the Model page.',
        why: 'Comparing kernels shows whether the classes are separable by a flat hyperplane (linear) or need curved boundaries (polynomial, RBF). In 1,982 dimensions the linear kernel is already strong, which is why all three score within about 2 points of each other.',
      },
      {
        name: 'One-vs-one multi-class voting',
        tex: [T`\#\text{classifiers}=\binom{k}{2}=\frac{k(k-1)}{2}=\frac{38\cdot37}{2}=703,\qquad \hat y=\arg\max_c \sum_{a<b}\mathbb 1[\text{SVM}_{ab}(\mathbf x)=c]`],
        where: 'SVC trains the 703 pairwise SVMs automatically.',
        why: 'An SVM separates two classes. One-vs-one trains each pair on only their own images, so each sub-problem is small and balanced, and its total cost is lower than one-vs-rest for kernel SVMs.',
      },
    ],
  },
  {
    id: 'select',
    title: 'Model selection & evaluation',
    icon: 'BarChart3',
    summary: 'Choose hyper-parameters honestly and measure performance fairly.',
    concepts: [
      {
        name: 'Stratified k-fold cross-validation',
        tex: [T`\text{CV}(\theta)=\frac1k\sum_{i=1}^{k}\operatorname{Acc}\big(h_\theta^{(-i)},\,D_i\big),\qquad k=3`],
        notes: ['h_θ^(−i) is trained on every fold except D_i and scored on D_i. Stratified: each fold keeps the class proportions.'],
        where: 'train_svm.py → GridSearchCV(cv=StratifiedKFold(3)) on a stratified 2,964-image subset.',
        why: 'Hyper-parameters must be chosen without looking at the test set, otherwise the reported accuracy would be optimistic. k = 3 on a subset keeps the 36 configurations × 3 folds fast. The trade-off: the noisier estimate picked linear while polynomial was slightly better on the test set.',
      },
      {
        name: 'Grid search',
        tex: [T`\theta^*=\arg\max_{\theta\in\mathcal G}\ \text{CV}(\theta),\qquad \mathcal G = \{0.1,1,10,100\}_C\times\{\text{scale},\text{auto},0.001,0.01\}_\gamma`],
        where: 'train_svm.py; the CV accuracy of every grid cell is shown as a heat-map on the Model page.',
        why: 'With only two hyper-parameters, an exhaustive grid is cheap, reproducible and easy to visualise, unlike random or Bayesian search. Values on a log scale (0.1 to 100) cover several orders of magnitude.',
      },
      {
        name: 'Accuracy, precision, recall, F1',
        tex: [
          T`\text{Accuracy}=\frac{\#\text{correct}}{N},\qquad P_c=\frac{TP_c}{TP_c+FP_c},\qquad R_c=\frac{TP_c}{TP_c+FN_c}`,
          T`F_{1,c}=\frac{2P_cR_c}{P_c+R_c},\qquad \text{macro-}F_1=\frac1{38}\sum_{c=1}^{38}F_{1,c}`,
        ],
        where: 'train_svm.py → metrics(); shown as the KPI tiles, kernel table and per-class table on the Model page.',
        why: 'Accuracy alone is dominated by big classes (orange HLB has 36× more images than healthy potato). Macro averaging gives every disease equal weight. Precision answers "when it says blight, is it blight?"; recall answers "how many blighted leaves does it catch?".',
      },
      {
        name: 'Confusion matrix',
        tex: [T`C_{ij}=\#\{\text{images with true class } i \text{ predicted as } j\},\qquad \tilde C_{ij}=\frac{C_{ij}}{\sum_j C_{ij}}`],
        notes: ['Row-normalised: the diagonal is each class’s recall.'],
        where: 'Model page heat-map (38 × 38), for the deployed model and for each kernel.',
        why: 'It shows which diseases get confused with which (for example, corn gray leaf spot vs. northern leaf blight). A single score cannot show that.',
      },
    ],
  },
  {
    id: 'confidence',
    title: 'Confidence & safeguards',
    icon: 'ShieldCheck',
    summary: 'Turn SVM scores into probabilities and avoid confident wrong names.',
    concepts: [
      {
        name: 'Platt scaling (probability calibration)',
        tex: [
          T`P(y=1\mid f)=\frac{1}{1+\exp(A\,f(\mathbf x)+B)}`,
          T`(A,B)=\arg\min -\sum_i\big[t_i\log p_i+(1-t_i)\log(1-p_i)\big],\qquad p_c=\frac{s_c}{\sum_{j} s_j}`,
        ],
        notes: ['A and B are fitted by maximum likelihood on held-out decision values (CalibratedClassifierCV, 3 folds); the 38 per-class sigmoids s_c are normalised to sum to 1.'],
        where: 'train_svm.py (final model) and model_service.py → predict_proba. This is the confidence ring on the result page.',
        why: 'An SVM outputs a signed distance to the boundary, not a probability: "+2.3" means nothing to a farmer. Platt scaling is the standard, cheap calibration for SVMs and turns scores into percentages that can be thresholded.',
      },
      {
        name: 'Decision rule and confidence threshold',
        tex: [T`\hat y=\arg\max_c\,p_c,\qquad \text{verdict}=\begin{cases}\text{confident} & \max_c p_c\ge 0.7\\ \text{not sure} & \text{otherwise}\end{cases}`],
        notes: ['Test set: predictions ≥ 70% are 96.8% correct (71% of images); below 70% only 64% are correct.'],
        where: 'backend/app/model_service.py (CONFIDENT in config.py); the "Not sure" badge on results.',
        why: 'The threshold was chosen from measured accuracy at each confidence level, not by guessing. It marks the point where answers stop being reliable enough to act on.',
      },
      {
        name: 'Crop selection = conditional probability',
        tex: [T`P(c\mid\mathbf x,\ \text{crop})=\frac{P(c\mid\mathbf x)\,\mathbb 1[c\in\text{crop}]}{\sum_{c'\in\text{crop}}P(c'\mid\mathbf x)}`],
        notes: ['Test accuracy goes from 87.5% (auto) to 93.7% when the crop is known.'],
        where: 'model_service.py → predict(crop=…); the "Which plant is this?" picker and the re-check on the result page.',
        why: 'The user usually knows which plant they photographed. Conditioning on that knowledge (Bayes’ rule) removes every impossible class, so the plant name cannot be wrong and the disease is chosen among the right candidates.',
      },
      {
        name: 'Principal Component Analysis (PCA)',
        tex: [T`\Sigma=\frac1n\sum_i(\mathbf z_i-\bar{\mathbf z})(\mathbf z_i-\bar{\mathbf z})^\top,\qquad \Sigma\mathbf v_k=\lambda_k\mathbf v_k,\qquad \mathbf u=V_{32}^\top(\mathbf z-\bar{\mathbf z})`],
        notes: ['Keep the 32 eigenvectors with the largest eigenvalues (the directions of greatest variance).'],
        where: 'training/build_ood.py, saved in ood.pkl and used by the "not recognised" check.',
        why: 'In 1,982 dimensions all distances look alike (the curse of dimensionality) and nearest-neighbour search is slow. Projecting onto 32 principal components keeps the main variation and makes distances meaningful and fast.',
      },
      {
        name: 'k-nearest-neighbour novelty score',
        tex: [T`d(\mathbf u)=\frac1k\sum_{j=1}^{k}\lVert\mathbf u-\mathbf u_{(j)}\rVert_2,\qquad r=\frac{d(\mathbf u)}{\tau_{\hat y}},\qquad \text{not recognised}\iff r>1`],
        notes: ['k = 10 nearest training images of the predicted class ŷ; τ_c = 99th percentile of d on held-out images of class c.'],
        where: 'model_service.py → _novelty_ratio(); the "Not recognised" result.',
        why: 'An SVM must always pick a class. This check asks a different question: "is this image close to anything we trained on?" It is non-parametric (no Gaussian assumption), and the 99th-percentile threshold accepts 99% of genuine leaves by construction.',
      },
    ],
  },
]
