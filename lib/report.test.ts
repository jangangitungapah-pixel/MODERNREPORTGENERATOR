import { describe, expect, it } from 'vitest';
import {
  SAMPLE_REPORT,
  completionScore,
  formatReport,
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
