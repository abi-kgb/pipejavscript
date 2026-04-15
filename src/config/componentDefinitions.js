import * as THREE from 'three';

export const MATERIALS = {
    steel: { id: 'steel', name: 'Carbon Steel', density: 7850, color: '#78716c' },
    ms: { id: 'ms', name: 'Mild Steel', density: 7850, color: '#a8a29e' },
    gi: { id: 'gi', name: 'Galvanized Iron', density: 7850, color: '#d1d5db' },
    ss304: { id: 'ss304', name: 'SS 304', density: 8000, color: '#e2e8f0' },
    ss316: { id: 'ss316', name: 'SS 316', density: 8000, color: '#bfdbfe' },
    copper: { id: 'copper', name: 'Copper', density: 8960, color: '#c2410c' },
    brass: { id: 'brass', name: 'Brass', density: 8500, color: '#ca8a04' },
    ci: { id: 'ci', name: 'Cast Iron', density: 7200, color: '#44403c' },
    pvc: { id: 'pvc', name: 'PVC (Polyvinyl)', density: 1400, color: '#93c5fd' },
    cpvc: { id: 'cpvc', name: 'CPVC', density: 1550, color: '#fde68a' },
    upvc: { id: 'upvc', name: 'UPVC', density: 1450, color: '#6ee7b7' },
    hdpe: { id: 'hdpe', name: 'HDPE (Black)', density: 950, color: '#1e293b' },
    sq_steel: { id: 'sq_steel', name: 'Square Steel (SHS)', density: 7850, color: '#64748b' },
    sq_aluminium: { id: 'sq_aluminium', name: 'Square Aluminium (SAS)', density: 2700, color: '#cbd5e1' },
    industrial_yellow: { id: 'industrial_yellow', name: 'Industrial Tank Yellow', density: 7850, color: '#fbbf24' },
    wall_concrete: { id: 'wall_concrete', name: 'Reference Wall', density: 0, color: '#94a3b8' },
};

export const COMPONENT_DEFINITIONS = {
    straight: {
        type: 'straight',
        label: 'Straight Pipe',
        weightFactor: 0.1,
        standardWeight: 'Sch 40',
        defaultMaterial: 'pvc',
        defaultOD: 0.30,
        defaultWT: 0.01,
        sockets: [
            { position: new THREE.Vector3(0, 1, 0), direction: new THREE.Vector3(0, 1, 0) },
            { position: new THREE.Vector3(0, -1, 0), direction: new THREE.Vector3(0, -1, 0) },
            { position: new THREE.Vector3(0, 0, 0), direction: new THREE.Vector3(0, 1, 0) }, // Center Socket
        ],
    },
    elbow: {
        type: 'elbow',
        label: '90° Elbow',
        weightPerPiece: 1.2,
        defaultMaterial: 'pvc',
        defaultOD: 0.30,
        defaultWT: 0.01,
        sockets: [
            { position: new THREE.Vector3(1, 0, 0), direction: new THREE.Vector3(1, 0, 0) },
            { position: new THREE.Vector3(0, 1, 0), direction: new THREE.Vector3(0, 1, 0) },
        ],
    },
    'elbow-45': {
        type: 'elbow-45',
        label: '45° Elbow',
        weightPerPiece: 0.9,
        defaultMaterial: 'pvc',
        defaultOD: 0.30,
        defaultWT: 0.01,
        sockets: [
            { position: new THREE.Vector3(0, 0.7, 0), direction: new THREE.Vector3(0, 1, 0) },
            { position: new THREE.Vector3(0.5, 0.5, 0), direction: new THREE.Vector3(0.707, 0.707, 0) },
        ],
    },
    vertical: {
        type: 'vertical',
        label: 'Vertical Pipe',
        weightFactor: 0.1,
        defaultMaterial: 'pvc',
        defaultOD: 0.30,
        defaultWT: 0.01,
        sockets: [
            { position: new THREE.Vector3(0, 1, 0), direction: new THREE.Vector3(0, 1, 0) },
            { position: new THREE.Vector3(0, -1, 0), direction: new THREE.Vector3(0, -1, 0) },
            { position: new THREE.Vector3(0, 0, 0), direction: new THREE.Vector3(0, 1, 0) }, // Center Socket
        ],
    },
    't-joint': {
        type: 't-joint',
        label: 'T-Joint (Tee)',
        weightPerPiece: 1.8,
        defaultMaterial: 'pvc',
        defaultOD: 0.30,
        defaultWT: 0.01,
        sockets: [
            // Main body along Y axis: top cap at +0.75, bottom cap at -0.75
            { position: new THREE.Vector3(0, 0.75, 0), direction: new THREE.Vector3(0, 1, 0) },
            { position: new THREE.Vector3(0, -0.75, 0), direction: new THREE.Vector3(0, -1, 0) },
            // Branch along X axis: opens at +0.75 on X
            { position: new THREE.Vector3(0.75, 0, 0), direction: new THREE.Vector3(1, 0, 0) },
        ],
    },
    reducer: {
        type: 'reducer',
        label: 'Pipe Reducer',
        weightPerPiece: 1.1,
        defaultMaterial: 'pvc',
        defaultOD: 0.30,
        defaultWT: 0.01,
        sockets: [
            { position: new THREE.Vector3(0, 0.4, 0), direction: new THREE.Vector3(0, 1, 0) },
            { position: new THREE.Vector3(0, -0.4, 0), direction: new THREE.Vector3(0, -1, 0) },
        ],
    },
    flange: {
        type: 'flange',
        label: 'Industrial Flange',
        weightPerPiece: 2.5,
        defaultMaterial: 'pvc',
        defaultOD: 0.50,
        defaultWT: 0.01,
        sockets: [
            { position: new THREE.Vector3(0, 0.25, 0), direction: new THREE.Vector3(0, 1, 0) },
            { position: new THREE.Vector3(0, -0.075, 0), direction: new THREE.Vector3(0, -1, 0) },
        ],
    },
    union: {
        type: 'union',
        label: 'Pipe Union',
        weightPerPiece: 1.4,
        defaultMaterial: 'pvc',
        defaultOD: 0.35,
        defaultWT: 0.01,
        sockets: [
            { position: new THREE.Vector3(0, 0.3, 0), direction: new THREE.Vector3(0, 1, 0) },
            { position: new THREE.Vector3(0, -0.3, 0), direction: new THREE.Vector3(0, -1, 0) },
        ],
    },
    cross: {
        type: 'cross',
        label: 'Cross Fitting',
        weightPerPiece: 2.2,
        defaultMaterial: 'pvc',
        defaultOD: 0.30,
        defaultWT: 0.01,
        sockets: [
            { position: new THREE.Vector3(1, 0, 0), direction: new THREE.Vector3(1, 0, 0) },
            { position: new THREE.Vector3(-1, 0, 0), direction: new THREE.Vector3(-1, 0, 0) },
            { position: new THREE.Vector3(0, 1, 0), direction: new THREE.Vector3(0, 1, 0) },
            { position: new THREE.Vector3(0, -1, 0), direction: new THREE.Vector3(0, -1, 0) },
        ],
    },
    coupling: {
        type: 'coupling',
        label: 'Pipe Coupling',
        weightPerPiece: 0.6,
        defaultMaterial: 'pvc',
        defaultOD: 0.34,
        defaultWT: 0.01,
        sockets: [
            { position: new THREE.Vector3(0, 0.3, 0), direction: new THREE.Vector3(0, 1, 0) },
            { position: new THREE.Vector3(0, -0.3, 0), direction: new THREE.Vector3(0, -1, 0) },
        ],
    },
    plug: {
        type: 'plug',
        label: 'Pipe Plug',
        weightPerPiece: 0.2,
        defaultMaterial: 'pvc',
        defaultOD: 0.30,
        defaultWT: 0.01,
        sockets: [
            { position: new THREE.Vector3(0, -0.1, 0), direction: new THREE.Vector3(0, -1, 0) },
        ],
    },
    valve: {
        type: 'valve',
        label: 'Control Valve',
        weightPerUnit: 3.5, // kg per piece
        standardWeight: 'Sch 40 / Std. Wt.',
        defaultMaterial: 'pvc',
        sockets: [
            { position: new THREE.Vector3(0, 0.75, 0), direction: new THREE.Vector3(0, 1, 0) },
            { position: new THREE.Vector3(0, -0.75, 0), direction: new THREE.Vector3(0, -1, 0) },
        ],
    },
    filter: {
        type: 'filter',
        label: 'Industrial Filter',
        weightPerUnit: 5.0, // kg per piece
        standardWeight: 'Standard Weight',
        sockets: [
            { position: new THREE.Vector3(0, 0.7, 0), direction: new THREE.Vector3(0, 1, 0) },
            { position: new THREE.Vector3(0, -0.7, 0), direction: new THREE.Vector3(0, -1, 0) },
        ],
    },
    tank: {
        type: 'tank',
        label: 'Storage Tank',
        weightPerUnit: 25.0, // kg per piece (base)
        standardWeight: 'Standard Weight',
        defaultOD: 2.0,
        defaultLength: 2.0,
        defaultWT: 0.05,
        sockets: [
            { position: new THREE.Vector3(0, 1, 0), direction: new THREE.Vector3(0, 1, 0) },   // Top of dome
            { position: new THREE.Vector3(0, -1, 0), direction: new THREE.Vector3(0, -1, 0) }, // Bottom face
        ],
    },
    cap: {
        type: 'cap',
        label: 'Pipe Cap',
        weightPerUnit: 0.3, // kg per piece
        standardWeight: 'Sch 40 / Std. Wt.',
        sockets: [
            { position: new THREE.Vector3(0, -0.15, 0), direction: new THREE.Vector3(0, -1, 0) },
        ],
    },
    'water-tap': {
        type: 'water-tap',
        weightPerUnit: 0.8,
        standardWeight: 'Standard Chrome',
        defaultMaterial: 'brass',
        defaultOD: 0.25,
        defaultWT: 0.015,
        sockets: [
            { position: new THREE.Vector3(0, -0.4, 0), direction: new THREE.Vector3(0, -1, 0) },
        ],
    },
    cylinder: {
        type: 'cylinder',
        label: 'Reference Cylinder',
        weightFactor: 0.15, // Solider than pipe
        defaultMaterial: 'pvc',
        defaultOD: 1.0,
        sockets: [
            { position: new THREE.Vector3(0, 1, 0), direction: new THREE.Vector3(0, 1, 0) },
            { position: new THREE.Vector3(0, -1, 0), direction: new THREE.Vector3(0, -1, 0) },
        ],
    },
    cube: {
        type: 'cube',
        weightFactor: 0.2,
        defaultMaterial: 'pvc',
        defaultOD: 1.0,
        sockets: [
            { position: new THREE.Vector3(1, 0, 0), direction: new THREE.Vector3(1, 0, 0) },
            { position: new THREE.Vector3(-1, 0, 0), direction: new THREE.Vector3(-1, 0, 0) },
            { position: new THREE.Vector3(0, 1, 0), direction: new THREE.Vector3(0, 1, 0) },
            { position: new THREE.Vector3(0, -1, 0), direction: new THREE.Vector3(0, -1, 0) },
            { position: new THREE.Vector3(0, 0, 1), direction: new THREE.Vector3(0, 0, 1) },
            { position: new THREE.Vector3(0, 0, -1), direction: new THREE.Vector3(0, 0, -1) },
        ],
    },
    cone: {
        type: 'cone',
        weightFactor: 0.1,
        defaultMaterial: 'pvc',
        defaultOD: 1.0,
        sockets: [
            { position: new THREE.Vector3(0, 1, 0), direction: new THREE.Vector3(0, 1, 0) }, // Tip
            { position: new THREE.Vector3(0, 0, 0), direction: new THREE.Vector3(0, -1, 0) }, // Base (center)
        ],
    },
    'industrial-tank': {
        type: 'industrial-tank',
        label: 'Heavy Industrial Tank',
        weightPerUnit: 45.0,
        standardWeight: 'Standard HP',
        defaultOD: 2.2,
        defaultLength: 4.0,
        defaultWT: 0.08,
        defaultMaterial: 'industrial_yellow',
        sockets: [
            { position: new THREE.Vector3(0, 1.0, 0), direction: new THREE.Vector3(0, 1, 0) },   // Top face
            { position: new THREE.Vector3(1, 0.25, 0), direction: new THREE.Vector3(1, 0, 0) }, // Side High X+
            { position: new THREE.Vector3(-1, 0.25, 0), direction: new THREE.Vector3(-1, 0, 0) }, // Side High X-
            { position: new THREE.Vector3(0, 0.25, 1), direction: new THREE.Vector3(0, 0, 1) }, // Side High Z+
            { position: new THREE.Vector3(0, 0.25, -1), direction: new THREE.Vector3(0, 0, -1) }, // Side High Z-
            { position: new THREE.Vector3(1, -0.25, 0), direction: new THREE.Vector3(1, 0, 0) }, // Side Low X+
            { position: new THREE.Vector3(-1, -0.25, 0), direction: new THREE.Vector3(-1, 0, 0) }, // Side Low X-
        ],
    },
    wall: {
        type: 'wall',
        label: 'Reference Wall',
        weightFactor: 0,
        defaultMaterial: 'wall_concrete',
        defaultOD: 10, // Width
        defaultWT: 0.2, // Thickness
        defaultLength: 10, // Height
        sockets: [
            { position: new THREE.Vector3(0, 0, 0), direction: new THREE.Vector3(0, 0, 1) },
        ],
    },
    'y-cross': {
        type: 'y-cross', weightPerPiece: 2.5, defaultMaterial: 'pvc', defaultOD: 0.30,
        sockets: [
            { position: new THREE.Vector3(0, 0.75, 0), direction: new THREE.Vector3(0, 1, 0) },
            { position: new THREE.Vector3(0, -0.75, 0), direction: new THREE.Vector3(0, -1, 0) },
            { position: new THREE.Vector3(0.5, 0.5, 0), direction: new THREE.Vector3(0.7, 0.7, 0) },
            { position: new THREE.Vector3(-0.5, 0.5, 0), direction: new THREE.Vector3(-0.7, 0.7, 0) },
        ]
    },
    'stere-cross': {
        type: 'stere-cross', weightPerPiece: 3.2, defaultMaterial: 'pvc', defaultOD: 0.30,
        sockets: [ // 3D cross (X, Y, Z axes)
            { position: new THREE.Vector3(1, 0, 0), direction: new THREE.Vector3(1, 0, 0) },
            { position: new THREE.Vector3(-1, 0, 0), direction: new THREE.Vector3(-1, 0, 0) },
            { position: new THREE.Vector3(0, 1, 0), direction: new THREE.Vector3(0, 1, 0) },
            { position: new THREE.Vector3(0, -1, 0), direction: new THREE.Vector3(0, -1, 0) },
            { position: new THREE.Vector3(0, 0, 1), direction: new THREE.Vector3(0, 0, 1) },
            { position: new THREE.Vector3(0, 0, -1), direction: new THREE.Vector3(0, 0, -1) },
        ]
    },
    's-trap': {
        type: 's-trap', weightPerPiece: 1.8, defaultMaterial: 'pvc', defaultOD: 0.30,
        sockets: [
            { position: new THREE.Vector3(0, 0.75, 0), direction: new THREE.Vector3(0, 1, 0) },
            { position: new THREE.Vector3(1, -0.75, 0), direction: new THREE.Vector3(0, -1, 0) },
        ]
    },
    'p-trap': {
        type: 'p-trap', weightPerPiece: 1.6, defaultMaterial: 'pvc', defaultOD: 0.30,
        sockets: [
            { position: new THREE.Vector3(0, 0.75, 0), direction: new THREE.Vector3(0, 1, 0) },
            { position: new THREE.Vector3(0.75, 0, 0), direction: new THREE.Vector3(1, 0, 0) },
        ]
    },
    'y-tee': {
        type: 'y-tee', weightPerPiece: 2.1, defaultMaterial: 'pvc', defaultOD: 0.30,
        sockets: [
            { position: new THREE.Vector3(0, 0.75, 0), direction: new THREE.Vector3(0, 1, 0) },
            { position: new THREE.Vector3(0, -0.75, 0), direction: new THREE.Vector3(0, -1, 0) },
            { position: new THREE.Vector3(0.5, 0.5, 0), direction: new THREE.Vector3(0.7, 0.7, 0) },
        ]
    },
    'h-pipe': {
        type: 'h-pipe', weightFactor: 0.2, defaultMaterial: 'pvc', defaultOD: 0.30,
        sockets: [
            { position: new THREE.Vector3(0.5, 1, 0), direction: new THREE.Vector3(0, 1, 0) },
            { position: new THREE.Vector3(0.5, -1, 0), direction: new THREE.Vector3(0, -1, 0) },
            { position: new THREE.Vector3(-0.5, 1, 0), direction: new THREE.Vector3(0, 1, 0) },
            { position: new THREE.Vector3(-0.5, -1, 0), direction: new THREE.Vector3(0, -1, 0) },
        ]
    },
    'expansion-joint': {
        type: 'expansion-joint', weightPerPiece: 4.5, defaultMaterial: 'pvc', defaultOD: 0.40,
        sockets: [
            { position: new THREE.Vector3(0, 0.5, 0), direction: new THREE.Vector3(0, 1, 0) },
            { position: new THREE.Vector3(0, -0.5, 0), direction: new THREE.Vector3(0, -1, 0) },
        ]
    },
    'rainwater-funnel': {
        type: 'rainwater-funnel', weightPerPiece: 3.8, defaultMaterial: 'pvc', defaultOD: 1.0,
        sockets: [
            { position: new THREE.Vector3(0, -0.5, 0), direction: new THREE.Vector3(0, -1, 0) },
        ]
    },
    clamp: {
        type: 'clamp', weightPerPiece: 0.2, defaultMaterial: 'gi', defaultOD: 0.35,
        sockets: [
            { position: new THREE.Vector3(0, 0, 0), direction: new THREE.Vector3(0, 1, 0) },
        ]
    },
    'hang-clamp': {
        type: 'hang-clamp', weightPerPiece: 0.3, defaultMaterial: 'gi', defaultOD: 0.35,
        sockets: [
            { position: new THREE.Vector3(0, 0, 0), direction: new THREE.Vector3(0, 1, 0) },
        ]
    },
    'equal-tee': {
        type: 'equal-tee', weightPerPiece: 1.8, defaultMaterial: 'pvc', defaultOD: 0.30,
        sockets: [
            { position: new THREE.Vector3(0, 0.75, 0), direction: new THREE.Vector3(0, 1, 0) },
            { position: new THREE.Vector3(0, -0.75, 0), direction: new THREE.Vector3(0, -1, 0) },
            { position: new THREE.Vector3(0.75, 0, 0), direction: new THREE.Vector3(1, 0, 0) },
        ]
    },
    'unequal-tee': {
        type: 'unequal-tee', weightPerPiece: 1.6, defaultMaterial: 'pvc', defaultOD: 0.30,
        sockets: [
            { position: new THREE.Vector3(0, 0.75, 0), direction: new THREE.Vector3(0, 1, 0) },
            { position: new THREE.Vector3(0, -0.75, 0), direction: new THREE.Vector3(0, -1, 0) },
            { position: new THREE.Vector3(0.5, 0, 0), direction: new THREE.Vector3(1, 0, 0) },
        ]
    },
    'equal-cross': {
        type: 'equal-cross', weightPerPiece: 2.2, defaultMaterial: 'pvc', defaultOD: 0.30,
        sockets: [
            { position: new THREE.Vector3(0.75, 0, 0), direction: new THREE.Vector3(1, 0, 0) },
            { position: new THREE.Vector3(-0.75, 0, 0), direction: new THREE.Vector3(-1, 0, 0) },
            { position: new THREE.Vector3(0, 0.75, 0), direction: new THREE.Vector3(0, 1, 0) },
            { position: new THREE.Vector3(0, -0.75, 0), direction: new THREE.Vector3(0, -1, 0) },
        ]
    },
    'unequal-cross': {
        type: 'unequal-cross', weightPerPiece: 2.0, defaultMaterial: 'pvc', defaultOD: 0.30,
        sockets: [
            { position: new THREE.Vector3(0.75, 0, 0), direction: new THREE.Vector3(1, 0, 0) },
            { position: new THREE.Vector3(-0.75, 0, 0), direction: new THREE.Vector3(-1, 0, 0) },
            { position: new THREE.Vector3(0, 0.5, 0), direction: new THREE.Vector3(0, 1, 0) },
            { position: new THREE.Vector3(0, -0.5, 0), direction: new THREE.Vector3(0, -1, 0) },
        ]
    },
    'water-stop-ring': {
        type: 'water-stop-ring', weightPerPiece: 0.1, defaultMaterial: 'gi', defaultOD: 0.30,
        sockets: [
            { position: new THREE.Vector3(0, 0, 0), direction: new THREE.Vector3(0, 1, 0) },
        ]
    },
    'unequal-coupling': {
        type: 'unequal-coupling', weightPerPiece: 0.8, defaultMaterial: 'pvc', defaultOD: 0.30,
        sockets: [
            { position: new THREE.Vector3(0, 0.3, 0), direction: new THREE.Vector3(0, 1, 0) },
            { position: new THREE.Vector3(0, -0.3, 0), direction: new THREE.Vector3(0, -1, 0) },
        ]
    },
    'lucency-cap': {
        type: 'lucency-cap', weightPerPiece: 0.2, defaultMaterial: 'pvc', defaultOD: 0.30,
        sockets: [
            { position: new THREE.Vector3(0, 0, 0), direction: new THREE.Vector3(0, -1, 0) },
        ]
    },
    'checking-hole': {
        type: 'checking-hole', weightPerPiece: 1.0, defaultMaterial: 'pvc', defaultOD: 0.30,
        sockets: [
            { position: new THREE.Vector3(0, 0.5, 0), direction: new THREE.Vector3(0, 1, 0) },
            { position: new THREE.Vector3(0, -0.5, 0), direction: new THREE.Vector3(0, -1, 0) },
        ]
    },
    'floor-leakage': {
        type: 'floor-leakage', weightPerPiece: 1.2, defaultMaterial: 'pvc', defaultOD: 0.30,
        sockets: [
            { position: new THREE.Vector3(0, 0, 0), direction: new THREE.Vector3(0, -1, 0) },
        ]
    },
    'expand-clamp': {
        type: 'expand-clamp', weightPerPiece: 0.4, defaultMaterial: 'gi', defaultOD: 0.35,
        sockets: [
            { position: new THREE.Vector3(0, 0, 0), direction: new THREE.Vector3(0, 1, 0) },
        ]
    },
    'clamp': {
        type: 'clamp', weightPerPiece: 0.2, defaultMaterial: 'gi', defaultOD: 0.32,
        sockets: [
            { position: new THREE.Vector3(0, 0, 0), direction: new THREE.Vector3(0, 1, 0) },
        ]
    },
    'hang-clamp': {
        type: 'hang-clamp', weightPerPiece: 0.3, defaultMaterial: 'gi', defaultOD: 0.32,
        type: 'clamp', label: 'Clamp', weightPerPiece: 0.2, defaultMaterial: 'gi', defaultOD: 0.32,
        sockets: [
            { position: new THREE.Vector3(0, 0, 0), direction: new THREE.Vector3(0, 1, 0) },
        ]
    },
    'hang-clamp': {
        type: 'hang-clamp', label: 'Hanging Clamp', weightPerPiece: 0.3, defaultMaterial: 'gi', defaultOD: 0.32,
        sockets: [
            { position: new THREE.Vector3(0, 0, 0), direction: new THREE.Vector3(0, 1, 0) },
        ]
    },
    'pump': {
        type: 'pump',
        label: 'Industrial Pump',
        weightPerUnit: 50.0, defaultMaterial: 'ci', defaultOD: 1.0,
        sockets: [
            { position: new THREE.Vector3(0, 0.5, 0), direction: new THREE.Vector3(0, 1, 0) },
            { position: new THREE.Vector3(0, -0.5, 0), direction: new THREE.Vector3(0, -1, 0) },
        ]
    },
    'globe-valve': {
        type: 'globe-valve',
        label: 'Globe Valve',
        weightPerUnit: 5.0, defaultMaterial: 'pvc', sockets: [
            { position: new THREE.Vector3(0, 0.75, 0), direction: new THREE.Vector3(0, 1, 0) },
            { position: new THREE.Vector3(0, -0.75, 0), direction: new THREE.Vector3(0, -1, 0) },
        ]
    },
    'check-valve': {
        type: 'check-valve',
        label: 'Check Valve',
        weightPerUnit: 3.0, defaultMaterial: 'pvc', sockets: [
            { position: new THREE.Vector3(0, 0.5, 0), direction: new THREE.Vector3(0, 1, 0) },
            { position: new THREE.Vector3(0, -0.5, 0), direction: new THREE.Vector3(0, -1, 0) },
        ]
    },
    'gate-valve': {
        type: 'gate-valve',
        label: 'Gate Valve',
        weightPerUnit: 4.5, defaultMaterial: 'pvc', sockets: [
            { position: new THREE.Vector3(0, 0.6, 0), direction: new THREE.Vector3(0, 1, 0) },
            { position: new THREE.Vector3(0, -0.6, 0), direction: new THREE.Vector3(0, -1, 0) },
        ]
    },
    'y-strainer': {
        type: 'y-strainer', weightPerUnit: 4.0, defaultMaterial: 'pvc', sockets: [
            { position: new THREE.Vector3(0, 0.7, 0), direction: new THREE.Vector3(0, 1, 0) },
            { position: new THREE.Vector3(0, -0.7, 0), direction: new THREE.Vector3(0, -1, 0) },
        ]
    },
    'blind-flange': {
        type: 'blind-flange', weightPerPiece: 2.5, defaultMaterial: 'pvc', defaultOD: 0.50, sockets: [
            { position: new THREE.Vector3(0, 0, 0), direction: new THREE.Vector3(0, -1, 0) },
        ]
    },
    'pressure-gauge': {
        type: 'pressure-gauge', weightPerUnit: 0.5, defaultMaterial: 'ss304', sockets: [
            { position: new THREE.Vector3(0, -0.2, 0), direction: new THREE.Vector3(0, -1, 0) },
        ]
    },
    'flow-meter': {
        type: 'flow-meter',
        label: 'Digital Flow Meter',
        weightPerUnit: 6.0, defaultMaterial: 'ss304', sockets: [
            { position: new THREE.Vector3(0, 0.8, 0), direction: new THREE.Vector3(0, 1, 0) },
            { position: new THREE.Vector3(0, -0.8, 0), direction: new THREE.Vector3(0, -1, 0) },
        ]
    },
    'pipe-support': {
        type: 'pipe-support', weightPerPiece: 1.5, defaultMaterial: 'gi', sockets: [
            { position: new THREE.Vector3(0, 0, 0), direction: new THREE.Vector3(0, 1, 0) },
        ]
    },
};

// Standardized constants for realistic fitting geometry
export const FITTING_CONSTANTS = {
    ELBOW_RADIUS: 1.0,  // Standardized bend radius
    PIPE_THICKNESS: 0.02,
    T_LENGTH: 1.5,
};

