(async function(){
  // Base strip URL prefix
  const STRIP_BASE = window.location.hostname.includes('github.io')
    ? 'https://nrlhozkan.github.io/ImageViewer/strip'
    : window.location.origin + '/strip';

  // UI elements
  const viewerEl       = document.getElementById('viewer');
  const downloadZipBtn = document.getElementById('downloadZipBtn');
  const gotoContainer  = document.getElementById('gotoContainer');
  const gotoInputEl    = document.getElementById('gotoInput');
  const gotoBtn        = document.getElementById('gotoBtn');

  // Deep-Link On Load
  const params   = new URLSearchParams(window.location.search);
  const autoGoto = params.get('goto');
  if (autoGoto) {
    gotoInputEl.value = autoGoto;
    setTimeout(() => gotoBtn.click(), 0);
  }

  // State
  let images                = [];
  let idx                   = 0;
  let channel               = 'rgb';
  let isFirst               = true;
  let gamma                 = 1.0;
  let viewer;
  let stripId;
  let lastImageID;
  let pendingGoto           = null;
  let markerCoordinates     = null;
  let lastMarkerCoordinates = null;
  let bboxCoordinates       = null;
  let lastBBoxCoordinates   = null;

  // Clear & Restore Buttons
  const clearBtn = document.createElement('button');
  clearBtn.textContent = 'Clear Marker'; clearBtn.style.marginLeft = '8px'; clearBtn.disabled = true;
  const restoreBtn = document.createElement('button');
  restoreBtn.textContent = 'Restore Marker'; restoreBtn.style.marginLeft = '8px'; restoreBtn.disabled = true;
  gotoContainer.append(clearBtn, restoreBtn);

  clearBtn.addEventListener('click', () => {
    if (viewer._lastMarker) { viewer.removeOverlay(viewer._lastMarker); viewer._lastMarker = null; }
    markerCoordinates = null; pendingGoto = null;
    clearBtn.disabled = true;
    restoreBtn.disabled = !lastMarkerCoordinates;
    updateGotoValue();
  });
  restoreBtn.addEventListener('click', () => {
    if (lastMarkerCoordinates) {
      markerCoordinates = lastMarkerCoordinates;
      loadImage();
      clearBtn.disabled = false;
      restoreBtn.disabled = true;
      updateGotoValue();
    }
  });

  // Info Panel for URLs & Deep-Link
  const infoPanel = document.createElement('div');
  infoPanel.id = 'infoPanel';
  infoPanel.style.cssText = `position:absolute; top:80px; left:10px; background:rgba(255,255,255,0.9); color:#000; padding:8px; font-family:sans-serif; font-size:14px; border-radius:4px; z-index:1000;`;
  infoPanel.innerHTML = `
    <strong>Image URLs</strong><br>
    <code id="infoURLs" style="font-size:12px; white-space:pre-wrap;"></code>
    <div id="infoBBox" style="margin-top:6px; font-family:monospace; font-size:13px;"></div>
  `;
  viewerEl.appendChild(infoPanel);
  const infoURLsEl  = document.getElementById('infoURLs');
  const infoBBoxEl  = document.getElementById('infoBBox');

  // Strip & Gamma Overlays
  const stripEl = document.createElement('div'); stripEl.id = 'stripImageInfo';
  stripEl.style.cssText = `position:absolute; top:40px; left:10px; background:rgba(0,0,0,0.6); color:#fff; padding:4px 8px; border-radius:4px; font-size:14px; z-index:1000;`;
  const gammaEl = document.createElement('div'); gammaEl.id = 'gammaInfo';
  gammaEl.style.cssText = `position:absolute; bottom:10px; left:10px; background:rgba(0,0,0,0.6); color:#fff; padding:4px 8px; border-radius:4px; font-size:14px; z-index:1000;`;
  viewerEl.append(stripEl, gammaEl);

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
  if (viewer.innerTracker?.keyHandler) viewer.innerTracker.keyHandler = null;

  // Spinner
  const style = document.createElement('style');
  style.textContent = `
    @keyframes spin { from{transform:rotate(0)} to{transform:rotate(360deg)} }
    #spinner { display:none; position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); width:40px; height:40px; border:4px solid rgba(0,0,0,0.1); border-top:4px solid #333; border-radius:50%; animation:spin 1s linear infinite; z-index:1001; }
  `;
  document.head.appendChild(style);
  const spinner = document.createElement('div'); spinner.id = 'spinner'; viewerEl.appendChild(spinner);

  // Coordinate Overlay
  const coord = document.createElement('div'); coord.id = 'coordInfo';
  coord.style.cssText = `display:none; position:absolute; background:rgba(0,0,0,0.5); color:#fff; padding:2px 4px; font-family:monospace; font-size:12px; pointer-events:none; z-index:1000; transform:translate(8px,8px);`;
  viewerEl.appendChild(coord);
  viewerEl.addEventListener('mousemove', e => {
    const r  = viewerEl.getBoundingClientRect();
    const wp = new OpenSeadragon.Point(e.clientX - r.left, e.clientY - r.top);
    const ip = viewer.viewport.viewerElementToImageCoordinates(wp);
    const tile = viewer.world.getItemAt(0);
    if (!tile) return;
    const { x: W, y: H } = tile.getContentSize();
    if (ip.x>=0 && ip.x<=W && ip.y>=0 && ip.y<=H) {
      coord.style.display = 'block'; coord.style.left = `${wp.x}px`; coord.style.top = `${wp.y}px`;
      coord.textContent   = `x:${Math.round(ip.x)}, y:${Math.round(ip.y)}`;
    } else coord.style.display='none';
  });

  // Keyboard Navigation (unchanged)
  window.addEventListener('keydown', e => {/*...*/});

  // Go-To Handler
  gotoBtn.addEventListener('click', async () => {
    const parts = gotoInputEl.value.trim().split(/\s+/);
    if (![2,4,6].includes(parts.length)) {
      return alert('Enter: strip image [x y] or strip image x y width height');
    }
    stripId = String(Number(parts[0]));
    const jsonUrl = `${STRIP_BASE}${stripId}/index.json`;
    try { const res = await fetch(jsonUrl); if(!res.ok) throw Error(res.statusText); images = await res.json(); }
    catch(err){ return alert('Failed to load JSON: '+err); }
    lastImageID = images[images.length-1].id;
    idx = images.findIndex(o=>String(o.id)===parts[1]);
    if(idx<0) return alert('Image not found: '+parts[1]);
    // parse optional marker or bbox
    if(parts.length === 4) {
      markerCoordinates = { x:+parts[2], y:+parts[3] };
      lastMarkerCoordinates = {...markerCoordinates};
      bboxCoordinates = null;
    } else if(parts.length===6) {
      bboxCoordinates = { height:+parts[2], width:+parts[3], x:+parts[4], y:+parts[5] };
      lastBBoxCoordinates = {...bboxCoordinates}; markerCoordinates=null;
    }
    clearBtn.disabled = !markerCoordinates;
    restoreBtn.disabled = true;
    viewerEl.style.display='block'; downloadZipBtn.style.display='inline-block';
    history.replaceState(null,'',`?goto=${gotoInputEl.value.trim()}`);
    infoURLsEl.textContent = `RGB: ${images[idx].rgb}\nMASK: ${images[idx].rgb_mask}\nDeep-link: ${window.location.href}`;
    drawBBoxInfo();
    loadImage();
  });

  function applyGamma(){/*...*/}

  function loadImage(){
    spinner.style.display='block';
    let oldZoom, oldCenter;
    if(!isFirst){ oldZoom=viewer.viewport.getZoom(); oldCenter=viewer.viewport.getCenter(); }
    viewer.open({type:'image',url:images[idx][channel]});
    viewer.addOnceHandler('open',()=>{
      spinner.style.display='none';
      if(isFirst){ viewer.viewport.goHome(true); isFirst=false; }
      else { viewer.viewport.zoomTo(oldZoom,null,true); viewer.viewport.panTo(oldCenter,true); }
      stripEl.textContent = `Strip: ${stripId} | Image: ${images[idx].id}/${lastImageID}`;
      applyGamma();
      if(markerCoordinates){ drawMarker(markerCoordinates); }
      if(bboxCoordinates){ drawBBox(bboxCoordinates); }
    });
  }

  function drawMarker({x,y}){
    if(viewer._lastMarker) viewer.removeOverlay(viewer._lastMarker);
    const imgPt = new OpenSeadragon.Point(x,y);
    const vpPt  = viewer.viewport.imageToViewportCoordinates(imgPt);
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32'>
      <line x1='16' y1='0' x2='16' y2='32' stroke='blue' stroke-width='4'/>
      <line x1='0' y1='16' x2='32' y2='16' stroke='blue' stroke-width='4'/>
    </svg>`;
    const el = document.createElement('div'); el.innerHTML=svg; el.style.pointerEvents='none';
    viewer.addOverlay({element:el,location:vpPt,placement:OpenSeadragon.Placement.CENTER});
    viewer._lastMarker=el;
  }

  function drawBBox({x,y,width,height}){
    if(viewer._lastBBox) viewer.removeOverlay(viewer._lastBBox);
    const rectImg = new OpenSeadragon.Rect(x,y,height,width).rotate(0);
    const vpRect = viewer.viewport.imageToViewportRectangle(rectImg);
    const el = document.createElement('div');
    Object.assign(el.style,{
      border:'4px solid yellow',
      boxSizing:'border-box',
      pointerEvents:'none'
    });
    viewer.addOverlay({element:el, location:vpRect, placement:OpenSeadragon.Placement.TOP_LEFT});
    viewer._lastBBox=el;
  }

  function drawBBoxInfo(){
    if(bboxCoordinates){
      infoBBoxEl.innerHTML = `height: ${bboxCoordinates.height}, width: ${bboxCoordinates.width}<br>x: ${bboxCoordinates.x}, y: ${bboxCoordinates.y}`;
    } else infoBBoxEl.textContent='';
    updateGotoValue();
  }

  function updateGotoValue(){
    if(bboxCoordinates) gotoInputEl.value = `${stripId} ${images[idx].id} ${bboxCoordinates.height} ${bboxCoordinates.width} ${bboxCoordinates.x} ${bboxCoordinates.y}`;
    else if(markerCoordinates) gotoInputEl.value = `${stripId} ${images[idx].id} ${markerCoordinates.x} ${markerCoordinates.y}`;
    else gotoInputEl.value = `${stripId} ${images[idx].id}`;
  }

  // Ctrl+Click => add marker
  viewerEl.addEventListener('click', e => {
    if(!images.length) return;
    const r  = viewerEl.getBoundingClientRect();
    const wp = new OpenSeadragon.Point(e.clientX-r.left,e.clientY-r.top);
    const ip = viewer.viewport.viewerElementToImageCoordinates(wp);
    if(e.ctrlKey){
      markerCoordinates={ x: Math.round(ip.x), y: Math.round(ip.y) };
      lastMarkerCoordinates={...markerCoordinates}; bboxCoordinates=null;
      clearBtn.disabled=false; restoreBtn.disabled=true;
      drawMarker(markerCoordinates); drawBBoxInfo();
    }
  });

  // Alt+Drag => draw bbox
  let drawStart=null;
  viewerEl.addEventListener('mousedown', e => {
    if(e.altKey){ e.preventDefault(); const r = viewerEl.getBoundingClientRect(); const wp = new OpenSeadragon.Point(e.clientX-r.left,e.clientY-r.top); drawStart = viewer.viewport.viewerElementToImageCoordinates(wp); }
  });
  viewerEl.addEventListener('mouseup', e => {
    if(e.altKey && drawStart){
      const r = viewerEl.getBoundingClientRect(); const wp = new OpenSeadragon.Point(e.clientX-r.left,e.clientY-r.top);
      const end = viewer.viewport.viewerElementToImageCoordinates(wp);
      const x = Math.round(Math.min(drawStart.x,end.x));
      const y = Math.round(Math.min(drawStart.y,end.y));
      const width = Math.round(Math.abs(end.x-drawStart.x));
      const height= Math.round(Math.abs(end.y-drawStart.y));
      bboxCoordinates={ x,y,width,height };
      lastBBoxCoordinates={...bboxCoordinates}; markerCoordinates=null;
      if(viewer._lastBBox) viewer.removeOverlay(viewer._lastBBox);
      drawBBox(bboxCoordinates); drawBBoxInfo(); drawStart=null;
    }
  });

  // Download ZIP (unchanged)
  downloadZipBtn.addEventListener('click', async ()=>{/*...*/});
})();
