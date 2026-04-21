import React, { useState, useRef, Suspense, Component, useEffect, useCallback, forwardRef, useImperativeHandle, useMemo } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { jsPDF } from 'jspdf';
import { getComponentTag } from '../utils/tagging.js';
import { Html } from '@react-three/drei';
import { RotateCcw, RotateCw, Plus, Minus, ChevronDown } from 'lucide-react';
import {
  Grid,
  TransformControls,
  CameraControls,
  PerspectiveCamera,
  OrthographicCamera,
  GizmoHelper,
  GizmoViewport,
  Text,
  Environment,
  ContactShadows
} from '@react-three/drei';
import PipeComponent from './PipeComponent';
import { findSnapPoint, findSnapForTransform } from '../utils/snapping.js';
import { COMPONENT_DEFINITIONS } from '../config/componentDefinitions.js';
import * as THREE from 'three';
import ResizablePane from './ResizablePane';

const VIEW_CONFIGS = {
  iso: { label: '3D Isometric', labelColor: 'bg-slate-900', labelTextColor: 'text-white', camera: 'ortho', defaultPos: [100, 100, 100], defaultZoom: 40, defaultUp: [0, 1, 0] },
  front: { label: 'Front Elevation', labelColor: 'bg-blue-600/10', labelTextColor: 'text-blue-600', camera: 'ortho', defaultZoom: 60, defaultPos: [0, 0, 2000], defaultUp: [0, 1, 0] },
  top: { label: 'Top Plan View', labelColor: 'bg-slate-900/5', labelTextColor: 'text-slate-500', camera: 'ortho', defaultZoom: 40, defaultPos: [0, 2000, 0], defaultUp: [0, 0, -1] },
  right: { label: 'Right Elevation', labelColor: 'bg-blue-600/10', labelTextColor: 'text-blue-600', camera: 'ortho', defaultZoom: 60, defaultPos: [2000, 0, 0], defaultUp: [0, 1, 0] },
  left: { label: 'Left Elevation', labelColor: 'bg-blue-600/10', labelTextColor: 'text-blue-600', camera: 'ortho', defaultZoom: 60, defaultPos: [-2000, 0, 0], defaultUp: [0, 1, 0] },
  back: { label: 'Back Elevation', labelColor: 'bg-blue-600/10', labelTextColor: 'text-blue-600', camera: 'ortho', defaultZoom: 60, defaultPos: [0, 0, -2000], defaultUp: [0, 1, 0] },
  bottom: { label: 'Bottom View', labelColor: 'bg-slate-900/5', labelTextColor: 'text-slate-500', camera: 'ortho', defaultZoom: 40, defaultPos: [0, -2000, 0], defaultUp: [0, 0, 1] }
};

// ---------------------------------------------------------
// COMPONENT: SceneErrorBoundary
// ---------------------------------------------------------
class SceneErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error("3D Viewport Crash:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 text-slate-400 p-4 text-center border-2 border-dashed border-slate-100 rounded-3xl m-2">
          <svg className="w-8 h-8 mb-2 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span className="text-[10px] font-black uppercase tracking-widest">{this.state.error?.message || "Internal rendering error"}</span>
          <button onClick={() => window.location.reload()} className="mt-2 text-[8px] font-black underline uppercase text-blue-500">Restart View</button>
        </div>
      );
    }
    return this.props.children;
  }
}

const ChainAnchorIndicator = ({ position, darkMode }) => {
  const meshRef = useRef();
  useFrame(({ clock }) => {
    if (meshRef.current) {
      const scale = 1 + Math.sin(clock.getElapsedTime() * 5) * 0.2;
      meshRef.current.scale.set(scale, scale, scale);
    }
  });

  return (
    <group position={[position.x, position.y, position.z]}>
      <mesh ref={meshRef}>
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshBasicMaterial color="#10b981" transparent opacity={0.6} depthTest={false} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.3, 0.4, 32]} />
        <meshBasicMaterial color="#10b981" transparent opacity={0.4} depthTest={false} />
      </mesh>
      <Html center position={[0, 0.4, 0]} pointerEvents="none">
        <div className="bg-emerald-500 text-white text-[8px] font-black uppercase px-1.5 py-0.5 rounded shadow-lg whitespace-nowrap">
          Chain Anchor
        </div>
      </Html>
    </group>
  );
};

// ---------------------------------------------------------
// COMPONENT: OriginMarker
// ---------------------------------------------------------
const OriginMarker = ({ darkMode }) => (
  <group position={[0, 0, 0]}>
    <mesh>
      <sphereGeometry args={[0.08, 16, 16]} />
      <meshBasicMaterial color={darkMode ? "#6366f1" : "#4f46e5"} transparent opacity={0.6} />
    </mesh>
    <axesHelper args={[0.5]} />
    <Text
      position={[0, 0.2, 0]}
      fontSize={0.12}
      color={darkMode ? "#94a3b8" : "#64748b"}
      font="https://fonts.gstatic.com/s/roboto/v20/KFOmCnqEu92Fr1Mu4mxP.ttf"
      anchorX="center"
      anchorY="middle"
    >
      0,0,0
    </Text>
  </group>
);

// ---------------------------------------------------------
// COMPONENT: SharedSceneElements
// ---------------------------------------------------------
const SharedSceneElements = ({
  components,
  selectedIds,
  onSelectComponent,
  onUpdateComponent,
  onUpdateMultiple,
  placingType,
  onPlaceComponent,
  transformMode,
  viewMode,
  darkMode,
  onBatchSelect,
  isCapture = false,
  placingTemplate,
  isDragging,
  isTransforming,
  suppressLabels = false,
  onTransform,
  isLocked = false,
  connectionMode = false,
  selectedSockets = [],
  onSocketClick,
  isBlueprint = false,
  isColorSketch = false,
  snapPivot,
  showColorDifferentiation,
  captureStyle = 'color',
  isGroupDragging,
  setIsGroupDragging,
  showFlow = false,
  onShowHydroStats,
  chainAnchor = null,
}) => {


  const bgColor = isCapture 
    ? '#ffffff' // All export views (Color, Sketch, Pencil) look best on clean white paper
    : (darkMode ? '#0f172a' : '#ffffff');
  
  if (placingType) {
    console.log(`[SharedSceneElements] ACTIVE PLACEMENT: ${placingType}`, { viewMode, isCapture });
  }

  const gridCellColor = darkMode ? '#1e293b' : '#e2e8f0';
  const gridSectionColor = darkMode ? '#334155' : '#cbd5e1';

  return (
    <>
      <color attach="background" args={[bgColor]} />
      
      {/* Dynamic Lighting adapted for View Mode (True CAD Blueprint vs Shaded Render) */}
      {isBlueprint ? (
        <>
          {/* High-contrast technical lighting: Flat and bright for clear lines */}
          <ambientLight intensity={1.5} />
          <directionalLight position={[0, 10, 0]} intensity={0.5} />
        </>
      ) : (
        <>
          <ambientLight intensity={darkMode ? 0.4 : 1.3} />
          <directionalLight 
            position={[20, 50, 20]} 
            intensity={darkMode ? 0.8 : 1.2} 
            castShadow 
            shadow-mapSize={[1024, 1024]}
          />
          <directionalLight position={[-20, 20, -20]} intensity={darkMode ? 0.4 : 0.6} />
          <pointLight position={[0, 10, 0]} intensity={0.5} />
{/* <Suspense fallback={null}>
            <Environment preset="city" />
          </Suspense> */}
          <pointLight position={[50, 0, 0]} intensity={0.3} />
          <pointLight position={[-50, 0, 0]} intensity={0.3} />
          <pointLight position={[0, 0, 50]} intensity={0.3} />
          <pointLight position={[0, 0, -50]} intensity={0.3} />
        </>
      )}


      {!isCapture && (
        <ContactShadows
          position={[0, -0.01, 0]}
          opacity={0.4}
          scale={50}
          blur={2}
          far={10}
          resolution={128} // Lower resolution for better performance
          color={darkMode ? "#000000" : "#334155"}
        />
      )}


      {!isCapture && (
        <>
          <Grid
            args={[200, 200]}
            cellSize={1}
            cellThickness={0.5}
            cellColor={gridCellColor}
            sectionSize={10}
            sectionThickness={1}
            sectionColor={gridSectionColor}
            fadeDistance={100}
            infiniteGrid
          />
          <OriginMarker darkMode={darkMode} />

        </>
      )}

      {/* Components Layer - Interactivity disabled during placement so hitboxes don't block clicks */}
      <group raycast={placingType ? null : undefined}>
        {components.map((comp) => (
          <PipeComponent
            key={comp.id}
            component={comp}
            isSelected={selectedIds.includes(comp.id)}
            isAttached={isGroupDragging && selectedIds.includes(comp.id)} // Tell pipe to hold position while moved by pivot
            onSelect={(e) => onSelectComponent(comp.id, e)}
            onUpdate={onUpdateComponent}
            viewMode={viewMode}
            darkMode={darkMode}
            tag={comp._tag}
            info={comp._label} // 🎯 Pass full human-readable label
            isCapture={isCapture}
            isBlueprint={isBlueprint} 
            isColorSketch={isColorSketch}
            suppressLabels={suppressLabels}
            connectionMode={connectionMode}
            isPlacementActive={!!placingType}
            selectedSockets={selectedSockets}
            onSocketClick={onSocketClick}
            showColorDifferentiation={showColorDifferentiation}
            captureStyle={captureStyle}
            showFlow={showFlow}
            onWaterClick={() => onShowHydroStats?.(comp)}
          />
        ))}
      </group>


      {showFlow && (
        <LeakageManager 
          components={components} 
          darkMode={darkMode} 
          onSelect={onSelectComponent} 
          onBatchSelect={onBatchSelect} 
        />
      )}


      {placingType && (
        <PlacementGhost
          placingType={placingType}
          placingTemplate={placingTemplate}
          components={components}
          onPlace={onPlaceComponent}
          viewMode={viewMode}
          darkMode={darkMode}
          chainAnchor={chainAnchor}
        />
      )}

      {/* 🔗 CHAIN ANCHOR INDICATOR */}
      {chainAnchor && !isCapture && (
        <ChainAnchorIndicator position={chainAnchor.worldPos} darkMode={darkMode} />
      )}

      {selectedIds.length > 0 && !isCapture && (
        <EditorControls
          selectedIds={selectedIds}
          components={components}
          onUpdateMultiple={onUpdateMultiple}
          transformMode={transformMode}
          isTransforming={isTransforming}
          onTransform={onTransform}
          snapPivot={snapPivot}
          setIsGroupDragging={setIsGroupDragging}
        />
      )}

      {/* Marquee Selection Logic - Only active when view is locked */}
      {!isCapture && !placingType && isLocked && (
        <SelectionManager
          components={components}
          onBatchSelect={onBatchSelect}
          isDragging={isDragging}
          isLocked={isLocked}
        />
      )}
    </>
  );
};

const SelectionManager = ({ components, onBatchSelect, isDragging, isLocked }) => {
  const { camera, size, pointer, gl } = useThree();
  const [start, setStart] = useState(null);
  const [current, setCurrent] = useState(null);
  const startPointer = useRef(null);

  useEffect(() => {
    const canvas = gl.domElement;
    if (!canvas) return;

    const handleDown = (e) => {
      console.log(`[SelectionManager/MouseDown] isLocked:${isLocked}, button:${e.button}`);
      // Only trigger if view is locked and it's a left click
      if (!isLocked || e.button !== 0) return;

      // Ensure we're clicking the actual canvas or its children (not external UI)
      if (e.target !== canvas && !canvas.contains(e.target)) return;

      // Reset dragging state just in case it got stuck
      isDragging.current = false;

      // Store current normalized pointer position
      startPointer.current = { x: pointer.x, y: pointer.y };
    };

    const handleMove = (e) => {
      if (!startPointer.current || !gl.domElement) return;

      // Ensure we have valid pointer coordinates
      if (pointer.x === undefined || pointer.y === undefined) return;

      // Calculate distance in normalized coordinates to determine if dragging
      const dx = pointer.x - startPointer.current.x;
      const dy = pointer.y - startPointer.current.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Threshold: approx 8 pixels in normalized space
      if (!isDragging.current && dist > 0.01) {
        isDragging.current = true;
      }

      if (isDragging.current) {
        setStart(startPointer.current);
        setCurrent({
          x: Math.max(-1, Math.min(1, pointer.x)),
          y: Math.max(-1, Math.min(1, pointer.y))
        });
      }
    };

    const handleUp = (e) => {
      const wasDragging = isDragging.current;
      isDragging.current = false;

      if (wasDragging && startPointer.current) {
        const finalStart = startPointer.current;
        // Clamp end pointer as well
        const finalEnd = {
          x: Math.max(-1, Math.min(1, pointer.x)),
          y: Math.max(-1, Math.min(1, pointer.y))
        };

        const bounds = {
          left: Math.min(finalStart.x, finalEnd.x),
          right: Math.max(finalStart.x, finalEnd.x),
          top: Math.max(finalStart.y, finalEnd.y), // Y is inverted in NDC
          bottom: Math.min(finalStart.y, finalEnd.y)
        };

        const batch = [];
        components.forEach(comp => {
          if (!camera) return; // 🛡️ Safety guard for early renders
          const pos = new THREE.Vector3(comp.position_x, comp.position_y, comp.position_z);
          pos.project(camera); // Projects to NDC (-1 to 1)

          // 🚨 CRITICAL FIX: pos.z < 1 ensures components behind the camera 
          // aren't selected by accident. In NDC, z ranges -1 (near) to 1 (far).
          if (pos.z <= 1 &&
            pos.x >= bounds.left && pos.x <= bounds.right &&
            pos.y >= bounds.bottom && pos.y <= bounds.top) {
            batch.push(comp.id);
          }
        });

        if (onBatchSelect) onBatchSelect(batch, e);
      }

      setStart(null);
      setCurrent(null);
      startPointer.current = null;
    };

    canvas.addEventListener('pointerdown', handleDown);
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);

    return () => {
      canvas.removeEventListener('pointerdown', handleDown);
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [camera, size, pointer, gl, components, onBatchSelect]);

  if (!start || !current) return null;

  const left = ((Math.min(start.x, current.x) + 1) / 2) * 100;
  const top = ((1 - Math.max(start.y, current.y)) / 2) * 100;
  const width = (Math.abs(current.x - start.x) / 2) * 100;
  const height = (Math.abs(current.y - start.y) / 2) * 100;

  return (
    <Html fullscreen style={{ pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          left: `${left}%`,
          top: `${top}%`,
          width: `${width}%`,
          height: `${height}%`,
          border: '1.5px dashed #3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          borderRadius: '2px',
          pointerEvents: 'none',
          zIndex: 1000
        }}
      />
      {width > 20 && height > 20 && (
        <div style={{
          position: 'absolute',
          left: left + width / 2,
          top: top - 25,
          transform: 'translateX(-50%)',
          backgroundColor: '#3b82f6',
          color: 'white',
          padding: '2px 8px',
          borderRadius: '99px',
          fontSize: '10px',
          fontWeight: 'bold',
          whiteSpace: 'nowrap'
        }}>
          Release to select
        </div>
      )}
    </Html>
  );
};

// (PlacementGhost and EditorControls remain the same)

const PlacementGhost = ({ placingType, placingTemplate, components, onPlace, viewMode, darkMode, chainAnchor }) => {
  const { raycaster, pointer, camera } = useThree();
  const [snap, setSnap] = useState(null);
  const pointerDownPos = useRef({ x: 0, y: 0 });
  const isPlacingRef = useRef(false); // Debounce placement safely

  const frameCount = useRef(0);
  useFrame(() => {
    if (!camera) return; // 🛡️ Safety guard for early renders

    // Optimization: Only run snapping logic every 3 frames (reduces CPU load by 66%)
    frameCount.current++;
    if (frameCount.current % 3 !== 0) return;

    raycaster.setFromCamera(pointer, camera);
    const result = findSnapPoint(raycaster, components, placingType, viewMode, placingTemplate, chainAnchor);

    if (placingType) {
      // Debug log every ~1 second (60fps / 3 * 20 = 40 frames)
      if (frameCount.current % 60 === 0) {
        console.log(`[PlacementGhost] Snapping for ${placingType}: valid=${result.isValid}, intersecting=${result.isIntersecting}`);
      }
    }

    // Initial snap or significant change
    if (!snap || 
        result.isValid !== snap.isValid ||
        result.isSnappedToSocket !== snap.isSnappedToSocket ||
        result.isIntersecting !== snap.isIntersecting ||
        result.requiresFitting !== snap.requiresFitting ||
        result.position.distanceToSquared(snap.position) > 0.0001) {
      setSnap(result);
    }
  });

  const handlePointerDown = useCallback((e) => {
    // DON'T stop propagation here, so CameraControls can still ORBIT 
    // while we are in placement mode.
    pointerDownPos.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handlePointerUp = useCallback((e) => {
    // ONLY stop propagation if we actually PLACED something, 
    // but better to just let it flow so navigation feels unified.
    const dist = Math.sqrt(
      Math.pow(e.clientX - pointerDownPos.current.x, 2) +
      Math.pow(e.clientY - pointerDownPos.current.y, 2)
    );
    if (dist > 12) return; 

    if (snap && snap.isValid) {
      if (snap.isIntersecting) return;
      if (isPlacingRef.current) return;
      isPlacingRef.current = true;
      setTimeout(() => { isPlacingRef.current = false; }, 400);

      onPlace(
        [snap.position.x, snap.position.y, snap.position.z],
        [snap.rotation.x * (180 / Math.PI), snap.rotation.y * (180 / Math.PI), snap.rotation.z * (180 / Math.PI)],
        {}, 
        snap.targetComponentId,
        snap.targetSocketIndex,
        snap.placingSocketIndex,
        snap.requiresFitting
      );
    }
  }, [snap, onPlace]); 

  // Consolidate rendering to a single stable branch to prevent R3F reconciliation crashes
  return (
    <group>
      {/* Consolidated Background Click Plane directly for better stability */}
      <mesh
        rotation={viewMode === 'front' ? [0, 0, 0] : [-Math.PI / 2, 0, 0]}
        position={viewMode === 'front' ? [0, 0, 0] : [0, -0.001, 0]}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
      >
        <planeGeometry args={[4000, 4000]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {snap && (
        <group>
          {/* --- SECONDARY FITTING GHOST --- */}
          {snap.requiresFitting && (
            <group position={[snap.fittingPosition.x, snap.fittingPosition.y, snap.fittingPosition.z]}>
              <PipeComponent
                component={{
                  id: 'ghost-fitting',
                  component_type: snap.requiresFitting === 'elbow' ? 'elbow' : 'coupling',
                  position_x: 0, position_y: 0, position_z: 0,
                  rotation_x: 0, rotation_y: 0, rotation_z: 0,
                  properties: { material: placingTemplate?.properties?.material || 'pvc' },
                  _isGhost: true,
                  _isFittingGhost: true, 
                  _isValid: true,
                }}
                isSelected={false}
                isGhost={true}
                onSelect={() => { }}
                onUpdate={() => { }}
                viewMode={viewMode}
                darkMode={darkMode}
              />
            </group>
          )}

          {/* --- MAIN COMPONENT GHOST --- */}
          <group
            position={[snap.position.x, snap.position.y, snap.position.z]}
            rotation={[snap.rotation.x, snap.rotation.y, snap.rotation.z]}
          >
            {placingTemplate?.isAssembly && placingTemplate.parts ? (
              placingTemplate.parts.map((p, i) => {
                const assemblyQuat = new THREE.Quaternion().setFromEuler(
                  new THREE.Euler(0, 0, 0) // No extra rotation needed inside the group
                );
                const offsetVec = new THREE.Vector3(p.offset_x || 0, p.offset_y || 0, p.offset_z || 0);
                
                const partLocalRot = new THREE.Euler(
                  (p.rotation_x || 0) * (Math.PI / 180),
                  (p.rotation_y || 0) * (Math.PI / 180),
                  (p.rotation_z || 0) * (Math.PI / 180)
                );
                const partLocalQuat = new THREE.Quaternion().setFromEuler(partLocalRot);
                const partFinalQuat = assemblyQuat.clone().multiply(partLocalQuat);
                const finalRot = new THREE.Euler().setFromQuaternion(partFinalQuat);

                return (
                  <group key={`ghost_ass_${i}`} position={[offsetVec.x, offsetVec.y, offsetVec.z]} rotation={[finalRot.x, finalRot.y, finalRot.z]}>
                    <PipeComponent
                      component={{
                        ...p,
                        id: `ghost_part_${i}`,
                        position_x: 0,
                        position_y: 0,
                        position_z: 0,
                        _isGhost: true,
                        _isValid: snap.isValid && !snap.isIntersecting,
                        _isIntersecting: snap.isIntersecting
                      }}
                      isSelected={false}
                      isGhost={true}
                      onSelect={() => { }}
                      onUpdate={() => { }}
                      viewMode={viewMode}
                      darkMode={darkMode}
                    />
                  </group>
                );
              })
            ) : (
              <PipeComponent
                component={{
                  id: 'ghost',
                  component_type: placingType,
                  position_x: 0, position_y: 0, position_z: 0,
                  rotation_x: 0, rotation_y: 0, rotation_z: 0,
                  connections: [],
                  properties: placingTemplate?.properties || {},
                  _isGhost: true,
                  _isValid: snap.isValid && !snap.isIntersecting,
                  _isSnapped: snap.isSnappedToSocket,
                  _isIntersecting: snap.isIntersecting
                }}
                isSelected={false}
                isGhost={true}
                onSelect={() => { }}
                onUpdate={() => { }}
                viewMode={viewMode}
                darkMode={darkMode}
              />
            )}
          </group>
        </group>
      )}

      {snap && (
        <group position={[snap.snapSocketWorldPos.x, snap.snapSocketWorldPos.y, snap.snapSocketWorldPos.z]}>
          <mesh>
            <sphereGeometry args={[snap.isSnappedToSocket ? 0.35 : 0.15, 16, 16]} />
            <meshBasicMaterial
              color={snap.isIntersecting ? '#f43f5e' : (snap.snapColor === 'orange' ? '#f59e0b' : snap.snapColor === 'yellow' ? '#eab308' : (snap.isSnappedToSocket ? '#10b981' : (snap.isValid ? '#06b6d4' : '#f43f5e')))}
              transparent
              opacity={snap.isSnappedToSocket || snap.isIntersecting ? 0.9 : 0.4}
              depthTest={false} 
            />
          </mesh>
          {snap.isSnappedToSocket && (
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.4, 0.5, 32]} />
              <meshBasicMaterial color={snap.snapColor === 'orange' ? '#f59e0b' : (snap.snapColor === 'yellow' ? '#eab308' : '#10b981')} transparent opacity={0.6} depthTest={false} />
            </mesh>
          )}
          {snap.warning && !isCapture && (
            <Html center position={[0, 1.2, 0]} pointerEvents="none">
              <div className="flex flex-col items-center gap-1">
                <div className={`${snap.snapColor === 'orange' ? 'bg-orange-500' : 'bg-yellow-500'} text-white text-[10px] font-black px-2 py-1 rounded shadow-xl whitespace-nowrap animate-bounce`}>
                  {snap.warning || (snap.requiresFitting === 'elbow' ? 'Elbow Recommended' : null)}
                </div>
                <div className="text-[8px] text-slate-500 font-bold bg-white/80 px-1 rounded">Shift+Click to Force</div>
              </div>
            </Html>
          )}
          {snap.isIntersecting && (
            <Html position={[0, 0.5, 0]} center>
              <div className="bg-red-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter whitespace-nowrap shadow-xl border border-white/20">
                Collision
              </div>
            </Html>
          )}
        </group>
      )}
    </group>
  );
};
const EditorControls = ({ selectedIds, components, onUpdateMultiple, transformMode, isTransforming, onTransform, snapPivot, setIsGroupDragging }) => {
  const { scene, gl } = useThree();
  const pivotRef = useRef();
  const [isReady, setIsReady] = useState(false);
  const domElement = gl?.domElement ?? null;

  // 1. Calculate the center of all selected objects to position the pivot
  useEffect(() => {
    setIsReady(false); // Reset on selection change
    if (!pivotRef.current || selectedIds.length === 0) return;

    const selectedObjects = selectedIds
      .map(id => scene.getObjectByName(id))
      .filter(obj => obj != null);

    if (selectedObjects.length === 0) return;

    // Reset pivot transform before calculating new center
    pivotRef.current.position.set(0, 0, 0);
    pivotRef.current.rotation.set(0, 0, 0);
    pivotRef.current.scale.set(1, 1, 1);
    pivotRef.current.updateMatrixWorld();

    const getSocketWorldPos = (comp) => {
      const conn = comp.connections?.[0]; // Default to first or specific if we can find it
      if (!conn) return null;
      
      const def = COMPONENT_DEFINITIONS[comp.component_type] || COMPONENT_DEFINITIONS['straight'];
      if (!def || !def.sockets[conn.localSocketIdx]) return null;
      
      const localPos = def.sockets[conn.localSocketIdx].position.clone();
      if (comp.component_type === 'straight' || comp.component_type === 'vertical') {
        localPos.y = (localPos.y + 1) * ((comp.properties?.length || 2.0) / 2);
      } else if (comp.component_type === 'tank') {
        const radiusOuter = (comp.properties?.od || 0.3 * (comp.properties?.radiusScale || 1)) / 2;
        const tankRadius = Math.max(radiusOuter * 2, 1.0);
        localPos.y = (localPos.y * (tHeight / 2)) + (tHeight / 2);
        localPos.x *= tankRadius;
        localPos.z *= tankRadius;
      } else if (comp.component_type === 'industrial-tank') {
        const tHeight = comp.properties?.length || 2.0;
        const radiusOuter = (comp.properties?.od || 0.3 * (comp.properties?.radiusScale || 1)) / 2;
        const tankRadius = Math.max(radiusOuter * 2, 1.0);
        localPos.y = (localPos.y * (tHeight / 2)) + (tHeight / 2) + (tankRadius * 1.5);
        localPos.x *= (tankRadius + 0.1);
        localPos.z *= (tankRadius + 0.1);
      } else {
        localPos.multiplyScalar(comp.properties?.radiusScale || 1);
      }
      
      const quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(
        (comp.rotation_x || 0) * (Math.PI / 180),
        (comp.rotation_y || 0) * (Math.PI / 180),
        (comp.rotation_z || 0) * (Math.PI / 180)
      ));
      
      return new THREE.Vector3(comp.position_x, comp.position_y, comp.position_z)
        .add(localPos.applyQuaternion(quat));
    };

    if (selectedObjects.length === 1) {
      const targetId = selectedIds[0];
      const comp = components.find(c => c.id === targetId);
      
      if (snapPivot && snapPivot.id === targetId && transformMode === 'rotate') {
        pivotRef.current.position.copy(snapPivot.worldPos);
      } else if (comp && comp.connections && comp.connections.length > 0 && transformMode === 'rotate') {
        // Use the connected socket as rotation pivot so the joint stays intact
        const worldSocketPos = getSocketWorldPos(comp);
        if (worldSocketPos) pivotRef.current.position.copy(worldSocketPos);
        else {
          const worldPos = new THREE.Vector3();
          selectedObjects[0].getWorldPosition(worldPos);
          pivotRef.current.position.copy(worldPos);
        }
      } else if (comp && transformMode === 'rotate') {
        // 🎯 NO CONNECTIONS: Find the nearest socket of ANY nearby component
        // and use that as the pivot so the pipe rotates around the closest joint
        const compPos = new THREE.Vector3(comp.position_x || 0, comp.position_y || 0, comp.position_z || 0);
        const compQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(
          (comp.rotation_x || 0) * (Math.PI / 180),
          (comp.rotation_y || 0) * (Math.PI / 180),
          (comp.rotation_z || 0) * (Math.PI / 180)
        ));
        const compDef = COMPONENT_DEFINITIONS[comp.component_type] || COMPONENT_DEFINITIONS['straight'];
        
        // Get all socket world positions for this component
        const mySocketWorldPositions = (compDef?.sockets || []).map(s => {
          const lp = s.position.clone();
          if (comp.component_type === 'straight' || comp.component_type === 'vertical') {
            lp.y = (s.position.y + 1) * ((comp.properties?.length || 2.0) / 2);
          } else if (comp.component_type === 'tank') {
            const radiusOuter = (comp.properties?.od || 0.3 * (comp.properties?.radiusScale || 1)) / 2;
            const tankRadius = Math.max(radiusOuter * 2, 1.0);
            const tHeight = comp.properties?.length || 2.0; // Define tHeight here
            lp.y = (s.position.y * (tHeight / 2)) + (tHeight / 2);
            lp.x *= tankRadius;
            lp.z *= tankRadius;
          } else if (comp.component_type === 'industrial-tank') {
            const tHeight = comp.properties?.length || 2.0;
            const radiusOuter = (comp.properties?.od || 0.3 * (comp.properties?.radiusScale || 1)) / 2;
            const tankRadius = Math.max(radiusOuter * 2, 1.0);
            lp.y = (s.position.y * (tHeight / 2)) + (tHeight / 2) + (tankRadius * 1.5);
            lp.x *= (tankRadius + 0.1);
            lp.z *= (tankRadius + 0.1);
          } else {
            lp.multiplyScalar(comp.properties?.radiusScale || 1);
          }
          return lp.applyQuaternion(compQuat).add(compPos.clone());
        });

        // Find the closest socket on any OTHER component to any of our sockets
        let bestDist = Infinity;
        let bestPivotPos = null;
        
        for (const otherComp of components) {
          if (otherComp.id === comp.id) continue;
          const otherDef = COMPONENT_DEFINITIONS[otherComp.component_type];
          if (!otherDef) continue;
          
          const otherPos = new THREE.Vector3(otherComp.position_x || 0, otherComp.position_y || 0, otherComp.position_z || 0);
          const otherQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(
            (otherComp.rotation_x || 0) * (Math.PI / 180),
            (otherComp.rotation_y || 0) * (Math.PI / 180),
            (otherComp.rotation_z || 0) * (Math.PI / 180)
          ));
          
          for (const os of otherDef.sockets) {
            const olp = os.position.clone();
            if (otherComp.component_type === 'straight' || otherComp.component_type === 'vertical') {
              olp.y = (os.position.y + 1) * ((otherComp.properties?.length || 2.0) / 2);
            } else if (otherComp.component_type === 'tank') {
              const radiusOuter = (otherComp.properties?.od || 0.3 * (otherComp.properties?.radiusScale || 1)) / 2;
              const tankRadius = Math.max(radiusOuter * 2, 1.0);
              const tHeight = otherComp.properties?.length || 2.0; // Define tHeight here
              olp.y = (os.position.y * (tHeight / 2)) + (tHeight / 2);
              olp.x *= tankRadius;
              olp.z *= tankRadius;
            } else if (otherComp.component_type === 'industrial-tank') {
              const tHeight = otherComp.properties?.length || 2.0;
              const radiusOuter = (otherComp.properties?.od || 0.3 * (otherComp.properties?.radiusScale || 1)) / 2;
              const tankRadius = Math.max(radiusOuter * 2, 1.0);
              olp.y = (os.position.y * (tHeight / 2)) + (tHeight / 2) + (tankRadius * 1.5);
              olp.x *= (tankRadius + 0.1);
              olp.z *= (tankRadius + 0.1);
            } else {
              olp.multiplyScalar(otherComp.properties?.radiusScale || 1);
            }
            const otherSocketWorld = olp.applyQuaternion(otherQuat).add(otherPos.clone());
            
            for (const mySocketWorld of mySocketWorldPositions) {
              const dist = mySocketWorld.distanceTo(otherSocketWorld);
              if (dist < bestDist && dist < 0.5) { // Within 0.5m = likely connected
                bestDist = dist;
                bestPivotPos = mySocketWorld.clone();
              }
            }
          }
        }
        
        if (bestPivotPos) {
          pivotRef.current.position.copy(bestPivotPos);
        } else {
          // Truly unconnected — use component origin
          const worldPos = new THREE.Vector3();
          selectedObjects[0].getWorldPosition(worldPos);
          pivotRef.current.position.copy(worldPos);
        }
      } else {
        const worldPos = new THREE.Vector3();
        selectedObjects[0].getWorldPosition(worldPos);
        pivotRef.current.position.copy(worldPos);
      }
    } else {
      // ASSEMBLY SMART PIVOT: Look for a single connection to the static world
      const selectedComps = components.filter(c => selectedIds.includes(c.id));
      const unselectedComps = components.filter(c => !selectedIds.includes(c.id));
      const externalConnections = [];
      
      selectedComps.forEach(comp => {
        (comp.connections || []).forEach(conn => {
          if (!selectedIds.includes(conn.targetId)) {
            externalConnections.push({ comp, conn });
          }
        });
      });

      if (externalConnections.length === 1 && transformMode === 'rotate') {
         // Found exactly one explicit anchor point for the whole group!
         const { comp, conn } = externalConnections[0];
         const def = COMPONENT_DEFINITIONS[comp.component_type] || COMPONENT_DEFINITIONS['straight'];
         const localPos = def.sockets[conn.localSocketIdx].position.clone();
         if (comp.component_type === 'straight' || comp.component_type === 'vertical') {
           localPos.y = (localPos.y + 1) * ((comp.properties?.length || 2.0) / 2);
         } else if (comp.component_type === 'tank') {
           const radiusOuter = (comp.properties?.od || 0.3 * (comp.properties?.radiusScale || 1)) / 2;
           const tankRadius = Math.max(radiusOuter * 2, 1.0);
           localPos.y = (localPos.y * (tHeight / 2)) + (tHeight / 2);
           localPos.x *= tankRadius;
           localPos.z *= tankRadius;
         } else if (comp.component_type === 'industrial-tank') {
           const tHeight = comp.properties?.length || 2.0;
           const radiusOuter = (comp.properties?.od || 0.3 * (comp.properties?.radiusScale || 1)) / 2;
           const tankRadius = Math.max(radiusOuter * 2, 1.0);
           localPos.y = (localPos.y * (tHeight / 2)) + (tHeight / 2) + (tankRadius * 1.5);
           localPos.x *= (tankRadius + 0.1);
           localPos.z *= (tankRadius + 0.1);
         } else {
           localPos.multiplyScalar(comp.properties?.radiusScale || 1);
         }
         const quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(
           (comp.rotation_x || 0) * (Math.PI / 180),
           (comp.rotation_y || 0) * (Math.PI / 180),
           (comp.rotation_z || 0) * (Math.PI / 180)
         ));
         const worldSocketPos = new THREE.Vector3(comp.position_x, comp.position_y, comp.position_z)
           .add(localPos.applyQuaternion(quat));
         
         pivotRef.current.position.copy(worldSocketPos);
      } else if (transformMode === 'rotate') {
         // 🎯 NO EXPLICIT CONNECTION: Find nearest socket of unselected world
         // We do this by collecting all sockets from the selection and checking distance
         // against all sockets of the non-selected world to find the "root hinge".
         let bestDist = Infinity;
         let bestPivotPos = null;

         for (const comp of selectedComps) {
           const compPos = new THREE.Vector3(comp.position_x || 0, comp.position_y || 0, comp.position_z || 0);
           const compQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(
             (comp.rotation_x || 0) * (Math.PI / 180),
             (comp.rotation_y || 0) * (Math.PI / 180),
             (comp.rotation_z || 0) * (Math.PI / 180)
           ));
           const compDef = COMPONENT_DEFINITIONS[comp.component_type] || COMPONENT_DEFINITIONS['straight'];
           
           const mySocketWorldPositions = (compDef?.sockets || []).map(s => {
             const lp = s.position.clone();
             if (comp.component_type === 'straight' || comp.component_type === 'vertical') {
               lp.y = (s.position.y + 1) * ((comp.properties?.length || 2.0) / 2);
             } else {
               lp.multiplyScalar(comp.properties?.radiusScale || 1);
             }
             return lp.applyQuaternion(compQuat).add(compPos.clone());
           });

           for (const otherComp of unselectedComps) {
             const otherDef = COMPONENT_DEFINITIONS[otherComp.component_type];
             if (!otherDef) continue;
             
             const otherPos = new THREE.Vector3(otherComp.position_x || 0, otherComp.position_y || 0, otherComp.position_z || 0);
             const otherQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(
               (otherComp.rotation_x || 0) * (Math.PI / 180),
               (otherComp.rotation_y || 0) * (Math.PI / 180),
               (otherComp.rotation_z || 0) * (Math.PI / 180)
             ));
             
             for (const os of otherDef.sockets) {
               const olp = os.position.clone();
               if (otherComp.component_type === 'straight' || otherComp.component_type === 'vertical') {
                 olp.y = (os.position.y + 1) * ((otherComp.properties?.length || 2.0) / 2);
               } else {
                 olp.multiplyScalar(otherComp.properties?.radiusScale || 1);
               }
               const otherSocketWorld = olp.applyQuaternion(otherQuat).add(otherPos.clone());
               
               for (const mySocketWorld of mySocketWorldPositions) {
                 const dist = mySocketWorld.distanceTo(otherSocketWorld);
                 if (dist < bestDist && dist < 0.5) { // Within 0.5m = connected
                   bestDist = dist;
                   bestPivotPos = mySocketWorld.clone();
                 }
               }
             }
           }
         }

         if (bestPivotPos) {
           pivotRef.current.position.copy(bestPivotPos);
         } else {
           // Fallback if truly floating: use bounding box center
           const box = new THREE.Box3();
           selectedObjects.forEach(obj => box.expandByObject(obj));
           const center = new THREE.Vector3();
           box.getCenter(center);
           pivotRef.current.position.copy(center);
         }
      } else {
         const box = new THREE.Box3();
         selectedObjects.forEach(obj => box.expandByObject(obj));
         const center = new THREE.Vector3();
         box.getCenter(center);
         pivotRef.current.position.copy(center);
      }
    }

    pivotRef.current.updateMatrixWorld();

    // Force a re-render to ensure TransformControls sees the ref
    setIsReady(true);
  }, [selectedIds, scene, transformMode, snapPivot]);

  const [transformInfo, setTransformInfo] = useState({
    pos: { x: 0, y: 0, z: 0 },
    rot: { x: 0, y: 0, z: 0 },
    isIntersecting: false
  });

  if (selectedIds.length === 0) return null;

  return (
    <>
      <group ref={pivotRef} />
      {isReady && pivotRef.current && (
        <TransformControls
          // Removed makeDefault to prevent conflict with CameraControls
          // and ensure the camera controls don't get permanently hijacked
          object={pivotRef.current}
          mode={transformMode}
          size={0.6}
          rotationSnap={Math.PI / 4} // 45 degrees
          onMouseDown={() => {
            isTransforming.current = true;
            setIsGroupDragging?.(true); // Isolate components from React state updates
            const pivot = pivotRef.current;
            if (!pivot) return;

            selectedIds.forEach(id => {
              const obj = scene.getObjectByName(id);
              if (obj) {
                obj.updateMatrixWorld();
                pivot.attach(obj);
              }
            });
          }}
          onChange={() => {
            if (!pivotRef.current) return;
              const rot = pivotRef.current.rotation;
              const pos = pivotRef.current.position;
              setTransformInfo({
                pos: { x: pos.x.toFixed(2), y: pos.y.toFixed(2), z: pos.z.toFixed(2) },
                rot: {
                  x: Math.round((rot.x * 180) / Math.PI),
                  y: Math.round((rot.y * 180) / Math.PI),
                  z: Math.round((rot.z * 180) / Math.PI)
                }
              });
              if (onTransform && pivotRef.current.children.length > 0) {
                const firstChild = pivotRef.current.children[0];
                // Ensure world matrix is fresh after pivot move
                pivotRef.current.updateMatrixWorld();
                firstChild.updateMatrixWorld();

                const worldQuat = new THREE.Quaternion();
                firstChild.getWorldQuaternion(worldQuat);
                const worldRot = new THREE.Euler().setFromQuaternion(worldQuat);

                onTransform({
                  x: Math.round((worldRot.x * 180) / Math.PI),
                  y: Math.round((worldRot.y * 180) / Math.PI),
                  z: Math.round((worldRot.z * 180) / Math.PI)
                });
              }

              // --- SNAP ON DRAG ---
              if (transformMode === 'translate' && selectedIds.length > 0) {
                const snap = findSnapForTransform(
                  selectedIds,
                  components,
                  pivotRef.current.position,
                  pivotRef.current.rotation,
                  false
                );

                if (snap) {
                  pivotRef.current.position.copy(snap.position);
                  pivotRef.current.updateMatrixWorld();
                  setTransformInfo(prev => ({ ...prev, isIntersecting: snap.isIntersecting }));
                } else {
                  setTransformInfo(prev => ({ ...prev, isIntersecting: false }));
                }
              }
          }}
          onMouseUp={() => {
            const pivot = pivotRef.current;
            if (!pivot) return;

            const updates = [];
            // Use pivot.children to find all attached objects, or iterate selectedIds
            // Iterate in a clone of the children array since scene.attach removes them from pivot during iteration
            const children = [...pivot.children];

            children.forEach(obj => {
              const id = obj.name;
              const comp = components.find(c => c.id === id);
              if (comp) {
                // Return to scene before reading world position
                scene.attach(obj);
                obj.updateMatrixWorld();

                updates.push({
                  ...comp,
                  position_x: obj.position.x,
                  position_y: obj.position.y,
                  position_z: obj.position.z,
                  rotation_x: obj.rotation.x * (180 / Math.PI),
                  rotation_y: obj.rotation.y * (180 / Math.PI),
                  rotation_z: obj.rotation.z * (180 / Math.PI),
                });
              } else {
                // If it's not a component we track, still move it back to scene but don't add to updates
                scene.attach(obj);
              }
            });

            // If some selectedIds were NOT children of pivot for some reason, re-attach them just in case
            selectedIds.forEach(id => {
              const obj = scene.getObjectByName(id);
              if (obj && obj.parent === pivot) {
                scene.attach(obj);
              }
            });

            if (updates.length > 0) {
              onUpdateMultiple(updates);
            }
            // Keep the info visible after drop

            // Critical: Keep isTransforming true for a bit to swallow the click leakage
            // This prevents the "selection shift" to the component under the mouse
            setTimeout(() => {
              isTransforming.current = false;
              setIsGroupDragging?.(false); // Restore React state authority
            }, 50);
          }}
        />
      )}
      {pivotRef.current && (
        <Html
          position={[0, 0]}
          calculatePosition={() => [0, 0]}
          style={{
            position: 'absolute',
            bottom: '20px',
            right: '20px',
            transform: 'none',
            pointerEvents: 'none'
          }}
          zIndexRange={[2000, 3000]}
        >
          <div className="bg-slate-900/90 backdrop-blur-md text-white px-4 py-3 rounded-2xl text-[10px] font-bold shadow-2xl border border-white/20 whitespace-nowrap animate-in slide-in-from-bottom-4 duration-300 flex flex-col gap-3 min-w-[180px]">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <div className="flex items-center gap-2">
                <RotateCw size={12} className={`${transformInfo.isIntersecting ? 'text-red-500' : 'text-blue-400'} animate-spin-slow`} />
                <span className={`${transformInfo.isIntersecting ? 'text-red-500' : 'text-blue-400'} font-black tracking-tight uppercase`}>
                  {transformInfo.isIntersecting ? 'Collision Alert' : 'Axis Monitor'}
                </span>
              </div>
              <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase ${transformInfo.isIntersecting ? 'bg-red-500/20 text-red-500' : 'bg-white/5 text-slate-500'}`}>
                {selectedIds.length === 1 ? 'Single' : 'Batch'}
              </span>
            </div>

            <div className="flex flex-col gap-2.5">
              {/* Position Row */}
              <div className="flex flex-col gap-1">
                <span className="text-[8px] text-slate-500 font-black uppercase tracking-widest pl-1">Position (m)</span>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-white/5 rounded-lg px-2 py-1 flex items-center gap-1.5 border border-white/5">
                    <span className="text-red-500/80 font-black text-[8px]">X</span>
                    <span className="font-mono text-[11px]">{transformInfo.pos.x}</span>
                  </div>
                  <div className="bg-white/5 rounded-lg px-2 py-1 flex items-center gap-1.5 border border-white/5">
                    <span className="text-emerald-500/80 font-black text-[8px]">Y</span>
                    <span className="font-mono text-[11px]">{transformInfo.pos.y}</span>
                  </div>
                  <div className="bg-white/5 rounded-lg px-2 py-1 flex items-center gap-1.5 border border-white/5">
                    <span className="text-blue-500/80 font-black text-[8px]">Z</span>
                    <span className="font-mono text-[11px]">{transformInfo.pos.z}</span>
                  </div>
                </div>
              </div>

              {/* Rotation Row */}
              <div className="flex flex-col gap-1">
                <span className="text-[8px] text-slate-500 font-black uppercase tracking-widest pl-1">Rotation (deg)</span>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-white/5 rounded-lg px-2 py-1 flex items-center gap-1.5 border border-white/5">
                    <span className="text-red-500/80 font-black text-[8px]">X</span>
                    <span className="font-mono text-[11px]">{transformInfo.rot.x}°</span>
                  </div>
                  <div className="bg-white/5 rounded-lg px-2 py-1 flex items-center gap-1.5 border border-white/5">
                    <span className="text-emerald-500/80 font-black text-[8px]">Y</span>
                    <span className="font-mono text-[11px]">{transformInfo.rot.y}°</span>
                  </div>
                  <div className="bg-white/5 rounded-lg px-2 py-1 flex items-center gap-1.5 border border-white/5">
                    <span className="text-blue-500/80 font-black text-[8px]">Z</span>
                    <span className="font-mono text-[11px]">{transformInfo.rot.z}°</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Html>
      )}
    </>
  );
};

// ---------------------------------------------------------
// COMPONENT: ViewportLabel (Draggable Handle)
// ---------------------------------------------------------
function ViewportLabel({ text, color = 'bg-slate-900/5', textColor = 'text-slate-500', onDragStart, viewId, darkMode, onViewChange }) {
  const dynamicColor = darkMode ? 'bg-slate-800/80 border-slate-700 text-slate-400' : `${color} border-white/50 ${textColor}`;
  return (
    <div
      draggable={!!onDragStart}
      onDragStart={(e) => onDragStart && onDragStart(e, viewId)}
      data-html2canvas-ignore="true"
      className={`absolute top-4 left-4 z-20 px-3 py-1 ${dynamicColor} backdrop-blur-md rounded-lg text-[9px] font-black uppercase tracking-widest border shadow-sm transition-all ${onDragStart ? 'cursor-grab active:cursor-grabbing hover:scale-105' : 'pointer-events-none'} select-none`}
    >
      <div className="flex items-center gap-2">
        <span>{text}</span>
        {onDragStart && (
          <div className="flex items-center">
            <svg className="w-2 h-2 opacity-30 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
            </svg>
            <div className="relative flex items-center justify-center w-4 h-4 hover:bg-white/10 rounded">
              <ChevronDown size={10} className="opacity-60" />
              {/* 🎯 Hidden View Selector only over the arrow */}
              {onViewChange && (
                <select
                  className="absolute inset-0 opacity-0 cursor-pointer pointer-events-auto w-full h-full"
                  value={viewId}
                  onChange={(e) => onViewChange(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                >
                  {Object.entries(VIEW_CONFIGS).map(([id, cfg]) => (
                    <option key={id} value={id}>{cfg.label}</option>
                  ))}
                </select>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------
// COMPONENT: StableResetButton (External to Canvas)
// ---------------------------------------------------------
function StableResetButton({ onReset, darkMode }) {
  return (
    <div className="absolute top-3 right-3 z-30 pointer-events-auto" data-html2canvas-ignore="true">
      <button
        onClick={(e) => { e.stopPropagation(); onReset(); }}
        className={`p-2 rounded-lg shadow-md border transition-all active:scale-95 flex items-center gap-2 group ${darkMode ? 'bg-slate-800 border-slate-700 text-slate-400 hover:text-blue-400 hover:bg-slate-700' : 'bg-white border-slate-200 text-slate-500 hover:text-blue-600 hover:bg-blue-50'}`}
        title="Reset View Camera"
      >
        <RotateCcw size={16} className="group-hover:rotate-180 transition-transform duration-500" />
        <span className="text-[10px] font-black uppercase hidden group-hover:inline-block">Reset</span>
      </button>
    </div>
  );
}

function ZoomControls({ onZoomIn, onZoomOut, darkMode }) {
  return (
    <div className="absolute bottom-3 right-3 z-30 pointer-events-auto flex flex-col gap-2" data-html2canvas-ignore="true">
      <button
        onClick={(e) => { e.stopPropagation(); onZoomIn(); }}
        className={`p-2.5 rounded-lg shadow-md border transition-all active:scale-95 ${darkMode ? 'bg-slate-800 border-slate-700 text-slate-400 hover:text-blue-400' : 'bg-white border-slate-200 text-slate-500 hover:text-blue-600'}`}
        title="Zoom In"
      >
        <Plus size={18} strokeWidth={3} />
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onZoomOut(); }}
        className={`p-2.5 rounded-lg shadow-md border transition-all active:scale-95 ${darkMode ? 'bg-slate-800 border-slate-700 text-slate-400 hover:text-blue-400' : 'bg-white border-slate-200 text-slate-500 hover:text-blue-600'}`}
        title="Zoom Out"
      >
        <Minus size={18} strokeWidth={3} />
      </button>
    </div>
  );
}

// ---------------------------------------------------------
// COMPONENT: ViewportCameraControls
// ---------------------------------------------------------
const ViewportCameraControls = ({ viewMode, setResetHandler, setZoomHandlers, selectedIds, components, isLocked }) => {
  const { camera, size } = useThree();
  const prevSelectedId = useRef(null);
  const controlsRef = useRef();

  const handleReset = useCallback((fitToComponents = false, animate = true) => {
    if (!controlsRef.current) return;

    const config = VIEW_CONFIGS[viewMode];
    if (!config) return;

    // ── Step 0: Restore Canonical "Up" Vector ───────────────────
    if (config.defaultUp) {
      camera.up.set(config.defaultUp[0], config.defaultUp[1], config.defaultUp[2]);
    }

    if (fitToComponents && components && components.length > 0) {
      const box = new THREE.Box3();

      components.forEach((c) => {
        const pos = new THREE.Vector3(c.position_x || 0, c.position_y || 0, c.position_z || 0);
        const type = c.component_type || 'straight';
        const def = COMPONENT_DEFINITIONS[type] || COMPONENT_DEFINITIONS['straight'];
        
        box.expandByPoint(pos);
        if (def && def.sockets) {
          const quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(
            (c.rotation_x || 0) * (Math.PI / 180),
            (c.rotation_y || 0) * (Math.PI / 180),
            (c.rotation_z || 0) * (Math.PI / 180)
          ));
          
          def.sockets.forEach(socket => {
            const locPos = socket.position.clone();
            if (type === 'straight' || type === 'vertical') {
               locPos.y = (locPos.y + 1) * ((c.properties?.length || 2.0) / 2);
            } else {
               locPos.multiplyScalar(c.properties?.radiusScale || 1);
            }
            const worldSocketPos = pos.clone().add(locPos.applyQuaternion(quat));
            box.expandByPoint(worldSocketPos);
          });
        }
        const radius = (c.properties?.od || 0.3) / 2;
        box.expandByScalar(radius + 0.05); 
      });

      if (!box.isEmpty()) {
        controlsRef.current.fitToBox(box, animate, {
          paddingTop: 10,    // 🎯 MINIMAL PADDING for maximum diagram size
          paddingBottom: 10,
          paddingLeft: 10,
          paddingRight: 10
        });
      }
    } else {
      const camPos = new THREE.Vector3().fromArray(config.defaultPos);
      controlsRef.current.setLookAt(camPos.x, camPos.y, camPos.z, 0, 0, 0, animate);
      if (config.camera === 'ortho') {
        controlsRef.current.zoomTo(config.defaultZoom || 15, animate);
      }
    }
  }, [viewMode, components, camera, size]);

  // Sync camera when selection changes
  useEffect(() => {
    const selectedId = selectedIds[0];
    // Guard: Prevent auto-jump if the camera is LOCKED
    if (isLocked) {
      prevSelectedId.current = selectedId;
      return;
    }

    // Only jump if the selection actually CHANGED, not if a selected item is being moved
    if (selectedId && selectedId !== prevSelectedId.current && components && controlsRef.current) {
      const selectedComp = components.find(c => c.id === selectedId);
      if (selectedComp) {
        const tx = selectedComp.position_x || 0;
        const ty = selectedComp.position_y || 0;
        const tz = selectedComp.position_z || 0;

        // In 2D views, moving the target effectively centers the object
        if (viewMode === 'top') {
          controlsRef.current.setLookAt(tx, 100, tz, tx, ty, tz, true);
        } else if (viewMode === 'front') {
          controlsRef.current.setLookAt(tx, ty, 100, tx, ty, tz, true);
        } else if (controlsRef.current.moveTo) {
          controlsRef.current.moveTo(tx, ty, tz, true);
        }
      }
    }
    prevSelectedId.current = selectedId;
  }, [selectedIds, components, viewMode]);

  useEffect(() => {
    console.log(`[CameraControls] Registering handlers for ${viewMode}`);
    setResetHandler(handleReset, camera); // 🎯 Pass camera for projection utility
    if (setZoomHandlers) {
      setZoomHandlers({
        in: () => {
          const controls = controlsRef.current;
          if (!controls || !controls.camera) return;
          console.log(`[ZoomIn] ${viewMode}, current zoom:`, controls.camera.zoom);
          controls.zoomTo(controls.camera.zoom * 1.5, true);
        },
        out: () => {
          const controls = controlsRef.current;
          if (!controls || !controls.camera) return;
          console.log(`[ZoomOut] ${viewMode}, current zoom:`, controls.camera.zoom);
          controls.zoomTo(controls.camera.zoom / 1.5, true);
        }
      });
    }
  }, [handleReset, setResetHandler, setZoomHandlers, viewMode]);

  // ── Auto-fit on mount and on large project load ──────────────
  const prevCountRef = useRef(0);
  useEffect(() => {
    const count = components ? components.length : 0;
    const prevCount = prevCountRef.current;
    prevCountRef.current = count;

    // Fit when: first mount has components OR a sudden large jump in count (project loaded)
    const isFirstLoad = prevCount === 0 && count > 0;
    const isBigJump = count - prevCount > 3; // more than 3 components added at once = project open
    if ((isFirstLoad || isBigJump) && controlsRef.current) {
      const timer = setTimeout(() => {
        handleReset(true, true);
      }, 350); // wait for Three.js to initialize camera controls
      return () => clearTimeout(timer);
    }
  }, [components, handleReset]);

  // ── Mouse Button Configuration ──────────────────────────────
  const mouseButtons = useMemo(() => {
    if (isLocked) return { left: 0, middle: 0, right: 0, wheel: 0 }; // Disable layout movement
    if (viewMode !== 'iso') return { left: 2, middle: 2, right: 2, wheel: 32 }; // Flat views: Left click MUST PAN (Truck), not rotate. Wheel: ZOOM (32)
    return { left: 1, middle: 2, right: 2, wheel: 32 }; // Iso View: Left click rotates. Wheel: ZOOM (32)
  }, [viewMode, isLocked]);

  return (
    <>
      <CameraControls
        ref={controlsRef}
        makeDefault={true}
        dollyToCursor={true}
        mouseButtons={mouseButtons}
        enableRotate={!isLocked && viewMode === 'iso'}
        enabled={true}
        minZoom={0.01}
        maxZoom={500}
      />
    </>
  );
};


// ---------------------------------------------------------
// COMPONENT: TitleBlock
// ---------------------------------------------------------


const Scene3D = forwardRef(function Scene3D({
  components, selectedIds, onSelectComponent, onBatchSelect, placingType, placingTemplate, onPlaceComponent, onCancelPlacement, onUpdateComponent, onUpdateMultiple, transformMode, designName, darkMode, isLocked, suppressLabels = false, isCapturing = false,
  connectionMode = false, selectedSockets = [], onSocketClick, snapPivot, showColorDifferentiation, showSketchMode, systemConfig, showFlow = false, onShowHydroStats
}, ref) {

  const [viewLayout, setViewLayout] = useState(['iso', 'front', 'top']);
  const resetHandlers = useRef({});
  const zoomHandlers = useRef({});
  const captureHandlers = useRef({});
  const [isCapturingInternal, setIsCapturingInternal] = useState(false);
  const [activeCaptureViewId, setActiveCaptureViewId] = useState('iso'); // 🎯 Single active view for export
  const [captureStyle, setCaptureStyle] = useState('color');
  const [realTimeTransform, setRealTimeTransform] = useState(null);
  const [captureKey, setCaptureKey] = useState(0); 
  const [isGroupDragging, setIsGroupDragging] = useState(false); 
  const [isWorkspaceLoading, setIsWorkspaceLoading] = useState(true);

  // Eliminate staggered loading visually
  useEffect(() => {
    // A concise 800ms gives all 3 Canvas viewports time to mount and run their first `fitToBox` parallelly
    const timer = setTimeout(() => {
      setIsWorkspaceLoading(false);
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  // Memoized Tagging & Clash Detection Logic
  const taggedComponents = useMemo(() => {
    const typeCounts = {};
    const boxes = [];

    // 1. First pass: Calculate tags and bounding boxes
    const basicTagged = components.map(c => {
      const type = c.component_type || 'straight';
      const idx = (typeCounts[type] || 0);
      typeCounts[type] = idx + 1;

      // Calculate Bounding Box for clash detection
      const box = new THREE.Box3();
      const pos = new THREE.Vector3(c.position_x || 0, c.position_y || 0, c.position_z || 0);
      const length = c.properties?.length || 2;
      const radius = (c.properties?.od || 0.3) / 2;

      box.expandByPoint(pos);
      if (type === 'straight' || type === 'vertical') {
        const rotX = (c.rotation_x || 0) * (Math.PI / 180);
        const rotY = (c.rotation_y || 0) * (Math.PI / 180);
        const rotZ = (c.rotation_z || 0) * (Math.PI / 180);
        const direction = new THREE.Vector3(0, 1, 0).applyEuler(new THREE.Euler(rotX, rotY, rotZ));
        const endPoint = pos.clone().add(direction.multiplyScalar(length));
        box.expandByPoint(endPoint);
      }
      box.expandByScalar(radius * 0.9); // Slightly shrink to avoid false positives at snug connections
      boxes.push({ id: c.id, box });

      const def = COMPONENT_DEFINITIONS[type] || COMPONENT_DEFINITIONS['straight'];

      return {
        ...c,
        _tag: getComponentTag(type, idx, systemConfig?.NamingPrefix),
        _label: def.label || type.charAt(0).toUpperCase() + type.slice(1),
        _isClashing: false
      };
    });

    // 2. Second pass: Check for intersections (clashes)
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        if (boxes[i].box.intersectsBox(boxes[j].box)) {
          // Verify it's not a standard connection (shared sockets are handled by snapping logic, 
          // but for basic AABB we check if boxes are significantly overlapping)
          basicTagged[i]._isClashing = true;
          basicTagged[j]._isClashing = true;
        }
      }
    }

    return basicTagged;
  }, [components]);

  const projectStats = useMemo(() => {
    if (!components || components.length === 0) return null;
    const globalBox = new THREE.Box3();
    components.forEach((c) => {
      const pos = new THREE.Vector3(c.position_x || 0, c.position_y || 0, c.position_z || 0);
      globalBox.expandByPoint(pos);
      const type = c.component_type || 'straight';
      if (type === 'straight' || type === 'vertical' || type === 'cylinder') {
          const length = c.properties?.length || 2;
          const rotX = (c.rotation_x || 0) * (Math.PI / 180);
          const rotY = (c.rotation_y || 0) * (Math.PI / 180);
          const rotZ = (c.rotation_z || 0) * (Math.PI / 180);
          const direction = new THREE.Vector3(0, 1, 0).applyEuler(new THREE.Euler(rotX, rotY, rotZ));
          globalBox.expandByPoint(pos.clone().add(direction.multiplyScalar(length)));
      } else if (type === 'tank' || type === 'industrial-tank') {
          const radius = Math.max((c.properties?.od || 0.3) * 2, 1.0);
          const h = c.properties?.length || 5;
          globalBox.expandByScalar(radius);
          globalBox.expandByPoint(pos.clone().add(new THREE.Vector3(0, h, 0)));
      }
    });

    const size = new THREE.Vector3();
    globalBox.getSize(size);
    const center = new THREE.Vector3();
    globalBox.getCenter(center);
    return {
      width: size.x.toFixed(2),
      height: size.y.toFixed(2),
      depth: size.z.toFixed(2),
      totalParts: components.length,
      // 🎯 Raw objects for internal engineering math
      box: globalBox,
      center: center,
      size: size
    };
  }, [components]);

  // Update real-time display when selection or mode changes
  useEffect(() => {
    if (selectedIds.length === 1) {
      const comp = taggedComponents.find(c => c.id === selectedIds[0]);
      if (comp) {
        if (transformMode === 'translate') {
          setRealTimeTransform({
            x: parseFloat((comp.position_x || 0).toFixed(2)),
            y: parseFloat((comp.position_y || 0).toFixed(2)),
            z: parseFloat((comp.position_z || 0).toFixed(2))
          });
        } else {
          setRealTimeTransform({
            x: Math.round(comp.rotation_x || 0),
            y: Math.round(comp.rotation_y || 0),
            z: Math.round(comp.rotation_z || 0)
          });
        }
      }
    } else {
      setRealTimeTransform(null);
    }
  }, [selectedIds, taggedComponents, transformMode]);

  // Expose resetAllViews() and captureViews() to parent (for PDF export)
  const captureHandlersColor = useRef({});
  const captureHandlersPencil = useRef({});
  const captureHandlersColorSketch = useRef({});
  const captureHandlersReference = useRef({}); // 🎯 Storage for cameras used in projection

  useImperativeHandle(ref, () => ({
    resetAllViews: () => {
      Object.values(resetHandlers.current).forEach(fn => fn?.(true));
    },
    captureViews: async (requestedViewIds = null, requestedStyles = null) => {
      console.log('Pipe3D Export: Starting parallel capture pass...');
      const allImages = {};
      const stylesToCapture = requestedStyles || ['pencil']; 
      
      setIsCapturingInternal(true); 

      const performParallelCapture = async (viewIds, style) => {
        const images = {};
        const vIds = viewIds || ['iso', 'front', 'top', 'right', 'left', 'back', 'bottom'];
        
        setCaptureStyle(style);
        
        // 🛡️ WebGL Context Safety & Speed: Reusing single canvas
        // By using a static key in the renderer, React reuses the same Canvas instance!
        for (let idx = 0; idx < vIds.length; idx++) {
          const vid = vIds[idx];
          setActiveCaptureViewId(vid);
          
          if (idx === 0 || style !== requestedStyles[0]) {
             // ─── CRITICAL: Wait longer for initial mount and texture loading in hidden div ───
             await new Promise(r => setTimeout(r, 1500)); 
          } else {
             // Just need a short delay for camera to update in the existing single canvas
             await new Promise(r => setTimeout(r, 100));
          }
          
          // Wait for multiple frames to ensure the new mount/camera state has been painted to the buffer
          await new Promise(r => requestAnimationFrame(r));
          await new Promise(r => requestAnimationFrame(r));
          await new Promise(r => requestAnimationFrame(r));
          await new Promise(r => setTimeout(r, 200)); 
          await new Promise(r => requestAnimationFrame(r));

          // 🎯 PROACTIVE SYNC: Wait for the new camera reference to be registered after re-mounting
          let cam = null;
          for (let attempt = 0; attempt < 10; attempt++) {
              cam = captureHandlersReference.current[vid];
              if (cam) break;
              await new Promise(r => setTimeout(r, 100)); // Poll for ref registration
          }

          if (cam && projectStats && projectStats.box) {
             // ─── DYNAMIC "FIT-TO-VIEW" ENGINE ───
             const config = VIEW_CONFIGS[vid];
             if (config) {
                if (config.defaultUp) cam.up.set(...config.defaultUp);
                const { box: pBox, center: pCenter, size: pSize } = projectStats;
                
                // 1. Position camera far enough to see the whole box
                const viewDir = new THREE.Vector3(...config.defaultPos).normalize();
                const maxDim = Math.max(pSize.x, pSize.y, pSize.z);
                const camDistance = maxDim * 5; // Very far to avoid near-plane clipping
                cam.position.copy(pCenter).add(viewDir.multiplyScalar(camDistance));
                cam.lookAt(pCenter);
                cam.near = 0.1;
                cam.far = camDistance * 10;
                
                if (cam.isOrthographicCamera) {
                   // 2. Calculate View-Aligned Bounding Box (VABB)
                   // We need to project the 8 corners of the Box3 into camera space to find required zoom
                   const corners = [
                     new THREE.Vector3(pBox.min.x, pBox.min.y, pBox.min.z),
                     new THREE.Vector3(pBox.min.x, pBox.min.y, pBox.max.z),
                     new THREE.Vector3(pBox.min.x, pBox.max.y, pBox.min.z),
                     new THREE.Vector3(pBox.min.x, pBox.max.y, pBox.max.z),
                     new THREE.Vector3(pBox.max.x, pBox.min.y, pBox.min.z),
                     new THREE.Vector3(pBox.max.x, pBox.min.y, pBox.max.z),
                     new THREE.Vector3(pBox.max.x, pBox.max.y, pBox.min.z),
                     new THREE.Vector3(pBox.max.x, pBox.max.y, pBox.max.z)
                   ];
                   
                   cam.updateMatrixWorld();
                   const viewMatrix = cam.matrixWorldInverse;
                   let minVU = Infinity, maxVU = -Infinity;
                   let minVV = Infinity, maxVV = -Infinity;
                   
                   corners.forEach(c => {
                      const v = c.clone().applyMatrix4(viewMatrix);
                      minVU = Math.min(minVU, v.x); maxVU = Math.max(maxVU, v.x);
                      minVV = Math.min(minVV, v.y); maxVV = Math.max(maxVV, v.y);
                   });
                   
                   const worldW = maxVU - minVU;
                   const worldH = maxVV - minVV;
                   
                   // 3. Dynamic Zoom: Correct for R3F normalized Ortho bounds
                   const canvasW = 2040; const canvasH = 1200;
                   const aspect = canvasW / canvasH;
                   
                   // Normalized bounds are typically [-aspect, aspect, 1, -1]
                   // worldX * zoom = frustumX. To fit worldW: zoom = 2 * aspect / worldW
                   const zoomX = (2 * aspect) / worldW; 
                   const zoomY = 2 / worldH;
                   
                   // Use more restrictive zoom and add safety margin
                   cam.zoom = Math.min(zoomX, zoomY) * 0.85; 
                } else {
                   // Perspective fitting (for any non-ortho views)
                   const dist = maxDim * 2.5; 
                   cam.position.copy(pCenter).add(viewDir.multiplyScalar(dist));
                }
                
                cam.updateProjectionMatrix();
                cam.updateMatrixWorld();
             }
           }
          
          const handler = style === 'color' ? captureHandlersColor 
                         : style === 'pencil' ? captureHandlersPencil 
                         : captureHandlersColorSketch;
          
          
          if (handler.current[vid]) handler.current[vid](true, false);
          
          // Fast Settle: Camera moved, wait for final render
          await new Promise(r => setTimeout(r, 500));
          await new Promise(r => requestAnimationFrame(r));
          await new Promise(r => requestAnimationFrame(r));
          
          let canvas = null;
          let viewLabels = [];
          
          for (let i = 0; i < 5; i++) {
             // Look for the static single canvas wrapper
             const wrapper = document.getElementById(`capture-canvas`);
             if (wrapper) {
                canvas = wrapper.querySelector('canvas');
                if (canvas) {
                  const camRef = captureHandlersReference.current[vid]; 
                  if (camRef && taggedComponents) {
                     const raycaster = new THREE.Raycaster();
                     taggedComponents.forEach(comp => {
                        const pos = new THREE.Vector3(comp.position_x, comp.position_y, comp.position_z);
                        const radius = (comp.properties?.od || 0.3) / 2;
                        const tagOffset = radius + 0.2; 
                        
                        const rotation = new THREE.Euler(
                           (comp.rotation_x || 0) * (Math.PI / 180),
                           (comp.rotation_y || 0) * (Math.PI / 180),
                           (comp.rotation_z || 0) * (Math.PI / 180)
                        );
                        
                        if (comp.component_type === 'straight' || comp.component_type === 'vertical' || comp.component_type === 'cylinder') {
                           const length = comp.properties?.length || 2;
                           const dir = new THREE.Vector3(0, 1, 0).applyEuler(rotation);
                           pos.add(dir.multiplyScalar(length / 2));
                        }
                        
                        const dir = pos.clone().sub(camRef.position).normalize();
                        raycaster.camera = camRef; 
                        raycaster.set(camRef.position, dir);
                        const intersects = raycaster.intersectObjects(camRef.parent?.children || [], true);
                        let isOccluded = false;
                        if (intersects.length > 0) {
                           const firstHit = intersects[0].object;
                           let hitComp = firstHit;
                           while(hitComp && hitComp.name !== String(comp.id) && hitComp.userData?.id !== comp.id) {
                              hitComp = hitComp.parent;
                           }
                           if (!hitComp || (hitComp.name !== String(comp.id) && hitComp.userData?.id !== comp.id)) isOccluded = true;
                        }
                        const projPos = pos.clone().project(camRef);
                        const screenX = (projPos.x + 1) / 2;
                        const screenY = (1 - projPos.y) / 2;
                        
                        if (screenX >= 0 && screenX <= 1 && screenY >= 0 && screenY <= 1 && projPos.z <= 1) {
                           viewLabels.push({
                              tag: comp._tag,
                              name: comp._label,
                              length: comp.properties?.length || 0,
                              width: comp.properties?.od || 0.3,
                              x: screenX,
                              y: screenY,
                              type: comp.component_type,
                              isOccluded
                           });
                        }
                     });
                  }
                  break;
                }
             }
             await new Promise(r => setTimeout(r, 100));
          }
          if (canvas) {
            const key = style === 'color-sketch' ? 'colorsketch' : style;
            const dataUrl = canvas.toDataURL('image/png', 1.0);
            if (dataUrl && dataUrl.length > 500) {
                console.log(`[Scene3D/Export] Captured ${vid}_${key} - Data Length: ${dataUrl.length}`);
                images[`${vid}_${key}`] = { data: dataUrl, labels: viewLabels };
            } else {
                console.warn(`[Scene3D/Export] BLANK CAPTURE for ${vid}_${key}! Length: ${dataUrl?.length || 0}`);
            }
          }
        }
        return images;
      };

      for (const style of stylesToCapture) {
        const styleResult = await performParallelCapture(requestedViewIds, style);
        Object.assign(allImages, styleResult);
      }

      setIsCapturingInternal(false);
      console.log('Pipe3D Export: Capture Complete.');
      // Return captured images AND the overall bounding-box stats for use in the PDF
      return { images: allImages, projectStats };
    }
  }), [components, projectStats]);

  const handleDrop = (e, targetIndex) => {
    e.preventDefault();
    const draggedViewId = e.dataTransfer.getData('text/plain');
    const draggedIndex = viewLayout.indexOf(draggedViewId);
    if (draggedIndex === -1 || draggedIndex === targetIndex) return;
    const newLayout = [...viewLayout];
    [newLayout[targetIndex], newLayout[draggedIndex]] = [newLayout[draggedIndex], newLayout[targetIndex]];
    setViewLayout(newLayout);
  };

  const renderViewport = (index, wrapperClass) => {
    const viewId = viewLayout[index];
    const config = VIEW_CONFIGS[viewId];
    return (
      <div
        id={`viewport-canvas-${viewId}`}
        className={`${wrapperClass} bg-white rounded-3xl border border-slate-200 relative overflow-hidden shadow-sm hover:border-blue-200 transition-colors group/viewport`}
        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
        onDrop={(e) => handleDrop(e, index)}
      >
        <ViewportLabel 
          text={config.label} 
          color={config.labelColor} 
          textColor={config.labelTextColor} 
          onDragStart={(e) => e.dataTransfer.setData('text/plain', viewId)} 
          viewId={viewId} 
          darkMode={darkMode}
          onViewChange={(newVid) => {
            const newLayout = [...viewLayout];
            newLayout[index] = newVid;
            setViewLayout(newLayout);
            
            // Auto-reset the view to default position when switching modes
            setTimeout(() => {
              if (resetHandlers.current[newVid]) resetHandlers.current[newVid](true, false);
            }, 50);
          }}
        />
        <StableResetButton onReset={() => resetHandlers.current[viewId]?.(true)} darkMode={darkMode} />
        <ZoomControls
          darkMode={darkMode}
          onZoomIn={() => {
            console.log(`[ZoomControls] Clicked IN for ${viewId}, handler exists:`, !!zoomHandlers.current[viewId]);
            zoomHandlers.current[viewId]?.in();
          }}
          onZoomOut={() => {
            console.log(`[ZoomControls] Clicked OUT for ${viewId}, handler exists:`, !!zoomHandlers.current[viewId]);
            zoomHandlers.current[viewId]?.out();
          }}
        />

        {/* Multi-Select Indicator */}
        {index === 0 && (selectedIds.length > 1) && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 px-4 py-1.5 bg-emerald-600 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-full shadow-lg shadow-emerald-500/20 flex items-center gap-2 animate-in zoom-in duration-300">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
            Batch Selection Active ({selectedIds.length} parts)
          </div>
        )}

        <SceneErrorBoundary key={viewId}>
          <ViewportContent
            viewId={viewId}
            config={config}
            components={taggedComponents}
            selectedIds={selectedIds}
            onSelectComponent={onSelectComponent}
            onBatchSelect={onBatchSelect}
            onUpdateComponent={onUpdateComponent}
            onUpdateMultiple={onUpdateMultiple}
            placingType={placingType}
            onPlaceComponent={onPlaceComponent}
            transformMode={transformMode}
            darkMode={darkMode}
            isCapture={false}
            setResetHandler={(handler) => { resetHandlers.current[viewId] = handler; }}
            setZoomHandlers={(handlers) => { zoomHandlers.current[viewId] = handlers; }}
            placingTemplate={placingTemplate}
            isLocked={isLocked}
            suppressLabels={suppressLabels}
            onTransform={(info) => setRealTimeTransform(info)}
            connectionMode={connectionMode}
            selectedSockets={selectedSockets}
            onSocketClick={onSocketClick}
            snapPivot={snapPivot}
            showColorDifferentiation={showColorDifferentiation}
            showSketchMode={showSketchMode}
            isGroupDragging={isGroupDragging}
            setIsGroupDragging={setIsGroupDragging}
            showFlow={showFlow}
            onShowHydroStats={onShowHydroStats}
          />

        </SceneErrorBoundary>

        {/* Transform HUD (Bottom Right) with ▲▼ Arrows */}
        {index === 0 && realTimeTransform && (
          <div className="absolute bottom-6 right-20 z-30 flex gap-1 animate-in slide-in-from-bottom-2 duration-300">
            {['X', 'Y', 'Z'].map(axis => {
              const val = realTimeTransform[axis.toLowerCase()] ?? 0;
              const suffix = transformMode === 'rotate' ? '°' : 'm';
              const displayVal = transformMode === 'translate' ? Number(val).toFixed(2) : val;

              const stepNudge = (direction, e) => {
                const step = transformMode === 'rotate'
                  ? (e?.shiftKey ? 1 : 5)    // 5° default, 1° with Shift
                  : (e?.shiftKey ? 0.1 : 0.5); // 0.5m default, 0.1m with Shift
                const currentVal = parseFloat(val) || 0;
                const newVal = transformMode === 'translate'
                  ? parseFloat((currentVal + direction * step).toFixed(2))
                  : Math.round(currentVal + direction * step);

                setRealTimeTransform(prev => ({ ...prev, [axis.toLowerCase()]: newVal }));

                if (selectedIds.length === 1) {
                  const comp = components.find(c => c.id === selectedIds[0]);
                  if (comp) {
                    const propKey = transformMode === 'rotate' ? `rotation_${axis.toLowerCase()}` : `position_${axis.toLowerCase()}`;
                    onUpdateComponent({ ...comp, [propKey]: newVal });
                  }
                }
              };

              const axisColor = axis === 'X' ? 'text-rose-500 hover:bg-rose-500/20' : axis === 'Y' ? 'text-emerald-500 hover:bg-emerald-500/20' : 'text-blue-500 hover:bg-blue-500/20';

              return (
                <div
                  key={axis}
                  className="flex flex-col items-center bg-slate-900/80 backdrop-blur-md border border-slate-700/50 rounded-lg p-1 min-w-[54px] shadow-xl group/hud-item hover:bg-slate-800 transition-colors"
                >
                  {/* ▲ Increment Button */}
                  <button
                    className={`w-full text-[9px] font-black rounded-sm transition-colors cursor-pointer select-none ${axisColor}`}
                    onClick={(e) => stepNudge(1, e)}
                    title={`+${transformMode === 'rotate' ? '5°' : '0.5m'} (Shift for fine)`}
                  >▲</button>

                  <span className={`text-[7px] font-black my-0.5 ${axis === 'X' ? 'text-rose-500' : axis === 'Y' ? 'text-emerald-500' : 'text-blue-500'}`}>{axis}</span>
                  <input
                    type="text"
                    className="bg-transparent text-white font-mono text-[10px] font-bold leading-none w-full text-center outline-none focus:text-blue-400"
                    value={displayVal + suffix}
                    onChange={(e) => {
                      const inputVal = (e.target.value || '').replace(/[m°]/g, '');
                      setRealTimeTransform(prev => ({ ...prev, [axis.toLowerCase()]: inputVal }));
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.target.blur();
                      }
                      // Arrow keys also nudge
                      if (e.key === 'ArrowUp') { e.preventDefault(); stepNudge(1, e); }
                      if (e.key === 'ArrowDown') { e.preventDefault(); stepNudge(-1, e); }
                    }}
                    onBlur={(e) => {
                      const numVal = parseFloat(e.target.value.replace(/[m°]/g, ''));
                      if (!isNaN(numVal) && selectedIds.length === 1) {
                        const comp = components.find(c => c.id === selectedIds[0]);
                        if (comp) {
                          const propKey = transformMode === 'rotate' ? `rotation_${axis.toLowerCase()}` : `position_${axis.toLowerCase()}`;
                          onUpdateComponent({
                            ...comp,
                            [propKey]: numVal
                          });
                        }
                      }
                    }}
                    onFocus={(e) => {
                      const input = e.target;
                      const text = input.value;
                      const suffixIndex = text.search(/[m°]/);
                      if (suffixIndex !== -1) {
                        input.setSelectionRange(0, suffixIndex);
                      } else {
                        input.select();
                      }
                    }}
                  />

                  {/* ▼ Decrement Button */}
                  <button
                    className={`w-full text-[9px] font-black rounded-sm transition-colors cursor-pointer select-none ${axisColor}`}
                    onClick={(e) => stepNudge(-1, e)}
                    title={`-${transformMode === 'rotate' ? '5°' : '0.5m'} (Shift for fine)`}
                  >▼</button>
                </div>
              );
            })}
          </div>
        )}

        <div className="absolute inset-0 bg-blue-500/0 group-hover/viewport:bg-blue-500/[0.02] transition-colors pointer-events-none" />
      </div>
    );
  };

  return (
    <div
      id="multi-view-container"
      className={`relative w-full h-full transition-colors duration-300 ${darkMode ? 'bg-slate-950' : 'bg-slate-50'}`}
      style={{ cursor: connectionMode ? 'crosshair' : 'auto' }}
    >
      {isWorkspaceLoading && (
        <div className={`absolute inset-0 z-[9999] flex flex-col items-center justify-center backdrop-blur-xl animate-out fade-out fill-mode-forwards duration-500 delay-300 ${darkMode ? 'bg-slate-950/90' : 'bg-white/90'}`}>
          <div className="animate-bounce">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-2xl p-4 mb-4 ${darkMode ? 'bg-slate-800' : 'bg-blue-600'}`}>
              <div className="w-8 h-8 rounded-full border-4 border-white/30 border-t-white animate-spin" />
            </div>
          </div>
          <h2 className={`text-2xl font-black tracking-tight italic uppercase ${darkMode ? 'text-white' : 'text-slate-800'}`}>INITIALIZING WORKSPACE</h2>
          <p className={`text-[10px] font-black uppercase tracking-[0.3em] mt-2 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Loading 3D Setup & Engine...</p>
        </div>
      )}

      <ResizablePane
        padding="p-1"
        first={renderViewport(0, "w-full h-full")}
        second={
          <ResizablePane
            padding="p-1"
            vertical
            initialSize={50}
            first={renderViewport(1, "w-full h-full")}
            second={renderViewport(2, "w-full h-full border-blue-100")}
          />
        }
      />

      {/* 🛠️ Hidden capture container for high-resolution PDF rendering */}
      {isCapturingInternal && (
        <div 
          id="export-capture-container"
          style={{ 
            position: 'absolute', 
            top: '-10000px', // Safely move far offscreen
            left: '-10000px',
            zIndex: -100, // Safe layer under everything
            opacity: 1, // Keep at 1 so browser doesn't throttle rendering loop
            width: '2040px', 
            height: '1200px',
            pointerEvents: 'none',
            overflow: 'hidden',
            background: '#ffffff'
          }}
          data-html2canvas-ignore="true"
        >
          {/* 🎯 SINGLE CANVAS APPROACH: We update props instead of unmounting to avoid WebGL context limits */}
          <div key="capture-viewport-static" id="capture-canvas" style={{ width: '2040px', height: '1200px' }}>
            <SceneErrorBoundary>
              <ViewportContent
                key="capture-viewport-content"
                viewId={activeCaptureViewId}
                config={VIEW_CONFIGS[activeCaptureViewId] || VIEW_CONFIGS['iso']}
                  components={taggedComponents}
                  darkMode={false}
                  isCapture={true}
                  captureStyle={captureStyle} 
                  setResetHandler={(handler, cam) => { 
                    // 🎯 Correctly store reset handler and camera reference
                    if (captureStyle === 'color') captureHandlersColor.current[activeCaptureViewId] = handler;
                    else if (captureStyle === 'pencil') captureHandlersPencil.current[activeCaptureViewId] = handler;
                    else captureHandlersColorSketch.current[activeCaptureViewId] = handler;
                    
                    if (cam) captureHandlersReference.current[activeCaptureViewId] = cam;
                  }}
                  isLocked={false}
                  transformMode={transformMode}
                  selectedIds={[]}
                  onSelectComponent={() => {}}
                  onUpdateComponent={() => {}}
                  onUpdateMultiple={() => {}}
                  placingType={null}
                  onPlaceComponent={() => {}}
                  isGroupDragging={isGroupDragging}
                  setIsGroupDragging={setIsGroupDragging}
                  showColorDifferentiation={showColorDifferentiation} // 🎨 CRITICAL: Pass color state to export
                  showSketchMode={showSketchMode}
                  showFlow={showFlow}
                  onShowHydroStats={onShowHydroStats}
                />
            </SceneErrorBoundary>
          </div>
        </div>
      )}
    </div>
  );
});

const getTag = (comp, components) => {
  const type = comp.component_type || 'straight';
  const sameTypeComps = (components || []).filter(c => c.component_type === type);
  const index = sameTypeComps.findIndex(c => c.id === comp.id) + 1;
  let prefix = 'P';
  if (type === 'elbow' || type === 'elbow-45') prefix = 'E';
  else if (type === 't-joint') prefix = 'TEE';
  else if (type === 'valve' || type === 'globe-valve' || type === 'check-valve' || type === 'gate-valve') prefix = 'V';
  else if (type === 'filter' || type === 'y-strainer') prefix = 'FL';
  else if (type === 'tank' || type === 'industrial-tank') prefix = 'T';
  else if (type === 'pump') prefix = 'PMP';
  else if (type === 'blind-flange') prefix = 'BF';
  else if (type === 'pressure-gauge') prefix = 'PG';
  else if (type === 'flow-meter') prefix = 'FM';
  else if (type === 'pipe-support') prefix = 'SUP';
  return `${prefix}${index}`;
};

// Internal component to handle background color changes inside Canvas
const SceneBackground = ({ isCapture, captureStyle }) => {
  const { gl } = useThree();
  
  useEffect(() => {
    if (isCapture) {
      // Clean white paper for all export passes
      const bgColor = '#ffffff';
      if (gl) {
        gl.setClearColor(bgColor, 1);
      }
    }
  }, [gl, isCapture, captureStyle]);

  return null;
};

// ---------------------------------------------------------
// COMPONENT: ViewportContent (Extracted for reuse)
// ---------------------------------------------------------
const ViewportContent = ({
  viewId,
  config,
  components,
  selectedIds,
  onSelectComponent,
  onBatchSelect,
  onUpdateComponent,
  onUpdateMultiple,
  placingType,
  onPlaceComponent,
  transformMode,
  darkMode,
  isCapture = false,
  captureStyle = 'color',
  setResetHandler,
  setZoomHandlers,
  placingTemplate,
  isLocked,
  suppressLabels = false,
  onTransform,
  connectionMode = false,
  selectedSockets = [],
  onSocketClick,
  snapPivot,
  showColorDifferentiation,
  showSketchMode,
  isGroupDragging,
  setIsGroupDragging,
  showFlow = false,
  onShowHydroStats,
}) => {

  const isDragging = useRef(false);
  const isTransforming = useRef(false);

  // Safety: Reset transforming state on window mouse up to prevent stuck states
  useEffect(() => {
    const handleGlobalUp = () => {
      if (isTransforming.current) {
        setTimeout(() => { isTransforming.current = false; }, 100);
      }
    };
    window.addEventListener('pointerup', handleGlobalUp);
    return () => window.removeEventListener('pointerup', handleGlobalUp);
  }, []);

  const getTagInternal = (comp) => {
    const type = comp.component_type || 'straight';
    const sameTypeComps = components.filter(c => c.component_type === type);
    const index = sameTypeComps.findIndex(c => c.id === comp.id);
    return getComponentTag(type, index);
  };

  return (
    <Canvas
      gl={{ 
        antialias: true, 
        preserveDrawingBuffer: true, 
        alpha: true,
        localClippingEnabled: true
      }}
      dpr={isCapture ? 2.0 : Math.min(2, window.devicePixelRatio)} // 🎯 Lowered from 2.5 to 2.0 for stability
      shadows={!isCapture}
      frameloop="always"
      camera={config.camera === 'ortho' ? { zoom: config.defaultZoom || 40, near: 0.1, far: 5000 } : { fov: config.defaultFov || 50, near: 0.1, far: 5000 }}
      onContextMenu={(e) => e.preventDefault()}
      onPointerMissed={(e) => {
        // Deselect only on actual left click (not drag or transform)
        // Check nativeEvent.button for cross-browser safety
        const isLeftClick = e.button === 0 || e.nativeEvent.button === 0;
        if (isLeftClick && !isDragging.current && !isTransforming.current && !placingType) {
          onSelectComponent(null);
        }
      }}
    >
      {isCapture && <SceneBackground isCapture={isCapture} captureStyle={captureStyle} />}
      {config.camera === 'ortho' ? (
        <OrthographicCamera makeDefault position={config.defaultPos} zoom={config.defaultZoom} up={config.defaultUp || [0, 1, 0]} />
      ) : (
        <PerspectiveCamera makeDefault position={config.defaultPos} fov={config.defaultFov} />
      )}
      <ViewportCameraControls
        key={viewId} // 🎯 FORCE remount when view changes to swap CameraControls context correctly
        viewMode={viewId}
        setResetHandler={setResetHandler}
        setZoomHandlers={setZoomHandlers}
        selectedIds={selectedIds}
        components={components} // 🎯 Fixed: Prop is named 'components' in this scope
        isLocked={isLocked}
      />
      {!isCapture && (
        <GizmoHelper alignment="bottom-left" margin={[40, 40]}>
          <GizmoViewport labelColor="white" axisColors={['#f43f5e', '#10b981', '#3b82f6']} />
        </GizmoHelper>
      )}
      {/* No Blueprint Label */}
      <SharedSceneElements
        components={components} // 🎯 Fixed: Prop is named 'components' in this scope
        selectedIds={selectedIds}
        onSelectComponent={(id, e) => {
          // Guard: stop selection if we just finished transforming or are dragging
          if (!isTransforming.current && !isDragging.current) {
            onSelectComponent(id, e);
          }
        }}
        onBatchSelect={onBatchSelect}
        onUpdateComponent={onUpdateComponent}
        onUpdateMultiple={onUpdateMultiple}
        placingType={placingType}
        onPlaceComponent={onPlaceComponent}
        transformMode={transformMode}
        viewMode={viewId}
        darkMode={darkMode}
        isCapture={isCapture}
        captureStyle={captureStyle}
        isBlueprint={(isCapture && (captureStyle === 'pencil' || captureStyle === 'color-sketch')) || (showSketchMode && !isCapture)} 
        isColorSketch={(isCapture && captureStyle === 'color-sketch')}
        placingTemplate={placingTemplate}
        isDragging={isDragging}
        isTransforming={isTransforming}
        suppressLabels={suppressLabels}
        onTransform={onTransform}
        isLocked={isLocked}
        connectionMode={connectionMode}
        selectedSockets={selectedSockets}
        onSocketClick={onSocketClick}
        snapPivot={snapPivot}
        showColorDifferentiation={showColorDifferentiation}
        isGroupDragging={isGroupDragging}
        setIsGroupDragging={setIsGroupDragging}
        showFlow={showFlow}
        onShowHydroStats={onShowHydroStats}
      />

    </Canvas>
  );
};

export default Scene3D;
/**
 * LeakageManager: Scans for gaps between connected pipes and renders "leak" animations
 */
const LeakageManager = ({ components, darkMode, onSelect, onBatchSelect }) => {
  const getSocketWorldPos = useCallback((comp, socketIdx) => {
    const def = COMPONENT_DEFINITIONS[comp.component_type] || COMPONENT_DEFINITIONS['straight'];
    if (!def || !def.sockets[socketIdx]) return null;
    
    const localPos = def.sockets[socketIdx].position.clone();
    if (comp.component_type === 'straight' || comp.component_type === 'vertical') {
      localPos.y = (def.sockets[socketIdx].position.y + 1) * ((comp.properties?.length || 2.0) / 2);
    } else {
      localPos.multiplyScalar(comp.properties?.radiusScale || 1);
    }
    
    const quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(
      (comp.rotation_x || 0) * (Math.PI / 180),
      (comp.rotation_y || 0) * (Math.PI / 180),
      (comp.rotation_z || 0) * (Math.PI / 180)
    ));
    
    return new THREE.Vector3(comp.position_x, comp.position_y, comp.position_z)
      .add(localPos.applyQuaternion(quat));
  }, []);

  // 🚀 PERFORMANCE OPTIMIZATION: Throttled Leak Scanning
  // Instead of recalculating every frame (which blocks the UI during dragging),
  // we use a debounced/limited calculation pattern.
  const [leaks, setLeaks] = useState([]);
  const lastUpdate = useRef(0);

  useEffect(() => {
    if (Date.now() - lastUpdate.current < 200) return; // 🛡️ Throttle to ~5Hz (perfect balance for UI)
    lastUpdate.current = Date.now();

    const foundLeaks = [];
    const allSockets = [];
    
    // 1. Build a fast lookup map for O(1) component access (Eliminates O(N^3) bottleneck)
    const compMap = new Map(components.map(c => [c.id, c]));
    
    // 2. Collect ALL sockets in world space
    components.forEach(comp => {
      const def = COMPONENT_DEFINITIONS[comp.component_type] || COMPONENT_DEFINITIONS['straight'];
      if (def && def.sockets) {
        def.sockets.forEach((_, sIdx) => {
          const wPos = getSocketWorldPos(comp, sIdx);
          if (wPos) {
            allSockets.push({
              compId: comp.id,
              socketIdx: sIdx,
              pos: wPos,
              connections: comp.connections || []
            });
          }
        });
      }
    });

    // 3. Optimized Cross-check for gaps
    for (let i = 0; i < allSockets.length; i++) {
      const s1 = allSockets[i];
      for (let j = i + 1; j < allSockets.length; j++) {
        const s2 = allSockets[j];
        if (s1.compId === s2.compId) continue;

        // Broad phase: Quick distance check
        const dx = s1.pos.x - s2.pos.x;
        const dy = s1.pos.y - s2.pos.y;
        const dz = s1.pos.z - s2.pos.z;
        const distSq = dx*dx + dy*dy + dz*dz;
        
        if (distSq > 0.64) continue; // 0.8^2
        const dist = Math.sqrt(distSq);
        
        // 🛡️ Fast Lookup Connection Check
        const c2 = compMap.get(s2.compId);
        const s2Connections = c2?.connections || [];
        const isConnected = s1.connections.some(c => c.targetId === s2.compId && c.localSocketIdx === s1.socketIdx && c.targetSocketIdx === s2.socketIdx) ||
                            s2Connections.some(c => c.targetId === s1.compId && c.localSocketIdx === s2.socketIdx && c.targetSocketIdx === s1.socketIdx);
        
        if (!isConnected && dist > 0.005) {
          foundLeaks.push({
            id: `${s1.compId}_${s2.compId}_leak`,
            comp1Id: s1.compId,
            comp2Id: s2.compId,
            position: s1.pos.clone().add(s2.pos).multiplyScalar(0.5),
            severity: Math.max(0.2, (0.8 - dist) * 2),
            dist
          });
        }
      }
    }
    
    // Only update state if something actually changed to avoid redundant renders
    setLeaks(foundLeaks);
  }, [components, getSocketWorldPos]);

  return (
    <group>
      {leaks.map(leak => (
        <LeakEffect 
          key={leak.id} 
          {...leak} 
          darkMode={darkMode} 
          onSelect={onSelect}
          onBatchSelect={onBatchSelect}
        />
      ))}
    </group>
  );
};


const LeakEffect = ({ position, direction, severity, dist, comp1Id, comp2Id, darkMode, onSelect, onBatchSelect }) => {
  const pointsRef = useRef();
  const particleCount = 120; // 🎯 Doubled particle count for rich industrial mist
  
  const particles = useMemo(() => {
    const pos = new Float32Array(particleCount * 3);
    const vel = new Float32Array(particleCount * 3);
    const initialVel = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      // Start in a tight cluster at the leak point
      pos[i * 3] = (Math.random() - 0.5) * 0.05;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 0.05;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 0.05;
      
      // 🚀 OMNI-DIRECTIONAL SPRAY (Explosive burst based on pressure/severity)
      const vx = (Math.random() - 0.5) * 4.0;
      const vy = (Math.random() - 0.2) * 3.0; // Biased slightly up for high-pressure spray
      const vz = (Math.random() - 0.5) * 4.0;

      vel[i * 3] = vx;
      vel[i * 3 + 1] = vy;
      vel[i * 3 + 2] = vz;

      initialVel[i * 3] = vx;
      initialVel[i * 3 + 1] = vy;
      initialVel[i * 3 + 2] = vz;
    }
    return { pos, vel, initialVel };
  }, []);

  useFrame((state, delta) => {
    if (!pointsRef.current) return;
    const attr = pointsRef.current.geometry.attributes.position;
    const gravity = 12.0 * delta; // 🌊 Stronger, more snappy industrial gravity

    for (let i = 0; i < particleCount; i++) {
       // Apply gravity to Y velocity
       particles.vel[i * 3 + 1] -= gravity;

       // Update position based on velocity & severity (Master multiplier)
       const speedScale = delta * 4 * severity;
       attr.array[i * 3] += particles.vel[i * 3] * speedScale;
       attr.array[i * 3 + 1] += particles.vel[i * 3 + 1] * speedScale;
       attr.array[i * 3 + 2] += particles.vel[i * 3 + 2] * speedScale;

       // 🌪️ Add Brownian Turbulence (Mist jitter)
       const jitter = 0.005 * severity;
       attr.array[i * 3] += (Math.random() - 0.5) * jitter;
       attr.array[i * 3 + 2] += (Math.random() - 0.5) * jitter;

       // Reset droplet when it falls too far (-4m for high-pressure arcs)
       if (attr.array[i * 3 + 1] < -4.0 || Math.abs(attr.array[i * 3]) > 5.0) {
          attr.array[i * 3] = (Math.random() - 0.5) * 0.05;
          attr.array[i * 3 + 1] = (Math.random() - 0.5) * 0.05;
          attr.array[i * 3 + 2] = (Math.random() - 0.5) * 0.05;
          
          particles.vel[i * 3] = particles.initialVel[i * 3];
          particles.vel[i * 3 + 1] = particles.initialVel[i * 3 + 1];
          particles.vel[i * 3 + 2] = particles.initialVel[i * 3 + 2];
       }
    }
    attr.needsUpdate = true;
  });

  return (
    <group position={[position.x, position.y, position.z]}>
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={particleCount}
            array={particles.pos}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial 
          color={darkMode ? "#60a5fa" : "#2563eb"} 
          size={0.05 + severity * 0.02} 
          transparent 
          opacity={0.6} 
          sizeAttenuation={true}
        />
      </points>
      
      {/* 🔮 High-Visibility Warning Ring (Pulsating) */}
      <mesh rotation={[Math.PI/2, 0, 0]}>
         <ringGeometry args={[0.08 * severity, 0.12 * severity, 24]} />
         <meshBasicMaterial color="#ef4444" transparent opacity={0.7} side={THREE.DoubleSide} />
      </mesh>

      <Html position={[0, 0.6, 0]} center zIndexRange={[5000, 6000]}>
         <div className="flex flex-col items-center gap-1.5 select-none">
            <div 
               onClick={(e) => {
                  e.stopPropagation();
                  if (onBatchSelect) onBatchSelect([comp1Id, comp2Id], e);
                  else if (onSelect) onSelect(comp1Id, e);
               }}
               className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-[0.2em] animate-bounce-slow border-2 flex items-center gap-2 shadow-2xl cursor-pointer active:scale-95 transition-transform ${darkMode ? 'bg-red-900/80 border-red-500 text-red-200 hover:bg-red-800' : 'bg-red-600 border-white text-white hover:bg-red-700'}`}
            >
               <div className="w-1.5 h-1.5 bg-white rounded-full animate-ping" />
               Critical Leakage
            </div>
            
            <div className={`px-2 py-0.5 rounded-full text-[8px] font-black font-mono italic ${darkMode ? 'bg-slate-800/80 text-blue-400' : 'bg-white/90 text-blue-600 shadow-lg'}`}>
              Loss: {(severity * 12.5).toFixed(1)} L/s
            </div>
            
            <div className="w-[1.5px] h-6 bg-gradient-to-b from-red-500 to-transparent" />
         </div>
      </Html>
    </group>
  );
};

