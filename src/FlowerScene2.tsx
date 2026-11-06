import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three/webgpu'
import {
    vec3, positionLocal, uv, color, sin, mix, pow,
    PI, time, pass, mrt, output, attribute, uniform, Fn
} from 'three/tsl'
import { bloom } from 'three/addons/tsl/display/BloomNode.js'

const RED_VARIANTS = [
    { hex: '#ff0033', emissive: '#ff1133' },
    { hex: '#cc0022', emissive: '#cc1122' },
    { hex: '#ff2244', emissive: '#ff3355' },
    { hex: '#aa0011', emissive: '#bb1122' },
]

// 1. Create geometry once outside to save memory/load time
const PETAL_GEOM = new THREE.PlaneGeometry(1.5, 3.5, 16, 16);
PETAL_GEOM.translate(0, 1.75, 0);

const Petal = ({ angle, radialOffset, layerOffset, petalScale, l, totalLayers, isOpening, palette }: any) => {
    const animatedGroupRef = useRef<THREE.Group>(null);
    const lightRef = useRef<THREE.PointLight>(null);
    const animTimeRef = useRef(0);

    const hasLight = l >= 0;
    const fireflyColor = '#ffffff';

    // 2. Use TSL to handle color variations in one material pass
    const customMaterial = useMemo(() => {
        const mat = new THREE.MeshStandardNodeMaterial({
            side: THREE.DoubleSide,
            roughness: 0.85,
            metalness: 0.0,
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
    }, [angle, palette.hex]);

    useFrame((state, delta) => {
        if (!animatedGroupRef.current) return;
        if (isOpening) animTimeRef.current += delta;

        const clockTime = state.clock.getElapsedTime();
        const openDuration = 4.5;
        const maxDelay = 0.5;
        const speedMultiplier = 1.5;

        const layerFactor = totalLayers > 1 ? l / (totalLayers - 1) : 0;
        const delay = (1 - layerFactor) * maxDelay;
        const progress = Math.min(animTimeRef.current / openDuration, 1) * speedMultiplier - delay;
        const clampedProgress = Math.min(Math.max(progress, 0), 1);

        const openFactor = clampedProgress * clampedProgress * (3 - 2 * clampedProgress);
        const closeFactor = 1 - openFactor;

        const openTilt = 0.4 - (0.35 * layerFactor);
        const closedTilt = 1.45 - (0.2 * layerFactor);
        animatedGroupRef.current.rotation.x = openTilt + (closedTilt - openTilt) * closeFactor;

        if (lightRef.current) {
            // Reduced intensity to stop the "white void" effect
            // lightRef.current.intensity = 1.5 + Math.sin(clockTime * 3.0 + angle) * 0.5;
        }
    });

    return (
        <group rotation={[0, 0, angle]}>
            <group ref={animatedGroupRef} position={[0, radialOffset, layerOffset]}>
                <mesh
                    geometry={PETAL_GEOM}
                    material={customMaterial}
                    scale={petalScale as [number, number, number]}
                />

                {hasLight && (
                    <group position={[0, 3.5 * petalScale[1], 0.05]}>
                        <mesh>
                            <sphereGeometry args={[0.03, 16, 16]} />
                            <meshBasicMaterial color={fireflyColor} />
                        </mesh>
                        <pointLight
                            ref={lightRef}
                            distance={50} // Limited distance so they don't bleed into each other too much
                            intensity={0.5}
                            color={fireflyColor}
                            decay={1} // Physical decay makes the light look more natural
                        />
                    </group>
                )}
            </group>
        </group>
    )
}

const FlowerScene = ({ isOpening }: { isOpening: boolean }) => {
    const { gl, scene, camera } = useThree()

    useMemo(() => {
        scene.background = new THREE.Color('#03050a')
    }, [scene])

    const postProcessing = useMemo(() => {
        const scenePass = pass(scene, camera)
        scenePass.setMRT(mrt({ output }))
        const out = scenePass.getTextureNode('output')

        // Toned down bloom to keep the reds visible
        const bloomNode = bloom(out, 1., 0., 0.5)
        const pp = new THREE.RenderPipeline(gl as any)
        pp.outputNode = out.add(bloomNode)

        return pp
    }, [scene, camera, gl])

    useFrame(() => {
        postProcessing.render()
    }, 1)

    // Pre-calculate petals to avoid re-renders
    const petalList = useMemo(() => {
        const totalLayers = 6;
        const petalsPerLayer = 14;
        const items = [];

        for (let l = 0; l < totalLayers; l++) {
            const layerFactor = l / (totalLayers - 1);
            const sizeValue = 0.55 + (0.7 * layerFactor);
            const patternStagger = (l % 2 === 0) ? 0 : (Math.PI / petalsPerLayer);

            for (let p = 0; p < petalsPerLayer; p++) {
                const angle = ((p / petalsPerLayer) * Math.PI * 2) + patternStagger;
                const palette = RED_VARIANTS[Math.floor(Math.random() * RED_VARIANTS.length)];
                items.push({
                    key: `l${l}-p${p}`,
                    angle,
                    radialOffset: 0.75 + (0.35 * layerFactor),
                    layerOffset: 0.12 - (0.24 * layerFactor),
                    petalScale: [sizeValue, sizeValue, 1.0],
                    l,
                    totalLayers,
                    palette
                });
            }
        }
        return items;
    }, []);

    return (
        <>
            <ambientLight intensity={0.1} color="#050505" />
            <group position={[0, -0.5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <mesh scale={[1.2, 1.2, 0.4]}>
                    <sphereGeometry args={[1, 32, 32]} />
                    <meshStandardMaterial color="#050303" roughness={0.9} />
                </mesh>

                {petalList.map(props => (
                    <Petal {...props} isOpening={isOpening} />
                ))}
            </group>
        </>
    )
}

export default FlowerScene;