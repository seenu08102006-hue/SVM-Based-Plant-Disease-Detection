import { Leaf } from 'lucide-react'

export default function Footer() {
  return (
    <footer className="border-t border-leaf-900/10 py-8 text-sm text-gray-500 dark:border-white/10 dark:text-gray-400">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 sm:flex-row sm:px-6 lg:px-8">
        <p className="flex items-center gap-2">
          <Leaf className="h-4 w-4 text-leaf-600" /> AI Plant Doctor · Support Vector Machine on hand-crafted features
        </p>
        <p>
          Data:{' '}
          <a className="font-medium text-leaf-700 hover:underline dark:text-leaf-400" href="https://github.com/spMohanty/PlantVillage-Dataset" target="_blank" rel="noreferrer">
            PlantVillage (Mohanty et al., 2016)
          </a>
        </p>
      </div>
    </footer>
  )
}
