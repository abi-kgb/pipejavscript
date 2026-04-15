import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import PipeComponent from './PipeComponent';

export default function CornerView3D({ components }) {
    return (
        <div className="absolute bottom-4 right-4 w-64 h-64 border-2 border-gray-700 rounded-lg overflow-hidden shadow-2xl bg-gray-900">
            <Canvas
                camera={{ position: [8, 8, 8], fov: 50 }}
                style={{ background: '#0f0f1e' }}
            >
                <ambientLight intensity={0.5} />
                <directionalLight position={[5, 5, 5]} intensity={0.8} />
                <directionalLight position={[-5, -5, -5]} intensity={0.3} />

                {components.map((component) => (
                    <PipeComponent
                        key={component.id}
                        component={component}
                        isSelected={false}
                        onSelect={() => { }}
                    />
                ))}

                <OrbitControls
                    enableZoom={true}
                    enablePan={false}
                    minDistance={3}
                    maxDistance={20}
                    enableDamping
                    dampingFactor={0.05}
                />

                <gridHelper args={[20, 20, '#2a2a4a', '#1a1a3a']} position={[0, -0.01, 0]} />
            </Canvas>

            <div className="absolute top-2 left-2 bg-black bg-opacity-60 px-2 py-1 rounded text-xs text-gray-300">
                3D View
            </div>
        </div>
    );
}
