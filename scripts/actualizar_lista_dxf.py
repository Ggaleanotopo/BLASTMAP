#!/usr/bin/env python3
"""Lista DXF de public/voladuras conservando CRS ya elegido por nombre."""
from pathlib import Path
import json, hashlib, datetime
base=Path(__file__).resolve().parents[1]
folder=base/'public'/'voladuras'
target=base/'public'/'voladuras-archivos.json'
old={}
if target.exists():
    try:
        for a in json.loads(target.read_text(encoding='utf-8')).get('files',[]):
            if isinstance(a,dict): old[a.get('file')]=a.get('crs','magna_central')
    except (ValueError,OSError): pass
files=sorted((x for x in folder.iterdir() if x.is_file() and x.suffix.lower()=='.dxf'),key=lambda f:f.name.lower())
if len(files)>100: raise RuntimeError('Máximo 100 DXF')
entries=[]
for f in files:
    if not all(c.isalnum() or c in ' _-.()áéíóúÁÉÍÓÚñÑ' for c in f.name):
        raise RuntimeError('Nombre de archivo no válido: '+f.name)
    entries.append({'file':f.name,'crs':old.get(f.name,'magna_central')})
# estable si el contenido no cambió, cambia si DXF cambió aunque el nombre sea igual
content=''.join(f.name+hashlib.sha256(f.read_bytes()).hexdigest()+str(entries[i]['crs']) for i,f in enumerate(files))
version=hashlib.sha256(content.encode()).hexdigest()[:16]
previous=json.loads(target.read_text(encoding='utf-8')) if target.exists() else {}
published=previous.get('publishedAt') if previous.get('version')==version else datetime.datetime.now(datetime.timezone.utc).isoformat()
result={'version':version,'publishedAt':published,'files':entries}
target.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('DXF encontrados:',len(entries))
