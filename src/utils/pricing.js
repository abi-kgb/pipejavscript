import { COMPONENT_DEFINITIONS, MATERIALS } from '../config/componentDefinitions.js';

// ─────────────────────────────────────────────────────────────────
// Real Indian market pipe prices (₹) – Feb 2026
// Source: User provided price list / Database Config
// ─────────────────────────────────────────────────────────────────
export const GST_RATE = 0.18;

// Fallback values if DB config is not loaded yet
const DEFAULT_PIPE_PRICES = {
    pvc: 60, upvc: 70, cpvc: 85, ppr: 75, hdpe: 60, mdpe: 50,
    gi: 500, ms: 400, steel: 600, ss304: 350, ss316: 450,
    copper: 700, aluminium: 450, ci: 600, default: 100
};

const DEFAULT_FITTING_BASE_PRICES = {
    'elbow': 28, 'elbow-45': 22, 't-joint': 35, 'cross': 60,
    'reducer': 45, 'coupling': 22, 'union': 175, 'nipple': 155,
    'cap': 28, 'plug': 32, 'flange': 1600, 'valve': 1050, 
    'filter': 450, 'tank': 15000, 'water-tap': 450, 'default': 50
};

const DEFAULT_MULTIPLIERS = {
    pvc: 1.0, upvc: 1.2, cpvc: 2.5, hdpe: 1.5,
    gi: 8.0, ms: 6.0, steel: 10.0, ss304: 15.0, ss316: 25.0,
    copper: 20.0, brass: 15.0, ci: 7.0, default: 2.0
};

export const calculateComponentCost = (component, config = null) => {
    const def = COMPONENT_DEFINITIONS[component.component_type];
    if (!def) return 0;

    const materialKey = component.properties?.material || def.defaultMaterial || 'pvc';
    
    // Check if it's a pipe (measured in meters)
    const isPipe = ['straight', 'vertical', 'wall'].includes(component.component_type);
    
    // Use dynamic config if available
    const pipeRateMap = config?.PipePrice || DEFAULT_PIPE_PRICES;
    const fittingRateMap = config?.PipePrice || DEFAULT_FITTING_BASE_PRICES; // Reusing or separate?
    const multMap = config?.MaterialMultiplier || DEFAULT_MULTIPLIERS;

    if (isPipe) {
        const length = component.properties?.length || 2;
        const ratePerMeter = parseFloat(pipeRateMap[materialKey] || pipeRateMap.default || 100);
        return Math.round(length * ratePerMeter * 100) / 100;
    } else {
        // Fitting or Accessory (measured in pieces)
        // Note: Fitting base prices are currently in DEFAULT_FITTING_BASE_PRICES
        // If they are not in DB, we use fallbacks.
        const basePrice = parseFloat(DEFAULT_FITTING_BASE_PRICES[component.component_type] || DEFAULT_FITTING_BASE_PRICES.default || 50);
        const multiplier = parseFloat(multMap[materialKey] || multMap.default || 2.0);
        
        // Size scale impact (approximate based on radiusScale)
        const radiusScale = component.properties?.radiusScale || 1;
        const sizeImpact = Math.pow(radiusScale, 2); // Area/Volume impact
        
        return Math.round(basePrice * multiplier * sizeImpact * 100) / 100;
    }
};

export const calculateComponentWeight = (component) => {
    const def = COMPONENT_DEFINITIONS[component.component_type];
    if (!def || component.component_type === 'wall') return 0;

    const materialKey = component.properties?.material || def.defaultMaterial || 'pvc';
    const material = MATERIALS[materialKey];
    const density = material ? material.density : 1400;

    const length = component.properties?.length || 1;
    const radiusScale = component.properties?.radiusScale || 1;
    const od = component.properties?.od || (0.30 * radiusScale);
    const wt = component.properties?.wallThickness || (def.defaultWT || 0.02);
    const radiusOuter = od / 2;
    const radiusInner = Math.max(0, radiusOuter - wt);

    const crossSectionArea = Math.PI * (Math.pow(radiusOuter, 2) - Math.pow(radiusInner, 2));
    let volume = 0;

    switch (component.component_type) {
        case 'straight':
        case 'vertical':
            volume = crossSectionArea * length;
            break;
        case 'elbow':
            volume = crossSectionArea * (Math.PI / 2) * (1 * radiusScale);
            break;
        case 'elbow-45':
            volume = crossSectionArea * (Math.PI / 4) * (1 * radiusScale);
            break;
        case 't-joint':
            volume = crossSectionArea * (2.25 * radiusScale);
            break;
        case 'cross':
            volume = crossSectionArea * (4 * radiusScale);
            break;
        case 'reducer': {
            const h = 0.8 * radiusScale;
            const R1_out = radiusOuter, R2_out = radiusOuter * 0.6;
            const R1_in = radiusInner, R2_in = radiusInner * 0.6;
            volume = ((Math.PI * h / 3) * (R1_out * R1_out + R1_out * R2_out + R2_out * R2_out)) - 
                     ((Math.PI * h / 3) * (R1_in * R1_in + R1_in * R2_in + R2_in * R2_in));
            break;
        }
        case 'flange':
            volume = (Math.PI * Math.pow(radiusOuter * 1.8, 2) * (0.2 * radiusScale)) + (crossSectionArea * 0.1 * radiusScale);
            break;
        case 'union':
            volume = (crossSectionArea * 0.6 * radiusScale) + (Math.PI * Math.pow(radiusOuter * 1.3, 2) * 0.2 * radiusScale);
            break;
        case 'coupling':
            volume = crossSectionArea * 0.5 * radiusScale;
            break;
        case 'cap':
            volume = (Math.PI * Math.pow(radiusOuter, 2) * 0.3 * radiusScale) + ((2/3) * Math.PI * Math.pow(radiusOuter * 1.2, 3));
            break;
        case 'tank':
            volume = (Math.PI * (Math.pow(radiusOuter, 2) - Math.pow(radiusInner, 2)) * length) + 
                     ((2/3) * Math.PI * (Math.pow(radiusOuter, 3) - Math.pow(radiusInner, 3)));
            break;
        case 'valve':
        case 'filter':
            volume = ((def.weightPerUnit || 3.5) / 7850) * Math.pow(od / 0.30, 3);
            break;
        default:
            volume = crossSectionArea * (length || 0.5);
    }

    return parseFloat((volume * density).toFixed(2));
};

export const calculateTotalCost = (components, includeGST = false, config = null) => {
    const subtotal = components.reduce((total, comp) => total + calculateComponentCost(comp, config), 0);
    return includeGST
        ? Math.round(subtotal * (1 + GST_RATE) * 100) / 100
        : Math.round(subtotal * 100) / 100;
};

export const calculateTotalWeight = (components) => {
    return components.reduce((total, comp) => total + calculateComponentWeight(comp), 0);
};

export const calculateComponentMetrics = (component) => {
    const weight = calculateComponentWeight(component);
    const def = COMPONENT_DEFINITIONS[component.component_type];
    if (!def) return { weight: 0, volume: 0, od: 0, thick: 0, length: 0 };

    const materialKey = component.properties?.material || def.defaultMaterial || 'pvc';
    const material = MATERIALS[materialKey];
    const density = material ? material.density : 1400;

    const length = component.properties?.length || 1;
    const radiusScale = component.properties?.radiusScale || 1;
    const od = component.properties?.od || (0.30 * radiusScale);
    const wt = component.properties?.wallThickness || (def.defaultWT || 0.02);

    return {
        weight: weight,
        volume: parseFloat((weight / density).toFixed(5)),
        od: parseFloat(od.toFixed(3)),
        thick: parseFloat(wt.toFixed(4)),
        length: parseFloat(length.toFixed(3)),
        material: material ? material.name : materialKey
    };
};

export const formatIndianNumber = (num) => {
    const value = num || 0;
    const parts = value.toFixed(2).split('.');
    let x = parts[0];
    const lastThree = x.substring(x.length - 3);
    const other = x.substring(0, x.length - 3);
    if (other !== '') x = other.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + ',' + lastThree;
    return x + (parts.length > 1 ? '.' + parts[1] : '');
};
