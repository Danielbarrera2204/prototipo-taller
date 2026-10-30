// Parámetros del modelo. Cada valor es un SUPUESTO del equipo o proviene de una fuente citada.
// Etiquetas de origen: [F] fuente pública (verificar al sustentar) · [S] supuesto del equipo · [M] medir en el prototipo.

export const PARAMS = {
  calendario: { diasHabiles: 22, horasDia: 8 },            // [S] jornada laboral de las microempresas
  trm: 4000,                                               // [S] COP por USD, solo para mostrar equivalencia

  comun: {
    dbUSD: 30,                                             // [S] SQL administrado pequeño (Azure SQL / Cloud SQL)
    frontUSD: 20,                                          // [S] hosting del frontend (Vercel Pro)
    authGratisMAU: 50000,                                  // [F] Firebase Auth: capa gratuita
    authUSDporMAU: 0.0055,                                 // [F] Firebase/Identity Platform, excedente (verificar)
    actividadMAU: 0.8,                                     // [S] fracción de usuarios activos por mes
    dispDB: 0.9995,                                        // [F] SLA típico de SQL administrado con HA
    dispAuth: 0.9995,                                      // [F] SLA de Firebase Auth / Identity Platform
  },

  ia: {                                                    // Gemini API
    precioEntradaMTok: 0.30,                               // [F] USD / 1M tokens, gemini-2.5-flash (consulta 2026-10-25)
    precioSalidaMTok: 2.50,                                // [F] USD / 1M tokens, incluye tokens de razonamiento
    tokEntrada: { xml: 4000, pdf: 1800, img: 2000 },       // [S] tokens de entrada por factura (texto XML, 1-2 págs., foto)
    tokSalida: 450,                                        // [S] JSON con los campos extraídos
    tGemini: 3.5,                                          // [M] s por llamada con imagen/PDF. Reemplazar con la medición real
    factorTextoXml: 0.8,                                   // [S] llamada solo texto es más rápida
    rpm: 300,                                              // [S] cuota de solicitudes/minuto del plan de la API (verificar)
    disp: 0.995,                                           // [S] sin SLA formal verificado para este plan; supuesto conservador
    hMedioDificil: 1.5,                                    // [S] los casos escalados son más difíciles que el promedio
  },

  tiempos: {                                               // segundos de servicio, sin colas
    validacionGuardado: 0.3,                               // [S] reglas de coherencia + INSERT en SQL
    preprocesoImg: 0.5,                                    // [S] redimensionar/enderezar
    parseXml: 0.2,                                         // [S] lectura UBL 2.1
    parsePdf: 0.8,                                         // [S] PDF con texto + expresiones regulares
    ocrImg: 2.5,                                           // [S] OCR local en 2 vCPU
    reglasImg: 0.2,                                        // [S] reglas sobre el texto reconocido
    factorOcrMala: 1.3,                                    // [S] foto mala requiere más mejoras de imagen
  },

  // Tasa de facturas que requieren revisión manual, por clase de factura.
  revision: {
    gemini: { xml: 0.02, pdf: 0.05, imgBuena: 0.08, imgMala: 0.35 },   // [S] IA en todo
    localAprobada: { xml: 0.01, pdf: 0.06, imgBuena: 0.08, imgMala: 0.30 }, // [S] lo resuelto localmente con confianza alta
  },
  // Fracción de facturas que el pipeline híbrido escala a Gemini por baja confianza.
  escalamiento: { xml: 0.0, pdf: 0.10, imgBuena: 0.20, imgMala: 0.65 },  // [S]

  modelo: {
    rhoObjetivo: 0.70,                                     // utilización con la que se dimensiona
    rhoCritico: 0.85,                                      // por encima el sistema se considera al límite
    rhoSaturado: 0.95,                                     // por encima se declara saturado
    volumenMaxBusqueda: 1e9,
  },

  alternativas: {
    A: { instUSD: 30, slots: 8, instMax: 10, dispInst: 0.99, dispLB: 0.9999, esfuerzoSem: 1 },
    B: { instUSD: 45, slots: 2, instMax: 10, dispInst: 0.99, dispLB: 0.9999, esfuerzoSem: 4 },
    C: {
      fijoUSD: 15,                                         // [S] API Gateway, logs, secretos
      concurrencia: 1000,                                  // [F] límite por defecto de ejecuciones concurrentes de Lambda
      saltosCola: 2, latSaltoS: 0.4,                       // [S] ingesta→extracción→validación
      coldStartS: 2.0,                                     // [S] imagen de contenedor con OCR
      memGB: { xml: 0.5, pdf: 0.5, imgBuena: 2, imgMala: 2 },
      invocaciones: 3,
      precioMillonReq: 0.20,                               // [F] AWS Lambda
      precioGBs: 0.0000166667,                             // [F] AWS Lambda x86
      gratisReq: 1e6, gratisGBs: 400000,                   // [F] capa gratuita mensual
      otrosPorFactura: 8.4e-6,                             // [F] API GW 1.0 + SQS 6×0.4 + S3 PUT 5.0 (USD por millón)
      dispApi: 0.9995, dispS3: 0.999, dispCola: 0.999, dispLambda: 0.9995, // [F] SLA publicados
      absorcionReintentos: 0.8,                            // [S] fracción de caída del procesamiento absorbida por la cola
      esfuerzoSem: 8,
    },
  },
};
