// Modelo de simulación de KeepData. Funciones puras: mismas entradas → mismos resultados.
// Todos los resultados son ESTIMACIONES del modelo, no mediciones de rendimiento.

import { PARAMS } from './params.js';
import { VARIABLES } from './variables.js';

export const ALTS = ['A', 'B', 'C'];

export const CRITERIOS = [
  { id: 'costo', label: 'Costo', w: 'wCosto' },
  { id: 'tiempo', label: 'Tiempo por factura', w: 'wTiempo' },
  { id: 'revision', label: 'Confiabilidad', w: 'wRevision' },
  { id: 'disp', label: 'Disponibilidad', w: 'wDisp' },
  { id: 'escala', label: 'Escalabilidad', w: 'wEscala' },
  { id: 'privacidad', label: 'Privacidad', w: 'wPrivacidad' },
  { id: 'esfuerzo', label: 'Esfuerzo', w: 'wEsfuerzo' },
];

// ------------------------------------------------------------------ validación
export function validar(entradas) {
  const errores = [];
  for (const v of VARIABLES) {
    const x = entradas[v.id];
    if (x === '' || x === null || x === undefined || typeof x !== 'number' || !Number.isFinite(x)) {
      errores.push({ id: v.id, msg: `${v.label}: escribe un número.` });
      continue;
    }
    if (x < v.min || x > v.max) errores.push({ id: v.id, msg: `${v.label}: debe estar entre ${v.min} y ${v.max}.` });
    else if (v.entero && !Number.isInteger(x)) errores.push({ id: v.id, msg: `${v.label}: debe ser un número entero.` });
  }
  if (!errores.some((e) => e.id === 'pctXml' || e.id === 'pctPdf') && entradas.pctXml + entradas.pctPdf > 100)
    errores.push({ id: 'pctPdf', msg: 'XML + PDF no pueden superar 100 %. El resto son fotos.' });
  const sumaPesos = VARIABLES.filter((v) => v.grupo === 'pesos').reduce((s, v) => s + (Number.isFinite(entradas[v.id]) ? entradas[v.id] : 0), 0);
  if (!errores.some((e) => e.id.startsWith('w')) && sumaPesos <= 0) errores.push({ id: 'wCosto', msg: 'Los pesos no pueden ser todos cero.' });
  return errores;
}

// ------------------------------------------------------------------ utilidades del modelo
export function volumen(e) { return e.comercios * e.facturasPorComercio; }

export function lambdaSeg(F, e, P = PARAMS) {
  const { diasHabiles, horasDia } = P.calendario;
  return (F * e.factorPico) / (diasHabiles * horasDia * 3600); // facturas por segundo en el pico
}

// Aproximación de Sakasegawa para la espera en cola de un sistema M/M/c.
// Para c = 1 coincide exactamente con M/M/1: Wq = t·ρ/(1−ρ).
export function esperaCola(rho, c, t) {
  if (rho <= 0) return 0;
  const r = Math.min(rho, PARAMS.modelo.rhoSaturado);
  return (t * Math.pow(r, Math.sqrt(2 * (c + 1)) - 1)) / (c * (1 - r));
}

export function costoLlamada(clase, P = PARAMS) {
  const tipo = clase === 'xml' ? 'xml' : clase === 'pdf' ? 'pdf' : 'img';
  const { precioEntradaMTok, precioSalidaMTok, tokEntrada, tokSalida } = P.ia;
  return (tokEntrada[tipo] * precioEntradaMTok + tokSalida * precioSalidaMTok) / 1e6;
}

export function pesosClase(e) {
  const xml = e.pctXml / 100, pdf = e.pctPdf / 100, img = Math.max(0, 1 - xml - pdf), q = e.pctImgMala / 100;
  return { xml, pdf, imgBuena: img * (1 - q), imgMala: img * q };
}

// Perfil por clase de factura y por método de extracción.
// metodo 'gemini': toda factura pasa por IA.  metodo 'hibrido': proceso local con escalamiento a IA.
export function perfilClase(clase, metodo, P = PARAMS) {
  const T = P.tiempos, ia = P.ia, val = T.validacionGuardado;
  if (metodo === 'gemini') {
    const t = clase === 'xml' ? ia.tGemini * ia.factorTextoXml + val
      : clase === 'pdf' ? ia.tGemini + val
        : ia.tGemini + T.preprocesoImg + val;
    return { tLocal: 0, phi: 1, t, review: P.revision.gemini[clase], iaCoste: costoLlamada(clase, P) };
  }
  const tLocal = clase === 'xml' ? T.parseXml
    : clase === 'pdf' ? T.parsePdf
      : T.preprocesoImg + T.ocrImg * (clase === 'imgMala' ? T.factorOcrMala : 1) + T.reglasImg;
  const phi = P.escalamiento[clase];
  const rEsc = Math.min(1, ia.hMedioDificil * P.revision.gemini[clase]);
  return {
    tLocal, phi,
    t: tLocal + phi * ia.tGemini + val,
    review: (1 - phi) * P.revision.localAprobada[clase] + phi * rEsc,
    iaCoste: phi * costoLlamada(clase, P),
  };
}

function agregarPerfiles(e, metodo, P) {
  const w = pesosClase(e);
  const clases = ['xml', 'pdf', 'imgBuena', 'imgMala'];
  const perfiles = Object.fromEntries(clases.map((c) => [c, perfilClase(c, metodo, P)]));
  const sum = (f) => clases.reduce((s, c) => s + w[c] * f(perfiles[c], c), 0);
  return {
    w, perfiles,
    t: sum((p) => p.t), tLocal: sum((p) => p.tLocal), review: sum((p) => p.review),
    shareIA: sum((p) => p.phi), iaCoste: sum((p) => p.iaCoste),
  };
}

const dispIADep = (shareIA, P) => 1 - shareIA * (1 - P.ia.disp);

function costoAuth(e, P) {
  const mau = e.comercios * e.usuariosPorComercio * P.comun.actividadMAU;
  return Math.max(0, mau - P.comun.authGratisMAU) * P.comun.authUSDporMAU;
}

// ------------------------------------------------------------------ evaluación de una alternativa
export function evaluarAlternativa(id, e, F = volumen(e), P = PARAMS) {
  const metodo = id === 'A' ? 'gemini' : 'hibrido';
  const ag = agregarPerfiles(e, metodo, P);
  const lam = lambdaSeg(F, e, P);
  const lamIA = lam * ag.shareIA * 60; // solicitudes por minuto a Gemini en el pico
  const rhoIA = lamIA / P.ia.rpm;
  const comun = P.comun.dbUSD + P.comun.frontUSD + costoAuth(e, P);
  const dispComun = P.comun.dispDB * P.comun.dispAuth;
  const out = { id, metodo, F, tServicio: ag.t, review: ag.review, shareIA: ag.shareIA, lamIA, rhoIA, perfiles: ag.perfiles, pesos: ag.w };

  if (id === 'C') {
    const p = P.alternativas.C;
    const demanda = lam * (ag.t + p.saltosCola * p.latSaltoS);
    const c = p.concurrencia;
    const rhoC = demanda / c;
    const rho = Math.max(rhoC, rhoIA);
    const pCold = 0.05 + 0.45 * Math.exp(-(lam * 3600) / 60);
    const espera = esperaCola(rho, c, ag.t);
    out.tiempo = ag.t + p.saltosCola * p.latSaltoS + pCold * p.coldStartS + espera;
    out.pCold = pCold;
    // costo
    const clases = ['xml', 'pdf', 'imgBuena', 'imgMala'];
    const gbs = F * clases.reduce((s, k) => s + ag.w[k] * (ag.perfiles[k].tLocal + ag.perfiles[k].phi * P.ia.tGemini) * p.memGB[k], 0);
    const reqs = F * p.invocaciones;
    const lambdaUSD = Math.max(0, reqs - p.gratisReq) / 1e6 * p.precioMillonReq + Math.max(0, gbs - p.gratisGBs) * p.precioGBs;
    const otros = F * p.otrosPorFactura;
    out.costo = { comun, infra: p.fijoUSD + lambdaUSD + otros, ia: F * ag.iaCoste };
    out.instancias = null; out.concurrenciaMax = c;
    // disponibilidad: ingesta en serie; el procesamiento se desacopla con cola y reintentos
    const ingesta = p.dispApi * p.dispS3 * p.dispCola;
    const proc = p.dispLambda * dispIADep(ag.shareIA, P);
    const procEf = 1 - (1 - p.absorcionReintentos) * (1 - proc);
    out.disp = ingesta * procEf * dispComun;
    out.rho = rho;
    out.capacidadHora = Math.min(
      (P.modelo.rhoCritico * c) / (ag.t + p.saltosCola * p.latSaltoS) * 3600,
      ag.shareIA > 0 ? (P.modelo.rhoCritico * P.ia.rpm * 60) / ag.shareIA : Infinity);
    out.esfuerzo = p.esfuerzoSem;
  } else {
    const p = P.alternativas[id];
    const demanda = lam * ag.t; // slots ocupados en promedio
    const req = Math.ceil(demanda / (p.slots * P.modelo.rhoObjetivo));
    const inst = Math.min(Math.max(e.replicas, req, 1), p.instMax);
    const c = inst * p.slots;
    const rhoC = demanda / c;
    const rho = Math.max(rhoC, rhoIA);
    out.tiempo = ag.t + esperaCola(rho, c, ag.t);
    out.costo = { comun, infra: inst * p.instUSD, ia: F * ag.iaCoste };
    out.instancias = inst; out.instanciasRequeridas = req;
    const host = p.dispLB * (1 - Math.pow(1 - p.dispInst, inst));
    out.disp = host * dispComun * dispIADep(ag.shareIA, P);
    out.rho = rho;
    out.capacidadHora = Math.min(
      (P.modelo.rhoCritico * p.instMax * p.slots) / ag.t * 3600,
      ag.shareIA > 0 ? (P.modelo.rhoCritico * P.ia.rpm * 60) / ag.shareIA : Infinity);
    out.esfuerzo = p.esfuerzoSem;
  }
  out.costoTotal = out.costo.comun + out.costo.infra + out.costo.ia;
  out.costoPorFactura = F > 0 ? out.costoTotal / F : 0;
  out.saturado = out.rho >= P.modelo.rhoSaturado || (id !== 'C' && out.instanciasRequeridas > P.alternativas[id].instMax);
  out.privacidad = 1 - out.shareIA;
  return out;
}

// Volumen mensual máximo sin saturar y dentro del presupuesto (búsqueda binaria sobre el mismo modelo).
export function volumenMaximo(id, e, P = PARAMS) {
  const ok = (F) => {
    const r = evaluarAlternativa(id, e, F, P);
    return !r.saturado && r.rho < P.modelo.rhoCritico && r.costoTotal <= e.presupuesto;
  };
  if (!ok(1)) return 0;
  let lo = 1, hi = 2;
  while (hi < P.modelo.volumenMaxBusqueda && ok(hi)) { lo = hi; hi *= 2; }
  if (hi >= P.modelo.volumenMaxBusqueda && ok(hi)) return P.modelo.volumenMaxBusqueda;
  for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (ok(m)) lo = m; else hi = m; }
  return lo;
}

// ------------------------------------------------------------------ requisitos obligatorios
export function verificarRequisitos(r, e) {
  const chequeos = [
    { id: 'presupuesto', label: 'Presupuesto', valor: r.costoTotal, limite: e.presupuesto, cumple: r.costoTotal <= e.presupuesto, fmt: 'usd', tipo: 'max' },
    { id: 'disp', label: 'Disponibilidad', valor: r.disp * 100, limite: e.dispMin, cumple: r.disp * 100 >= e.dispMin, fmt: 'pct3', tipo: 'min' },
    { id: 'tiempo', label: 'Tiempo por factura', valor: r.tiempo, limite: e.tiempoMax, cumple: r.tiempo <= e.tiempoMax && !r.saturado, fmt: 's', tipo: 'max' },
    { id: 'revision', label: 'Revisión manual', valor: r.review * 100, limite: e.revisionMax, cumple: r.review * 100 <= e.revisionMax, fmt: 'pct1', tipo: 'max' },
    { id: 'privacidad', label: 'Datos a IA externa', valor: r.shareIA * 100, limite: e.iaExternaMax, cumple: r.shareIA * 100 <= e.iaExternaMax + 1e-9, fmt: 'pct1', tipo: 'max' },
    { id: 'esfuerzo', label: 'Plazo de desarrollo', valor: r.esfuerzo, limite: e.semanas, cumple: r.esfuerzo <= e.semanas, fmt: 'sem', tipo: 'max' },
    { id: 'capacidad', label: 'Capacidad en el pico', valor: r.rho * 100, limite: PARAMS.modelo.rhoSaturado * 100, cumple: !r.saturado, fmt: 'pct1', tipo: 'max' },
  ];
  const violacion = chequeos.reduce((s, c) => {
    if (c.cumple) return s;
    const rel = c.tipo === 'max' ? (c.valor - c.limite) / Math.max(c.limite, 1e-9) : (c.limite - c.valor) / Math.max(c.limite, 1e-9);
    return s + Math.max(0, rel);
  }, 0);
  return { chequeos, cumpleTodo: chequeos.every((c) => c.cumple), violacion };
}

// ------------------------------------------------------------------ puntaje ponderado
export function puntuar(resultados, e) {
  const nueves = (a) => -Math.log10(Math.max(1e-9, 1 - a));
  const crudo = {
    costo: (r) => r.costoTotal, tiempo: (r) => r.tiempo, revision: (r) => r.review,
    disp: (r) => nueves(r.disp), escala: (r) => Math.min(r.margen, 20), privacidad: (r) => r.privacidad, esfuerzo: (r) => r.esfuerzo,
  };
  const mayorEsMejor = { disp: true, escala: true, privacidad: true };
  const suma = CRITERIOS.reduce((s, c) => s + e[c.w], 0);
  const norm = {};
  for (const c of CRITERIOS) {
    const vals = ALTS.map((a) => crudo[c.id](resultados[a]));
    const best = mayorEsMejor[c.id] ? Math.max(...vals) : Math.min(...vals);
    norm[c.id] = {};
    ALTS.forEach((a, i) => {
      const v = vals[i];
      let s;
      if (mayorEsMejor[c.id]) s = best > 0 ? v / best : 1;
      else s = v > 0 ? best / v : 1;
      norm[c.id][a] = Math.max(0, Math.min(1, s));
    });
  }
  const puntajes = {};
  for (const a of ALTS) {
    const aporte = {};
    let total = 0;
    for (const c of CRITERIOS) { aporte[c.id] = (e[c.w] / suma) * norm[c.id][a] * 100; total += aporte[c.id]; }
    puntajes[a] = { total, aporte };
  }
  return { norm, puntajes };
}

// ------------------------------------------------------------------ simulación completa
export function simular(e, P = PARAMS) {
  const errores = validar(e);
  if (errores.length) return { errores };
  const F = volumen(e);
  const resultados = {};
  for (const a of ALTS) {
    const r = evaluarAlternativa(a, e, F, P);
    r.volMax = volumenMaximo(a, e, P);
    r.margen = F > 0 ? r.volMax / F : 0;
    r.mesesLimite = r.volMax <= 0 || r.margen < 1 ? 0
      : e.crecimiento > 0 ? Math.log(r.margen) / Math.log(1 + e.crecimiento / 100) : Infinity;
    r.req = verificarRequisitos(r, e);
    resultados[a] = r;
  }
  const { norm, puntajes } = puntuar(resultados, e);
  const factibles = ALTS.filter((a) => resultados[a].req.cumpleTodo);
  let recomendada = null, modo = 'ninguna';
  if (factibles.length) {
    recomendada = factibles.reduce((m, a) => (puntajes[a].total > puntajes[m].total + 1e-9 ||
      (Math.abs(puntajes[a].total - puntajes[m].total) <= 1e-9 && resultados[a].costoTotal < resultados[m].costoTotal) ? a : m));
    modo = 'cumple';
  } else {
    recomendada = ALTS.reduce((m, a) => (resultados[a].req.violacion < resultados[m].req.violacion ? a : m));
    modo = 'mejorEsfuerzo';
  }
  const ranking = [...ALTS].sort((a, b) => puntajes[b].total - puntajes[a].total);
  return { errores: [], F, resultados, norm, puntajes, factibles, recomendada, modo, ranking };
}

// ------------------------------------------------------------------ análisis de sensibilidad
export function barridoVolumen(e, desde, hasta, n = 28, P = PARAMS) {
  const puntos = [];
  for (let i = 0; i < n; i++) {
    const F = desde * Math.pow(hasta / desde, i / (n - 1));
    const comerciosEq = Math.max(1, Math.round(F / e.facturasPorComercio));
    const e2 = { ...e, comercios: comerciosEq };
    const s = simular(e2, P);
    if (s.errores.length) continue;
    puntos.push({
      F: s.F,
      costo: Object.fromEntries(ALTS.map((a) => [a, s.resultados[a].costoTotal])),
      tiempo: Object.fromEntries(ALTS.map((a) => [a, s.resultados[a].tiempo])),
      ganador: s.recomendada, modo: s.modo,
    });
  }
  return puntos;
}

// ------------------------------------------------------------------ explicación de la recomendación
export function explicar(sim, e) {
  const { resultados: R, puntajes: S, recomendada: rec, modo, ranking } = sim;
  const nombre = { A: 'A · Monolito con IA para todo', B: 'B · Monolito modular híbrido', C: 'C · Serverless con cola' };
  const lineas = { titulo: '', ventajas: [], limitaciones: [], supuestos: [], descartadas: [] };
  const mejoresCriterios = CRITERIOS.map((c) => ({ c, v: sim.norm[c.id][rec] })).sort((a, b) => b.v - a.v);
  for (const a of ALTS) {
    if (a === rec) continue;
    const malos = R[a].req.chequeos.filter((c) => !c.cumple).map((c) => c.label.toLowerCase());
    if (malos.length) lineas.descartadas.push({ id: a, nombre: nombre[a], motivos: malos });
  }
  if (modo === 'ninguna' || modo === 'mejorEsfuerzo') {
    const fallos = R[rec].req.chequeos.filter((c) => !c.cumple).map((c) => c.label.toLowerCase());
    lineas.titulo = `Ninguna alternativa cumple todos los requisitos. La más cercana es ${nombre[rec]}, que incumple: ${fallos.join(', ')}.`;
    lineas.ventajas.push('Relaja los requisitos incumplidos (presupuesto, plazo o disponibilidad) o ajusta las variables del proyecto para obtener una recomendación válida.');
  } else {
    const margen = ranking.length > 1 ? S[rec].total - Math.max(...ranking.filter((a) => a !== rec && R[a].req.cumpleTodo).map((a) => S[a].total), -Infinity) : null;
    lineas.titulo = `Se recomienda ${nombre[rec]} con ${S[rec].total.toFixed(1)} de 100 puntos` +
      (Number.isFinite(margen) ? (margen < 5 ? `: ventaja de solo ${margen.toFixed(1)} puntos sobre la siguiente, decisión ajustada.` : `, ${margen.toFixed(1)} puntos por encima de la siguiente opción que cumple.`) : '. Es la única que cumple todos los requisitos obligatorios.');
    mejoresCriterios.slice(0, 3).forEach(({ c, v }) => {
      if (v >= 0.85 && e[c.w] > 0) lineas.ventajas.push(`${c.label}: está entre las mejores (${(v * 100).toFixed(0)} % de la mejor alternativa en este criterio, peso ${e[c.w]}).`);
    });
    if (!lineas.ventajas.length) lineas.ventajas.push('Ningún criterio destaca por sí solo: gana por equilibrio entre criterios.');
  }
  const peores = mejoresCriterios.slice().reverse().filter(({ v, c }) => v < 0.7 && e[c.w] > 0).slice(0, 2);
  peores.forEach(({ c, v }) => lineas.limitaciones.push(`${c.label}: queda al ${(v * 100).toFixed(0)} % de la mejor alternativa en este criterio.`));
  const r = R[rec];
  if (r.rho >= PARAMS.modelo.rhoCritico) lineas.limitaciones.push('Trabaja cerca de su límite de capacidad en el pico.');
  if (Number.isFinite(r.mesesLimite) && r.mesesLimite < 12) lineas.limitaciones.push(`Con ${e.crecimiento} % de crecimiento mensual llegaría a su límite en ${r.mesesLimite.toFixed(1)} meses.`);
  if (!lineas.limitaciones.length) lineas.limitaciones.push('No se detectaron limitaciones relevantes con las variables actuales.');
  lineas.supuestos.push(
    `Tiempo de cada llamada a Gemini: ${PARAMS.ia.tGemini} s (dato por medir en el prototipo).`,
    `Cuota de Gemini: ${PARAMS.ia.rpm} solicitudes por minuto y disponibilidad de ${(PARAMS.ia.disp * 100).toFixed(1)} %.`,
    'Tasas de revisión y de escalamiento a IA: supuestos del equipo, calibrados solo con 5 facturas reales.',
  );
  return lineas;
}
