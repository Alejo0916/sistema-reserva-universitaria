import { describe, expect, it } from 'vitest';
import {
  aMinutos,
  esFechaPasada,
  esFechaValida,
  formatearHora,
  fusionarIntervalos,
  minutosEntre,
  restarIntervalos,
  solapan,
  solapanTexto,
} from '../../src/domain/tiempo.js';

describe('aMinutos', () => {
  it('convierte una hora HH:MM en minutos desde la medianoche', () => {
    expect(aMinutos('00:00')).toBe(0);
    expect(aMinutos('08:00')).toBe(480);
    expect(aMinutos('13:37')).toBe(817);
    expect(aMinutos('23:59')).toBe(1439);
  });

  it('rechaza horas con formato invalido', () => {
    expect(() => aMinutos('24:00')).toThrow(/Hora invalida/);
    expect(() => aMinutos('8:00')).toThrow(/Hora invalida/);
    expect(() => aMinutos('08:60')).toThrow(/Hora invalida/);
    expect(() => aMinutos('0800')).toThrow(/Hora invalida/);
  });
});

describe('formatearHora', () => {
  it('convierte minutos en HH:MM con dos digitos', () => {
    expect(formatearHora(0)).toBe('00:00');
    expect(formatearHora(480)).toBe('08:00');
    expect(formatearHora(1439)).toBe('23:59');
  });

  it('rechaza minutos fuera de rango', () => {
    expect(() => formatearHora(-1)).toThrow(/Minutos invalidos/);
    expect(() => formatearHora(1440)).toThrow(/Minutos invalidos/);
    expect(() => formatearHora(10.5)).toThrow(/Minutos invalidos/);
  });
});

describe('minutosEntre', () => {
  it('calcula la duracion de una franja', () => {
    expect(minutosEntre('09:00', '10:30')).toBe(90);
    expect(minutosEntre('08:00', '22:00')).toBe(840);
    expect(minutosEntre('10:00', '10:15')).toBe(15);
  });

  it('devuelve un valor negativo si la franja esta invertida', () => {
    expect(minutosEntre('12:00', '10:00')).toBe(-120);
  });
});

describe('esFechaValida', () => {
  it('acepta fechas que existen en el calendario', () => {
    expect(esFechaValida('2026-03-16')).toBe(true);
    expect(esFechaValida('2024-02-29')).toBe(true);
    expect(esFechaValida('2026-12-31')).toBe(true);
  });

  it('rechaza fechas con formato invalido', () => {
    expect(esFechaValida('15-01-2026')).toBe(false);
    expect(esFechaValida('2026/03/16')).toBe(false);
    expect(esFechaValida('')).toBe(false);
    expect(esFechaValida('2026-3-16')).toBe(false);
  });

  it('rechaza fechas que no existen en el calendario', () => {
    expect(esFechaValida('2026-02-30')).toBe(false);
    expect(esFechaValida('2025-02-29')).toBe(false);
    expect(esFechaValida('2026-13-01')).toBe(false);
    expect(esFechaValida('2026-00-10')).toBe(false);
  });
});

describe('esFechaPasada', () => {
  it('compara la fecha con la referencia', () => {
    expect(esFechaPasada('2026-03-15', '2026-03-16')).toBe(true);
    expect(esFechaPasada('2026-03-16', '2026-03-16')).toBe(false);
    expect(esFechaPasada('2026-03-17', '2026-03-16')).toBe(false);
  });
});

describe('solapan', () => {
  it('detecta el solapamiento total', () => {
    expect(solapan({ inicio: 600, fin: 720 }, { inicio: 600, fin: 720 })).toBe(true);
  });

  it('detecta el solapamiento parcial en cualquiera de los dos extremos', () => {
    expect(solapan({ inicio: 600, fin: 720 }, { inicio: 660, fin: 780 })).toBe(true);
    expect(solapan({ inicio: 660, fin: 780 }, { inicio: 600, fin: 720 })).toBe(true);
  });

  it('detecta que una franja este contenida en otra', () => {
    expect(solapan({ inicio: 630, fin: 660 }, { inicio: 600, fin: 720 })).toBe(true);
  });

  it('NO considera solapadas las franjas que solo se tocan en un extremo', () => {
    expect(solapan({ inicio: 600, fin: 660 }, { inicio: 660, fin: 720 })).toBe(false);
    expect(solapan({ inicio: 660, fin: 720 }, { inicio: 600, fin: 660 })).toBe(false);
  });

  it('NO considera solapadas las franjas disjuntas', () => {
    expect(solapan({ inicio: 480, fin: 540 }, { inicio: 600, fin: 660 })).toBe(false);
  });

  it('opera sobre horas en formato texto', () => {
    expect(solapanTexto({ inicio: '10:00', fin: '12:00' }, { inicio: '11:00', fin: '13:00' })).toBe(true);
    expect(solapanTexto({ inicio: '10:00', fin: '11:00' }, { inicio: '11:00', fin: '12:00' })).toBe(false);
  });
});

describe('fusionarIntervalos', () => {
  it('fusiona intervalos solapados', () => {
    expect(
      fusionarIntervalos([
        { inicio: 600, fin: 720 },
        { inicio: 660, fin: 780 },
      ]),
    ).toEqual([{ inicio: 600, fin: 780 }]);
  });

  it('fusiona intervalos que se tocan en un extremo', () => {
    expect(
      fusionarIntervalos([
        { inicio: 600, fin: 660 },
        { inicio: 660, fin: 720 },
      ]),
    ).toEqual([{ inicio: 600, fin: 720 }]);
  });

  it('mantiene separados los intervalos disjuntos', () => {
    expect(
      fusionarIntervalos([
        { inicio: 600, fin: 660 },
        { inicio: 720, fin: 780 },
      ]),
    ).toEqual([
      { inicio: 600, fin: 660 },
      { inicio: 720, fin: 780 },
    ]);
  });

  it('ordena el resultado por hora de inicio', () => {
    expect(
      fusionarIntervalos([
        { inicio: 720, fin: 780 },
        { inicio: 600, fin: 660 },
      ]),
    ).toEqual([
      { inicio: 600, fin: 660 },
      { inicio: 720, fin: 780 },
    ]);
  });

  it('devuelve una lista vacia si no hay intervalos', () => {
    expect(fusionarIntervalos([])).toEqual([]);
  });
});

describe('restarIntervalos', () => {
  it('devuelve la franja completa si no hay ocupaciones', () => {
    expect(restarIntervalos({ inicio: 480, fin: 1320 }, [])).toEqual([{ inicio: 480, fin: 1320 }]);
  });

  it('divide la franja en dos cuando hay una ocupacion intermedia', () => {
    expect(restarIntervalos({ inicio: 480, fin: 1320 }, [{ inicio: 600, fin: 720 }])).toEqual([
      { inicio: 480, fin: 600 },
      { inicio: 720, fin: 1320 },
    ]);
  });

  it('devuelve la lista vacia si la franja esta completamente ocupada', () => {
    expect(restarIntervalos({ inicio: 480, fin: 720 }, [{ inicio: 480, fin: 720 }])).toEqual([]);
  });

  it('ignora las ocupaciones que quedan fuera de la franja', () => {
    expect(restarIntervalos({ inicio: 480, fin: 720 }, [{ inicio: 780, fin: 840 }])).toEqual([
      { inicio: 480, fin: 720 },
    ]);
  });
});
