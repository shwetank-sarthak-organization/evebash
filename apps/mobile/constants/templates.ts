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
    desc: 'Deep red and rich gold', 
    background: { light: '#fef2f2', dark: '#450a0a' }, 
    panel: { light: '#ffffff', dark: 'rgba(212,175,55,0.1)' }, 
    text: { light: '#450a0a', dark: '#fef2f2' }, 
    muted: { light: '#991b1b', dark: '#fca5a5' }, 
    accent: '#d4af37', 
    accentBg: { light: 'rgba(212,175,55,0.1)', dark: 'rgba(212,175,55,0.2)' }, 
    tileBg: { light: '#ffffff', dark: '#7f1d1d' }, 
    radius: 12, 
    overlay: { light: ['rgba(254,242,242,0.1)', 'rgba(254,242,242,1)'], dark: ['rgba(69,10,10,0.3)', 'rgba(69,10,10,1)'] } 
  },
  { 
    id: 'vintage', 
    category: 'Anniversary', 
    label: 'Vintage Noir', 
    desc: 'Classic black and white', 
    background: { light: '#f4f4f5', dark: '#09090b' }, 
    panel: { light: '#ffffff', dark: '#18181b' }, 
    text: { light: '#09090b', dark: '#ffffff' }, 
    muted: { light: '#71717a', dark: '#a1a1aa' }, 
    accent: '#18181b', 
    accentBg: { light: 'rgba(0,0,0,0.05)', dark: 'rgba(255,255,255,0.1)' }, 
    tileBg: { light: '#ffffff', dark: '#09090b' }, 
    radius: 0, 
    overlay: { light: ['rgba(244,244,245,0.1)', 'rgba(244,244,245,1)'], dark: ['rgba(0,0,0,0.2)', 'rgba(9,9,11,1)'] } 
  },
  { 
    id: 'rose', 
    category: 'Anniversary', 
    label: 'Rose Garden', 
    desc: 'Romantic floral tones', 
    background: { light: '#fff1f2', dark: '#4c0519' }, 
    panel: { light: '#ffffff', dark: 'rgba(225,29,72,0.05)' }, 
    text: { light: '#881337', dark: '#fff1f2' }, 
    muted: { light: '#be123c', dark: '#fb7185' }, 
    accent: '#e11d48', 
    accentBg: { light: '#ffe4e6', dark: 'rgba(225,29,72,0.2)' }, 
    tileBg: { light: '#ffffff', dark: '#881337' }, 
    radius: 40, 
    overlay: { light: ['rgba(255,241,242,0.1)', 'rgba(255,241,242,1)'], dark: ['rgba(76,5,25,0.2)', 'rgba(76,5,25,1)'] } 
  },
  { 
    id: 'minimal_love', 
    category: 'Anniversary', 
    label: 'Minimal Love', 
    desc: 'Clean and sophisticated', 
    background: { light: '#fafaf9', dark: '#1c1917' }, 
    panel: { light: '#ffffff', dark: '#292524' }, 
    text: { light: '#1c1917', dark: '#fafaf9' }, 
    muted: { light: '#78716c', dark: '#a8a29e' }, 
    accent: '#78716c', 
    accentBg: { light: '#f5f5f4', dark: 'rgba(120,113,108,0.2)' }, 
    tileBg: { light: '#ffffff', dark: '#292524' }, 
    radius: 4, 
    overlay: { light: ['rgba(250,250,249,0.05)', 'rgba(250,250,249,1)'], dark: ['rgba(28,25,23,0.2)', 'rgba(28,25,23,1)'] } 
  },

  // ENGAGEMENT
  { 
    id: 'bohemian', 
    category: 'Engagement', 
    label: 'Bohemian Rhapsody', 
    desc: 'Earthy and organic', 
    background: { light: '#fff7ed', dark: '#2f241d' }, 
    panel: { light: '#ffffff', dark: 'rgba(255,247,237,0.08)' }, 
    text: { light: '#431407', dark: '#ffedd5' }, 
    muted: { light: '#9a3412', dark: '#d6d3d1' }, 
    accent: '#fb923c', 
    accentBg: { light: '#ffedd5', dark: 'rgba(251,146,60,0.18)' }, 
    tileBg: { light: '#ffffff', dark: '#3f2f26' }, 
    radius: 22, 
    overlay: { light: ['rgba(255,247,237,0.1)', 'rgba(255,247,237,1)'], dark: ['rgba(47,36,29,0.15)', 'rgba(47,36,29,1)'] } 
  },
  { 
    id: 'diamond', 
    category: 'Engagement', 
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
    category: 'Engagement', 
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
    category: 'Engagement', 
    label: 'Garden Path', 
    desc: 'Natural greens and ivory', 
    background: { light: '#f0fdf4', dark: '#064e3b' }, 
    panel: { light: '#ffffff', dark: 'rgba(22,163,74,0.05)' }, 
    text: { light: '#14532d', dark: '#f0fdf4' }, 
    muted: { light: '#166534', dark: '#4ade80' }, 
    accent: '#16a34a', 
    accentBg: { light: '#dcfce7', dark: 'rgba(22,163,74,0.2)' }, 
    tileBg: { light: '#ffffff', dark: '#064e3b' }, 
    radius: 50, 
    overlay: { light: ['rgba(240,253,244,0.1)', 'rgba(240,253,244,1)'], dark: ['rgba(6,78,59,0.2)', 'rgba(6,78,59,1)'] } 
  },

  // RECEPTION
  { 
    id: 'midnight_glam', 
    category: 'Reception', 
    label: 'Midnight Glam', 
    desc: 'Dark blue and silver', 
    background: { light: '#eff6ff', dark: '#020617' }, 
    panel: { light: '#ffffff', dark: 'rgba(30,58,138,0.1)' }, 
    text: { light: '#1e3a8a', dark: '#f8fafc' }, 
    muted: { light: '#3b82f6', dark: '#94a3b8' }, 
    accent: '#3b82f6', 
    accentBg: { light: '#dbeafe', dark: 'rgba(59,130,246,0.15)' }, 
    tileBg: { light: '#ffffff', dark: '#0f172a' }, 
    radius: 8, 
    overlay: { light: ['rgba(239,246,255,0.1)', 'rgba(239,246,255,1)'], dark: ['rgba(2,6,23,0.3)', 'rgba(2,6,23,1)'] } 
  },
  { 
    id: 'cinematic', 
    category: 'Reception', 
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
    category: 'Reception', 
    label: 'Modern Lounge', 
    desc: 'Sleek and contemporary', 
    background: { light: '#f8fafc', dark: '#0f172a' }, 
    panel: { light: '#ffffff', dark: '#1e293b' }, 
    text: { light: '#0f172a', dark: '#f8fafc' }, 
    muted: { light: '#64748b', dark: '#64748b' }, 
    accent: '#818cf8', 
    accentBg: { light: '#e0e7ff', dark: 'rgba(129,140,248,0.1)' }, 
    tileBg: { light: '#ffffff', dark: '#1e293b' }, 
    radius: 2, 
    overlay: { light: ['rgba(248,250,252,0.1)', 'rgba(248,250,252,1)'], dark: ['rgba(15,23,42,0.2)', 'rgba(15,23,42,1)'] } 
  },
  { 
    id: 'elegant_night', 
    category: 'Reception', 
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
    desc: 'Minimalist art style', 
    background: { light: '#f8fafc', dark: '#0f172a' }, 
    panel: { light: '#ffffff', dark: '#1e293b' }, 
    text: { light: '#0f172a', dark: '#f8fafc' }, 
    muted: { light: '#64748b', dark: '#94a3b8' }, 
    accent: '#334155', 
    accentBg: { light: '#e2e8f0', dark: 'rgba(51,65,85,0.2)' }, 
    tileBg: { light: '#ffffff', dark: '#1e293b' }, 
    radius: 0, 
    overlay: { light: ['rgba(248,250,252,0.1)', 'rgba(248,250,252,1)'], dark: ['rgba(15,23,42,0.02)', 'rgba(15,23,42,1)'] } 
  },
  { 
    id: 'brutalist', 
    category: 'Corporate', 
    label: 'Brutalist Grid', 
    desc: 'Raw and structured', 
    background: { light: '#f4f4f5', dark: '#18181b' }, 
    panel: { light: '#ffffff', dark: '#27272a' }, 
    text: { light: '#000000', dark: '#f4f4f5' }, 
    muted: { light: '#27272a', dark: '#a1a1aa' }, 
    accent: '#000000', 
    accentBg: { light: '#e4e4e7', dark: 'rgba(255,255,255,0.1)' }, 
    tileBg: { light: '#ffffff', dark: '#27272a' }, 
    radius: 0, 
    overlay: { light: ['rgba(244,244,245,0.1)', 'rgba(244,244,245,1)'], dark: ['rgba(0,0,0,0)', 'rgba(24,24,27,1)'] } 
  },
  { 
    id: 'tech_sleek', 
    category: 'Corporate', 
    label: 'Tech Sleek', 
    desc: 'Futuristic and clean', 
    background: { light: '#f0f9ff', dark: '#0f172a' }, 
    panel: { light: '#ffffff', dark: 'rgba(56,189,248,0.03)' }, 
    text: { light: '#0c4a6e', dark: '#f8fafc' }, 
    muted: { light: '#0284c7', dark: '#38bdf8' }, 
    accent: '#38bdf8', 
    accentBg: { light: '#e0f2fe', dark: 'rgba(56,189,248,0.1)' }, 
    tileBg: { light: '#ffffff', dark: '#0f172a' }, 
    radius: 0, 
    overlay: { light: ['rgba(240,249,255,0.1)', 'rgba(240,249,255,1)'], dark: ['rgba(15,23,42,0.1)', 'rgba(15,23,42,1)'] } 
  },
  { 
    id: 'executive', 
    category: 'Corporate', 
    label: 'Executive Suite', 
    desc: 'Professional theme', 
    background: { light: '#f1f5f9', dark: '#1e293b' }, 
    panel: { light: '#ffffff', dark: '#0f172a' }, 
    text: { light: '#1e293b', dark: '#f1f5f9' }, 
    muted: { light: '#475569', dark: '#94a3b8' }, 
    accent: '#0f172a', 
    accentBg: { light: '#e2e8f0', dark: 'rgba(15,23,42,0.2)' }, 
    tileBg: { light: '#ffffff', dark: '#0f172a' }, 
    radius: 4, 
    overlay: { light: ['rgba(241,245,249,0.1)', 'rgba(241,245,249,1)'], dark: ['rgba(30,41,59,0.1)', 'rgba(30,41,59,1)'] } 
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
];
