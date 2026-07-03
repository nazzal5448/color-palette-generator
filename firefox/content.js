/**
 * VoidColor - Web Page Palette Extractor
 * Content script to crawl and parse CSS colors from the active webpage.
 */

(function() {
  const colorMap = {}; // Maps HEX -> frequency count

  // Helper to normalize any color string to HEX
  function normalizeToHex(colorStr) {
    if (!colorStr) return null;
    const s = colorStr.trim().toLowerCase();
    
    // Transparent or none check
    if (s === 'transparent' || s === 'none' || s === 'inherit' || s === 'initial') {
      return null;
    }

    // HEX check
    if (s.startsWith('#')) {
      let hex = s.replace('#', '').toUpperCase();
      if (hex.length === 3) {
        hex = hex.split('').map(c => c + c).join('');
      }
      return hex.length === 6 ? '#' + hex : null;
    }

    // RGB/RGBA check
    if (s.startsWith('rgb')) {
      const match = s.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
      if (match) {
        const r = parseInt(match[1]);
        const g = parseInt(match[2]);
        const b = parseInt(match[3]);
        const a = match[4] !== undefined ? parseFloat(match[4]) : 1.0;
        
        // Skip fully transparent colors
        if (a === 0) return null;
        
        const rHex = r.toString(16).padStart(2, '0').toUpperCase();
        const gHex = g.toString(16).padStart(2, '0').toUpperCase();
        const bHex = b.toString(16).padStart(2, '0').toUpperCase();
        return `#${rHex}${gHex}${bHex}`;
      }
    }

    // HSL/HSLA check
    if (s.startsWith('hsl')) {
      const match = s.match(/hsla?\((\d+),\s*([\d.]+)%,\s*([\d.]+)%(?:,\s*([\d.]+))?\)/);
      if (match) {
        const h = parseInt(match[1]);
        const sPct = parseFloat(match[2]) / 100;
        const lPct = parseFloat(match[3]) / 100;
        const a = match[4] !== undefined ? parseFloat(match[4]) : 1.0;
        
        if (a === 0) return null;
        
        // HSL to RGB conversion
        let r, g, b;
        if (sPct === 0) {
          r = g = b = lPct;
        } else {
          const hueToRgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1/6) return p + (q - p) * 6 * t;
            if (t < 1/2) return q;
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
          };
          
          const q = lPct < 0.5 ? lPct * (1 + sPct) : lPct + sPct - lPct * sPct;
          const p = 2 * lPct - q;
          const hNorm = h / 360;
          
          r = hueToRgb(p, q, hNorm + 1/3);
          g = hueToRgb(p, q, hNorm);
          b = hueToRgb(p, q, hNorm - 1/3);
        }
        
        const rHex = Math.round(r * 255).toString(16).padStart(2, '0').toUpperCase();
        const gHex = Math.round(g * 255).toString(16).padStart(2, '0').toUpperCase();
        const bHex = Math.round(b * 255).toString(16).padStart(2, '0').toUpperCase();
        return `#${rHex}${gHex}${bHex}`;
      }
    }

    // Named colors fallback container
    const namedColors = {
      black: '#000000', white: '#FFFFFF', red: '#FF0000', green: '#008000',
      blue: '#0000FF', yellow: '#FFFF00', purple: '#800080', gray: '#808080',
      silver: '#C0C0C0', maroon: '#800000', olive: '#808000', lime: '#00FF00',
      aqua: '#00FFFF', teal: '#008080', navy: '#000080', fuchsia: '#FF00FF',
      orange: '#FFA500', brown: '#A52A2A', gold: '#FFD700', pink: '#FFC0CB'
    };
    if (namedColors[s]) {
      return namedColors[s];
    }

    return null;
  }

  // Register color frequencies
  function addColor(rawColor) {
    const hex = normalizeToHex(rawColor);
    if (hex) {
      colorMap[hex] = (colorMap[hex] || 0) + 1;
    }
  }

  // Method 1: Traverse all elements computed styles (catches inline & CSS parsed properties)
  const elements = document.querySelectorAll('*');
  elements.forEach(el => {
    try {
      const styles = window.getComputedStyle(el);
      addColor(styles.color);
      addColor(styles.backgroundColor);
      addColor(styles.borderColor);
      addColor(styles.borderTopColor);
    } catch (_) {}
  });

  // Method 2: Traverse active stylesheets (finds CSS variables & rules not currently applied to visible elements)
  for (let i = 0; i < document.styleSheets.length; i++) {
    try {
      const sheet = document.styleSheets[i];
      const rules = sheet.cssRules || sheet.rules;
      if (!rules) continue;

      for (let j = 0; j < rules.length; j++) {
        const rule = rules[j];
        if (rule.style) {
          // Traverse through declarations
          for (let k = 0; k < rule.style.length; k++) {
            const propName = rule.style[k];
            const propVal = rule.style.getPropertyValue(propName);
            
            // Regex parse all hex, rgb, hsl codes inside property value
            const hexes = propVal.match(/#[A-Fa-f0-9]{3,6}\b/g);
            if (hexes) hexes.forEach(addColor);

            const rgbs = propVal.match(/rgba?\(.*?\)/g);
            if (rgbs) rgbs.forEach(addColor);

            const hsls = propVal.match(/hsla?\(.*?\)/g);
            if (hsls) hsls.forEach(addColor);
          }
        }
      }
    } catch (_) {
      // Catch SecurityError for cross-origin stylesheets
    }
  }

  // Sort colors by frequency
  const sortedColors = Object.keys(colorMap).map(hex => {
    return {
      hex: hex,
      count: colorMap[hex]
    };
  }).sort((a, b) => b.count - a.count);

  return sortedColors;
})();
