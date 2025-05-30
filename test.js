// analyzer.js

(async function(){
  // Base strip URL prefix
  const STRIP_BASE = 'https://nrlhozkan.github.io/ImageViewer/strip';
  // const STRIP_BASE = 'https://weitefeld.cg.jku.at/strip';

  // UI elements
  const viewerEl       = document.getElementById('viewer');
  const downloadZipBtn = document.getElementById('downloadZipBtn');
  const gotoContainer  = document.getElementById('gotoContainer');
  const gotoInputEl    = document.getElementById('gotoInput');
  const gotoBtn        = document.getElementById('gotoBtn');

  let images        = [],
      idx           = 0,
      channel       = 'rgb',
      isFirst       = true,
      gamma         = 1.0,
      viewer,
      stripId,
      lastImageID,
      pendingGoto   = null;

  // ————— UI: Clear Marker Button —————
  const clearBtn = document.createElement('button');
  clearBtn.textContent = 'Clear Marker';
  clearBtn.style.marginLeft = '8px';
  gotoContainer.appendChild(clearBtn);
  clearBtn.addEventListener('click', () => {
    if (viewer._lastMarker) {
      viewer.removeOverlay(viewer._lastMarker);
      viewer._lastMarker = null;
    }
    pendingGoto = null;
  });

    // Add info panel for URLs
  const infoPanel = document.createElement('div');
  infoPanel.id = 'infoPanel';
  infoPanel.style.cssText = `position:absolute; top:80px; left:10px;
    background:rgba(255,255,255,0.9); color:#000; padding:8px;
    font-family:sans-serif; font-size:14px; border-radius:4px; z-index:1000;`;
  infoPanel.innerHTML = `
    <strong>Image URLs</strong><br>
    <code id="infoURLs" style="font-size:12px; white-space:pre-wrap;"></code>`;
  viewerEl.style.position = 'relative';
  viewerEl.appendChild(infoPanel);
  const infoURLsEl  = document.getElementById('infoURLs');

  // ————— UI: Strip & Gamma Overlays —————
  const stripEl = document.createElement('div');
  stripEl.id = 'stripImageInfo';
  stripEl.style.cssText = `
    position:absolute; top:60px; left:10px;
    background:rgba(0,0,0,0.6); color:#fff;
    padding:4px 8px; border-radius:4px; font-size:14px; z-index:1000;
  `;
  const gammaEl = document.createElement('div');
  gammaEl.id = 'gammaInfo';
  gammaEl.style.cssText = `
    position:absolute; bottom:10px; left:10px;
    background:rgba(0,0,0,0.6); color:#fff;
    padding:4px 8px; border-radius:4px; font-size:14px; z-index:1000;
  `;
  viewerEl.style.position = 'relative';
  viewerEl.appendChild(stripEl);
  viewerEl.appendChild(gammaEl);

  // ————— Initialize OpenSeadragon —————
  viewer = OpenSeadragon({
    element:             viewerEl,
    prefixUrl:           'https://cdn.jsdelivr.net/npm/openseadragon@4.0/build/openseadragon/images/',
    showZoomControl:     false,
    maxZoomPixelRatio:   20,
    zoomPerScroll:       1.1,
    minZoomLevel:        0.1,
    defaultZoomLevel:    1,
    gestureSettingsMouse:{ scrollToZoom:true, clickToZoom:false },
    crossOriginPolicy:   'Anonymous'
  });
  if (viewer.innerTracker?.keyHandler) viewer.innerTracker.keyHandler = null;

  // ————— Spinner —————
  const style = document.createElement('style');
  style.textContent = `
    @keyframes spin { from{transform:rotate(0)} to{transform:rotate(360deg)} }
    #spinner {
      display:none; position:absolute; top:50%; left:50%;
      transform:translate(-50%,-50%);
      width:40px; height:40px;
      border:4px solid rgba(0,0,0,0.1);
      border-top:4px solid #333;
      border-radius:50%;
      animation:spin 1s linear infinite;
      z-index:1001;
    }
  `;
  document.head.appendChild(style);
  const spinner = document.createElement('div');
  spinner.id = 'spinner';
  viewerEl.appendChild(spinner);

  // ————— Coordinate Overlay —————
  const coord = document.createElement('div');
  coord.id = 'coordInfo';
  coord.style.cssText = `
    display:none; position:absolute; background:rgba(0,0,0,0.5);
    color:#fff; padding:2px 4px;
    font-family:monospace; font-size:12px;
    pointer-events:none; z-index:1000;
    transform:translate(8px,8px);
  `;
  viewerEl.appendChild(coord);

  viewerEl.addEventListener('mousemove', e => {
    const r  = viewerEl.getBoundingClientRect();
    const wp = new OpenSeadragon.Point(
      e.clientX - r.left,
      e.clientY - r.top
    );
    const ip = viewer.viewport.viewerElementToImageCoordinates(wp);
    const tile = viewer.world.getItemAt(0);
    if (!tile) return;
    const { x: W, y: H } = tile.getContentSize();
    if (ip.x >= 0 && ip.x <= W && ip.y >= 0 && ip.y <= H) {
      coord.style.display = 'block';
      coord.style.left    = `${wp.x}px`;
      coord.style.top     = `${wp.y}px`;
      coord.textContent   = `x:${Math.round(ip.x)}, y:${Math.round(ip.y)}`;
    } else {
      coord.style.display = 'none';
    }
  });

  // ————— Keyboard Navigation —————
  window.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if (!['a','d','w','s','+','-',' '].includes(k) && e.code !== 'Space') return;
    e.preventDefault();
    switch (k) {
      case 'a': idx = (idx - 1 + images.length) % images.length; break;
      case 'd': idx = (idx + 1) % images.length; break;
      case 'w': channel = 'rgb_mask'; break;
      case 's': channel = 'rgb'; break;
      case '+': gamma = Math.max(0.1, gamma - 0.1); break;
      case '-': gamma += 0.1; break;
      case ' ':
        viewer.viewport.goHome(true);
        return;
    }
    applyGamma();
    loadImage();
  });

  // ————— Go-To Handler —————
  gotoBtn.addEventListener('click', async () => {
    const parts = gotoInputEl.value.trim().split(/\s+/);
    if (parts.length !== 4) {
      return alert('Please enter: strip image x y');
    }
    const [s, id, x, y] = parts;
    stripId = String(Number(s));
    const jsonUrl = `${STRIP_BASE}${stripId}/index.json`;

    try {
      const res = await fetch(jsonUrl);
      if (!res.ok) throw new Error(res.statusText);
      images = await res.json();
    } catch (err) {
      return alert('Failed to load JSON: ' + err);
    }
    lastImageID = images[images.length - 1].id;
    idx = images.findIndex(o => String(o.id) === id);
    if (idx < 0) {
      return alert('Image not found: ' + id);
    }
    pendingGoto = { x: Number(x), y: Number(y) };

    // Show overlays
    viewerEl.style.display       = 'block';
    downloadZipBtn.style.display = 'inline-block';

    // Show URLs when Go-to
    infoURLsEl.textContent = `RGB: ${images[idx].rgb}\nMASK: ${images[idx].rgb_mask}`;

    loadImage();
  });

  // ————— Apply Gamma —————
  function applyGamma() {
    const val = 1 / gamma;
    const grp = viewerEl.querySelector('.openseadragon-canvas');
    if (grp) grp.style.filter = `brightness(${val})`;
    gammaEl.textContent = `γ=${gamma.toFixed(2)}`;
  }

  // ————— Load Image & Draw Marker —————
  function loadImage() {
    spinner.style.display = 'block';
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

      // Update strip & gamma info
      stripEl.textContent = `Strip: ${stripId} | Image: ${images[idx].id}/${lastImageID}`;
      applyGamma();

      // Draw go-to marker
      if (pendingGoto) {
        const imgPt = new OpenSeadragon.Point(pendingGoto.x, pendingGoto.y);
        const vpPt  = viewer.viewport.imageToViewportCoordinates(imgPt);

        const svg = `
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32">
            <line x1="16" y1="0"  x2="16" y2="32" stroke="blue" stroke-width="4"/>
            <line x1="0"  y1="16" x2="32" y2="16" stroke="blue" stroke-width="4"/>
          </svg>
        `;

        if (viewer._lastMarker) {
          viewer.removeOverlay(viewer._lastMarker);
        }
        const marker = document.createElement('div');
        marker.innerHTML = svg;
        marker.style.pointerEvents = 'none';

        viewer.addOverlay({
          element:   marker,
          location:  vpPt,
          placement: OpenSeadragon.Placement.CENTER
        });
        viewer._lastMarker = marker;
        viewer.viewport.panTo(vpPt, true);
        pendingGoto = null;
      }
    });
  }

  // ————— Download ZIP (unchanged) —————
  downloadZipBtn.addEventListener('click', async () => {
    if (!images.length) return alert('No images loaded.');
    const obj = images[idx];
    const zip = new JSZip();
    try {
      const [r1, r2] = await Promise.all([ fetch(obj.rgb), fetch(obj.rgb_mask) ]);
      if (!r1.ok || !r2.ok) throw new Error('Image fetch failed');
      const [b1, b2] = await Promise.all([ r1.blob(), r2.blob() ]);
      zip.file(new URL(obj.rgb, location).pathname.split('/').pop(),     b1);
      zip.file(new URL(obj.rgb_mask, location).pathname.split('/').pop(), b2);
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

})();
