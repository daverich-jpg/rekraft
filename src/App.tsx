import { OverlayUI } from './components/OverlayUI'
import { SpatialCanvas } from './components/SpatialCanvas'

export default function App() {
  return (
    <main className="relative h-full w-full overflow-hidden bg-paper">
      <SpatialCanvas />
      <OverlayUI />
    </main>
  )
}
