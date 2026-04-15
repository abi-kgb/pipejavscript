import * as THREE from 'three';
import { COMPONENT_DEFINITIONS } from '../config/componentDefinitions.js';

/**
 * checkIntersection
 * Checks if a candidate placement intersects with any existing components.
 * Refined to check multiple points (center + sockets) for better accuracy with fittings.
 */
/**
 * distance squared between point and segment
 */
const distPointToSegmentSq = (p, s1, s2) => {
    const l2 = s1.distanceToSquared(s2);
    if (l2 === 0) return p.distanceToSquared(s1);
    const d1 = s2.clone().sub(s1);
    const d2 = p.clone().sub(s1);
    let t = d2.dot(d1) / l2;
    t = Math.max(0, Math.min(1, t));
    const projection = s1.clone().add(d1.multiplyScalar(t));
    return p.distanceToSquared(projection);
};

/**
 * Distance between two line segments (p1-p2) and (p3-p4)
 * Based on Dan Sunday's algorithm
 */
const distBetweenSegments = (p1, p2, p3, p4) => {
    const u = p2.clone().sub(p1);
    const v = p4.clone().sub(p3);
    const w = p1.clone().sub(p3);
    const a = u.dot(u);
    const b = u.dot(v);
    const c = v.dot(v);
    const d = u.dot(w);
    const e = v.dot(w);
    const D = a * c - b * b;
    let sc, sN, sD = D;
    let tc, tN, tD = D;

    if (D < 0.0001) {
        sN = 0.0;
        sD = 1.0;
        tN = e;
        tD = c;
    } else {
        sN = (b * e - c * d);
        tN = (a * e - b * d);
        if (sN < 0.0) {
            sN = 0.0;
            tN = e;
            tD = c;
        } else if (sN > sD) {
            sN = sD;
            tN = e + b;
            tD = c;
        }
    }

    if (tN < 0.0) {
        tN = 0.0;
        if (-d < 0.0) sN = 0.0;
        else if (-d > a) sN = sD;
        else {
            sN = -d;
            sD = a;
        }
    } else if (tN > tD) {
        tN = tD;
        if ((-d + b) < 0.0) sN = 0;
        else if ((-d + b) > a) sN = sD;
        else {
            sN = (-d + b);
            sD = a;
        }
    }

    sc = (Math.abs(sN) < 0.0001 ? 0.0 : sN / sD);
    tc = (Math.abs(tN) < 0.0001 ? 0.0 : tN / tD);

    const dP = w.clone().add(u.clone().multiplyScalar(sc)).sub(v.clone().multiplyScalar(tc));
    return dP.length();
};

/**
 * checkIntersection
 * Checks if a candidate placement intersects with any existing components.
 * Robust check using line segments for pipes and point-vs-segment for others.
 */
export const checkIntersection = (
    position, // THREE.Vector3
    rotation, // THREE.Euler
    componentType,
    properties,
    existingComponents,
    excludeId = null
) => {
    // Walls are reference-only, never collide with anything
    if (componentType === 'wall') return false;

    const def = COMPONENT_DEFINITIONS[componentType];
    if (!def) return false;

    const radiusScale = properties?.radiusScale || 1;
    const length = properties?.length || def.defaultLength || 2;
    const od = properties?.od || def.defaultOD || (0.30 * radiusScale);
    const radius = od / 2;

    const quat = new THREE.Quaternion().setFromEuler(rotation);

    // Represent new component as points/segment
    const isPipe = componentType === 'straight' || componentType === 'vertical';
    let pStart, pEnd;

    if (isPipe) {
        pStart = new THREE.Vector3(0, 0, 0).applyQuaternion(quat).add(position);
        pEnd = new THREE.Vector3(0, length, 0).applyQuaternion(quat).add(position);
    }

    const pointsToCheck = [position.clone()];
    for (const socket of def.sockets) {
        const sPos = socket.position.clone();
        if (isPipe) {
            sPos.y = (socket.position.y + 1) * (length / 2);
        } else if (componentType === 'industrial-tank') {
            const hScale = (od + 0.5) / 2.7; // denominator matches default tankOD in PipeComponent
            const vScale = length / 4.0;
            const iConeHeight = length * 0.25;
            sPos.x *= hScale;
            sPos.z *= hScale;
            sPos.y = (sPos.y * vScale); // remove + iConeHeight as sPos is absolute from def
        } else if (componentType === 'tank') {
            sPos.y = (socket.position.y * (length / 2)) + (length / 2);
            sPos.x *= radiusScale;
            sPos.z *= radiusScale;
        } else {
            sPos.multiplyScalar(radiusScale);
        }
        pointsToCheck.push(sPos.applyQuaternion(quat).add(position));
    }

    // Broad phase optimization
    const maxPartDim = Math.max(od, length) * 1.5;

    for (const comp of existingComponents) {
        if (comp.id === excludeId) continue;
        if (comp.component_type === 'wall') continue;

        const otherDef = COMPONENT_DEFINITIONS[comp.component_type];
        if (!otherDef) continue;

        const otherPos = new THREE.Vector3(Number(comp.position_x) || 0, Number(comp.position_y) || 0, Number(comp.position_z) || 0);
        const otherQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(
            (Number(comp.rotation_x) || 0) * Math.PI / 180,
            (Number(comp.rotation_y) || 0) * Math.PI / 180,
            (Number(comp.rotation_z) || 0) * Math.PI / 180
        ));
        const otherRadiusScale = Number(comp.properties?.radiusScale) || 1;
        const otherLength = Number(comp.properties?.length) || 2;
        const otherRadius = (Number(comp.properties?.od) || (0.30 * otherRadiusScale)) / 2;

        const distToCenter = position.distanceTo(otherPos);
        const maxOtherDim = Math.max(otherRadius * 2, otherLength) * 2.0; // 🎯 Wider broad-phase to catch nearby parts
        if (distToCenter > (maxPartDim + maxOtherDim)) continue;

        const isOtherPipe = comp.component_type === 'straight' || comp.component_type === 'vertical';
        // Tightened threshold to prevent overlapping pipes while allowing socket connections
        const collisionThreshold = (radius + otherRadius) * 0.95; 

        if (isPipe && isOtherPipe) {
            // Segment vs Segment
            const opStart = new THREE.Vector3(0, 0, 0).applyQuaternion(otherQuat).add(otherPos);
            const opEnd = new THREE.Vector3(0, otherLength, 0).applyQuaternion(otherQuat).add(otherPos);
            if (distBetweenSegments(pStart, pEnd, opStart, opEnd) < collisionThreshold) return true;
        } else if (isPipe) {
            // Segment (new) vs Point (other)
            if (Math.sqrt(distPointToSegmentSq(otherPos, pStart, pEnd)) < collisionThreshold) return true;
        } else if (isOtherPipe) {
            // Point (new) vs Segment (other)
            const opStart = new THREE.Vector3(0, 0, 0).applyQuaternion(otherQuat).add(otherPos);
            const opEnd = new THREE.Vector3(0, otherLength, 0).applyQuaternion(otherQuat).add(otherPos);
            for (const p of pointsToCheck) {
                if (Math.sqrt(distPointToSegmentSq(p, opStart, opEnd)) < collisionThreshold) return true;
            }
        } else {
            // Point vs Point (default)
            for (const p of pointsToCheck) {
                if (p.distanceTo(otherPos) < collisionThreshold) return true;
            }
        }
    }

    return false;
};

export const findSnapPoint = (
    raycaster,
    components,
    placingType,
    viewMode = 'iso',
    placingTemplate = null
) => {
    // --- PRE-PROCESSING ---
    // ASSEMBLY SUPPORT: use first part's definition as the placing type
    let effectiveType = placingType;
    if (placingType === 'assembly' && placingTemplate?.parts?.[0]) {
        effectiveType = placingTemplate.parts[0].component_type || placingTemplate.parts[0].type;
    }

    const getDynamicSocketPos = (component, socket) => {
        const length = component.properties?.length || 2;
        const radiusScale = component.properties?.radiusScale || 1;
        const od = component.properties?.od || (0.30 * radiusScale);
        const radiusOuter = od / 2;
        const pos = socket.position.clone();

        // Adjust positions based on component type and dynamic properties
        switch (component.component_type) {
            case 'straight':
            case 'vertical':
                // New system: Maps -1->0, 0->L/2, 1->L
                pos.y = (socket.position.y + 1) * (length / 2);
                break;
            case 'industrial-tank': {
                const tankRadius = Math.max(radiusOuter * 2, 1.0);
                const legHeight = tankRadius * 1.5;
                const floorOffset = (length / 2) + legHeight;
                pos.x *= (tankRadius + 0.1); 
                pos.z *= (tankRadius + 0.1);
                pos.y = (pos.y * (length / 2)) + floorOffset;
                break;
            }
            case 'tank': {
                const tankRadius = Math.max(radiusOuter * 2, 1.0);
                const floorOffset = length / 2;
                pos.x *= tankRadius;
                pos.z *= tankRadius;
                pos.y = (pos.y * (length / 2)) + floorOffset;
                break;
            }
            default:
                // ALL other Fittings (elbow, tee, valve, reducer, flange, etc.) scale by radiusScale
                pos.multiplyScalar(radiusScale);
                break;
        }
        return pos;
    };

    // --- Ground/Background Placement Fallback ---
    // Top and ISO use Y=0 ground. Front uses Z=0 vertical plane.
    const fallbackPlane = (viewMode === 'front')
        ? new THREE.Plane(new THREE.Vector3(0, 0, 1), 0) // Front view: Z=0
        : new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); // Others: Y=0

    const fallbackTarget = new THREE.Vector3();
    const hasFallbackIntersect = raycaster.ray.intersectPlane(fallbackPlane, fallbackTarget);

    const getFallbackSnap = () => {
        if (!hasFallbackIntersect) return null;
        const target = fallbackTarget.clone();

        // Round to grid
        target.x = Math.round(target.x);
        target.y = Math.round(target.y);
        target.z = Math.round(target.z);

        // Ground Offset: Ensure component sits ON TOP of the grid
        const properties = placingTemplate?.properties || {};
        const lengthVal = properties.length || 2.0;
        const od = properties.od || (0.30 * (properties.radiusScale || 1));
        const radiusVal = od / 2;

        // Is it a vertical pipe orientation?
        // In our app, default rotation (0,0,0) for 'straight'/'vertical' is a vertical cylinder.
        const isVertical = effectiveType === 'vertical' || effectiveType === 'straight';
        const isTank = effectiveType === 'tank' || effectiveType === 'industrial-tank';

        if (viewMode !== 'front') {
            // Horizontal ground placement
            if (isTank) {
                target.y = 0;
            } else {
                target.y = isVertical ? (lengthVal / 2) : radiusVal;
            }
        } else {
            // Front view vertical backplane placement
            target.z = radiusVal;
        }

        // --- ORIGIN SNAPPING ---
        // For the first component, be very aggressive (4m radius)
        // For subsequent components, be helpful (1.5m radius)
        const snapThreshold = components.length === 0 ? 4.0 : 1.5;

        const originPoint = viewMode !== 'front'
            ? new THREE.Vector3(0, target.y, 0)
            : new THREE.Vector3(0, 0, radiusVal);

        // Check if current target is near origin
        const distToOrigin = target.distanceTo(originPoint);
        if (distToOrigin < snapThreshold) {
            const rot = new THREE.Euler(0, 0, 0);
            const isIntersecting = checkIntersection(originPoint, rot, effectiveType, properties, components);
            return {
                position: originPoint,
                rotation: rot,
                isValid: true,
                isSnappedToOrigin: true,
                isIntersecting,
                snapSocketWorldPos: originPoint.clone()
            };
        }

        const rot = new THREE.Euler(0, 0, 0);
        const isIntersecting = checkIntersection(target, rot, effectiveType, properties, components);
        return {
            position: target,
            rotation: rot,
            isValid: true,
            isIntersecting,
            snapSocketWorldPos: target.clone()
        };
    };

    if (components.length === 0) {
        const fallback = getFallbackSnap();
        if (fallback) return fallback;
        return {
            position: new THREE.Vector3(),
            rotation: new THREE.Euler(),
            isValid: false,
            isIntersecting: false,
            snapSocketWorldPos: new THREE.Vector3()
        };
    }

    const placingDef = COMPONENT_DEFINITIONS[effectiveType];
    if (!placingDef) {
        const fallback = getFallbackSnap();
        if (fallback) return fallback;
        return {
            position: new THREE.Vector3(),
            rotation: new THREE.Euler(),
            isValid: false,
            isIntersecting: false,
            snapSocketWorldPos: new THREE.Vector3()
        };
    }

    let bestSnap = {
        position: new THREE.Vector3(),
        rotation: new THREE.Euler(),
        isValid: false,
        snapSocketWorldPos: new THREE.Vector3()
    };
    let globalBestScore = Infinity;

    const ray = raycaster.ray;
    // 🎯 CRITICAL FIX: Allow 2-socket components (Elbows/L-joints) to rotate around connection axes.
    // This enables "Real-Time" alignment so fittings can point in any of the 4 cardinal directions.
    const isMultiSocket = placingDef.sockets.length >= 2;

    // -----------------------------------------------------------
    // PHASE 1: Build a cache of ALL open world-space sockets
    // in the scene for fast multi-match lookups.
    // -----------------------------------------------------------
    const worldSockets = []; // { position: Vector3, direction: Vector3, compId: string }
    for (const comp of components) {
        const def = COMPONENT_DEFINITIONS[comp.component_type];
        if (!def) continue;

        const pos = new THREE.Vector3(Number(comp.position_x) || 0, Number(comp.position_y) || 0, Number(comp.position_z) || 0);
        const rot = new THREE.Euler(
            (Number(comp.rotation_x) || 0) * Math.PI / 180,
            (Number(comp.rotation_y) || 0) * Math.PI / 180,
            (Number(comp.rotation_z) || 0) * Math.PI / 180
        );
        const quat = new THREE.Quaternion().setFromEuler(rot);

        for (const socket of def.sockets) {
            const wPos = getDynamicSocketPos(comp, socket).applyQuaternion(quat).add(pos);
            const wDir = socket.direction.clone().applyQuaternion(quat).normalize();
            worldSockets.push({ position: wPos, direction: wDir, compId: comp.id });
        }
    }

    // -----------------------------------------------------------
    // PHASE 2: For each candidate snap, score it. Multi-socket
    // components get a bonus for each additional socket that
    // aligns with a scene socket.
    // -----------------------------------------------------------
    const MULTI_MATCH_BONUS = -2.0; // Negative = better score
    const SOCKET_ALIGN_TOLERANCE_SQ = 0.25; // 0.5m distance tolerance squared
    const DIR_ALIGN_THRESHOLD = -0.8; // dot product threshold (opposing dirs)

    const countExtraMatches = (candidatePos, candidateQuat, primaryTargetCompId) => {
        let matches = 0;
        for (const plSocket of placingDef.sockets) {
            const plWorldPos = getDynamicSocketPos(
                { component_type: effectiveType, properties: placingTemplate?.properties || {} },
                plSocket
            ).applyQuaternion(candidateQuat).add(candidatePos);

            const plWorldDir = plSocket.direction.clone().applyQuaternion(candidateQuat).normalize();

            for (const ws of worldSockets) {
                // Don't count the primary connection again
                if (ws.compId === primaryTargetCompId && matches === 0) continue;

                const distSq = plWorldPos.distanceToSquared(ws.position);
                if (distSq > SOCKET_ALIGN_TOLERANCE_SQ) continue;

                // Directions should be opposing (dot product ~ -1)
                const dot = plWorldDir.dot(ws.direction);
                if (dot < DIR_ALIGN_THRESHOLD) {
                    matches++;
                    break; // One match per placing socket is enough
                }
            }
        }
        return matches;
    };

    for (const targetComp of components) {
        const targetDef = COMPONENT_DEFINITIONS[targetComp.component_type];
        if (!targetDef) continue;

        const targetPos = new THREE.Vector3(targetComp.position_x, targetComp.position_y, targetComp.position_z);

        // Broad phase: skip distant components
        if (ray.distanceSqToPoint(targetPos) > 225.0) continue;

        const targetRot = new THREE.Euler(
            (targetComp.rotation_x * Math.PI) / 180,
            (targetComp.rotation_y * Math.PI) / 180,
            (targetComp.rotation_z * Math.PI) / 180
        );
        const targetQuat = new THREE.Quaternion().setFromEuler(targetRot);

        for (const targetSocket of targetDef.sockets) {
            const worldTargetSocketPos = getDynamicSocketPos(targetComp, targetSocket)
                .applyQuaternion(targetQuat)
                .add(targetPos);

            const distToTargetSocket = ray.distanceSqToPoint(worldTargetSocketPos);
            if (distToTargetSocket > 3.5) continue;

            for (const plSocket of placingDef.sockets) {
                const targetDir = targetSocket.direction.clone().applyQuaternion(targetQuat).normalize();
                const placingDir = plSocket.direction.clone().normalize();

                // Align placing socket direction to oppose target socket direction
                const alignQuat = new THREE.Quaternion().setFromUnitVectors(
                    placingDir,
                    targetDir.clone().negate()
                );

                // -----------------------------------------------------------
                // AUTO-FIT: For multi-socket components, test 4 rotations
                // around the connection axis to find the best fit.
                // -----------------------------------------------------------
                const rotationsToTest = isMultiSocket
                    ? [0, Math.PI / 2, Math.PI, -Math.PI / 2]
                    : [0]; // Single/double socket: no spin needed

                for (const spin of rotationsToTest) {
                    const spinQuat = new THREE.Quaternion().setFromAxisAngle(
                        targetDir.clone().negate(), spin
                    );
                    const candidateQuat = spinQuat.clone().multiply(alignQuat);
                    const candidateRot = new THREE.Euler().setFromQuaternion(candidateQuat);

                    const plSocketOffset = getDynamicSocketPos(
                        { component_type: effectiveType, properties: placingTemplate?.properties || {} },
                        plSocket
                    ).applyQuaternion(candidateQuat);

                    const finalPos = worldTargetSocketPos.clone().sub(plSocketOffset);

                    const distToFinalCenter = ray.distanceSqToPoint(finalPos);
                    let score = distToTargetSocket + distToFinalCenter * 0.5;

                    // Multi-match bonus: reward orientations that connect more sockets
                    if (isMultiSocket) {
                        const extraMatches = countExtraMatches(finalPos, candidateQuat, targetComp.id);
                        score += extraMatches * MULTI_MATCH_BONUS;
                    }

                    // Intersection Penalty: Massive penalty for collision rotations
                    const isIntersecting = checkIntersection(
                        finalPos,
                        candidateRot,
                        effectiveType,
                        placingTemplate?.properties || {},
                        components,
                        targetComp.id
                    );

                    if (isIntersecting) {
                        score += 5000; // Force non-colliding orientation
                    }

                    if (score < globalBestScore) {
                        globalBestScore = score;
                        bestSnap = {
                            position: finalPos,
                            rotation: candidateRot,
                            isValid: true,
                            targetComponentId: targetComp.id,
                            targetSocketIndex: targetDef.sockets.indexOf(targetSocket),
                            placingSocketIndex: placingDef.sockets.indexOf(plSocket),
                            isSnappedToSocket: true,
                            isIntersecting,
                            snapSocketWorldPos: worldTargetSocketPos.clone(), // actual contact point for bubble
                        };
                    }
                }
            }
        }
    }

    const finalResult = bestSnap.isValid ? bestSnap : (getFallbackSnap() || bestSnap);
    if (!finalResult.isSnappedToSocket) finalResult.isSnappedToSocket = false;
    if (finalResult.isIntersecting === undefined) finalResult.isIntersecting = false;
    // For fallback (ground) snaps, the snap socket world pos is just the placement position
    if (!finalResult.snapSocketWorldPos) finalResult.snapSocketWorldPos = finalResult.position.clone();
    return finalResult;
};

/**
 * findSnapForTransform
 * Used to find a snap point during a drag/transform operation for already placed components.
 */
export const findSnapForTransform = (
    movingIds,
    allComponents,
    pivotPosition, // THREE.Vector3
    pivotRotation, // THREE.Euler
    isRotationMode = false
) => {
    const fixedComponents = allComponents.filter(c => !movingIds.includes(c.id));
    if (fixedComponents.length === 0) return null;

    // Build cache of fixed world sockets
    const fixedWorldSockets = [];
    for (const comp of fixedComponents) {
        const def = COMPONENT_DEFINITIONS[comp.component_type];
        if (!def) continue;

        const pos = new THREE.Vector3(comp.position_x, comp.position_y, comp.position_z);
        const rot = new THREE.Euler(
            (comp.rotation_x * Math.PI) / 180,
            (comp.rotation_y * Math.PI) / 180,
            (comp.rotation_z * Math.PI) / 180
        );
        const quat = new THREE.Quaternion().setFromEuler(rot);

        for (const socket of def.sockets) {
            const wPos = socket.position.clone().multiplyScalar(comp.properties?.radiusScale || 1).applyQuaternion(quat).add(pos);
            const wDir = socket.direction.clone().applyQuaternion(quat).normalize();
            fixedWorldSockets.push({ position: wPos, direction: wDir, compId: comp.id });
        }
    }

    const pivotQuat = new THREE.Quaternion().setFromEuler(pivotRotation);
    let bestSnap = null;
    let minScore = Infinity;

    // Thresholds
    const SNAP_DIST_THRESHOLD = 1.0;
    const SNAP_DIST_THRESHOLD_SQ = SNAP_DIST_THRESHOLD * SNAP_DIST_THRESHOLD;

    // For each moving component, check its sockets against all fixed sockets
    for (const mId of movingIds) {
        const comp = allComponents.find(c => c.id === mId);
        if (!comp) continue;
        const def = COMPONENT_DEFINITIONS[comp.component_type];
        if (!def) continue;

        // For now, let's just use the First Moving Component as the snap driver for simplicity and performance.
        if (mId !== movingIds[0]) continue;

        const deltaPos = pivotPosition.clone();
        const deltaQuat = pivotQuat.clone();

        for (const mSocket of def.sockets) {
            const mSocketWorldPosAtPivot = mSocket.position.clone()
                .multiplyScalar(comp.properties?.radiusScale || 1)
                .applyQuaternion(deltaQuat)
                .add(deltaPos);

            const mSocketWorldDirAtPivot = mSocket.direction.clone()
                .applyQuaternion(deltaQuat)
                .normalize();

            for (const fSocket of fixedWorldSockets) {
                const distSq = mSocketWorldPosAtPivot.distanceToSquared(fSocket.position);
                if (distSq < SNAP_DIST_THRESHOLD_SQ) {
                    const dot = mSocketWorldDirAtPivot.dot(fSocket.direction);
                    if (dot < -0.8) {
                        const score = distSq;
                        if (score < minScore) {
                            minScore = score;

                            const mSocketOffset = mSocket.position.clone()
                                .multiplyScalar(comp.properties?.radiusScale || 1)
                                .applyQuaternion(deltaQuat);

                            const finalPos = fSocket.position.clone().sub(mSocketOffset);
                            const isIntersecting = checkIntersection(
                                finalPos,
                                pivotRotation,
                                comp.component_type,
                                comp.properties,
                                allComponents,
                                fSocket.compId
                            );

                            bestSnap = {
                                position: finalPos,
                                rotation: deltaQuat,
                                socketPos: fSocket.position.clone(),
                                isIntersecting
                            };
                        }
                    }
                }
            }
        }
    }

    return bestSnap;
};
/**
 * calculateManualConnection
 * Calculates the position and rotation needed for component B to connect to component A
 * at specific socket indices.
 */
export const calculateManualConnection = (compA, socketIdxA, compB, socketIdxB) => {
    const defA = COMPONENT_DEFINITIONS[compA.component_type || compA.type];
    const defB = COMPONENT_DEFINITIONS[compB.component_type || compB.type];
    if (!defA || !defB) return null;

    const socketA = defA.sockets[socketIdxA];
    const socketB = defB.sockets[socketIdxB];
    if (!socketA || !socketB) return null;

    // 1. Get world position and direction of Target Socket (A)
    const quatA = new THREE.Quaternion().setFromEuler(new THREE.Euler(
        (compA.rotation_x || 0) * (Math.PI / 180),
        (compA.rotation_y || 0) * (Math.PI / 180),
        (compA.rotation_z || 0) * (Math.PI / 180)
    ));
    const posA = new THREE.Vector3(compA.position_x, compA.position_y, compA.position_z);

    // Use the dynamic position logic from earlier
    const getDynamicSocketPos = (component, socket) => {
        const length = component.properties?.length || 2;
        const radiusScale = component.properties?.radiusScale || 1;
        const od = component.properties?.od || (0.30 * radiusScale);
        const radiusOuter = od / 2;
        const pos = socket.position.clone();
        if (component.component_type === 'straight' || component.component_type === 'vertical') {
            pos.y = (socket.position.y + 1) * (length / 2);
        } else if (component.component_type === 'industrial-tank') {
            const tankRadius = Math.max(radiusOuter * 2, 1.0);
            const floorOffset = (length / 2) + (tankRadius * 1.5);
            pos.x *= (tankRadius + 0.1);
            pos.z *= (tankRadius + 0.1);
            pos.y = (pos.y * (length / 2)) + floorOffset;
        } else if (component.component_type === 'tank') {
            const tankRadius = Math.max(radiusOuter * 2, 1.0);
            const floorOffset = length / 2;
            pos.x *= tankRadius;
            pos.z *= tankRadius;
            pos.y = (pos.y * (length / 2)) + floorOffset;
        } else {
            // General fittings
            pos.multiplyScalar(radiusScale);
        }
        return pos;
    };

    const localSocketAPos = getDynamicSocketPos(compA, socketA);
    const worldSocketAPos = localSocketAPos.applyQuaternion(quatA).add(posA);
    const worldSocketADir = socketA.direction.clone().applyQuaternion(quatA).normalize();

    // 2. Calculate target rotation for B
    // We want B's socket direction to be opposite to A's socket direction
    const targetDirForB = worldSocketADir.clone().negate();
    const localSocketBDir = socketB.direction.clone().normalize();

    // Find quaternion that aligns localSocketBDir to targetDirForB
    const alignQuat = new THREE.Quaternion().setFromUnitVectors(localSocketBDir, targetDirForB);
    const targetRotationB = new THREE.Euler().setFromQuaternion(alignQuat);

    // 3. Calculate target position for B
    // finalPosB + rotatedLocalSocketB = worldSocketAPos
    // finalPosB = worldSocketAPos - rotatedLocalSocketB
    const localSocketBPos = getDynamicSocketPos(compB, socketB);
    const rotatedLocalSocketBPos = localSocketBPos.applyQuaternion(alignQuat);
    const targetPositionB = worldSocketAPos.clone().sub(rotatedLocalSocketBPos);

    return {
        position: targetPositionB,
        rotation: targetRotationB,
        socketWorldPos: worldSocketAPos.clone()
    };
};
