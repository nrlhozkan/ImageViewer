// viewer.js

(async function(){
    const loaderEl       = document.getElementById('loader');
    const inputEl        = document.getElementById('jsonUrl');
    const btn            = document.getElementById('loadBtn');
    const viewerEl       = document.getElementById('viewer');
    const downloadZipBtn = document.getElementById('downloadZipBtn');
  
    let images = [], idx = 0, channel = 'rgb', isFirst = true, viewer;
  
    btn.addEventListener('click', async () => {
      // 1) Normalize the URL to index.json
      let url = inputEl.value.trim();
      if (!url.match(/\.json(\?.*)?$/i)) {
        url = url.replace(/\/+$/, '') + '/index.json';
      }
  
      // 2) Fetch your JSON
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(res.status + ' ' + res.statusText);
        images = await res.json();
      } catch (err) {
        return alert('Failed to load JSON:\n' + err);
      }
  
      // 3) Hide loader, show viewer and download button
      loaderEl.style.display       = 'none';
      viewerEl.style.display       = 'block';
      downloadZipBtn.style.display = 'inline-block';
  
      // 4) Initialize OpenSeadragon
      viewer = OpenSeadragon({
        element:           viewerEl,
        prefixUrl:         'https://cdn.jsdelivr.net/npm/openseadragon@4.0/build/openseadragon/images/',
        showZoomControl:   false,
        maxZoomPixelRatio: 20,
        zoomPerScroll:     1.1,
        minZoomLevel:      0.1,
        defaultZoomLevel:  1,
        gestureSettingsMouse: { scrollToZoom:true, clickToZoom:false },
        crossOriginPolicy: 'Anonymous'
      });
  
      // 5) Function to load images while preserving pan/zoom
      function loadImage(){
        let oldZoom, oldCenter;
        if (!isFirst) {
          oldZoom   = viewer.viewport.getZoom();
          oldCenter = viewer.viewport.getCenter();
        }
        viewer.open({ type:'image', url: images[idx][channel] });
        viewer.addOnceHandler('open', ()=>{
          if (isFirst) {
            const home = viewer.viewport.getHomeBounds();
            viewer.viewport.panTo(home.getCenter(), true);
            isFirst = false;
          } else {
            viewer.viewport.zoomTo(oldZoom, null, true);
            viewer.viewport.panTo(oldCenter, true);
          }
          document.title = `Image ${idx+1}/${images.length} — ${channel.toUpperCase()}`;
        });
      }
  
      // 6) Keyboard controls, including full “go home” on Space
      window.addEventListener('keydown', e => {
        const k = e.key.toLowerCase();
        if (k === ' ' || e.code === 'Space') {
          viewer.viewport.goHome(true);
          return;
        }
        switch(k){
          case 'a': idx = (idx - 1 + images.length) % images.length; loadImage(); break;
          case 'd': idx = (idx + 1) % images.length; loadImage(); break;
          case 'w': channel = 'rgb_mask'; loadImage(); break;
          case 's': channel = 'rgb'; loadImage(); break;
          case '+': case '=': viewer.viewport.zoomBy(1.5); viewer.viewport.applyConstraints(); break;
          case '-': viewer.viewport.zoomBy(1/1.5); viewer.viewport.applyConstraints(); break;
        }
      });
  
      // 7) Show the very first image
      loadImage();
  
      // 8) Download ZIP handler
      downloadZipBtn.addEventListener('click', async () => {
        if (!images.length) {
          return alert('No images loaded.');
        }
        const current  = images[idx];
        const baseName = `image_${idx+1}`;
        const zip      = new JSZip();
  
        try {
          // Fetch both images in parallel
          const [resRgb, resMask] = await Promise.all([
            fetch(current.rgb),
            fetch(current.rgb_mask)
          ]);
          if (!resRgb.ok || !resMask.ok) {
            throw new Error('Failed to fetch one or more images');
          }
  
          // Convert to blobs
          const [blobRgb, blobMask] = await Promise.all([
            resRgb.blob(),
            resMask.blob()
          ]);
  
          // Add to zip
          zip.file(`${baseName}_rgb.jpg`,      blobRgb);
          zip.file(`${baseName}_rgb_mask.jpg`, blobMask);
  
          // Generate zip as a Blob
          const zipBlob = await zip.generateAsync({ type: 'blob' });
  
          // Trigger download
          const url  = URL.createObjectURL(zipBlob);
          const link = document.createElement('a');
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
  