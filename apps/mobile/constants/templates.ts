import { MidnightColors } from './theme';

export interface TemplateTheme {
  id: string;
  category: string;
  label: string;
  desc: string;
  background: { light: string; dark: string };
  panel: { light: string; dark: string };
  text: { light: string; dark: string };
  muted: { light: string; dark: string };
  accent: string; // Accents usually stay consistent to maintain brand identity
  accentBg: { light: string; dark: string };
  tileBg: { light: string; dark: string };
  radius: number;
  overlay: { light: string[]; dark: string[] };
  useSerif?: boolean;
}

export const MOBILE_TEMPLATE_THEMES: TemplateTheme[] = [
  // WEDDING
  { 
    id: 'royal', 
    category: 'Wedding', 
    label: 'Royal Emerald', 
    desc: 'Deep imperial emerald & palace gold', 
    background: { light: '#033026', dark: '#02231c' }, 
    panel: { light: 'rgba(2, 35, 28, 0.6)', dark: 'rgba(2, 35, 28, 0.8)' }, 
    text: { light: '#fcfbf7', dark: '#fcfbf7' }, 
    muted: { light: '#a3b899', dark: '#a3b899' }, 
    accent: '#cca43b', 
    accentBg: { light: 'rgba(204, 164, 59, 0.12)', dark: 'rgba(204, 164, 59, 0.18)' }, 
    tileBg: { light: '#02231c', dark: '#021a15' }, 
    radius: 18, 
    overlay: { light: ['rgba(3, 48, 38, 0.25)', 'rgba(3, 48, 38, 1)'], dark: ['rgba(2, 35, 28, 0.25)', 'rgba(2, 35, 28, 1)'] },
    useSerif: true
  },
  { 
    id: 'classic', 
    category: 'Wedding', 
    label: 'Classic White', 
    desc: 'Timeless and elegant design', 
    background: { light: '#FAF9F6', dark: '#FAF9F6' }, // Premium warm alabaster museum wall background
    panel: { light: '#ffffff', dark: '#ffffff' }, // Pure white card matting
    text: { light: '#1e293b', dark: '#1e293b' }, // Modern dark slate charcoal
    muted: { light: '#64748b', dark: '#64748b' }, 
    accent: '#cca43b', // Warm brushed gold
    accentBg: { light: 'rgba(204,164,59,0.06)', dark: 'rgba(204,164,59,0.06)' }, 
    tileBg: { light: '#ffffff', dark: '#ffffff' }, 
    radius: 0, 
    overlay: { light: ['rgba(250,249,246,0.1)', 'rgba(250,249,246,1)'], dark: ['rgba(250,249,246,0.1)', 'rgba(250,249,246,1)'] },
    useSerif: true
  },
  { 
    id: 'hero', 
    category: 'Wedding', 
    label: 'Midnight Hero', 
    desc: 'Big impact cinematic dark aesthetic', 
    background: { light: '#000000', dark: '#000000' }, // Locked to Obsidian/Midnight Black
    panel: { light: 'rgba(255,255,255,0.03)', dark: 'rgba(255,255,255,0.03)' }, // Premium graphite frosted glass
    text: { light: '#ffffff', dark: '#ffffff' }, // Stark starlight white
    muted: { light: '#94a3b8', dark: '#94a3b8' }, // Cool platinum gray
    accent: '#cca43b', // Warm champagne gold
    accentBg: { light: 'rgba(204,164,59,0.08)', dark: 'rgba(204,164,59,0.1)' }, 
    tileBg: { light: '#09090b', dark: '#09090b' }, // Dark glassmorphism photo cards
    radius: 12, // High-end sleek rounded cards
    overlay: { light: ['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.95)'], dark: ['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.95)'] },
    useSerif: true
  },
  { 
    id: 'ethereal', 
    category: 'Wedding', 
    label: 'Ethereal Mist', 
    desc: 'Vintage fine-art album & steel blue', 
    background: { light: '#F8FAFC', dark: '#F8FAFC' }, 
    panel: { light: '#EEF2F6', dark: '#EEF2F6' }, 
    text: { light: '#1E293B', dark: '#1E293B' }, 
    muted: { light: '#64748B', dark: '#64748B' }, 
    accent: '#4A6984', 
    accentBg: { light: '#E2E8F0', dark: '#E2E8F0' }, 
    tileBg: { light: '#ffffff', dark: '#ffffff' }, 
    radius: 2, 
    overlay: { light: ['rgba(248,250,252,0.15)', 'rgba(248,250,252,1)'], dark: ['rgba(248,250,252,0.15)', 'rgba(248,250,252,1)'] }, 
    useSerif: true
  },

  // BIRTHDAY
  { 
    id: 'scrapbook', 
    category: 'Birthday', 
    label: 'Playful Scrapbook', 
    desc: 'Soft modern keepsake aesthetic', 
    background: { light: '#f8f5f0', dark: '#151c1b' }, 
    panel: { light: 'rgba(255, 255, 255, 0.78)', dark: 'rgba(246, 241, 232, 0.07)' }, 
    text: { light: '#263331', dark: '#f8f5f0' }, 
    muted: { light: '#74827d', dark: '#aab8b1' }, 
    accent: '#d9826b', 
    accentBg: { light: 'rgba(217, 130, 107, 0.14)', dark: 'rgba(217, 130, 107, 0.18)' }, 
    tileBg: { light: '#fffdf9', dark: '#1d2826' }, 
    radius: 18, 
    overlay: { light: ['rgba(248,245,240,0.04)', 'rgba(248,245,240,1)'], dark: ['rgba(21,28,27,0.18)', 'rgba(21,28,27,1)'] } 
  },
  { 
    id: 'neon', 
    category: 'Birthday', 
    label: 'Neon Party', 
    desc: 'Premium neon birthday album', 
    background: { light: '#070611', dark: '#070611' }, 
    panel: { light: 'rgba(18, 16, 35, 0.72)', dark: 'rgba(18, 16, 35, 0.72)' }, 
    text: { light: '#f8f7ff', dark: '#f8f7ff' }, 
    muted: { light: '#b9b1d9', dark: '#b9b1d9' }, 
    accent: '#ff3df2', 
    accentBg: { light: 'rgba(102, 232, 255, 0.2)', dark: 'rgba(102, 232, 255, 0.2)' }, 
    tileBg: { light: 'rgba(17, 16, 32, 0.82)', dark: 'rgba(17, 16, 32, 0.82)' }, 
    radius: 20, 
    overlay: { light: ['rgba(7,6,17,0.12)', 'rgba(7,6,17,1)'], dark: ['rgba(7,6,17,0.12)', 'rgba(7,6,17,1)'] } 
  },
  { 
    id: 'pastel', 
    category: 'Birthday', 
    label: 'Pastel Dream', 
    desc: 'Dreamy pastel memory journal', 
    background: { light: '#fff7f4', dark: '#fff7f4' }, 
    panel: { light: 'rgba(255, 255, 255, 0.74)', dark: 'rgba(255, 255, 255, 0.74)' }, 
    text: { light: '#4d4542', dark: '#4d4542' }, 
    muted: { light: '#9a8583', dark: '#9a8583' }, 
    accent: '#c9768b', 
    accentBg: { light: 'rgba(213, 180, 220, 0.28)', dark: 'rgba(213, 180, 220, 0.28)' }, 
    tileBg: { light: '#fffdfb', dark: '#fffdfb' }, 
    radius: 24, 
    overlay: { light: ['rgba(255,247,244,0.08)', 'rgba(255,247,244,1)'], dark: ['rgba(255,247,244,0.08)', 'rgba(255,247,244,1)'] } 
  },
  { 
    id: 'pop', 
    category: 'Birthday', 
    label: 'Pop Art', 
    desc: 'Comic poster birthday album', 
    background: { light: '#ffe84a', dark: '#ffe84a' }, 
    panel: { light: '#fffdf3', dark: '#fffdf3' }, 
    text: { light: '#231f20', dark: '#231f20' }, 
    muted: { light: '#5b4b3d', dark: '#5b4b3d' }, 
    accent: '#ef2b3a', 
    accentBg: { light: 'rgba(0, 128, 255, 0.18)', dark: 'rgba(0, 128, 255, 0.18)' }, 
    tileBg: { light: '#ffffff', dark: '#ffffff' }, 
    radius: 18, 
    overlay: { light: ['rgba(255,232,74,0.08)', 'rgba(255,232,74,1)'], dark: ['rgba(255,232,74,0.08)', 'rgba(255,232,74,1)'] } 
  },

  // ANNIVERSARY
  { 
    id: 'golden_years', 
    category: 'Anniversary', 
    label: 'Golden Years', 
    desc: 'Champagne legacy celebration', 
    background: { light: '#fbf4e6', dark: '#1f1710' }, 
    panel: { light: 'rgba(255, 251, 242, 0.82)', dark: 'rgba(255, 245, 219, 0.08)' }, 
    text: { light: '#3f2f22', dark: '#fff7e6' }, 
    muted: { light: '#8b765e', dark: '#d6bf94' }, 
    accent: '#c99a2e', 
    accentBg: { light: 'rgba(201, 154, 46, 0.16)', dark: 'rgba(201, 154, 46, 0.2)' }, 
    tileBg: { light: '#fffaf0', dark: '#2c2117' }, 
    radius: 20, 
    overlay: { light: ['rgba(251,244,230,0.08)', 'rgba(251,244,230,1)'], dark: ['rgba(31,23,16,0.24)', 'rgba(31,23,16,1)'] } 
  },
  { 
    id: 'vintage', 
    category: 'Anniversary', 
    label: 'Vintage Noir', 
    desc: 'Dark archival anniversary journal', 
    background: { light: '#0F0E0B', dark: '#0F0E0B' }, 
    panel: { light: '#1C1812', dark: '#1C1812' }, 
    text: { light: '#F2E7D2', dark: '#F2E7D2' }, 
    muted: { light: '#C7A96B', dark: '#C7A96B' }, 
    accent: '#B89145', 
    accentBg: { light: 'rgba(184,145,69,0.14)', dark: 'rgba(184,145,69,0.16)' }, 
    tileBg: { light: '#15130F', dark: '#15130F' }, 
    radius: 2, 
    overlay: { light: ['rgba(15,14,11,0.2)', 'rgba(15,14,11,1)'], dark: ['rgba(15,14,11,0.24)', 'rgba(15,14,11,1)'] } 
  },
  { 
    id: 'rose', 
    category: 'Anniversary', 
    label: 'Rose Garden', 
    desc: 'Romantic floral memory journal', 
    background: { light: '#fff9f5', dark: '#30151d' }, 
    panel: { light: 'rgba(255, 252, 247, 0.86)', dark: 'rgba(255, 226, 232, 0.08)' }, 
    text: { light: '#562733', dark: '#fff6f7' }, 
    muted: { light: '#9a6c74', dark: '#e7b6bf' }, 
    accent: '#b76578', 
    accentBg: { light: 'rgba(183, 101, 120, 0.13)', dark: 'rgba(183, 101, 120, 0.22)' }, 
    tileBg: { light: '#fffdfa', dark: '#45212b' }, 
    radius: 28, 
    overlay: { light: ['rgba(255,249,245,0.1)', 'rgba(255,249,245,1)'], dark: ['rgba(48,21,29,0.2)', 'rgba(48,21,29,1)'] } 
  },
  { 
    id: 'minimal_love', 
    category: 'Anniversary', 
    label: 'Minimal Love', 
    desc: 'Minimal romantic editorial journal', 
    background: { light: '#f7efe4', dark: '#17120d' }, 
    panel: { light: '#fffaf2', dark: '#241c15' }, 
    text: { light: '#3b2618', dark: '#fff7eb' }, 
    muted: { light: '#8a7461', dark: '#cab79f' }, 
    accent: '#6d4b34', 
    accentBg: { light: 'rgba(109, 75, 52, 0.12)', dark: 'rgba(109, 75, 52, 0.26)' }, 
    tileBg: { light: '#fffaf2', dark: '#2a2119' }, 
    radius: 24, 
    overlay: { light: ['rgba(247,239,228,0.08)', 'rgba(247,239,228,1)'], dark: ['rgba(23,18,13,0.24)', 'rgba(23,18,13,1)'] } 
  },

  // ENGAGEMENT (Mapped to Other)
  { 
    id: 'bohemian', 
    category: 'Other', 
    label: 'Bohemian Rhapsody', 
    desc: 'Sunset acoustic & festival theme', 
    background: { light: '#fff7ed', dark: '#2f241d' }, 
    panel: { light: '#ffffff', dark: 'rgba(255,247,237,0.08)' }, 
    text: { light: '#431407', dark: '#ffedd5' }, 
    muted: { light: '#9a3412', dark: '#d6d3d1' }, 
    accent: '#fb923c', 
    accentBg: { light: '#ffedd5', dark: 'rgba(251,146,60,0.18)' }, 
    tileBg: { light: '#ffffff', dark: '#3f2f26' }, 
    radius: 22, 
    overlay: { light: ['rgba(255,247,237,0.45)', 'rgba(255,247,237,1)'], dark: ['rgba(47,36,29,0.45)', 'rgba(47,36,29,1)'] } 
  },
  { 
    id: 'diamond', 
    category: 'Other', 
    label: 'Diamond Shine', 
    desc: 'Cool blues and sparkle', 
    background: { light: '#f0f9ff', dark: '#082f49' }, 
    panel: { light: '#ffffff', dark: 'rgba(2,132,199,0.05)' }, 
    text: { light: '#0c4a6e', dark: '#f0f9ff' }, 
    muted: { light: '#0369a1', dark: '#7dd3fc' }, 
    accent: '#0284c7', 
    accentBg: { light: '#e0f2fe', dark: 'rgba(2,132,199,0.2)' }, 
    tileBg: { light: '#ffffff', dark: '#0c4a6e' }, 
    radius: 15, 
    overlay: { light: ['rgba(240,249,255,0.1)', 'rgba(240,249,255,1)'], dark: ['rgba(8,47,73,0.2)', 'rgba(8,47,73,1)'] } 
  },
  { 
    id: 'blush', 
    category: 'Other', 
    label: 'Blush & Bashful', 
    desc: 'Soft pink champagne', 
    background: { light: '#fff7ed', dark: '#431407' }, 
    panel: { light: '#ffffff', dark: 'rgba(255,255,255,0.05)' }, 
    text: { light: '#7c2d12', dark: '#fff7ed' }, 
    muted: { light: '#9a3412', dark: '#fb923c' }, 
    accent: '#ea580c', 
    accentBg: { light: '#ffedd5', dark: 'rgba(234,88,12,0.2)' }, 
    tileBg: { light: '#ffffff', dark: '#7c2d12' }, 
    radius: 10, 
    overlay: { light: ['rgba(255,247,237,0.1)', 'rgba(255,247,237,1)'], dark: ['rgba(67,20,7,0.2)', 'rgba(67,20,7,1)'] } 
  },
  { 
    id: 'garden', 
    category: 'Other', 
    label: 'Garden Path', 
    desc: 'Natural greens and ivory', 
    background: { light: '#E5ECE9', dark: '#112217' }, 
    panel: { light: '#FDFBF7', dark: '#1B3224' }, 
    text: { light: '#1A3322', dark: '#E5ECE9' }, 
    muted: { light: '#4D6D53', dark: '#7FA485' }, 
    accent: '#2E6F40', 
    accentBg: { light: '#EAF2EB', dark: 'rgba(74, 222, 128, 0.15)' }, 
    tileBg: { light: '#FDFBF7', dark: '#1B3224' }, 
    radius: 22, 
    overlay: { light: ['rgba(9, 13, 22, 0.45)', 'rgba(229, 236, 233, 0)', 'rgba(229, 236, 233, 1)'], dark: ['rgba(9, 13, 22, 0.55)', 'rgba(17, 34, 23, 0)', 'rgba(17, 34, 23, 1)'] },
    useSerif: true
  },

  // RECEPTION (Mapped to Other)
  { 
    id: 'midnight_glam', 
    category: 'Other', 
    label: 'Midnight Glam', 
    desc: 'Dark blue and silver', 
    background: { light: '#eff6ff', dark: '#050505' }, 
    panel: { light: '#ffffff', dark: 'rgba(30,58,138,0.1)' }, 
    text: { light: '#1e3a8a', dark: '#f8fafc' }, 
    muted: { light: '#3b82f6', dark: '#94a3b8' }, 
    accent: '#3b82f6', 
    accentBg: { light: '#dbeafe', dark: 'rgba(59,130,246,0.15)' }, 
    tileBg: { light: '#ffffff', dark: '#101010' }, 
    radius: 8, 
    overlay: { light: ['rgba(239,246,255,0.1)', 'rgba(239,246,255,1)'], dark: ['rgba(2,6,23,0.3)', 'rgba(2,6,23,1)'] } 
  },
  { 
    id: 'cinematic', 
    category: 'Other', 
    label: 'Cinematic Noir', 
    desc: 'Dramatic and immersive', 
    background: { light: '#f5f5f5', dark: '#000000' }, 
    panel: { light: '#ffffff', dark: 'rgba(255,255,255,0.04)' }, 
    text: { light: '#171717', dark: '#ffffff' }, 
    muted: { light: '#737373', dark: '#a3a3a3' }, 
    accent: '#ef4444', 
    accentBg: { light: '#fee2e2', dark: 'rgba(239,68,68,0.16)' }, 
    tileBg: { light: '#ffffff', dark: '#111111' }, 
    radius: 4, 
    overlay: { light: ['rgba(245,245,245,0.1)', 'rgba(245,245,245,1)'], dark: ['rgba(0,0,0,0.1)', 'rgba(0,0,0,1)'] } 
  },
  { 
    id: 'modern_lounge', 
    category: 'Other', 
    label: 'Modern Lounge', 
    desc: 'Sleek and contemporary', 
    background: { light: '#f8fafc', dark: '#101010' }, 
    panel: { light: '#ffffff', dark: '#1e293b' }, 
    text: { light: '#101010', dark: '#f8fafc' }, 
    muted: { light: '#64748b', dark: '#64748b' }, 
    accent: '#818cf8', 
    accentBg: { light: '#e0e7ff', dark: 'rgba(129,140,248,0.1)' }, 
    tileBg: { light: '#ffffff', dark: '#1e293b' }, 
    radius: 2, 
    overlay: { light: ['rgba(248,250,252,0.1)', 'rgba(248,250,252,1)'], dark: ['rgba(15,23,42,0.2)', 'rgba(15,23,42,1)'] } 
  },
  { 
    id: 'elegant_night', 
    category: 'Other', 
    label: 'Elegant Night', 
    desc: 'Sophisticated design', 
    background: { light: '#fafafa', dark: '#111111' }, 
    panel: { light: '#ffffff', dark: '#1a1a1a' }, 
    text: { light: '#171717', dark: '#ffffff' }, 
    muted: { light: '#737373', dark: '#cccccc' }, 
    accent: '#171717', 
    accentBg: { light: 'rgba(0,0,0,0.05)', dark: 'rgba(255,255,255,0.05)' }, 
    tileBg: { light: '#ffffff', dark: '#111111' }, 
    radius: 0, 
    overlay: { light: ['rgba(250,250,250,0.1)', 'rgba(250,250,250,1)'], dark: ['rgba(0,0,0,0.4)', 'rgba(17,17,17,1)'] } 
  },

  // CORPORATE
  { 
    id: 'museum', 
    category: 'Corporate', 
    label: 'Museum Gallery', 
    desc: 'Luxury corporate exhibition', 
    background: { light: '#f3f0ea', dark: '#0b1118' }, 
    panel: { light: 'rgba(255, 255, 252, 0.9)', dark: 'rgba(20, 27, 36, 0.9)' }, 
    text: { light: '#17202b', dark: '#f6f3ec' }, 
    muted: { light: '#66717d', dark: '#a7b1bd' }, 
    accent: '#9b7a44', 
    accentBg: { light: 'rgba(155, 122, 68, 0.12)', dark: 'rgba(155, 122, 68, 0.2)' }, 
    tileBg: { light: '#fffffc', dark: '#141b24' }, 
    radius: 22, 
    overlay: { light: ['rgba(11,17,24,0.34)', 'rgba(243,240,234,0.96)'], dark: ['rgba(11,17,24,0.38)', 'rgba(11,17,24,1)'] } 
  },
  { 
    id: 'brutalist', 
    category: 'Corporate', 
    label: 'Brutalist Grid', 
    desc: 'Modern architectural editorial grid', 
    background: { light: '#efede7', dark: '#111113' }, 
    panel: { light: 'rgba(255, 255, 250, 0.94)', dark: 'rgba(33, 33, 35, 0.94)' }, 
    text: { light: '#111113', dark: '#f4f2ed' }, 
    muted: { light: '#62625d', dark: '#a8a69f' }, 
    accent: '#1a1a1c', 
    accentBg: { light: 'rgba(26, 26, 28, 0.08)', dark: 'rgba(255,255,255,0.1)' }, 
    tileBg: { light: '#fffffa', dark: '#202024' }, 
    radius: 14, 
    overlay: { light: ['rgba(17,17,19,0.5)', 'rgba(239,237,231,0.98)'], dark: ['rgba(17,17,19,0.32)', 'rgba(17,17,19,1)'] } 
  },
  { 
    id: 'tech_sleek', 
    category: 'Corporate', 
    label: 'Tech Sleek', 
    desc: 'Futuristic and clean', 
    background: { light: '#050b17', dark: '#050b17' },
    panel: { light: 'rgba(8, 15, 30, 0.82)', dark: 'rgba(8, 15, 30, 0.82)' },
    text: { light: '#f8fafc', dark: '#f8fafc' },
    muted: { light: '#cbd5e1', dark: '#cbd5e1' },
    accent: '#22d3ee',
    accentBg: { light: 'rgba(34, 211, 238, 0.16)', dark: 'rgba(34, 211, 238, 0.16)' },
    tileBg: { light: 'rgba(8, 15, 30, 0.86)', dark: 'rgba(8, 15, 30, 0.86)' },
    radius: 22,
    overlay: { light: ['rgba(5,11,23,0.08)', 'rgba(5,11,23,1)'], dark: ['rgba(5,11,23,0.08)', 'rgba(5,11,23,1)'] }
  },
  { 
    id: 'executive', 
    category: 'Corporate', 
    label: 'Executive Suite', 
    desc: 'Professional theme', 
    background: { light: '#08111f', dark: '#08111f' },
    panel: { light: '#f5eddc', dark: '#f5eddc' },
    text: { light: '#f5eddc', dark: '#f5eddc' },
    muted: { light: '#d4b474', dark: '#d4b474' },
    accent: '#d4b474',
    accentBg: { light: 'rgba(212, 180, 116, 0.18)', dark: 'rgba(212, 180, 116, 0.18)' },
    tileBg: { light: '#f5eddc', dark: '#f5eddc' },
    radius: 18,
    overlay: { light: ['rgba(8,17,31,0.16)', 'rgba(8,17,31,1)'], dark: ['rgba(8,17,31,0.16)', 'rgba(8,17,31,1)'] }
  },

  // OTHER
  { 
    id: 'polaroid', 
    category: 'Other', 
    label: 'Vintage Polaroid', 
    desc: 'Classic photo frames', 
    background: { light: '#f8f3e7', dark: '#1c1917' }, 
    panel: { light: '#fffaf0', dark: '#292524' }, 
    text: { light: '#1f2937', dark: '#f8f3e7' }, 
    muted: { light: '#78716c', dark: '#a8a29e' }, 
    accent: '#b45309', 
    accentBg: { light: '#fef3c7', dark: 'rgba(180,83,9,0.2)' }, 
    tileBg: { light: '#ffffff', dark: '#292524' }, 
    radius: 2, 
    overlay: { light: ['rgba(248,243,231,0.1)', 'rgba(248,243,231,1)'], dark: ['rgba(28,25,23,0.2)', 'rgba(28,25,23,1)'] } 
  },
  { 
    id: 'editorial', 
    category: 'Other', 
    label: 'Editorial Mag', 
    desc: 'Magazine layout style', 
    background: { light: '#fafaf9', dark: '#171717' }, 
    panel: { light: '#ffffff', dark: '#262626' }, 
    text: { light: '#111827', dark: '#fafaf9' }, 
    muted: { light: '#57534e', dark: '#a3a3a3' }, 
    accent: '#111827', 
    accentBg: { light: '#f5f5f4', dark: 'rgba(255,255,255,0.1)' }, 
    tileBg: { light: '#e7e5e4', dark: '#262626' }, 
    radius: 0, 
    overlay: { light: ['rgba(250,250,249,0.05)', 'rgba(250,250,249,1)'], dark: ['rgba(23,23,23,0.2)', 'rgba(23,23,23,1)'] } 
  },
  { 
    id: 'vibrant', 
    category: 'Other', 
    label: 'Vibrant Energy', 
    desc: 'Colorful and dynamic', 
    background: { light: '#f5f3ff', dark: '#4c1d95' }, 
    panel: { light: '#ffffff', dark: 'rgba(255,255,255,0.1)' }, 
    text: { light: '#4c1d95', dark: '#ffffff' }, 
    muted: { light: '#7c3aed', dark: '#ddd6fe' }, 
    accent: '#8b5cf6', 
    accentBg: { light: '#ede9fe', dark: 'rgba(139,92,246,0.2)' }, 
    tileBg: { light: '#ffffff', dark: '#5b21b6' }, 
    radius: 15, 
    overlay: { light: ['rgba(245,243,255,0.1)', 'rgba(245,243,255,1)'], dark: ['rgba(76,29,149,0.2)', 'rgba(76,29,149,1)'] } 
  },
  { 
    id: 'zen', 
    category: 'Other', 
    label: 'Zen Garden', 
    desc: 'Calm and peaceful', 
    background: { light: '#f5f5f4', dark: '#1c1917' }, 
    panel: { light: '#ffffff', dark: '#292524' }, 
    text: { light: '#44403c', dark: '#f5f5f4' }, 
    muted: { light: '#78716c', dark: '#a8a29e' }, 
    accent: '#57534e', 
    accentBg: { light: '#e7e5e4', dark: 'rgba(87,83,78,0.2)' }, 
    tileBg: { light: '#ffffff', dark: '#292524' }, 
    radius: 100, 
    overlay: { light: ['rgba(245,245,244,0.1)', 'rgba(245,245,244,1)'], dark: ['rgba(28,25,23,0.2)', 'rgba(28,25,23,1)'] } 
  },
  // COLLEGE
  { 
    id: 'cyber_tech', 
    category: 'College', 
    label: 'Cyber Tech', 
    desc: 'Neon cyber hackathon & coding terminal', 
    background: { light: '#090d16', dark: '#05070c' }, 
    panel: { light: 'rgba(17, 28, 48, 0.65)', dark: 'rgba(9, 16, 30, 0.8)' }, 
    text: { light: '#e2eafc', dark: '#e2eafc' }, 
    muted: { light: '#8ea8db', dark: '#627fa7' }, 
    accent: '#00f0ff', 
    accentBg: { light: 'rgba(0, 240, 255, 0.12)', dark: 'rgba(0, 240, 255, 0.18)' }, 
    tileBg: { light: '#0d1527', dark: '#060a14' }, 
    radius: 8, 
    overlay: { light: ['rgba(9,13,22,0.2)', 'rgba(9,13,22,1)'], dark: ['rgba(5,7,12,0.2)', 'rgba(5,7,12,1)'] } 
  },
  { 
    id: 'retro_arcade', 
    category: 'College', 
    label: 'Retro Arcade', 
    desc: 'Bold pop art & funky festival vibe', 
    background: { light: '#ffde4a', dark: '#ffe663' }, 
    panel: { light: '#231f20', dark: '#111111' }, 
    text: { light: '#231f20', dark: '#231f20' }, 
    muted: { light: '#5b4b3d', dark: '#5b4b3d' }, 
    accent: '#ff3562', 
    accentBg: { light: 'rgba(255, 53, 98, 0.14)', dark: 'rgba(255, 53, 98, 0.2)' }, 
    tileBg: { light: '#ffffff', dark: '#ffffff' }, 
    radius: 18, 
    overlay: { light: ['rgba(255,222,74,0.08)', 'rgba(255,222,74,1)'], dark: ['rgba(255,230,99,0.08)', 'rgba(255,230,99,1)'] } 
  },
  { 
    id: 'academic_editorial', 
    category: 'College', 
    label: 'Academic Editorial', 
    desc: 'Clean minimalist journal & campus registry style', 
    background: { light: '#FCFAF7', dark: '#0B0E14' }, 
    panel: { light: '#FFFFFF', dark: '#161A23' }, 
    text: { light: '#1C1C1E', dark: '#F5F6F8' }, 
    muted: { light: '#636E72', dark: '#8E939E' }, 
    accent: '#800020', 
    accentBg: { light: 'rgba(128, 0, 32, 0.08)', dark: 'rgba(229, 169, 59, 0.15)' }, 
    tileBg: { light: '#FFFFFF', dark: '#161A23' }, 
    radius: 2, 
    overlay: { light: ['rgba(252,250,247,0.1)', 'rgba(252,250,247,1)'], dark: ['rgba(11,14,20,0.1)', 'rgba(11,14,20,1)'] },
    useSerif: true
  },
  { 
    id: 'neon_carnival', 
    category: 'College', 
    label: 'Neon Carnival', 
    desc: 'Glowing festival lights & concert stage', 
    background: { light: '#0c0714', dark: '#06030a' }, 
    panel: { light: 'rgba(24, 15, 38, 0.72)', dark: 'rgba(15, 9, 24, 0.8)' }, 
    text: { light: '#faf5ff', dark: '#faf5ff' }, 
    muted: { light: '#d8b4fe', dark: '#a855f7' }, 
    accent: '#d946ef', 
    accentBg: { light: 'rgba(217, 70, 239, 0.15)', dark: 'rgba(217, 70, 239, 0.2)' }, 
    tileBg: { light: '#140c21', dark: '#0b0612' }, 
    radius: 24, 
    overlay: { light: ['rgba(12,7,20,0.15)', 'rgba(12,7,20,1)'], dark: ['rgba(6,3,10,0.15)', 'rgba(6,3,10,1)'] } 
  },
];

export const getTemplateCategoryForEventCategory = (category?: string) => {
  if (category === 'Sports') return 'Other';
  return category || 'Wedding';
};

export const getTemplatesForEventCategory = (category?: string) => {
  const templateCategory = getTemplateCategoryForEventCategory(category);
  return MOBILE_TEMPLATE_THEMES.filter((theme) => theme.category === templateCategory);
};

export const getDefaultTemplateForEventCategory = (category?: string) => {
  const templates = getTemplatesForEventCategory(category);
  return templates[0] || MOBILE_TEMPLATE_THEMES[0];
};
