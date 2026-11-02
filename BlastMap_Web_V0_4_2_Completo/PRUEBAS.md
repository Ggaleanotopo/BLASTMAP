# BlastMap Web V0.3 — verificaciones

- Sintaxis JavaScript: `node --check` de `app.js`, `geo.js`, `dxf.js`, `vector.js`, `sw.js` (realizado en entorno de desarrollo; no hace falta Node en equipos corporativos).
- JSON oficial de arranque con `type: BlastMapOfficial`, `schemaVersion: 1`, `version: inicial` y cero áreas.
- No queda control de contraseña MASTER en la interfaz ni llamadas al backend anterior.
- Lectura del mapa: plano local de voladuras con GPS cuando se autoriza HTTPS.
- Exportación oficial: elige archivos personales, descarga `voladuras-oficiales.json`, sube manualmente a GitHub.
- Netlify consulta `voladuras-oficiales.json` al abrir y cada 120 segundos con la pestaña visible; cachea copia local si IndexedDB está disponible.

**Limitación de pruebas:** no se ejecutó el flujo completo con dos celulares reales ni el despliegue a la cuenta Netlify del usuario. El navegador automatizado del entorno bloqueó la apertura local, por lo que la integración visual sigue pendiente de verificación tras publicar. El código pasó verificaciones estáticas y pruebas de geometría básicas.

**Condición operativa:** validar puntos de control y geometría de voladuras en campo; no usar BlastMap como control de acceso o autorización de seguridad.


## V0.3.2 — Sistema MAGNA Origen Nacional
- Referencia EPSG:9377 consultada en IGAC / EPSG.io.
- Probadas transformaciones WGS84 ↔ Origen Nacional y MAGNA Central ↔ Origen Nacional con pyproj/PROJ, incluyendo Bogotá, Valledupar, Bucaramanga, Cali, Leticia, San Andrés y Puerto Carreño.
- Error forward en las muestras inferior a 0,1 m; conversiones de ida/vuelta inferiores a 0,2 m. No sustituye verificación con puntos de control topográficos.
- Importación DXF: dos áreas de prueba en Origen Nacional reconocidas sin advertencias.
- Compatibilidad: el identificador legado magna_bogota sigue siendo alias interno de MAGNA Central. No existe como opción visible.
- Se preservó el ajuste del margen de seguridad frente al badge de Netlify.
