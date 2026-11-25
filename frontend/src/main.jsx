import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { MotionGlobalConfig } from 'framer-motion'

// Respect the OS "reduce motion" setting: render everything in its final state, no fades or slides.
if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) MotionGlobalConfig.skipAnimations = true
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
