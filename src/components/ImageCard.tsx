import { useEffect, useMemo, useRef } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { damp } from 'maath/easing'
import { Group, Mesh, PlaneGeometry, Quaternion, Vector3 } from 'three'
import type { Card } from '../data/photos'
import { createCardMaterial } from '../lib/cardMaterial'
import { CLICK_SLOP, cardTransform, rig, setCursor } from '../lib/rig'
import { imageAspect, loadTexture } from '../lib/textures'

const PLANE = new PlaneGeometry(1, 1)
const _p = new Vector3()
const _q = new Quaternion()

type Props = {
  card: Card
  focused: boolean
  dimmed: boolean
  onSelect: (id: number) => void
}

export function ImageCard({ card, focused, dimmed, onSelect }: Props) {
  const group = useRef<Group>(null!)
  const mesh = useRef<Mesh>(null!)
  const material = useMemo(() => createCardMaterial(card.w / card.h, card.crop), [card])
  const loadedTarget = useRef(0)
  const hover = useRef(0)
  // Arrival order: centre outward, so the composition assembles around the hero.
  const delay = 0.12 + Math.min(Math.hypot(card.lx, card.ly * 1.4), 30) * 0.035

  useEffect(() => () => material.dispose(), [material])

  // Card-resolution texture first, full-resolution only once it's inspected.
  useEffect(() => {
    let live = true
    const url = focused ? card.photo.srcHi : card.photo.src
    loadTexture(url)
      .then((tex) => {
        if (!live) return
        material.uniforms.uMap.value = tex
        material.uniforms.uImageAspect.value = imageAspect(tex)
        loadedTarget.current = 1
      })
      .catch(() => {
        /* leave the chip-coloured placeholder; the frame still reads */
      })
    return () => {
      live = false
    }
  }, [card, focused, material])

  useFrame((_, dt) => {
    const scale = cardTransform(card, _p, _q)
    // Show, don't tell: prints rise out of depth into place on arrival,
    // which says "this is a 3D space" before any instruction could.
    const a = rig.reducedMotion ? 1 : Math.min(1, Math.max(0, (rig.time - delay) / 1.1))
    const rise = 1 - Math.pow(1 - a, 4) // easeOutQuart
    group.current.position.copy(_p)
    group.current.position.z -= (1 - rise) * 7
    group.current.quaternion.copy(_q)
    group.current.visible = a > 0

    const u = material.uniforms
    const fast = rig.reducedMotion ? 0.05 : 0.18
    damp(hover, 'current', rig.hovered === card.id && !dimmed ? 1 : 0, fast, dt)
    damp(u.uHover, 'value', hover.current, 0.001, dt)
    damp(u.uLoaded, 'value', loadedTarget.current, 0.35, dt)
    damp(u.uOpacity, 'value', (dimmed ? 0.1 : 1) * Math.min(1, a * 2.2), 0.08, dt)

    const m = mesh.current
    m.scale.set(card.w * scale * (1 + 0.035 * hover.current), card.h * scale * (1 + 0.035 * hover.current), 1)
    damp(m.position, 'z', hover.current * 0.28, fast, dt)

    // Under inspection the print turns gently toward the pointer.
    const tilt = focused && !rig.reducedMotion ? 1 : 0
    damp(m.rotation, 'y', rig.pointer.x * 0.12 * tilt, 0.4, dt)
    damp(m.rotation, 'x', -rig.pointer.y * 0.09 * tilt, 0.4, dt)
  })

  const over = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    rig.hovered = card.id
    setCursor(focused ? 'zoom-out' : 'zoom-in')
  }
  const out = () => {
    if (rig.hovered === card.id) rig.hovered = -1
    setCursor('grab')
  }
  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (rig.dragDist > CLICK_SLOP) return
    onSelect(card.id)
  }

  return (
    <group ref={group}>
      <mesh ref={mesh} geometry={PLANE} material={material} onPointerOver={over} onPointerOut={out} onClick={click} />
    </group>
  )
}
