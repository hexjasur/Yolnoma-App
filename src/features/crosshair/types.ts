export type CrosshairType = 'classic' | 'dot' | 't-shape' | 'chevron' | 'circle-dot';

export interface CrosshairConfig {
  type: CrosshairType;
  // Dimensions
  size: number;         // Length of lines (px)
  thickness: number;    // Line thickness (px)
  gap: number;          // Center gap (px)
  // Dot
  dot: boolean;         // Show center dot
  dotSize: number;      // Center dot radius/size (px)
  // Ring / Circle (for circle-dot or dot style)
  ringRadius: number;   // Outer circle radius (px)
  showRing: boolean;    // Show circle ring
  // Color & Visuals
  color: string;        // Hex / RGB color
  opacity: number;      // 0.1 to 1.0
  outline: boolean;     // High contrast black border/stroke
  outlineColor: string; // Outline color (usually black or semi-black)
  outlineThickness: number; // Outline width (px)
  // Position adjustments
  offsetX: number;      // Shift X from screen center
  offsetY: number;      // Shift Y from screen center
}

export interface CrosshairPreset {
  id: string;
  name: string;
  category: 'CS2 / Valorant' | 'Apex / Overwatch' | 'Sniper / DMR' | 'Minimalist';
  description: string;
  config: CrosshairConfig;
}

export const DEFAULT_CROSSHAIR_CONFIG: CrosshairConfig = {
  type: 'classic',
  size: 10,
  thickness: 2,
  gap: 4,
  dot: false,
  dotSize: 2,
  ringRadius: 12,
  showRing: false,
  color: '#00FF66',
  opacity: 1,
  outline: true,
  outlineColor: '#000000',
  outlineThickness: 1,
  offsetX: 0,
  offsetY: 0,
};

export const PRESET_COLORS: { name: string; hex: string }[] = [
  { name: 'Neon Green', hex: '#00FF66' },
  { name: 'Cyber Cyan', hex: '#00E5FF' },
  { name: 'Crimson Red', hex: '#FF2A55' },
  { name: 'Electric Yellow', hex: '#FFE600' },
  { name: 'Purple Neon', hex: '#BD00FF' },
  { name: 'Hot Orange', hex: '#FF7700' },
  { name: 'Crisp White', hex: '#FFFFFF' },
  { name: 'Shadow Black', hex: '#111111' },
];

export const CROSSHAIR_PRESETS: CrosshairPreset[] = [
  {
    id: 'cs2-pro-green',
    name: 'CS2 Pro Classic',
    category: 'CS2 / Valorant',
    description: 'Classic 4-way green crosshair. Crystal clear visibility across competitive shooters.',
    config: {
      type: 'classic',
      size: 9,
      thickness: 2,
      gap: 3,
      dot: false,
      dotSize: 2,
      ringRadius: 10,
      showRing: false,
      color: '#00FF66',
      opacity: 1,
      outline: true,
      outlineColor: '#000000',
      outlineThickness: 1,
      offsetX: 0,
      offsetY: 0,
    },
  },
  {
    id: 'precision-dot',
    name: 'Precision Cyan Dot',
    category: 'Minimalist',
    description: 'Clean, pinpoint 1-tap dot. Zero screen obstruction for maximum headshot precision.',
    config: {
      type: 'dot',
      size: 6,
      thickness: 2,
      gap: 0,
      dot: true,
      dotSize: 3,
      ringRadius: 10,
      showRing: false,
      color: '#00E5FF',
      opacity: 1,
      outline: true,
      outlineColor: '#000000',
      outlineThickness: 1.5,
      offsetX: 0,
      offsetY: 0,
    },
  },
  {
    id: 'tactical-t-shape',
    name: 'Tactical T-Shape',
    category: 'CS2 / Valorant',
    description: 'Top crosshair line removed. Unobstructed view of enemy heads during recoil control.',
    config: {
      type: 't-shape',
      size: 10,
      thickness: 2,
      gap: 4,
      dot: true,
      dotSize: 1.5,
      ringRadius: 12,
      showRing: false,
      color: '#FFE600',
      opacity: 1,
      outline: true,
      outlineColor: '#000000',
      outlineThickness: 1,
      offsetX: 0,
      offsetY: 0,
    },
  },
  {
    id: 'circle-dot-apex',
    name: 'Apex Circle Spot',
    category: 'Apex / Overwatch',
    description: 'Outer tracking ring with center spot. Ideal for fast-paced tracking and hip-fire.',
    config: {
      type: 'circle-dot',
      size: 8,
      thickness: 2,
      gap: 4,
      dot: true,
      dotSize: 2,
      ringRadius: 12,
      showRing: true,
      color: '#FF2A55',
      opacity: 1,
      outline: true,
      outlineColor: '#000000',
      outlineThickness: 1,
      offsetX: 0,
      offsetY: 0,
    },
  },
  {
    id: 'chevron-dmr',
    name: 'Sniper Chevron',
    category: 'Sniper / DMR',
    description: 'Tactical inverted chevron for long-range target acquisition and sniper rifles.',
    config: {
      type: 'chevron',
      size: 12,
      thickness: 2.5,
      gap: 3,
      dot: true,
      dotSize: 1.5,
      ringRadius: 10,
      showRing: false,
      color: '#BD00FF',
      opacity: 1,
      outline: true,
      outlineColor: '#000000',
      outlineThickness: 1,
      offsetX: 0,
      offsetY: 0,
    },
  },
];

/**
 * 6-digit numeric ID based on crosshair configuration
 * Example: "YN-849201"
 */
export function getCrosshairNumericId(config: CrosshairConfig): string {
  const str = `${config.type}_${config.size}_${config.thickness}_${config.gap}_${config.color}_${config.dot}_${config.dotSize}_${config.outline}_${config.ringRadius}_${config.showRing}_${config.opacity}_${config.offsetX}_${config.offsetY}`;
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash |= 0;
  }
  const positive = (Math.abs(hash) % 900000) + 100000;
  return `YN-${positive}`;
}

/**
 * Encodes the entire crosshair configuration into a compact share code
 * Example: "YNC-eyJ0IjoiY2xhc3NpYyIs..."
 */
export function generateCrosshairCode(config: CrosshairConfig): string {
  try {
    const compactObj = {
      t: config.type,
      s: config.size,
      th: config.thickness,
      g: config.gap,
      d: config.dot ? 1 : 0,
      ds: config.dotSize,
      r: config.ringRadius,
      sr: config.showRing ? 1 : 0,
      c: config.color.replace('#', ''),
      o: Math.round(config.opacity * 100),
      ot: config.outline ? 1 : 0,
      ow: config.outlineThickness,
      x: config.offsetX,
      y: config.offsetY,
    };
    const json = JSON.stringify(compactObj);
    const b64 = btoa(json);
    return `YNC-${b64}`;
  } catch {
    return `YN-${config.type}-${config.size}-${config.thickness}-${config.gap}-${config.color.replace('#', '')}`;
  }
}

/**
 * Parses and loads a crosshair configuration from a code or ID string
 */
export function parseCrosshairCode(codeStr: string): CrosshairConfig | null {
  const raw = codeStr.trim();
  if (!raw) return null;

  // 1. YNC- base64 code
  if (raw.startsWith('YNC-')) {
    try {
      const b64 = raw.substring(4);
      const json = atob(b64);
      const obj = JSON.parse(json);
      return {
        type: obj.t || 'classic',
        size: Number(obj.s ?? 10),
        thickness: Number(obj.th ?? 2),
        gap: Number(obj.g ?? 4),
        dot: Boolean(obj.d),
        dotSize: Number(obj.ds ?? 2),
        ringRadius: Number(obj.r ?? 12),
        showRing: Boolean(obj.sr),
        color: obj.c ? (obj.c.startsWith('#') ? obj.c : `#${obj.c}`) : '#00FF66',
        opacity: (Number(obj.o ?? 100)) / 100,
        outline: Boolean(obj.ot ?? true),
        outlineColor: '#000000',
        outlineThickness: Number(obj.ow ?? 1),
        offsetX: Number(obj.x ?? 0),
        offsetY: Number(obj.y ?? 0),
      };
    } catch {
      // ignore
    }
  }

  // 2. Direct JSON
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && parsed.type) {
      return { ...DEFAULT_CROSSHAIR_CONFIG, ...parsed };
    }
  } catch {
    // ignore
  }

  // 3. Search in presets by numeric ID or ID name
  for (const p of CROSSHAIR_PRESETS) {
    if (
      getCrosshairNumericId(p.config) === raw ||
      p.id === raw ||
      p.name.toLowerCase() === raw.toLowerCase()
    ) {
      return p.config;
    }
  }

  return null;
}
