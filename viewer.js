(async function(){
  const BASE   = 'https://nrlhozkan.github.io/ImageViewer';
  const images = await fetch(`${BASE}/images/index.json`).then(r => r.json());
  let idx     = 0;
  let channel = 'rgb';

  const viewer = OpenSeadragon({
    element:   document.getElementById('viewer'),
    prefixUrl: 'https://cdn.jsdelivr.net/npm/openseadragon@4.0/build/openseadragon/images/',
    showZoomControl: false,
    defaultZoomLevel: 1,
    gestureSettingsMouse: { scrollToZoom:true, clickToZoom:false }
  });

  // helper to load current image *and* preserve pan/zoom
  function loadImage() {
    // 1) grab current pan/zoom
    const oldZoom   = viewer.viewport.getZoom();
    const oldCenter = viewer.viewport.getCenter();

    // 2) open the new image
    viewer.open({
      type:              'image',
      url:               images[idx][channel],
      crossOriginPolicy: 'Anonymous'
    });

    // 3) once it’s open, restore pan/zoom
    viewer.addOnceHandler('open', () => {
      viewer.viewport.zoomTo(oldZoom,   null, true);
      viewer.viewport.panTo (oldCenter, true);
      document.title = `Image ${idx+1}/${images.length} — ${channel.toUpperCase()}`;
    });
  }

  // initial load
  loadImage();

  // keyboard controls
  window.addEventListener('keydown', e => {
    switch(e.key) {
      case 'ArrowLeft':
        channel = 'an';
        loadImage();
        break;
      case 'ArrowRight':
        channel = 'rgb';
        loadImage();
        break;
      case 'ArrowUp':
        idx = (idx + 1) % images.length;
        loadImage();
        break;
      case 'ArrowDown':
        idx = (idx - 1 + images.length) % images.length;
        loadImage();
        break;
    }
  });
})();
