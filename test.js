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
        startIdx = 0,
        endIdx = 0,
        viewer;
  
    // Apply gamma correction only to OpenSeadragon canvas elements
    function applyGamma() {
       // only filter the OSD canvas layer, not the overlay divs:
       const brightnessValue = 1 / gamma;
       const osdCanvasGroup = viewerEl.querySelector('.openseadragon-canvas');
       if (osdCanvasGroup) {
         osdCanvasGroup.style.filter = `brightness(${brightnessValue})`;
       }
    }
  
    btn.addEventListener('click', async () => {
      // Normalize URL to index.json
      let url = inputEl.value.trim();
      if (!url.match(/\.json(\?.*)?$/i)) {
        url = url.replace(/\/+$/, '') + '/index.json';
      }
  
      // Extract numeric Strip ID
      const folderUrl   = url.replace(/\/index\.json(\?.*)?$/i, '');
      const rawFolderId = folderUrl.split('/').pop();
      const stripId     = rawFolderId.replace(/\D/g, '');
  
      // Read "Start at" (1-based) and set start index
      const startVal = parseInt(startIndexEl.value, 10);
      startImageNumber = (!isNaN(startVal) && startVal > 0) ? startVal : 1;
      startIdx = startImageNumber - 1;
  
      // Fetch JSON
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(res.status + ' ' + res.statusText);
        images = await res.json();
      } catch(err) {
        return alert('Failed to load JSON:\n' + err);
      }
  
      // Compute allowed range
      startIdx = Math.min(Math.max(startIdx, 0), images.length - 1);
      endIdx = Math.min(images.length - 1, startIdx + 110);
      idx = startIdx;
  
      // Show viewer and controls
      loaderEl.style.display       = 'none';
      viewerEl.style.display       = 'block';
      downloadZipBtn.style.display = 'inline-block';
  
      // Initialize OpenSeadragon
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
      // Disable built-in keyboard nav
      if (viewer.innerTracker && viewer.innerTracker.keyHandler) {
        viewer.innerTracker.keyHandler = null;
      }
  
      // Helpers to update overlays
      function updateStripInfo(){
        const current = idx + 1;
        const maxImageNumber = endIdx + 1;
        stripEl.textContent = `Strip: ${stripId} | Image: ${current}/${maxImageNumber}`;
      }
      function updateGammaInfo(){
        gammaEl.textContent = `γ=${gamma.toFixed(2)}`;
      }
  
      // Load image preserving pan/zoom
      function loadImage(){
        let oldZoom, oldCenter;
        if (!isFirst) {
          oldZoom   = viewer.viewport.getZoom();
          oldCenter = viewer.viewport.getCenter();
        }
        viewer.open({ type:'image', url: images[idx][channel] });
        viewer.addOnceHandler('open', () => {
          if (isFirst) {
            const home = viewer.viewport.getHomeBounds();
            viewer.viewport.panTo(home.getCenter(), true);
            isFirst = false;
          } else {
            viewer.viewport.zoomTo(oldZoom, null, true);
            viewer.viewport.panTo(oldCenter, true);
          }
          document.title = `Image ${idx+1}/${images.length} — ${channel.toUpperCase()}`;
          applyGamma();
          updateStripInfo();
          updateGammaInfo();
        });
      }
  
      // Keyboard controls: limited looping
      window.addEventListener('keydown', e => {
        const k = e.key.toLowerCase();
        const keysUsed = ['a','d','w','s','+','-',' '];
        if (!keysUsed.includes(k) && e.code !== 'Space') return;
        e.preventDefault();
        switch (k) {
          case 'a':
            idx--;
            if (idx < startIdx) idx = endIdx;
            loadImage();
            break;
          case 'd':
            idx++;
            if (idx > endIdx) idx = startIdx;
            loadImage();
            break;
          case 'w':
            if (channel !== 'rgb_mask') { channel = 'rgb_mask'; loadImage(); }
            break;
          case 's':
            if (channel !== 'rgb') { channel = 'rgb'; loadImage(); }
            break;
          case '+':
            gamma = Math.max(0.1, gamma - 0.1);
            applyGamma();
            updateGammaInfo();
            break;
          case '-':
            gamma = gamma + 0.1;
            applyGamma();
            updateGammaInfo();
            break;
          case ' ':
            viewer.viewport.goHome(true);
            break;
        }
      });
  
      // Initial draw
      loadImage();
  
      // ZIP download handler remains unchanged...
      downloadZipBtn.addEventListener('click', async () => {
        if (!images.length) return alert('No images loaded.');
        const obj      = images[idx];
        const baseName = `image_${idx+1}`;
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
  