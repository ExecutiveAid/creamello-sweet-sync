// Utility functions for dynamic theme color management

/**
 * Convert hex color to RGB values
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

/**
 * Darken a hex color by a given percentage
 */
export function darkenColor(hex: string, percent: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  
  const factor = 1 - (percent / 100);
  const r = Math.round(rgb.r * factor);
  const g = Math.round(rgb.g * factor);
  const b = Math.round(rgb.b * factor);
  
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * Lighten a hex color by a given percentage
 */
export function lightenColor(hex: string, percent: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  
  const factor = percent / 100;
  const r = Math.round(rgb.r + (255 - rgb.r) * factor);
  const g = Math.round(rgb.g + (255 - rgb.g) * factor);
  const b = Math.round(rgb.b + (255 - rgb.b) * factor);
  
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * Convert RGB to HSL
 */
function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255;
  g /= 255;
  b /= 255;
  
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h: number, s: number, l: number;
  
  l = (max + min) / 2;
  
  if (max === min) {
    h = s = 0; // achromatic
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
      default: h = 0;
    }
    h /= 6;
  }
  
  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  };
}

/**
 * Update CSS custom properties for brand colors
 */
export function updateBrandColors(primaryColor: string): void {
  const root = document.documentElement;
  const rgb = hexToRgb(primaryColor);
  
  if (rgb) {
    // Set the primary color
    root.style.setProperty('--brand-primary', primaryColor);
    
    // Set darker variant (20% darker)
    const darkerColor = darkenColor(primaryColor, 20);
    root.style.setProperty('--brand-primary-dark', darkerColor);
    
    // Set lighter variant (30% lighter)
    const lighterColor = lightenColor(primaryColor, 30);
    root.style.setProperty('--brand-primary-light', lighterColor);
    
    // Set RGB values for transparency effects
    root.style.setProperty('--brand-primary-rgb', `${rgb.r}, ${rgb.g}, ${rgb.b}`);
    
    // Update Tailwind primary color variables (HSL format)
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    root.style.setProperty('--primary', `${hsl.h} ${hsl.s}% ${hsl.l}%`);
    
    // Also update ring color for focus states
    root.style.setProperty('--ring', `${hsl.h} ${hsl.s}% ${hsl.l}%`);
    
    console.log('🎨 Updated brand colors:', {
      primary: primaryColor,
      dark: darkerColor,
      light: lighterColor,
      rgb: `${rgb.r}, ${rgb.g}, ${rgb.b}`,
      hsl: `${hsl.h} ${hsl.s}% ${hsl.l}%`
    });
  }
}

/**
 * Load and apply brand colors from settings
 */
export async function loadAndApplyBrandColors(): Promise<void> {
  try {
    // This would typically load from your settings/database
    // For now, we'll use the default or get from localStorage if available
    const savedColor = localStorage.getItem('brand-primary-color');
    if (savedColor) {
      updateBrandColors(savedColor);
    }
  } catch (error) {
    console.error('Error loading brand colors:', error);
  }
}

/**
 * Save brand color to localStorage for persistence
 */
export function saveBrandColor(primaryColor: string): void {
  localStorage.setItem('brand-primary-color', primaryColor);
  updateBrandColors(primaryColor);
} 