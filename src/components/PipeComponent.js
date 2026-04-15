import { useRef, useState, memo, useMemo, useEffect, Children } from 'react';
import { Billboard, Text, Line, useTexture, Edges, Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { MATERIALS, COMPONENT_DEFINITIONS } from '../config/componentDefinitions.js';
import hatchTextureUrl from '../assets/sketch_hatch.png';

const WALL_THICKNESS = 0.03;

// --- OPTIMIZED GEOMETRY HELPERS (Minimal React Overhead for i3) ---

// Optimized MeshWithOutlines: Removed Children.toArray and dynamic geometry searching.
// Now accepts geometry and material props directly to avoid VDOM traversal.
const MeshWithOutlines = ({ geometry, matProps, children, isBlueprint, isGhost, position, rotation, ...props }) => {
  const childArray = Children.toArray(children);
  const primaryMaterial = childArray.find(c => c.props && (c.props.color || c.props.map)) || <meshStandardMaterial {...matProps} />;
  const geometryChild = childArray.find(c => c.props && c.props.args);

  if (isBlueprint) {
    // 🎯 FORCE PURE WHITE FILL FOR BLUEPRINT (ONLY THE OUTLINE)
    const blueprintFillColor = "#ffffff"; 
    
    return (
      <group position={position} rotation={rotation}>
        <mesh geometry={geometry} {...props}>
          {geometry ? null : geometryChild}
          <meshBasicMaterial color={blueprintFillColor} depthWrite={true} polygonOffset polygonOffsetFactor={1.5} polygonOffsetUnits={1.5} />
          <Edges color="#000000" threshold={60} />
        </mesh>
      </group>
    );
  }

  const OUTLINE_SCALE = 1.01; 
  return (
    <group position={position} rotation={rotation}>
      {!isGhost && (
        <mesh geometry={geometry} scale={[OUTLINE_SCALE, OUTLINE_SCALE, OUTLINE_SCALE]} {...props}>
          {geometry ? null : geometryChild}
          <meshBasicMaterial color="#000000" side={THREE.BackSide} depthWrite={true} />
        </mesh>
      )}
      <mesh geometry={geometry} {...props}>
         {children || <meshStandardMaterial {...matProps} />}
         {!isGhost && <Edges color="#000000" threshold={60} />}
      </mesh>
    </group>
  );
};

const HollowCylinder = ({ radius, height, position, rotation, openEnded = true, matProps, isGhost, isBlueprint }) => {
  const innerRadius = radius - WALL_THICKNESS;
  
  const gear = useMemo(() => new THREE.CylinderGeometry(radius, radius, height, 16, 1, openEnded), [radius, height, openEnded]);
  const innerGear = useMemo(() => new THREE.CylinderGeometry(innerRadius, innerRadius, height, 16, 1, openEnded), [innerRadius, height, openEnded]);

  return (
    <group position={position} rotation={rotation}>
      <MeshWithOutlines 
        geometry={gear} 
        matProps={matProps} 
        isBlueprint={isBlueprint} 
        isGhost={isGhost} 
      />
      {!isGhost && (
        <mesh geometry={innerGear}>
           {isBlueprint ? <meshBasicMaterial color="#ffffff" side={THREE.BackSide} /> : <meshStandardMaterial {...matProps} side={THREE.BackSide} />}
        </mesh>
      )}
    </group>
  );
};

const HollowSphere = ({ radius, position, rotation, matProps, isGhost, isBlueprint }) => {
  const innerRadius = radius - WALL_THICKNESS;
  const gear = useMemo(() => new THREE.SphereGeometry(radius, 16, 16), [radius]);
  const innerGear = useMemo(() => new THREE.SphereGeometry(innerRadius, 16, 16), [innerRadius]);

  return (
    <group position={position} rotation={rotation}>
      <MeshWithOutlines 
        geometry={gear} 
        matProps={matProps} 
        isBlueprint={isBlueprint} 
        isGhost={isGhost} 
      />
      {!isGhost && (
        <mesh geometry={innerGear}>
           {isBlueprint ? <meshBasicMaterial color="#ffffff" side={THREE.BackSide} /> : <meshStandardMaterial {...matProps} side={THREE.BackSide} />}
        </mesh>
      )}
    </group>
  );
};

const HollowTaperedCylinder = ({ radiusTop, radiusBottom, height, position, rotation, matProps, isGhost, isBlueprint }) => {
  const innerTop = radiusTop - WALL_THICKNESS;
  const innerBottom = radiusBottom - WALL_THICKNESS;
  
  const gear = useMemo(() => new THREE.CylinderGeometry(radiusTop, radiusBottom, height, 16, 1, true), [radiusTop, radiusBottom, height]);
  const innerGear = useMemo(() => new THREE.CylinderGeometry(innerTop, innerBottom, height, 16, 1, true), [innerTop, innerBottom, height]);

  return (
    <group position={position} rotation={rotation}>
      <MeshWithOutlines 
        geometry={gear} 
        matProps={matProps} 
        isBlueprint={isBlueprint} 
        isGhost={isGhost} 
      />
      {!isGhost && (
        <mesh geometry={innerGear}>
           {isBlueprint ? <meshBasicMaterial color="#ffffff" side={THREE.BackSide} /> : <meshStandardMaterial {...matProps} side={THREE.BackSide} />}
        </mesh>
      )}
    </group>
  );
};

const ConnectionRim = ({ radius, position, rotation, matProps, isBlueprint, isGhost }) => {
  const gear = useMemo(() => new THREE.RingGeometry(radius - WALL_THICKNESS + 0.001, radius - 0.001, 16), [radius]);
  
  return (
    <MeshWithOutlines 
      geometry={gear} 
      matProps={matProps} 
      isBlueprint={isBlueprint} 
      isGhost={isGhost} 
      position={position} 
      rotation={rotation} 
    />
  );
};


function PipeComponent({
  component,
  isSelected,
  onSelect,
  onUpdate,
  isGhost = false,
  viewMode = 'top',
  tag = '',
  info = '', // 🎯 New info prop for full labels
  darkMode = false,
  isCapture = false,
  isBlueprint = false,
  isColorSketch = false,
  suppressLabels = false,
  connectionMode = false,
  isPlacementActive = false,
  selectedSockets = [],
  onSocketClick,
  snapPivot,
  showColorDifferentiation = false,
  isAttached = false, 
  captureStyle = 'color',
  showFlow = false,
  onWaterClick // Callback when clicking internal flow
}) {


  const hatch = useTexture(hatchTextureUrl);
  
  useEffect(() => {
    if (hatch) {
      hatch.wrapS = hatch.wrapT = THREE.RepeatWrapping;
      hatch.repeat.set(2, 2); // 🎨 Larger, more natural hand-drawn hatching like the reference
      hatch.needsUpdate = true;
    }
  }, [hatch]);

  const [isHovered, setIsHovered] = useState(false);
  const WALL_THICKNESS = 0.03; // ~10% of standard 0.3OD

  const def = COMPONENT_DEFINITIONS[component.component_type || 'straight'];

  const radiusScale = component.properties?.radiusScale ?? 1;
  const length = component.properties?.length ?? 2;
  const od = component.properties?.od ?? (0.30 * radiusScale);
  const radiusOuter = od / 2;

  const position = [
    component.position_x || 0,
    component.position_y || 0,
    component.position_z || 0,
  ];

  const rotation = [
    ((component.rotation_x || 0) * Math.PI) / 180,
    ((component.rotation_y || 0) * Math.PI) / 180,
    ((component.rotation_z || 0) * Math.PI) / 180,
  ];

  const scale = [
    component.scale_x || 1,
    component.scale_y || 1,
    component.scale_z || 1,
  ];

  const matConfig = MATERIALS[component.properties?.material || 'pvc'] || MATERIALS.pvc;
  const type = (component.component_type || 'straight').toLowerCase();

  // LOGGING: verify which type is actually being rendered
  if (isGhost) {
    console.log(`[PipeComponent/Ghost] Rendering as type: ${type}`);
  }

  // --- COLOR DIFFERENTIATION LOGIC ---
  // Dictionary mapping component types to specific distinct colors
  const TYPE_COLORS = {
    'straight': '#3b82f6', // blue
    'vertical': '#06b6d4', // cyan
    'elbow': '#ef4444', // red
    'elbow-45': '#f43f5e', // rose
    't-joint': '#f97316', // orange
    'cross': '#eab308', // yellow
    'reducer': '#8b5cf6', // violet
    'cap': '#d946ef', // fuchsia
    'valve': '#22c55e', // green
    'flange': '#14b8a6', // teal
    'filter': '#84cc16', // lime
    'tank': '#6366f1', // indigo
    'pump': '#64748b',  // slate
    'globe-valve': '#ef4444', // red
    'check-valve': '#f97316', // orange
    'gate-valve': '#10b981', // green
    'y-strainer': '#06b6d4', // cyan
    'blind-flange': '#64748b', // slate
    'pressure-gauge': '#eab308', // yellow
    'flow-meter': '#8b5cf6', // violet
    'pipe-support': '#94a3b8' // gray
  };
  
  // Default color if type isn't mapped
  const diffColor = TYPE_COLORS[type] || '#ec4899'; // pink as fallback

  const getBaseColor = () => {
    if (isBlueprint && !isColorSketch) return '#ffffff';
    if (isSelected) return '#1d4ed8';
    if (isHovered) return '#60a5fa';
    if ((showColorDifferentiation || isColorSketch) && !isGhost) return diffColor;
    return matConfig.color;
  };

  const matProps = {
    // Pencil Sketch: Pure white with hatching for a clean technical look
    color: (isBlueprint && !isColorSketch) ? '#ffffff' : getBaseColor(),
    transparent: isGhost ? true : false,
    opacity: isGhost ? 0.65 : 1,
    // Low emissive for pencil sketch to allow shadows/texture to show
    emissive: (isBlueprint && !isColorSketch) ? '#ffffff' : (isGhost ? '#3b82f6' : (isSelected ? '#1e40af' : '#000000')),
    emissiveIntensity: (isBlueprint && !isColorSketch) ? 0.1 : (isGhost ? 0.8 : (isSelected ? 0.15 : 0)),
    side: THREE.DoubleSide,
    roughness: (isBlueprint || isColorSketch) ? 1.0 : (matConfig.roughness ?? 0.3),
    metalness: (isBlueprint || isColorSketch) ? 0 : (matConfig.metalness ?? 0.1),
    map: (isBlueprint || isColorSketch) ? hatch : null,
    wireframe: false,
  };


  // Moved primitives outside for performance and to prevent unmounting during frame updates

  const renderGeometry = () => {
    // STRAIGHT
    if (type === 'straight' || type === 'vertical') {
      return (
        <group>
          <HollowCylinder radius={radiusOuter} height={length} position={[0, length / 2, 0]} matProps={matProps} isGhost={isGhost} isBlueprint={isBlueprint} />
          {showFlow && !isGhost && (
            <WaterStream 
              radius={radiusOuter * 0.8} 
              height={length} 
              position={[0, length / 2, 0]} 
              darkMode={darkMode} 
              onClick={(e) => { e.stopPropagation(); onWaterClick?.(); }}
            />
          )}
        </group>
      );
    }



    // ELBOW 90
    if (type === 'elbow') {
      return (
        <group>
          <HollowCylinder radius={radiusOuter} height={1 * radiusScale} position={[0, 0.5 * radiusScale, 0]} matProps={matProps} isGhost={isGhost} isBlueprint={isBlueprint} />
          <HollowCylinder radius={radiusOuter} height={1 * radiusScale} position={[0.5 * radiusScale, 0, 0]} rotation={[0, 0, Math.PI / 2]} matProps={matProps} isGhost={isGhost} isBlueprint={isBlueprint} />
          <HollowSphere radius={radiusOuter} matProps={matProps} isGhost={isGhost} isBlueprint={isBlueprint} />
          <ConnectionRim radius={radiusOuter} position={[0, 1 * radiusScale, 0]} rotation={[-Math.PI / 2, 0, 0]} matProps={matProps} isBlueprint={isBlueprint} />
          <ConnectionRim radius={radiusOuter} position={[1 * radiusScale, 0, 0]} rotation={[0, Math.PI / 2, 0]} matProps={matProps} isBlueprint={isBlueprint} />
          {showFlow && !isGhost && (
            <group>
               <WaterStream radius={radiusOuter * 0.85} height={1 * radiusScale} position={[0, 0.5 * radiusScale, 0]} darkMode={darkMode} />
               <WaterStream radius={radiusOuter * 0.85} height={1 * radiusScale} position={[0.5 * radiusScale, 0, 0]} rotation={[0, 0, Math.PI / 2]} darkMode={darkMode} />
               <mesh>
                 <sphereGeometry args={[radiusOuter * 0.85, 12, 12]} />
                 <meshStandardMaterial color="#3b82f6" emissive="#60a5fa" emissiveIntensity={2} transparent opacity={0.6} />
               </mesh>
            </group>
          )}
        </group>
      );
    }



    // ELBOW 45
    if (type === 'elbow-45') {
       return (
        <group>
          <HollowCylinder radius={radiusOuter} height={0.7 * radiusScale} position={[0, 0.35 * radiusScale, 0]} matProps={matProps} isGhost={isGhost} isBlueprint={isBlueprint} />
          <HollowCylinder radius={radiusOuter} height={0.7 * radiusScale} position={[0.25 * radiusScale, 0.25 * radiusScale, 0]} rotation={[0, 0, -Math.PI / 4]} matProps={matProps} isGhost={isGhost} isBlueprint={isBlueprint} />
          <HollowSphere radius={radiusOuter} matProps={matProps} isGhost={isGhost} isBlueprint={isBlueprint} />
          <ConnectionRim radius={radiusOuter} position={[0, 0.7 * radiusScale, 0]} rotation={[-Math.PI / 2, 0, 0]} matProps={matProps} isBlueprint={isBlueprint} />
          <ConnectionRim radius={radiusOuter} position={[0.5 * radiusScale, 0.5 * radiusScale, 0]} rotation={[0, 0, -Math.PI / 4]} matProps={matProps} isBlueprint={isBlueprint} />
        </group>
      );
    }
    
    // T-JOINT
    if (type === 't-joint') {
      return (
        <group>
          <HollowCylinder radius={radiusOuter} height={1.5 * radiusScale} matProps={matProps} isGhost={isGhost} isBlueprint={isBlueprint} />
          <HollowCylinder radius={radiusOuter} height={0.75 * radiusScale} position={[0.375 * radiusScale, 0, 0]} rotation={[0, 0, Math.PI / 2]} matProps={matProps} isGhost={isGhost} isBlueprint={isBlueprint} />
          <HollowSphere radius={radiusOuter} matProps={matProps} isGhost={isGhost} isBlueprint={isBlueprint} />
          <ConnectionRim radius={radiusOuter} position={[0.75 * radiusScale, 0, 0]} rotation={[0, Math.PI / 2, 0]} matProps={matProps} isBlueprint={isBlueprint} />
          {showFlow && !isGhost && (
            <group>
               <WaterStream radius={radiusOuter * 0.85} height={1.5 * radiusScale} position={[0, 0, 0]} darkMode={darkMode} />
               <WaterStream radius={radiusOuter * 0.85} height={0.75 * radiusScale} position={[0.375 * radiusScale, 0, 0]} rotation={[0, 0, Math.PI / 2]} darkMode={darkMode} />
               <mesh>
                 <sphereGeometry args={[radiusOuter * 0.85, 12, 12]} />
                 <meshStandardMaterial color="#3b82f6" emissive="#60a5fa" emissiveIntensity={2} transparent opacity={0.6} />
               </mesh>
            </group>
          )}
        </group>

      );
    }

    // CROSS
    if (type === 'cross') {
      return (
        <group>
          <HollowCylinder radius={radiusOuter} height={2 * radiusScale} matProps={matProps} isGhost={isGhost} isBlueprint={isBlueprint} />
          <HollowCylinder radius={radiusOuter} height={2 * radiusScale} rotation={[0, 0, Math.PI / 2]} matProps={matProps} isGhost={isGhost} isBlueprint={isBlueprint} />
          <HollowSphere radius={radiusOuter} matProps={matProps} isGhost={isGhost} isBlueprint={isBlueprint} />
          <ConnectionRim radius={radiusOuter} position={[1 * radiusScale, 0, 0]} rotation={[0, Math.PI / 2, 0]} matProps={matProps} isBlueprint={isBlueprint} />
          <ConnectionRim radius={radiusOuter} position={[-1 * radiusScale, 0, 0]} rotation={[0, -Math.PI / 2, 0]} matProps={matProps} isBlueprint={isBlueprint} />
          {showFlow && !isGhost && (
            <group>
               <WaterStream radius={radiusOuter * 0.85} height={2 * radiusScale} position={[0, 0, 0]} darkMode={darkMode} />
               <WaterStream radius={radiusOuter * 0.85} height={2 * radiusScale} rotation={[0, 0, Math.PI/2]} position={[0, 0, 0]} darkMode={darkMode} />
               <mesh>
                 <sphereGeometry args={[radiusOuter * 0.85, 12, 12]} />
                 <meshStandardMaterial color="#3b82f6" emissive="#60a5fa" emissiveIntensity={2} transparent opacity={0.6} />
               </mesh>
            </group>
          )}
        </group>

      );
    }

    // VALVE
    if (type === 'valve') {
      const handleRot = (component.properties?.handleRotation || 0) * (Math.PI / 180);
      return (
        <group>
          <HollowCylinder radius={radiusOuter} height={1.5 * radiusScale} matProps={matProps} isGhost={isGhost} isBlueprint={isBlueprint} />
          <HollowSphere radius={radiusOuter * 1.4} matProps={matProps} isGhost={isGhost} isBlueprint={isBlueprint} />
          <ConnectionRim radius={radiusOuter} position={[0, 0.75 * radiusScale, 0]} rotation={[-Math.PI / 2, 0, 0]} matProps={matProps} isBlueprint={isBlueprint} />
          <ConnectionRim radius={radiusOuter} position={[0, -0.75 * radiusScale, 0]} rotation={[Math.PI / 2, 0, 0]} matProps={matProps} isBlueprint={isBlueprint} />
          <group rotation={[0, 0, handleRot]}>
             <MeshWithOutlines isBlueprint={isBlueprint} isColorSketch={isColorSketch} position={[0, 0, radiusOuter * 1.6]}>
               <boxGeometry args={[radiusOuter * 0.4, radiusOuter * 3, radiusOuter * 0.4]} />
               <meshStandardMaterial color={isBlueprint && !isColorSketch ? "#ffffff" : "#ef4444"} />
             </MeshWithOutlines>
          </group>
          {showFlow && !isGhost && (
            <group>
               <WaterStream radius={radiusOuter * 0.85} height={1.5 * radiusScale} darkMode={darkMode} />
               <mesh>
                 <sphereGeometry args={[radiusOuter * 1.2, 12, 12]} />
                 <meshStandardMaterial color="#3b82f6" emissive="#60a5fa" emissiveIntensity={1.5} transparent opacity={0.6} />
               </mesh>
            </group>
          )}
        </group>

      );
    }

    // REDUCER
    if (type === 'reducer') {
      const smallRadius = radiusOuter * 0.7;
      return (
        <group>
          <ConnectionRim radius={radiusOuter} position={[0, -0.4 * radiusScale, 0]} rotation={[Math.PI / 2, 0, 0]} matProps={matProps} isBlueprint={isBlueprint} />
          {showFlow && !isGhost && (
            <WaterStream radius={radiusOuter * 0.45} height={0.8 * radiusScale} darkMode={darkMode} />
          )}
        </group>

      );
    }

    // COUPLING / UNION
    if (type === 'coupling' || type === 'union') {
      return (
        <group>
          <HollowCylinder radius={radiusOuter * 1.15} height={0.6 * radiusScale} matProps={matProps} isGhost={isGhost} isBlueprint={isBlueprint} />
          <ConnectionRim radius={radiusOuter * 1.15} position={[0, 0.3 * radiusScale, 0]} rotation={[-Math.PI / 2, 0, 0]} matProps={matProps} isBlueprint={isBlueprint} />
          <ConnectionRim radius={radiusOuter * 1.15} position={[0, -0.3 * radiusScale, 0]} rotation={[Math.PI / 2, 0, 0]} matProps={matProps} isBlueprint={isBlueprint} />
          {type === 'union' && (
            <HollowCylinder radius={radiusOuter * 1.3} height={0.2 * radiusScale} matProps={matProps} isGhost={isGhost} isBlueprint={isBlueprint} />
          )}
        </group>
      );
    }

    // FLANGE
    if (type === 'flange') {
      const faceRadius = radiusOuter * 2.2;
      const holeCircleRadius = radiusOuter * 1.6;
      const holeRadius = radiusOuter * 0.15;
      return (
        <group>
          <HollowCylinder radius={faceRadius} height={0.15 * radiusScale} matProps={matProps} isGhost={isGhost} isBlueprint={isBlueprint} />
          <HollowCylinder radius={radiusOuter * 1.3} height={0.5 * radiusScale} matProps={matProps} isGhost={isGhost} isBlueprint={isBlueprint} />
          <ConnectionRim radius={faceRadius} position={[0, 0.075 * radiusScale, 0]} rotation={[-Math.PI / 2, 0, 0]} matProps={matProps} isBlueprint={isBlueprint} />
          <ConnectionRim radius={faceRadius} position={[0, -0.075 * radiusScale, 0]} rotation={[Math.PI / 2, 0, 0]} matProps={matProps} isBlueprint={isBlueprint} />
          {!isGhost && Array.from({ length: 4 }).map((_, i) => {
             const angle = (i / 4) * Math.PI * 2 + (Math.PI / 4);
             return (
               <MeshWithOutlines isBlueprint={isBlueprint} key={i} position={[Math.cos(angle) * holeCircleRadius, 0.06 * radiusScale, Math.sin(angle) * holeCircleRadius]} rotation={[-Math.PI / 2, 0, 0]}>
                 <circleGeometry args={[holeRadius, 16]} />
                 <meshStandardMaterial color={isBlueprint ? "#ffffff" : "#1e293b"} side={THREE.DoubleSide} />
               </MeshWithOutlines>
             );
          })}
        </group>
      );
    }

    // CAP
    if (type === 'cap') {
      return (
        <group position={[0, -0.05 * radiusScale, 0]}>
          <HollowCylinder radius={radiusOuter * 1.08} height={0.3 * radiusScale} openEnded={true} matProps={matProps} isGhost={isGhost} isBlueprint={isBlueprint} />
          <MeshWithOutlines isBlueprint={isBlueprint} position={[0, 0.15 * radiusScale, 0]}>
             <sphereGeometry args={[radiusOuter * 1.08, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
             <meshStandardMaterial {...matProps} />
          </MeshWithOutlines>
        </group>
      );
    }

    // PLUG
    if (type === 'plug') {
      return (
        <group position={[0, -0.1 * radiusScale, 0]}>
          <MeshWithOutlines isBlueprint={isBlueprint}>
            <cylinderGeometry args={[radiusOuter * 0.95, radiusOuter * 0.95, 0.2 * radiusScale, 16]} />
            <meshStandardMaterial {...matProps} />
          </MeshWithOutlines>
          <MeshWithOutlines isBlueprint={isBlueprint} position={[0, 0.15 * radiusScale, 0]}>
             <cylinderGeometry args={[radiusOuter * 1.1, radiusOuter * 1.1, 0.1 * radiusScale, 6]} />
             <meshStandardMaterial color={isBlueprint ? "#ffffff" : "#475569"} />
          </MeshWithOutlines>
        </group>
      );
    }

    // FILTER & Y-STRAINER (Reverted to Y-branch design as per user preference)
    if (type === 'filter' || type === 'y-strainer') {
      const branchAngle = Math.PI / 4;
      return (
        <group>
          <HollowCylinder radius={radiusOuter * 1.1} height={1.4 * radiusScale} matProps={matProps} isGhost={isGhost} isBlueprint={isBlueprint} />
          <HollowSphere radius={radiusOuter * 1.1} matProps={matProps} isGhost={isGhost} isBlueprint={isBlueprint} />
          <ConnectionRim radius={radiusOuter * 1.1} position={[0, 0.7 * radiusScale, 0]} rotation={[-Math.PI / 2, 0, 0]} matProps={matProps} isBlueprint={isBlueprint} />
          <ConnectionRim radius={radiusOuter * 1.1} position={[0, -0.7 * radiusScale, 0]} rotation={[Math.PI / 2, 0, 0]} matProps={matProps} isBlueprint={isBlueprint} />
          <group position={[0, 0, 0]} rotation={[0, 0, -branchAngle]}>
             <HollowCylinder radius={radiusOuter * 1.1} height={0.9 * radiusScale} position={[0, 0.45 * radiusScale, 0]} openEnded={false} matProps={matProps} isGhost={isGhost} isBlueprint={isBlueprint} />
              <MeshWithOutlines isBlueprint={isBlueprint} position={[0, 0.9 * radiusScale, 0]}>
                 <cylinderGeometry args={[radiusOuter * 1.2, radiusOuter * 1.2, 0.1 * radiusScale, 6]} />
                 <meshStandardMaterial {...matProps} color={isBlueprint ? "#ffffff" : "#475569"} />
              </MeshWithOutlines>
          </group>
          {showFlow && !isGhost && (
            <group>
               <WaterStream radius={radiusOuter * 0.9} height={1.4 * radiusScale} darkMode={darkMode} />
               <WaterStream radius={radiusOuter * 0.9} height={0.8 * radiusScale} position={[0.2 * radiusScale, -0.2 * radiusScale, 0]} rotation={[0, 0, -branchAngle]} darkMode={darkMode} />
            </group>
          )}
        </group>

      );
    }

    // CYLINDER
    if (type === 'cylinder') {
      return (
        <group position={[0, length / 2, 0]}>
          <HollowCylinder radius={radiusOuter} height={length} matProps={matProps} isGhost={isGhost} isBlueprint={isBlueprint} />
          <ConnectionRim radius={radiusOuter} position={[0, -length / 2, 0]} rotation={[Math.PI / 2, 0, 0]} matProps={matProps} isBlueprint={isBlueprint} />
          {showFlow && !isGhost && (
            <WaterStream radius={radiusOuter * 0.85} height={length} darkMode={darkMode} />
          )}
        </group>

      );
    }

    // CUBE
    if (type === 'cube') {
      return (
        <MeshWithOutlines isBlueprint={isBlueprint}>
          <boxGeometry args={[radiusOuter * 2, radiusOuter * 2, radiusOuter * 2]} />
          <meshStandardMaterial {...matProps} />
        </MeshWithOutlines>
      );
    }

    // CONE
    if (type === 'cone') {
      return (
        <MeshWithOutlines isBlueprint={isBlueprint}>
          <coneGeometry args={[radiusOuter, length, 16]} />
          <meshStandardMaterial {...matProps} />
        </MeshWithOutlines>
      );
    }

    // WALL
    if (type === 'wall') {
      const w = component.properties?.od || 10;
      const h = component.properties?.length || 10;
      const t = component.properties?.thick || 0.2;
      return (
        <MeshWithOutlines isBlueprint={isBlueprint} position={[0, h/2, 0]}>
          <boxGeometry args={[w, h, t]} />
          <meshStandardMaterial {...matProps} />
        </MeshWithOutlines>
      );
    }

    // WATER-TAP
    if (type === 'water-tap') {
      return (
        <group>
          <HollowCylinder radius={radiusOuter} height={0.8 * radiusScale} matProps={matProps} isGhost={isGhost} isBlueprint={isBlueprint} />
          <HollowSphere radius={radiusOuter} matProps={matProps} isGhost={isGhost} isBlueprint={isBlueprint} />
          <group position={[0, 0.1 * radiusScale, 0]} rotation={[Math.PI / 2, 0, 0]}>
             <HollowCylinder radius={radiusOuter * 0.8} height={0.6 * radiusScale} position={[0, 0.3 * radiusScale, 0]} matProps={matProps} isGhost={isGhost} isBlueprint={isBlueprint} />
             <group position={[0, 0.6 * radiusScale, 0]}>
                <HollowTaperedCylinder radiusTop={radiusOuter * 0.7} radiusBottom={radiusOuter * 0.8} height={0.3 * radiusScale} position={[0, 0.15 * radiusScale, 0.05 * radiusScale]} rotation={[-Math.PI / 8, 0, 0]} matProps={matProps} isGhost={isGhost} isBlueprint={isBlueprint} />
                <HollowTaperedCylinder radiusTop={radiusOuter * 0.6} radiusBottom={radiusOuter * 0.7} height={0.3 * radiusScale} position={[0, 0.35 * radiusScale, 0.25 * radiusScale]} rotation={[-Math.PI / 3, 0, 0]} matProps={matProps} isGhost={isGhost} isBlueprint={isBlueprint} />
                <ConnectionRim radius={radiusOuter * 0.6} position={[0, 0.5 * radiusScale, 0.35 * radiusScale]} rotation={[-Math.PI / 3, 0, 0]} matProps={matProps} isBlueprint={isBlueprint} />
             </group>
          </group>
          <group position={[0, 0.25 * radiusScale, 0]}>
             <HollowSphere radius={radiusOuter * 0.9} matProps={matProps} isGhost={isGhost} isBlueprint={isBlueprint} />
             <MeshWithOutlines isBlueprint={isBlueprint} isColorSketch={isColorSketch} position={[radiusOuter * 0.8, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
                <capsuleGeometry args={[radiusOuter * 0.3, radiusOuter * 2.5, 4, 8]} />
                <meshStandardMaterial color={isBlueprint && !isColorSketch ? "#ffffff" : "#ef4444"} />
             </MeshWithOutlines>
          </group>
        </group>
      );
    }

    // TANK
    if (type === 'tank') {
        const tankRadius = Math.max(radiusOuter * 2, 1.0); 
        const floorOffset = length / 2;
        return (
         <group position={[0, floorOffset, 0]}>
           <MeshWithOutlines isBlueprint={isBlueprint}>
             <cylinderGeometry args={[tankRadius, tankRadius, length, 32, 1, true]} />
             <meshStandardMaterial {...matProps} />
           </MeshWithOutlines>
           <MeshWithOutlines isBlueprint={isBlueprint} position={[0, length / 2, 0]}>
             <sphereGeometry args={[tankRadius, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
             <meshStandardMaterial {...matProps} />
           </MeshWithOutlines>
           <MeshWithOutlines isBlueprint={isBlueprint} position={[0, -length / 2 + 0.02, 0]} rotation={[Math.PI / 2, 0, 0]}>
             <circleGeometry args={[tankRadius, 32]} />
             <meshStandardMaterial {...matProps} roughness={1} metalness={0} />
           </MeshWithOutlines>
           {/* 🛡️ Occlusion Plane: Hides the Ground Grid inside the tank */}
           {!isGhost && (
              <mesh position={[0, -length / 2 + 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <circleGeometry args={[tankRadius * 0.99, 32]} />
                <meshBasicMaterial color={darkMode ? "#0f172a" : "#ffffff"} depthWrite={true} polygonOffset={true} polygonOffsetFactor={-1} />
              </mesh>
           )}
           {showFlow && !isGhost && (
              <mesh position={[0, -length/4, 0]}>
                 <cylinderGeometry args={[tankRadius * 0.9, tankRadius * 0.9, length * 0.5, 32]} />
                 <meshStandardMaterial color="#3b82f6" transparent opacity={0.6} emissive="#60a5fa" emissiveIntensity={2} />
              </mesh>
           )}
         </group>
       );
     }
 
     // INDUSTRIAL TANK
     if (type === 'industrial-tank') {
        const tankRadius = Math.max(radiusOuter * 2, 1.0); 
        const legHeight = tankRadius * 1.5;
        const floorOffset = length / 2 + legHeight;
        return (
         <group position={[0, floorOffset, 0]}>
           <MeshWithOutlines isBlueprint={isBlueprint}>
              <cylinderGeometry args={[tankRadius, tankRadius, length, 32, 1, true]} />
              <meshStandardMaterial {...matProps} />
           </MeshWithOutlines>
           <group position={[0, length / 2, 0]}>
              <MeshWithOutlines isBlueprint={isBlueprint} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
                 <circleGeometry args={[tankRadius, 32]} />
                 <meshStandardMaterial {...matProps} />
              </MeshWithOutlines>
              <MeshWithOutlines isBlueprint={isBlueprint} position={[0, 0.05 * radiusScale, 0]}>
                 <cylinderGeometry args={[tankRadius * 0.25, tankRadius * 0.25, 0.1 * radiusScale, 16]} />
                 <meshStandardMaterial {...matProps} color={isBlueprint ? "#ffffff" : "#475569"} />
              </MeshWithOutlines>
              <MeshWithOutlines isBlueprint={isBlueprint} position={[tankRadius * 0.4, 0.15 * radiusScale, 0]}>
                 <cylinderGeometry args={[tankRadius * 0.08, tankRadius * 0.08, 0.3 * radiusScale]} />
                 <meshStandardMaterial {...matProps} />
              </MeshWithOutlines>
           </group>
           <MeshWithOutlines isBlueprint={isBlueprint} position={[0, -length / 2 + 0.02, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <circleGeometry args={[tankRadius, 32]} />
              <meshStandardMaterial {...matProps} roughness={1} metalness={0} />
           </MeshWithOutlines>
           {/* 🛡️ Occlusion Plane: Hides the Ground Grid inside the tank */}
           {!isGhost && (
              <mesh position={[0, -length / 2 + 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <circleGeometry args={[tankRadius * 0.99, 32]} />
                <meshBasicMaterial color={darkMode ? "#0f172a" : "#ffffff"} depthWrite={true} polygonOffset={true} polygonOffsetFactor={-1} />
              </mesh>
           )}
           {showFlow && !isGhost && (
              <mesh position={[0, -length/4, 0]}>
                 <cylinderGeometry args={[tankRadius * 0.9, tankRadius * 0.9, length * 0.5, 32]} />
                 <meshStandardMaterial color="#3b82f6" transparent opacity={0.6} emissive="#60a5fa" emissiveIntensity={2} />
              </mesh>
           )}
          {!isGhost && (
            <group position={[0, -length / 2, 0]}>
              {[-1, 1].map(x => [-1, 1].map(z => {
                const angle = Math.atan2(z, x);
                const legX = Math.cos(angle) * tankRadius * 0.95;
                const legZ = Math.sin(angle) * tankRadius * 0.95;
                return (
                  <MeshWithOutlines key={`leg-${x}-${z}`} isBlueprint={isBlueprint} isColorSketch={isColorSketch} position={[legX, -legHeight / 2, legZ]}>
                    <boxGeometry args={[tankRadius * 0.12, legHeight, tankRadius * 0.12]} />
                    <meshStandardMaterial color={isBlueprint && !isColorSketch ? "#ffffff" : (darkMode ? "#cbd5e1" : "#334155")} />
                  </MeshWithOutlines>
                );
              } )) }
            </group>
          )}
          {!isGhost && (
            <group position={[tankRadius + 0.05, -length / 2, 0]}>
              <mesh position={[0, length / 2, 0.15 * radiusScale]}>
                <boxGeometry args={[0.02, length, 0.02]} />
                <meshStandardMaterial color="#64748b" />
              </mesh>
              <mesh position={[0, length / 2, -0.15 * radiusScale]}>
                <boxGeometry args={[0.02, length, 0.02]} />
                <meshStandardMaterial color="#64748b" />
              </mesh>
              {Array.from({ length: Math.floor(length / 0.3) }).map((_, i) => (
                <mesh key={`rung-${i}`} position={[0, i * 0.3 + 0.15, 0]}>
                  <boxGeometry args={[0.015, 0.015, 0.3 * radiusScale]} />
                  <meshStandardMaterial color="#64748b" />
                </mesh>
              ))}
            </group>
          )}
        </group>
      );
    }

    // Y-CROSS
    if (type === 'y-cross') {
      return (
        <group>
          <HollowCylinder radius={radiusOuter} height={1.5 * radiusScale} matProps={matProps} isGhost={isGhost} isBlueprint={isBlueprint} />
          <HollowCylinder radius={radiusOuter} height={0.75 * radiusScale} position={[0.3, 0.3, 0]} rotation={[0, 0, -Math.PI / 4]} matProps={matProps} isGhost={isGhost} isBlueprint={isBlueprint} />
          <HollowCylinder radius={radiusOuter} height={0.75 * radiusScale} position={[-0.3, 0.3, 0]} rotation={[0, 0, Math.PI / 4]} matProps={matProps} isGhost={isGhost} isBlueprint={isBlueprint} />
          <HollowSphere radius={radiusOuter} matProps={matProps} isGhost={isGhost} isBlueprint={isBlueprint} />
        </group>
      );
    }

    // STERE-CROSS (3D Cross)
    if (type === 'stere-cross') {
      return (
        <group>
          <HollowCylinder radius={radiusOuter} height={2 * radiusScale} matProps={matProps} isGhost={isGhost} isBlueprint={isBlueprint} />
          <HollowCylinder radius={radiusOuter} height={2 * radiusScale} rotation={[Math.PI / 2, 0, 0]} matProps={matProps} isGhost={isGhost} isBlueprint={isBlueprint} />
          <HollowCylinder radius={radiusOuter} height={2 * radiusScale} rotation={[0, 0, Math.PI / 2]} matProps={matProps} isGhost={isGhost} isBlueprint={isBlueprint} />
          <HollowSphere radius={radiusOuter * 1.5} matProps={matProps} isGhost={isGhost} isBlueprint={isBlueprint} />
        </group>
      );
    }

    // S-TRAP
    if (type === 's-trap') {
      return (
        <group>
          {/* Top vertical */}
          <HollowCylinder radius={radiusOuter} height={0.5 * radiusScale} position={[0, 0.25 * radiusScale, 0]} matProps={matProps} isGhost={isGhost} isBlueprint={isBlueprint} />
          {/* First Bend */}
          <HollowSphere radius={radiusOuter} position={[0, 0, 0]} matProps={matProps} isGhost={isGhost} isBlueprint={isBlueprint} />
          {/* Middle horizontal */}
          <HollowCylinder radius={radiusOuter} height={1 * radiusScale} position={[0.5 * radiusScale, 0, 0]} rotation={[0, 0, Math.PI / 2]} matProps={matProps} isGhost={isGhost} isBlueprint={isBlueprint} />
          {/* Second Bend */}
          <HollowSphere radius={radiusOuter} position={[1 * radiusScale, 0, 0]} matProps={matProps} isGhost={isGhost} isBlueprint={isBlueprint} />
          {/* Bottom vertical */}
          <HollowCylinder radius={radiusOuter} height={0.5 * radiusScale} position={[1 * radiusScale, -0.25 * radiusScale, 0]} matProps={matProps} isGhost={isGhost} isBlueprint={isBlueprint} />
        </group>
      );
    }

    // P-TRAP
    if (type === 'p-trap') {
      return (
        <group>
          <HollowCylinder radius={radiusOuter} height={0.8 * radiusScale} position={[0, 0.4 * radiusScale, 0]} matProps={matProps} isGhost={isGhost} isBlueprint={isBlueprint} />
          <HollowSphere radius={radiusOuter} position={[0, 0, 0]} matProps={matProps} isGhost={isGhost} isBlueprint={isBlueprint} />
          <HollowCylinder radius={radiusOuter} height={0.8 * radiusScale} position={[0.4 * radiusScale, 0, 0]} rotation={[0, 0, Math.PI / 2]} matProps={matProps} isGhost={isGhost} isBlueprint={isBlueprint} />
        </group>
      );
    }

    // EQUAL / UNEQUAL TEE
    if (type === 'equal-tee' || type === 'unequal-tee') {
      const isUnequal = type === 'unequal-tee';
      const branchHeight = isUnequal ? 0.5 : 0.75;
      const branchRadius = isUnequal ? radiusOuter * 0.7 : radiusOuter;
      return (
        <group>
          <HollowCylinder radius={radiusOuter} height={1.5 * radiusScale} matProps={matProps} isGhost={isGhost} isBlueprint={isBlueprint} />
          <HollowCylinder radius={branchRadius} height={branchHeight * radiusScale} position={[branchHeight / 2 * radiusScale, 0, 0]} rotation={[0, 0, Math.PI / 2]} matProps={matProps} isGhost={isGhost} isBlueprint={isBlueprint} />
          <HollowSphere radius={radiusOuter} position={[0, 0, 0]} matProps={matProps} isGhost={isGhost} isBlueprint={isBlueprint} />
        </group>
      );
    }

    // EQUAL / UNEQUAL CROSS
    if (type === 'equal-cross' || type === 'unequal-cross') {
      const isUnequal = type === 'unequal-cross';
      const lenY = isUnequal ? 1.0 : 1.5;
      const lenX = 1.5;
      const radiusY = isUnequal ? radiusOuter * 0.7 : radiusOuter;
      const radiusX = radiusOuter;
      return (
        <group>
          <HollowCylinder radius={radiusY} height={lenY * radiusScale} matProps={matProps} isGhost={isGhost} isBlueprint={isBlueprint} />
          <HollowCylinder radius={radiusX} height={lenX * radiusScale} rotation={[0, 0, Math.PI / 2]} matProps={matProps} isGhost={isGhost} isBlueprint={isBlueprint} />
          <HollowSphere radius={radiusOuter} position={[0, 0, 0]} matProps={matProps} isGhost={isGhost} isBlueprint={isBlueprint} />
        </group>
      );
    }

    // RAINWATER FUNNEL
    if (type === 'rainwater-funnel') {
      return (
        <group>
          <MeshWithOutlines isBlueprint={isBlueprint} position={[0, 0.4, 0]}>
            <boxGeometry args={[1.5 * radiusScale, 0.8 * radiusScale, 1.5 * radiusScale]} />
            <meshStandardMaterial {...matProps} />
          </MeshWithOutlines>
          <HollowCylinder radius={radiusOuter} height={0.5 * radiusScale} position={[0, -0.2, 0]} matProps={matProps} isGhost={isGhost} isBlueprint={isBlueprint} />
        </group>
      );
    }



    // Y-TEE
    if (type === 'y-tee') {
      return (
        <group>
          <HollowCylinder radius={radiusOuter} height={1.5 * radiusScale} matProps={matProps} isGhost={isGhost} isBlueprint={isBlueprint} />
          <HollowCylinder radius={radiusOuter} height={1 * radiusScale} position={[0.4, 0.4, 0]} rotation={[0, 0, Math.PI / 4]} matProps={matProps} isGhost={isGhost} isBlueprint={isBlueprint} />
        </group>
      );
    }

    // H-PIPE
    if (type === 'h-pipe') {
      return (
        <group>
          <HollowCylinder radius={radiusOuter} height={2 * radiusScale} position={[-0.5 * radiusScale, 0, 0]} matProps={matProps} isGhost={isGhost} isBlueprint={isBlueprint} />
          <HollowCylinder radius={radiusOuter} height={2 * radiusScale} position={[0.5 * radiusScale, 0, 0]} matProps={matProps} isGhost={isGhost} isBlueprint={isBlueprint} />
          <HollowCylinder radius={radiusOuter * 0.8} height={1 * radiusScale} rotation={[0, 0, Math.PI / 2]} matProps={matProps} isGhost={isGhost} isBlueprint={isBlueprint} />
        </group>
      );
    }



    // EXPANSION JOINT
    if (type === 'expansion-joint') {
      return (
        <group>
          <HollowCylinder radius={radiusOuter} height={1 * radiusScale} matProps={matProps} isGhost={isGhost} isBlueprint={isBlueprint} />
          <HollowCylinder radius={radiusOuter * 1.5} height={0.4 * radiusScale} matProps={matProps} isGhost={isGhost} isBlueprint={isBlueprint} />
          <ConnectionRim radius={radiusOuter} position={[0, 0.5 * radiusScale, 0]} rotation={[-Math.PI / 2, 0, 0]} matProps={matProps} isBlueprint={isBlueprint} />
          <ConnectionRim radius={radiusOuter} position={[0, -0.5 * radiusScale, 0]} rotation={[Math.PI / 2, 0, 0]} matProps={matProps} isBlueprint={isBlueprint} />
        </group>
      );
    }

    // WATER STOP RING
    if (type === 'water-stop-ring') {
      return (
        <group>
          <MeshWithOutlines isBlueprint={isBlueprint}>
            <torusGeometry args={[radiusOuter * 1.5, 0.05 * radiusScale, 16, 32]} />
            <meshStandardMaterial {...matProps} color="#94a3b8" />
          </MeshWithOutlines>
        </group>
      );
    }

    // UNEQUAL COUPLING
    if (type === 'unequal-coupling') {
      return (
        <group>
          <HollowCylinder radius={radiusOuter} radiusTop={radiusOuter * 0.7} height={0.6 * radiusScale} matProps={matProps} isGhost={isGhost} isBlueprint={isBlueprint} />
        </group>
      );
    }

    // LUCENCY CAP
    if (type === 'lucency-cap') {
      return (
        <group>
          <HollowSphere radius={radiusOuter} matProps={{ ...matProps, transparent: true, opacity: 0.5 }} isGhost={isGhost} isBlueprint={isBlueprint} />
          <HollowCylinder radius={radiusOuter} height={0.2 * radiusScale} position={[0, -0.1 * radiusScale, 0]} matProps={matProps} isGhost={isGhost} isBlueprint={isBlueprint} />
        </group>
      );
    }

    // CHECKING HOLE
    if (type === 'checking-hole') {
      return (
        <group>
          <HollowCylinder radius={radiusOuter} height={1 * radiusScale} matProps={matProps} isGhost={isGhost} isBlueprint={isBlueprint} />
          <MeshWithOutlines isBlueprint={isBlueprint} position={[radiusOuter, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
            <cylinderGeometry args={[radiusOuter * 0.8, radiusOuter * 0.8, 0.1 * radiusScale, 16]} />
            <meshStandardMaterial {...matProps} />
          </MeshWithOutlines>
        </group>
      );
    }

    // FLOOR LEAKAGE
    if (type === 'floor-leakage') {
      return (
        <group>
          <MeshWithOutlines isBlueprint={isBlueprint}>
            <cylinderGeometry args={[radiusOuter * 2, radiusOuter * 1.8, 0.1 * radiusScale, 32]} />
            <meshStandardMaterial {...matProps} />
          </MeshWithOutlines>
          <HollowCylinder radius={radiusOuter} height={0.5 * radiusScale} position={[0, -0.3 * radiusScale, 0]} matProps={matProps} isGhost={isGhost} isBlueprint={isBlueprint} />
        </group>
      );
    }

    // PUMP
    if (type === 'pump') {
      return (
        <group>
          <MeshWithOutlines isBlueprint={isBlueprint} position={[0, -0.1 * radiusScale, 0]}>
            <cylinderGeometry args={[radiusOuter * 2.5, radiusOuter * 2.5, 0.6 * radiusScale, 32]} />
            <meshStandardMaterial {...matProps} />
          </MeshWithOutlines>
          <MeshWithOutlines isBlueprint={isBlueprint} position={[0, 0.3 * radiusScale, 0]}>
            <boxGeometry args={[radiusOuter * 1.5, 0.4 * radiusScale, radiusOuter * 1.5]} />
            <meshStandardMaterial {...matProps} color={isBlueprint ? "#ffffff" : "#475569"} />
          </MeshWithOutlines>
          <HollowCylinder radius={radiusOuter} height={1.0 * radiusScale} position={[0, 0, 0]} matProps={matProps} isGhost={isGhost} isBlueprint={isBlueprint} />
        </group>
      );
    }

    // CLAMPS & HARDWARE (Highly Industrial Detail)
    if (type === 'clamp' || type === 'hang-clamp' || type === 'expand-clamp') {
      const clampWidth = 0.15 * radiusScale;
      const ringRadius = radiusOuter + 0.05;
      const earWidth = 0.15 * radiusScale;
      
      return (
        <group>
          {/* Main Clamp Band (Split-ring look) */}
          <MeshWithOutlines isBlueprint={isBlueprint}>
            <torusGeometry args={[ringRadius, 0.04, 12, 32, Math.PI * 1.9]} />
            <meshStandardMaterial {...matProps} color={isBlueprint ? "#ffffff" : "#475569"} />
          </MeshWithOutlines>

          {/* Left Ear */}
          <MeshWithOutlines isBlueprint={isBlueprint} position={[-ringRadius - earWidth/2, 0, 0]}>
            <boxGeometry args={[earWidth, 0.04, clampWidth]} />
            <meshStandardMaterial {...matProps} color={isBlueprint ? "#ffffff" : "#64748b"} />
          </MeshWithOutlines>

          {/* Right Ear */}
          <MeshWithOutlines isBlueprint={isBlueprint} position={[ringRadius + earWidth/2, 0, 0]}>
            <boxGeometry args={[earWidth, 0.04, clampWidth]} />
            <meshStandardMaterial {...matProps} color={isBlueprint ? "#ffffff" : "#64748b"} />
          </MeshWithOutlines>

          {/* Top Mounting Base */}
          <MeshWithOutlines isBlueprint={isBlueprint} position={[0, ringRadius, 0]}>
            <boxGeometry args={[0.2, 0.1, 0.15]} />
            <meshStandardMaterial {...matProps} color={isBlueprint ? "#ffffff" : "#334155"} />
          </MeshWithOutlines>

          {/* Hanger Rod for hang-clamp */}
          {type === 'hang-clamp' && (
             <group position={[0, ringRadius + 0.1, 0]}>
                <MeshWithOutlines isBlueprint={isBlueprint} position={[0, 0.5, 0]}>
                    <cylinderGeometry args={[0.025, 0.025, 1.0, 8]} />
                    <meshStandardMaterial {...matProps} color={isBlueprint ? "#ffffff" : "#cbd5e1"} />
                </MeshWithOutlines>
             </group>
          )}

          {/* Reinforced Support for expand-clamp */}
          {type === 'expand-clamp' && (
             <MeshWithOutlines isBlueprint={isBlueprint} position={[0, -ringRadius - 0.1, 0]}>
                <boxGeometry args={[0.3, 0.05, clampWidth]} />
                <meshStandardMaterial {...matProps} color={isBlueprint ? "#ffffff" : "#1e293b"} />
             </MeshWithOutlines>
          )}
        </group>
      );
    }

    // DEFAULT PIPES
    return (
      <group position={[0, length / 2, 0]}>
        <HollowCylinder radius={radiusOuter} height={length} matProps={matProps} isGhost={isGhost} isBlueprint={isBlueprint} />
        <ConnectionRim radius={radiusOuter} position={[0, length / 2, 0]} rotation={[-Math.PI / 2, 0, 0]} matProps={matProps} isBlueprint={isBlueprint} />
        <ConnectionRim radius={radiusOuter} position={[0, -length / 2, 0]} rotation={[Math.PI / 2, 0, 0]} matProps={matProps} isBlueprint={isBlueprint} />
      </group>
    );

    // VERTICAL / STRAIGHT (Hollow with Rims)
    return (
      <group position={[0, length / 2, 0]}>
        <HollowCylinder radius={radiusOuter} height={length} />
        {/* Top Rim */}
        <MeshWithOutlines position={[0, length / 2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[radiusOuter - WALL_THICKNESS, radiusOuter, 16]} />
          <meshStandardMaterial {...matProps} />
        </MeshWithOutlines>
        {/* Bottom Rim */}
        <MeshWithOutlines position={[0, -length / 2, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[radiusOuter - WALL_THICKNESS, radiusOuter, 16]} />
          <meshStandardMaterial {...matProps} />
        </MeshWithOutlines>
      </group>
    );
  };

  // ── Connection Sockets (Dynamic Mapping) ────────────────────
  const socketBubbles = useMemo(() => {
    if (!connectionMode || isGhost || !def || !def.sockets) return [];

    return def.sockets.map((s, idx) => {
      const pos = s.position.clone();
      
      // Apply type-specific scaling logic (matches App.jsx snapping)
      if (type === 'industrial-tank') {
        const tankRadius = radiusOuter * 2;
        const legHeight = tankRadius * 1.5;
        const floorOffset = (length / 2) + legHeight;
        pos.x *= (tankRadius + 0.1); 
        pos.z *= (tankRadius + 0.1);
        pos.y = (pos.y * (length / 2)) + floorOffset;
      } else if (type === 'straight' || type === 'vertical') {
        pos.y = (pos.y + 1) * (length / 2);
      } else if (type === 'tank') {
        const tankRadius = radiusOuter * 2;
        const floorOffset = length / 2;
        pos.x *= tankRadius;
        pos.z *= tankRadius;
        pos.y = (pos.y * (length / 2)) + floorOffset;
      } else {
        // Standard fittings
        pos.multiplyScalar(radiusScale);
      }

      return {
        id: idx,
        position: [pos.x, pos.y, pos.z]
      };
    });
  }, [connectionMode, isGhost, def, type, component.properties, length, radiusScale]);


  if (isGhost) {
    console.log(`Pipe3D: Rendering Ghost for ${type}`, { position, rotation, properties: component.properties });
  }

  return (
    <>
    <group
      name={component.id}
      position={isAttached ? undefined : position}
      rotation={isAttached ? undefined : rotation}
      raycast={isGhost ? null : undefined}
      onPointerDown={(e) => {
        if (isGhost || connectionMode || isPlacementActive) return;
        e.stopPropagation();
        if (typeof onSelect === 'function') onSelect(e);
      }}
      onPointerOver={(e) => {
        if (isGhost) return;
        e.stopPropagation();
        setIsHovered(true);
      }}
      onPointerOut={() => {
        if (isGhost) return;
        setIsHovered(false);
      }}
    >
      {renderGeometry()}

      {/* Connection Sockets - Hidden in blueprints to avoid cluttering technical drawings */}
      {!isCapture && socketBubbles.map((socket) => (
        <mesh 
          key={socket.id} 
          position={socket.position}
          onPointerDown={(e) => {
            e.stopPropagation();
            if (typeof onSocketClick === 'function') onSocketClick(component.id, socket.id);
          }}
        >
          <sphereGeometry args={[0.12, 16, 16]} />
          <meshStandardMaterial color="#ff0055" emissive="#ff0055" emissiveIntensity={0.5} />
        </mesh>
      ))}
    </group>

    {/* 🎯 Separate Marking Layer - Positioned at world center but independent of rotation/scale distortion */}
    {(isBlueprint || isCapture) && tag && (
        <Billboard 
          position={(() => {
            const bp = new THREE.Vector3(...position);
            const br = new THREE.Euler(...rotation);
            let localOff = new THREE.Vector3(0, 0, 0);
            
            if (type === 'straight' || type === 'vertical' || type === 'cylinder') localOff.set(0, length / 2, 0);
            else if (type === 'tank') localOff.set(0, length / 2, 0);
            else if (type === 'industrial-tank') localOff.set(0, length / 2 + radiusOuter * 1.5, 0);

            return bp.add(localOff.applyEuler(br));
          })()}
          renderOrder={1500} 
        >
            {/* 🎯 Bubble background with BORDER - Dynamically pushed out to avoid clipping */}
            <group position={[0, 0, radiusOuter + 0.16]}>
                {/* 1. Black Border */}
                <mesh renderOrder={1501}>
                    <circleGeometry args={[Math.max(0.18, radiusOuter * 1.05), 32]} />
                    <meshBasicMaterial color="#000000" depthTest={true} depthWrite={false} />
                </mesh>
                
                {/* 2. White Fill */}
                <mesh position={[0, 0, 0.005]} renderOrder={1502}>
                    <circleGeometry args={[Math.max(0.17, radiusOuter * 1.0), 32]} />
                    <meshBasicMaterial 
                      color="#ffffff" 
                      transparent 
                      opacity={0.98} 
                      depthTest={true} 
                      depthWrite={false}
                      polygonOffset={isCapture}
                      polygonOffsetFactor={-4}
                    />
                </mesh>

                {/* 🎯 ID Text - Perfectly centered within bubble */}
                <Text
                    fontSize={Math.max(0.13, radiusOuter * 0.70)} 
                    color="#000000"
                    fontWeight="black" 
                    anchorX="center"
                    anchorY="middle"
                    position={[0, 0, 0.01]} // 🎯 Now relative to bubble
                    depthTest={true} 
                    depthWrite={false}
                    renderOrder={1503}
                >
                    {tag.toUpperCase()}
                </Text>
            </group>
        </Billboard>
    )}
</>
  );
}

const WaterStream = ({ radius, height, position, rotation, darkMode, onClick }) => {
  const meshRef = useRef();
  const [showStats, setShowStats] = useState(false);
  
  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.getElapsedTime();
    meshRef.current.material.opacity = 0.4 + Math.sin(t * 4) * 0.15;
  });

  return (
    <group position={position} rotation={rotation}>
      <mesh 
        ref={meshRef} 
        onClick={(e) => {
          onClick?.(e);
          setShowStats(true);
          setTimeout(() => setShowStats(false), 3000); // 🕒 Auto-hide after 3s
        }}
        onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { document.body.style.cursor = 'auto'; }}
      >
        <cylinderGeometry args={[radius, radius, height, 12]} />
        <meshStandardMaterial 
          color="#3b82f6" 
          transparent 
          opacity={0.6} 
          emissive="#60a5fa" 
          emissiveIntensity={2.5}
          roughness={0.1}
        />
      </mesh>

      
      {showStats && (
        <Html position={[0, 0, 0]} center zIndexRange={[2000, 3000]}>
           <div className={`p-3 rounded-2xl border shadow-2xl animate-in zoom-in slide-in-from-bottom duration-300 backdrop-blur-md w-40 ${darkMode ? 'bg-slate-900/90 border-slate-700 text-white' : 'bg-white/90 border-blue-100 text-slate-800'}`}>
              <div className="flex items-center gap-2 mb-2">
                 <div className="w-2 h-2 rounded-full bg-green-500 animate-ping" />
                 <span className="text-[10px] font-black uppercase tracking-widest text-blue-500 line-clamp-1">Industrial Hydraulic Diagnostics</span>
              </div>
              <div className="space-y-1.5">
                 <div className="flex justify-between items-end border-b border-blue-500/10 pb-1">
                    <span className="text-[8px] uppercase font-bold text-slate-500">Pressure</span>
                    <span className="text-xs font-mono font-black italic">{(2.2 + Math.random() * 0.4).toFixed(2)} Bar</span>
                 </div>
                 <div className="flex justify-between items-end border-b border-blue-500/10 pb-1">
                    <span className="text-[8px] uppercase font-bold text-slate-500">Velocity</span>
                    <span className="text-xs font-mono font-black italic">{(1.5 + Math.random() * 0.2).toFixed(2)} m/s</span>
                 </div>
                 <div className="flex justify-between items-end">
                    <span className="text-[8px] uppercase font-bold text-slate-500">Vol. Flow</span>
                    <span className="text-xs font-mono font-black italic">{(140 + Math.random() * 10).toFixed(0)} L/m</span>
                 </div>
              </div>
           </div>
        </Html>
      )}
    </group>
  );
};


const MemorizedPipeComponent = memo(PipeComponent);
export default MemorizedPipeComponent;

