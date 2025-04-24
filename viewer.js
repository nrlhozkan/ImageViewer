(async function(){
  // 1) Fetch over HTTPS from your GitHub Pages (or jsDelivr) URL:
  const BASE = 'https://nrlhozkan.github.io/ImageViewer';
  // const BASE = 'https://cdn.jsdelivr.net/gh/<your-username>/ImageViewer@main';
  const images = await fetch(`${BASE}/images/index.json`)
                        .then(r => r.json());
  let idx     = 0;
  let channel = 'rgb';

  // 2) Initialize OpenSeadragon (use the official control-icon path):
  const viewer = OpenSeadragon({
    element:   document.getElementById('viewer'),
    prefixUrl: 'https://cdn.jsdelivr.net/npm/openseadragon@4.0/build/openseadragon/images/',
    showZoomControl: false,
    defaultZoomLevel: 1,
    gestureSettingsMouse: {
      scrollToZoom: true,
      clickToZoom:  false
    }
  });

  // 3) Helper to load current image:
  function loadImage() {
    viewer.open({
      type: 'image',
      url:  images[idx][channel],
      crossOriginPolicy: 'Anonymous',
    });
    document.title = `Image ${idx+1}/${images.length} — ${channel.toUpperCase()}`;
  }
  loadImage();

  // 4) Keyboard controls:
  window.addEventListener('keydown', e => {
    switch (e.key) {
      case 'ArrowLeft':
        channel = 'rx';
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
