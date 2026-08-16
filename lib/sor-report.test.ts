import {
  describe,
  expect,
  it,
} from 'vitest';

import type {
  SorResult,
  TracePoint,
} from 'sor-reader';

import {
  downsampleTrace,
  extractSorEvents,
  formatFileSize,
  safePdfFilename,
  traceBounds,
  traceToSvgPoints,
} from './sor-report';

function mockSorResult(): SorResult {
  return {
    filename:
      'trace.sor',
    format: 2,
    version: '2.00',
    mapblock: {
      nbytes: 0,
      nblocks: 0,
    },
    blocks: {},
    GenParams: {
      language: 'EN',
      'cable ID': 'CBL-1',
      'fiber ID': 'F01',
      wavelength:
        '1310 nm',
      'location A': 'A',
      'location B': 'B',
      'cable code/fiber type':
        '',
      'build condition': '',
      operator: 'NOC',
      comments: '',
      'user offset': '',
    },
    SupParams: {
      supplier: 'Vendor',
      OTDR: 'Model',
      'OTDR S/N': '123',
      module: '',
      'module S/N': '',
      software: '',
      other: '',
    },
    FxdParams: {
      'date/time':
        '2026-08-16 10:00',
      unit: 'km',
      wavelength:
        '1310 nm',
      'acquisition offset': 0,
      'number of pulse width entries':
        1,
      'pulse width': '100 ns',
      'sample spacing':
        '1.0 m',
      'num data points':
        3,
      index: '1.468000',
      BC: '0',
      'num averages': 1,
      range: 10,
      'front panel offset':
        0,
      'noise floor level': 0,
      'noise floor scaling factor':
        0,
      'power offset first point':
        0,
      'loss thr': '0.3',
      'refl thr': '-40',
      'EOT thr': '5',
      resolution: 1,
    },
    KeyEvents: {
      'num events': 2,
      'event 2': {
        type:
          '1A9999LS {manual} reflection',
        distance: '8.500',
        slope: '0.200',
        'splice loss': '0.100',
        'refl loss': '-45.000',
        comments: 'Connector',
      },
      'event 1': {
        type:
          '0F9999LS {auto} loss/drop/gain',
        distance: '2.500',
        slope: '0.180',
        'splice loss': '0.250',
        'refl loss': '-60.000',
        comments: 'Splice',
      },
      Summary: {
        'total loss': 2.3,
        ORL: 41.2,
        'loss start': 0,
        'loss end': 10,
        'ORL start': 0,
        'ORL finish': 10,
      },
    },
    DataPts: {
      'num data points': 3,
      'num traces': 1,
      'num data points 2': 3,
      'scaling factor': 1,
      'max before offset': 0,
      'min before offset': 0,
      '_datapts_params': {
        offset: 'STV',
        xscaling: 1,
      },
    },
    Cksum: {
      checksum: 1,
      checksum_ours: 1,
      match: true,
    },
    trace: [
      {
        distance: 0,
        power: 20,
      },
      {
        distance: 5,
        power: 12,
      },
      {
        distance: 10,
        power: 4,
      },
    ],
    vendorBlocks: {},
  };
}

describe('SOR report helpers', () => {
  it('extracts and sorts OTDR events', () => {
    const events =
      extractSorEvents(
        mockSorResult()
      );

    expect(
      events
    ).toHaveLength(2);

    expect(
      events.map(
        (event) =>
          event.number
      )
    ).toEqual([
      1,
      2,
    ]);

    expect(
      events[0].comments
    ).toBe('Splice');
  });

  it('calculates trace bounds', () => {
    expect(
      traceBounds(
        mockSorResult().trace
      )
    ).toEqual({
      minDistance: 0,
      maxDistance: 10,
      minPower: 4,
      maxPower: 20,
    });
  });

  it('downsamples large traces while preserving endpoints', () => {
    const trace:
      TracePoint[] =
      Array.from(
        {
          length: 5000,
        },
        (
          _,
          index
        ) => ({
          distance:
            index / 100,
          power:
            Math.sin(
              index / 20
            ) *
              5 +
            20,
        })
      );

    const sampled =
      downsampleTrace(
        trace,
        300
      );

    expect(
      sampled.length
    ).toBeLessThanOrEqual(
      300
    );

    expect(
      sampled[0]
    ).toEqual(
      trace[0]
    );

    expect(
      sampled[
        sampled.length - 1
      ]
    ).toEqual(
      trace[
        trace.length - 1
      ]
    );
  });

  it('builds SVG chart points within the viewbox', () => {
    const result =
      mockSorResult();

    const points =
      traceToSvgPoints(
        result.trace,
        traceBounds(
          result.trace
        ),
        1000,
        260,
        20
      );

    expect(points).toContain(
      '20.00,20.00'
    );

    expect(points).toContain(
      '980.00,240.00'
    );
  });

  it('creates a safe PDF filename', () => {
    expect(
      safePdfFilename(
        'SITE:A<>B.SOR'
      )
    ).toBe(
      'SITE_A__B-OTDR-report.pdf'
    );
  });

  it('formats file sizes', () => {
    expect(
      formatFileSize(
        1536
      )
    ).toBe('1.5 KB');

    expect(
      formatFileSize(
        2 * 1024 * 1024
      )
    ).toBe('2.00 MB');
  });
});
