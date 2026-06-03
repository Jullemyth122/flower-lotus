import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three/webgpu'
import {
    vec3, positionLocal, uv, color, sin, mix, pow,
    PI, time, pass, mrt, output
} from 'three/tsl'
import { bloom } from 'three/addons/tsl/display/BloomNode.js'

// ── Red Variant Palette 
const RED_VARIANTS = [
    { hex: '#ff0033', emissive: '#ff1133' },
    { hex: '#cc0022', emissive: '#cc1122' },
    { hex: '#ff2244', emissive: '#ff3355' },
    { hex: '#aa0011', emissive: '#bb1122' },
]

// Define strictly typed props for the Petal component
interface PetalProps {
    angle: number;
    radialOffset: number;
    layerOffset: number;
    petalScale: number[];
    l: number;
    totalLayers: number;
}

// ── Petal Component 
const Petal = ({ angle, radialOffset, layerOffset, petalScale, l, totalLayers }: PetalProps) => {
    const animatedGroupRef = useRef<THREE.Group>(null);
    const lightRef = useRef<THREE.PointLight>(null);

    // Determine if this petal belongs to the larger outer layers
    const hasLight = l >= 4;
    const fireflyColor = '#d4ff1a';

    const geom = useMemo(() => {
        const g = new THREE.PlaneGeometry(1.5, 3.5, 16, 16);
        g.translate(0, 1.75, 0); // Centers pivot point directly at the base of the petal
        return g;
    }, []);

    const palette = useMemo(() => RED_VARIANTS[Math.floor(Math.random() * RED_VARIANTS.length)], []);

    const customMaterial = useMemo(() => {
        const mat = new THREE.MeshStandardNodeMaterial({
            side: THREE.DoubleSide,
            roughness: 0.85, // Organic matte texture
            metalness: 0.0,  // Completely non-metallic
        });

        const widthProfile = sin(uv().y.mul(PI));
        const taperX = positionLocal.x.mul(widthProfile);

        const structuralCurveZ = sin(uv().y.mul(PI)).mul(-0.4);
        const wind = sin(time.mul(1.5).add(angle)).mul(0.05);

        mat.positionNode = vec3(
            taperX,
            positionLocal.y,
            positionLocal.z.add(structuralCurveZ).add(wind)
        );

        const baseColor = color('#110000');
        const tipColor = color(palette.hex);
        mat.colorNode = mix(baseColor, tipColor, pow(uv().y, 1.2));

        return mat;
    }, [angle, palette]);

    useFrame((state) => {
        if (!animatedGroupRef.current) return;

        const clockTime = state.clock.getElapsedTime();
        const animationSpeed = 0.6;
        const cycleDuration = 6;
        const halfDuration = cycleDuration / 2;

        const t = (clockTime * animationSpeed) % cycleDuration;
        const phaseTime = t % halfDuration;
        const isClosing = t < halfDuration;

        const layerFactor = totalLayers > 1 ? l / (totalLayers - 1) : 0;
        const maxDelay = 0.4;
        const speedMultiplier = 1.0 + maxDelay;

        let closeFactor = 0;

        if (isClosing) {
            const delay = layerFactor * maxDelay;
            const progress = (phaseTime / halfDuration) * speedMultiplier - delay;
            const clampedProgress = Math.min(Math.max(progress, 0), 1);
            closeFactor = clampedProgress * clampedProgress * (3 - 2 * clampedProgress);
        } else {
            const delay = (1 - layerFactor) * maxDelay;
            const progress = (phaseTime / halfDuration) * speedMultiplier - delay;
            const clampedProgress = Math.min(Math.max(progress, 0), 1);
            const openFactor = clampedProgress * clampedProgress * (3 - 2 * clampedProgress);
            closeFactor = 1 - openFactor;
        }

        const openTilt = 0.4 - (0.35 * layerFactor);
        const closedTilt = 1.45 - (0.2 * layerFactor);
        const dynamicTilt = openTilt + (closedTilt - openTilt) * closeFactor;

        // Rotate the container group safely
        animatedGroupRef.current.rotation.x = dynamicTilt;

        // Subtle organic light pulsing effect
        if (lightRef.current) {
            lightRef.current.intensity = 2.5 + Math.sin(clockTime * 3.0 + angle) * 0.8;
        }
    });

    const tipYPosition = 3.5 * petalScale[1];

    return (
        <group rotation={[0, 0, angle]}>
            <group ref={animatedGroupRef} position={[0, radialOffset, layerOffset]}>
                {/* Petal Mesh */}
                <mesh
                    geometry={geom}
                    material={customMaterial}
                    scale={petalScale as [number, number, number]}
                />

                {/* Firefly Light attached directly to the edge tip of the larger petals */}
                {hasLight && (
                    <group position={[0, tipYPosition, 0.05]}>
                        {/* Tiny glowing core body */}
                        <mesh>
                            <sphereGeometry args={[0.05, 8, 8]} />
                            <meshBasicMaterial color={fireflyColor} />
                        </mesh>
                        {/* Real-time WebGPU PointLight */}
                        <pointLight
                            ref={lightRef}
                            distance={6}
                            intensity={2.5}
                            color={fireflyColor}
                            decay={2}
                        />
                    </group>
                )}
            </group>
        </group>
    )
}

// ── Main Scene ──
const FlowerScene = () => {
    const { gl, scene, camera } = useThree()

    useMemo(() => {
        scene.background = new THREE.Color('#03050a')
    }, [scene])

    const postProcessing = useMemo(() => {
        const scenePass = pass(scene, camera)
        scenePass.setMRT(mrt({ output }))
        const out = scenePass.getTextureNode('output')

        // Pass direct numbers instead of wrapping them in float()
        const bloomNode = bloom(out, 1.8, 0.8, 0.15)
        const baseComposite = out.add(bloomNode)

        // Type assertion bypasses structural mismatch between R3F and WebGPU render context definitions
        const pp = new THREE.RenderPipeline(gl as any)
        pp.outputNode = baseComposite

        return pp
    }, [scene, camera, gl])

    useFrame((state) => {
        state.invalidate()
        postProcessing.render()
    }, 1)

    const petals = useMemo(() => {
        const totalLayers = 6;
        const petalsPerLayer = 14;
        const items = [];

        for (let l = 0; l < totalLayers; l++) {
            const layerFactor = totalLayers > 1 ? l / (totalLayers - 1) : 0;
            const sizeValue = 0.55 + (0.7 * layerFactor);
            const petalScale = [sizeValue, sizeValue, 1.0];
            const radialOffset = 0.75 + (0.35 * layerFactor);
            const layerOffset = 0.12 - (0.24 * layerFactor);
            const patternStagger = (l % 2 === 0) ? 0 : (Math.PI / petalsPerLayer);

            for (let p = 0; p < petalsPerLayer; p++) {
                const angle = ((p / petalsPerLayer) * Math.PI * 2) + patternStagger;
                const uniqueKey = `l${l}-p${p}`;

                items.push(
                    <Petal
                        key={uniqueKey}
                        angle={angle}
                        radialOffset={radialOffset}
                        layerOffset={layerOffset}
                        petalScale={petalScale}
                        l={l}
                        totalLayers={totalLayers}
                    />
                );
            }
        }
        return items;
    }, []);

    return (
        <>
            <ambientLight intensity={0.15} color="#141a29" />
            <spotLight position={[5, 12, 5]} intensity={4} color="#5577aa" angle={0.6} penumbra={1} />
            <pointLight position={[0, 1.5, 0]} intensity={10} color="#ff1133" distance={12} />

            <group position={[0, -0.5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <mesh position={[0, 0, 0]} scale={[1.2, 1.2, 0.4]}>
                    <sphereGeometry args={[1, 32, 32]} />
                    <meshStandardMaterial
                        color="#050303"
                        roughness={0.9}
                        metalness={0.05}
                    />
                </mesh>

                {petals}
            </group>
        </>
    )
}

export default FlowerScene;