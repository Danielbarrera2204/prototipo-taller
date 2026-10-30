// Pruebas del modelo. Se ejecutan en el navegador (pestaña «Pruebas») y con `npm test`.
import { PARAMS } from './params.js';
import { DEFAULTS, ESCENARIOS } from './variables.js';
import { simular, validar, esperaCola, evaluarAlternativa, volumenMaximo, volumen, ALTS } from './model.js';

const base = () => ({ ...DEFAULTS });
const cerca = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
const f = (x, d = 4) => (typeof x === 'number' ? Number(x.toFixed(d)) : x);

export function ejecutarPruebas() {
  const pruebas = [];
  const agregar = (id, nombre, objetivo, fn) => {
    try { const { esperado, obtenido, ok } = fn(); pruebas.push({ id, nombre, objetivo, esperado, obtenido, ok }); }
    catch (err) { pruebas.push({ id, nombre, objetivo, esperado: 'sin errores', obtenido: String(err), ok: false }); }
  };

  agregar('P1', 'Rechazo de entradas inválidas', 'El simulador detecta valores negativos, vacíos, fuera de rango y mezclas que superan 100 %.', () => {
    const casos = [
      { ...base(), comercios: -5 },
      { ...base(), facturasPorComercio: NaN },
      { ...base(), pctXml: 70, pctPdf: 50 },
      { ...base(), replicas: 2.5 },
      { ...base(), wCosto: 0, wTiempo: 0, wRevision: 0, wDisp: 0, wEscala: 0, wPrivacidad: 0, wEsfuerzo: 0 },
    ];
    const n = casos.map((c) => validar(c).length > 0 && simular(c).errores.length > 0);
    return { esperado: '5 de 5 casos rechazados', obtenido: `${n.filter(Boolean).length} de 5 casos rechazados`, ok: n.every(Boolean) };
  });

  agregar('P2', 'El costo y el tiempo crecen con el volumen', 'Al duplicar las facturas, el costo mensual de cada alternativa sube y el tiempo en el pico de A y B no baja (en C puede bajar: hay menos arranques en frío).', () => {
    const e = base(); const F = volumen(e);
    const det = ALTS.map((a) => {
      const r1 = evaluarAlternativa(a, e, F), r2 = evaluarAlternativa(a, e, 2 * F);
      // En C el tiempo puede bajar: con más tráfico hay menos arranques en frío.
      return { a, ok: r2.costoTotal > r1.costoTotal && (a === 'C' || r2.tiempo >= r1.tiempo - 1e-9) };
    });
    return { esperado: 'costo(2F) > costo(F) en A, B y C; tiempo(2F) ≥ tiempo(F) en A y B', obtenido: det.map((d) => `${d.a}: ${d.ok ? 'sí' : 'no'}`).join(' · '), ok: det.every((d) => d.ok) };
  });

  agregar('P3', 'Espera en cola consistente con M/M/1', 'Con un solo servidor la aproximación coincide con la fórmula exacta t·ρ/(1−ρ).', () => {
    const obt = esperaCola(0.8, 1, 2), esp = (2 * 0.8) / (1 - 0.8);
    return { esperado: f(esp), obtenido: f(obt), ok: cerca(obt, esp) };
  });

  agregar('P4', 'Disponibilidad en serie calculada a mano', 'La disponibilidad de A con 2 réplicas es LB × (1 − (1 − Ainst)²) × BD × Auth × (1 − (1 − Agemini)).', () => {
    const e = { ...base(), replicas: 2 };
    const p = PARAMS.alternativas.A;
    const esp = p.dispLB * (1 - Math.pow(1 - p.dispInst, 2)) * PARAMS.comun.dispDB * PARAMS.comun.dispAuth * PARAMS.ia.disp;
    const obt = evaluarAlternativa('A', e).disp;
    return { esperado: f(esp, 6), obtenido: f(obt, 6), ok: cerca(obt, esp, 1e-9) };
  });

  agregar('P5', 'El costo de IA es lineal en el volumen', 'En A, duplicar las facturas duplica exactamente el costo de llamadas a Gemini.', () => {
    const e = base(); const F = volumen(e);
    const c1 = evaluarAlternativa('A', e, F).costo.ia, c2 = evaluarAlternativa('A', e, 2 * F).costo.ia;
    return { esperado: `${f(2 * c1, 4)} USD`, obtenido: `${f(c2, 4)} USD`, ok: cerca(c2, 2 * c1) };
  });

  agregar('P6', 'Con solo XML el híbrido no usa IA', 'Con 100 % XML, B y C no envían nada a Gemini, su costo de IA es 0 y B es más rápida que A.', () => {
    const e = { ...base(), pctXml: 100, pctPdf: 0 };
    const A = evaluarAlternativa('A', e), B = evaluarAlternativa('B', e), C = evaluarAlternativa('C', e);
    const ok = B.shareIA === 0 && C.shareIA === 0 && B.costo.ia === 0 && B.tiempo < A.tiempo;
    return { esperado: 'IA externa B = 0 %, costo IA B = 0, tiempo B < tiempo A', obtenido: `IA externa B = ${f(B.shareIA * 100, 1)} %, costo IA B = ${f(B.costo.ia, 2)}, tiempo B = ${f(B.tiempo, 2)} s, tiempo A = ${f(A.tiempo, 2)} s`, ok };
  });

  agregar('P7', 'Filtro eliminatorio por presupuesto', 'Con presupuesto de 1 USD ninguna alternativa cumple y el simulador no declara una recomendación válida.', () => {
    const s = simular({ ...base(), presupuesto: 1 });
    const ok = s.factibles.length === 0 && s.modo === 'mejorEsfuerzo';
    return { esperado: '0 alternativas factibles y modo «mejor esfuerzo»', obtenido: `${s.factibles.length} factibles y modo «${s.modo}»`, ok };
  });

  agregar('P8', 'Recomendación coherente con el puntaje', 'La alternativa recomendada es la de mayor puntaje entre las que cumplen todos los requisitos.', () => {
    const verif = ESCENARIOS.map((sc) => {
      const s = simular({ ...base(), ...sc.cambios });
      if (s.modo !== 'cumple') return true;
      const mejor = s.factibles.reduce((m, a) => (s.puntajes[a].total > s.puntajes[m].total ? a : m));
      return mejor === s.recomendada;
    });
    return { esperado: `${ESCENARIOS.length} de ${ESCENARIOS.length} escenarios coherentes`, obtenido: `${verif.filter(Boolean).length} de ${ESCENARIOS.length}`, ok: verif.every(Boolean) };
  });

  agregar('P9', 'Volumen máximo consistente con el presupuesto', 'El costo en el volumen máximo no supera el presupuesto y un 5 % más de volumen sí lo supera o satura el sistema.', () => {
    const e = base();
    const det = ALTS.map((a) => {
      const vm = volumenMaximo(a, e);
      const r0 = evaluarAlternativa(a, e, vm), r1 = evaluarAlternativa(a, e, vm * 1.05);
      return { a, ok: r0.costoTotal <= e.presupuesto + 1e-6 && (r1.costoTotal > e.presupuesto || r1.saturado || r1.rho >= PARAMS.modelo.rhoCritico) };
    });
    return { esperado: 'cumple en A, B y C', obtenido: det.map((d) => `${d.a}: ${d.ok ? 'sí' : 'no'}`).join(' · '), ok: det.every((d) => d.ok) };
  });

  agregar('P10', 'Restricción de privacidad', 'Con un máximo de 25 % de facturas a IA externa, A (100 % a Gemini) queda descartada.', () => {
    const s = simular({ ...base(), iaExternaMax: 25 });
    const ok = cerca(s.resultados.A.shareIA, 1) && !s.resultados.A.req.cumpleTodo && s.recomendada !== 'A';
    return { esperado: 'A descartada y no recomendada', obtenido: `A cumple: ${s.resultados.A.req.cumpleTodo ? 'sí' : 'no'} · recomendada: ${s.recomendada}`, ok };
  });

  agregar('P11', 'Los pesos cambian la decisión, no los indicadores', 'Cambiar solo los pesos no altera costo ni tiempo, pero sí puede alterar el puntaje.', () => {
    const s1 = simular(base());
    const s2 = simular({ ...base(), wCosto: 100, wTiempo: 0, wRevision: 0, wDisp: 0, wEscala: 0, wPrivacidad: 0, wEsfuerzo: 0 });
    const igual = ALTS.every((a) => s1.resultados[a].costoTotal === s2.resultados[a].costoTotal && s1.resultados[a].tiempo === s2.resultados[a].tiempo);
    const cambia = ALTS.some((a) => Math.abs(s1.puntajes[a].total - s2.puntajes[a].total) > 1);
    return { esperado: 'indicadores idénticos y puntajes distintos', obtenido: `indicadores ${igual ? 'idénticos' : 'distintos'} · puntajes ${cambia ? 'distintos' : 'iguales'}`, ok: igual && cambia };
  });

  agregar('P12', 'Los escenarios producen decisiones distintas', 'Al ejecutar los escenarios predefinidos, la recomendación cambia con las variables (al menos 3 alternativas distintas).', () => {
    const rec = ESCENARIOS.map((sc) => simular({ ...base(), ...sc.cambios }).recomendada);
    const distintas = new Set(rec);
    return { esperado: '≥ 3 alternativas recomendadas distintas', obtenido: `${distintas.size} distintas (${rec.join(', ')})`, ok: distintas.size >= 3 };
  });

  return pruebas;
}
