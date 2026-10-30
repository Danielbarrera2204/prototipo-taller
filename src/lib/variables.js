// Definición de variables de entrada: rango, valor por defecto y justificación.
// Se usa para dibujar el formulario y para validar las entradas.

export const GRUPOS = {
  proyecto: 'Variables del proyecto',
  requisitos: 'Requisitos obligatorios y restricciones',
  pesos: 'Pesos de los criterios de decisión',
};

export const VARIABLES = [
  // ---- Variables del proyecto (entradas de simulación)
  { id: 'comercios', grupo: 'proyecto', label: 'Comercios activos', unidad: 'comercios', min: 1, max: 100000, step: 1, def: 40, entero: true,
    just: 'Es la base de usuarios prevista (microempresas). Multiplica el volumen mensual y define cuántas cuentas hay en Firebase Auth.' },
  { id: 'usuariosPorComercio', grupo: 'proyecto', label: 'Usuarios por comercio', unidad: 'usuarios', min: 1, max: 100, step: 1, def: 3, entero: true,
    just: 'Cada comercio tiene un administrador y algunos empleados. Entra al costo de autenticación solo cuando se supera la capa gratuita.' },
  { id: 'facturasPorComercio', grupo: 'proyecto', label: 'Facturas por comercio al mes', unidad: 'facturas', min: 1, max: 10000, step: 1, def: 100, entero: true,
    just: 'Con los comercios fija el volumen mensual F. F determina el costo de IA, la carga en pico y la capacidad requerida.' },
  { id: 'pctXml', grupo: 'proyecto', label: 'Facturas en XML', unidad: '%', min: 0, max: 100, step: 1, def: 30,
    just: 'El XML (UBL 2.1) es estructurado: casi no necesita IA. Cambia el tiempo, el costo y la tasa de revisión de cada alternativa.' },
  { id: 'pctPdf', grupo: 'proyecto', label: 'Facturas en PDF', unidad: '%', min: 0, max: 100, step: 1, def: 40,
    just: 'PDF con texto. El resto de la mezcla (100 − XML − PDF) son fotos o imágenes, el formato más costoso y propenso a errores.' },
  { id: 'pctImgMala', grupo: 'proyecto', label: 'Fotos de mala calidad', unidad: '% de las fotos', min: 0, max: 100, step: 1, def: 25,
    just: 'Foto borrosa, con poca luz o incompleta. Sube la tasa de revisión y obliga al pipeline híbrido a escalar más casos a Gemini.' },
  { id: 'factorPico', grupo: 'proyecto', label: 'Factor de pico', unidad: '× el promedio por hora', min: 1, max: 50, step: 0.5, def: 6,
    just: 'Las facturas se concentran en cierres de mes y declaraciones. Define la carga simultánea que debe resistir el sistema.' },
  { id: 'crecimiento', grupo: 'proyecto', label: 'Crecimiento mensual esperado', unidad: '% por mes', min: -50, max: 100, step: 1, def: 8,
    just: 'Convierte la capacidad restante en meses hasta llegar al límite de presupuesto o de capacidad.' },

  // ---- Requisitos obligatorios
  { id: 'presupuesto', grupo: 'requisitos', label: 'Presupuesto máximo', unidad: 'USD/mes', min: 1, max: 1000000, step: 5, def: 150,
    just: 'Restricción económica del proyecto. Una alternativa que lo supera queda descartada.' },
  { id: 'dispMin', grupo: 'requisitos', label: 'Disponibilidad mínima', unidad: '%', min: 90, max: 99.999, step: 0.01, def: 99.0,
    just: 'Requisito de calidad: la microempresa debe poder cargar facturas durante la jornada.' },
  { id: 'tiempoMax', grupo: 'requisitos', label: 'Tiempo máximo por factura (en pico)', unidad: 's', min: 1, max: 600, step: 1, def: 15,
    just: 'Requisito de calidad: el usuario espera con la factura abierta para revisarla.' },
  { id: 'revisionMax', grupo: 'requisitos', label: 'Revisión manual máxima', unidad: '% de facturas', min: 0, max: 100, step: 0.5, def: 15,
    just: 'Requisito de confiabilidad: demasiadas facturas por revisar anulan el ahorro de la automatización.' },
  { id: 'iaExternaMax', grupo: 'requisitos', label: 'Facturas que pueden salir a IA externa', unidad: '% máx.', min: 0, max: 100, step: 1, def: 100,
    just: 'Restricción de privacidad (datos de proveedores y NIT). 100 % = sin restricción.' },
  { id: 'semanas', grupo: 'requisitos', label: 'Semanas disponibles de desarrollo', unidad: 'semanas', min: 0.5, max: 52, step: 0.5, def: 6,
    just: 'Restricción de plazo: el equipo tiene tiempo y personas limitados. Se compara con el esfuerzo de cada alternativa.' },
  { id: 'replicas', grupo: 'requisitos', label: 'Réplicas mínimas del backend', unidad: 'instancias', min: 1, max: 5, step: 1, def: 2, entero: true,
    just: 'Redundancia exigida a las alternativas con servidor (A y B). Sube la disponibilidad y el costo fijo.' },

  // ---- Pesos
  { id: 'wCosto', grupo: 'pesos', label: 'Costo', unidad: 'peso', min: 0, max: 100, step: 1, def: 25, just: 'Costo mensual total estimado.' },
  { id: 'wTiempo', grupo: 'pesos', label: 'Tiempo por factura', unidad: 'peso', min: 0, max: 100, step: 1, def: 15, just: 'Tiempo promedio hasta tener los campos listos, en pico.' },
  { id: 'wRevision', grupo: 'pesos', label: 'Confiabilidad (menos revisión)', unidad: 'peso', min: 0, max: 100, step: 1, def: 25, just: 'Menor porcentaje de facturas enviadas a revisión manual.' },
  { id: 'wDisp', grupo: 'pesos', label: 'Disponibilidad', unidad: 'peso', min: 0, max: 100, step: 1, def: 15, just: 'Medida en «nueves» de disponibilidad.' },
  { id: 'wEscala', grupo: 'pesos', label: 'Escalabilidad', unidad: 'peso', min: 0, max: 100, step: 1, def: 10, just: 'Cuántas veces puede crecer el volumen actual dentro del presupuesto y la capacidad.' },
  { id: 'wPrivacidad', grupo: 'pesos', label: 'Privacidad', unidad: 'peso', min: 0, max: 100, step: 1, def: 5, just: 'Menor proporción de facturas enviadas a IA externa.' },
  { id: 'wEsfuerzo', grupo: 'pesos', label: 'Esfuerzo de implementación', unidad: 'peso', min: 0, max: 100, step: 1, def: 5, just: 'Menos semanas de desarrollo y operación.' },
];

export const DEFAULTS = Object.fromEntries(VARIABLES.map((v) => [v.id, v.def]));

// Escenarios predefinidos: solo cambian variables sobre el escenario base.
export const ESCENARIOS = [
  { id: 'base', nombre: 'Base: piloto', descripcion: '40 comercios, 100 facturas cada uno, presupuesto de 150 USD y 6 semanas de desarrollo.', cambios: {} },
  { id: 'regional', nombre: 'Crecimiento regional', descripcion: '1.200 comercios, más presupuesto y 12 semanas: el producto escala a varias ciudades.',
    cambios: { comercios: 1200, facturasPorComercio: 150, presupuesto: 500, semanas: 12, crecimiento: 10 } },
  { id: 'cierre', nombre: 'Cierre de mes con picos fuertes', descripcion: '400 comercios con 200 facturas, picos 30 veces el promedio y presupuesto de 300 USD.',
    cambios: { comercios: 400, facturasPorComercio: 200, factorPico: 30, presupuesto: 300 } },
  { id: 'fotos', nombre: 'Predominan las fotos malas', descripcion: '70 % de las facturas llegan como foto y 60 % de ellas es de mala calidad. Se exige poca revisión manual.',
    cambios: { pctXml: 10, pctPdf: 20, pctImgMala: 60, revisionMax: 25, presupuesto: 250 } },
  { id: 'privacidad', nombre: 'Privacidad estricta', descripcion: 'Solo el 25 % de las facturas puede salir a una IA externa.',
    cambios: { iaExternaMax: 25, presupuesto: 250 } },
  { id: 'recorte', nombre: 'Recorte de presupuesto', descripcion: 'Presupuesto de 90 USD, sin réplica del backend y disponibilidad mínima de 97,5 %.',
    cambios: { presupuesto: 90, replicas: 1, dispMin: 97.5 } },
];
