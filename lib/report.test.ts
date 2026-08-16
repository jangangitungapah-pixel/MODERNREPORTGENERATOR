import { describe, expect, it } from 'vitest';
import {
  SAMPLE_REPORT,
  completionScore,
  detectProgressKind,
  duplicateProgressTimes,
  formatReport,
  inferProgressDates,
  parseIncidentReport,
  progressDateFromInput,
  progressDateToInput,
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

  it('parses multiple impact links and paired CP rootcause / cut point blocks', () => {
    const raw = [
      '*✅[FLP_3rd_MANDAU][Open - Major] DOWN - 12JKU0387_GADING_BLVD_MT(01JKU069)<>12JKU0198_GRIYAAGUNGPADEMANGANTIMUR_PL(090342) - DATACOM-INC-20260812-00022703*',
      'Impact Link :',
      '* ❌[FLP_3rd_MANDAU][Open - Major] DOWN - 12JKU0464_MALANG_KULON_JKU_PL(01JKU698)<>12JKU0387_GADING_BLVD_MT(01JKU069) - DATACOM-INC-20260812-00028616',
      '* ❌[FLP_3rd_MANDAU][Open - Major] DOWN - 12JKU0387_GADING_BLVD_MT(01JKU069)<>12JKU0373_KRS_MNDRIN_PL(01JKU321) - DATACOM-INC-20260812-00028457',
      '',
      'Occur Time =2026-08-12 16:25',
      'Dispacth Time = 2026-08-12 17:32',
      'PIC = Iman(Jakarta)',
      'Rootcause =',
      'CP1 Impact Activity Drainage Project',
      'CP2 Impact Activity Drainage Project',
      'CP3 Still Investigation',
      'Cut Point =',
      'CP1 KM 7,9 from GRIYAAGUNG✅',
      'CP2 KM 7,3 from GRIYAAGUNG❌',
      'CP3 KM 1,9 from GADING_BLVD❌',
      '',
      'Update Progress',
      '17:40 We already open TT MDU-20260812-0000035819, coordination with team',
      '23:41 TX GADING_BLVD Receive Power -9.88 & OTRD from JC nearest CP, still cut 678 meter toward GRIYAAGUNG (CP1)',
      '00:13 Team continue trace CP',
      '09:26 GADING_BLVD <> GRIYAAGUNG LInk UP✅',
      '16:38 team progress kupas kabel sisi KRS_MNDRIN GADING_BLVD <> KRS_MNDRIN',
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
      'DATACOM-INC-20260812-00022703'
    );

    expect(
      result.report.primaryMarker
    ).toBe('up');

    expect(
      result.report.statusTag
    ).toBe(
      '[Open - Major]'
    );

    expect(
      result.report.impactLinks
    ).toHaveLength(2);

    expect(
      result.report.impactLinks?.map(
        (entry) =>
          entry.ticket
      )
    ).toEqual([
      'DATACOM-INC-20260812-00028616',
      'DATACOM-INC-20260812-00028457',
    ]);

    expect(
      result.report.impactLinks?.every(
        (entry) =>
          entry.marker ===
          'down'
      )
    ).toBe(true);

    expect(
      result.report.occurTime
    ).toBe(
      '12/08/2026 16:25'
    );

    expect(
      result.report.dispatchTime
    ).toBe(
      '12/08/2026 17:32'
    );

    expect(
      result.report.cutPoints
    ).toHaveLength(3);

    expect(
      result.report.cutPoints?.[0]
    ).toEqual(
      expect.objectContaining({
        label: 'CP1',
        rootcause:
          'Impact Activity Drainage Project',
        cutPoint:
          'KM 7,9 from GRIYAAGUNG',
        marker: 'up',
      })
    );

    expect(
      result.report.cutPoints?.[1]
    ).toEqual(
      expect.objectContaining({
        label: 'CP2',
        rootcause:
          'Impact Activity Drainage Project',
        cutPoint:
          'KM 7,3 from GRIYAAGUNG',
        marker: 'down',
      })
    );

    expect(
      result.report.cutPoints?.[2]
    ).toEqual(
      expect.objectContaining({
        label: 'CP3',
        rootcause:
          'Still Investigation',
        cutPoint:
          'KM 1,9 from GADING_BLVD',
        marker: 'down',
      })
    );

    expect(
      result.report.progress.map(
        (entry) =>
          entry.time
      )
    ).toEqual([
      '17:40',
      '23:41',
      '00:13',
      '09:26',
      '16:38',
    ]);

    expect(
      result.confidence
    ).toBe(100);
  });

  it('formats structured impact links and CP blocks back into the report', () => {
    const parsed =
      parseIncidentReport(
        [
          '*✅[FLP_3rd_MANDAU][Open - Major] DOWN - MAIN_A<>MAIN_B - DATACOM-INC-20260812-00022703*',
          'Impact Link :',
          '* ❌[FLP_3rd_MANDAU][Open - Major] DOWN - IMPACT_A<>IMPACT_B - DATACOM-INC-20260812-00028616',
          'Occur Time = 2026-08-12 16:25',
          'Dispacth Time = 2026-08-12 17:32',
          'PIC = Iman(Jakarta)',
          'Rootcause =',
          'CP1 Drainage Project',
          'Cut Point =',
          'CP1 KM 7,9✅',
          'Update Progress',
          '17:40 Team prepare tools',
        ].join('\n')
      );

    const output =
      formatReport(
        parsed.report
      );

    expect(output).toContain(
      '*✅[FLP_3rd_MANDAU][Open - Major] DOWN - MAIN_A<>MAIN_B - DATACOM-INC-20260812-00022703*'
    );

    expect(output).toContain(
      'Impact Link :'
    );

    expect(output).toContain(
      '* ❌[FLP_3rd_MANDAU][Open - Major] DOWN - IMPACT_A<>IMPACT_B - DATACOM-INC-20260812-00028616'
    );

    expect(output).toContain(
      'Rootcause = \nCP1 Drainage Project'
    );

    expect(output).toContain(
      'Cut Point = \nCP1 KM 7,9✅'
    );
  });

  it('formats a manually authored dispatch topology without requiring parser input', () => {
    const output =
      formatReport({
        ...SAMPLE_REPORT,
        region:
          'FLP_3rd_MANDAU',
        statusTag:
          '[Open - Major]',
        primaryMarker:
          'down',
        summary:
          '[Open - Major] DOWN - MAIN_A<>MAIN_B',
        ticket:
          'DATACOM-INC-20260816-00000001',
        impactLinks: [
          {
            id: 'impact-manual',
            marker: 'down',
            region:
              'FLP_3rd_MANDAU',
            statusTag:
              '[Open - Major]',
            summary:
              'DOWN - CHILD_A<>CHILD_B',
            ticket:
              'DATACOM-INC-20260816-00000002',
          },
        ],
        rootcause:
          'CP1 Drainage Project\nCP2 Still Investigation',
        cutPoint:
          'CP1 KM 7,9\nCP2 KM 2,1',
        cutPoints: [
          {
            id: 'cp-manual-1',
            label: 'CP1',
            rootcause:
              'Drainage Project',
            cutPoint:
              'KM 7,9',
            marker: 'up',
          },
          {
            id: 'cp-manual-2',
            label: 'CP2',
            rootcause:
              'Still Investigation',
            cutPoint:
              'KM 2,1',
            marker: 'down',
          },
        ],
      });

    expect(output).toContain(
      '*❌[FLP_3rd_MANDAU][Open - Major] DOWN - MAIN_A<>MAIN_B - DATACOM-INC-20260816-00000001*'
    );

    expect(output).toContain(
      '* ❌[FLP_3rd_MANDAU][Open - Major] DOWN - CHILD_A<>CHILD_B - DATACOM-INC-20260816-00000002'
    );

    expect(output).toContain(
      'CP1 Drainage Project'
    );

    expect(output).toContain(
      'CP1 KM 7,9✅'
    );

    expect(output).toContain(
      'CP2 KM 2,1❌'
    );
  });

  it('supports freeform Impact Link rows without FLP region or status tags', () => {
    const output =
      formatReport({
        ...SAMPLE_REPORT,
        impactLinks: [
          {
            id: 'freeform-1',
            marker: 'down',
            region: '',
            statusTag: '',
            summary:
              'BACKBONE JAKARTA<>BEKASI DEGRADED',
            ticket: '',
          },
          {
            id: 'freeform-2',
            marker: 'warning',
            region: 'MANDAU',
            statusTag: '',
            summary:
              'High attenuation A<>B',
            ticket:
              'INC-20260816-00000123',
          },
          {
            id: 'freeform-3',
            marker: 'down',
            region: '',
            statusTag:
              '[Open - Major]',
            summary:
              'DOWN - METRO_A<>METRO_B',
            ticket: '',
          },
        ],
      });

    expect(output).toContain(
      '* ❌BACKBONE JAKARTA<>BEKASI DEGRADED'
    );

    expect(output).toContain(
      '* ⚠️[MANDAU] High attenuation A<>B - INC-20260816-00000123'
    );

    expect(output).toContain(
      '* ❌[Open - Major] DOWN - METRO_A<>METRO_B'
    );

    expect(output).not.toContain(
      '[]'
    );
  });

  it('parses mixed flexible Impact Link formats in one incident', () => {
    const raw = [
      '*[MANDAU] MAIN LINK DOWN, [TT : INC-20260816-00000001]*',
      'Impact Link :',
      '* ❌BACKBONE JAKARTA<>BEKASI DEGRADED',
      '* ⚠️[MANDAU] High attenuation A<>B - INC-20260816-00000123',
      '* ❌[Open - Major] DOWN - METRO_A<>METRO_B',
      '* ✅[FLP_3rd_MANDAU][Open - Major] DOWN - NODE_A<>NODE_B - DATACOM-INC-20260816-00000124',
      'Occur Time = 16/08/2026 10:00',
      'Dispacth Time = 16/08/2026 10:15',
      'PIC = Operator',
      'Rootcause = Still Investigation',
      'Cut Point = Still Investigation',
      'Update Progress',
      '10:20 Team checking',
    ].join('\n');

    const result =
      parseIncidentReport(
        raw
      );

    expect(
      result.report.impactLinks
    ).toHaveLength(4);

    expect(
      result.report.impactLinks?.[0]
    ).toEqual(
      expect.objectContaining({
        marker: 'down',
        region: '',
        statusTag: '',
        summary:
          'BACKBONE JAKARTA<>BEKASI DEGRADED',
        ticket: '',
      })
    );

    expect(
      result.report.impactLinks?.[1]
    ).toEqual(
      expect.objectContaining({
        marker:
          'warning',
        region:
          'MANDAU',
        statusTag: '',
        summary:
          'High attenuation A<>B',
        ticket:
          'INC-20260816-00000123',
      })
    );

    expect(
      result.report.impactLinks?.[2]
    ).toEqual(
      expect.objectContaining({
        region: '',
        statusTag:
          '[Open - Major]',
        summary:
          'DOWN - METRO_A<>METRO_B',
        ticket: '',
      })
    );

    expect(
      result.report.impactLinks?.[3]
    ).toEqual(
      expect.objectContaining({
        marker: 'up',
        region:
          'FLP_3rd_MANDAU',
        statusTag:
          '[Open - Major]',
        ticket:
          'DATACOM-INC-20260816-00000124',
      })
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

  it('keeps a cross-midnight timeline in operational order', () => {
    const sorted =
      sortProgressChronologically([
        {
          id: 'a',
          time: '23:41',
          text: 'Before midnight',
        },
        {
          id: 'b',
          time: '00:13',
          text: 'After midnight',
        },
        {
          id: 'c',
          time: '01:53',
          text: 'Continue after midnight',
        },
      ]);

    expect(
      sorted.map(
        (entry) =>
          entry.time
      )
    ).toEqual([
      '23:41',
      '00:13',
      '01:53',
    ]);
  });

  it('still corrects small same-day out-of-order additions', () => {
    const sorted =
      sortProgressChronologically([
        {
          id: 'a',
          time: '20:18',
          text: 'Later',
        },
        {
          id: 'b',
          time: '19:30',
          text: 'Forgotten earlier update',
        },
      ]);

    expect(
      sorted.map(
        (entry) =>
          entry.time
      )
    ).toEqual([
      '19:30',
      '20:18',
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


describe('date-aware progress timeline', () => {
  it('infers midnight rollover dates from the incident occur time', () => {
    const entries =
      inferProgressDates(
        [
          {
            id: '1',
            time: '23:41',
            text: 'Checking',
          },
          {
            id: '2',
            time: '00:13',
            text: 'Found issue',
          },
          {
            id: '3',
            time: '01:53',
            text: 'Repair',
          },
        ],
        '12/08/2026 16:25'
      );

    expect(
      entries.map(
        (entry) =>
          entry.date
      )
    ).toEqual([
      '12/08/2026',
      '13/08/2026',
      '13/08/2026',
    ]);
  });

  it('sorts identical clock times correctly across different calendar days', () => {
    const entries =
      sortProgressChronologically(
        [
          {
            id: 'day-two',
            date:
              '13/08/2026',
            time: '08:00',
            text: 'Day two',
          },
          {
            id: 'day-one',
            date:
              '12/08/2026',
            time: '08:00',
            text: 'Day one',
          },
        ]
      );

    expect(
      entries.map(
        (entry) =>
          entry.id
      )
    ).toEqual([
      'day-one',
      'day-two',
    ]);

    expect(
      duplicateProgressTimes(
        entries
      )
    ).toEqual([]);
  });

  it('keeps progress dates internal and preserves the existing bagan output', () => {
    const output =
      formatReport({
        ...SAMPLE_REPORT,
        progress: [
          {
            id: 'midnight',
            date:
              '16/08/2026',
            time: '00:13',
            text:
              'Team continue checking',
          },
        ],
      });

    expect(output).toContain(
      '00:13 Team continue checking'
    );

    expect(output).not.toContain(
      '16/08/2026 00:13 Team continue checking'
    );
  });

  it('converts browser date input values without changing storage format', () => {
    expect(
      progressDateFromInput(
        '2026-08-16'
      )
    ).toBe(
      '16/08/2026'
    );

    expect(
      progressDateToInput(
        '16/08/2026'
      )
    ).toBe(
      '2026-08-16'
    );
  });
});
