import { describe, expect, it } from 'vitest';
import {
  SAMPLE_REPORT,
  completionScore,
  detectProgressKind,
  duplicateProgressTimes,
  formatReport,
  parseIncidentReport,
  progressTimeToMinutes,
  sortProgressChronologically,
} from './report';

describe('formatReport', () => {
  it('builds the required incident report format', () => {
    const output = formatReport(SAMPLE_REPORT);

    expect(output).toContain(
      '*[MANDAU] LINK DOWN AT DWDM UJB 109202_BANDUNG_PETA <> 100109_MAJALENGKA, [TT : INC-20260815-00016661]*'
    );

    expect(output).toContain(
      'Occur Time = 15/08/2026 13:54'
    );

    expect(output).toContain(
      'Dispacth Time = 15/08/2026 14:25'
    );

    expect(output).toContain(
      '22:01 Link already up.'
    );
  });

  it('reports a complete sample as 100 percent', () => {
    expect(completionScore(SAMPLE_REPORT)).toBe(100);
  });
});


describe('parseIncidentReport', () => {
  it('parses the full formatted report back into structured data', () => {
    const raw =
      formatReport(
        SAMPLE_REPORT
      );

    const result =
      parseIncidentReport(
        raw
      );

    expect(
      result.report.region
    ).toBe('MANDAU');

    expect(
      result.report.ticket
    ).toBe(
      'INC-20260815-00016661'
    );

    expect(
      result.report.occurTime
    ).toBe(
      '15/08/2026 13:54'
    );

    expect(
      result.report.dispatchTime
    ).toBe(
      '15/08/2026 14:25'
    );

    expect(
      result.report.pic
    ).toBe(
      'Agus (Majalengka)'
    );

    expect(
      result.report.rootcause
    ).toBe(
      'Impact activity burning by resident'
    );

    expect(
      result.report.cutPoint
    ).toBe(
      'KM 22 from Majalengka'
    );

    expect(
      result.report.progress
    ).toHaveLength(13);

    expect(
      result.report.progress[12]
    ).toEqual(
      expect.objectContaining({
        time: '22:01',
        text: 'Link already up.',
      })
    );

    expect(
      result.confidence
    ).toBe(100);
  });

  it('understands a report collapsed into one long line', () => {
    const collapsed =
      formatReport(
        SAMPLE_REPORT
      )
        .replace(
          /\n+/g,
          ' '
        )
        .replace(
          /\s+/g,
          ' '
        );

    const result =
      parseIncidentReport(
        collapsed
      );

    expect(
      result.confidence
    ).toBe(100);

    expect(
      result.report.progress
    ).toHaveLength(13);

    expect(
      result.report.progress[0]
        .time
    ).toBe('14:30');

    expect(
      result.report.progress[12]
        .time
    ).toBe('22:01');
  });

  it('accepts the correctly spelled Dispatch Time label', () => {
    const corrected =
      formatReport(
        SAMPLE_REPORT
      ).replace(
        'Dispacth Time',
        'Dispatch Time'
      );

    const result =
      parseIncidentReport(
        corrected
      );

    expect(
      result.report.dispatchTime
    ).toBe(
      '15/08/2026 14:25'
    );
  });

  it('reports missing signals instead of inventing data', () => {
    const result =
      parseIncidentReport(
        [
          '*[MANDAU] LINK DOWN AT SAMPLE, [TT : INC-123]*',
          'PIC = Agus',
        ].join('\n')
      );

    expect(
      result.report.region
    ).toBe('MANDAU');

    expect(
      result.report.pic
    ).toBe('Agus');

    expect(
      result.report.occurTime
    ).toBe('');

    expect(
      result.missingFields
    ).toContain(
      'occurTime'
    );

    expect(
      result.confidence
    ).toBeLessThan(100);
  });
});


describe('timeline operations engine', () => {
  it('converts valid HH:mm values into minutes', () => {
    expect(
      progressTimeToMinutes(
        '14:30'
      )
    ).toBe(870);

    expect(
      progressTimeToMinutes(
        '23:59'
      )
    ).toBe(1439);

    expect(
      progressTimeToMinutes(
        '24:00'
      )
    ).toBeNull();

    expect(
      progressTimeToMinutes(
        '14:75'
      )
    ).toBeNull();
  });

  it('sorts timeline entries chronologically without mutating the source', () => {
    const entries = [
      {
        id: 'late',
        time: '22:01',
        text: 'Link already up.',
      },
      {
        id: 'early',
        time: '14:30',
        text: 'Open TT',
      },
      {
        id: 'middle',
        time: '17:36',
        text: 'Closure progress',
      },
    ];

    const sorted =
      sortProgressChronologically(
        entries
      );

    expect(
      sorted.map(
        (entry) => entry.id
      )
    ).toEqual([
      'early',
      'middle',
      'late',
    ]);

    expect(
      entries.map(
        (entry) => entry.id
      )
    ).toEqual([
      'late',
      'early',
      'middle',
    ]);
  });

  it('keeps invalid time values after valid chronological entries', () => {
    const sorted =
      sortProgressChronologically([
        {
          id: 'unknown',
          time: 'TBD',
          text: 'Waiting update',
        },
        {
          id: 'valid',
          time: '09:15',
          text: 'Team OTW',
        },
      ]);

    expect(
      sorted.map(
        (entry) => entry.id
      )
    ).toEqual([
      'valid',
      'unknown',
    ]);
  });

  it('detects duplicate valid timeline times', () => {
    expect(
      duplicateProgressTimes([
        {
          id: 'a',
          time: '14:30',
          text: 'One',
        },
        {
          id: 'b',
          time: '14:30',
          text: 'Two',
        },
        {
          id: 'c',
          time: '15:00',
          text: 'Three',
        },
        {
          id: 'd',
          time: 'invalid',
          text: 'Four',
        },
      ])
    ).toEqual([
      '14:30',
    ]);
  });

  it('classifies operational progress from its wording', () => {
    expect(
      detectProgressKind(
        'Team OTW last history KM 22 ETA 90 min'
      )
    ).toBe('dispatch');

    expect(
      detectProgressKind(
        'Team patrol on location found burnt cable'
      )
    ).toBe('onsite');

    expect(
      detectProgressKind(
        'Progress Closure Splicing Side Majalengka'
      )
    ).toBe('repair');

    expect(
      detectProgressKind(
        'We Already Open TT and Team prepare tools'
      )
    ).toBe('coordination');

    expect(
      detectProgressKind(
        'Link already up.'
      )
    ).toBe('restored');
  });
});
