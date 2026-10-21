import { useSyncExternalStore } from 'react'
import { Euler, Quaternion, Vector2, Vector3 } from 'three'
import { CARDS, FRAME, PERIOD, type Card } from '../data/photos'

// ---------------------------------------------------------------------------
// Per-frame state lives in a mutable object (read inside useFrame, never
// re-renders). UI state that the DOM overlay needs lives in a tiny store.
// ---------------------------------------------------------------------------

export const PLANE_FOV = 40
export const SPHERE_FOV = 54
/** azimuth radians per layout unit: one period wraps a full turn */
export const ANG = (Math.PI * 2) / PERIOD.x

export const rig = {
  pan: new Vector2(),
  panTarget: new Vector2(),
  /** pan seen through a slower spring; (pan - panSlow) drives depth parallax */
  panSlow: new Vector2(),
  /** 0 = plane, 1 = sphere (damped) */
  blend: 0,
  /** dolly offset along the view axis, overview only */
  zoom: 0,
  zoomTarget: 0,
  /** normalised pointer, -1..1 */
  pointer: new Vector2(),
  pointerActive: false,
  /** px travelled by the current press; > CLICK_SLOP means it was a drag */
  dragDist: 0,
  /** rest-plane camera distance, derived from viewport so 1 unit = 100·scale px */
  d: 11.43,
  scale: 1,
  hovered: -1,
  reducedMotion: false,
}

export const CLICK_SLOP = 6

type UI = { mode: 'plane' | 'sphere'; focus: number; explored: boolean }
let ui: UI = { mode: 'plane', focus: -1, explored: false }
const subs = new Set<() => void>()

export const getUI = () => ui
export function setUI(patch: Partial<UI>) {
  const next = { ...ui, ...patch }
  if (next.mode === ui.mode && next.focus === ui.focus && next.explored === ui.explored) return
  ui = next
  subs.forEach((f) => f())
}
export function useUI() {
  return useSyncExternalStore(
    (f) => (subs.add(f), () => subs.delete(f)),
    () => ui,
  )
}

// --- Field geometry --------------------------------------------------------

const wrap = (v: number, p: number) => v - p * Math.round(v / p)

/**
 * Elastic depth parallax. True parallax (layers panning at d/(d−z)) would let
 * layers drift apart without bound over an infinite pan, until the designed
 * layout collapses into overlaps. Instead, layers lead or trail only while the
 * field is moving (pan − panSlow) and settle back into the composition at rest.
 * Mouse-driven camera moves still give real perspective parallax on top.
 */
const PARALLAX_GAIN = 1.6
const lead = (card: Card) => (rig.d / (rig.d - card.z) - 1) * PARALLAX_GAIN

/** Screen-space (rest-plane) position of a card after panning + wrapping. */
export function screenPos(card: Card, out: Vector2) {
  const l = lead(card)
  return out.set(
    wrap(card.lx - rig.pan.x - (rig.pan.x - rig.panSlow.x) * l, PERIOD.x),
    wrap(card.ly - rig.pan.y - (rig.pan.y - rig.panSlow.y) * l, PERIOD.y),
  )
}

const _s = new Vector2()
const _e = new Euler(0, 0, 0, 'YXZ')
const _q = new Quaternion()
const ID = new Quaternion()

/**
 * Where a card sits for the current pan + plane/sphere blend.
 * Plane: depth-compensated so the rest frame projects exactly onto the Figma
 * layout, and depth only shows up as parallax once the camera moves.
 * Sphere: the same layout wrapped onto a bowl-shaped cylinder around the camera.
 * Returns the world-space size multiplier.
 */
export function cardTransform(card: Card, pos: Vector3, quat: Quaternion): number {
  const d = rig.d
  const t = rig.blend
  const s = screenPos(card, _s)

  const k = (d - card.z) / d
  const px = s.x * k
  const py = s.y * k
  const pz = card.z

  if (t < 1e-4) {
    pos.set(px, py, pz)
    quat.identity()
    return k
  }

  const R = d - card.z * 0.6
  const a = s.x * ANG
  const yn = s.y / (PERIOD.y / 2)
  const r = R * (1 + 0.28 * yn * yn)
  const sy = s.y * ANG * R
  const sx = r * Math.sin(a)
  const sz = -r * Math.cos(a)
  const sk = ANG * R

  pos.set(px + (sx - px) * t, py + (sy - py) * t, pz + (sz - pz) * t)
  _e.set(Math.atan2(sy, r) * 0.75, -a, 0)
  _q.setFromEuler(_e)
  quat.copy(ID).slerp(_q, t)
  return k + (sk - k) * t
}

/** Pan so a card comes to rest dead centre (works identically in both modes). */
export function centerOn(card: Card) {
  const sx = wrap(card.lx - rig.pan.x, PERIOD.x)
  const sy = wrap(card.ly - rig.pan.y, PERIOD.y)
  rig.panTarget.set(rig.pan.x + sx, rig.pan.y + sy)
}

/** Spatial neighbour for arrow-key navigation while a plate is focused. */
export function neighbour(from: number, dir: 'left' | 'right' | 'up' | 'down'): number {
  const o = screenPos(CARDS[from], new Vector2()).clone()
  let best = -1
  let bestScore = Infinity
  const v = new Vector2()
  for (const c of CARDS) {
    if (c.id === from) continue
    screenPos(c, v).sub(o)
    v.set(wrap(v.x, PERIOD.x), wrap(v.y, PERIOD.y))
    const along = dir === 'right' ? v.x : dir === 'left' ? -v.x : dir === 'up' ? v.y : -v.y
    const across = dir === 'left' || dir === 'right' ? Math.abs(v.y) : Math.abs(v.x)
    if (along < 0.4) continue
    const score = along + across * 2.2
    if (score < bestScore) {
      bestScore = score
      best = c.id
    }
  }
  return best
}

/** Viewport → world scale. 1280×832 renders the Figma frame at 1:1. */
export function fitViewport(width: number, height: number) {
  const scale = Math.min(1.25, Math.max(0.46, Math.min(width / FRAME.w, height / FRAME.h)))
  rig.scale = scale
  rig.d = height / (100 * scale) / 2 / Math.tan(((PLANE_FOV / 2) * Math.PI) / 180)
}
