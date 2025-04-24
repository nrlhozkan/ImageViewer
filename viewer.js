// viewer.js

(async function(){
  const loaderEl = document.getElementById('loader');
  const inputEl  = document.getElementById('jsonUrl');
  const btn      = document.getElementById('loadBtn');
  const viewerEl = document.getElementById('viewer');

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

    // 3) Hide loader, show viewer
    loaderEl.style.display = 'none';
    viewerEl.style.display = 'block';

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
          // center on first load
          const home = viewer.viewport.getHomeBounds();
          viewer.viewport.panTo(home.getCenter(), true);
          isFirst = false;
        } else {
          // restore previous pan/zoom
          viewer.viewport.zoomTo(oldZoom, null, true);
          viewer.viewport.panTo(oldCenter, true);
        }
        document.title = `Image ${idx+1}/${images.length} — ${channel.toUpperCase()}`;
      });
    }

    // 6) Keyboard controls, including full “go home” on Space
    window.addEventListener('keydown', e => {
      const k = e.key.toLowerCase();

      // FULL RESET for current image
      if (k === ' ' || e.code === 'Space') {
        viewer.viewport.goHome(true);   // animate back to initial pan & zoom
        return;
      }

      switch(k){
        case 'a': // previous image
          idx = (idx - 1 + images.length) % images.length;
          loadImage();
          break;
        case 'd': // next image
          idx = (idx + 1) % images.length;
          loadImage();
          break;
        case 'w': // AN variant
          channel = 'an';
          loadImage();
          break;
        case 's': // RGB variant
          channel = 'rgb';
          loadImage();
          break;
        case '+': case '=':  // zoom in deeper
          viewer.viewport.zoomBy(1.5);
          viewer.viewport.applyConstraints();
          break;
        case '-':            // zoom out
          viewer.viewport.zoomBy(1/1.5);
          viewer.viewport.applyConstraints();
          break;
      }
    });

    // 7) Show the very first image
    loadImage();
  });
})();
