/* BlastMap — MAGNA-SIRGAS / Colombia Bogotá EPSG:3116 (GRS80)
   X=Este, Y=Norte en los archivos CAD. Sin transformación vertical. */
(function (root) {
  'use strict';
  const a = 6378137, f = 1 / 298.257222101, e2 = f * (2 - f), ep2 = e2 / (1 - e2);
  const lat0 = 4.59620041666667 * Math.PI / 180;
  const lon0 = -74.0775079166667 * Math.PI / 180;
  const E0 = 1000000, N0 = 1000000, k0 = 1;
  const meridian = p => a * ((1-e2/4-3*e2**2/64-5*e2**3/256)*p
    -(3*e2/8+3*e2**2/32+45*e2**3/1024)*Math.sin(2*p)
    +(15*e2**2/256+45*e2**3/1024)*Math.sin(4*p)-(35*e2**3/3072)*Math.sin(6*p));
  const M0 = meridian(lat0);
  function wgsTo3116(latDeg, lonDeg) {
    const p = latDeg*Math.PI/180, l = lonDeg*Math.PI/180;
    if (!Number.isFinite(p) || !Number.isFinite(l) || Math.abs(latDeg)>90) throw Error('Latitud o longitud inválida');
    const s=Math.sin(p), c=Math.cos(p), t=Math.tan(p), nu=a/Math.sqrt(1-e2*s*s);
    const T=t*t, C=ep2*c*c, A=c*(l-lon0);
    const x=E0 + k0*nu*(A+(1-T+C)*A**3/6+(5-18*T+T*T+72*C-58*ep2)*A**5/120);
    const y=N0 + k0*(meridian(p)-M0+nu*t*(A*A/2+(5-T+9*C+4*C*C)*A**4/24+(61-58*T+T*T+600*C-330*ep2)*A**6/720));
    return {x,y};
  }
  function from3116(x,y){
    if (!Number.isFinite(x)||!Number.isFinite(y)) throw Error('Coordenadas inválidas');
    const M=M0+(y-N0)/k0;
    const mu=M/(a*(1-e2/4-3*e2**2/64-5*e2**3/256));
    const e1=(1-Math.sqrt(1-e2))/(1+Math.sqrt(1-e2));
    const p1=mu+(3*e1/2-27*e1**3/32)*Math.sin(2*mu)+(21*e1**2/16-55*e1**4/32)*Math.sin(4*mu)
      +(151*e1**3/96)*Math.sin(6*mu)+(1097*e1**4/512)*Math.sin(8*mu);
    const s=Math.sin(p1), c=Math.cos(p1), t=Math.tan(p1);
    const nu=a/Math.sqrt(1-e2*s*s), R=a*(1-e2)/Math.pow(1-e2*s*s,1.5);
    const T=t*t, C=ep2*c*c, D=(x-E0)/(nu*k0);
    const lat=p1-(nu*t/R)*(D*D/2-(5+3*T+10*C-4*C*C-9*ep2)*D**4/24
      +(61+90*T+298*C+45*T*T-252*ep2-3*C*C)*D**6/720);
    const lon=lon0+(D-(1+2*T+C)*D**3/6+(5-2*C+28*T-3*C*C+8*ep2+24*T*T)*D**5/120)/c;
    return {lat:lat*180/Math.PI,lon:lon*180/Math.PI};
  }
  function area(points){let s=0;const o=points[0];for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];s+=(a.x-o.x)*(b.y-o.y)-(b.x-o.x)*(a.y-o.y);}return Math.abs(s)/2;}
  function perimeter(points){let d=0;for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];d+=Math.hypot(a.x-b.x,a.y-b.y);}return d;}
  function bounds(points){let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;for(const p of points){minX=Math.min(minX,p.x);maxX=Math.max(maxX,p.x);minY=Math.min(minY,p.y);maxY=Math.max(maxY,p.y);}return {minX,maxX,minY,maxY};}
  function distanceSegment(p,a,b){const dx=b.x-a.x,dy=b.y-a.y;let t=dx*dx+dy*dy===0?0:((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy);t=Math.max(0,Math.min(1,t));return Math.hypot(p.x-(a.x+t*dx),p.y-(a.y+t*dy));}
  function distanceBorder(p,points){let d=Infinity;for(let i=0;i<points.length;i++)d=Math.min(d,distanceSegment(p,points[i],points[(i+1)%points.length]));return d;}
  function pointInPolygon(p,poly){let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){
    const a=poly[i],b=poly[j];if(distanceSegment(p,a,b)<1e-7)return true;
    if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;
  }return inside;}
  function segmentsIntersect(a,b,c,d){
    const cross=(p,q,r)=>(q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x);
    const u=cross(a,b,c),v=cross(a,b,d),w=cross(c,d,a),z=cross(c,d,b);
    return (u*v<0 && w*z<0);
  }
  function selfIntersection(p){if(p.length>600)return null;for(let i=0;i<p.length;i++)for(let j=i+2;j<p.length;j++){
    if(i===0 && j===p.length-1)continue;
    if(segmentsIntersect(p[i],p[(i+1)%p.length],p[j],p[(j+1)%p.length]))return true;
  }return false;}
  // EPSG:9377: MAGNA-SIRGAS 2018 / Origen Nacional (IGAC).
  // X=Este en metros, Y=Norte en metros; sin transformación vertical.
  // Proyección TM: lat0=4°, lon0=-73°, k0=0.9992, E0=5.000.000, N0=2.000.000.
  const national={lat0:4*Math.PI/180,lon0:-73*Math.PI/180,e0:5000000,n0:2000000,k:0.9992};
  const nationalM0=meridian(national.lat0);
  function wgsTo9377(latDeg,lonDeg){
    const p=latDeg*Math.PI/180,l=lonDeg*Math.PI/180;
    if(!Number.isFinite(p)||!Number.isFinite(l)||Math.abs(latDeg)>90||Math.abs(lonDeg)>180)throw Error('Latitud o longitud inválida');
    const s=Math.sin(p),c=Math.cos(p),t=Math.tan(p),nu=a/Math.sqrt(1-e2*s*s);
    const T=t*t,C=ep2*c*c,A=c*(l-national.lon0),k=national.k;
    const x=national.e0+k*nu*(A+(1-T+C)*A**3/6+(5-18*T+T*T+72*C-58*ep2)*A**5/120);
    const y=national.n0+k*(meridian(p)-nationalM0+nu*t*(A*A/2+(5-T+9*C+4*C*C)*A**4/24+(61-58*T+T*T+600*C-330*ep2)*A**6/720));
    return {x,y};
  }
  function from9377(x,y){
    if(!Number.isFinite(x)||!Number.isFinite(y))throw Error('Coordenadas inválidas');
    const M=nationalM0+(y-national.n0)/national.k;
    const mu=M/(a*(1-e2/4-3*e2**2/64-5*e2**3/256));
    const e1=(1-Math.sqrt(1-e2))/(1+Math.sqrt(1-e2));
    const p1=mu+(3*e1/2-27*e1**3/32)*Math.sin(2*mu)+(21*e1**2/16-55*e1**4/32)*Math.sin(4*mu)
      +(151*e1**3/96)*Math.sin(6*mu)+(1097*e1**4/512)*Math.sin(8*mu);
    const s=Math.sin(p1),c=Math.cos(p1),t=Math.tan(p1),nu=a/Math.sqrt(1-e2*s*s);
    const R=a*(1-e2)/Math.pow(1-e2*s*s,1.5),T=t*t,C=ep2*c*c,D=(x-national.e0)/(nu*national.k);
    const lat=p1-(nu*t/R)*(D*D/2-(5+3*T+10*C-4*C*C-9*ep2)*D**4/24
      +(61+90*T+298*C+45*T*T-252*ep2-3*C*C)*D**6/720);
    const lon=national.lon0+(D-(1+2*T+C)*D**3/6+(5-2*C+28*T-3*C*C+8*ep2+24*T*T)*D**5/120)/c;
    return {lat:lat*180/Math.PI,lon:lon*180/Math.PI};
  }
  // El almacenamiento histórico de BlastMap permanece en coordenadas internas
  // MAGNA Central (EPSG:3116); nunca reinterpretar como Origen Nacional.
  // Clave magna_bogota solo para compatibilidad con datos previos; no se muestra.
  const shifts={wgs84:null,magna_central:0,magna_bogota:0,magna_nacional:null,magna_oeste:-3,magna_oeste_oeste:-6,magna_este:3,magna_este_este:6};
  const crsLabels={wgs84:'WGS84 (latitud / longitud)',magna_central:'MAGNA Central',magna_bogota:'MAGNA Central',magna_nacional:'MAGNA Origen Nacional',magna_oeste:'MAGNA Oeste',magna_oeste_oeste:'MAGNA Oeste-Oeste',magna_este:'MAGNA Este',magna_este_este:'MAGNA Este-Este'};
  function checkCRS(crs){if(!Object.hasOwn(shifts,crs))throw Error('Sistema de coordenadas no compatible: '+crs);}
  function toInternal(p,crs='magna_central'){
    checkCRS(crs);
    if(!Number.isFinite(p.x)||!Number.isFinite(p.y))throw Error('Coordenada no numérica');
    if(crs==='wgs84'){
      if(Math.abs(p.y)>90||Math.abs(p.x)>180)throw Error('Longitud / latitud WGS84 inválida');
      return {...wgsTo3116(p.y,p.x),z:p.z??null};
    }
    if(crs==='magna_nacional'){
      const ll=from9377(p.x,p.y);
      return {...wgsTo3116(ll.lat,ll.lon),z:p.z??null};
    }
    if(shifts[crs]===0)return {...p};
    const ll=from3116(p.x,p.y);
    return {...wgsTo3116(ll.lat,ll.lon+shifts[crs]),z:p.z??null};
  }
  function fromInternal(p,crs='magna_central'){
    checkCRS(crs);if(shifts[crs]===0)return {...p};
    const ll=from3116(p.x,p.y);
    if(crs==='wgs84')return {x:ll.lon,y:ll.lat,z:p.z??null};
    if(crs==='magna_nacional')return {...wgsTo9377(ll.lat,ll.lon),z:p.z??null};
    return {...wgsTo3116(ll.lat,ll.lon-shifts[crs]),z:p.z??null};
  }
  const api={wgsTo3116,from3116,wgsTo9377,from9377,toInternal,fromInternal,crsLabels,area,perimeter,bounds,distanceSegment,distanceBorder,pointInPolygon,selfIntersection};
  root.BlastGeo=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
