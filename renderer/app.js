// 'use strict';

// ── DOM refs ──────────────────────────────────────────────────────────────────
const grid           = document.getElementById('grid');
const skeletonGrid   = document.getElementById('skeletonGrid');
const btnLoad        = document.getElementById('btnLoad');
const statCount      = document.getElementById('statCount');
const statSaved      = document.getElementById('statSaved');
const toastStack     = document.getElementById('toastStack');
const modalBackdrop  = document.getElementById('modalBackdrop');
const modalImg       = document.getElementById('modalImg');
const modalGlow      = document.getElementById('modalGlow');
const modalDl        = document.getElementById('modalDl');
const modalCloseBtn  = document.getElementById('modalCloseBtn');
const modalPrev      = document.getElementById('modalPrev');
const modalNext      = document.getElementById('modalNext');
const modalTags      = document.getElementById('modalTags');
const modalNoTags    = document.getElementById('modalNoTags');
const modalTagsSpinner = document.getElementById('modalTagsSpinner');
const modalSrcChip   = document.getElementById('modalSrcChip');
const modalResLabel  = document.getElementById('modalResLabel');
const wpMonitorSel   = document.getElementById('wpMonitor');
const btnSetWallpaper = document.getElementById('btnSetWallpaper');
const cropCanvas     = document.getElementById('cropCanvas');
const cropControls   = document.getElementById('cropControls');
const btnCropConfirm = document.getElementById('btnCropConfirm');
const btnCropCancel  = document.getElementById('btnCropCancel');
const btnCrop        = document.getElementById('btnCrop');
const mpCropInfo     = document.getElementById('mpCropInfo');

// ── Crop state ────────────────────────────────────────────────────────────────
let cropActive = false;
let cropRect   = null;   
let cropNorm   = null;   
let dragState  = null;   
let targetRatio = 16 / 9;

const HSIZE = 7; 
const HANDLE_CURSORS = ['nw-resize', 'ne-resize', 'sw-resize', 'se-resize'];

function getHandles(r) {
  const { x1, y1, x2, y2 } = r;
  return [
    { x: x1, y: y1 }, 
    { x: x2, y: y1 }, 
    { x: x1, y: y2 }, 
    { x: x2, y: y2 }, 
  ];
}

function getImgDisplayRect() {
  const cw = cropCanvas.width, ch = cropCanvas.height;
  const nw = modalImg.naturalWidth, nh = modalImg.naturalHeight;
  if (!nw || !nh) return null;
  const scale = Math.min(cw / nw, ch / nh);
  const dw = nw * scale, dh = nh * scale;
  return { x: (cw - dw) / 2, y: (ch - dh) / 2, w: dw, h: dh, scale };
}

function normRect(r) {
  return { x1: Math.min(r.x1, r.x2), y1: Math.min(r.y1, r.y2), x2: Math.max(r.x1, r.x2), y2: Math.max(r.y1, r.y2) };
}

function drawCrop() {
  const ctx = cropCanvas.getContext('2d');
  const w = cropCanvas.width, h = cropCanvas.height;
  ctx.clearRect(0, 0, w, h);

  if (!cropRect) return;

  const nr = normRect(cropRect);
  const rw = nr.x2 - nr.x1, rh = nr.y2 - nr.y1;

  ctx.fillStyle = 'rgba(0,0,0,.62)';
  ctx.fillRect(0, 0, w, h);
  ctx.clearRect(nr.x1, nr.y1, rw, rh);

  ctx.strokeStyle = 'rgba(255,255,255,.88)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(nr.x1 + .5, nr.y1 + .5, rw - 1, rh - 1);

  ctx.strokeStyle = 'rgba(255,255,255,.18)';
  ctx.lineWidth = .6;
  for (let i = 1; i < 3; i++) {
    ctx.beginPath(); ctx.moveTo(nr.x1 + rw*i/3, nr.y1); ctx.lineTo(nr.x1 + rw*i/3, nr.y2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(nr.x1, nr.y1 + rh*i/3); ctx.lineTo(nr.x2, nr.y1 + rh*i/3); ctx.stroke();
  }

  getHandles(nr).forEach(hp => {
    ctx.fillStyle = '#fff';
    ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 4;
    ctx.fillRect(hp.x - HSIZE, hp.y - HSIZE, HSIZE * 2, HSIZE * 2);
    ctx.shadowBlur = 0;
  });

  const hint = 'Drag to pan  ·  Corners to scale';
  ctx.font = '11px -apple-system, Segoe UI, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  const tw = ctx.measureText(hint).width + 22;
  const bx = nr.x1 + rw / 2, by = Math.min(nr.y2 - 10, h - 10);
  ctx.fillStyle = 'rgba(0,0,0,.52)';
  ctx.fillRect(bx - tw / 2, by - 18, tw, 20);
  ctx.fillStyle = 'rgba(255,255,255,.82)';
  ctx.fillText(hint, bx, by);
}

function enterCropMode() {
  cropActive = true;
  const wrap = modalImg.parentElement;
  cropCanvas.width  = wrap.clientWidth;
  cropCanvas.height = wrap.clientHeight;

  const ir = getImgDisplayRect();
  if (ir) {
    const selId = wpMonitorSel.value;
    const mon = cachedMonitors?.find(m => m.id === selId);
    targetRatio = (mon && mon.ratio) ? mon.ratio : (16 / 9);

    let boxW = ir.w;
    let boxH = ir.w / targetRatio;
    
    // Fit perfectly inside the display boundaries
    if (boxH > ir.h) {
      boxH = ir.h;
      boxW = ir.h * targetRatio;
    }

    const bx = ir.x + (ir.w - boxW) / 2;
    const by = ir.y + (ir.h - boxH) / 2;
    cropRect = { x1: bx, y1: by, x2: bx + boxW, y2: by + boxH };
  }

  cropCanvas.classList.add('active');
  cropControls.classList.add('active');
  btnCrop.classList.add('cropping');
  drawCrop();
}

function exitCropMode() {
  cropActive = false;
  cropCanvas.classList.remove('active');
  cropControls.classList.remove('active');
  btnCrop.classList.remove('cropping');
}

function updateCropDisplay() {
  if (!cropNorm) {
    mpCropInfo.textContent = 'Full image — no crop';
    mpCropInfo.classList.remove('has-crop');
  } else {
    const x = Math.round(cropNorm.x * 100), y = Math.round(cropNorm.y * 100);
    const w = Math.round(cropNorm.w * 100), h = Math.round(cropNorm.h * 100);
    mpCropInfo.textContent = `${x}%,${y}%  ${w}×${h}%`;
    mpCropInfo.classList.add('has-crop');
  }
}

// Fixed Aspect Ratio Drag & Resize Events
cropCanvas.addEventListener('mousedown', e => {
  if (!cropActive || !cropRect) return;
  e.preventDefault();
  const bnd = cropCanvas.getBoundingClientRect();
  const mx = e.clientX - bnd.left, my = e.clientY - bnd.top;

  const nr = normRect(cropRect);
  const handles = getHandles(nr);
  for (let i = 0; i < handles.length; i++) {
    if (Math.abs(mx - handles[i].x) <= HSIZE + 4 && Math.abs(my - handles[i].y) <= HSIZE + 4) {
      dragState = { type: 'handle', handleIdx: i, startX: mx, startY: my, origRect: { ...nr } };
      return;
    }
  }
  if (mx >= nr.x1 && mx <= nr.x2 && my >= nr.y1 && my <= nr.y2) {
    dragState = { type: 'move', startX: mx, startY: my, origRect: { ...nr } };
    return;
  }
});

cropCanvas.addEventListener('mousemove', e => {
  if (!cropActive) return;
  const bnd = cropCanvas.getBoundingClientRect();
  const mx = e.clientX - bnd.left, my = e.clientY - bnd.top;

  if (!dragState) {
    if (cropRect) {
      const nr = normRect(cropRect);
      const handles = getHandles(nr);
      let cur = 'crosshair';
      for (let i = 0; i < handles.length; i++) {
        if (Math.abs(mx - handles[i].x) <= HSIZE + 4 && Math.abs(my - handles[i].y) <= HSIZE + 4) { cur = HANDLE_CURSORS[i]; break; }
      }
      if (cur === 'crosshair' && mx >= nr.x1 && mx <= nr.x2 && my >= nr.y1 && my <= nr.y2) cur = 'move';
      cropCanvas.style.cursor = cur;
    }
    return;
  }

  const ir = getImgDisplayRect();
  if (!ir) return;

  if (dragState.type === 'move') {
    const orig = dragState.origRect;
    const rw = orig.x2 - orig.x1, rh = orig.y2 - orig.y1;
    const dx = mx - dragState.startX, dy = my - dragState.startY;
    let nx1 = orig.x1 + dx, ny1 = orig.y1 + dy;

    // Clamp panning to image borders
    nx1 = Math.max(ir.x, Math.min(ir.x + ir.w - rw, nx1));
    ny1 = Math.max(ir.y, Math.min(ir.y + ir.h - rh, ny1));
    cropRect = { x1: nx1, y1: ny1, x2: nx1 + rw, y2: ny1 + rh };

  } else if (dragState.type === 'handle') {
    const orig = dragState.origRect;
    let dx = mx - dragState.startX;

    let newW = orig.x2 - orig.x1;
    let newH = orig.y2 - orig.y1;

    // Math locking the corners perfectly to the monitor's aspect ratio
    if (dragState.handleIdx === 0) { 
      newW -= dx; newH = newW / targetRatio;
      let nx1 = orig.x2 - newW, ny1 = orig.y2 - newH;
      if (nx1 < ir.x || ny1 < ir.y || newW < 20) {
         let maxW_x = orig.x2 - ir.x;
         let maxW_y = (orig.y2 - ir.y) * targetRatio;
         newW = Math.max(20, Math.min(maxW_x, maxW_y));
         newH = newW / targetRatio;
         nx1 = orig.x2 - newW; ny1 = orig.y2 - newH;
      }
      cropRect = { x1: nx1, y1: ny1, x2: orig.x2, y2: orig.y2 };
    } else if (dragState.handleIdx === 1) { 
      newW += dx; newH = newW / targetRatio;
      let nx2 = orig.x1 + newW, ny1 = orig.y2 - newH;
      if (nx2 > ir.x + ir.w || ny1 < ir.y || newW < 20) {
         let maxW_x = (ir.x + ir.w) - orig.x1;
         let maxW_y = (orig.y2 - ir.y) * targetRatio;
         newW = Math.max(20, Math.min(maxW_x, maxW_y));
         newH = newW / targetRatio;
         nx2 = orig.x1 + newW; ny1 = orig.y2 - newH;
      }
      cropRect = { x1: orig.x1, y1: ny1, x2: nx2, y2: orig.y2 };
    } else if (dragState.handleIdx === 2) { 
      newW -= dx; newH = newW / targetRatio;
      let nx1 = orig.x2 - newW, ny2 = orig.y1 + newH;
      if (nx1 < ir.x || ny2 > ir.y + ir.h || newW < 20) {
         let maxW_x = orig.x2 - ir.x;
         let maxW_y = ((ir.y + ir.h) - orig.y1) * targetRatio;
         newW = Math.max(20, Math.min(maxW_x, maxW_y));
         newH = newW / targetRatio;
         nx1 = orig.x2 - newW; ny2 = orig.y1 + newH;
      }
      cropRect = { x1: nx1, y1: orig.y1, x2: orig.x2, y2: ny2 };
    } else if (dragState.handleIdx === 3) { 
      newW += dx; newH = newW / targetRatio;
      let nx2 = orig.x1 + newW, ny2 = orig.y1 + newH;
      if (nx2 > ir.x + ir.w || ny2 > ir.y + ir.h || newW < 20) {
         let maxW_x = (ir.x + ir.w) - orig.x1;
         let maxW_y = ((ir.y + ir.h) - orig.y1) * targetRatio;
         newW = Math.max(20, Math.min(maxW_x, maxW_y));
         newH = newW / targetRatio;
         nx2 = orig.x1 + newW; ny2 = orig.y1 + newH;
      }
      cropRect = { x1: orig.x1, y1: orig.y1, x2: nx2, y2: ny2 };
    }
  }
  drawCrop();
});

cropCanvas.addEventListener('mouseup', () => { dragState = null; });
cropCanvas.addEventListener('mouseleave', () => { dragState = null; });

btnCrop.addEventListener('click', () => {
  if (cropActive) return;
  enterCropMode();
});

btnCropConfirm.addEventListener('click', () => {
  if (cropRect) {
    const ir = getImgDisplayRect();
    if (ir) {
      const nr = normRect(cropRect);
      cropNorm = {
        x: (nr.x1 - ir.x) / ir.w, y: (nr.y1 - ir.y) / ir.h,
        w: (nr.x2 - nr.x1) / ir.w, h: (nr.y2 - nr.y1) / ir.h,
      };
      cropNorm.x = Math.max(0, Math.min(1, cropNorm.x));
      cropNorm.y = Math.max(0, Math.min(1, cropNorm.y));
      cropNorm.w = Math.min(1 - cropNorm.x, cropNorm.w);
      cropNorm.h = Math.min(1 - cropNorm.y, cropNorm.h);
    }
  }
  exitCropMode();
  updateCropDisplay();
});

btnCropCancel.addEventListener('click', () => {
  cropRect = null;
  exitCropMode();
});

// ── App state ─────────────────────────────────────────────────────────────────
let currentSrc  = 'all';
let whPage      = 1;
let totalLoaded = 0;
let totalSaved  = 0;
let loading     = false;
let allImages   = [];
let modalIdx    = 0;

let currentCols = 5;
let masonryCols = [];
let colCounter  = 0;

let cachedMonitors = null; // Store fetched monitors

// Settings panel
const settingsBackdrop = document.getElementById('settingsBackdrop');
const settingsPanel    = document.getElementById('settingsPanel');
const btnSettings      = document.getElementById('btnSettings');
const btnSettingsClose = document.getElementById('btnSettingsClose');
const btnSettingsSave  = document.getElementById('btnSettingsSave');
const btnSettingsCancel= document.getElementById('btnSettingsCancel');
const btnWhEye         = document.getElementById('btnWhEye');

// ── Titlebar controls ─────────────────────────────────────────────────────────
document.getElementById('btnMin').addEventListener('click',   () => window.aniwall.minimize());
document.getElementById('btnMax').addEventListener('click',   () => window.aniwall.maximize());
document.getElementById('btnClose').addEventListener('click', () => window.aniwall.close());

// ── Settings state ────────────────────────────────────────────────────────────
const WP_SFW_CATS  = ['waifu','neko','shinobu','megumin','cuddle','awoo','pat','hug','kiss'];
const WP_NSFW_CATS = ['waifu','neko','trap','blowjob'];
const NB_ALL_CATS  = ['neko','kitsune','waifu','husbando'];

const isGif = url => /\.gif(\?|$)/i.test(url);

let settings = null;
let favorites = [];

// ── Source meta ───────────────────────────────────────────────────────────────
const SRC = {
  wallhaven: { label: 'Wallhaven', color: '#7c5cfc', bg: 'rgba(124,92,252,.18)' },
  waifupics: { label: 'Waifu.pics', color: '#fc5c7d', bg: 'rgba(252,92,125,.18)' },
  nekosbest: { label: 'Nekos.best', color: '#3ecfb2', bg: 'rgba(62,207,178,.18)' },
};

// ── Fetchers ──────────────────────────────────────────────────────────────────
async function fetchWallhaven() {
  const wh    = settings.wallhaven;
  const query = wh.query.trim() || 'anime';
  const params = new URLSearchParams({
    q:          query,
    categories: wh.categories || '010',
    purity:     wh.purity    || '100',
    sorting:    wh.sorting,
    order:      wh.order,
    page:       String(whPage),
  });
  if (wh.minRes)  params.set('atleast', wh.minRes);
  if (wh.apiKey)  params.set('apikey',  wh.apiKey);

  const ori = settings.display?.orientation;
  if (ori === 'landscape') params.set('ratios', 'landscape');
  if (ori === 'portrait')  params.set('ratios', 'portrait');

  const res  = await fetch(`https://wallhaven.cc/api/v1/search?${params}`);
  const json = await res.json();
  whPage++;
  return (json.data || [])
    .filter(w => !isGif(w.path))
    .map(w => ({
      thumb:  w.thumbs?.large ?? w.thumbs?.original ?? w.path,
      full:   w.path,
      source: 'wallhaven',
      label:  w.resolution ?? '',
      tags:   (w.tags || []).map(t => t.name),
    }));
}

async function fetchWaifuPics() {
  const wp     = settings.waifupics;
  const purity = wp.purity || 'sfw';

  const pool = [];
  if (purity === 'sfw' || purity === 'both') {
    const cats = wp.sfwCategories?.length ? wp.sfwCategories : WP_SFW_CATS;
    cats.forEach(c => pool.push({ mode: 'sfw', cat: c }));
  }
  if (purity === 'nsfw' || purity === 'both') {
    const cats = wp.nsfwCategories?.length ? wp.nsfwCategories : WP_NSFW_CATS;
    cats.forEach(c => pool.push({ mode: 'nsfw', cat: c }));
  }
  if (!pool.length) return [];

  const { mode, cat } = pool[Math.floor(Math.random() * pool.length)];
  const res  = await fetch(`https://api.waifu.pics/many/${mode}/${cat}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ exclude: [] }),
  });
  const json = await res.json();
  return (json.files || [])
    .filter(url => !isGif(url))
    .map(url => ({ thumb: url, full: url, source: 'waifupics', label: '', tags: [cat, mode] }));
}

async function fetchNekosBest() {
  const cats = settings.nekosbest.categories;
  if (!cats.length) return [];
  const cat  = cats[Math.floor(Math.random() * cats.length)];
  const res  = await fetch(`https://nekos.best/api/v2/${cat}?amount=20`);
  const json = await res.json();
  return (json.results || [])
    .filter(r => !isGif(r.url))
    .map(r => ({
      thumb: r.url, full: r.url, source: 'nekosbest',
      label: r.artist_name ?? '',
      tags:  [cat, ...(r.artist_name ? [r.artist_name] : [])],
    }));
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
const SKEL_HEIGHTS = [180,240,160,300,200,260,140,220,280,190,150,310];

function showSkeletons(count = 12) {
  skeletonGrid.innerHTML = '';
  skeletonGrid.classList.remove('hidden');
  for (let i = 0; i < count; i++) {
    const d = document.createElement('div');
    d.className = 'skel-card';
    const img = document.createElement('div');
    img.className = 'skel-img';
    img.style.height = `${SKEL_HEIGHTS[i % SKEL_HEIGHTS.length]}px`;
    img.style.animationDelay = `${(i * 0.07).toFixed(2)}s`;
    d.appendChild(img);
    skeletonGrid.appendChild(d);
  }
}

function hideSkeletons() {
  skeletonGrid.classList.add('hidden');
  setTimeout(() => { skeletonGrid.innerHTML = ''; }, 300);
}

// ── Filter Orientation ────────────────────────────────────────────────────────
async function filterOrientation(imgs) {
  const ori = settings.display?.orientation;
  if (!ori || ori === 'both') return imgs;

  const validImgs = [];
  await Promise.all(imgs.map(img => new Promise(resolve => {
    if (img.source === 'wallhaven') {
      validImgs.push(img);
      return resolve();
    }
    if (img.label && img.label.includes('x')) {
      const [w, h] = img.label.split('x').map(Number);
      const isLand = w > h;
      if ((ori === 'landscape' && isLand) || (ori === 'portrait' && !isLand)) validImgs.push(img);
      return resolve();
    }
    const i = new Image();
    i.onload = () => {
      const isLand = i.width > i.height;
      if ((ori === 'landscape' && isLand) || (ori === 'portrait' && !isLand)) validImgs.push(img);
      resolve();
    };
    i.onerror = resolve; 
    i.src = img.thumb;
  })));

  return imgs.filter(img => validImgs.includes(img));
}

// ── Flexbox Columns Override ──────────────────────────────────────────────────
function applyColumns() {
  const val = settings?.display?.columns ?? 'auto';
  if (val === 'auto') {
    const w = window.innerWidth;
    if (w > 1500) currentCols = 5;
    else if (w > 1100) currentCols = 4;
    else if (w > 750) currentCols = 3;
    else currentCols = 2;
  } else {
    currentCols = parseInt(val, 10);
  }

  const style = document.getElementById('colOverride') ?? (() => {
    const s = document.createElement('style');
    s.id = 'colOverride';
    document.head.appendChild(s);
    return s;
  })();
  style.textContent = `
    .grid { display: flex !important; flex-direction: row; gap: 14px; align-items: flex-start; columns: unset !important; }
    .grid-col { display: flex; flex-direction: column; gap: 14px; flex: 1; min-width: 0; }
    .skeleton-grid { columns: ${currentCols} !important; }
    .card { margin-bottom: 0 !important; break-inside: auto !important; width: 100%; }
  `;
}

function rebuildGrid() {
  grid.innerHTML = '';
  masonryCols = [];
  colCounter = 0;
  for (let i = 0; i < currentCols; i++) {
    const col = document.createElement('div');
    col.className = 'grid-col';
    grid.appendChild(col);
    masonryCols.push(col);
  }
  const savedImages = [...allImages];
  allImages = [];
  renderCards(savedImages);
}

let resizeTimer;
window.addEventListener('resize', () => {
  if (settings?.display?.columns === 'auto') {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const oldCols = currentCols;
      applyColumns();
      if (oldCols !== currentCols) rebuildGrid();
    }, 200);
  }
});

// ── Load ──────────────────────────────────────────────────────────────────────
async function load(isRefresh = false) {
  if (loading) return;
  loading = true;
  btnLoad.classList.add('loading');
  btnLoad.disabled = true;

  if (isRefresh) {
    showSkeletons();
    grid.classList.add('fading');
    await sleep(200);
    
    applyColumns();
    grid.innerHTML = '';
    masonryCols = [];
    colCounter = 0;
    for (let i = 0; i < currentCols; i++) {
      const col = document.createElement('div');
      col.className = 'grid-col';
      grid.appendChild(col);
      masonryCols.push(col);
    }
    grid.classList.remove('fading');
  }

  try {
    let imgs = [];

    if (currentSrc === 'favorites') {
      const perPage = 20;
      const start = (whPage - 1) * perPage;
      const reversedFavs = [...favorites].reverse();
      imgs = reversedFavs.slice(start, start + perPage);
      whPage++;
      if (imgs.length === 0 && start === 0) {
        toast('Your collection is empty!', 'info');
      }
    } else if (currentSrc === 'all') {
      const [wh, wp, nb] = await Promise.allSettled([
        fetchWallhaven(), fetchWaifuPics(), fetchNekosBest(),
      ]);
      if (wh.status === 'fulfilled') imgs.push(...wh.value);
      if (wp.status === 'fulfilled') imgs.push(...wp.value);
      if (nb.status === 'fulfilled') imgs.push(...nb.value);
      imgs.sort(() => Math.random() - 0.5);
    } else if (currentSrc === 'wallhaven') {
      imgs = await fetchWallhaven();
    } else if (currentSrc === 'waifupics') {
      imgs = await fetchWaifuPics();
    } else if (currentSrc === 'nekosbest') {
      imgs = await fetchNekosBest();
    }

    hideSkeletons();
    const filtered = await filterOrientation(imgs);
    
    renderCards(filtered);
    totalLoaded += filtered.length;
    updateStats();
    
    if (filtered.length === 0 && imgs.length > 0) {
      toast('No images matched your orientation filter. Click load more!', 'info', 4000);
    }

  } catch (err) {
    console.error(err);
    hideSkeletons();
    toast('⚠️ Failed to load — check your connection', 'error');
  }

  btnLoad.classList.remove('loading');
  btnLoad.disabled = false;
  loading = false;
}

// ── Render cards ──────────────────────────────────────────────────────────────
function renderCards(imgs) {
  const startIdx = allImages.length;
  allImages.push(...imgs);

  imgs.forEach((img, i) => {
    const s   = SRC[img.source];
    const div = document.createElement('div');
    div.className = 'card';
    div.dataset.idx = String(startIdx + i);

    const imgEl = document.createElement('img');
    imgEl.src     = img.thumb;
    imgEl.alt     = 'wallpaper';
    imgEl.loading = 'lazy';
    imgEl.addEventListener('error', () => {
      allImages.splice(Number(div.dataset.idx), 1, null);
      div.remove();
    });

    const badge = document.createElement('span');
    badge.className = 'card-src-badge';
    badge.style.cssText = `background:${s.bg}; color:${s.color}; border:1px solid ${s.color}33`;
    badge.textContent = s.label;

    const overlay = document.createElement('div');
    overlay.className = 'card-overlay';

    if (img.label) {
      const res = document.createElement('div');
      res.className = 'card-res';
      res.textContent = img.label;
      overlay.appendChild(res);
    }

    const actions = document.createElement('div');
    actions.className = 'card-actions';

    const btnHeart = document.createElement('button');
    btnHeart.className = 'btn-card btn-view-card';
    btnHeart.style.padding = '6px'; 
    
    const isFav = favorites.some(f => f.full === img.full);
    const heartSvgEmpty = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`;
    const heartSvgFilled = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2.5"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`;
    
    btnHeart.style.color = isFav ? '#fc5c7d' : '#fff';
    btnHeart.innerHTML = isFav ? heartSvgFilled : heartSvgEmpty;
    btnHeart.title = isFav ? 'Remove from Collection' : 'Add to Collection';

    btnHeart.addEventListener('click', async (e) => {
      e.stopPropagation();
      const fIdx = favorites.findIndex(f => f.full === img.full);
      if (fIdx >= 0) {
        favorites.splice(fIdx, 1);
        btnHeart.style.color = '#fff';
        btnHeart.innerHTML = heartSvgEmpty;
        btnHeart.title = 'Add to Collection';
        if (currentSrc === 'favorites') {
          div.style.display = 'none'; 
        }
      } else {
        favorites.push(img);
        btnHeart.style.color = '#fc5c7d';
        btnHeart.innerHTML = heartSvgFilled;
        btnHeart.title = 'Remove from Collection';
      }
      await window.aniwall.saveFavorites(favorites);
    });

    const btnDl = document.createElement('button');
    btnDl.className = 'btn-card btn-dl-card';
    btnDl.innerHTML = `<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1v7M3 5l3 3 3-3M1 10h10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg> Save`;
    btnDl.addEventListener('click', e => { e.stopPropagation(); downloadImage(img.full); });

    const btnView = document.createElement('button');
    btnView.className = 'btn-card btn-view-card';
    btnView.innerHTML = `<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1 1h4M1 1v4M11 1H7M11 1v4M1 11h4M1 11V7M11 11H7M11 11V7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg> View`;
    btnView.addEventListener('click', e => { e.stopPropagation(); openModal(startIdx + i); });

    actions.append(btnHeart, btnDl, btnView);
    overlay.appendChild(actions);
    div.append(imgEl, badge, overlay);
    div.addEventListener('click', () => openModal(startIdx + i));
    
    if (masonryCols.length > 0) {
      masonryCols[colCounter % currentCols].appendChild(div);
      colCounter++;
    } else {
      grid.appendChild(div);
    }

    const delay = (i % 20) * 45;
    requestAnimationFrame(() => {
      setTimeout(() => div.classList.add('visible'), delay);
    });
  });
}

// ── Modal ─────────────────────────────────────────────────────────────────────
async function openModal(idx) {
  while (idx < allImages.length && !allImages[idx]) idx++;
  if (idx >= allImages.length) return;
  modalIdx              = idx;
  const img             = allImages[idx];
  modalImg.crossOrigin  = 'anonymous';
  modalImg.src          = img.full;

  const s = SRC[img.source];
  modalGlow.style.background = `radial-gradient(ellipse at center, ${s.color}40 0%, transparent 65%)`;

  modalSrcChip.textContent   = s.label;
  modalSrcChip.style.cssText = `background:${s.bg}; color:${s.color}; border:1px solid ${s.color}44`;
  modalResLabel.textContent  = img.label || '';

  renderTagsInPanel(img.tags || [], img.tagsLoaded === true);

  if (img.source === 'wallhaven' && !img.tagsLoaded) {
    fetchWallhavenTags(img).then(tags => {
      img.tags      = tags;
      img.tagsLoaded = true;
      if (allImages[modalIdx] === img) renderTagsInPanel(tags, true);
    }).catch(() => {
      img.tagsLoaded = true;
      if (allImages[modalIdx] === img) renderTagsInPanel(img.tags || [], true);
    });
  }

  cropRect = null; cropNorm = null;
  if (cropActive) exitCropMode();
  updateCropDisplay();

  loadMonitors();
  modalBackdrop.classList.add('open');
}

function renderTagsInPanel(tags, loaded) {
  modalTags.innerHTML  = '';
  modalNoTags.style.display = 'none';

  if (!loaded) {
    modalTagsSpinner.style.display = 'flex';
    return;
  }
  modalTagsSpinner.style.display = 'none';

  if (!tags.length) {
    modalNoTags.style.display = 'block';
    return;
  }
  
  tags.forEach(tag => {
    const chip = document.createElement('span');
    chip.className   = 'mp-tag';
    chip.textContent = tag;
    chip.style.cursor = 'pointer'; 
    
    chip.addEventListener('click', () => {
      closeModal();
      
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      document.querySelector('.nav-item[data-src="wallhaven"]').classList.add('active');
      currentSrc = 'wallhaven';

      settings.wallhaven.query = tag;
      document.getElementById('wh-query').value = tag;
      window.aniwall.setSettings(settings);

      whPage = 1; 
      totalLoaded = 0; 
      allImages = [];
      updateStats();
      
      toast(`🔍 Searching for "${tag}"...`, 'info');
      load(true);
    });
    
    modalTags.appendChild(chip);
  });
}

async function fetchWallhavenTags(img) {
  const id = img.full.match(/wallhaven-([^.]+)/)?.[1];
  if (!id) return img.tags || [];
  const apiKey = settings.wallhaven.apiKey;
  const url    = `https://wallhaven.cc/api/v1/w/${id}${apiKey ? '?apikey=' + encodeURIComponent(apiKey) : ''}`;
  const res    = await fetch(url);
  const json   = await res.json();
  return (json.data?.tags || []).map(t => t.name);
}

function closeModal() {
  if (cropActive) exitCropMode();
  cropRect = null; cropNorm = null;
  modalBackdrop.classList.remove('open');
  setTimeout(() => { modalImg.src = ''; }, 350);
}

function modalNavigate(dir) {
  let next = modalIdx + dir;
  while (next >= 0 && next < allImages.length && !allImages[next]) next += dir;
  if (next >= 0 && next < allImages.length) {
    modalImg.style.opacity    = '0';
    modalImg.style.transition = 'opacity .15s ease';
    setTimeout(() => { openModal(next); modalImg.style.opacity = '1'; }, 150);
  }
}

modalCloseBtn.addEventListener('click', closeModal);
modalBackdrop.addEventListener('click', e => { if (e.target === modalBackdrop) closeModal(); });
modalPrev.addEventListener('click', () => modalNavigate(-1));
modalNext.addEventListener('click', () => modalNavigate(1));
modalDl.addEventListener('click', () => { const img = allImages[modalIdx]; if (img) downloadImage(img.full); });
document.addEventListener('keydown', e => {
  if (!modalBackdrop.classList.contains('open')) return;
  if (e.key === 'Escape')      closeModal();
  if (e.key === 'ArrowLeft')   modalNavigate(-1);
  if (e.key === 'ArrowRight')  modalNavigate(1);
});

// ── Wallpaper ─────────────────────────────────────────────────────────────────
async function loadMonitors() {
  try {
    wpMonitorSel.disabled = true;
    cachedMonitors = await window.aniwall.getMonitors();
    wpMonitorSel.innerHTML = '';
    cachedMonitors.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m.id; opt.textContent = m.label;
      wpMonitorSel.appendChild(opt);
    });
  } catch (err) {
    console.error('Failed to load monitors', err);
    if (!wpMonitorSel.options.length) {
      wpMonitorSel.innerHTML = '<option value="all">All Monitors</option>';
    }
  } finally {
    wpMonitorSel.disabled = false;
  }
}

// Adjust aspect ratio crop box dynamically if user changes monitor setting mid-crop
wpMonitorSel.addEventListener('change', () => {
  if (cropActive) enterCropMode();
});

async function cropAndSave() {
  return new Promise((resolve, reject) => {
    const nw = modalImg.naturalWidth, nh = modalImg.naturalHeight;
    const cx = Math.round(cropNorm.x * nw), cy = Math.round(cropNorm.y * nh);
    const cw = Math.round(cropNorm.w * nw), ch = Math.round(cropNorm.h * nh);
    if (cw < 2 || ch < 2) return reject(new Error('Crop region too small'));
    const canvas = document.createElement('canvas');
    canvas.width = cw; canvas.height = ch;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(modalImg, cx, cy, cw, ch, 0, 0, cw, ch);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    window.aniwall.saveImageData({ dataUrl, ext: 'jpg' }).then(resolve).catch(reject);
  });
}

btnSetWallpaper.addEventListener('click', async () => {
  const img = allImages[modalIdx];
  if (!img) return;
  const monitor = wpMonitorSel.value;
  btnSetWallpaper.disabled = true;
  btnSetWallpaper.textContent = 'Applying…';
  try {
    let finalPath;
    if (cropNorm) {
      const t = toast('✂ Cropping image…', 'info', 0);
      finalPath = await cropAndSave();
      dismissToast(t);
    } else {
      const t = toast('⏳ Downloading…', 'info', 0);
      finalPath = await window.aniwall.downloadTemp(img.full); 
      dismissToast(t);
    }
    await window.aniwall.setWallpaper({ imagePath: finalPath, monitor, fitMode: '4' });
    toast('✓ Wallpaper applied!', 'success');
  } catch (err) {
    toast('✕ Failed to set wallpaper', 'error');
    console.error(err);
  }
  btnSetWallpaper.disabled = false;
  btnSetWallpaper.innerHTML = `<svg width="13" height="13" viewBox="0 0 14 14" fill="none"><rect x="1" y="1" width="12" height="12" rx="2" stroke="currentColor" stroke-width="1.4"/><rect x="3" y="7" width="8" height="4" rx="1" fill="currentColor" opacity=".6"/><circle cx="4.5" cy="4.5" r="1.5" fill="currentColor" opacity=".6"/></svg> Apply Wallpaper`;
});

// ── Download ──────────────────────────────────────────────────────────────────
async function downloadImage(url) {
  const t = toast('⏳ Downloading…', 'info', 0);
  try {
    const savedPath = await window.aniwall.download(url);
    dismissToast(t);
    totalSaved++;
    updateStats();
    const t2 = toast('✓ Saved to Pictures', 'success');
    const reveal = document.createElement('span');
    reveal.className = 'toast-reveal';
    reveal.textContent = 'Show';
    reveal.addEventListener('click', () => window.aniwall.revealFile(savedPath));
    t2.appendChild(reveal);
  } catch (err) {
    dismissToast(t);
    toast('✕ Download failed', 'error');
    console.error(err);
  }
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function toast(message, type = 'info', duration = 3000) {
  const el = document.createElement('div');
  el.className = 'toast';
  const colors = { success: '#3ecfb2', error: '#fc5c7d', info: '#7c5cfc' };
  el.style.borderLeftColor = colors[type] ?? colors.info;
  el.style.borderLeftWidth = '3px';
  const text = document.createElement('span');
  text.textContent = message;
  el.appendChild(text);
  toastStack.appendChild(el);
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('show')));
  if (duration > 0) setTimeout(() => dismissToast(el), duration);
  return el;
}

function dismissToast(el) {
  el.classList.replace('show', 'hide');
  setTimeout(() => el.remove(), 350);
}

// ── Stats ─────────────────────────────────────────────────────────────────────
function updateStats() {
  animateCounter(statCount, totalLoaded);
  animateCounter(statSaved, totalSaved);
}

function animateCounter(el, target) {
  const start = parseInt(el.textContent) || 0;
  const diff  = target - start;
  if (!diff) return;
  let step = 0; const steps = 20;
  const tick = () => {
    step++;
    el.textContent = String(Math.round(start + diff * easeOut(step / steps)));
    if (step < steps) requestAnimationFrame(tick);
    else el.textContent = String(target);
  };
  requestAnimationFrame(tick);
}
function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

// ── Source nav ────────────────────────────────────────────────────────────────
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    item.classList.add('active');
    currentSrc  = item.dataset.src;
    whPage      = 1;
    totalLoaded = 0;
    allImages   = [];
    updateStats();
    load(true);
  });
});

btnLoad.addEventListener('click', () => load(false));

// ── Infinite scroll ───────────────────────────────────────────────────────────
const scrollObserver = new IntersectionObserver((entries) => {
  if (entries[0].isIntersecting && !loading) {
    load(false);
  }
}, {
  root: document.querySelector('.main'),
  rootMargin: '800px'
});
scrollObserver.observe(btnLoad);

// ── Settings panel ────────────────────────────────────────────────────────────
function openSettings() {
  populateSettingsForm();
  settingsBackdrop.classList.add('open');
  settingsPanel.classList.add('open');
  document.getElementById('wp-purity').onchange = e => syncWpGroups(e.target.value);
}

function closeSettings() {
  settingsBackdrop.classList.remove('open');
  settingsPanel.classList.remove('open');
}

btnSettings.addEventListener('click',        openSettings);
btnSettingsClose.addEventListener('click',   closeSettings);
btnSettingsCancel.addEventListener('click',  closeSettings);
settingsBackdrop.addEventListener('click',   closeSettings);

btnWhEye.addEventListener('click', () => {
  const inp = document.getElementById('wh-apikey');
  const isHidden = inp.type === 'password';
  inp.type = isHidden ? 'text' : 'password';
  btnWhEye.title = isHidden ? 'Hide' : 'Show';
});

btnSettingsSave.addEventListener('click', async () => {
  const updated = readSettingsForm();
  await window.aniwall.setSettings(updated);
  settings = updated;
  applyColumns();
  closeSettings();
  toast('✓ Settings saved', 'success');
  whPage = 1; totalLoaded = 0; allImages = [];
  updateStats();
  load(true);
});

function syncWpGroups(purity) {
  document.getElementById('wp-sfw-group').style.display  = (purity === 'nsfw') ? 'none' : '';
  document.getElementById('wp-nsfw-group').style.display = (purity === 'sfw')  ? 'none' : '';
}

function buildCheckGroup(containerId, allCats, selected) {
  const wrap = document.getElementById(containerId);
  wrap.innerHTML = '';
  allCats.forEach(cat => {
    const lbl = document.createElement('label');
    lbl.className = 'sp-check';
    const cb = document.createElement('input');
    cb.type    = 'checkbox';
    cb.value   = cat;
    cb.checked = selected.includes(cat);
    lbl.append(cb, document.createTextNode(cat));
    wrap.appendChild(lbl);
  });
}

function populateSettingsForm() {
  const wh = settings.wallhaven;
  document.getElementById('wh-apikey').value  = wh.apiKey;
  document.getElementById('wh-query').value   = wh.query;
  document.getElementById('wh-sorting').value = wh.sorting;
  document.getElementById('wh-order').value   = wh.order;
  document.getElementById('wh-minres').value  = wh.minRes;

  const cats = wh.categories || '010';
  document.getElementById('wh-cat-general').checked = cats[0] === '1';
  document.getElementById('wh-cat-anime').checked   = cats[1] === '1';
  document.getElementById('wh-cat-people').checked  = cats[2] === '1';

  const purity = wh.purity || '100';
  document.getElementById('wh-purity-sfw').checked     = purity[0] === '1';
  document.getElementById('wh-purity-sketchy').checked = purity[1] === '1';
  document.getElementById('wh-purity-nsfw').checked    = purity[2] === '1';

  const wpPurity = settings.waifupics.purity || 'sfw';
  document.getElementById('wp-purity').value = wpPurity;
  buildCheckGroup('wp-sfw-cats',  WP_SFW_CATS,  settings.waifupics.sfwCategories  || WP_SFW_CATS);
  buildCheckGroup('wp-nsfw-cats', WP_NSFW_CATS, settings.waifupics.nsfwCategories || WP_NSFW_CATS);
  syncWpGroups(wpPurity);

  buildCheckGroup('nb-cats', NB_ALL_CATS, settings.nekosbest.categories);

  document.getElementById('disp-columns').value = settings.display.columns || 'auto';
  document.getElementById('disp-orientation').value = settings.display.orientation || 'both';
}

function readSettingsForm() {
  const g = document.getElementById('wh-cat-general').checked ? '1' : '0';
  const a = document.getElementById('wh-cat-anime').checked   ? '1' : '0';
  const p = document.getElementById('wh-cat-people').checked  ? '1' : '0';
  const catBits = `${g}${a}${p}`;

  const ps = document.getElementById('wh-purity-sfw').checked     ? '1' : '0';
  const pk = document.getElementById('wh-purity-sketchy').checked ? '1' : '0';
  const pn = document.getElementById('wh-purity-nsfw').checked    ? '1' : '0';
  const purityBits = (`${ps}${pk}${pn}` === '000') ? '100' : `${ps}${pk}${pn}`;

  const checkedVals = id =>
    [...document.querySelectorAll(`#${id} input[type=checkbox]:checked`)].map(c => c.value);

  return {
    wallhaven: {
      apiKey:     document.getElementById('wh-apikey').value.trim(),
      query:      document.getElementById('wh-query').value.trim(),
      sorting:    document.getElementById('wh-sorting').value,
      order:      document.getElementById('wh-order').value,
      minRes:     document.getElementById('wh-minres').value,
      categories: catBits || '010',
      purity:     purityBits,
    },
    waifupics: {
      purity:         document.getElementById('wp-purity').value,
      sfwCategories:  checkedVals('wp-sfw-cats').length  ? checkedVals('wp-sfw-cats')  : WP_SFW_CATS,
      nsfwCategories: checkedVals('wp-nsfw-cats').length ? checkedVals('wp-nsfw-cats') : WP_NSFW_CATS,
    },
    nekosbest:  { categories: checkedVals('nb-cats').length ? checkedVals('nb-cats') : NB_ALL_CATS },
    display:    { 
      columns: document.getElementById('disp-columns').value,
      orientation: document.getElementById('disp-orientation').value
    },
  };
}

// ── Utility ───────────────────────────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Boot ──────────────────────────────────────────────────────────────────────
(async () => {
  settings = await window.aniwall.getSettings();
  favorites = await window.aniwall.getFavorites();
  applyColumns();
  load(true);
})();