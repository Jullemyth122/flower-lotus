import { Canvas } from '@react-three/fiber'
import { useState } from 'react'
import * as THREE from 'three/webgpu'
import { OrbitControls } from '@react-three/drei'
import FlowerScene from './FlowerScene2'
import './App.scss'

// ── Static petal count ──
const PETAL_COUNT = 18

const App = () => {
  const [revealed, setRevealed] = useState(false)
  const [exiting, setExiting] = useState(false)

  const handleOpen = () => {
    setExiting(true)
    // Wait for the CSS fade-out to finish before unmounting
    setTimeout(() => setRevealed(true), 1100)
  }

  return (
    <main className="app">
      {/* ── 3D Canvas ─────────────────────────────────────────────────── */}
      <Canvas
        camera={{ position: [0, 0, 3], fov: 75 }}
        shadows
        dpr={[1, 2]}
        flat
        gl={async (props) => {
          const { canvas, ...rest } = props
          const r = new THREE.WebGPURenderer({
            ...rest,
            powerPreference: 'high-performance',
            canvas: canvas as HTMLCanvasElement,
            antialias: true,
          })
          r.stencil = true
          r.shadowMap.enabled = true
          r.toneMapping = THREE.ACESFilmicToneMapping
          await r.init()
          return r
        }}
        style={{ width: '100%', height: '100vh' }}
      >
        {/* Pass the opening state down to the scene */}
        <FlowerScene isOpening={exiting || revealed} />

        <OrbitControls
          enablePan={false}
          enableDamping
          dampingFactor={0.06}
          minDistance={1.8}
          maxDistance={5}
          minPolarAngle={Math.PI * 0.2}
          maxPolarAngle={Math.PI * 0.56}
          autoRotate
          autoRotateSpeed={0.45}
        />
      </Canvas>

      {/* ── Floating Petals ──────────────────────────── */}
      <div className="petals" aria-hidden="true">
        {Array.from({ length: PETAL_COUNT }, (_, i) => (
          <span key={i} className={`petals__leaf petals__leaf--${i + 1}`} />
        ))}
      </div>

      {/* ── Intro Screen ──────────────────────────────────────────────── */}
      {!revealed && (
        <div className={`intro ${exiting ? 'intro--exit' : ''}`}>
          <div className="intro__glow" aria-hidden="true" />

          <div className="intro__card">
            <span className="intro__ornament">✦</span>
            <p className="intro__eyebrow">A Flower for you</p>
            <h1 className="intro__title">My Dear</h1>

            <p className="intro__verse">
              Red because your blood is mine,<br />
              and mine is yours...
            </p>

            <button
              className="intro__cta"
              onClick={handleOpen}
              aria-label="Open the flower"
            >
              <span className="intro__cta-label">Open Your Flower Baby</span>
              <span className="intro__cta-line" aria-hidden="true" />
            </button>

            <span className="intro__ornament intro__ornament--low">✦</span>
          </div>
        </div>
      )}

      {/* ── Dedication ───────────────────────── */}
      {revealed && (
        <div className="dedication">
          <p className="dedication__title">for you</p>
          <p className="dedication__quote">
            "Every petal, a promise — every glow, forever yours." ✦
          </p>
        </div>
      )}
    </main>
  )
}

export default App