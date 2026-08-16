import {
  describe,
  expect,
  it,
} from 'vitest';

import type {
  SorResult,
} from 'sor-reader/browser';

import {
  buildSorInsights,
  classifySorEvent,
} from './sor-insights';

function mockSor(
  overrides:
    Partial<SorResult> = {}
): SorResult {
  return {
    filename: 'demo.sor',
    format: 2,
    version: '2.00',
    mapblock: {
      nbytes: 0,
      nblocks: 7,
    },
    blocks: {
      Map: {
        name: 'Map',
        version: '2.00',
        size: 10,
        pos: 0,
        order: 0,
      },
    },
    GenParams: {
      language: 'EN',
      'cable ID': 'CBL-01',
      'fiber ID': 'F01',
      wavelength: '1550 nm',
      'location A': 'A',
      'location B': 'B',
      'cable code/fiber type': '',
      'build condition': '',
      'user offset': '',
      operator: 'NOC',
      comments: '',
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
      wavelength: '1550 nm',
      'acquisition offset': 0,
      'number of pulse width entries': 1,
      'pulse width': '100 ns',
      'sample spacing': '1 m',
      'num data points': 3,
      index: '1.468000',
      BC: '0',
      'num averages': 1,
      range: 20,
      'front panel offset': 0,
      'noise floor level': 0,
      'noise floor scaling factor': 0,
      'power offset first point': 0,
      'loss thr': '0.300 dB',
      'refl thr': '-45.000 dB',
      'EOT thr': '5.000 dB',
      resolution: 1,
    },
    KeyEvents: {
      'num events': 2,
      'event 1': {
        type:
          '0F9999LS {auto} loss/drop/gain',
        distance: '5.000',
        slope: '0.180',
        'splice loss': '0.200',
        'refl loss': '-60.000',
        comments: 'Splice',
        'end of prev': '4.900',
        'start of curr': '4.950',
        'end of curr': '5.050',
        'start of next': '5.100',
        peak: '5.000',
      },
      'event 2': {
        type:
          '1F9999LS {auto} reflection',
        distance: '10.000',
        slope: '0.210',
        'splice loss': '0.500',
        'refl loss': '-40.000',
        comments: 'Connector',
      },
      Summary: {
        'total loss': 4,
        ORL: 38,
        'loss start': 0,
        'loss end': 20,
        'ORL start': 0,
        'ORL finish': 20,
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
        distance: 10,
        power: 11,
      },
      {
        distance: 20,
        power: 4,
      },
    ],
    vendorBlocks: {
      VendorX: {
        bytes:
          new Uint8Array(
            12
          ),
      },
    },
    ...overrides,
  };
}

describe('SOR deep insights', () => {
  it('builds a concise link summary from standard parsed fields', () => {
    const insights =
      buildSorInsights(
        mockSor()
      );

    expect(
      insights.fiberLengthKm
    ).toBe(20);

    expect(
      insights.totalLossDb
    ).toBe(4);

    expect(
      insights.averageAttenuationDbKm
    ).toBeCloseTo(
      0.2,
      6
    );

    expect(
      insights.eventCount
    ).toBe(2);

    expect(
      insights.vendorBlockCount
    ).toBe(1);
  });

  it('screens event loss and reflectance using thresholds stored in the SOR', () => {
    const insights =
      buildSorInsights(
        mockSor()
      );

    expect(
      insights.attentionEventCount
    ).toBe(1);

    expect(
      insights.events[1]
        .screening
    ).toBe(
      'attention'
    );

    expect(
      insights.events[1]
        .screeningReasons
        .length
    ).toBe(2);

    expect(
      insights.screeningStatus
    ).toBe(
      'attention'
    );
  });

  it('keeps v2 event measurement windows', () => {
    const event =
      buildSorInsights(
        mockSor()
      ).events[0];

    expect(
      event.window
        .endOfPreviousKm
    ).toBe(4.9);

    expect(
      event.window
        .peakKm
    ).toBe(5);
  });

  it('flags checksum problems separately from event screening', () => {
    const result =
      mockSor();

    result.Cksum.match =
      false;

    const insights =
      buildSorInsights(
        result
      );

    expect(
      insights.screeningStatus
    ).toBe(
      'attention'
    );

    expect(
      insights.screeningNotes.join(
        ' '
      )
    ).toContain(
      'checksum'
    );
  });

  it('classifies common SOR event descriptions', () => {
    expect(
      classifySorEvent(
        '1F9999LS {auto} reflection'
      ).category
    ).toBe(
      'reflective'
    );

    expect(
      classifySorEvent(
        '0F9999LS {auto} loss/drop/gain'
      ).category
    ).toBe(
      'non-reflective'
    );

    expect(
      classifySorEvent(
        '0F9999LE {auto} loss/drop/gain'
      ).category
    ).toBe(
      'end-of-fiber'
    );
  });
});
