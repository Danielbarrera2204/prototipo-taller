# Simulador de arquitectura · KeepData

Aplicación web (Astro, sin servidor) que compara tres arquitecturas para procesar facturas y recomienda una según las variables del proyecto. Los resultados son **estimaciones del modelo**, no mediciones.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm install` | Instala dependencias (Node 20 o superior) |
| `npm run dev` | Servidor local en http://localhost:4321 |
| `npm run build` | Genera el sitio estático en `dist/` |
| `npm run build:single` | Además genera `dist/simulador-keepdata.html`, una sola página que se abre sin servidor |
| `npm test` | Ejecuta las 12 pruebas del modelo |

## Publicar en Vercel

1. Sube la carpeta a un repositorio de GitHub (sin `node_modules` ni `dist`).
2. En Vercel: *Add New → Project*, elige el repositorio. Detecta Astro solo.
3. Build command `npm run build`, output directory `dist`. Despliega y copia el enlace para el informe.

## Dónde está cada cosa

- `src/lib/params.js`: parámetros del modelo con su origen (fuente, supuesto o por medir). **Aquí se reemplazan los datos medidos del prototipo.**
- `src/lib/model.js`: fórmulas, filtros, puntaje y recomendación.
- `src/lib/variables.js`: variables de entrada, rangos, justificaciones y escenarios.
- `src/lib/pruebas.js`: pruebas del modelo (también se ven en la pestaña «Pruebas»).
- `src/scripts/app.js` y `src/pages/index.astro`: interfaz.
