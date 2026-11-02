/* Lector conservador de DXF ASCII para contornos CAD cerrados: no inventa áreas. */
(function(root){'use strict';
 const G=root.BlastGeo || (typeof require!=='undefined'?require('./geo.js'):null);
 const LIMIT_VERTICES=120000, LIMIT_AREAS=1500;
 function pairs(text){const lines=text.replace(/\r\n?/g,'\n').split('\n');const out=[];
   for(let i=0;i+1<lines.length;i+=2){const code=Number(lines[i].trim());if(!Number.isInteger(code))throw Error('Estructura DXF ASCII inválida cerca de la línea '+(i+1));out.push({code,val:lines[i+1].trim()});}return out;}
 function first(raw,code,defaultValue=''){const it=raw.find(q=>q.code===code);return it?it.val:defaultValue;}
 function sampleArc(a,b,bulge){const theta=4*Math.atan(bulge||0), chord=Math.hypot(b.x-a.x,b.y-a.y);
   if(Math.abs(theta)<1e-10||chord<1e-7)return [b];
   const cx=(a.x+b.x)/2-(b.y-a.y)*(1-bulge*bulge)/(4*bulge);
   const cy=(a.y+b.y)/2+(b.x-a.x)*(1-bulge*bulge)/(4*bulge);
   const r=Math.hypot(a.x-cx,a.y-cy),start=Math.atan2(a.y-cy,a.x-cx);
   const n=Math.max(1,Math.min(180,Math.ceil(Math.abs(theta)/(Math.PI/36))));const pts=[];
   for(let j=1;j<=n;j++){const t=j/n;pts.push(j===n?{...b}:{x:cx+r*Math.cos(start+theta*t),y:cy+r*Math.sin(start+theta*t),z:a.z+(b.z-a.z)*t});}
   return pts;
 }
 function cleanAndClose(v,closed){
   if(v.length>1&&Math.hypot(v[0].x-v[v.length-1].x,v[0].y-v[v.length-1].y)<1e-5){v.pop();closed=true;}
   if(!closed||v.length<3)return null;
   const pts=[{x:v[0].x,y:v[0].y,z:v[0].z}];
   for(let i=0;i<v.length;i++){const cur=v[i],nxt=v[(i+1)%v.length],sect=sampleArc(cur,nxt,cur.bulge);
     if(i===v.length-1)sect.pop();pts.push(...sect);if(pts.length>LIMIT_VERTICES)throw Error('DXF excede el límite de vértices admitido');}
   const filtered=[];for(const p of pts)if(!filtered.length||Math.hypot(p.x-filtered[filtered.length-1].x,p.y-filtered[filtered.length-1].y)>1e-7)filtered.push(p);
   if(filtered.length>1&&Math.hypot(filtered[0].x-filtered.at(-1).x,filtered[0].y-filtered.at(-1).y)<1e-7)filtered.pop();
   if(filtered.length<3||G.area(filtered)<0.01)return null;
   return filtered;
 }
 function readLW(raw){let vertices=[],cur=null,flags=Number(first(raw,70,'0')),elev=Number(first(raw,38,'0'));
   for(const it of raw){if(it.code===10){cur={x:Number(it.val),y:NaN,z:elev,bulge:0};vertices.push(cur);}
     else if(cur&&it.code===20)cur.y=Number(it.val);
     else if(cur&&it.code===42)cur.bulge=Number(it.val);
   }
   if(vertices.some(v=>!Number.isFinite(v.x)||!Number.isFinite(v.y)))throw Error('Vértice DXF con coordenadas incompletas');
   return cleanAndClose(vertices,Boolean(flags&1));
 }
 function readPoly(header,parts){const flags=Number(first(header,70,'0'));
   if(flags&(16|64))return {unsupported:true}; // mallas y polyface
   const vertices=[];
   for(const {name,raw} of parts)if(name==='VERTEX'){
     const vFlags=Number(first(raw,70,'0'));if(vFlags&128)continue;
     vertices.push({x:Number(first(raw,10,'NaN')),y:Number(first(raw,20,'NaN')),z:Number(first(raw,30,'0')),bulge:Number(first(raw,42,'0'))});
   }
   if(vertices.some(v=>!Number.isFinite(v.x)||!Number.isFinite(v.y)))throw Error('POLYLINE con vértice incompleto');
   return {points:cleanAndClose(vertices,Boolean(flags&1))};
 }
 function parse(text,filename='voladuras.dxf',sourceCrs='magna_bogota'){
   if(text.startsWith('AutoCAD Binary DXF'))throw Error('DXF binario no compatible; exporta como DXF ASCII desde CAD');
   const source=pairs(text),warnings=[],areas=[],texts=[],counts={},layers=new Set();let inEntities=false,unit=null,used=0,opened=0;
   // HEADER: detect INSUNITS cuando esté disponible. 6=metros, 0=sin unidad declarada.
   for(let i=0;i<source.length-1;i++)if(source[i].code===9&&source[i].val==='$INSUNITS'){
     const item=source.slice(i+1,i+5).find(q=>q.code===70);if(item)unit=Number(item.val);
   }
   if(unit!==null&&unit!==0&&unit!==6)warnings.push('El DXF declara INSUNITS='+unit+' (no metros). Se mantuvo la geometría, pero debes confirmar sus unidades antes de usar el GPS.');
   function issue(name){counts[name]=(counts[name]||0)+1;}
   function add(points,header,type){if(!points){opened++;return;}
     points=points.map(p=>G.toInternal(p,sourceCrs));
     if(areas.length>=LIMIT_AREAS)throw Error('Límite de 1500 polígonos por archivo');
     used+=points.length;if(used>LIMIT_VERTICES)throw Error('Límite total de 120.000 vértices');
     const invalid=G.selfIntersection(points);
     if(invalid===null)issue('geometría compleja sin comprobación exhaustiva de cruces');
     if(invalid){issue('auto-intersección');return;}
     const bb=G.bounds(points),center={x:(bb.minX+bb.maxX)/2,y:(bb.minY+bb.maxY)/2};
     const latlon=G.from3116(center.x,center.y);
     if(!Number.isFinite(latlon.lat)||latlon.lat< -5||latlon.lat>15||latlon.lon< -82||latlon.lon> -66){issue('coordenadas fuera del territorio colombiano probable');return;}
     let layer=first(header,8,'SIN_CAPA'),handle=first(header,5,'');
     layers.add(layer);
     const repeat=areas.filter(a=>a.layer===layer).length;
     const id=(repeat===0&&layer.toUpperCase().includes('VOL'))?layer:layer+' · '+String(repeat+1).padStart(3,'0');
     areas.push({id,layer,handle,type,points,area:G.area(points),perimeter:G.perimeter(points),source:filename,sourceCrs});
   }
   for(let i=0;i<source.length;i++){
     const p=source[i];if(p.code===0&&p.val==='SECTION'&&source[i+1]?.code===2){inEntities=source[i+1].val==='ENTITIES';i++;continue;}
     if(p.code===0&&p.val==='ENDSEC'){inEntities=false;continue;}
     if(!inEntities||p.code!==0)continue;
     const type=p.val;if(type==='EOF'||type==='ENDSEC')continue;
     const raw=[];let j=i+1;while(j<source.length&&source[j].code!==0)raw.push(source[j++]);
     if(type==='TEXT'||type==='MTEXT'){const name=raw.filter(q=>q.code===1||q.code===3).map(q=>q.val).join('').trim();const x=Number(first(raw,10,'NaN')),y=Number(first(raw,20,'NaN'));if(name&&Number.isFinite(x)&&Number.isFinite(y)&&/^(?:V[-_ ]?\d{3,}|[A-Z]{2,}[-_][A-Z0-9_-]{2,})$/i.test(name)){try{texts.push({name,point:G.toInternal({x,y},sourceCrs)});}catch{}}i=j-1;continue;}
     if(type==='LWPOLYLINE'){add(readLW(raw),raw,type);i=j-1;continue;}
     if(type==='POLYLINE'){
       const parts=[];let k=j;
       while(k<source.length&&source[k].code===0&&source[k].val!=='SEQEND'&&source[k].val!=='ENDSEC'){
         let start=source[k].val,r=[],next=k+1;while(next<source.length&&source[next].code!==0)r.push(source[next++]);
         parts.push({name:start,raw:r});k=next;
       }
       if(k<source.length&&source[k].val==='SEQEND'){
         k++;while(k<source.length&&source[k].code!==0)k++;
       }
       const res=readPoly(raw,parts);if(res.unsupported)issue('mallas POLYLINE no compatibles');else add(res.points,raw,type);
       i=k-1;continue;
     }
     if(['HATCH','INSERT','SPLINE','CIRCLE','ARC','REGION','3DFACE','MPOLYGON','ELLIPSE'].includes(type))issue(type);
     i=j-1;
   }
   // Vincular cada nombre CAD con el polígono que contiene su punto de inserción.
   // Evitar asignar textos de levantamientos numerados o inventar códigos.
   const usedTexts=new Set();let identified=0;
   for(const area of areas){const hits=texts.map((t,idx)=>({...t,idx})).filter(t=>!usedTexts.has(t.idx)&&G.pointInPolygon(t.point,area.points));
     if(hits.length===1){area.id=hits[0].name;usedTexts.add(hits[0].idx);identified++;}
     else if(hits.length>1){warnings.push('Polígono '+area.id+': varios nombres internos; se conserva identificador provisional para revisión.');}
   }
   if(texts.length)warnings.push('Nombres CAD reconocidos: '+identified+' de '+areas.length+' polígonos; los demás conservan identificador provisional.');
   if(opened)warnings.push(opened+' polilínea(s) abiertas o degeneradas omitidas: no se convierten en áreas.');
   for(const [k,n]of Object.entries(counts))warnings.push(n+' entidad(es) omitidas: '+k+'.');
   if(!areas.length)warnings.unshift('No se detectaron polígonos cerrados compatibles en ENTITIES.');
   return {areas,warnings,units:unit,closed:areas.length,layers:[...layers]};
 }
 const api={parse,sampleArc};root.BlastDxf=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
