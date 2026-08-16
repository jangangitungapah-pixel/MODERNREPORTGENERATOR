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

  it('parses FLP operational titles with status tag and DATACOM ticket suffix', () => {
    const raw =
      '*[FLP_3rd_MANDAU][Open - Major] DOWN - 13BDG0419_KIARA_ASRI_RAYA_BDG_PL(03BDG665/100450)<>13BDG0560_AHNASUTION_PASIRENDAH_PL(100512/03BDG096) - DATACOM-INC-20260816-00012945*';

    const result =
      parseIncidentReport(
        raw
      );

    expect(
      result.report.region
    ).toBe(
      'FLP_3rd_MANDAU'
    );

    expect(
      result.report.summary
    ).toBe(
      '[Open - Major] DOWN - 13BDG0419_KIARA_ASRI_RAYA_BDG_PL(03BDG665/100450)<>13BDG0560_AHNASUTION_PASIRENDAH_PL(100512/03BDG096)'
    );

    expect(
      result.report.ticket
    ).toBe(
      'DATACOM-INC-20260816-00012945'
    );

    expect(
      result.detectedFields
    ).toEqual(
      expect.arrayContaining([
        'region',
        'summary',
        'ticket',
      ])
    );
  });

  it('parses a complete FLP DATACOM incident report and preserves all metadata', () => {
    const raw = [
      '*[FLP_3rd_MANDAU][Open - Major] DOWN - 13BDG0419_KIARA_ASRI_RAYA_BDG_PL(03BDG665/100450)<>13BDG0560_AHNASUTION_PASIRENDAH_PL(100512/03BDG096) - DATACOM-INC-20260816-00012945*',
      'Occur Time = 16/08/2026 09:00',
      'Dispacth Time = 16/08/2026 09:15',
      'PIC = Dede (Bandung)',
      'Rootcause = Still Investigation',
      'Cut Point = Still Investigation',
      '',
      'Update Progress',
      '09:20 We already open TT',
    ].join('\n');

    const result =
      parseIncidentReport(
        raw
      );

    expect(
      result.report.region
    ).toBe(
      'FLP_3rd_MANDAU'
    );

    expect(
      result.report.ticket
    ).toBe(
      'DATACOM-INC-20260816-00012945'
    );

    expect(
      result.report.summary
    ).toContain(
      '[Open - Major] DOWN -'
    );

    expect(
      result.report.occurTime
    ).toBe(
      '16/08/2026 09:00'
    );

    expect(
      result.report.dispatchTime
    ).toBe(
      '16/08/2026 09:15'
    );

    expect(
      result.report.pic
    ).toBe(
      'Dede (Bandung)'
    );

    expect(
      result.report.progress
    ).toHaveLength(1);

    expect(
      result.confidence
    ).toBe(100);
  });

  it('parses the FLP DATACOM format even when the complete report is collapsed into one line', () => {
    const raw = [
      '*[FLP_3rd_MANDAU][Open - Major] DOWN - 13BDG0419_KIARA_ASRI_RAYA_BDG_PL(03BDG665/100450)<>13BDG0560_AHNASUTION_PASIRENDAH_PL(100512/03BDG096) - DATACOM-INC-20260816-00012945*',
      'Occur Time = 16/08/2026 09:00',
      'Dispatch Time = 16/08/2026 09:15',
      'PIC = Dede (Bandung)',
      'Rootcause = Still Investigation',
      'Cut Point = Still Investigation',
      'Update Progress',
      '09:20 Team OTW location ETA 30 min',
      '10:00 Team arrive on location',
    ]
      .join(' ')
      .replace(
        /\s+/g,
        ' '
      );

    const result =
      parseIncidentReport(
        raw
      );

    expect(
      result.report.ticket
    ).toBe(
      'DATACOM-INC-20260816-00012945'
    );

    expect(
      result.report.progress
    ).toHaveLength(2);

    expect(
      result.report.progress[0]
        .time
    ).toBe('09:20');

    expect(
      result.report.progress[1]
        .time
    ).toBe('10:00');

    expect(
      result.confidence
    ).toBe(100);
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
