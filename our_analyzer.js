// script.js
(async function(){
  // ————— Base strip URL prefix —————
  const STRIP_BASE = window.location.protocol === 'file:'
    ? 'https://nrlhozkan.github.io/ImageViewer/strip'
    : (
        window.location.hostname.includes('github.io')
          ? 'https://nrlhozkan.github.io/ImageViewer/strip'
          : window.location.origin + '/strip'
      );

  // ————— UI elements —————
  const viewerEl       = document.getElementById('viewer');
  const gotoInputEl    = document.getElementById('gotoInput');
  const gotoBtn        = document.getElementById('gotoBtn');
  const clearBtn       = document.getElementById('clearBtn');
  const restoreBtn     = document.getElementById('restoreBtn');
  const downloadZipBtn = document.getElementById('downloadZipBtn');
  const infoURLsEl     = document.getElementById('infoURLs');
  const stripEl        = document.getElementById('stripImageInfo');
  const gammaEl        = document.getElementById('gammaInfo');
  const rectInfoEl     = document.getElementById('rectInfo');

  // ————— State —————
  let viewer, images = [], idx = 0, channel = 'rgb', gamma = 1.0;
  let stripId, lastImageID;
  let markerCoordinates = null, lastMarkerCoordinates = null;
  let rectCoordinates = null, rectOverlayEl = null;
  let isFirst = true, pendingGoto = null;
  let isDrawing = false, drawStart = null;

  // ————— Initialize OpenSeadragon —————
  viewer = OpenSeadragon({
    element: viewerEl,
    prefixUrl: 'https://cdn.jsdelivr.net/npm/openseadragon@4.0/build/openseadragon/images/',
    showZoomControl: false,
    maxZoomPixelRatio: 20,
    zoomPerScroll: 1.1,
    minZoomLevel: 0.1,
    defaultZoomLevel: 1,
    gestureSettingsMouse: { scrollToZoom:true, clickToZoom:false },
    crossOriginPolicy: 'Anonymous'
  });
  // Disable built-in click-to-pan when drawing
  const mouseNav = viewer.viewport.mouseNavEnabled;

  // ————— Helpers —————
  function applyGamma() {
    const val = 1 / gamma;
    const grp = viewerEl.querySelector('.openseadragon-canvas');
    if (grp) grp.style.filter = `brightness(${val})`;
    gammaEl.textContent = `γ=${gamma.toFixed(2)}`;
  }

  function updateInputField() {
    const parts = [stripId, images[idx].id];
    if (markerCoordinates) {
      parts.push(
        Math.round(markerCoordinates.x),
        Math.round(markerCoordinates.y)
      );
    } else if (rectCoordinates) {
      const blx = rectCoordinates.x;
      const bly = rectCoordinates.y + rectCoordinates.height;
      parts.push(
        Math.round(rectCoordinates.height),
        Math.round(rectCoordinates.width),
        Math.round(blx),
        Math.round(bly)
      );
    }
    gotoInputEl.value = parts.join(' ');
  }

  function clearMarker() {
    if (viewer._lastMarker) {
      viewer.removeOverlay(viewer._lastMarker);
      viewer._lastMarker = null;
    }
    markerCoordinates = null;
    pendingGoto = null;
    clearBtn.disabled = true;
    restoreBtn.disabled = !!lastMarkerCoordinates;
    updateInputField();
  }

  function restoreMarker() {
    if (lastMarkerCoordinates) {
      markerCoordinates = { ...lastMarkerCoordinates };
      clearBtn.disabled = false;
      restoreBtn.disabled = true;
      loadImage();
    }
  }

  function drawMarker() {
    if (!markerCoordinates) return;
    if (viewer._lastMarker) viewer.removeOverlay(viewer._lastMarker);
    const pt = new OpenSeadragon.Point(markerCoordinates.x, markerCoordinates.y);
    const vp = viewer.viewport.imageToViewportCoordinates(pt);
    const marker = document.createElement('div');
    marker.style.pointerEvents = 'none';
    marker.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32">
        <line x1="16" y1="0" x2="16" y2="32" stroke="blue" stroke-width="4"/>
        <line x1="0" y1="16" x2="32" y2="16" stroke="blue" stroke-width="4"/>
      </svg>`;
    viewer.addOverlay({ element: marker, location: vp, placement: OpenSeadragon.Placement.CENTER });
    viewer._lastMarker = marker;
    if (pendingGoto) {
      viewer.viewport.panTo(vp, true);
      pendingGoto = null;
    }
  }

  function drawRectangle() {
    if (!rectCoordinates) return;
    if (rectOverlayEl) viewerEl.removeChild(rectOverlayEl);
    rectOverlayEl = document.createElement('div');
    Object.assign(rectOverlayEl.style, {
      position: 'absolute',
      border: '4px solid yellow',
      pointerEvents: 'none',
      zIndex: 1000
    });
    viewerEl.appendChild(rectOverlayEl);

    function updateScreen() {
      const { x, y, width, height } = rectCoordinates;
      const tl = viewer.viewport.imageToViewerElementCoordinates(new OpenSeadragon.Point(x, y));
      const br = viewer.viewport.imageToViewerElementCoordinates(new OpenSeadragon.Point(x + width, y + height));
      Object.assign(rectOverlayEl.style, {
        left:  tl.x + 'px',
        top:   tl.y + 'px',
        width: (br.x - tl.x) + 'px',
        height:(br.y - tl.y) + 'px'
      });
    }

    updateScreen();
    viewer.addHandler('animation', updateScreen);

    const blx = rectCoordinates.x;
    const bly = rectCoordinates.y + rectCoordinates.height;
    rectInfoEl.textContent =
      `height: ${Math.round(rectCoordinates.height)}, width: ${Math.round(rectCoordinates.width)}` +
      `\n` +
      `x: ${Math.round(blx)}, y: ${Math.round(bly)}`;
    updateInputField();
  }

  // ————— Load image + overlays —————
  function loadImage() {
    document.getElementById('spinner')?.remove();
    const spinner = document.createElement('div');
    spinner.id = 'spinner';
    Object.assign(spinner.style, {
      display:'block', position:'absolute', top:'50%', left:'50%',
      transform:'translate(-50%,-50%)', width:'40px', height:'40px',
      border:'4px solid rgba(0,0,0,0.1)', borderTop:'4px solid #333',
      borderRadius:'50%', animation:'spin 1s linear infinite', zIndex:'1001'
    });
    viewerEl.appendChild(spinner);

    let oldZoom, oldCenter;
    if (!isFirst) {
      oldZoom   = viewer.viewport.getZoom();
      oldCenter = viewer.viewport.getCenter();
    }

    viewer.open({ type:'image', url: images[idx][channel] });
    viewer.addOnceHandler('open', () => {
      spinner.style.display = 'none';
      if (isFirst) {
        viewer.viewport.goHome(true);
        isFirst = false;
      } else {
        viewer.viewport.zoomTo(oldZoom, null, true);
        viewer.viewport.panTo(oldCenter, true);
      }
      stripEl.textContent = `Strip: ${stripId} | Image: ${images[idx].id}/${lastImageID}`;
      applyGamma();
      if (markerCoordinates) drawMarker();
      if (rectCoordinates)   drawRectangle();
    });
  }

  // ————— Go-To Handler —————
  gotoBtn.addEventListener('click', async () => {
    const parts = gotoInputEl.value.trim().split(/\s+/);
    if (parts.length < 2 || parts.length === 3 || parts.length > 6) {
      return alert('Enter 2, 4 or 6 values: strip image [x y] or [h w x y]');
    }
    const [stripRaw, imageRaw, ...coords] = parts;
    const stripFolder = String(Number(stripRaw));
    stripId = stripFolder;

    const jsonUrl = `${STRIP_BASE}${stripId}/index.json`;
    try {
      const res = await fetch(jsonUrl);
      if (!res.ok) throw new Error(res.statusText);
      images = await res.json();
    } catch (err) {
      return alert('Failed to load JSON: ' + err);
    }

    lastImageID = images[images.length - 1].id;
    idx = images.findIndex(o =>
      String(o.id) === imageRaw || String(o.id) === String(Number(imageRaw))
    );
    if (idx < 0) {
      return alert(`Image not found: tried "${imageRaw}" and "${Number(imageRaw)}"`);
    }

    markerCoordinates = null; rectCoordinates = null;
    clearBtn.disabled = true; restoreBtn.disabled = true;

    if (coords.length === 2) {
      const [x, y] = coords.map(Number);
      markerCoordinates = { x, y };
      lastMarkerCoordinates = { x, y };
      clearBtn.disabled = false;
    } else if (coords.length === 4) {
      const [h, w, blx, bly] = coords.map(Number);
      rectCoordinates = { x: blx, y: bly - h, width: w, height: h };
    }

    viewerEl.style.display       = 'block';
    downloadZipBtn.style.display = 'inline-block';

    const base = window.location.origin + window.location.pathname;
    const q    = new URLSearchParams({ goto: gotoInputEl.value.trim() }).toString();
    history.replaceState(null, '', `?${q}`);
    infoURLsEl.textContent =
      `RGB: ${images[idx].rgb}\n` +
      `MASK: ${images[idx].rgb_mask}\n` +
      `Deep-link: ${base}?${q}`;

    pendingGoto = !!markerCoordinates;
    loadImage();
  });

  // ————— Ctrl-click for marker —————
  viewerEl.addEventListener('click', e => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    const rect = viewerEl.getBoundingClientRect();
    const vp   = new OpenSeadragon.Point(e.clientX - rect.left, e.clientY - rect.top);
    const ip   = viewer.viewport.viewerElementToImageCoordinates(vp);
    markerCoordinates = { x: ip.x, y: ip.y };
    lastMarkerCoordinates = { ...markerCoordinates };
    rectCoordinates = null;
    rectInfoEl.textContent = '';
    clearBtn.disabled = false;
    restoreBtn.disabled = true;
    drawMarker();
    updateInputField();
  });

  // ————— Alt-drag for rectangle —————
  viewer.addHandler('canvas-press', evt => {
    const e = evt.originalEvent;
    if (e.altKey && e.button === 0) {
      isDrawing = true;
      drawStart = viewer.viewport.viewportToImageCoordinates(evt.position);
      viewer.setMouseNavEnabled(false);
      e.preventDefault();
    }
  });
  viewer.addHandler('canvas-drag', evt => {
    if (isDrawing) evt.originalEvent.preventDefault();
  });
  viewer.addHandler('canvas-release', evt => {
    const e = evt.originalEvent;
    if (!isDrawing) return;
    const end = viewer.viewport.viewportToImageCoordinates(evt.position);
    const x0 = Math.min(drawStart.x, end.x);
    const y0 = Math.min(drawStart.y, end.y);
    const w = Math.abs(end.x - drawStart.x);
    const h = Math.abs(end.y - drawStart.y);
    rectCoordinates = { x: x0, y: y0, width: w, height: h };
    isDrawing = false;
    viewer.setMouseNavEnabled(true);
    markerCoordinates = null;
    clearBtn.disabled = true;
    restoreBtn.disabled = true;
    drawRectangle();
  });

  // ————— Clear / Restore —————
  clearBtn.addEventListener('click', clearMarker);
  restoreBtn.addEventListener('click', restoreMarker);

  // ————— Keyboard nav & gamma —————
  window.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if (!['a','d','w','s','+','-',' '].includes(k) && e.code !== 'Space') return;
    e.preventDefault();
    switch (k) {
      case 'a': idx = (idx - 1 + images.length) % images.length; break;
      case 'd': idx = (idx + 1) % images.length;         break;
      case 'w': channel = 'rgb_mask';                    break;
      case 's': channel = 'rgb';                         break;
      case '+': gamma = Math.max(0.1, gamma - 0.1);     break;
      case '-': gamma++;                                  break;
      case ' ': viewer.viewport.goHome(true);            return;
    }
    applyGamma();
    loadImage();
  });

  // ————— Download ZIP —————
  downloadZipBtn.addEventListener('click', async () => {
    if (!images.length) return alert('No images loaded.');
    const obj = images[idx];
    const zip = new JSZip();
    try {
      const [r1, r2] = await Promise.all([fetch(obj.rgb), fetch(obj.rgb_mask)]);
      if (!r1.ok || !r2.ok) throw new Error('Image fetch failed');
      const [b1, b2] = await Promise.all([r1.blob(), r2.blob()]);
      zip.file(obj.rgb.split('/').pop(), b1);
      zip.file(obj.rgb_mask.split('/').pop(), b2);
      const blob = await zip.generateAsync({ type:'blob' });
      const a    = document.createElement('a');
      a.href     = URL.createObjectURL(blob);
      a.download = `${stripId}_${obj.id}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) {
      alert('ZIP error: ' + e);
    }
  });

  // ————— Deep-link on load —————
  const params = new URLSearchParams(window.location.search);
  const autoGoto = params.get('goto');
  if (autoGoto) {
    gotoInputEl.value = autoGoto;
    setTimeout(() => gotoBtn.click(), 0);
  }
})();
