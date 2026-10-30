import { VARIABLES, DEFAULTS, ESCENARIOS } from '../lib/variables.js';
import { PARAMS } from '../lib/params.js';
import { simular, validar, barridoVolumen, explicar, ALTS, CRITERIOS, volumen } from '../lib/model.js';
import { ALTERNATIVAS } from '../lib/alternativas.js';
import { ejecutarPruebas } from '../lib/pruebas.js';

/* ============================================================ utilidades */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nf = (d = 0) => new Intl.NumberFormat('es-CO', { minimumFractionDigits: d, maximumFractionDigits: d });
const n0 = (x) => nf(0).format(x);
const n1 = (x) => nf(1).format(x);
const n2 = (x) => nf(2).format(x);
const usd = (x) => 'US$ ' + (Math.abs(x) < 10 ? nf(2) : nf(0)).format(x);
const cop = (x) => '≈ $' + nf(0).format(Math.round((x * PARAMS.trm) / 1000) * 1000) + ' COP';
const pct = (x, d = 1) => nf(d).format(x) + ' %';
const NOMBRE = { A: 'A · Monolito con IA para todo', B: 'B · Monolito modular híbrido', C: 'C · Serverless con cola' };
const CORTO = { A: 'A', B: 'B', C: 'C' };
const dot = (a) => `<span class="dot ${a}" aria-hidden="true"></span>`;
const ESC_KEY = 'keepdata-sim-escenarios';

const FMT = {
  usd: (x) => usd(x), pct1: (x) => pct(x, 1), pct3: (x) => pct(x, 3), s: (x) => n1(x) + ' s', sem: (x) => n1(x) + ' sem.',
};

/* ============================================================ estado */
const estado = { e: { ...DEFAULTS }, sim: null, errores: [], tab: 'configurar', guardados: [], cacheBarrido: { clave: '', datos: null } };

try { estado.guardados = JSON.parse(localStorage.getItem(ESC_KEY) || '[]').filter((g) => g && g.nombre && g.valores); } catch { estado.guardados = []; }
const guardarLocal = () => { try { localStorage.setItem(ESC_KEY, JSON.stringify(estado.guardados)); } catch { /* sin almacenamiento */ } };

function leerEntradas() {
  const e = {};
  for (const v of VARIABLES) e[v.id] = $(`#in-${v.id}`).valueAsNumber;
  return e;
}
function escribirEntradas(valores) {
  for (const v of VARIABLES) {
    const x = valores[v.id];
    $(`#in-${v.id}`).value = x;
    $(`#rg-${v.id}`).value = x;
  }
}
const mismoValores = (a, b) => VARIABLES.every((v) => a[v.id] === b[v.id]);
const escenarioActivoId = () => {
  const p = ESCENARIOS.find((s) => mismoValores(estado.e, { ...DEFAULTS, ...s.cambios }));
  if (p) return p.id;
  const g = estado.guardados.findIndex((s) => mismoValores(estado.e, { ...DEFAULTS, ...s.valores }));
  return g >= 0 ? `g${g}` : null;
};

/* ============================================================ gráficos SVG */
const registroGraf = {};
const anchoGraf = (completo) => {
  const w = $('.paneles').clientWidth || 360;
  const col = !completo && window.innerWidth >= 900 ? (w - 16) / 2 : w;
  return Math.max(290, Math.min(760, Math.floor(col - 34)));
};

function escalaX(xs, w0, w1) {
  const l0 = Math.log10(xs[0]), l1 = Math.log10(xs[xs.length - 1]);
  return (x) => w0 + ((Math.log10(x) - l0) / (l1 - l0 || 1)) * (w1 - w0);
}
function ticksLog(min, max) {
  const t = [];
  for (let p = Math.floor(Math.log10(min)); p <= Math.ceil(Math.log10(max)); p++) for (const m of [1, 2, 5]) { const v = m * Math.pow(10, p); if (v >= min * 0.999 && v <= max * 1.001) t.push(v); }
  return t.length > 6 ? t.filter((v) => String(v)[0] === '1') : t;
}
function ticksY(max) {
  const paso = Math.pow(10, Math.floor(Math.log10(max / 4)));
  const base = [1, 2, 2.5, 5, 10].map((m) => m * paso).find((s) => max / s <= 5) || paso * 10;
  const t = []; for (let v = 0; v <= max * 1.0001; v += base) t.push(v);
  return t;
}

function graficoLineas(id, { titulo, puntos, clave, fmtY, F, ejeY }) {
  const W = anchoGraf(false), H = 300, m = { l: W < 400 ? 50 : 56, r: 18, t: 14, b: 62 };
  const xs = puntos.map((p) => p.F);
  const sx = escalaX(xs, m.l, W - m.r);
  const maxY = Math.max(...puntos.flatMap((p) => ALTS.map((a) => p[clave][a]))) * 1.08 || 1;
  const sy = (v) => H - m.b - (v / maxY) * (H - m.t - m.b);
  registroGraf[id] = { puntos, clave, fmtY, sx, W, m, titulo };
  let s = `<svg class="graf" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(titulo)}" data-graf="${id}">`;
  for (const v of ticksY(maxY)) s += `<line class="rej" x1="${m.l}" x2="${W - m.r}" y1="${sy(v)}" y2="${sy(v)}"/><text x="${m.l - 6}" y="${sy(v) + 4}" text-anchor="end">${fmtY(v)}</text>`;
  for (const v of ticksLog(xs[0], xs[xs.length - 1]).filter((v) => W >= 400 || String(v)[0] === '1')) s += `<line class="rej" x1="${sx(v)}" x2="${sx(v)}" y1="${m.t}" y2="${H - m.b}" opacity=".5"/><text x="${sx(v)}" y="${H - m.b + 14}" text-anchor="middle">${n0(v)}</text>`;
  s += `<line class="eje" x1="${m.l}" x2="${W - m.r}" y1="${H - m.b}" y2="${H - m.b}"/>`;
  s += `<text x="${(m.l + W - m.r) / 2}" y="${H - m.b + 30}" text-anchor="middle">${W < 400 ? 'Facturas por mes (escala log.)' : 'Facturas por mes (escala logarítmica)'}</text>`;
  if (F >= xs[0] && F <= xs[xs.length - 1]) s += `<line class="marca-F" x1="${sx(F)}" x2="${sx(F)}" y1="${m.t}" y2="${H - m.b}"/><text x="${sx(F)}" y="${m.t + 10}" text-anchor="${sx(F) > W - 90 ? 'end' : 'start'}" dx="${sx(F) > W - 90 ? -4 : 4}">volumen actual</text>`;
  for (const a of ALTS) {
    const d = puntos.map((p, i) => `${i ? 'L' : 'M'}${sx(p.F).toFixed(1)},${sy(p[clave][a]).toFixed(1)}`).join('');
    s += `<path class="linea ${a}" d="${d}"/>`;
  }
  // banda con la alternativa recomendada en cada volumen
  const yb = H - m.b + 40;
  s += `<text x="${m.l - 6}" y="${yb + 9}" text-anchor="end">Gana</text>`;
  puntos.forEach((p, i) => {
    const x0 = i === 0 ? sx(p.F) : (sx(puntos[i - 1].F) + sx(p.F)) / 2;
    const x1 = i === puntos.length - 1 ? sx(p.F) : (sx(p.F) + sx(puntos[i + 1].F)) / 2;
    s += `<rect class="banda ${p.modo === 'cumple' ? p.ganador : 'ninguna'}" x="${x0.toFixed(1)}" y="${yb}" width="${Math.max(0.5, x1 - x0 + 0.5).toFixed(1)}" height="10"/>`;
  });
  s += `<g class="cursor" style="display:none"><line class="crosshair" y1="${m.t}" y2="${H - m.b}"/>${ALTS.map((a) => `<circle class="punto ${a}" r="5"/>`).join('')}</g>`;
  s += `<rect class="graf-hit" x="${m.l}" y="${m.t}" width="${W - m.l - m.r}" height="${H - m.t - m.b}"/>`;
  s += `</svg>`;
  return s;
}

function graficoCostos(sim) {
  const W = anchoGraf(true), estrecho = W < 480;
  const filaH = estrecho ? 62 : 52, m = { l: 4, t: 6 }, H = m.t + ALTS.length * filaH + 4;
  const x0 = estrecho ? m.l : m.l + 150, r = 76;
  const max = Math.max(...ALTS.map((a) => sim.resultados[a].costoTotal));
  const wMax = W - x0 - r;
  const sx = (v) => (v / max) * wMax;
  let s = `<svg class="graf" viewBox="0 0 ${W} ${H}" role="img" aria-label="Composición del costo mensual de cada alternativa">`;
  ALTS.forEach((a, i) => {
    const R = sim.resultados[a], y = m.t + i * filaH;
    const yb = estrecho ? y + 22 : y + 8;
    s += `<text x="${m.l}" y="${estrecho ? y + 12 : y + 26}" style="fill:var(--ink);font-weight:600;font-size:12px">${CORTO[a]} · ${ALTERNATIVAS[a].corto}</text>`;
    let x = x0;
    [['seg1', 'Base común', R.costo.comun], ['seg2', a === 'C' ? 'Funciones y servicios' : 'Servidores', R.costo.infra], ['seg3', 'Llamadas a IA', R.costo.ia]].forEach(([cls, nombre, v]) => {
      const w = sx(v);
      if (w > 0.5) s += `<rect class="${cls}" x="${x.toFixed(1)}" y="${yb}" width="${Math.max(0, w - 2).toFixed(1)}" height="26" rx="3"><title>${nombre}: ${usd(v)}</title></rect>`;
      x += w;
    });
    s += `<text x="${x + 6}" y="${yb + 18}" style="fill:var(--ink);font-weight:700;font-size:12px">${usd(R.costoTotal)}</text>`;
  });
  return s + '</svg>';
}

/* hover de los gráficos de línea */
const tip = $('#tip');
function conectarHover(raiz) {
  $$('svg[data-graf]', raiz).forEach((svg) => {
    const reg = registroGraf[svg.dataset.graf];
    const hit = $('.graf-hit', svg), cur = $('.cursor', svg);
    const mover = (ev) => {
      const r = svg.getBoundingClientRect();
      const x = ((ev.clientX - r.left) / r.width) * reg.W;
      let mejor = 0, dm = Infinity;
      reg.puntos.forEach((p, i) => { const d = Math.abs(reg.sx(p.F) - x); if (d < dm) { dm = d; mejor = i; } });
      const p = reg.puntos[mejor];
      const maxY = Math.max(...reg.puntos.flatMap((q) => ALTS.map((a) => q[reg.clave][a]))) * 1.08 || 1;
      const H = 300, sy = (v) => H - reg.m.b - (v / maxY) * (H - reg.m.t - reg.m.b);
      cur.style.display = '';
      $('.crosshair', cur).setAttribute('x1', reg.sx(p.F)); $('.crosshair', cur).setAttribute('x2', reg.sx(p.F));
      ALTS.forEach((a) => { const c = $(`.punto.${a}`, cur); c.setAttribute('cx', reg.sx(p.F)); c.setAttribute('cy', sy(p[reg.clave][a])); });
      tip.hidden = false;
      tip.innerHTML = `<b>${n0(p.F)} facturas/mes</b>` + ALTS.map((a) => `<i>${dot(a)}${CORTO[a]}: ${reg.fmtY(p[reg.clave][a])}</i>`).join('') + `<i>Gana: ${p.modo === 'cumple' ? CORTO[p.ganador] : 'ninguna cumple'}</i>`;
      tip.style.left = Math.min(window.innerWidth - 230, ev.clientX + 14) + 'px';
      tip.style.top = Math.max(8, ev.clientY - 70) + 'px';
    };
    const salir = () => { cur.style.display = 'none'; tip.hidden = true; };
    hit.addEventListener('pointermove', mover); hit.addEventListener('pointerdown', mover); hit.addEventListener('pointerleave', salir);
  });
}

const leyendaAlts = () => `<div class="leyenda">${ALTS.map((a) => `<span>${dot(a)}${NOMBRE[a]}</span>`).join('')}</div>`;

function barrido() {
  const e = estado.e, F = estado.sim.F;
  const clave = JSON.stringify(e);
  if (estado.cacheBarrido.clave === clave) return estado.cacheBarrido.datos;
  const desde = Math.max(100, F / 20), hasta = Math.max(desde * 10, F * 40);
  const datos = barridoVolumen(e, desde, hasta, 32);
  estado.cacheBarrido = { clave, datos };
  return datos;
}

/* ============================================================ resumen lateral */
function renderResumen() {
  const cont = $('#resumen');
  if (estado.errores.length) {
    cont.innerHTML = `<div class="res-err"><strong>Corrige las entradas para simular</strong><ul>${estado.errores.slice(0, 4).map((x) => `<li>${esc(x.msg)}</li>`).join('')}</ul></div>`;
    return;
  }
  const s = estado.sim, R = s.resultados, rec = s.recomendada;
  const titulo = s.modo === 'cumple'
    ? `<div class="res-rec ${rec}"><strong>${NOMBRE[rec]}</strong><span>Puntaje ${n1(s.puntajes[rec].total)} de 100 · cumple todos los requisitos</span></div>`
    : `<div class="res-rec ninguna"><strong>Ninguna cumple todos los requisitos</strong><span>La más cercana: ${NOMBRE[rec]}</span></div>`;
  const fila = (nom, f) => `<tr><td>${nom}</td>${ALTS.map((a) => `<td>${f(R[a])}</td>`).join('')}</tr>`;
  cont.innerHTML = `
    <div class="res-titulo">Recomendación del modelo</div>${titulo}
    <div class="res-tabla-wrap"><table class="res-tabla">
      <thead><tr><th></th>${ALTS.map((a) => `<th>${dot(a)}${a}</th>`).join('')}</tr></thead>
      <tbody>
        ${fila('Costo/mes', (r) => usd(r.costoTotal))}
        ${fila('Tiempo', (r) => n1(r.tiempo) + ' s')}
        ${fila('Revisión', (r) => pct(r.review * 100))}
        ${fila('Disponib.', (r) => pct(r.disp * 100, 2))}
        ${fila('Puntaje', (r) => n1(s.puntajes[r.id].total))}
        ${fila('Requisitos', (r) => (r.req.cumpleTodo ? '<span class="chip ok">Cumple</span>' : '<span class="chip no">No cumple</span>'))}
      </tbody></table></div>
    <div class="res-vol"><span>Volumen simulado</span><strong>${n0(s.F)} facturas/mes</strong></div>`;
}

/* ============================================================ pestaña Alternativas */
function renderAlternativas() {
  const p = $('#panel-alternativas');
  p.innerHTML = `
    <div class="bloque"><h2>Tres alternativas para procesar facturas</h2>
      <p class="nota">Las tres comparten la base: Firebase Authentication, base de datos SQL y la revisión del usuario antes de guardar. Difieren en cómo se extraen los datos y dónde se ejecuta ese procesamiento. Se evalúan siempre con las mismas entradas.</p></div>
    <div class="alts-rejilla">
      ${ALTS.map((a) => { const d = ALTERNATIVAS[a]; return `
        <article class="alt-card ${a}">
          <h3>${dot(a)}${esc(d.id)} · ${esc(d.nombre)}</h3>
          <p>${esc(d.resumen)}</p>
          <div class="pipe">${d.pipeline.map(([f, t]) => `<div><b>${f}</b><span>${esc(t)}</span></div>`).join('')}</div>
          <h4>Fortalezas</h4><ul>${d.fortalezas.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
          <h4>Debilidades</h4><ul>${d.debilidades.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
          <h4>Cómo escala</h4><p class="nota">${esc(d.escalamiento)}</p>
        </article>`; }).join('')}
    </div>`;
}

/* ============================================================ pestaña Resultados */
const INDICADORES = [
  { id: 'costo', nom: 'Costo mensual', dir: 'min', val: (r) => r.costoTotal, fmt: (r) => `${usd(r.costoTotal)}<small>${cop(r.costoTotal)}</small>` },
  { id: 'cxf', nom: 'Costo por factura', dir: 'min', val: (r) => r.costoPorFactura, fmt: (r) => `US$ ${nf(4).format(r.costoPorFactura)}` },
  { id: 'tiempo', nom: 'Tiempo por factura en el pico', dir: 'min', val: (r) => r.tiempo, fmt: (r) => `${n2(r.tiempo)} s${r.saturado ? '<small>sistema saturado</small>' : ''}` },
  { id: 'revision', nom: 'Facturas a revisión manual', dir: 'min', val: (r) => r.review, fmt: (r) => pct(r.review * 100) },
  { id: 'disp', nom: 'Disponibilidad', dir: 'max', val: (r) => r.disp, fmt: (r) => `${pct(r.disp * 100, 3)}<small>${n1((1 - r.disp) * 730)} h de caída al mes</small>` },
  { id: 'ia', nom: 'Facturas enviadas a IA externa', dir: 'min', val: (r) => r.shareIA, fmt: (r) => pct(r.shareIA * 100, 0) },
  { id: 'cap', nom: 'Capacidad máxima', dir: 'max', val: (r) => r.capacidadHora, fmt: (r) => `${n0(r.capacidadHora)} facturas/h` },
  { id: 'vmax', nom: 'Volumen máximo dentro del presupuesto', dir: 'max', val: (r) => r.volMax, fmt: (r) => `${n0(r.volMax)} facturas/mes<small>${r.margen >= 1 ? '× ' + n1(r.margen) + ' el volumen actual' : 'ya lo supera'}</small>` },
  { id: 'meses', nom: 'Meses hasta el límite', dir: 'max', val: (r) => r.mesesLimite, fmt: (r) => (Number.isFinite(r.mesesLimite) ? n1(r.mesesLimite) + ' meses' : 'sin límite (no crece)') },
  { id: 'esf', nom: 'Esfuerzo de implementación', dir: 'min', val: (r) => r.esfuerzo, fmt: (r) => `${n1(r.esfuerzo)} semanas` },
  { id: 'inst', nom: 'Capacidad instalada', dir: null, val: () => 0, fmt: (r) => (r.instancias ? `${r.instancias} instancias<small>${PARAMS.alternativas[r.id].slots} procesos en paralelo cada una</small>` : `hasta ${n0(r.concurrenciaMax)} ejecuciones en paralelo`) },
  { id: 'rho', nom: 'Utilización en el pico', dir: null, val: (r) => r.rho, fmt: (r) => pct(r.rho * 100) },
];

function renderResultados() {
  const p = $('#panel-resultados');
  if (!estado.sim) { p.innerHTML = avisoErrores(); return; }
  const s = estado.sim, R = s.resultados;
  const filas = INDICADORES.map((ind) => {
    const vals = ALTS.map((a) => ind.val(R[a]));
    let mejor = -1;
    if (ind.dir) {
      const objetivo = ind.dir === 'min' ? Math.min(...vals) : Math.max(...vals);
      const hay = vals.some((v) => Math.abs(v - objetivo) > 1e-12 * Math.max(1, Math.abs(objetivo)));
      if (hay) mejor = vals.findIndex((v) => Math.abs(v - objetivo) <= 1e-12 * Math.max(1, Math.abs(objetivo)));
    }
    return `<tr><th scope="row">${ind.nom}</th>${ALTS.map((a, i) => `<td class="${i === mejor ? 'mejor' : ''}">${ind.fmt(R[a])}</td>`).join('')}</tr>`;
  }).join('');

  const datos = barrido();
  p.innerHTML = `
    <div class="bloque">
      <div class="bloque-cab"><h2>Indicadores comparados</h2><button class="btn peq" id="btn-csv" type="button">Descargar CSV</button></div>
      <p class="nota">Misma entrada para las tres alternativas: ${n0(s.F)} facturas al mes, pico de ${n1(estado.e.factorPico)}× el promedio. La celda resaltada marca el mejor valor de cada fila. Son estimaciones del modelo.</p>
      <div class="tabla-wrap"><table class="dt">
        <thead><tr><th>Indicador</th>${ALTS.map((a) => `<th>${dot(a)}<span class="n-largo">${NOMBRE[a]}</span><span class="n-corto">${a}</span></th>`).join('')}</tr></thead>
        <tbody>${filas}</tbody></table></div>
    </div>
    <div class="bloque">
      <h2>Composición del costo mensual</h2>
      <div class="leyenda"><span><i class="sw seg1"></i>Base común (SQL, frontend, autenticación)</span><span><i class="sw seg2"></i>Servidores o funciones</span><span><i class="sw seg3"></i>Llamadas a IA</span></div>
      ${graficoCostos(s)}
    </div>
    <div class="dos-col">
      <div class="bloque"><h2>Costo al cambiar el volumen</h2>
        <p class="nota">Mismas variables, solo cambia el número de facturas. La franja «Gana» muestra la alternativa recomendada en cada volumen (gris: ninguna cumple).</p>${leyendaAlts()}
        ${graficoLineas('g-costo', { titulo: 'Costo mensual según el volumen de facturas', puntos: datos, clave: 'costo', fmtY: (v) => usd(v), F: s.F })}</div>
      <div class="bloque"><h2>Tiempo por factura al cambiar el volumen</h2>
        <p class="nota">En C baja con más tráfico porque hay menos arranques en frío.</p>${leyendaAlts()}
        ${graficoLineas('g-tiempo', { titulo: 'Tiempo por factura según el volumen de facturas', puntos: datos, clave: 'tiempo', fmtY: (v) => n1(v) + ' s', F: s.F })}</div>
    </div>`;
  conectarHover(p);
  $('#btn-csv').addEventListener('click', descargarCSV);
}

function descargarCSV() {
  const R = estado.sim.resultados;
  const filas = [['Indicador', ...ALTS.map((a) => NOMBRE[a])]];
  for (const ind of INDICADORES) filas.push([ind.nom, ...ALTS.map((a) => ind.fmt(R[a]).replace(/<small>/g, ' (').replace(/<\/small>/g, ')').replace(/<[^>]+>/g, ''))]);
  filas.push(['Puntaje (0-100)', ...ALTS.map((a) => n1(estado.sim.puntajes[a].total))]);
  filas.push(['Cumple requisitos', ...ALTS.map((a) => (R[a].req.cumpleTodo ? 'Sí' : 'No'))]);
  const csv = '﻿' + filas.map((f) => f.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = 'keepdata-indicadores.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function avisoErrores() {
  return `<div class="bloque"><h2>Hay entradas por corregir</h2><p class="nota">Abre «Configurar» y corrige los campos marcados en rojo. Los resultados se calculan de nuevo apenas las entradas sean válidas.</p></div>`;
}

/* ============================================================ pestaña Decisión */
function renderDecision() {
  const p = $('#panel-decision');
  if (!estado.sim) { p.innerHTML = avisoErrores(); return; }
  const s = estado.sim, R = s.resultados, e = estado.e, ex = explicar(s, e);
  const filasReq = R.A.req.chequeos.map((c, i) => `<tr><th scope="row">${c.label}<small>${c.tipo === 'min' ? 'mínimo' : 'máximo'} ${c.id === 'capacidad' ? '95 % de utilización' : FMT[c.fmt](c.limite)}</small></th>${ALTS.map((a) => { const x = R[a].req.chequeos[i]; return `<td>${FMT[x.fmt](x.valor)}<br>${x.cumple ? '<span class="chip ok">✓ Cumple</span>' : '<span class="chip no">✗ No cumple</span>'}</td>`; }).join('')}</tr>`).join('');
  const suma = CRITERIOS.reduce((t, c) => t + e[c.w], 0);
  const filasPuntaje = CRITERIOS.map((c) => `<tr><th scope="row">${c.label}<small>peso ${n1((e[c.w] / suma) * 100)} %</small></th>${ALTS.map((a) => {
    const v = s.norm[c.id][a];
    return `<td>${n0(v * 100)} %<span class="barra-fondo"><i style="width:${(v * 100).toFixed(0)}%"></i></span><small>+${n1(s.puntajes[a].aporte[c.id])} pts</small></td>`;
  }).join('')}</tr>`).join('');
  const datos = barrido();
  const tramos = [];
  datos.forEach((pt) => { const g = pt.modo === 'cumple' ? pt.ganador : 'ninguna'; const u = tramos[tramos.length - 1]; if (u && u.g === g) u.hasta = pt.F; else tramos.push({ g, desde: pt.F, hasta: pt.F }); });
  const textoTramos = tramos.map((t, i) => {
    const rango = i === 0 ? `hasta ${n0((t.hasta + (tramos[i + 1]?.desde ?? t.hasta)) / 2)} facturas/mes` : i === tramos.length - 1 ? `desde ${n0((tramos[i - 1].hasta + t.desde) / 2)} facturas/mes` : `entre ${n0((tramos[i - 1].hasta + t.desde) / 2)} y ${n0((t.hasta + tramos[i + 1].desde) / 2)}`;
    return `<li>${t.g === 'ninguna' ? 'Ninguna alternativa cumple' : dot(t.g) + 'Gana ' + NOMBRE[t.g]}: ${rango}</li>`;
  }).join('');

  p.innerHTML = `
    <div class="bloque">
      <h2>Recomendación explicada</h2>
      <p class="texto-rec"><strong>${esc(ex.titulo)}</strong></p>
      <div class="exp-grid">
        <div><h3>Ventajas</h3><ul class="lista-exp">${ex.ventajas.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>
        <div><h3>Limitaciones</h3><ul class="lista-exp">${ex.limitaciones.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>
        <div><h3>Supuestos principales</h3><ul class="lista-exp">${ex.supuestos.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>
      </div>
      ${ex.descartadas.length ? `<div><h3>Alternativas que no cumplen los requisitos</h3><ul class="lista-exp">${ex.descartadas.map((d) => `<li>${dot(d.id)}${esc(d.nombre)}: incumple ${esc(d.motivos.join(', '))}.</li>`).join('')}</ul></div>` : ''}
    </div>
    <div class="bloque">
      <h2>Paso 1 · Requisitos obligatorios</h2>
      <p class="nota">Una alternativa que incumple cualquiera de estos requisitos queda descartada, sin importar su puntaje.</p>
      <div class="tabla-wrap"><table class="dt"><thead><tr><th>Requisito</th>${ALTS.map((a) => `<th>${dot(a)}<span class="n-largo">${CORTO[a]} · ${ALTERNATIVAS[a].corto}</span><span class="n-corto">${a}</span></th>`).join('')}</tr></thead><tbody>${filasReq}</tbody></table></div>
    </div>
    <div class="bloque">
      <h2>Paso 2 · Puntaje ponderado</h2>
      <p class="nota">Cada indicador se lleva a una escala de 0 a 100 % respecto a la mejor alternativa y se multiplica por su peso. Los pesos se cambian en «Configurar».</p>
      <div class="tabla-wrap"><table class="dt"><thead><tr><th>Criterio</th>${ALTS.map((a) => `<th>${dot(a)}<span class="n-largo">${CORTO[a]} · ${ALTERNATIVAS[a].corto}</span><span class="n-corto">${a}</span></th>`).join('')}</tr></thead>
        <tbody>${filasPuntaje}
        <tr><th scope="row">Puntaje total</th>${ALTS.map((a) => `<td><strong>${n1(s.puntajes[a].total)}</strong> / 100<br>${R[a].req.cumpleTodo ? (a === s.recomendada ? '<span class="chip ok">Recomendada</span>' : '<span class="chip ok">Elegible</span>') : '<span class="chip no">Descartada</span>'}</td>`).join('')}</tr>
        </tbody></table></div>
    </div>
    <div class="bloque">
      <h2>¿Cuándo cambia la recomendación?</h2>
      <p class="nota">Se repite la simulación completa con distintos volúmenes y las demás variables fijas.</p>
      <ul class="lista-exp">${textoTramos}</ul>
      ${graficoLineas('g-costo-d', { titulo: 'Costo y alternativa ganadora según el volumen', puntos: datos, clave: 'costo', fmtY: (v) => usd(v), F: s.F })}
    </div>`;
  conectarHover(p);
}

/* ============================================================ pestaña Escenarios */
function filaEscenario(id, nombre, descripcion, valores, extra) {
  const sim = simular({ ...DEFAULTS, ...valores });
  const activo = escenarioActivoId() === id;
  const celdas = sim.errores.length ? `<td colspan="5">Entradas inválidas</td>` : `
    <td>${n0(sim.F)}</td>
    <td><span class="rec-celda">${sim.modo === 'cumple' ? dot(sim.recomendada) + CORTO[sim.recomendada] : '<span class="chip no">Ninguna cumple</span>'}</span></td>
    ${ALTS.map((a) => `<td>${n1(sim.puntajes[a].total)}${sim.resultados[a].req.cumpleTodo ? '' : ' ✗'}</td>`).join('')}`;
  return { activo, html: `<tr class="${activo ? 'fila-activa' : ''}"><th scope="row">${esc(nombre)}<small>${esc(descripcion)}</small></th>${celdas}<td><button class="btn peq" data-cargar="${id}" type="button">${activo ? 'Cargado' : 'Cargar'}</button>${extra || ''}</td></tr>` };
}

function renderEscenarios() {
  const p = $('#panel-escenarios');
  const base = { ...DEFAULTS };
  const filas = ESCENARIOS.map((s) => filaEscenario(s.id, s.nombre, s.descripcion, s.cambios)).map((f) => f.html).join('')
    + estado.guardados.map((g, i) => filaEscenario(`g${i}`, g.nombre + ' (propio)', 'Escenario guardado por el equipo.', g.valores, ` <button class="btn peq" data-borrar="${i}" type="button" aria-label="Eliminar escenario ${esc(g.nombre)}">Eliminar</button>`).html).join('');
  const cambios = VARIABLES.filter((v) => estado.e[v.id] !== base[v.id]);
  p.innerHTML = `
    <div class="bloque">
      <h2>Escenarios ejecutados</h2>
      <p class="nota">Cada fila ejecuta la simulación completa con las variables del escenario. El escenario base es el punto de referencia; los demás solo cambian algunas variables. Cárgalos para editarlos y ver el detalle.</p>
      <div class="tabla-wrap"><table class="dt" id="tabla-esc">
        <thead><tr><th>Escenario</th><th>Facturas/mes</th><th>Recomendada</th><th>Puntaje A</th><th>Puntaje B</th><th>Puntaje C</th><th></th></tr></thead>
        <tbody>${filas}</tbody></table></div>
      <p class="nota">✗ junto al puntaje indica que esa alternativa incumple algún requisito obligatorio y no es elegible.</p>
    </div>
    <div class="bloque">
      <h2>Cambios frente al escenario base</h2>
      ${cambios.length ? `<ul class="lista-exp">${cambios.map((v) => `<li>${esc(v.label)}: ${n1(base[v.id])} → <strong>${Number.isFinite(estado.e[v.id]) ? n1(estado.e[v.id]) : '—'}</strong> ${esc(v.unidad)}</li>`).join('')}</ul>` : '<p class="nota">Estás en el escenario base.</p>'}
    </div>
    <div class="bloque">
      <h2>Guardar la configuración actual como escenario</h2>
      <div class="esc-fila"><input class="esc-nombre" id="esc-nombre" type="text" maxlength="60" placeholder="Nombre del escenario" aria-label="Nombre del escenario" />
        <button class="btn primario" id="btn-guardar-esc" type="button" ${estado.errores.length ? 'disabled' : ''}>Guardar escenario</button></div>
      <p class="error" id="esc-error" hidden></p>
      <p class="nota">Se guarda en este navegador. Para la sustentación, cambia variables en «Configurar» y guarda el resultado como un escenario propio.</p>
    </div>`;
  $$('[data-cargar]', p).forEach((b) => b.addEventListener('click', () => {
    const id = b.dataset.cargar;
    const vals = id.startsWith('g') ? estado.guardados[+id.slice(1)].valores : ESCENARIOS.find((s) => s.id === id).cambios;
    escribirEntradas({ ...DEFAULTS, ...vals }); actualizar();
  }));
  $$('[data-borrar]', p).forEach((b) => b.addEventListener('click', () => { estado.guardados.splice(+b.dataset.borrar, 1); guardarLocal(); renderEscenarios(); }));
  $('#btn-guardar-esc').addEventListener('click', () => {
    const nombre = $('#esc-nombre').value.trim(), err = $('#esc-error');
    if (!nombre) { err.textContent = 'Escribe un nombre para el escenario.'; err.hidden = false; return; }
    if (estado.guardados.some((g) => g.nombre.toLowerCase() === nombre.toLowerCase())) { err.textContent = 'Ya existe un escenario con ese nombre.'; err.hidden = false; return; }
    estado.guardados.push({ nombre, valores: { ...estado.e } }); guardarLocal(); renderEscenarios();
  });
}

/* ============================================================ pestaña Modelo */
function renderModelo() {
  const P = PARAMS, I = P.ia, T = P.tiempos, A = P.alternativas, C = A.C;
  const tag = (o) => `<span class="origen" title="${{ F: 'Fuente pública, verificar', S: 'Supuesto del equipo', M: 'Medir en el prototipo' }[o]}">${o}</span>`;
  const fila = (n, v, o, d) => `<tr><th scope="row">${n}</th><td>${v}</td><td>${tag(o)}</td><td>${d}</td></tr>`;
  $('#panel-modelo').innerHTML = `
  <div class="bloque doc">
    <h2>Cómo funciona el modelo</h2>
    <p>La cadena de cálculo es siempre la misma y se puede verificar paso a paso: <strong>variables de entrada → reglas del modelo → indicadores → requisitos obligatorios → puntaje ponderado → recomendación</strong>. Nada está precalculado: al mover una variable se recalcula todo.</p>
        <details class="desplegable">
      <summary>Ver fórmulas del modelo</summary>
    <span class="formula">F  = comercios × facturas por comercio                 (facturas al mes)
λ  = F × factor de pico / (${P.calendario.diasHabiles} días × ${P.calendario.horasDia} h × 3600)         (facturas por segundo en el pico)
t̄  = Σ peso(clase) × t(clase)                          (segundos de servicio por factura)
    clases: XML, PDF, foto buena, foto mala
    A:    t = t_Gemini (× ${I.factorTextoXml} si es XML) + preproceso (foto) + t_validación
    B, C: t = t_local + φ × t_Gemini + t_validación       (φ = fracción escalada a IA)</span>
    <span class="formula">demanda     = λ × t̄                                    (procesos ocupados)
instancias  = mín( máx( réplicas, ⌈demanda / (procesos × ${P.modelo.rhoObjetivo})⌉ ), ${A.A.instMax} )   (A y B)
ρ           = máx( demanda / (instancias × procesos),  solicitudes_IA_por_min / ${I.rpm} )
Wq          = t̄ · ρ^(√(2(c+1)) − 1) / ( c · (1 − ρ) )   (cola M/M/c, Sakasegawa; c = procesos totales)
Tiempo (A,B)= t̄ + Wq
Tiempo (C)  = t̄ + ${C.saltosCola} × ${C.latSaltoS} s (saltos de cola) + P_frío × ${C.coldStartS} s + Wq
P_frío      = 0,05 + 0,45 · e^(−λ_por_hora / 60)</span>
    <span class="formula">Costo       = base común + infraestructura + F × costo_IA_por_factura
base común  = SQL ${usd(P.comun.dbUSD)} + frontend ${usd(P.comun.frontUSD)} + autenticación (solo si supera ${n0(P.comun.authGratisMAU)} usuarios activos)
infra A/B   = instancias × (A: ${usd(A.A.instUSD)}, B: ${usd(A.B.instUSD)})
infra C     = ${usd(C.fijoUSD)} fijos + Lambda (solicitudes y GB-segundo, tras la capa gratuita) + cola, API y almacenamiento
costo_IA    = Σ peso(clase) × φ(clase) × (tokens_entrada × ${I.precioEntradaMTok} + tokens_salida × ${I.precioSalidaMTok}) / 1.000.000</span>
    <span class="formula">Revisión manual = Σ peso(clase) × [ (1 − φ) × r_local + φ × min(1, ${I.hMedioDificil} × r_Gemini) ]     (A: r_Gemini directo)
Disponibilidad (A,B) = LB × (1 − (1 − A_inst)^instancias) × A_BD × A_Auth × (1 − φ_total × (1 − A_Gemini))
Disponibilidad (C)   = (API × S3 × cola) × [1 − ${n1((1 - C.absorcionReintentos) * 100)} % × (1 − Lambda × dependencia_IA)] × A_BD × A_Auth
Volumen máximo       = mayor F tal que no hay saturación (ρ &lt; ${P.modelo.rhoCritico}) y el costo no supera el presupuesto   (búsqueda binaria sobre este mismo modelo)
Meses hasta el límite = ln(Volumen máximo / F) / ln(1 + crecimiento)</span>
    </details>
    <h3>Decisión</h3>
   
    <ol>
      <li><strong>Filtros eliminatorios:</strong> presupuesto, disponibilidad mínima, tiempo máximo, revisión manual máxima, datos enviados a IA externa, plazo de desarrollo y capacidad (sin saturación).</li>
      <li><strong>Normalización:</strong> costo, tiempo, revisión y esfuerzo = mejor valor / valor. Disponibilidad = «nueves» / mejores nueves. Escalabilidad = margen de crecimiento (tope 20×) / mejor margen. Privacidad = (1 − fracción a IA) / mejor.</li>
      <li><strong>Puntaje:</strong> Σ peso normalizado × valor normalizado × 100. Gana el mayor puntaje entre las alternativas que cumplen todo. Si ninguna cumple, se muestra la que menos se aleja de los límites, indicando qué incumple.</li>
    </ol>
    <h3>Parámetros ${tag('F')} fuente pública · ${tag('S')} supuesto del equipo · ${tag('M')} por medir en el prototipo</h3>
    <div class="tabla-wrap"><table class="dt"><thead><tr><th>Parámetro</th><th>Valor</th><th>Origen</th><th>Observación</th></tr></thead><tbody>
      ${fila('Precio de Gemini (entrada / salida)', `${I.precioEntradaMTok} / ${I.precioSalidaMTok} USD por millón de tokens`, 'F', 'Modelo gemini-2.5-flash, consultado el 25-oct-2026 en listados que replican ai.google.dev. Verificar en la página oficial.')}
      ${fila('Tokens por llamada', `XML ${n0(I.tokEntrada.xml)}, PDF ${n0(I.tokEntrada.pdf)}, foto ${n0(I.tokEntrada.img)}; salida ${I.tokSalida}`, 'S', 'Depende del tamaño del documento y del prompt.')}
      ${fila('Tiempo de una llamada a Gemini', `${I.tGemini} s`, 'M', 'Reemplazar con el tiempo medido en el prototipo.')}
      ${fila('Cuota de Gemini', `${I.rpm} solicitudes por minuto`, 'S', 'Depende del plan de la API. Limita la capacidad de A.')}
      ${fila('Disponibilidad de Gemini', pct(I.disp * 100, 1), 'S', 'Sin SLA formal verificado; supuesto conservador.')}
      ${fila('AWS Lambda', `${C.precioMillonReq} USD por millón de solicitudes; ${C.precioGBs} USD por GB-s; gratis ${n0(C.gratisReq)} solicitudes y ${n0(C.gratisGBs)} GB-s`, 'F', 'Página oficial de precios de AWS Lambda (US Este).')}
      ${fila('Concurrencia de Lambda', n0(C.concurrencia), 'F', 'Límite por defecto de ejecuciones concurrentes por cuenta.')}
      ${fila('Google Cloud Vision (no usado)', '1,50 USD por 1.000 imágenes', 'F', 'Se descartó: el OCR corre en la propia infraestructura para no enviar más datos a terceros.')}
      ${fila('Instancia de A / B', `${usd(A.A.instUSD)} / ${usd(A.B.instUSD)} al mes; ${A.A.slots} / ${A.B.slots} procesos en paralelo`, 'S', 'B necesita más CPU por el OCR; A espera respuestas de Gemini.')}
      ${fila('Disponibilidad de una instancia', pct(A.A.dispInst * 100, 1), 'S', 'Servidor único, incluye reinicios y despliegues.')}
      ${fila('SLA de API, S3, cola y Lambda', `${pct(C.dispApi * 100, 2)} · ${pct(C.dispS3 * 100, 1)} · ${pct(C.dispCola * 100, 1)} · ${pct(C.dispLambda * 100, 2)}`, 'F', 'SLA publicados por el proveedor.')}
      ${fila('SQL y autenticación', `${pct(P.comun.dispDB * 100, 2)} · ${pct(P.comun.dispAuth * 100, 2)}`, 'F', 'Comunes a las tres alternativas.')}
      ${fila('Tiempos locales', `XML ${T.parseXml} s, PDF ${T.parsePdf} s, OCR ${T.ocrImg} s, validación ${T.validacionGuardado} s`, 'S', 'Medir en el prototipo.')}
      ${fila('Escalamiento a IA (φ)', `XML ${P.escalamiento.xml * 100} %, PDF ${P.escalamiento.pdf * 100} %, foto buena ${P.escalamiento.imgBuena * 100} %, foto mala ${P.escalamiento.imgMala * 100} %`, 'S', 'Depende del umbral de confianza que se defina.')}
      ${fila('Revisión manual con IA directa', `XML ${P.revision.gemini.xml * 100} %, PDF ${P.revision.gemini.pdf * 100} %, foto buena ${P.revision.gemini.imgBuena * 100} %, foto mala ${P.revision.gemini.imgMala * 100} %`, 'S', 'Con 5 facturas reales no hay muestra para estimarlas: 0 de 5 pasó a revisión, dato compatible con estas tasas.')}
      ${fila('Esfuerzo de implementación', `A ${A.A.esfuerzoSem}, B ${A.B.esfuerzoSem}, C ${A.C.esfuerzoSem} semanas`, 'S', 'Equipo de 3 personas. A ya está construida.')}
    </tbody></table></div>
    <h3>Supuestos</h3>
    <ul>
      <li>La demanda llega de forma aleatoria (proceso de Poisson) y el tiempo de servicio varía; la fórmula de colas es una aproximación.</li>
      <li>Las tres alternativas comparten la misma base de datos, autenticación y revisión del usuario.</li>
      <li>El OCR local de B y C usa software libre; no se cuenta el costo de desarrollo, solo el esfuerzo en semanas.</li>
      <li>Un mes tiene ${P.calendario.diasHabiles} días hábiles de ${P.calendario.horasDia} horas; el pico se expresa como múltiplo del promedio por hora.</li>
    </ul>
    <h3>Limitaciones</h3>
    <ul>
      <li>Es un modelo, no un benchmark: no mide rendimiento real y no sustituye pruebas de carga.</li>
      <li>La calibración se hizo con 5 facturas de 5 proveedores: sirve para comprobar el orden de magnitud, no para estimar tasas de error.</li>
      <li>Los precios cambian. Hay que revisarlos antes de decidir.</li>
      <li>No modela fallas correlacionadas, límites de memoria, latencia de red entre regiones ni costos de personal.</li>
    </ul>
    <h3>Datos que faltan para validar las conclusiones en una aplicación real</h3>
    <ul>
      <li>Tiempo medido por factura y por formato, con y sin Gemini, en el servidor real.</li>
      <li>Muestra grande de facturas reales (cientos) para medir tasa de revisión y de escalamiento por formato.</li>
      <li>Mezcla real de formatos y calidad de las fotos de los comercios piloto.</li>
      <li>Cotización vigente del proveedor de nube, cuota y SLA del plan de Gemini.</li>
      <li>Pruebas de carga con el pico real de cierre de mes.</li>
    </ul>
  </div>`;
}

/* ============================================================ pestaña Pruebas */
function renderPruebas() {
  const res = ejecutarPruebas();
  const ok = res.filter((r) => r.ok).length;
  $('#panel-pruebas').innerHTML = `
    <div class="bloque">
      <div class="resultado-pruebas"><h2>Pruebas del modelo</h2><span class="chip ${ok === res.length ? 'ok' : 'no'}">${ok} de ${res.length} aprobadas</span><button class="btn peq" id="btn-pruebas" type="button">Ejecutar de nuevo</button></div>
      <p class="nota">Cada prueba ejecuta el modelo real con entradas definidas y compara el resultado con un valor esperado (cálculo manual, propiedad matemática o regla del enunciado). No dependen de lo que esté escrito en la pantalla.</p>
    </div>
    ${res.map((r) => `<article class="prueba"><h3>${r.id} · ${esc(r.nombre)} <span class="chip ${r.ok ? 'ok' : 'no'}">${r.ok ? '✓ Aprobada' : '✗ Fallida'}</span></h3><p class="nota">${esc(r.objetivo)}</p>
      <dl><dt>Esperado</dt><dd>${esc(r.esperado)}</dd><dt>Obtenido</dt><dd>${esc(r.obtenido)}</dd></dl></article>`).join('')}`;
  $('#btn-pruebas').addEventListener('click', renderPruebas);
}

/* ============================================================ coordinación */
const RENDER = { alternativas: renderAlternativas, resultados: renderResultados, decision: renderDecision, escenarios: renderEscenarios, modelo: renderModelo, pruebas: renderPruebas };
const renderizados = new Set();

function renderTab(tab) { if (RENDER[tab]) RENDER[tab](); }

function actualizar() {
  const e = leerEntradas();
  estado.e = e;
  estado.errores = validar(e);
  VARIABLES.forEach((v) => {
    const campo = $(`[data-var="${v.id}"]`), err = $(`#err-${v.id}`);
    const m = estado.errores.find((x) => x.id === v.id);
    campo.classList.toggle('invalido', !!m); err.hidden = !m; err.textContent = m ? m.msg : '';
    $(`#in-${v.id}`).setAttribute('aria-invalid', m ? 'true' : 'false');
  });
  const img = 100 - (e.pctXml || 0) - (e.pctPdf || 0);
  $('#der-img').textContent = Number.isFinite(img) ? n0(Math.max(0, img)) : '—';
  const suma = VARIABLES.filter((v) => v.grupo === 'pesos').reduce((t, v) => t + (Number.isFinite(e[v.id]) ? e[v.id] : 0), 0);
  $('#suma-pesos').textContent = `Suma de pesos: ${n0(suma)} (se normaliza a 100 %)`;
  estado.sim = estado.errores.length ? null : simular(e);
  renderResumen();
  if (estado.tab !== 'configurar') renderTab(estado.tab);
}

function activarTab(id, foco) {
  estado.tab = id;
  $$('[data-tab]').forEach((b) => { const on = b.dataset.tab === id; b.setAttribute('aria-selected', on); b.tabIndex = on ? 0 : -1; if (on && foco) b.focus(); });
  $$('[data-panel]').forEach((s) => { s.hidden = s.dataset.panel !== id; });
  renderTab(id);
  if (window.scrollY > 120) window.scrollTo({ top: 0 });
}

function iniciar() {
  for (const v of VARIABLES) {
    const num = $(`#in-${v.id}`), rg = $(`#rg-${v.id}`);
    num.addEventListener('input', () => { if (num.value !== '') rg.value = num.value; actualizar(); });
    rg.addEventListener('input', () => { num.value = rg.value; actualizar(); });
  }
  $('#btn-restablecer').addEventListener('click', () => { escribirEntradas(DEFAULTS); actualizar(); });
  const tabs = $$('[data-tab]');
  tabs.forEach((b, i) => {
    b.addEventListener('click', () => activarTab(b.dataset.tab));
    b.addEventListener('keydown', (ev) => {
      const k = { ArrowRight: 1, ArrowLeft: -1 }[ev.key];
      if (k) { ev.preventDefault(); activarTab(tabs[(i + k + tabs.length) % tabs.length].dataset.tab, true); }
    });
  });
  actualizar();
}
iniciar();
let anchoPrev = window.innerWidth, temporizador;
window.addEventListener('resize', () => {
  clearTimeout(temporizador);
  temporizador = setTimeout(() => { if (Math.abs(window.innerWidth - anchoPrev) > 20) { anchoPrev = window.innerWidth; if (estado.tab !== 'configurar' && estado.sim) renderTab(estado.tab); } }, 200);
});
