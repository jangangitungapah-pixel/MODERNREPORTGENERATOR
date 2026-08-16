export type ProgressEntry = {
  id: string;
  time: string;
  text: string;
};

export type IncidentReport = {
  region: string;
  summary: string;
  ticket: string;
  occurTime: string;
  dispatchTime: string;
  pic: string;
  rootcause: string;
  cutPoint: string;
  progress: ProgressEntry[];
};

export const EMPTY_REPORT: IncidentReport = {
  region: '',
  summary: '',
  ticket: '',
  occurTime: '',
  dispatchTime: '',
  pic: '',
  rootcause: '',
  cutPoint: '',
  progress: [],
};

export const SAMPLE_REPORT: IncidentReport = {
  region: 'MANDAU',
  summary:
    'LINK DOWN AT DWDM UJB 109202_BANDUNG_PETA <> 100109_MAJALENGKA',
  ticket: 'INC-20260815-00016661',
  occurTime: '15/08/2026 13:54',
  dispatchTime: '15/08/2026 14:25',
  pic: 'Agus (Majalengka)',
  rootcause: 'Impact activity burning by resident',
  cutPoint: 'KM 22 from Majalengka',
  progress: [
    {
      id: 'p01',
      time: '14:30',
      text:
        'We Already Open TT MDU-20260815-0000036310 & Team prepare tools',
    },
    {
      id: 'p02',
      time: '15:00',
      text:
        'Team OTW last history KM 22 from Majalengka ETA 90 min',
    },
    {
      id: 'p03',
      time: '15:42',
      text:
        'Team partol on location found burnt cable, impact activity burning by resident, still waiting team jointer',
    },
    {
      id: 'p04',
      time: '16:22',
      text:
        'Team process striping cable existing side bandung, side majalengka condition area still burning',
    },
    {
      id: 'p05',
      time: '17:36',
      text: 'Progress Setting Closure side Bandung',
    },
    {
      id: 'p06',
      time: '18:59',
      text:
        'Condition cable side Majalengka has been extinguished, Team continue progress jumper cable',
    },
    {
      id: 'p07',
      time: '19:58',
      text: 'Progress Striping Cable side Majalengka',
    },
    {
      id: 'p08',
      time: '20:18',
      text: 'Progress Closure Setting side Majalengka',
    },
    {
      id: 'p09',
      time: '20:34',
      text: 'Progress Striping Cable Jumper side Bandung',
    },
    {
      id: 'p10',
      time: '20:56',
      text: 'Progress Closure Setting Both side',
    },
    {
      id: 'p11',
      time: '21:13',
      text: 'Progress Closure Splicing Side Majalengka',
    },
    {
      id: 'p12',
      time: '21:14',
      text: 'Progress Closure Splicing Side Bandung',
    },
    {
      id: 'p13',
      time: '22:01',
      text: 'Link already up.',
    },
  ],
};

export function formatReport(report: IncidentReport): string {
  const header =
    '*[' +
    report.region.trim() +
    '] ' +
    report.summary.trim() +
    ', [TT : ' +
    report.ticket.trim() +
    ']*';

  const progressLines = report.progress
    .filter((entry) => entry.time.trim() || entry.text.trim())
    .map((entry) =>
      (entry.time.trim() + ' ' + entry.text.trim()).trim()
    );

  return [
    header,
    'Occur Time = ' + report.occurTime.trim(),
    'Dispacth Time = ' + report.dispatchTime.trim(),
    'PIC = ' + report.pic.trim(),
    'Rootcause = ' + report.rootcause.trim(),
    'Cut Point = ' + report.cutPoint.trim(),
    '',
    'Update Progress  ',
    ...progressLines,
  ].join('\n');
}

export type IncidentParseResult = {
  report: IncidentReport;
  confidence: number;
  detectedFields: string[];
  missingFields: string[];
  progressCount: number;
};

function cleanImportedValue(
  value: string
): string {
  return value
    .replace(/\\s+/g, ' ')
    .replace(/^\\*+|\\*+$/g, '')
    .trim();
}

function createProgressId(
  index: number
): string {
  return (
    'import-' +
    String(index + 1).padStart(3, '0')
  );
}

function parseProgressEntries(
  raw: string
): ProgressEntry[] {
  const normalized = raw
    .replace(/\\r/g, '')
    .trim();

  if (!normalized) {
    return [];
  }

  const lines = normalized
    .split('\\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const entries: ProgressEntry[] = [];

  for (const line of lines) {
    const match = line.match(
      /^[•*\\-\\s]*(\\d{1,2}:\\d{2})\\s+(.+)$/
    );

    if (match) {
      const [, time, text] = match;

      entries.push({
        id: createProgressId(
          entries.length
        ),
        time,
        text: cleanImportedValue(text),
      });

      continue;
    }

    if (entries.length > 0) {
      const previous =
        entries[entries.length - 1];

      previous.text = cleanImportedValue(
        previous.text + ' ' + line
      );
    }
  }

  if (entries.length > 0) {
    return entries;
  }

  //
  // Fallback for text copied from chat,
  // spreadsheets, WhatsApp, or other
  // sources that collapse all progress
  // lines into one long line.
  //
  const collapsed = normalized
    .replace(/\\s+/g, ' ')
    .trim();

  const segmentPattern =
    /(?:^|\\s)(\\d{1,2}:\\d{2})\\s+(.+?)(?=\\s+\\d{1,2}:\\d{2}\\s+[A-Za-z0-9]|$)/g;

  let match:
    RegExpExecArray | null;

  while (
    (match =
      segmentPattern.exec(
        collapsed
      )) !== null
  ) {
    entries.push({
      id: createProgressId(
        entries.length
      ),
      time: match[1],
      text: cleanImportedValue(
        match[2]
      ),
    });
  }

  return entries;
}

export function parseIncidentReport(
  raw: string
): IncidentParseResult {
  const normalized = raw
    .replace(/\\u00a0/g, ' ')
    .replace(/\\r/g, '')
    .trim();

  const report: IncidentReport = {
    ...EMPTY_REPORT,
    progress: [],
  };

  if (!normalized) {
    return {
      report,
      confidence: 0,
      detectedFields: [],
      missingFields: [
        'region',
        'summary',
        'ticket',
        'occurTime',
        'dispatchTime',
        'pic',
        'rootcause',
        'cutPoint',
        'progress',
      ],
      progressCount: 0,
    };
  }

  const progressMarker =
    /\\bUpdate\\s*Progress\\b/i;

  const progressMarkerMatch =
    progressMarker.exec(
      normalized
    );

  const metadataRaw =
    progressMarkerMatch
      ? normalized.slice(
          0,
          progressMarkerMatch.index
        )
      : normalized;

  const progressRaw =
    progressMarkerMatch
      ? normalized.slice(
          progressMarkerMatch.index +
            progressMarkerMatch[0].length
        )
      : '';

  //
  // Compress metadata first.
  //
  // This allows the parser to understand
  // copied text even when the browser,
  // WhatsApp, or another tool destroys
  // its original line breaks.
  //
  const compactMetadata =
    metadataRaw
      .replace(/\\n+/g, ' ')
      .replace(/[ \\t]+/g, ' ')
      .trim();

  const metadataLines =
    compactMetadata
      .replace(
        /\\s+(?=(?:Occur\\s*Time|(?:Dispacth|Dispatch)\\s*Time|PIC|Root\\s*Cause|Rootcause|Cut\\s*Point)\\s*=)/gi,
        '\\n'
      )
      .split('\\n')
      .map((line) => line.trim())
      .filter(Boolean);

  const header =
    metadataLines[0] ?? '';

  const completeHeader =
    header.match(
      /^\\*?\\s*\\[([^\\]]+)\\]\\s*(.*?)\\s*,?\\s*\\[TT\\s*:\\s*([^\\]]+)\\]\\s*\\*?\\s*$/i
    );

  if (completeHeader) {
    report.region =
      cleanImportedValue(
        completeHeader[1]
      );

    report.summary =
      cleanImportedValue(
        completeHeader[2]
      ).replace(
        /,\\s*$/,
        ''
      );

    report.ticket =
      cleanImportedValue(
        completeHeader[3]
      );
  } else {
    //
    // Graceful partial header support.
    //
    // Example:
    // [MANDAU] LINK DOWN ...
    //
    const partialHeader =
      header.match(
        /^\\*?\\s*\\[([^\\]]+)\\]\\s*(.*?)\\s*\\*?$/
      );

    if (partialHeader) {
      report.region =
        cleanImportedValue(
          partialHeader[1]
        );

      report.summary =
        cleanImportedValue(
          partialHeader[2]
        );
    }

    const looseTicket =
      compactMetadata.match(
        /\\[TT\\s*:\\s*([^\\]]+)\\]/i
      );

    if (looseTicket) {
      report.ticket =
        cleanImportedValue(
          looseTicket[1]
        );
    }
  }

  for (
    const line of
    metadataLines.slice(1)
  ) {
    const equalsIndex =
      line.indexOf('=');

    if (equalsIndex < 0) {
      continue;
    }

    const label =
      line
        .slice(
          0,
          equalsIndex
        )
        .trim();

    const value =
      cleanImportedValue(
        line.slice(
          equalsIndex + 1
        )
      );

    if (
      /^Occur\\s*Time$/i.test(
        label
      )
    ) {
      report.occurTime = value;
      continue;
    }

    if (
      /^(?:Dispacth|Dispatch)\\s*Time$/i.test(
        label
      )
    ) {
      report.dispatchTime =
        value;

      continue;
    }

    if (
      /^PIC$/i.test(
        label
      )
    ) {
      report.pic = value;
      continue;
    }

    if (
      /^(?:Rootcause|Root\\s*Cause)$/i.test(
        label
      )
    ) {
      report.rootcause = value;
      continue;
    }

    if (
      /^Cut\\s*Point$/i.test(
        label
      )
    ) {
      report.cutPoint = value;
    }
  }

  report.progress =
    parseProgressEntries(
      progressRaw
    );

  const signals = [
    [
      'region',
      report.region,
    ],
    [
      'summary',
      report.summary,
    ],
    [
      'ticket',
      report.ticket,
    ],
    [
      'occurTime',
      report.occurTime,
    ],
    [
      'dispatchTime',
      report.dispatchTime,
    ],
    [
      'pic',
      report.pic,
    ],
    [
      'rootcause',
      report.rootcause,
    ],
    [
      'cutPoint',
      report.cutPoint,
    ],
    [
      'progress',
      report.progress.length > 0
        ? 'detected'
        : '',
    ],
  ] as const;

  const detectedFields =
    signals
      .filter(
        ([, value]) =>
          value.trim().length > 0
      )
      .map(
        ([name]) => name
      );

  const missingFields =
    signals
      .filter(
        ([, value]) =>
          value.trim().length === 0
      )
      .map(
        ([name]) => name
      );

  const confidence =
    Math.round(
      (
        detectedFields.length /
        signals.length
      ) * 100
    );

  return {
    report,
    confidence,
    detectedFields,
    missingFields,
    progressCount:
      report.progress.length,
  };
}

export function completionScore(report: IncidentReport): number {
  const values = [
    report.region,
    report.summary,
    report.ticket,
    report.occurTime,
    report.dispatchTime,
    report.pic,
    report.rootcause,
    report.cutPoint,
  ];

  const filled = values.filter(
    (value) => value.trim().length > 0
  ).length;

  const hasProgress = report.progress.some(
    (entry) => entry.time.trim() && entry.text.trim()
  );

  return Math.round(
    ((filled + (hasProgress ? 1 : 0)) / 9) * 100
  );
}
