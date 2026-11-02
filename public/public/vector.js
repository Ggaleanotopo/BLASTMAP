/* Importador vectorial local BlastMap V0.2. Sin llamadas de red. */
(function(root){'use strict';
const G=root.BlastGeo;
const MAX_FILE=12*1024*1024,MAX_AREAS=1500,MAX_VERTICES=120000;
const str=v=>String(v??'').trim().slice(0,160);
function fromRing(ring,crs){
  if(!Array.isArray(ring)||ring.length<4)throw Error('Anillo incompleto (mínimo 4 coordenadas).');
  let arr=ring.map(a=>{
    if(!Array.isArray(a)||a.length<2)throw Error('Par de coordenadas incompleto');
    const x=Number(a[0]),y=Number(a[1]),z=a.length>2&&a[2]!==null?Number(a[2]):null;
    return G.toInternal({x,y,z:Number.isFinite(z)?z:null},crs);
  });
  if(arr.length>1&&Math.hypot(arr[0].x-arr.at(-1).x,arr[0].y-arr.at(-1).y)<.001)arr.pop();
  if(arr.length<3)throw Error('El contorno tiene menos de tres vértices distintos');
  if(arr.length>MAX_VERTICES)throw Error('Demasiados vértices en un polígono');
  if(G.area(arr)<.01)throw Error('Área nula o degenerada');
  if(G.selfIntersection(arr)===true)throw Error('Auto-intersección en el contorno');
  const ll=G.from3116(arr[0].x,arr[0].y);
  if(ll.lat< -5||ll.lat>15||ll.lon< -82||ll.lon> -66)throw Error('Coordenadas fuera de Colombia. Revisa el sistema original');
  return arr;
}
function normalize(name,items,warnings){
  const areas=[];let vertexCount=0;
  for(const it of items){
    if(areas.length>=MAX_AREAS)throw Error('Máximo 1500 polígonos por importación');
    try{
      const points=fromRing(it.ring,it.crs);
      vertexCount+=points.length;if(vertexCount>MAX_VERTICES)throw Error('Máximo 120.000 vértices en un archivo');
      const layer=str(it.layer||'AREA'),id=str(it.id||layer+' · '+(areas.length+1));
      areas.push({id,layer,handle:'',type:it.type,points,area:G.area(points),perimeter:G.perimeter(points),source:name,sourceCrs:it.crs});
    }catch(err){if(/Máximo/.test(err.message))throw err;warnings.push('Área omitida '+str(it.id)+': '+err.message);}
  }
  return {areas,warnings,layers:[...new Set(areas.map(a=>a.layer))]};
}
function parseGeoJSON(raw,name){
  const obj=JSON.parse(raw),warnings=[],items=[];
  const features=obj.type==='FeatureCollection'?obj.features:obj.type==='Feature'?[obj]:[{type:'Feature',geometry:obj,properties:{}}];
  if(!Array.isArray(features)||features.length>5000)throw Error('GeoJSON inválido o demasiado grande');
  let index=0;
  for(const f of features){index++;const g=f.geometry,p=f.properties||{},id=str(p.nombre||p.codigo||p.name||p.id||f.id||'AREA-'+index),layer=str(p.capa||p.layer||'GeoJSON');
    if(!g)continue;
    const polys=g.type==='Polygon'?[g.coordinates]:g.type==='MultiPolygon'?g.coordinates:[];
    if(!polys.length){warnings.push(id+': geometría no poligonal ignorada');continue;}
    for(let i=0;i<polys.length;i++){
      if(!Array.isArray(polys[i])||polys[i].length!==1){warnings.push(id+': polígonos con huecos no admitidos; geometría omitida');continue;}
      items.push({id:polys.length>1?id+'-'+(i+1):id,layer,ring:polys[i][0],crs:'wgs84',type:'GeoJSON'});
    }
  }
  return normalize(name,items,warnings);
}
const tag=(parent,name)=>Array.from(parent.getElementsByTagNameNS('*',name));
function parseKML(text,name){
  const doc=new DOMParser().parseFromString(text,'application/xml');
  if(doc.querySelector('parsererror'))throw Error('KML no es XML válido');
  const items=[],warnings=[];let i=0;
  for(const p of tag(doc,'Placemark')){
    const title=str(tag(p,'name')[0]?.textContent||'VOL-'+(++i));
    const polygons=tag(p,'Polygon');
    if(!polygons.length)continue;
    let polyIndex=0;
    for(const polygon of polygons){polyIndex++;
      if(tag(polygon,'innerBoundaryIs').length){warnings.push(title+': contiene huecos y se ha omitido');continue;}
      const outer=tag(polygon,'outerBoundaryIs')[0],coords=outer&&tag(outer,'coordinates')[0];
      if(!coords){warnings.push(title+': Polygon sin outerBoundaryIs');continue;}
      const ring=coords.textContent.trim().split(/\s+/).filter(Boolean).map(chunk=>chunk.split(',').map(Number));
      items.push({id:polygons.length===1?title:title+'-'+polyIndex,layer:'KML',ring,crs:'wgs84',type:'KML'});
    }
  }
  return normalize(name,items,warnings);
}
async function unzipKML(buffer){
  const bytes=new Uint8Array(buffer),v=new DataView(buffer);
  let eocd=-1;for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(v.getUint32(i,true)===0x06054b50){eocd=i;break;}
  if(eocd<0)throw Error('KMZ inválido: no se encontró el directorio ZIP');
  const n=v.getUint16(eocd+10,true),start=v.getUint32(eocd+16,true);
  if(n>250)throw Error('KMZ con demasiados archivos');
  const decoder=new TextDecoder(),found=[];let ptr=start;
  for(let i=0;i<n;i++){
    if(ptr+46>bytes.length||v.getUint32(ptr,true)!==0x02014b50)throw Error('Directorio ZIP dañado');
    const method=v.getUint16(ptr+10,true),csize=v.getUint32(ptr+20,true),usize=v.getUint32(ptr+24,true),len=v.getUint16(ptr+28,true),extra=v.getUint16(ptr+30,true),comment=v.getUint16(ptr+32,true),offset=v.getUint32(ptr+42,true);
    const filename=decoder.decode(bytes.subarray(ptr+46,ptr+46+len));ptr+=46+len+extra+comment;
    if(!filename.toLowerCase().endsWith('.kml'))continue;
    if(usize>30*1024*1024||csize>MAX_FILE)throw Error('Archivo KML del KMZ demasiado grande');
    if(offset+30>bytes.length||v.getUint32(offset,true)!==0x04034b50)throw Error('Entrada ZIP dañada');
    const dataAt=offset+30+v.getUint16(offset+26,true)+v.getUint16(offset+28,true);
    if(dataAt+csize>bytes.length)throw Error('Datos ZIP incompletos');
    const comp=bytes.subarray(dataAt,dataAt+csize);let out;
    if(method===0)out=comp;
    else if(method===8){
      if(typeof DecompressionStream==='undefined')throw Error('Este navegador no soporta descomprimir KMZ');
      const stream=new Blob([comp]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      const ab=await new Response(stream).arrayBuffer();out=new Uint8Array(ab);
    }else throw Error('Método de compresión KMZ no compatible');
    if(out.length>30*1024*1024||out.length!==usize)throw Error('Tamaño descomprimido inconsistente');
    found.push({name:filename,text:new TextDecoder().decode(out)});
  }
  if(!found.length)throw Error('El archivo KMZ no contiene KML');
  const primary=found.find(e=>/(^|\/)doc\.kml$/i.test(e.name))||found[0];
  return primary.text;
}
async function parseFile(file,crs='magna_bogota'){
  if(!file||file.size>MAX_FILE)throw Error('Archivo mayor de 12 MB o inválido');
  const ext=file.name.split('.').at(-1).toLowerCase();
  if(ext==='dxf'){
    const bytes=await file.arrayBuffer();let txt=new TextDecoder().decode(bytes);
    if(txt.includes('\ufffd'))txt=new TextDecoder('windows-1252').decode(bytes);
    return root.BlastDxf.parse(txt,file.name,crs);
  }
  if(ext==='kml')return parseKML(await file.text(),file.name);
  if(ext==='kmz')return parseKML(await unzipKML(await file.arrayBuffer()),file.name);
  if(['geojson','json'].includes(ext))return parseGeoJSON(await file.text(),file.name);
  throw Error('Formato no compatible. Usa DXF, KML, KMZ o GeoJSON');
}
root.BlastVector={parseFile,parseGeoJSON,parseKML,unzipKML};
})(globalThis);
