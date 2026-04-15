import { useState, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { Vector3, Quaternion, Plane } from 'three';
import { useThree } from '@react-three/fiber';
import { Text, Billboard } from '@react-three/drei';

export default function BoundingBoxGizmo({ component, onUpdate }) {
    const controls = useThree((state) => state.controls);
    const { camera } = useThree();

    // Dimensions
    const length = component.properties?.length || 2;
    const radiusScale = component.properties?.radiusScale || 1;
    const radius = component.component_type === 'industrial-tank'
        ? (component.properties?.od || 2.2) / 2
        : 0.15 * radiusScale;

    const boxHeight = length;
    const boxWidth = radius * 2;
    const boxDepth = radius * 2;

    // Component transform
    const position = new Vector3(component.position_x, component.position_y, component.position_z);
    const rotation = new THREE.Euler(
        (component.rotation_x * Math.PI) / 180,
        (component.rotation_y * Math.PI) / 180,
        (component.rotation_z * Math.PI) / 180
    );
    const quaternion = new Quaternion().setFromEuler(rotation);

    // Local Axes
    const localX = new Vector3(1, 0, 0).applyQuaternion(quaternion);
    const localY = new Vector3(0, 1, 0).applyQuaternion(quaternion);
    const localZ = new Vector3(0, 0, 1).applyQuaternion(quaternion);

    // Handle Logic
    const Handle = ({ offset, axisVector, cursor, type, sideMultiplier }) => {
        const [hovered, setHovered] = useState(false);
        const [dragStart, setDragStart] = useState(null);

        useEffect(() => {
            if (controls) {
                controls.enabled = !dragStart;
            }
            return () => {
                if (controls) controls.enabled = true;
            };
        }, [dragStart, controls]);

        return (
            <mesh
                position={offset}
                onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = cursor; }}
                onPointerOut={(e) => { e.stopPropagation(); setHovered(false); document.body.style.cursor = 'auto'; }}
                onPointerDown={(e) => {
                    e.stopPropagation();
                    e.target.setPointerCapture(e.pointerId);

                    const normal = new Vector3();
                    camera.getWorldDirection(normal).negate();
                    const plane = new Plane().setFromNormalAndCoplanarPoint(normal, e.point);

                    setDragStart({
                        plane,
                        startPoint: e.point.clone(),
                        startLength: length,
                        startRadiusScale: radiusScale,
                        startPos: position.clone()
                    });
                }}
                onPointerUp={(e) => {
                    e.stopPropagation();
                    e.target.releasePointerCapture(e.pointerId);
                    setDragStart(null);
                }}
                onPointerMove={(e) => {
                    if (dragStart) {
                        e.stopPropagation();

                        const currentPoint = new Vector3();
                        const intersection = e.ray.intersectPlane(dragStart.plane, currentPoint);

                        if (intersection) {
                            const dragVec = new Vector3().subVectors(intersection, dragStart.startPoint);
                            const projectedDelta = dragVec.dot(axisVector);

                            let newLength = dragStart.startLength;
                            let newRadiusScale = dragStart.startRadiusScale;
                            let posShift = new Vector3(0, 0, 0);

                            if (type === 'length') {
                                const change = projectedDelta * sideMultiplier;
                                newLength = Math.max(0.5, dragStart.startLength + change);

                                const actualChange = newLength - dragStart.startLength;
                                const shiftMag = actualChange / 2 * sideMultiplier;
                                posShift = axisVector.clone().multiplyScalar(shiftMag);
                            } else {
                                const change = projectedDelta * sideMultiplier;
                                const deltaRadius = change;
                                const deltaScale = deltaRadius / 0.15;
                                newRadiusScale = Math.max(0.5, dragStart.startRadiusScale + deltaScale);
                                posShift = new Vector3(0, 0, 0);
                            }

                            onUpdate({
                                ...component,
                                position_x: dragStart.startPos.x + posShift.x,
                                position_y: dragStart.startPos.y + posShift.y,
                                position_z: dragStart.startPos.z + posShift.z,
                                properties: {
                                    ...component.properties,
                                    length: newLength,
                                    radiusScale: newRadiusScale
                                }
                            });
                        }
                    }
                }}
            >
                <boxGeometry args={[0.2, 0.2, 0.2]} />
                <meshBasicMaterial color={hovered || dragStart ? '#ff0000' : '#888888'} />
            </mesh>
        );
    };

    const halfLen = length / 2;
    const halfWid = radius;
    const halfDep = radius;

    return (
        <group>
            <lineSegments>
                <edgesGeometry args={[new THREE.BoxGeometry(radius * 2, length, radius * 2)]} />
                <lineBasicMaterial color="#4287f5" />
            </lineSegments>

            {(component.component_type === 'straight' || component.component_type === 'tank' || component.component_type === 'vertical') && (
                <Handle
                    offset={[0, halfLen, 0]}
                    axisVector={localY}
                    cursor="ns-resize"
                    type="length"
                    sideMultiplier={1}
                />
            )}
            {(component.component_type === 'straight' || component.component_type === 'tank' || component.component_type === 'vertical') && (
                <Handle
                    offset={[0, -halfLen, 0]}
                    axisVector={localY}
                    cursor="ns-resize"
                    type="length"
                    sideMultiplier={-1}
                />
            )}

            <Handle
                offset={[halfWid, 0, 0]}
                axisVector={localX}
                cursor="ew-resize"
                type="radius"
                sideMultiplier={1}
            />
            <Handle
                offset={[-halfWid, 0, 0]}
                axisVector={localX}
                cursor="ew-resize"
                type="radius"
                sideMultiplier={-1}
            />

            <Handle
                offset={[0, 0, halfDep]}
                axisVector={localZ}
                cursor="ew-resize"
                type="radius"
                sideMultiplier={1}
            />
            <Handle
                offset={[0, 0, -halfDep]}
                axisVector={localZ}
                cursor="ew-resize"
                type="radius"
                sideMultiplier={-1}
            />

            {/* Dimension labels removed per user request */}
        </group>
    );
}
