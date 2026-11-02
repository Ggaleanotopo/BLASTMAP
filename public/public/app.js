/* BlastMap Web V0.3 · publicación controlada por GitHub, sin contraseñas propias. */
(()=>{'use strict';
const G=globalThis.BlastGeo, DXF=globalThis.BlastDxf, VECTOR=globalThis.BlastVector;
const $=id=>document.getElementById(id);
const safe=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const fmt=n=>Number(n).toLocaleString('es-CO',{maximumFractionDigits:2});
const colors=['#dfaa54','#6fb891','#6fafe2','#d17b89','#9d8dd1','#b5af65','#7fc6c6'];
const sample=[
  {id:'VOL-025',layer:'VOL-025',handle:'A1',points:[[999050,1006440],[999250,1006440],[999250,1006600],[999050,1006600]]},
  {id:'VOL-026',layer:'VOL-026',handle:'A2',points:[[999300,1006450],[999500,1006450],[999475,1006620],[999310,1006630]]},
  {id:'VOL-027',layer:'VOL-027',handle:'A3',points:[[999560,1006430],[999730,1006450],[999710,1006610],[999555,1006575]]},
].map(f=>({...f,points:f.points.map(([x,y])=>({x,y,z:152})),source:'DEMO · MAGNA Central',type:'DEMO'}));
for(const f of sample){f.area=G.area(f.points);f.perimeter=G.perimeter(f.points);}
const app={sources:[],official:{version:null,publishedAt:null,areas:[],visible:true},syncOk:false,toPublish:new Set(),displayCrs:'magna_central',selected:null,gps:null,watchId:null,hiddenSources:new Set(),hiddenLayers:new Set(),viewMode:'all',grid:true,labels:true,measure:false,measurePoints:[],activeTab:'mapa',
    view:{x:999375,y:1006525,scale:1.3},pointers:new Map(),dragged:false,pinchDist:0,installPrompt:null};
const demoSource='DEMO · MAGNA Central';
let raster=null;
let googleMap=null, googleGps=null, googleLoadedKey=null, googleDataSignature='';
const c=$('map-canvas'),ctx=c.getContext('2d');let canvasW=800,canvasH=600,toastTimer=null;
const officialAreas=()=>app.official.visible?app.official.areas:[];
const allAreas=()=>[...app.official.areas,...app.sources.flatMap(s=>s.areas)];
function featureVisible(f){
 const isOfficial=app.official.areas.includes(f);
 if(app.viewMode==='official' && !isOfficial)return false;
 if(app.viewMode==='personal' && isOfficial)return false;
 if(app.hiddenSources.has(f.source))return false;
 if(app.hiddenLayers.has(f.layer))return false;
 return true;
}
const sourceAreas=()=>[...officialAreas(),...app.sources.flatMap(s=>s.areas)].filter(featureVisible);
const findByKey=(name,i)=>app.sources.find(s=>s.name===name)?.areas[i]??null;
function toast(msg){const t=$('toast');t.textContent=msg;t.classList.remove('hidden');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.add('hidden'),3800);}
function world(px,py){return {x:app.view.x+(px-canvasW/2)/app.view.scale,y:app.view.y-(py-canvasH/2)/app.view.scale};}
function screen(x,y){return {x:canvasW/2+(x-app.view.x)*app.view.scale,y:canvasH/2-(y-app.view.y)*app.view.scale};}
function niceStep(val){const p=10**Math.floor(Math.log10(val||1)),a=val/p;return (a<=1?1:a<=2?2:a<=5?5:10)*p;}
function visibleBounds(){return {minX:world(0,0).x,maxX:world(canvasW,0).x,maxY:world(0,0).y,minY:world(0,canvasH).y};}
function resize(){const r=c.getBoundingClientRect();if(r.width<1||r.height<1)return;canvasW=r.width;canvasH=r.height;
 const dpr=Math.min(window.devicePixelRatio||1,3);c.width=Math.ceil(canvasW*dpr);c.height=Math.ceil(canvasH*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);draw();}
function drawGrid(){const b=visibleBounds(),step=niceStep(130/app.view.scale);ctx.save();ctx.lineWidth=1;
 let count=0;
 for(let x=Math.ceil(b.minX/step)*step;x<=b.maxX&&count++<150;x+=step){const p=screen(x,0);ctx.strokeStyle='#cbd2ca';ctx.beginPath();ctx.moveTo(Math.round(p.x)+.5,0);ctx.lineTo(Math.round(p.x)+.5,canvasH);ctx.stroke();ctx.fillStyle='#82948f';ctx.font='10px system-ui';ctx.fillText('E '+Math.round(x).toLocaleString('es-CO'),p.x+5,canvasH-52);}
 count=0;for(let y=Math.ceil(b.minY/step)*step;y<=b.maxY&&count++<150;y+=step){const p=screen(0,y);ctx.strokeStyle='#cbd2ca';ctx.beginPath();ctx.moveTo(0,Math.round(p.y)+.5);ctx.lineTo(canvasW,Math.round(p.y)+.5);ctx.stroke();ctx.fillStyle='#82948f';ctx.font='10px system-ui';ctx.fillText('N '+Math.round(y).toLocaleString('es-CO'),12,p.y-6);}
 ctx.restore();}
function wrapName(s,max=21){return s.length>max?s.slice(0,max-1)+'…':s;}
function pathPolygon(pts){ctx.beginPath();pts.forEach((p,i)=>{const q=screen(p.x,p.y);i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y);});ctx.closePath();}
function drawPolygon(f,i){const isSelected=app.selected===f,colour=colors[i%colors.length];ctx.save();pathPolygon(f.points);ctx.fillStyle=isSelected?'rgba(41,140,145,.41)':colour+'66';ctx.fill();ctx.lineWidth=isSelected?3.5:2;ctx.strokeStyle=isSelected?'#1c737d':colour;ctx.stroke();if(isSelected){ctx.setLineDash([4,5]);ctx.lineWidth=1;ctx.strokeStyle='#174b5f';ctx.stroke();ctx.setLineDash([]);}ctx.restore();}
function drawLabels(arr){
 ctx.save();ctx.font='700 12px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';
 const occupied=[];
 const ordered=[...arr].sort((a,b)=>(a===app.selected?-1:b===app.selected?1:0));
 for(const f of ordered){
  const bb=G.bounds(f.points),p=screen((bb.minX+bb.maxX)/2,(bb.minY+bb.maxY)/2);
  if(p.x<0||p.x>canvasW||p.y<0||p.y>canvasH)continue;
  const label=wrapName(f.id,24),w=ctx.measureText(label).width+17;
  const box={x:p.x-w/2-5,y:p.y-16,w:w+10,h:32};
  if(occupied.some(r=>box.x<r.x+r.w&&box.x+box.w>r.x&&box.y<r.y+r.h&&box.y+box.h>r.y))continue;
  // Omitir etiquetas que no caben dentro de polígonos pequeños, salvo área seleccionada.
  if(f!==app.selected&&(bb.maxX-bb.minX)*app.view.scale<w*.85)continue;
  occupied.push(box);
  ctx.fillStyle='#fffefaee';ctx.beginPath();ctx.roundRect(p.x-w/2,p.y-11,w,22,5);ctx.fill();
  ctx.fillStyle='#264652';ctx.fillText(label,p.x,p.y+1);
 }
 ctx.restore();
}
function drawRaster(){
 if(!raster||!$('raster-show').checked)return;
 // Transformación afín: centro del píxel (0,0), pixel horizontal (ancho,0), vertical (0,alto).
 const corner=(col,row)=>G.toInternal({x:raster.A*col+raster.B*row+raster.C,y:raster.D*col+raster.E*row+raster.F},raster.crs);
 const ca=corner(-.5,-.5),cb=corner(raster.img.width-.5,-.5),cd=corner(-.5,raster.img.height-.5);
 const a=screen(ca.x,ca.y),b=screen(cb.x,cb.y),d=screen(cd.x,cd.y);
 ctx.save();ctx.globalAlpha=Number($('raster-opacity').value)/100;
 ctx.setTransform((b.x-a.x)/raster.img.width,(b.y-a.y)/raster.img.width,(d.x-a.x)/raster.img.height,(d.y-a.y)/raster.img.height,a.x,a.y);
 ctx.drawImage(raster.img,0,0);ctx.restore();
}
function drawGps(){if(!app.gps)return;const p=screen(app.gps.x,app.gps.y);if(p.x< -1e5||p.x>canvasW+1e5||p.y< -1e5||p.y>canvasH+1e5)return;
 ctx.save();const r=Math.max(4,app.gps.accuracy*app.view.scale);ctx.beginPath();ctx.arc(p.x,p.y,Math.min(r,8000),0,Math.PI*2);ctx.fillStyle='rgba(37,104,211,.10)';ctx.fill();ctx.strokeStyle='rgba(37,104,211,.38)';ctx.lineWidth=1;ctx.stroke();ctx.beginPath();ctx.arc(p.x,p.y,8,0,Math.PI*2);ctx.fillStyle=app.gps.sim?'#b3732f':'#286add';ctx.fill();ctx.lineWidth=2.8;ctx.strokeStyle='#fff';ctx.stroke();ctx.restore();}
function drawMeasure(){if(!app.measurePoints.length)return;ctx.save();ctx.strokeStyle='#cf7d32';ctx.lineWidth=2.5;ctx.setLineDash([7,5]);ctx.beginPath();const a=screen(app.measurePoints[0].x,app.measurePoints[0].y);ctx.moveTo(a.x,a.y);if(app.measurePoints.length>1){const b=screen(app.measurePoints[1].x,app.measurePoints[1].y);ctx.lineTo(b.x,b.y);}ctx.stroke();ctx.setLineDash([]);
 for(const q of app.measurePoints){const p=screen(q.x,q.y);ctx.beginPath();ctx.arc(p.x,p.y,5,0,Math.PI*2);ctx.fillStyle='#d97c35';ctx.fill();ctx.lineWidth=2;ctx.strokeStyle='white';ctx.stroke();}ctx.restore();}
function draw(){if(canvasW<5||canvasH<5)return;
 if(googleMap && $('basemap-mode').value==='google'){refreshGoogle();return;}
 ctx.save();ctx.clearRect(0,0,canvasW,canvasH);ctx.fillStyle='#e6e7db';ctx.fillRect(0,0,canvasW,canvasH);
 drawRaster();if(app.grid && ['magna_central','magna_bogota'].includes(app.displayCrs))drawGrid();const areas=sourceAreas();areas.forEach(drawPolygon);if(app.labels)drawLabels(areas);drawGps();drawMeasure();ctx.restore();
 const target=90/app.view.scale;const exp=10**Math.floor(Math.log10(target));const step=[1,2,5,10].map(k=>k*exp).sort((a,b)=>Math.abs(a-target)-Math.abs(b-target))[0];$('scale-text').textContent=fmt(step)+' m';$('scale-line').style.width=(step*app.view.scale)+'px';$('map-count').textContent=areas.length+' voladura'+(areas.length===1?'':'s');
}
function fitFeatures(areas=sourceAreas()){if(!areas.length){app.view={x:999375,y:1006525,scale:1.3};draw();return;}
 let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
 for(const f of areas){const b=G.bounds(f.points);minX=Math.min(minX,b.minX);maxX=Math.max(maxX,b.maxX);minY=Math.min(minY,b.minY);maxY=Math.max(maxY,b.maxY);}
 const dx=Math.max(45,maxX-minX),dy=Math.max(45,maxY-minY);
 app.view={x:(minX+maxX)/2,y:(minY+maxY)/2,scale:Math.min(15,Math.max(.001,Math.min((canvasW-90)/dx,(canvasH-110)/dy)))};draw();}
function centerOn(f){const b=G.bounds(f.points);app.view.x=(b.minX+b.maxX)/2;app.view.y=(b.minY+b.maxY)/2;
 app.view.scale=Math.min(15,Math.max(.001,Math.min(canvasW/((b.maxX-b.minX)*2.2||100),canvasH/((b.maxY-b.minY)*2.1||100))));draw();}
function zoomAt(px,py,factor){const before=world(px,py);app.view.scale=Math.min(35,Math.max(.002,app.view.scale*factor));const after=world(px,py);app.view.x+=before.x-after.x;app.view.y+=before.y-after.y;draw();}
function locateArea(pos){const inside=[],near=[];
 for(const f of sourceAreas()){
   const bb=G.bounds(f.points),margin=Math.max(0,pos.accuracy);
   if(pos.x<bb.minX-margin||pos.x>bb.maxX+margin||pos.y<bb.minY-margin||pos.y>bb.maxY+margin)continue;
   const within=G.pointInPolygon(pos,f.points),border=G.distanceBorder(pos,f.points);
   if(within)inside.push({f,border});if(border<=margin)near.push({f,border});
 }
 if(inside.length>1)return {type:'ambiguous',title:'Polígonos superpuestos',detail:'La posición cae dentro de varios polígonos. Revisar los contornos.'};
 if(inside.length===1){const h=inside[0],boundary=h.border<=pos.accuracy;
   if(boundary)return {type:'warning',title:'Cerca del límite · '+h.f.id,detail:'La precisión GPS alcanza o supera la distancia al borde ('+fmt(h.border)+' m). Confirmación incierta.',feature:h.f};
   return {type:'inside',title:h.f.id,detail:'Dentro del polígono · a '+fmt(h.border)+' m de su límite.',feature:h.f};
 }
 if(near.length)return {type:'warning',title:'Próximo al límite',detail:'La incertidumbre GPS alcanza un área de voladura. No se confirma estar fuera.'};
 return {type:'outside',title:'Fuera de las áreas',detail:'No está contenido en los polígonos cargados.'};
}
function setGps(pos){app.gps=pos;const r=locateArea(pos);const col=r.type==='inside'?'green':r.type==='outside'?'amber':'red';
 $('live-card').style.borderColor=r.type==='inside'?'#4d9078':r.type==='warning'?'#b37e4a':'#506877';
 $('live-label').innerHTML='<span class="dot '+col+'"></span> '+(pos.sim?'GPS SIMULADO':'GPS REAL')+' · '+(r.type==='inside'?'ÁREA DETECTADA':r.type==='warning'?'UBICACIÓN INCIERTA':r.type==='ambiguous'?'SOLAPAMIENTO':'FUERA DE ÁREAS');
 $('live-title').textContent=r.title;$('live-detail').textContent=r.detail;
 $('live-accuracy').textContent='Precisión reportada: ±'+fmt(pos.accuracy)+' m · '+formatXY(pos);
 $('connect-pill').textContent=pos.sim?'● Simulación activa':'● GPS activo';$('connect-pill').className='status-pill '+(pos.sim?'sim':'on');
 if(r.feature){app.selected=r.feature;renderSelected();}draw();}
function demoPosition(mode){if(!sourceAreas().length){toast('Carga primero las voladuras de ejemplo.');return;}
 const f=sourceAreas()[0],b=G.bounds(f.points),x=(b.minX+b.maxX)/2,y=(b.minY+b.maxY)/2;
 const point=mode==='inside'?{x,y}:mode==='border'?{x:b.maxX-1,y}:{x:b.maxX+130,y:b.maxY+100};
 if(app.watchId!==null)stopGps();setGps({...point,accuracy:mode==='border'?6:4,sim:true});
 app.view.x=point.x;app.view.y=point.y;draw();}
function stopGps(){if(app.watchId!==null&&navigator.geolocation){navigator.geolocation.clearWatch(app.watchId);app.watchId=null;}$('gps-btn').textContent='◎   Activar GPS real';updateQuickGps();}
function startGps(){if(app.watchId!==null){stopGps();toast('Seguimiento GPS detenido.');return;}
 if(!navigator.geolocation){toast('Tu navegador no dispone de geolocalización.');return;}
 if(!window.isSecureContext){toast('GPS requiere HTTPS o localhost. En un HTML local usa la simulación.');return;}
 $('gps-btn').textContent='Detener GPS';updateQuickGps();app.watchId=navigator.geolocation.watchPosition(p=>{
    const xy=G.wgsTo3116(p.coords.latitude,p.coords.longitude);
    setGps({...xy,accuracy:Math.max(0,p.coords.accuracy||100),sim:false});
  },error=>{stopGps();toast('GPS no disponible: '+(error.code===1?'permiso denegado':error.message));},
  {enableHighAccuracy:true,maximumAge:4000,timeout:17000});}
function renderSelected(){const f=app.selected;if(!f){$('selected-card').innerHTML='<span class="muted">Toca un polígono en el mapa para consultar sus datos.</span>';return;}
 const b=G.bounds(f.points),p=G.from3116((b.minX+b.maxX)/2,(b.minY+b.maxY)/2);
 const mid=G.fromInternal({x:(b.minX+b.maxX)/2,y:(b.minY+b.maxY)/2},app.displayCrs);
 $('selected-card').innerHTML=`<div class="sel-title">${safe(f.id)}</div><div class="sel-sub">Capa: ${safe(f.layer)} · ${safe(f.source)}</div><div class="sel-grid"><div><small>Superficie horizontal</small><b>${fmt(f.area)} m²</b></div><div><small>Perímetro</small><b>${fmt(f.perimeter)} m</b></div><div><small>${app.displayCrs==='wgs84'?'Longitud':'Este'}</small><b>${fmtCoord(mid.x)}</b></div><div><small>${app.displayCrs==='wgs84'?'Latitud':'Norte'}</small><b>${fmtCoord(mid.y)}</b></div></div><div class="sel-sub" style="margin-top:14px">Referencia aproximada: ${p.lat.toFixed(6)}°, ${p.lon.toFixed(6)}° · Z original sin convertir</div>`;
}
function renderSourceLayerFilters(){
 const all=allAreas();
 const sources=[...new Map(all.map(f=>[f.source,{name:f.source,count:all.filter(a=>a.source===f.source).length,official:app.official.areas.some(a=>a.source===f.source)}])).values()];
 $('filter-sources').innerHTML=sources.length?sources.map(src=>`<label class="filter-row"><input type="checkbox" data-filter-source="${safe(src.name)}" ${app.hiddenSources.has(src.name)?'':'checked'}/><span><b>${safe(src.name)}</b><small>${src.count} área(s)</small></span></label>`).join(''):'<div class="no-results">Sin archivos cargados.</div>';
 const layers=[...new Map(all.map(f=>[f.layer,{name:f.layer,count:all.filter(a=>a.layer===f.layer).length}])).values()];
 $('filter-layers').innerHTML=layers.length?layers.map(layer=>`<label class="filter-row"><input type="checkbox" data-filter-layer="${safe(layer.name)}" ${app.hiddenLayers.has(layer.name)?'':'checked'}/><span><b>${safe(layer.name)}</b><small>${layer.count} área(s)</small></span></label>`).join(''):'<div class="no-results">Sin capas cargadas.</div>';
 $('view-mode').value=app.viewMode;
}
function renderLists(){const areas=allAreas(), visible=sourceAreas();$('area-count').textContent=visible.length+' área'+(visible.length===1?'':'s')+' visibles en '+new Set(areas.map(f=>f.source)).size+' archivos';
 const filter=$('search').value.toLowerCase().trim();const shown=visible.filter(f=>(f.id+' '+f.layer+' '+f.source).toLowerCase().includes(filter));
 $('area-list').innerHTML=shown.length?shown.map((f,i)=>{const index=allAreas().indexOf(f);return `<button class="area-row ${app.selected===f?'selected':''}" data-feature-index="${index}" type="button"><span class="swatch" style="background:${colors[index%colors.length]}"></span><span class="area-row-main"><strong>${safe(f.id)}</strong><small>${safe(f.source)} · Capa ${safe(f.layer)} · ${fmt(f.area)} m²</small></span><span class="area-row-arrow">›</span></button>`;}).join(''):'<div class="no-results">No hay polígonos que coincidan con la búsqueda.</div>';
 $('official-source').innerHTML=app.official.areas.length?'<b>Archivos compartidos desde GitHub</b><small>'+app.official.areas.length+' áreas cargadas</small>':'Sin archivos compartidos en GitHub.';
 $('source-list').innerHTML=app.sources.length?app.sources.map((s,i)=>`<div class="file-row"><span><b>${safe(s.name)}</b><small>${s.areas.length} áreas · ${[...new Set(s.areas.map(a=>a.layer))].length} capa(s)</small></span><span style="display:flex;gap:4px"><button type="button" class="mini-del" data-visibility="${safe(s.name)}">${app.hiddenSources.has(s.name)?'Mostrar':'Ocultar'}</button><button type="button" class="mini-del" data-remove="${i}">Quitar</button></span></div>`).join(''):'<div class="no-results">Sin archivos.</div>';
 renderSourceLayerFilters();
 draw();}
function selectFeature(f,center=true){app.selected=f;renderSelected();renderLists();if(center)centerOn(f);else draw();}
function setTab(tab){app.activeTab=tab;document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
 document.querySelectorAll('.panel').forEach(p=>p.classList.toggle('active',p.id==='panel-'+tab));
 $('sidebar').classList.toggle('mobile-open',tab!=='mapa');resize();}
// IndexedDB: datos únicamente en el dispositivo del operador.
const storage={
 async db(){return await new Promise((resolve,reject)=>{if(!('indexedDB' in window))return reject(Error('IndexedDB no disponible'));
   const req=indexedDB.open('blastmap-web-3116',1);req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains('sources'))db.createObjectStore('sources',{keyPath:'name'});};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});},
 async all(){const db=await this.db();return new Promise((resolve,reject)=>{const tx=db.transaction('sources','readonly'),req=tx.objectStore('sources').getAll();req.onsuccess=()=>{db.close();resolve(req.result);};req.onerror=()=>{db.close();reject(req.error);};});},
 async save(src){const db=await this.db();return new Promise((resolve,reject)=>{const tx=db.transaction('sources','readwrite');tx.objectStore('sources').put(src);tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>{db.close();reject(tx.error);};});},
 async remove(name){const db=await this.db();return new Promise((resolve,reject)=>{const tx=db.transaction('sources','readwrite');tx.objectStore('sources').delete(name);tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>{db.close();reject(tx.error);};});},
 async clear(){const db=await this.db();return new Promise((resolve,reject)=>{const tx=db.transaction('sources','readwrite');tx.objectStore('sources').clear();tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>{db.close();reject(tx.error);};});},
};
async function addSource(src){const idx=app.sources.findIndex(s=>s.name===src.name);if(idx>=0)app.sources.splice(idx,1);
 app.sources.push(src);app.selected=null;renderSelected();renderLists();fitFeatures();
 try{await storage.save(src);}catch(e){toast('Importado, pero no se pudo guardar permanentemente: '+e.message);}}
async function importFiles(files){const list=[...(files||[])].filter(Boolean);if(!list.length)return;setTab('importar');let totalAreas=0,totalFiles=0,messages=[];for(const file of list){$('import-result').textContent='Leyendo '+file.name+'…';try{const crs=$('import-crs').value;const result=await VECTOR.parseFile(file,crs);if(!result.areas.length){messages.push(file.name+': sin polígonos compatibles');continue;}await addSource({name:file.name,areas:result.areas,importedAt:new Date().toISOString(),importCrs:file.name.toLowerCase().endsWith('.dxf')?crs:'wgs84'});totalAreas+=result.areas.length;totalFiles++;messages.push(file.name+': '+result.areas.length+' polígonos en '+result.layers.length+' capa(s)');}catch(e){messages.push(file.name+': ERROR · '+e.message);}}$('import-result').textContent=(totalFiles?('Importados '+totalAreas+' polígonos desde '+totalFiles+' archivo(s).\n\n'):'Sin archivos importados.\n\n')+messages.join('\n');if(totalAreas)toast('Importación completada: '+totalAreas+' áreas en '+totalFiles+' archivo(s).');}
async function removeSource(index){const src=app.sources[index];if(!src)return;
 if(!confirm('¿Quitar '+src.name+' del dispositivo?'))return;
 app.hiddenSources.delete(src.name); app.sources.splice(index,1);app.selected=null;app.gps=null;renderSelected();renderLists();fitFeatures();
 try{await storage.remove(src.name);}catch(e){toast('No se pudo actualizar almacenamiento: '+e.message);}}
function sampleSource(){return {name:demoSource,areas:JSON.parse(JSON.stringify(sample)),importedAt:new Date().toISOString()};}
async function loadExample(){await addSource(sampleSource());$('import-result').textContent='Demostración cargada: 3 polígonos ficticios. No corresponden a una operación real.';toast('Tres voladuras de ejemplo cargadas.');}
async function importFile(file){return importFiles(file?[file]:[]);}
function download(name,content,mime){const url=URL.createObjectURL(new Blob([content],{type:mime}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),4000);}
async function restoreJSON(file){if(!file||file.size>18*1024*1024)return toast('Respaldo inválido o demasiado grande');
 try{const payload=JSON.parse(await file.text());if(payload.type!=='BlastMapBackup' || payload.epsg!==3116||!Array.isArray(payload.sources))throw Error('El archivo no corresponde a BlastMap EPSG:3116');
   let n=0;for(const src of payload.sources){if(!src.name||!Array.isArray(src.areas)||src.areas.length>1500)throw Error('Datos de respaldo no válidos');
     const clean=[];for(const a of src.areas){if(!Array.isArray(a.points)||a.points.length<3||a.points.length>120000||a.points.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))throw Error('Geometría inválida');
       const g={...a,source:src.name,area:G.area(a.points),perimeter:G.perimeter(a.points)};
       clean.push(g);}await addSource({name:src.name,areas:clean,importedAt:new Date().toISOString()});n+=clean.length;}
   toast('Respaldo restaurado: '+n+' áreas');setTab('voladuras');
 }catch(e){toast('No se pudo restaurar: '+e.message);}}
// Eventos en el mapa (ratón, táctil, gestos de arrastre y pellizco).
function pointerXY(e){const r=c.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};}
c.addEventListener('pointerdown',e=>{if(e.button!==0&&e.pointerType==='mouse')return;c.setPointerCapture(e.pointerId);const p=pointerXY(e);
 app.pointers.set(e.pointerId,{...p,originX:p.x,originY:p.y});app.dragged=false;
 if(app.pointers.size===2){const a=[...app.pointers.values()];app.pinchDist=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);app.dragged=true;}
 c.classList.add('dragging');});
c.addEventListener('pointermove',e=>{const p=pointerXY(e);const pos=world(p.x,p.y);$('coord-readout').textContent=formatXY(pos);
 const old=app.pointers.get(e.pointerId);if(!old)return;
 if(app.pointers.size===2){old.x=p.x;old.y=p.y;const arr=[...app.pointers.values()];const dist=Math.hypot(arr[0].x-arr[1].x,arr[0].y-arr[1].y);
  const mid={x:(arr[0].x+arr[1].x)/2,y:(arr[0].y+arr[1].y)/2};if(app.pinchDist>0)zoomAt(mid.x,mid.y,dist/app.pinchDist);app.pinchDist=dist;app.dragged=true;
 }else{const dx=p.x-old.x,dy=p.y-old.y;if(Math.hypot(p.x-old.originX,p.y-old.originY)>5)app.dragged=true;
   if(app.dragged){app.view.x-=dx/app.view.scale;app.view.y+=dy/app.view.scale;draw();}old.x=p.x;old.y=p.y;}
});
c.addEventListener('pointerup',e=>{const prev=app.pointers.get(e.pointerId);app.pointers.delete(e.pointerId);c.classList.toggle('dragging',app.pointers.size>0);if(!prev||app.dragged)return;
 const p=pointerXY(e),at=world(p.x,p.y);if(app.measure){if(app.measurePoints.length>=2)app.measurePoints=[];app.measurePoints.push(at);updateMeasurement();draw();return;}
 const list=sourceAreas();for(let i=list.length-1;i>=0;i--)if(G.pointInPolygon(at,list[i].points)){selectFeature(list[i],false);if(window.matchMedia('(min-width:701px)').matches)setTab('mapa');toast('Seleccionada: '+list[i].id);return;}
});
c.addEventListener('pointercancel',e=>{app.pointers.delete(e.pointerId);c.classList.toggle('dragging',app.pointers.size>0);});
c.addEventListener('wheel',e=>{e.preventDefault();const p=pointerXY(e);zoomAt(p.x,p.y,e.deltaY<0?1.13:.885);},{passive:false});
function updateMeasurement(){$('measure-banner').classList.toggle('hidden',!app.measure);
 const a=app.measurePoints;if(a.length===2){$('measure-text').textContent='Distancia horizontal: '+fmt(Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y))+' m';}
 else $('measure-text').textContent=a.length===1?'Selecciona el segundo punto':'Toca dos puntos sobre el mapa';}
function toggleMeasure(){app.measure=!app.measure;app.measurePoints=[];$('measure-btn').classList.toggle('active',app.measure);c.classList.toggle('measuring',app.measure);updateMeasurement();draw();}
// Archivos compartidos gestionados desde GitHub; archivos privados importados localmente.
// El navegador no puede cambiar el servidor; solamente exporta el archivo de publicación.
function fmtCoord(n){return app.displayCrs==='wgs84'?Number(n).toFixed(7):fmt(n);}
function formatXY(p){const q=G.fromInternal(p,app.displayCrs);return (app.displayCrs==='wgs84'?'Lon ':'E ')+fmtCoord(q.x)+' · '+(app.displayCrs==='wgs84'?'Lat ':'N ')+fmtCoord(q.y);}
function refreshCRS(){
 $('crs-badge').textContent=G.crsLabels[app.displayCrs];
 if(!['magna_central','magna_bogota'].includes(app.displayCrs)){
   $('grid-toggle').checked=false;app.grid=false;$('grid-toggle').disabled=true;
 }else $('grid-toggle').disabled=false;
 if(app.gps)setGps(app.gps);
 renderSelected();draw();
}
function updateStatus(msg,ok){app.syncOk=ok;$('sync-status').textContent=msg;$('official-top').textContent=ok?'● Actualizado':'● Sin conexión';}
function checkedOfficial(data){
 if(!data||data.type!=='BlastMapOfficial'||data.schemaVersion!==1||!Array.isArray(data.areas)||data.areas.length>1500)throw Error('Archivo oficial con estructura incorrecta');
 let count=0;
 const areas=data.areas.map((f,i)=>{
   if(!f||!Array.isArray(f.points)||f.points.length<3||f.points.length>120000)throw Error('Polígono '+(i+1)+' inválido');
   count+=f.points.length;if(count>120000)throw Error('Demasiados vértices');
   if(f.points.some(p=>!p||!Number.isFinite(p.x)||!Number.isFinite(p.y)||Math.abs(p.x)>1e8||Math.abs(p.y)>1e8))throw Error('Coordenadas incorrectas');
   const a=G.area(f.points);
   if(!Number.isFinite(a)||a<.01||G.selfIntersection(f.points)===true)throw Error('Contorno inválido en '+(f.id||i));
   return {id:String(f.id||'VOL-'+(i+1)).slice(0,160),layer:String(f.layer||'AREA').slice(0,160),source:String(f.source||'OFICIAL').slice(0,160),type:String(f.type||'Oficial').slice(0,80),sourceCrs:String(f.sourceCrs||'magna_bogota'),points:f.points.map(p=>({x:p.x,y:p.y,z:Number.isFinite(p.z)?p.z:null})),area:a,perimeter:G.perimeter(f.points)};
 });
 return {version:String(data.version||data.publishedAt||'inicial').slice(0,80),publishedAt:data.publishedAt??null,areas,visible:app.official.visible};
}
let syncInProgress=false;
async function syncOfficial(silent=false){
 if(syncInProgress)return;syncInProgress=true;
 try{
  let data;
  const manifestResponse=await fetch('./voladuras-archivos.json?ts='+Date.now(),{cache:'no-store'});
  if(manifestResponse.ok){
   const manifest=await manifestResponse.json();
   if(!Array.isArray(manifest.files)||manifest.files.length>100)throw Error('Listado de DXF inválido');
   const all=[];
   for(const item of manifest.files){
    if(!item||typeof item.file!=='string'||!/^[\w .()áéíóúÁÉÍÓÚñÑ-]+\.dxf$/i.test(item.file))throw Error('Nombre DXF no admitido');
    const crs=item.crs||'magna_central';
    if(!G.crsLabels[crs])throw Error('Sistema de coordenadas desconocido en '+item.file);
    const url='./voladuras/'+encodeURIComponent(item.file);
    const res=await fetch(url,{cache:'no-store'});
    if(!res.ok)throw Error('No se pudo leer '+item.file+' (HTTP '+res.status+')');
    const bytes=await res.arrayBuffer();
    const file=new File([bytes],item.file,{type:'application/dxf'});
    const parsed=await VECTOR.parseFile(file,crs);
    if(!parsed.areas.length)throw Error('El archivo '+item.file+' no contiene áreas compatibles');
    all.push(...parsed.areas);
  }
   data=checkedOfficial({type:'BlastMapOfficial',schemaVersion:1,version:String(manifest.version||JSON.stringify(manifest.files)),publishedAt:manifest.publishedAt||null,areas:all});
  }else throw Error('No se encontró voladuras-archivos.json en GitHub');
  if(data.version!==app.official.version){
    const had=allAreas().length;app.official=data;app.selected=null;renderSelected();renderLists();if(!had)fitFeatures();
    try{await storage.save({name:'__BLASTMAP_OFICIAL_V3__',...app.official});}catch{}
    if(!silent)toast('Archivos de GitHub actualizados: '+data.areas.length);
  }
  updateStatus('GitHub: '+data.areas.length+' áreas compartidas.',true);
 }catch(err){
  updateStatus('Sin conexión con GitHub. '+(app.official.areas.length?'Se conserva copia local ('+app.official.areas.length+' áreas).':'Aún no hay copia guardada.')+' Detalle: '+err.message,false);
 }finally{syncInProgress=false;renderLists();}
}
function renderPublishSelection(){
 const container=$('publish-source-list');if(!container)return;
 const active=[...app.toPublish].filter(n=>app.sources.some(s=>s.name===n));app.toPublish=new Set(active);
 container.innerHTML=app.sources.length?app.sources.map(s=>`<label class="publish-row"><input type="checkbox" data-publish-name="${safe(s.name)}" ${app.toPublish.has(s.name)?'checked':''}/><span>${safe(s.name)}<small>${s.areas.length} áreas personales</small></span></label>`).join(''):'<span class="muted">Importa primero DXF, KML, KMZ o GeoJSON.</span>';
 const selected=app.sources.filter(s=>app.toPublish.has(s.name));
 const count=selected.reduce((n,s)=>n+s.areas.length,0);
 $('publish-preview').textContent=(selected.length?('Archivo(s) seleccionados: '+selected.map(s=>s.name).join(', ')+'. '):'')+count+' polígonos en '+selected.length+' archivo(s). El JSON descargado será el nuevo conjunto completo: sustituirá los '+app.official.areas.length+' polígonos oficiales anteriores cuando lo subas a GitHub.';
 $('master-publish').disabled=!count;
}
function publishOfficial(){
 const sources=app.sources.filter(s=>app.toPublish.has(s.name));const areas=sources.flatMap(s=>s.areas);
 if(!areas.length)return toast('Selecciona al menos un archivo importado.');
 if(!confirm('¿Preparar el archivo de '+areas.length+' voladuras? Cuando lo subas a GitHub REEMPLAZARÁ todo el conjunto oficial anterior.'))return;
 const payload={type:'BlastMapOfficial',schemaVersion:1,version:new Date().toISOString(),publishedAt:new Date().toISOString(),areas:areas.map(f=>({id:f.id,layer:f.layer,source:f.source,type:f.type||'',sourceCrs:f.sourceCrs||'magna_bogota',points:f.points}))};
 try{checkedOfficial(payload);}catch(e){return toast('No se pudo preparar el archivo: '+e.message);}
 download('voladuras-oficiales.json',JSON.stringify(payload,null,2),'application/json');
 toast('Archivo descargado. Ahora súbelo a GitHub / public para que todos lo vean.');
}
// Vincular controles
for(const b of document.querySelectorAll('[data-tab]'))b.addEventListener('click',()=>setTab(b.dataset.tab));
$('mobile-gps-actions').addEventListener('click',()=>{setTab('mapa');$('sidebar').classList.add('mobile-open');});
$('gps-btn').addEventListener('click',startGps);$('sim-inside').addEventListener('click',()=>demoPosition('inside'));
$('sim-border').addEventListener('click',()=>demoPosition('border'));$('sim-outside').addEventListener('click',()=>demoPosition('outside'));
function centerVisibleVoladuras(){const features=sourceAreas();if(!features.length)return toast('No hay voladuras visibles; activa capas o importa archivos.');if(googleMap&&$('basemap-mode').value==='google')googleFit();else fitFeatures(features);toast('Centradas '+features.length+' voladuras visibles.');}
$('fit-all-offline').addEventListener('click',centerVisibleVoladuras);
$('quick-fit').addEventListener('click',centerVisibleVoladuras);
$('quick-gps').addEventListener('click',()=>{startGps();updateQuickGps();});
$('quick-location').addEventListener('click',()=>{if(!app.gps){toast('Primero activa GPS');return;}if(googleMap && $('basemap-mode').value==='google'){googleMap.panTo(googleGeo(app.gps));googleMap.setZoom(Math.max(googleMap.getZoom(),17));}else{app.view.x=app.gps.x;app.view.y=app.gps.y;draw();}});
$('quick-measure').addEventListener('click',()=>{toggleMeasure();$('quick-measure').classList.toggle('active',app.measure);});
function updateQuickGps(){const b=$('quick-gps');b.querySelector('span').textContent=app.watchId===null?'Activar GPS':'Detener GPS';b.classList.toggle('active',app.watchId!==null);}

$('fit-btn').addEventListener('click',centerVisibleVoladuras);$('gps-center').addEventListener('click',()=>{if(!app.gps)return toast('Activa el GPS o usa una simulación primero.');app.view.x=app.gps.x;app.view.y=app.gps.y;draw();});
$('zoom-in').addEventListener('click',()=>zoomAt(canvasW/2,canvasH/2,1.3));$('zoom-out').addEventListener('click',()=>zoomAt(canvasW/2,canvasH/2,1/1.3));
$('measure-btn').addEventListener('click',toggleMeasure);$('measure-clear').addEventListener('click',()=>{app.measurePoints=[];updateMeasurement();draw();});
$('search').addEventListener('input',renderLists);$('area-list').addEventListener('click',e=>{const b=e.target.closest('[data-feature-index]');if(b){const f=allAreas()[Number(b.dataset.featureIndex)];if(f)selectFeature(f);setTab('mapa');}});
$('source-list').addEventListener('click',e=>{const v=e.target.closest('[data-visibility]');if(v){const name=v.dataset.visibility;if(name){app.hiddenSources.has(name)?app.hiddenSources.delete(name):app.hiddenSources.add(name);renderLists();}return;}const b=e.target.closest('[data-remove]');if(b)removeSource(Number(b.dataset.remove));});
$('filter-sources').addEventListener('change',e=>{const i=e.target.closest('[data-filter-source]');if(!i)return;const name=i.dataset.filterSource;i.checked?app.hiddenSources.delete(name):app.hiddenSources.add(name);renderLists();});
$('filter-layers').addEventListener('change',e=>{const i=e.target.closest('[data-filter-layer]');if(!i)return;const name=i.dataset.filterLayer;i.checked?app.hiddenLayers.delete(name):app.hiddenLayers.add(name);renderLists();});
$('view-mode').addEventListener('change',e=>{app.viewMode=e.target.value;renderLists();});
$('dxf-input').addEventListener('change',e=>{if(e.target.files?.length)importFiles(e.target.files);e.target.value='';});

// Google Maps oficial en modo satélite: polígonos vectoriales nativos, sin raspar mosaicos.
function googleGeo(p){const r=G.from3116(p.x,p.y);return {lat:r.lat,lng:r.lon};}
function googleFit(){if(!googleMap)return;const areas=sourceAreas();if(!areas.length)return;
 const bounds=new google.maps.LatLngBounds();for(const f of areas)for(const p of f.points)bounds.extend(googleGeo(p));googleMap.fitBounds(bounds,46);
}
function refreshGoogle(){if(!googleMap)return;
 const arr=sourceAreas(), signature=JSON.stringify(arr.map(f=>[f.id,f.points.length,f.points[0]?.x,f.points[0]?.y,app.selected===f]));
 if(signature!==googleDataSignature){googleDataSignature=signature;
  googleMap.data.forEach(f=>googleMap.data.remove(f));
  arr.forEach((f,i)=>{const feature=new google.maps.Data.Feature({id:String(i),properties:{name:f.id},geometry:new google.maps.Data.Polygon([f.points.map(googleGeo)])});googleMap.data.add(feature);});
  googleMap.data.setStyle(feature=>({fillColor:'#38a48c',fillOpacity:.3,strokeColor:'#06826c',strokeWeight:feature.getProperty('name')===app.selected?.id?4:2}));
 }
 if(app.gps){const pos=googleGeo(app.gps);if(!googleGps)googleGps=new google.maps.Marker({map:googleMap,title:'GPS BlastMap'});googleGps.setPosition(pos);}else if(googleGps)googleGps.setMap(null);
}
async function loadGoogle(){const key=$('google-key').value.trim();if(!key)throw Error('Primero introduce una clave de Google Maps JavaScript API.');
 if(googleLoadedKey&&googleLoadedKey!==key)throw Error('Para cambiar la clave de Google, vuelve a abrir la página.');
 if(!googleLoadedKey){await new Promise((resolve,reject)=>{
  const cb='blastmapGoogleReady';const script=document.createElement('script');window[cb]=()=>{delete window[cb];resolve();};
  script.onerror=()=>reject(Error('No se pudo cargar Google Maps. Revisa Internet y la clave.'));
  script.src='https://maps.googleapis.com/maps/api/js?key='+encodeURIComponent(key)+'&loading=async&callback='+cb;
  document.head.append(script);
 });googleLoadedKey=key;}
 if(!googleMap){googleMap=new google.maps.Map($('google-map'),{center:googleGeo(app.view),zoom:15,mapTypeId:'satellite',streetViewControl:false,fullscreenControl:false,mapTypeControl:true});
 googleMap.data.addListener('click',e=>{const idx=Number(e.feature.getId());const f=sourceAreas()[idx];if(f){selectFeature(f,false);toast('Seleccionada: '+f.id);}});
 googleMap.addListener('click',e=>{if(!app.measure)return;const r=G.wgsTo3116(e.latLng.lat(),e.latLng.lng());if(app.measurePoints.length>=2)app.measurePoints=[];app.measurePoints.push(r);updateMeasurement();});
 }
 $('basemap-mode').value='google';$('map-canvas').parentElement.classList.add('google-mode');refreshGoogle();googleFit();toast('Google Satélite activo.');
}
$('google-enable').addEventListener('click',async()=>{try{await loadGoogle();}catch(e){toast(e.message);$('basemap-mode').value='local';}});
$('basemap-mode').addEventListener('change',async e=>{if(e.target.value==='google'){try{await loadGoogle();}catch(err){toast(err.message);e.target.value='local';}}else{$('map-canvas').parentElement.classList.remove('google-mode');draw();}});
$('raster-load').addEventListener('click',async()=>{
 const files=[...$('raster-files').files], jpg=files.find(f=>/\.jpe?g$/i.test(f.name)), jgw=files.find(f=>/\.(jgw|jpgw|wld)$/i.test(f.name)), prj=files.find(f=>/\.prj$/i.test(f.name));
 if(!jpg||!jgw)return toast('Selecciona JPG y JGW. El PRJ es recomendado para validar la proyección.');
 if(jpg.size>50000)return toast('Archivo JGW demasiado grande.');
 if(jpg.size>80*1024*1024)return toast('JPG de más de 80 MB: reduce la imagen para la prueba móvil.');
 try{
  const nums=(await jgw.text()).trim().split(/\s+/).map(Number);
  if(nums.length!==6||nums.some(n=>!Number.isFinite(n)))throw Error('JGW inválido: se requieren 6 números.');
  const [A,D,B,E,C,F]=nums;
  if(Math.abs(A*E-B*D)<1e-14)throw Error('JGW sin escala válida.');
  const src=URL.createObjectURL(jpg);const img=new Image();
  try{await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error('No se pudo leer el JPG'));img.src=src;});}finally{URL.revokeObjectURL(src);}
  const crs=$('raster-crs').value;
  if(prj){const wkt=await prj.text();const name=wkt.toLowerCase();const hint=/9377|origen[ _]nacional|national[ _]origin/.test(name)?'magna_nacional':/3116|bogot[aá][ _]central|colombia[ _]bogota/.test(name)?'magna_central':null;
   if(hint&&crs!==hint)throw Error('El PRJ indica '+G.crsLabels[hint]+' pero seleccionaste '+G.crsLabels[crs]+'. Corrige el sistema antes de cargar.');
   if(!hint)toast('PRJ leído; comprueba manualmente el sistema de coordenadas seleccionado.');
  }
  // Validar esquinas antes de guardar imagen; evita fondos fuera de rango.
  for(const [col,row] of [[0,0],[img.width,0],[0,img.height],[img.width,img.height]])G.toInternal({x:A*col+B*row+C,y:D*col+E*row+F},crs);
  raster={img,A,D,B,E,C,F,crs};
  $('raster-show').checked=true;$('raster-status').textContent=jpg.name+' + '+jgw.name+(prj?' + '+prj.name:' (sin PRJ)')+' · '+img.width+' × '+img.height+' px · '+G.crsLabels[crs];draw();toast('Ortofoto cargada debajo de las voladuras.');
 }catch(e){toast('Error de ortofoto: '+e.message);}
});
$('raster-show').addEventListener('change',draw);
$('raster-opacity').addEventListener('input',draw);
$('raster-remove').addEventListener('click',()=>{raster=null;$('raster-files').value='';$('raster-status').textContent='Sin imagen de fondo cargada.';draw();});

const dz=$('dropzone');dz.addEventListener('dragover',e=>{e.preventDefault();dz.classList.add('dragover');});dz.addEventListener('dragleave',()=>dz.classList.remove('dragover'));dz.addEventListener('drop',e=>{e.preventDefault();dz.classList.remove('dragover');if(e.dataTransfer?.files?.length)importFiles(e.dataTransfer.files);});
$('display-crs').addEventListener('change',e=>{app.displayCrs=e.target.value;try{localStorage.setItem('blastmap_view_crs',app.displayCrs);}catch{}refreshCRS();});

$('sync-now').addEventListener('click',()=>syncOfficial());
// MASTER retirado: la publicación se gestiona únicamente en GitHub.
$('grid-toggle').addEventListener('change',e=>{app.grid=e.target.checked;draw();});$('labels-toggle').addEventListener('change',e=>{app.labels=e.target.checked;draw();});
$('export-btn').addEventListener('click',()=>{const obj={type:'BlastMapBackup',version:1,epsg:3116,createdAt:new Date().toISOString(),sources:app.sources};download('BlastMap_respaldo_3116.json',JSON.stringify(obj,null,2),'application/json');});
$('restore-input').addEventListener('change',e=>{restoreJSON(e.target.files?.[0]);e.target.value='';});
$('clear-btn').addEventListener('click',async()=>{if(!confirm('¿Eliminar los archivos importados en este dispositivo? Los archivos de GitHub permanecerán disponibles.'))return;
 const names=app.sources.map(s=>s.name);app.sources=[];app.hiddenSources.clear();app.hiddenLayers.clear();app.selected=null;app.gps=null;stopGps();renderSelected();renderLists();fitFeatures();try{for(const name of names)await storage.remove(name);}catch(e){toast('Error borrando almacenamiento: '+e.message);}});
window.addEventListener('resize',resize);window.addEventListener('keydown',e=>{if(e.key==='Escape'&&app.measure){toggleMeasure();}if(e.key==='+'||e.key==='=')zoomAt(canvasW/2,canvasH/2,1.25);if(e.key==='-')zoomAt(canvasW/2,canvasH/2,.8);});
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();app.installPrompt=e;$('install-btn').classList.remove('hidden');});
$('install-btn').addEventListener('click',async()=>{if(!app.installPrompt)return;app.installPrompt.prompt();await app.installPrompt.userChoice;app.installPrompt=null;$('install-btn').classList.add('hidden');});
async function init(){
 resize();
 try{
   const all=await storage.all();
   const cached=all.find(s=>s.name==='__BLASTMAP_OFICIAL_V3__');
   if(cached){app.official={...cached,visible:true};app.official.areas=cached.areas||[];}
   app.sources=all.filter(s=>!String(s.name).startsWith('__BLASTMAP_OFICIAL_'));
 }catch(err){toast('Almacenamiento local no disponible; los cambios podrían perderse.');}
 try{const display=localStorage.getItem('blastmap_view_crs');if(G.crsLabels[display])app.displayCrs=display;}catch{}
 if(app.displayCrs==='magna_bogota')app.displayCrs='magna_central';
 $('display-crs').value=app.displayCrs;refreshCRS();renderLists();fitFeatures();
 if('serviceWorker' in navigator&&window.isSecureContext&&location.protocol!=='file:')navigator.serviceWorker.register('./sw.js').catch(()=>{});
 syncOfficial();
 // Evita volver a descargar grandes geometrías si la pestaña está oculta.
 window.setInterval(()=>{if(!document.hidden)syncOfficial(true);},120000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)syncOfficial(true);});
}
// Interface para ensayos automatizados (solo lectura en el navegador).
globalThis.BlastMapTest={get areas(){return allAreas();},get official(){return app.official;},get gps(){return app.gps;},get selected(){return app.selected;},locateArea,simulate:demoPosition,parse:DXF.parse,transform:G.wgsTo3116,view:()=>({...app.view})};
init();
})();
