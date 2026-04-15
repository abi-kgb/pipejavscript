import { calculateComponentCost } from './src/utils/pricing.js';

// Mock components
const components = [
    {
        label: 'UPVC Pipe (1m)',
        component_type: 'straight',
        properties: { length: 1, radiusScale: 1, material: 'upvc' }
    },
    {
        label: 'CPVC Pipe (1m)',
        component_type: 'straight',
        properties: { length: 1, radiusScale: 1, material: 'cpvc' }
    },
    {
        label: 'UPVC Elbow',
        component_type: 'elbow',
        properties: { radiusScale: 1, material: 'upvc' }
    },
    {
        label: 'CPVC Elbow',
        component_type: 'elbow',
        properties: { radiusScale: 1, material: 'cpvc' }
    }
];

console.log('--- Pricing Verification ---');
components.forEach(comp => {
    const cost = calculateComponentCost(comp);
    console.log(`${comp.label}: ₹${cost}`);
});
console.log('----------------------------');
