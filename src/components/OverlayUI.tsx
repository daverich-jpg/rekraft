import { ArrowLeft, ArrowRight, Grid2x2, Orbit, X } from 'lucide-react'
import { CARDS, PHOTOS } from '../data/photos'
import { neighbour, useUI } from '../lib/rig'
import { focusCard, goHome, setMode, unfocus } from './SpatialCanvas'

const ease = 'transition-[opacity,transform,filter] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]'

function AuthButtons({ size = 'md' }: { size?: 'md' | 'sm' }) {
  const box = size === 'md' ? 'h-10 w-20 rounded-[14px] text-[16px]' : 'h-8 px-3 rounded-[11px] text-[14px]'
  return (
    <div className="flex items-center gap-2">
      <button className={`${box} bg-chip text-ink-muted leading-5 tracking-[0.01em] hover:bg-[#e2e6e2] active:scale-[0.97] transition`}>
        Sign in
      </button>
      <button className={`${box} bg-ink text-white leading-5 tracking-[0.01em] hover:bg-[#222] active:scale-[0.97] transition`}>
        Sign up
      </button>
    </div>
  )
}

export function OverlayUI() {
  const { focus, mode, explored } = useUI()
  const heroOn = !explored && focus < 0 && mode === 'plane'
  const card = focus >= 0 ? CARDS[focus] : null

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      {/* Landing — the Figma hero, reproduced 1:1 */}
      <section
        aria-hidden={!heroOn}
        className={`isolate absolute left-1/2 top-1/2 flex w-[325px] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-8 text-center ${ease} ${
          heroOn ? 'opacity-100' : 'pointer-events-none scale-[0.96] opacity-0 blur-[6px]'
        }`}
      >
        {/* Paper veil: invisible on desktop (nothing sits behind the hero in the
            Figma frame) but keeps the type legible where photos crowd in. */}
        <div aria-hidden className="absolute -inset-x-16 -inset-y-20 -z-10 bg-[radial-gradient(closest-side,#fff_55%,rgb(255_255_255/0))]" />
        <div className="flex w-full flex-col items-center gap-5">
          <h1 className="font-display w-full text-[76px] font-medium leading-[84px] tracking-[-0.02em] text-ink sm:text-[96px] sm:leading-[100px]">
            ReKraft
          </h1>
          <p className="w-full text-[16px] leading-5 tracking-[0.01em] text-ink-muted">A meaningful home for photography</p>
        </div>
        <div className={heroOn ? 'pointer-events-auto' : ''}>
          <AuthButtons />
        </div>
      </section>

      {/* Header — takes over once you leave the landing */}
      <header
        className={`absolute inset-x-0 top-0 flex h-16 items-center justify-between px-4 sm:px-6 ${ease} ${
          heroOn ? 'pointer-events-none -translate-y-3 opacity-0' : 'opacity-100'
        }`}
      >
        <button
          onClick={goHome}
          className="pointer-events-auto font-display text-[30px] font-medium leading-none tracking-[-0.02em]"
          aria-label="ReKraft — back to start"
        >
          ReKraft
        </button>
        <nav className="pointer-events-auto absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 rounded-[14px] bg-white/80 p-1 text-[14px] backdrop-blur-md md:flex">
          {['Explore', 'Collections', 'Photographers', 'Journal'].map((label, i) => (
            <a
              key={label}
              href="#"
              onClick={(e) => e.preventDefault()}
              aria-current={i === 0 ? 'page' : undefined}
              className={`rounded-[10px] px-3 py-1.5 transition ${i === 0 ? 'bg-chip text-ink' : 'text-ink-muted hover:text-ink'}`}
            >
              {label}
            </a>
          ))}
        </nav>
        <div className="pointer-events-auto">
          <AuthButtons size="sm" />
        </div>
      </header>

      {/* Mode switch + hint */}
      <div
        className={`absolute bottom-4 right-4 flex items-center sm:right-6 ${ease} ${
          card ? 'pointer-events-none translate-y-3 opacity-0' : 'opacity-100'
        }`}
      >
        <div
          role="radiogroup"
          aria-label="Layout"
          className="pointer-events-auto flex items-center gap-1 rounded-[14px] bg-white/85 p-1 shadow-[0_1px_0_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.25)] ring-1 ring-black/5 backdrop-blur-md"
        >
          {(
            [
              ['plane', 'Plane', Grid2x2],
              ['sphere', 'Sphere', Orbit],
            ] as const
          ).map(([value, label, Icon]) => (
            <button
              key={value}
              role="radio"
              aria-checked={mode === value}
              onClick={() => setMode(value)}
              className={`flex h-8 items-center gap-1.5 rounded-[10px] px-3 text-[13px] transition ${
                mode === value ? 'bg-ink text-white' : 'text-ink-muted hover:text-ink'
              }`}
            >
              <Icon size={15} strokeWidth={1.75} aria-hidden />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Caption — a wall label for the plate under inspection */}
      <div
        aria-live="polite"
        className={`absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-4 sm:p-6 ${ease} ${
          card ? 'opacity-100' : 'pointer-events-none translate-y-3 opacity-0'
        }`}
      >
        {card && (
          <>
            <div>
              <p className="font-display text-[34px] font-medium leading-none tracking-[-0.02em]">Plate {card.photo.plate}</p>
              <p className="mt-1.5 text-[13px] text-ink-muted">
                {card.photo.source === 'Unsplash' ? 'Via Unsplash' : 'From the ReKraft archive'} · {card.photo.plate} of {PHOTOS.length}
              </p>
            </div>
            <div className="pointer-events-auto flex items-center gap-1">
              <IconButton label="Previous photo" onClick={() => focusCard(neighbour(card.id, 'left'))}>
                <ArrowLeft size={16} strokeWidth={1.75} />
              </IconButton>
              <IconButton label="Next photo" onClick={() => focusCard(neighbour(card.id, 'right'))}>
                <ArrowRight size={16} strokeWidth={1.75} />
              </IconButton>
              <IconButton label="Close (Esc)" onClick={unfocus} dark>
                <X size={16} strokeWidth={1.75} />
              </IconButton>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function IconButton({
  label,
  onClick,
  dark,
  children,
}: {
  label: string
  onClick: () => void
  dark?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`grid size-10 place-items-center rounded-[14px] transition active:scale-[0.95] ${
        dark ? 'bg-ink text-white hover:bg-[#222]' : 'bg-chip text-ink hover:bg-[#e2e6e2]'
      }`}
    >
      {children}
    </button>
  )
}
