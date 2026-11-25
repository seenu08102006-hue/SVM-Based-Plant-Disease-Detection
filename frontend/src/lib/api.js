// Dev: Vite proxies /api -> http://localhost:8000. Production: set VITE_API_URL to the backend origin.
export const API = import.meta.env.VITE_API_URL || '/api'

async function request(path, opts) {
  const res = await fetch(`${API}${path}`, opts)
  if (!res.ok) {
    let msg = `Request failed (${res.status})`
    try { const j = await res.json(); msg = j.detail || msg } catch { /* not JSON */ }
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg))
  }
  return res.status === 204 ? null : res.json()
}

export const api = {
  health: () => request('/health'),
  predict: (file, crop) => {
    const fd = new FormData()
    fd.append('file', file)
    if (crop) fd.append('crop', crop)
    return request('/predict', { method: 'POST', body: fd })
  },
  recheck: (id, crop) => {
    const fd = new FormData()
    fd.append('crop', crop || 'auto')
    return request(`/history/${id}/recheck`, { method: 'POST', body: fd })
  },
  history: (limit = 100) => request(`/history?limit=${limit}`),
  item: (id) => request(`/history/${id}`),
  remove: (id) => request(`/history/${id}`, { method: 'DELETE' }),
  classes: () => request('/classes'),
  metrics: () => request('/metrics'),
}

export const assetUrl = (p) => `${API}${p}`

export const CROP_EMOJI = {
  Apple: '🍎', Blueberry: '🫐', Cherry: '🍒', Corn: '🌽', Grape: '🍇', Orange: '🍊', Peach: '🍑',
  Pepper: '🫑', 'Pepper bell': '🫑', Potato: '🥔', Raspberry: '🌺', Soybean: '🫘', Squash: '🎃',
  Strawberry: '🍓', Tomato: '🍅',
}
export const emojiFor = (plant) => CROP_EMOJI[plant] || CROP_EMOJI[plant?.split(' ')[0]] || '🌿'
