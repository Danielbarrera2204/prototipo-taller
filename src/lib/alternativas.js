// Descripción documentada de las tres alternativas arquitectónicas.
export const ALTERNATIVAS = {
  A: {
    id: 'A',
    nombre: 'Monolito por capas con IA para todo',
    corto: 'Monolito + IA',
    resumen: 'Lo que describe el avance del proyecto: un backend .NET por capas donde todo formato (XML, PDF o foto) se envía a Gemini para extraer los campos.',
    pipeline: [
      ['XML', 'Se envía el texto del XML a Gemini'],
      ['PDF', 'Se envía el PDF a Gemini'],
      ['Foto', 'Preproceso de imagen y envío a Gemini'],
    ],
    fortalezas: ['La más simple de construir y de operar: casi ya está hecha.', 'Buena precisión en facturas difíciles, porque la IA ve todo.', 'Un solo despliegue y un solo código.'],
    debilidades: ['El costo crece con cada factura, incluso las XML que no necesitan IA.', 'Si Gemini falla o se limita su cuota, no se procesa nada nuevo.', 'Todas las facturas salen a un tercero (privacidad).'],
    escalamiento: 'Se agregan instancias del backend; el límite práctico lo pone la cuota de solicitudes por minuto de Gemini.',
  },
  B: {
    id: 'B',
    nombre: 'Monolito modular con pipeline híbrido',
    corto: 'Monolito híbrido',
    resumen: 'El mismo backend por capas, pero con un módulo de procesamiento que resuelve primero de forma local (lectura de XML, texto de PDF, OCR de fotos) y usa Gemini solo cuando la confianza es baja.',
    pipeline: [
      ['XML', 'Lectura local del estándar UBL 2.1, sin IA'],
      ['PDF', 'Texto y expresiones regulares; Gemini si la confianza baja'],
      ['Foto', 'OCR local y reglas; Gemini si la confianza baja'],
    ],
    fortalezas: ['Menor costo de IA y menor dependencia de Gemini.', 'XML y PDF con texto siguen funcionando aunque falle la IA.', 'Menos facturas salen a un tercero.'],
    debilidades: ['Más código propio por mantener (parsers, OCR, umbrales de confianza).', 'El OCR consume CPU y exige servidores más grandes.', 'Algo más de revisión manual que la IA en todo.'],
    escalamiento: 'Se agregan instancias del backend; el OCR local limita cuántas fotos procesa cada instancia.',
  },
  C: {
    id: 'C',
    nombre: 'Serverless con cola asíncrona',
    corto: 'Serverless + cola',
    resumen: 'El mismo pipeline híbrido, pero cada etapa (ingesta, extracción, validación) es una función conectada por una cola de mensajes. El usuario sube la factura y recibe los datos cuando termina.',
    pipeline: [
      ['XML', 'Función de extracción con lectura local'],
      ['PDF', 'Función de extracción; Gemini si la confianza baja'],
      ['Foto', 'Función con OCR en imagen de contenedor; Gemini si baja'],
    ],
    fortalezas: ['Paga por uso: muy barata con poco volumen y escala sola ante picos.', 'La cola absorbe caídas temporales de la IA: las facturas esperan y se reintentan.', 'Procesa muchas facturas en paralelo sin servidores que dimensionar.'],
    debilidades: ['La más compleja de construir y depurar para un equipo de tres personas.', 'Arranques en frío y saltos de cola suman tiempo con poco tráfico.', 'Más componentes en serie: más piezas que pueden fallar.'],
    escalamiento: 'Las funciones se ejecutan en paralelo hasta el límite de concurrencia de la cuenta (1.000 por defecto en AWS Lambda).',
  },
};
