import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Group, Mesh, MeshBasicMaterial } from 'three'
import { Color } from 'three'
import {
  presentationEventProgress,
  type CharacterEffectId,
  type CharacterPresentationEvent,
} from './presentationEvents'

export type CharacterEffectsProps = Readonly<{
  events: readonly CharacterPresentationEvent[]
  visibleTokenIds: ReadonlySet<string>
  particleScale: number
}>

type EffectProps = Readonly<{
  event: CharacterPresentationEvent
  particleScale: number
}>

type Particle = Readonly<{
  x: number
  z: number
  phase: number
  color: string
}>

const EFFECT_COLORS: Readonly<Record<CharacterEffectId, string>> = {
  melee_slash: '#fff0a8',
  fire_projectile: '#ff7b35',
  hit_burst: '#ff5364',
  heal_pulse: '#78f59c',
}

const MAX_TIMEOUT_MS = 2_147_483_647

function eventIsActive(event: CharacterPresentationEvent, nowMs: number): boolean {
  return nowMs >= event.startedAtMs && nowMs < event.startedAtMs + event.durationMs
}

function lerp(start: number, end: number, progress: number): number {
  return start + (end - start) * progress
}

function setOpacity(mesh: Mesh | null, opacity: number): void {
  const material = mesh?.material as MeshBasicMaterial | undefined
  if (!material || Array.isArray(material) || !('opacity' in material)) return
  material.transparent = true
  material.opacity = opacity
}

function EffectFrame({ event, particleScale }: EffectProps) {
  const root = useRef<Group>(null)
  const core = useRef<Mesh>(null)
  const projectile = useRef<Mesh>(null)
  const particlesRoot = useRef<Group>(null)
  const invalidate = useThree((state) => state.invalidate)
  const [active, setActive] = useState(() => eventIsActive(event, Date.now()))
  const particleCount = Math.max(1, Math.round(16 * Math.max(0, particleScale)))
  const particles = useMemo<readonly Particle[]>(
    () =>
      Array.from({ length: particleCount }, (_, index) => ({
        x: ((index * 7) % 11) / 20 - 0.25,
        z: ((index * 5) % 13) / 24 - 0.25,
        phase: (index % 7) / 7,
        color: index % 2 === 0 ? '#9cffb8' : '#f2d875',
      })),
    [particleCount],
  )

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined

    const wake = () => {
      if (cancelled) return
      const nowMs = Date.now()
      if (nowMs < event.startedAtMs) {
        setActive(false)
        timer = setTimeout(wake, Math.max(1, Math.min(MAX_TIMEOUT_MS, event.startedAtMs - nowMs)))
        return
      }
      const nextActive = eventIsActive(event, nowMs)
      setActive(nextActive)
      if (nextActive) invalidate()
    }

    // Demand-mode canvases do not run a frame merely because React committed
    // an effect. Wake the loop for new/updated events and future start times.
    wake()
    return () => {
      cancelled = true
      if (timer !== undefined) clearTimeout(timer)
    }
  }, [event, invalidate, particleScale])

  useFrame(() => {
    if (!active) return
    if (Date.now() < event.startedAtMs) return
    const progress = presentationEventProgress(event, Date.now())
    if (progress >= 1) {
      setActive(false)
      invalidate()
      return
    }

    const source = event.source
    const target = event.target
    const angle = Math.atan2(target.z - source.z, target.x - source.x)
    const currentX = lerp(source.x, target.x, progress)
    const currentZ = lerp(source.z, target.z, progress)
    if (root.current) root.current.rotation.y = event.effectId === 'melee_slash' ? angle : 0

    if (event.effectId === 'melee_slash' && root.current) {
      root.current.position.set(source.x, 0.65, source.z)
      root.current.scale.setScalar(Math.max(0.01, Math.sin(Math.min(1, progress * 1.4) * Math.PI)))
      setOpacity(core.current, 1 - progress)
    }

    if (event.effectId === 'fire_projectile') {
      if (projectile.current) {
        projectile.current.position.set(currentX, 0.85 + Math.sin(progress * Math.PI) * 0.35, currentZ)
        projectile.current.scale.setScalar(0.8 + Math.sin(progress * Math.PI) * 0.25)
      }
      if (core.current) {
        core.current.position.set(target.x, 0.08, target.z)
        const impactProgress = Math.max(0, (progress - 0.58) / 0.42)
        core.current.scale.setScalar(0.2 + impactProgress * 1.1)
        setOpacity(core.current, impactProgress)
      }
    }

    if (event.effectId === 'hit_burst' && core.current) {
      core.current.position.set(target.x, 0.08, target.z)
      core.current.scale.setScalar(0.35 + progress * 1.25)
      setOpacity(core.current, 1 - progress)
    }

    if (event.effectId === 'heal_pulse') {
      if (core.current) {
        core.current.position.set(target.x, 0.08, target.z)
        core.current.scale.setScalar(0.45 + Math.sin(progress * Math.PI) * 0.7)
        setOpacity(core.current, 1 - progress * 0.75)
      }
      if (particlesRoot.current) {
        particlesRoot.current.position.set(target.x, 0.1, target.z)
        particlesRoot.current.children.forEach((particle, index) => {
          const item = particles[index]
          if (!item) return
          particle.position.set(
            item.x + Math.sin((progress + item.phase) * Math.PI * 2) * 0.08,
            progress * 1.2 + item.phase * 0.25,
            item.z + Math.cos((progress + item.phase) * Math.PI * 2) * 0.08,
          )
          particle.scale.setScalar(0.75 + Math.sin((progress + item.phase) * Math.PI) * 0.3)
        })
      }
    }
    invalidate()
  })

  if (!active || !eventIsActive(event, Date.now())) return null

  const effectName = `character-effect-${event.effectId}-${event.id}`
  const coreName = `character-effect-core-${event.effectId}-${event.id}`
  const color = EFFECT_COLORS[event.effectId]

  return (
    <group ref={root} name={effectName}>
      {event.effectId === 'melee_slash' ? (
        <mesh ref={core} name={coreName} rotation-x={-Math.PI / 2}>
          <ringGeometry args={[0.28, 0.4, 20, 1, 0, Math.PI * 0.78]} />
          <meshBasicMaterial color={color} transparent opacity={0.9} depthWrite={false} toneMapped={false} />
        </mesh>
      ) : null}
      {event.effectId === 'fire_projectile' ? (
        <>
          <mesh ref={projectile} name={`character-effect-projectile-${event.id}`}>
            <sphereGeometry args={[0.16, 8, 8]} />
            <meshBasicMaterial color={color} toneMapped={false} />
          </mesh>
          <mesh ref={core} name={coreName} rotation-x={-Math.PI / 2}>
            <ringGeometry args={[0.2, 0.36, 16]} />
            <meshBasicMaterial color="#ffc04d" transparent opacity={0} depthWrite={false} toneMapped={false} />
          </mesh>
        </>
      ) : null}
      {event.effectId === 'hit_burst' ? (
        <mesh ref={core} name={coreName} rotation-x={-Math.PI / 2}>
          <ringGeometry args={[0.28, 0.38, 20]} />
          <meshBasicMaterial color={color} transparent opacity={0.9} depthWrite={false} toneMapped={false} />
        </mesh>
      ) : null}
      {event.effectId === 'heal_pulse' ? (
        <>
          <mesh ref={core} name={coreName} rotation-x={-Math.PI / 2}>
            <ringGeometry args={[0.3, 0.42, 20]} />
            <meshBasicMaterial color={color} transparent opacity={0.9} depthWrite={false} toneMapped={false} />
          </mesh>
          <group ref={particlesRoot} name={`character-effect-particles-${event.id}`}>
            {particles.map((particle, index) => (
              <mesh
                key={index}
                name={`character-effect-particle-${event.id}-${index}`}
                position={[particle.x, 0, particle.z]}
              >
                <sphereGeometry args={[0.045, 5, 5]} />
                <meshBasicMaterial color={new Color(particle.color)} toneMapped={false} />
              </mesh>
            ))}
          </group>
        </>
      ) : null}
    </group>
  )
}

export function CharacterEffects({ events, visibleTokenIds, particleScale }: CharacterEffectsProps) {
  const visibleEvents = useMemo(
    () =>
      events.filter(
        (event) =>
          visibleTokenIds.has(event.sourceTokenId) &&
          (event.targetTokenId === null || visibleTokenIds.has(event.targetTokenId)),
      ),
    [events, visibleTokenIds],
  )

  return (
    <group name="character-effects">
      {visibleEvents.map((event) => (
        <EffectFrame key={event.id} event={event} particleScale={particleScale} />
      ))}
    </group>
  )
}
