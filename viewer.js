(async function(){
    // 1. load your index.json
    const images = await fetch('/images/index.json').then(r => r.json());
    let idx = 0;
    let channel = 'rgb';
  
    // 2. init OpenSeadragon
    const viewer = OpenSeadragon({
      element: document.getElementById('viewer'),
      prefixUrl: 'https://github.com/nrlhozkan/ImageViewer/tree/main/images/',
      showZoomControl: false,
      defaultZoomLevel: 1,
      gestureSettingsMouse: {
        scrollToZoom: true,      // mouse wheel zoom
        clickToZoom: false,      // disable click-to-zoom
        clickToZoomTimeThreshold: 1000
      }
    });
  
    // helper to (re)load the current image
    function loadImage() {
      const tileSource = {
        type: 'image',
        url: images[idx][channel],
        buildPyramid: false      // if you don’t have deep-zoom tiles
      };
      viewer.open(tileSource);
      document.title = `Image ${idx+1}/${images.length} — ${channel.toUpperCase()}`;
    }

    loadImage();
  
    // 3. keyboard handlers
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
  