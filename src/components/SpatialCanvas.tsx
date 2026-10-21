import { useEffect, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { damp, damp2, damp3, dampQ } from 'maath/easing'
import { Euler, MathUtils, PerspectiveCamera, Quaternion, Vector3 } from 'three'
import { CARDS } from '../data/photos'
import {
  CLICK_SLOP,
  PLANE_FOV,
  SPHERE_FOV,
  cardTransform,
  centerOn,
  fitViewport,
  getUI,
  neighbour,
  rig,
  setUI,
  useUI,
} from '../lib/rig'
import { setMaxAnisotropy } from '../lib/textures'
import { ImageCard } from './ImageCard'

const params = new URLSearchParams(location.search)
const MANUAL_CLOCK = params.get('clock') === 'manual'

// --- Actions shared by pointer, keyboard and the DOM overlay ---------------

export function focusCard(id: number) {
  if (id < 0) return
  centerOn(CARDS[id])
  setUI({ focus: id, explored: true })
}

export function unfocus() {
  setUI({ focus: -1 })
}

export function goHome() {
  rig.panTarget.set(0, 0)
  rig.zoomTarget = 0
  setUI({ focus: -1, mode: 'plane', explored: false })
}

export function setMode(mode: 'plane' | 'sphere') {
  setUI({ mode, focus: -1, explored: getUI().explored || mode === 'sphere' })
}

const markExplored = () => {
  if (rig.panTarget.length() > 0.6 || Math.abs(rig.zoomTarget) > 0.3) setUI({ explored: true })
}

// --- Camera rig ------------------------------------------------------------

const _p = new Vector3()
const _q = new Quaternion()
const _n = new Vector3()
const _camPos = new Vector3()
const _camQ = new Quaternion()
const _e = new Euler()

function Rig() {
  const { camera, size, gl } = useThree()
  const cam = camera as PerspectiveCamera

  useEffect(() => {
    fitViewport(size.width, size.height)
  }, [size])

  useEffect(() => {
    setMaxAnisotropy(gl.capabilities.getMaxAnisotropy())
  }, [gl])

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1)
    const { mode, focus } = getUI()
    const rm = rig.reducedMotion
    const sphere = mode === 'sphere' ? 1 : 0

    damp(rig, 'blend', sphere, rm ? 0.15 : 0.7, dt)
    damp2(rig.pan, rig.panTarget, rm ? 0.08 : 0.26, dt)
    if (rm) rig.panSlow.copy(rig.pan)
    else damp2(rig.panSlow, rig.pan, 0.55, dt)
    damp(rig, 'zoom', rig.zoomTarget, 0.3, dt)

    const t = rig.blend
    const fov = MathUtils.lerp(PLANE_FOV, SPHERE_FOV, t)
    const tanH = Math.tan(MathUtils.degToRad(fov / 2))

    if (focus >= 0) {
      // Fill ~72% of the height (or ~64% of the width) with the print,
      // leaving the lower band for its caption.
      const card = CARDS[focus]
      const k = cardTransform(card, _p, _q)
      const w = card.w * k
      const h = card.h * k
      const dist = Math.max(h / (2 * tanH * 0.72), w / (2 * tanH * cam.aspect * 0.64))
      _n.set(0, 0, 1).applyQuaternion(_q)
      _camPos.copy(_p).addScaledVector(_n, dist)
      _camPos.y -= h * 0.06 // optical centre sits a touch high, above the caption
      _camQ.copy(_q)
    } else {
      const look = rm || !rig.pointerActive ? 0 : 1
      const planeZ = rig.d + rig.zoom
      const sphereZ = rig.zoom * 0.35
      _camPos.set(
        rig.pointer.x * 0.35 * look * (1 - t),
        rig.pointer.y * 0.22 * look * (1 - t),
        MathUtils.lerp(planeZ, sphereZ, t),
      )
      _e.set(rig.pointer.y * 0.07 * look * t, -rig.pointer.x * 0.12 * look * t, 0, 'YXZ')
      _camQ.setFromEuler(_e)
    }

    const smooth = rm ? 0.1 : focus >= 0 ? 0.42 : 0.35
    damp3(cam.position, _camPos, smooth, dt)
    dampQ(cam.quaternion, _camQ, smooth, dt)
    if (Math.abs(cam.fov - fov) > 1e-3) {
      damp(cam, 'fov', fov, 0.5, dt)
      cam.updateProjectionMatrix()
    }
  })

  return null
}

/** `?clock=manual` exposes a deterministic stepper for tests and capture. */
function DebugClock() {
  const { advance, gl, scene, camera } = useThree()
  useEffect(() => {
    let t = performance.now()
    const w = window as unknown as Record<string, unknown>
    w.__rk = {
      rig,
      gl,
      scene,
      camera,
      step(n = 1, ms = 1000 / 60) {
        const t0 = performance.now()
        for (let i = 0; i < n; i++) advance((t += ms))
        gl.getContext().finish()
        return (performance.now() - t0) / n
      },
    }
  }, [advance, gl, scene, camera])
  return null
}

function Field() {
  const { focus } = useUI()
  const select = (id: number) => (getUI().focus === id ? unfocus() : focusCard(id))
  return (
    <>
      {CARDS.map((card) => (
        <ImageCard key={card.id} card={card} focused={focus === card.id} dimmed={focus >= 0 && focus !== card.id} onSelect={select} />
      ))}
    </>
  )
}

// --- Canvas + input --------------------------------------------------------

export function SpatialCanvas() {
  const wrap = useRef<HTMLDivElement>(null!)

  useEffect(() => {
    const mq = matchMedia('(prefers-reduced-motion: reduce)')
    const apply = () => (rig.reducedMotion = mq.matches && params.get('motion') !== 'full')
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  useEffect(() => {
    const el = wrap.current
    let dragging = false
    let lx = 0
    let ly = 0
    let lt = 0
    const vel = { x: 0, y: 0 }
    const unit = () => 100 * rig.scale

    const down = (e: PointerEvent) => {
      if (e.button !== 0) return
      dragging = true
      rig.dragDist = 0
      lx = e.clientX
      ly = e.clientY
      lt = performance.now()
      vel.x = vel.y = 0
    }
    const move = (e: PointerEvent) => {
      rig.pointer.set((e.clientX / innerWidth) * 2 - 1, -((e.clientY / innerHeight) * 2 - 1))
      rig.pointerActive = e.pointerType === 'mouse'
      if (!dragging) return
      const dx = e.clientX - lx
      const dy = e.clientY - ly
      const now = performance.now()
      const ms = Math.max(1, now - lt)
      lx = e.clientX
      ly = e.clientY
      lt = now
      rig.dragDist += Math.hypot(dx, dy)
      if (rig.dragDist <= CLICK_SLOP) return
      if (getUI().focus >= 0) unfocus()
      document.body.style.cursor = 'grabbing'
      const ux = -dx / unit()
      const uy = dy / unit()
      rig.panTarget.x += ux
      rig.panTarget.y += uy
      // Velocity over a >=16 ms window; synthetic or coalesced events can
      // arrive 1 ms apart and would otherwise read as a violent fling.
      const w = Math.min(1, ms / 16)
      vel.x = MathUtils.lerp(vel.x, (ux / Math.max(ms, 16)) * 1000, w)
      vel.y = MathUtils.lerp(vel.y, (uy / Math.max(ms, 16)) * 1000, w)
    }
    const up = () => {
      if (!dragging) return
      dragging = false
      if (rig.dragDist > CLICK_SLOP) {
        document.body.style.cursor = ''
        // Release with momentum unless the pointer had already stopped.
        if (!rig.reducedMotion && performance.now() - lt < 80) {
          const speed = Math.hypot(vel.x, vel.y)
          const k = speed > 30 ? 30 / speed : 1 // cap the throw at ~30 units/s
          rig.panTarget.x += vel.x * k * 0.22
          rig.panTarget.y += vel.y * k * 0.22
        }
        markExplored()
      }
    }
    const wheel = (e: WheelEvent) => {
      e.preventDefault()
      if (getUI().focus >= 0) unfocus()
      const scaleDelta = e.deltaMode === 1 ? 16 : 1
      if (e.ctrlKey || e.metaKey) {
        // Trackpad pinch (and ⌘/ctrl + wheel) dollies along Z.
        rig.zoomTarget = MathUtils.clamp(rig.zoomTarget + e.deltaY * scaleDelta * 0.025, -0.45 * rig.d, 0.5 * rig.d)
      } else {
        rig.panTarget.x += (e.deltaX * scaleDelta) / unit()
        rig.panTarget.y -= (e.deltaY * scaleDelta) / unit()
      }
      markExplored()
    }
    const key = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea')) return
      const { focus, mode } = getUI()
      const dirs: Record<string, 'left' | 'right' | 'up' | 'down'> = {
        ArrowLeft: 'left',
        ArrowRight: 'right',
        ArrowUp: 'up',
        ArrowDown: 'down',
      }
      const dir = dirs[e.key]
      if (dir) {
        e.preventDefault()
        if (focus >= 0) focusCard(neighbour(focus, dir))
        else {
          const step = 2.4
          if (dir === 'left') rig.panTarget.x -= step
          if (dir === 'right') rig.panTarget.x += step
          if (dir === 'up') rig.panTarget.y += step
          if (dir === 'down') rig.panTarget.y -= step
          markExplored()
        }
      } else if (e.key === 'Escape') {
        if (focus >= 0) unfocus()
        else goHome()
      } else if (e.key === 's' || e.key === 'S') {
        setMode(mode === 'sphere' ? 'plane' : 'sphere')
      } else if (e.key === 'Enter' && focus < 0 && !(e.target instanceof HTMLButtonElement)) {
        // Inspect whichever plate sits nearest the centre of view.
        let best = 0
        let bd = Infinity
        for (const c of CARDS) {
          cardTransform(c, _p, _q)
          const dd = _p.x * _p.x + _p.y * _p.y + (mode === 'sphere' ? 0 : c.z * c.z * 0.05)
          if (dd < bd && (mode === 'plane' || _p.z < 0)) {
            bd = dd
            best = c.id
          }
        }
        focusCard(best)
      }
    }

    el.addEventListener('pointerdown', down)
    addEventListener('pointermove', move)
    addEventListener('pointerup', up)
    addEventListener('pointercancel', up)
    el.addEventListener('wheel', wheel, { passive: false })
    addEventListener('keydown', key)
    return () => {
      el.removeEventListener('pointerdown', down)
      removeEventListener('pointermove', move)
      removeEventListener('pointerup', up)
      removeEventListener('pointercancel', up)
      el.removeEventListener('wheel', wheel)
      removeEventListener('keydown', key)
    }
  }, [])

  return (
    <div
      ref={wrap}
      className="absolute inset-0 touch-none select-none"
      role="application"
      aria-label="Photography field. Drag or use arrow keys to explore, Enter to inspect a photo, S to switch between plane and sphere, Escape to go back."
    >
      <Canvas
        flat
        dpr={[1, 2]}
        frameloop={MANUAL_CLOCK ? 'never' : 'always'}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        camera={{ fov: PLANE_FOV, near: 0.1, far: 200, position: [0, 0, 11.43] }}
        onCreated={({ gl }) => gl.setClearColor('#ffffff')}
        onPointerMissed={() => {
          if (rig.dragDist <= CLICK_SLOP && getUI().focus >= 0) unfocus()
        }}
      >
        <Rig />
        <Field />
        {MANUAL_CLOCK && <DebugClock />}
      </Canvas>
    </div>
  )
}
