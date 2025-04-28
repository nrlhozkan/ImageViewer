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
        viewer;
  
    // Apply gamma correction via CSS filter
    function applyGamma() {
      // brightness: 1 = no change; gamma < 1 brightens, gamma > 1 darkens
      viewerEl.style.filter = `brightness(${1 / gamma})`;
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
      const stripId     = rawFolderId.replace(/\D/g, '');
  
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
      // Disable built-in keyboard nav
      if (viewer.innerTracker && viewer.innerTracker.keyHandler) {
        viewer.innerTracker.keyHandler = null;
      }
  
      // Helpers to update overlays
      function updateStripInfo(){
        const current = idx + 1;
        const maxImg  = startImageNumber + 110;
        stripEl.textContent = `Strip: ${stripId} | Image: ${current}/${maxImg}`;
      }
      function updateGammaInfo(){
        gammaEl.textContent = `γ=${gamma.toFixed(2)}`;
      }
  
      // 7) Load image preserving pan/zoom
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
  
      // 8) Keyboard controls
      window.addEventListener('keydown', e => {
        const k = e.key.toLowerCase();
        const keysUsed = ['a','d','w','s','+','-',' '];
        if (!keysUsed.includes(k) && e.code !== 'Space') return;
        e.preventDefault();
        switch (k) {
          case 'a':
            idx = (idx - 1 + images.length) % images.length;
            loadImage();
            break;
          case 'd':
            idx = (idx + 1) % images.length;
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
  
      // 9) ZIP download handler
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
  