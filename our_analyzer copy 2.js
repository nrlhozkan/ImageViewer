// our_analyzer_v2.js
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
  const clearMarkerBtn = document.getElementById('clearBtn');
  const clearRectBtn   = document.getElementById('clearRectBtn');
  const restoreBtn     = document.getElementById('restoreBtn');
  const downloadZipBtn = document.getElementById('downloadZipBtn');
  const infoURLsEl     = document.getElementById('infoURLs');
  const stripEl        = document.getElementById('stripImageInfo');
  const gammaEl        = document.getElementById('gammaInfo');
  const rectInfoEl     = document.getElementById('rectInfo');
  const markerInfoEl   = document.getElementById('markerInfo');
  const downloadDataBtn = document.getElementById('downloadDataBtn');
  const classPanelEl   = document.getElementById('classPanel');
  const classSelectEl  = document.getElementById('classSelect');
  const classInfoEl    = document.getElementById('classInfo');
  const saveClassBtn   = document.getElementById('saveClassBtn');

  // ————— Constants —————
  const PANEL_GAP = 8; // 8px gap between stacked panels

  // ————— Inject custom cursors —————
  const style = document.createElement('style');
  style.textContent = `
    #viewer.alt-mode {
      cursor: url('data:image/svg+xml;utf8,\
<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32">\
  <line x1="16" y1="6" x2="16" y2="26" stroke="black" stroke-width="2.5"/>\
  <line x1="6" y1="16" x2="26" y2="16" stroke="black" stroke-width="2.5"/>\
</svg>') 16 16, crosshair;
    }
    #viewer.ctrl-mode {
      cursor: url('data:image/svg+xml;utf8,\
<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32">\
  <line x1="6" y1="6" x2="26" y2="26" stroke="black" stroke-width="2.5"/>\
  <line x1="26" y1="6" x2="6" y2="26" stroke="black" stroke-width="2.5"/>\
</svg>') 16 16, default;
    }
  `;
  document.head.appendChild(style);

  // ————— State —————
  let viewer, images = [], idx = 0, channel = 'rgb', gamma = 1.0;
  let stripId, lastImageID;
  let rawStrip, rawImage;
  let markerCoordinates = null, lastMarkerCoordinates = null;
  let rectCoordinates   = null, rectOverlayEl = null, updateHandler = null;
  let isFirst = true, pendingGoto = false;
  let boxStart = null;
  let imageWidth = 0, imageHeight = 0;

  // ————— Helpers —————
  function clamp(val, min, max) {
    return Math.max(min, Math.min(val, max));
  }
  function pad4(n) {
    return String(n).padStart(4,'0');
  }

  // ————— Initialize OpenSeadragon (no grey icons) —————
  viewer = OpenSeadragon({
    element: viewerEl,
    prefixUrl: 'https://cdn.jsdelivr.net/npm/openseadragon@4.0/build/openseadragon/images/',
    showZoomControl: false,
    showNavigationControl: false,
    showNavigator: false,
    gestureSettingsMouse:{ scrollToZoom:true, clickToZoom:false },
    maxZoomPixelRatio: 20,
    zoomPerScroll: 1.1,
    minZoomLevel: 0.1,
    defaultZoomLevel: 1,
    crossOriginPolicy: 'Anonymous'
  });

  // ————— Suppress shortcuts while in the Classes panel —————
  document.addEventListener('keydown', e => {
    if (classPanelEl.style.display === 'block' && classPanelEl.contains(e.target)) {
      return;
    }
    if (e.key === 'Alt') {
      viewerEl.classList.add('alt-mode');
      viewer.setMouseNavEnabled(false);
    }
    if (e.key === 'Control') {
      viewerEl.classList.add('ctrl-mode');
      viewer.setMouseNavEnabled(false);
    }
  });
  document.addEventListener('keyup', e => {
    if (classPanelEl.style.display === 'block' && classPanelEl.contains(e.target)) {
      return;
    }
    if (e.key === 'Alt') {
      viewerEl.classList.remove('alt-mode');
      viewer.setMouseNavEnabled(true);
    }
    if (e.key === 'Control') {
      viewerEl.classList.remove('ctrl-mode');
      viewer.setMouseNavEnabled(true);
    }
  });

  // ————— Update “Go” input & deep-link —————
  function updateInputField() {
    if (rawStrip == null || rawImage == null) return;
    const parts = [ rawStrip, rawImage ];
    if (rectCoordinates) {
      const x0 = Math.round(rectCoordinates.x);
      const y0 = Math.round(rectCoordinates.y + rectCoordinates.height);
      parts.push(
        pad4(x0),
        pad4(y0),
        pad4(Math.round(rectCoordinates.height)),
        pad4(Math.round(rectCoordinates.width))
      );
    } else if (markerCoordinates) {
      parts.push(
        pad4(Math.round(markerCoordinates.x)),
        pad4(Math.round(markerCoordinates.y))
      );
    }
    const val = parts.join(' ');
    gotoInputEl.value = val;
    const q = new URLSearchParams({ goto: val }).toString();
    const base    = window.location.origin + window.location.pathname;
    const deepLink = `${base}?${q}`;
    history.replaceState(null, '', `?${q}`);
    infoURLsEl.textContent =
      `RGB: ${images[idx].rgb}\nMASK: ${images[idx].rgb_mask}\nDeep-link:?${deepLink}`;
  }

  // ————— Gamma panel —————
  function applyGamma() {
    const val = 1 / gamma;
    const grp = viewerEl.querySelector('.openseadragon-canvas');
    if (grp) grp.style.filter = `brightness(${val})`;
    gammaEl.textContent = `γ=${gamma.toFixed(2)}`;
  }

  // ————— Clear marker —————
  function clearMarker() {
    if (viewer._lastMarker) viewer.removeOverlay(viewer._lastMarker);
    viewer._lastMarker = null;
    markerCoordinates = null;
    clearMarkerBtn.disabled = true;
    markerInfoEl.textContent = '';

    if (!rectCoordinates) {
      // No rectangle: hide panel and reset markerInfo
      classPanelEl.style.display = 'none';
      markerInfoEl.style.top = '180px';
    } else {
      // Rectangle still exists: stack rectInfo → markerInfo → classPanel
      rectInfoEl.style.display = 'block';
      const rectBottom = rectInfoEl.offsetTop + rectInfoEl.offsetHeight + PANEL_GAP;
      markerInfoEl.style.top = rectBottom + 'px';
      const markerBottom = markerInfoEl.offsetTop + markerInfoEl.offsetHeight + PANEL_GAP;
      classPanelEl.style.top  = markerBottom + 'px';
      classPanelEl.style.left = '10px';
      classPanelEl.style.display = 'block';
    }

    updateInputField();
  }

  // ————— Clear rectangle —————
  function clearRectangle() {
    if (rectOverlayEl) viewerEl.removeChild(rectOverlayEl);
    rectOverlayEl = null;
    if (updateHandler) {
      viewer.removeHandler('animation', updateHandler);
      viewer.removeHandler('update-viewport', updateHandler);
      updateHandler = null;
    }
    rectCoordinates = null;
    clearRectBtn.disabled = true;

    // Hide rectInfo element entirely
    rectInfoEl.style.display = 'none';
    rectInfoEl.textContent = '';

    if (!markerCoordinates) {
      // No marker: hide panel and reset markerInfo
      classPanelEl.style.display = 'none';
      markerInfoEl.style.top = '180px';
    } else {
      // Marker still exists: stack markerInfo → classPanel
      markerInfoEl.style.top = '180px';
      const markerBottom = markerInfoEl.offsetTop + markerInfoEl.offsetHeight + PANEL_GAP;
      classPanelEl.style.top  = markerBottom + 'px';
      classPanelEl.style.left = '10px';
      classPanelEl.style.display = 'block';
    }

    updateInputField();
  }

  // ————— Draw marker —————
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
        <line x1="0"  y1="16" x2="32" y2="16" stroke="blue" stroke-width="4"/>
      </svg>`;
    viewer.addOverlay({ element: marker, location: vp, placement: OpenSeadragon.Placement.CENTER });
    viewer._lastMarker = marker;

    // Position markerInfo
    if (rectCoordinates) {
      rectInfoEl.style.display = 'block';
      const rectBottom = rectInfoEl.offsetTop + rectInfoEl.offsetHeight + PANEL_GAP;
      markerInfoEl.style.top = rectBottom + 'px';
    } else {
      markerInfoEl.style.top = '180px';
    }
    markerInfoEl.textContent =
      `Marker\nX pixel: ${pad4(Math.round(markerCoordinates.x))}, Y pixel: ${pad4(Math.round(markerCoordinates.y))}`;
    clearMarkerBtn.disabled = false;

    // Always place classPanel immediately below markerInfo:
    const markerBottom = markerInfoEl.offsetTop + markerInfoEl.offsetHeight + PANEL_GAP;
    classPanelEl.style.top  = markerBottom + 'px';
    classPanelEl.style.left = '10px';
    classPanelEl.style.display = 'block';
  }

  // ————— Draw rectangle —————
  function drawRectangle() {
    if (!rectCoordinates) return;
    if (rectOverlayEl) viewerEl.removeChild(rectOverlayEl);
    if (updateHandler) {
      viewer.removeHandler('animation', updateHandler);
      viewer.removeHandler('update-viewport', updateHandler);
    }

    // Ensure rectInfo is visible, then update its contents
    rectInfoEl.style.display = 'block';
    const x0 = Math.round(rectCoordinates.x);
    const y0 = Math.round(rectCoordinates.y + rectCoordinates.height);
    rectInfoEl.textContent =
      `Bounding Box\n` +
      `X pixel: ${pad4(x0)}, Y pixel: ${pad4(y0)}\n` +
      `Height: ${pad4(Math.round(rectCoordinates.height))}, Width: ${pad4(Math.round(rectCoordinates.width))}`;
    clearRectBtn.disabled = false;

    // Create/update the rectangle overlay
    rectOverlayEl = document.createElement('div');
    Object.assign(rectOverlayEl.style, {
      position:'absolute', border:'4px solid blue',
      pointerEvents:'none', zIndex:1000
    });
    viewerEl.appendChild(rectOverlayEl);

    updateHandler = () => {
      if (!rectOverlayEl) return;
      const { x, y, width, height } = rectCoordinates;
      const tl = viewer.viewport.imageToViewerElementCoordinates(new OpenSeadragon.Point(x, y));
      const br = viewer.viewport.imageToViewerElementCoordinates(new OpenSeadragon.Point(x+width, y+height));
      Object.assign(rectOverlayEl.style, {
        left: tl.x+'px', top: tl.y+'px',
        width: (br.x - tl.x)+'px', height: (br.y - tl.y)+'px'
      });
    };
    viewer.addHandler('animation', updateHandler);
    viewer.addHandler('update-viewport', updateHandler);
    updateHandler();

    // Now position panels:
    if (markerCoordinates) {
      // Both rectangle & marker exist:
      const rectBottom = rectInfoEl.offsetTop + rectInfoEl.offsetHeight + PANEL_GAP;
      markerInfoEl.style.top = rectBottom + 'px';
      const markerBottom = markerInfoEl.offsetTop + markerInfoEl.offsetHeight + PANEL_GAP;
      classPanelEl.style.top  = markerBottom + 'px';
      classPanelEl.style.left = '10px';
      classPanelEl.style.display = 'block';
    } else {
      // Only rectangle exists:
      const rectBottom = rectInfoEl.offsetTop + rectInfoEl.offsetHeight + PANEL_GAP;
      classPanelEl.style.top  = rectBottom + 'px';
      classPanelEl.style.left = '10px';
      classPanelEl.style.display = 'block';
      // Hide markerInfo off-screen:
      markerInfoEl.style.top = '180px';
      markerInfoEl.textContent = '';
    }
  }

  // ————— “Go” button —————
  gotoBtn.addEventListener('click', async () => {
    const parts = gotoInputEl.value.trim().split(/\s+/);
    if (![2,4,6].includes(parts.length)) {
      return alert('Enter strip & image, or strip,image & marker(x y), or strip,image & rectangle(x y h w)');
    }
    rawStrip = parts[0];
    rawImage = parts[1];
    stripId  = String(Number(rawStrip));

    let res;
    try {
      res = await fetch(`${STRIP_BASE}${stripId}/index.json`);
      if (!res.ok) throw new Error();
      images = await res.json();
    } catch {
      return alert('Failed to load indices');
    }

    lastImageID = images[images.length-1].id;
    idx = images.findIndex(o =>
      String(o.id) === rawImage ||
      String(Number(o.id)) === rawImage
    );
    if (idx < 0) return alert('Image not found');

    clearMarker();
    clearRectangle();
    restoreBtn.disabled = true;

    const coords = parts.slice(2).map(Number);
    if (coords.length === 2) {
      markerCoordinates     = { x: coords[0], y: coords[1] };
      lastMarkerCoordinates = { ...markerCoordinates };
    } else if (coords.length === 4) {
      const [x0, y0, h, w] = coords;
      rectCoordinates = { x:x0, y:y0 - h, height:h, width:w };
    }

    pendingGoto = true;
    updateInputField();
    viewerEl.style.display = 'block';
    downloadZipBtn.style.display = 'inline-block';
    loadImage();
  });

  clearMarkerBtn.addEventListener('click', clearMarker);
  clearRectBtn.addEventListener('click',   clearRectangle);
  restoreBtn.addEventListener('click', () => {
    if (lastMarkerCoordinates) {
      markerCoordinates = { ...lastMarkerCoordinates };
      clearMarkerBtn.disabled = false;
      restoreBtn.disabled     = true;
      updateInputField();
      loadImage();
    }
  });

  // ————— Ctrl-click marker —————
  viewerEl.addEventListener('click', e => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    const r = viewerEl.getBoundingClientRect();
    let raw = viewer.viewport.viewerElementToImageCoordinates(
      new OpenSeadragon.Point(e.clientX - r.left, e.clientY - r.top)
    );
    const x = clamp(raw.x, 0, imageWidth);
    const y = clamp(raw.y, 0, imageHeight);
    markerCoordinates     = { x, y };
    lastMarkerCoordinates = { x, y };
    drawMarker();
    updateInputField();
  });

  // ————— Alt-drag rectangle —————
  viewerEl.addEventListener('pointerdown', e => {
    if (e.altKey && e.button === 0) {
      e.preventDefault();
      const r = viewerEl.getBoundingClientRect();
      let raw = viewer.viewport.viewerElementToImageCoordinates(
        new OpenSeadragon.Point(e.clientX - r.left, e.clientY - r.top)
      );
      boxStart = { x: clamp(raw.x, 0, imageWidth), y: clamp(raw.y, 0, imageHeight) };
      viewer.setMouseNavEnabled(false);
    }
  });
  viewerEl.addEventListener('pointermove', e => {
    if (!boxStart) return;
    e.preventDefault();
    const r = viewerEl.getBoundingClientRect();
    let raw = viewer.viewport.viewerElementToImageCoordinates(
      new OpenSeadragon.Point(e.clientX - r.left, e.clientY - r.top)
    );
    const x = clamp(raw.x, 0, imageWidth),
          y = clamp(raw.y, 0, imageHeight);
    rectCoordinates = {
      x:      clamp(Math.min(boxStart.x, x), 0, imageWidth),
      y:      clamp(Math.min(boxStart.y, y), 0, imageHeight),
      width:  clamp(Math.abs(x - boxStart.x), 0, imageWidth),
      height: clamp(Math.abs(y - boxStart.y), 0, imageHeight)
    };
    if (!rectOverlayEl) drawRectangle();
    else updateHandler();
  });
  viewerEl.addEventListener('pointerup', e => {
    if (!boxStart || e.button !== 0) return;
    e.preventDefault();
    boxStart = null;
    viewer.setMouseNavEnabled(true);
    drawRectangle();
    updateInputField();
  });

  // ————— Keyboard nav & gamma —————
  window.addEventListener('keydown', e => {
    if (classPanelEl.style.display === 'block' && classPanelEl.contains(e.target)) {
      return;
    }
    const k = e.key.toLowerCase();
    if (!['a','d','w','s','+','-',' '].includes(k) && e.code !== 'Space') return;
    e.preventDefault();
    switch (k) {
      case 'a':
        idx = (idx - 1 + images.length) % images.length;
        rawImage = images[idx].id.toString();
        pendingGoto = true;
        updateInputField();
        break;
      case 'd':
        idx = (idx + 1) % images.length;
        rawImage = images[idx].id.toString();
        pendingGoto = true;
        updateInputField();
        break;
      case 'w':
        channel = 'rgb_mask';
        break;
      case 's':
        channel = 'rgb';
        break;
      case '+':
        gamma = Math.max(0.1, gamma - 0.1);
        break;
      case '-':
        gamma += 0.1;
        break;
      case ' ':
        viewer.viewport.goHome(true);
        return;
    }
    applyGamma();
    loadImage();
  });

  // ───────── Download a custom strip & range of RGB images ─────────
  downloadZipBtn.addEventListener('click', async () => {
    // 1) Ask for strip number (allow leading zeros, but store as integer folder)
    let stripRaw = prompt('Enter strip number (e.g. 06):', '');
    if (!stripRaw) return;
    const stripNum = parseInt(stripRaw, 10).toString();

    // 2) Ask for start & end image numbers
    const startRaw = prompt('Enter START image number (e.g. 00566):', '');
    if (!startRaw) return;
    const endRaw = prompt('Enter END image number (e.g. 01006):', '');
    if (!endRaw) return;

    const startNum = Number(startRaw);
    const endNum = Number(endRaw);
    if (isNaN(startNum) || isNaN(endNum) || startNum > endNum) {
      return alert('Invalid start/end range');
    }

    // 3) Load the chosen strip’s index.json
    let indexList;
    try {
      const res = await fetch(`${STRIP_BASE}${stripNum}/index.json`);
      if (!res.ok) throw new Error();
      indexList = await res.json();
    } catch {
      return alert(`Could not load strip ${stripNum}`);
    }

    // 4) Filter to images in the requested range, sorted ascending
    const toDownload = indexList
      .filter(o => {
        const id = Number(o.id);
        return id >= startNum && id <= endNum;
      })
      .sort((a, b) => Number(a.id) - Number(b.id));

    if (!toDownload.length) {
      return alert(`No images in strip ${stripNum} between ${startRaw} and ${endRaw}`);
    }

    // 5) Create the ZIP
    const zip = new JSZip();
    for (const obj of toDownload) {
      try {
        const resp = await fetch(obj.rgb);
        if (!resp.ok) throw new Error();
        const blob = await resp.blob();
        const filename = obj.rgb.split('/').pop();
        zip.file(filename, blob);
      } catch (e) {
        console.warn(`Failed to fetch ${obj.rgb}`, e);
      }
    }

    // 6) Generate and download the ZIP
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(zipBlob);
    a.download = `strip${stripNum}_${startRaw}-${endRaw}.zip`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  });

  // ───────── NEW: Download data.txt (no PHP) ─────────
  downloadDataBtn.addEventListener('click', () => {
    // Create a temporary <a> so that “download” attribute is honored
    const a = document.createElement('a');
    a.href = 'data.txt';         // assumes data.txt is served at this relative path
    a.download = 'data.txt';     // tells browser to save it as “data.txt”
    document.body.appendChild(a);
    a.click();
    a.remove();
  });

  // ————— Auto-goto on page load —————
  const params   = new URLSearchParams(window.location.search);
  const autoGoto = params.get('goto');
  if (autoGoto) {
    gotoInputEl.value = autoGoto;
    setTimeout(() => gotoBtn.click(), 0);
  }

  // ————— Load image & capture its size —————
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

      // capture true pixel dims
      const tiledImg = viewer.world.getItemAt(0);
      if (tiledImg && tiledImg.getContentSize) {
        const size = tiledImg.getContentSize();
        imageWidth  = size.x;
        imageHeight = size.y;
      }

      if (isFirst) {
        viewer.viewport.goHome(true);
        isFirst = false;
      } else {
        viewer.viewport.zoomTo(oldZoom, null, true);
        viewer.viewport.panTo(oldCenter, true);
      }

      stripEl.textContent = `Strip: ${rawStrip} | Image: ${rawImage}/${lastImageID}`;
      applyGamma();

      if (rectCoordinates) drawRectangle();
      if (markerCoordinates) drawMarker();

      // — center on shape if requested —
      if (pendingGoto) {
        if (rectCoordinates) {
          const cx = rectCoordinates.x + rectCoordinates.width/2;
          const cy = rectCoordinates.y + rectCoordinates.height/2;
          const vp = viewer.viewport.imageToViewportCoordinates(new OpenSeadragon.Point(cx, cy));
          viewer.viewport.panTo(vp, true);
        } else if (markerCoordinates) {
          const vp = viewer.viewport.imageToViewportCoordinates(
            new OpenSeadragon.Point(markerCoordinates.x, markerCoordinates.y)
          );
          viewer.viewport.panTo(vp, true);
        }
        pendingGoto = false;
      }
    });
  }

  // ───── When “Save” is clicked ─────
  saveClassBtn.addEventListener('click', async () => {
    const chosenClass = classSelectEl.value;
    const extraInfo   = classInfoEl.value.trim();

    // Gather marker & rect coords (or empty strings)
    let mx = '', my = '', rx = '', ry = '', rw = '', rh = '';
    if (markerCoordinates) {
      mx = Math.round(markerCoordinates.x);
      my = Math.round(markerCoordinates.y);
    }
    if (rectCoordinates) {
      rx = Math.round(rectCoordinates.x);
      ry = Math.round(rectCoordinates.y);
      rw = Math.round(rectCoordinates.width);
      rh = Math.round(rectCoordinates.height);
    }

    const payload = {
      strip:     rawStrip  || '',
      image:     rawImage  || '',
      class:     chosenClass,
      info:      extraInfo || '',
      marker_x:  mx,
      marker_y:  my,
      rect_x:    rx,
      rect_y:    ry,
      rect_w:    rw,
      rect_h:    rh
    };

    // POST to saveData.php
    try {
      const response = await fetch('saveData.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await response.json();
      if (!result.success) {
        alert('Failed to save: ' + (result.error || 'Unknown error'));
        console.error('saveData.php error:', result.error);
      } else {
        console.log('Annotation appended to data.txt');
      }
    } catch (err) {
      alert('Could not contact saveData.php');
      console.error(err);
    }

    // Clear & hide the panel
    classInfoEl.value   = '';
    classSelectEl.value = '';
    classPanelEl.style.display = 'none';
  });

})();
