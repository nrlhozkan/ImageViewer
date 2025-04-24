(async function(){
  const BASE   = 'https://nrlhozkan.github.io/ImageViewer';
  const images = await fetch(`${BASE}/images/index.json`).then(r => r.json());
  let idx        = 0;
  let channel    = 'rgb';
  let isFirstLoad = true;

  const viewer = OpenSeadragon({
    element:           document.getElementById('viewer'),
    prefixUrl:         'https://cdn.jsdelivr.net/npm/openseadragon@4.0/build/openseadragon/images/',
    showZoomControl:   false,

    // ————— deep-zoom settings —————
    maxZoomPixelRatio: 20,     // up to 20× native resolution
    zoomPerScroll:     1.1,    // finer scroll-wheel zoom (default 2.0)
    minZoomLevel:      0.1,    // zoom out to 10% if you like
    defaultZoomLevel:  1,      // start “fit to screen”
    // ————————————————————————————

    gestureSettingsMouse: {
      scrollToZoom: true,
      clickToZoom:  false
    },
    crossOriginPolicy: 'Anonymous'
  });

  function loadImage(){
    // save view if not first
    let oldZoom, oldCenter;
    if (!isFirstLoad) {
      oldZoom   = viewer.viewport.getZoom();
      oldCenter = viewer.viewport.getCenter();
    }

    // load new image
    viewer.open({
      type: 'image',
      url:  images[idx][channel]
    });

    // after open, either center or restore
    viewer.addOnceHandler('open', ()=>{
      if (isFirstLoad) {
        // center on first load
        const home = viewer.viewport.getHomeBounds();
        viewer.viewport.panTo(home.getCenter(), true);
        isFirstLoad = false;
      } else {
        // restore previous
        viewer.viewport.zoomTo(oldZoom,   null, true);
        viewer.viewport.panTo (oldCenter, true);
      }
      document.title = `Image ${idx+1}/${images.length} — ${channel.toUpperCase()}`;
    });
  }

  // initial display
  loadImage();

  // key bindings
  window.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();

    // SPACE: center current image
    if (k === ' ' || e.code === 'Space') {
      const home = viewer.viewport.getHomeBounds();
      viewer.viewport.panTo(home.getCenter(), true);
      return;
    }

    // WASD navigation
    switch (k) {
      case 'a': // previous image
        idx = (idx - 1 + images.length) % images.length;
        loadImage();
        break;
      case 'd': // next image
        idx = (idx + 1) % images.length;
        loadImage();
        break;
      case 'w': // switch to AN variant
        channel = 'an';
        loadImage();
        break;
      case 's': // switch to RGB variant
        channel = 'rgb';
        loadImage();
        break;
      case '+': // optional: zoom in deeper
      case '=':
        viewer.viewport.zoomBy(1.5);
        viewer.viewport.applyConstraints();
        break;
      case '-': // optional: zoom out
        viewer.viewport.zoomBy(1/1.5);
        viewer.viewport.applyConstraints();
        break;
    }
  });
})();
