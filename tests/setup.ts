import { afterEach } from 'vitest';

/**
 * Cada archivo de prueba trabaja con su propia base de datos en memoria y
 * su propia aplicacion Express, de modo que las pruebas son aisladas y
 * ejecutables en cualquier orden.
 */
afterEach(() => {
  // Punto de extension: los archivos de prueba cierran sus propios recursos.
});
