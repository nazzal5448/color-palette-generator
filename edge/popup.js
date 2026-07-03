/**
 * VoidColor - Web Page Palette Extractor
 * Popup page controller logic.
 */

// State
let colorsList = []; // Array of { hex, count }
let selectedColorForHarmony = '';

// DOM Elements
const elements = {
  extractBtn: document.getElementById('extract-btn'),
  eyedropperBtn: document.getElementById('eyedropper-btn'),
  clearBtn: document.getElementById('clear-btn'),
  resultsCount: document.getElementById('results-count'),
  emptyStateView: document.getElementById('empty-state-view'),
  colorsListGrid: document.getElementById('colors-list-grid'),
  
  // Drawer
  harmonyDrawer: document.getElementById('harmony-drawer'),
  drawerTitle: document.getElementById('drawer-title'),
  closeDrawerBtn: document.getElementById('close-drawer-btn'),
  harmonyComp: document.getElementById('harmony-comp'),
  harmonyAnalog: document.getElementById('harmony-analog'),
  harmonyMono: document.getElementById('harmony-mono'),
  
  // Toast
  toastNotification: document.getElementById('toast-notification'),
  toastMessage: document.getElementById('toast-message')
};

// --- COLOR MATH & HARMONY ALGORITHMS ---

function hexToRgb(hex) {
  let cleanHex = hex.trim().replace('#', '');
  if (cleanHex.length === 3) {
    cleanHex = cleanHex.split('').map(c => c + c).join('');
  }
  const val = parseInt(cleanHex, 16);
  const r = (val >> 16) & 0xFF;
  const g = (val >> 8) & 0xFF;
  const b = val & 0xFF;
  return [r, g, b];
}

function rgbToHex(r, g, b) {
  const rStr = r.toString(16).padStart(2, '0').toUpperCase();
  const gStr = g.toString(16).padStart(2, '0').toUpperCase();
  const bStr = b.toString(16).padStart(2, '0').toUpperCase();
  return `#${rStr}${gStr}${bStr}`;
}

function rgbToHsl(r, g, b) {
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;

  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  const delta = max - min;

  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (delta !== 0) {
    if (l < 0.5) {
      s = delta / (max + min);
    } else {
      s = delta / (2.0 - max - min);
    }

    if (max === rNorm) {
      h = (gNorm - bNorm) / delta + (gNorm < bNorm ? 6 : 0);
    } else if (max === gNorm) {
      h = (bNorm - rNorm) / delta + 2;
    } else if (max === bNorm) {
      h = (rNorm - gNorm) / delta + 4;
    }
    h *= 60;
  }
  return { h, s, l };
}

function hueToRgb(p, q, t) {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1/6) return p + (q - p) * 6 * t;
  if (t < 1/2) return q;
  if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
  return p;
}

function hslToRgb(h, s, l) {
  const hueNorm = h / 360;
  let r, g, b;

  if (s === 0) {
    r = g = b = l; // achromatic
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;

    r = hueToRgb(p, q, hueNorm + 1/3);
    g = hueToRgb(p, q, hueNorm);
    b = hueToRgb(p, q, hueNorm - 1/3);
  }

  return [
    Math.min(255, Math.max(0, Math.round(r * 255))),
    Math.min(255, Math.max(0, Math.round(g * 255))),
    Math.min(255, Math.max(0, Math.round(b * 255)))
  ];
}

function hslToHex(h, s, l) {
  const [r, g, b] = hslToRgb(h, s, l);
  return rgbToHex(r, g, b);
}

// Generate Harmonies
function getHarmonies(baseHex) {
  const [r, g, b] = hexToRgb(baseHex);
  const { h, s, l } = rgbToHsl(r, g, b);
  
  // Complementary
  const compHue = (h + 180) % 360;
  const complementary = [
    hslToHex(h, s, Math.min(0.9, l + 0.15)),
    baseHex,
    hslToHex(h, s, Math.max(0.1, l - 0.15)),
    hslToHex(compHue, s, l),
    hslToHex(compHue, s, Math.max(0.1, l - 0.2))
  ];

  // Analogous
  const left2 = (h - 30 + 360) % 360;
  const left1 = (h - 15 + 360) % 360;
  const right1 = (h + 15) % 360;
  const right2 = (h + 30) % 360;
  const analogous = [
    hslToHex(left2, s, l),
    hslToHex(left1, s, l),
    baseHex,
    hslToHex(right1, s, l),
    hslToHex(right2, s, l)
  ];

  // Monochromatic
  const monochromatic = [
    hslToHex(h, s, 0.90),
    hslToHex(h, s, 0.70),
    baseHex,
    hslToHex(h, s, 0.40),
    hslToHex(h, s, 0.15)
  ];

  return { complementary, analogous, monochromatic };
}

// --- CONTROLLER ACTIONS ---

// Show copy feedback toast
function showToast(message) {
  elements.toastMessage.textContent = message;
  elements.toastNotification.classList.remove('hidden');
  
  // Reset animations
  elements.toastNotification.style.transition = 'none';
  elements.toastNotification.offsetHeight; // trigger reflow
  elements.toastNotification.style.transition = '';
  
  setTimeout(() => {
    elements.toastNotification.classList.add('hidden');
  }, 1800);
}

// Write to Clipboard
function copyToClipboard(text, successMsg) {
  navigator.clipboard.writeText(text).then(() => {
    showToast(successMsg);
  }).catch(() => {
    showToast('Failed to copy');
  });
}

// Render the drawer content
function openDrawer(hex) {
  selectedColorForHarmony = hex;
  elements.drawerTitle.textContent = `Harmonies for ${hex}`;
  
  const harmonies = getHarmonies(hex);
  
  // Render comp row
  elements.harmonyComp.innerHTML = '';
  harmonies.complementary.forEach(c => {
    const block = document.createElement('div');
    block.className = 'harmony-block';
    block.style.backgroundColor = c;
    block.title = c;
    block.addEventListener('click', () => copyToClipboard(c, `Copied: ${c}`));
    elements.harmonyComp.appendChild(block);
  });
  
  // Render analogous row
  elements.harmonyAnalog.innerHTML = '';
  harmonies.analogous.forEach(c => {
    const block = document.createElement('div');
    block.className = 'harmony-block';
    block.style.backgroundColor = c;
    block.title = c;
    block.addEventListener('click', () => copyToClipboard(c, `Copied: ${c}`));
    elements.harmonyAnalog.appendChild(block);
  });
  
  // Render monochromatic row
  elements.harmonyMono.innerHTML = '';
  harmonies.monochromatic.forEach(c => {
    const block = document.createElement('div');
    block.className = 'harmony-block';
    block.style.backgroundColor = c;
    block.title = c;
    block.addEventListener('click', () => copyToClipboard(c, `Copied: ${c}`));
    elements.harmonyMono.appendChild(block);
  });
  
  elements.harmonyDrawer.classList.remove('hidden');
}

function closeDrawer() {
  elements.harmonyDrawer.classList.add('hidden');
}

// Render colors list
function renderColors() {
  elements.colorsListGrid.innerHTML = '';
  
  if (colorsList.length === 0) {
    elements.emptyStateView.style.display = 'flex';
    elements.resultsCount.textContent = 'No colors extracted';
    elements.clearBtn.classList.add('hidden');
    return;
  }

  elements.emptyStateView.style.display = 'none';
  elements.resultsCount.textContent = `${colorsList.length} unique colors`;
  elements.clearBtn.classList.remove('hidden');

  colorsList.forEach(c => {
    const card = document.createElement('div');
    card.className = 'color-card glass';
    
    card.innerHTML = `
      <div class="color-swatch" style="background-color: ${c.hex};"></div>
      <div class="color-details">
        <span class="color-hex">${c.hex}</span>
        <span class="color-tag">${c.count ? `Used ${c.count}x` : 'Eyedropper'}</span>
      </div>
      <div class="color-card-actions">
        <button class="card-icon-btn copy-btn" title="Copy HEX">
          <svg viewBox="0 0 24 24" width="10" height="10"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
        </button>
        <button class="card-icon-btn harmony-btn" title="View Harmonies">
          <svg viewBox="0 0 24 24" width="10" height="10"><circle cx="12" cy="12" r="10"></circle><path d="M8 12h8"></path><path d="M12 8v8"></path></svg>
        </button>
      </div>
    `;

    // Hook card elements events
    card.querySelector('.copy-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      copyToClipboard(c.hex, `Copied: ${c.hex}`);
    });

    card.querySelector('.harmony-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      openDrawer(c.hex);
    });

    card.addEventListener('click', () => {
      copyToClipboard(c.hex, `Copied: ${c.hex}`);
    });

    elements.colorsListGrid.appendChild(card);
  });
}

// Crawl active tab
async function handleExtraction() {
  elements.extractBtn.disabled = true;
  elements.extractBtn.textContent = 'Extracting...';
  
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab) {
      showToast('No active tab found');
      return;
    }

    // Skip restricted internal pages (like chrome://)
    if (tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('about:') || tab.url.startsWith('view-source:')) {
      showToast('Cannot extract from browser pages');
      return;
    }

    // Inject and execute content script
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    });

    if (results && results[0] && results[0].result) {
      colorsList = results[0].result;
      renderColors();
    } else {
      showToast('No colors extracted');
    }
  } catch (err) {
    console.error(err);
    showToast('Failed to access webpage styles');
  } finally {
    elements.extractBtn.disabled = false;
    elements.extractBtn.textContent = 'Extract Webpage Colors';
  }
}

// Eyedropper Tool
async function handleEyedropper() {
  if (!window.EyeDropper) {
    showToast('Eyedropper not supported by browser');
    return;
  }

  const eyeDropper = new EyeDropper();
  
  try {
    // Hide popup window temporarily (if possible) or start picker directly
    const result = await eyeDropper.open();
    const hex = result.sRGBHex.toUpperCase();
    
    // Check if color already exists in list
    const existing = colorsList.find(c => c.hex === hex);
    if (!existing) {
      colorsList.unshift({ hex: hex, count: 0 }); // Put at top
      renderColors();
    }
    
    copyToClipboard(hex, `Eyedropper Copied: ${hex}`);
  } catch (err) {
    // User cancelled picking
  }
}

// Init Event Listeners
function setupEvents() {
  elements.extractBtn.addEventListener('click', handleExtraction);
  elements.eyedropperBtn.addEventListener('click', handleEyedropper);
  
  elements.clearBtn.addEventListener('click', () => {
    colorsList = [];
    renderColors();
    closeDrawer();
  });

  elements.closeDrawerBtn.addEventListener('click', closeDrawer);
}

document.addEventListener('DOMContentLoaded', () => {
  setupEvents();
  renderColors();
  
  // Auto-crawls on popup open if permissions allowed
  handleExtraction();
});
