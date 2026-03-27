

## Plan: Cache-buster en index.html

Agregar un comentario HTML de versión en el `<head>` de `index.html` para forzar un nuevo build y invalidar la caché del CDN.

### Cambio

**`index.html`** — Línea 6: reemplazar el comentario TODO por:
```html
<!-- ValiTrack build v3 -->
```

Después de aplicar el cambio, republicar la app desde el botón Publish.

