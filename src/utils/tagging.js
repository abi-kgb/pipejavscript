/**
 * Generates a professional tag for a component based on its type and index.
 * Rules:
 * - Straight/Vertical pipes: S1, S2...
 * - 90-degree Elbows: E901, E902...
 * - 45-degree Elbows: E451, E452...
 * - T-Joints: T1, T2...
 * - Valves: V1, V2...
 * - Flanges: F1, F2...
 * - Filters: FL1, FL2...
 * - Tanks: TK1, TK2...
 */
export const getComponentTag = (type, index, namingConfig = null) => {
    let prefix = namingConfig?.[type]; 

    if (!prefix) {
        switch (type) {
            case 'straight':
            case 'vertical':
                prefix = 'S'; // Straight/Vertical Pipe
                break;
            case 'elbow':
                prefix = 'E'; // 90° Elbow
                break;
            case 'elbow-45':
                prefix = 'E45'; // 45° Elbow
                break;
            case 't-joint':
                prefix = 'T'; // T-Joint
                break;
            case 'valve':
                prefix = 'V'; // Valve
                break;
            case 'flange':
                prefix = 'F'; // Flange
                break;
            case 'filter':
                prefix = 'FL'; // Filter
                break;
            case 'tank':
                prefix = 'TK'; // Tank
                break;
            case 'reducer':
                prefix = 'R'; // Reducer
                break;
            case 'cap':
                prefix = 'C'; // Cap
                break;
            case 'union':
                prefix = 'U'; // Union
                break;
            case 'cross':
                prefix = 'X'; // Cross
                break;
            case 'coupling':
                prefix = 'CP'; // Coupling
                break;
            case 'plug':
                prefix = 'P'; // Plug
                break;
            case 'globe-valve':
            case 'check-valve':
            case 'gate-valve':
                prefix = 'V'; // Valve variants
                break;
            case 'y-strainer':
                prefix = 'YS'; // Y-Strainer
                break;
            case 'pump':
                prefix = 'PMP'; // Pump
                break;
            case 'blind-flange':
                prefix = 'BF'; // Blind Flange
                break;
            case 'pressure-gauge':
                prefix = 'PG'; // Pressure Gauge
                break;
            case 'flow-meter':
                prefix = 'FM'; // Flow Meter
                break;
            case 'pipe-support':
                prefix = 'SUP'; // Pipe Support
                break;
            case 'clamp':
                prefix = 'CLM'; // Clamp
                break;
            case 'hang-clamp':
                prefix = 'HCLM'; // Hang Clamp
                break;
            case 'expand-clamp':
                prefix = 'ECLM'; // Expand Clamp
                break;
            default:
                prefix = type.substring(0, 1).toUpperCase();
        }
    }

    return `${prefix}${index + 1}`;
};
