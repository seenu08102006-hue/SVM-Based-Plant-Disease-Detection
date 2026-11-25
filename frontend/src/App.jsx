import { AnimatePresence, motion } from 'framer-motion'
import { Route, Routes, useLocation } from 'react-router-dom'
import Navbar from './components/Navbar.jsx'
import Footer from './components/Footer.jsx'
import Home from './pages/Home.jsx'
import Detect from './pages/Detect.jsx'
import Result from './pages/Result.jsx'
import History from './pages/History.jsx'
import { lazy, Suspense } from 'react'
import { Spinner } from './components/ui.jsx'

// Heavy pages are split out of the main bundle (recharts / KaTeX).
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'))
const About = lazy(() => import('./pages/About.jsx'))
const fallback = <div className="glass p-10"><Spinner label="Loading…" /></div>

function Page({ children }) {
  return (
    <motion.main
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="mx-auto w-full max-w-7xl flex-1 px-4 pb-16 pt-6 sm:px-6 lg:px-8"
    >
      {children}
    </motion.main>
  )
}

export default function App() {
  const location = useLocation()
  return (
    <div className="bg-blobs flex min-h-screen flex-col">
      <Navbar />
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<Page><Home /></Page>} />
          <Route path="/detect" element={<Page><Detect /></Page>} />
          <Route path="/result/:id" element={<Page><Result /></Page>} />
          <Route path="/history" element={<Page><History /></Page>} />
          <Route path="/dashboard" element={<Page><Suspense fallback={fallback}><Dashboard /></Suspense></Page>} />
          <Route path="/about" element={<Page><Suspense fallback={fallback}><About /></Suspense></Page>} />
          <Route path="*" element={<Page><div className="glass p-10 text-center">Page not found.</div></Page>} />
        </Routes>
      </AnimatePresence>
      <Footer />
    </div>
  )
}
