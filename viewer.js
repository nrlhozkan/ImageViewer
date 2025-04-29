// test.js

(async function(){
  const loaderEl       = document.getElementById('loader');
  const startIndexEl   = document.getElementById('startIndex');
  const inputEl        = document.getElementById('jsonUrl');
  const btn            = document.getElementById('loadBtn');
  const viewerEl       = document.getElementById('viewer');
  const downloadZipBtn = document.getElementById('downloadZipBtn');
  const stripEl        = document.getElementById('stripImageInfo');
  const gammaEl        = document.getElementById('gammaInfo');

  let images = [],
      idx = 0,
      startImageNumber = 1,
      channel = 'rgb',
      isFirst = true,
      gamma = 1.0,
      viewer,
      stripId,
      lastImageID;

  // Apply gamma correction via CSS filter
  function applyGamma() {
      const brightnessValue = 1 / gamma;
      const osdCanvasGroup = viewerEl.querySelector('.openseadragon-canvas');
      if (osdCanvasGroup) {
          osdCanvasGroup.style.filter = `brightness(${brightnessValue})`;
      }
  }

  btn.addEventListener('click', async () => {
    // 1) Normalize URL to index.json
    let url = inputEl.value.trim();
    if (!url.match(/\.json(\?.*)?$/i)) {
      url = url.replace(/\/+$/, '') + '/index.json';
    }

    // 2) Extract numeric Strip ID
    const folderUrl   = url.replace(/\/index\.json(\?.*)?$/i, '');
    const rawFolderId = folderUrl.split('/').pop();
    stripId           = rawFolderId.replace(/\D/g, '');

    // 3) Read "Start at" (1-based)
    const startVal = parseInt(startIndexEl.value, 10);
    startImageNumber = (!isNaN(startVal) && startVal > 0) ? startVal : 1;
    idx = startImageNumber - 1;

    // 4) Fetch JSON
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(res.status + ' ' + res.statusText);
      images = await res.json();
    } catch(err) {
      return alert('Failed to load JSON:\n' + err);
    }
    lastImageID = images[images.length - 1].id;
    idx = Math.min(Math.max(idx, 0), images.length - 1);

    // 5) Show viewer and controls
    loaderEl.style.display       = 'none';
    viewerEl.style.display       = 'block';
    downloadZipBtn.style.display = 'inline-block';

    // 6) Initialize OpenSeadragon
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
    if (viewer.innerTracker && viewer.innerTracker.keyHandler) {
      viewer.innerTracker.keyHandler = null;
    }

    // --- SPINNER STYLE INJECTION ---
    const styleEl = document.createElement('style');
    styleEl.textContent = `
      @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      #spinner { display: none; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
                 width: 40px; height: 40px; border: 4px solid rgba(0,0,0,0.1); border-top: 4px solid #333;
                 border-radius: 50%; animation: spin 1s linear infinite; z-index: 1001; }
    `;
    document.head.appendChild(styleEl);

    // --- SPINNER ELEMENT ---
    const spinner = document.createElement('div');
    spinner.id = 'spinner';
    viewerEl.appendChild(spinner);

    // --- PIXEL COORDINATE OVERLAY & CUSTOM CURSOR SETUP ---
    const plusSVG = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16">
        <line x1="8" y1="0" x2="8" y2="16" stroke="red" stroke-width="2" />
        <line x1="0" y1="8" x2="16" y2="8" stroke="red" stroke-width="2" />
      </svg>
    `;
    const plusCursor = `url("data:image/svg+xml;charset=utf8,${encodeURIComponent(plusSVG)}") 8 8, auto`;

    const coordEl = document.createElement('div');
    coordEl.id = 'coordInfo';
    coordEl.style.cssText = `
      display: none;
      position: absolute;
      background: rgba(0,0,0,0.5);
      color: white;
      padding: 2px 4px;
      font-family: monospace;
      font-size: 12px;
      pointer-events: none;
      z-index: 1000;
      transform: translate(8px, 8px);
    `;

    // --- FINDING PARAMETERS PANEL ---
    const infoEl = document.createElement('div');
    infoEl.id = 'infoPanel';
    infoEl.style.cssText = `
      position: absolute;
      top: 80px;
      left: 10px;
      background: rgba(255,255,255,0.9);
      color: #000;
      padding: 8px;
      font-family: sans-serif;
      font-size: 14px;
      line-height: 1.4;
      border-radius: 4px;
      z-index: 1000;
    `;
    infoEl.innerHTML = `
      <strong>Finding Parameters</strong><br>
      Strip: <span id="infoStrip"></span><br>
      Image Number: <span id="infoImage"></span><br>
      Pixel x: <span id="infoX"></span><br>
      Pixel y: <span id="infoY"></span>
    `;
    viewerEl.style.position = 'relative';
    viewerEl.style.backgroundColor = '#eee';
    viewerEl.style.cursor = 'default';
    viewerEl.appendChild(coordEl);
    viewerEl.appendChild(infoEl);

    const infoStripEl = document.getElementById('infoStrip');
    const infoImageEl = document.getElementById('infoImage');
    const infoXEl     = document.getElementById('infoX');
    const infoYEl     = document.getElementById('infoY');

    // Mouse move for coordinates
    viewerEl.addEventListener('mousemove', e => {
      const rect = viewerEl.getBoundingClientRect();
      const webPoint = new OpenSeadragon.Point(
        e.clientX - rect.left,
        e.clientY - rect.top
      );
      const imgPoint = viewer.viewport.viewerElementToImageCoordinates(webPoint);
      const tiledImg = viewer.world.getItemAt(0);
      if (!tiledImg) return;
      const { x: imgW, y: imgH } = tiledImg.getContentSize();

      if (
        imgPoint.x >= 0 && imgPoint.x <= imgW &&
        imgPoint.y >= 0 && imgPoint.y <= imgH
      ) {
        coordEl.style.display = 'block';
        coordEl.style.left    = `${webPoint.x}px`;
        coordEl.style.top     = `${webPoint.y}px`;
        coordEl.textContent   = `x: ${Math.round(imgPoint.x)}, y: ${Math.round(imgPoint.y)}`;
        viewerEl.style.cursor  = plusCursor;
      } else {
        coordEl.style.display = 'none';
        viewerEl.style.cursor  = 'default';
      }
    });

    // CTRL+CLICK TO UPDATE PANEL
    viewerEl.addEventListener('click', e => {
      if (e.ctrlKey && e.button === 0) {
        const rect = viewerEl.getBoundingClientRect();
        const webPoint = new OpenSeadragon.Point(
          e.clientX - rect.left,
          e.clientY - rect.top
        );
        const imgPoint = viewer.viewport.viewerElementToImageCoordinates(webPoint);
        const x = Math.round(imgPoint.x);
        const y = Math.round(imgPoint.y);
        infoStripEl.textContent = stripId;
        infoImageEl.textContent = images[idx].id;
        infoXEl.textContent     = x;
        infoYEl.textContent     = y;
      }
    });

    // Helpers
    function updateStripInfo(){
      const currentId = images[idx].id;
      stripEl.textContent = `Strip: ${stripId} | Image: ${currentId}/${lastImageID}`;
    }
    function updateGammaInfo(){
      gammaEl.textContent = `γ=${gamma.toFixed(2)}`;
    }

    // Load image with spinner
    function loadImage(){
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
          const home = viewer.viewport.getHomeBounds();
          viewer.viewport.panTo(home.getCenter(), true);
          isFirst = false;
        } else {
          viewer.viewport.zoomTo(oldZoom, null, true);
          viewer.viewport.panTo(oldCenter, true);
        }
        document.title = `Image ${images[idx].id}/${lastImageID} — ${channel.toUpperCase()}`;
        applyGamma();
        updateStripInfo();
        updateGammaInfo();
      });
    }

    // Keyboard controls
    window.addEventListener('keydown', e => {
      const k = e.key.toLowerCase();
      const keysUsed = ['a','d','w','s','+','-',' '];
      if (!keysUsed.includes(k) && e.code !== 'Space') return;
      e.preventDefault();
      switch (k) {
        case 'a': idx = (idx - 1 + images.length) % images.length; loadImage(); break;
        case 'd': idx = (idx + 1) % images.length; loadImage(); break;
        case 'w': if (channel !== 'rgb_mask') { channel = 'rgb_mask'; loadImage(); } break;
        case 's': if (channel !== 'rgb') { channel = 'rgb'; loadImage(); } break;
        case '+': gamma = Math.max(0.1, gamma - 0.1); applyGamma(); updateGammaInfo(); break;
        case '-': gamma += 0.1; applyGamma(); updateGammaInfo(); break;
        case ' ': viewer.viewport.goHome(true); break;
      }
    });

    // Initial draw
    loadImage();

    // ZIP download handler unchanged...
    downloadZipBtn.addEventListener('click', async () => {
      if (!images.length) return alert('No images loaded.');
      const obj      = images[idx];
      const baseName = `image_${images[idx].id}`;
      const zip      = new JSZip();
      try {
        const [r1, r2] = await Promise.all([fetch(obj.rgb), fetch(obj.rgb_mask)]);
        if (!r1.ok || !r2.ok) throw new Error('Image fetch failed');
        const [b1, b2] = await Promise.all([r1.blob(), r2.blob()]);
        zip.file(`${baseName}_rgb.jpg`, b1);
        zip.file(`${baseName}_rgb_mask.jpg`, b2);
        const zipBlob = await zip.generateAsync({ type:'blob' });
        const url     = URL.createObjectURL(zipBlob);
        const link    = document.createElement('a');
        link.href     = url;
        link.download = `${baseName}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } catch (err) {
        alert('Failed to create ZIP:\n' + err);
      }
    });

  });
})();
