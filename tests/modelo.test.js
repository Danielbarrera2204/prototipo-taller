import test from 'node:test';
import assert from 'node:assert/strict';
import { ejecutarPruebas } from '../src/lib/pruebas.js';

for (const p of ejecutarPruebas()) {
  test(`${p.id} ${p.nombre}`, () => {
    assert.equal(p.ok, true, `esperado: ${p.esperado} | obtenido: ${p.obtenido}`);
  });
}
