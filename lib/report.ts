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
    .replace(/\s+/g, ' ')
    .replace(/^\*+|\*+$/g, '')
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
    .replace(/\r/g, '')
    .trim();

  if (!normalized) {
    return [];
  }

  const lines = normalized
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  //
  // Preserve the richer line-by-line parser when
  // the source still contains real line breaks.
  //
  // Continuation lines are appended to the previous
  // timeline entry instead of being discarded.
  //
  if (lines.length > 1) {
    const lineEntries: ProgressEntry[] = [];

    for (const line of lines) {
      const match = line.match(
        /^[•*\-\s]*(\d{1,2}:\d{2})\s+(.+)$/
      );

      if (match) {
        const [, time, text] = match;

        lineEntries.push({
          id: createProgressId(
            lineEntries.length
          ),
          time,
          text: cleanImportedValue(text),
        });

        continue;
      }

      if (lineEntries.length > 0) {
        const previous =
          lineEntries[
            lineEntries.length - 1
          ];

        previous.text =
          cleanImportedValue(
            previous.text +
              ' ' +
              line
          );
      }
    }

    if (lineEntries.length > 0) {
      return lineEntries;
    }
  }

  //
  // Collapsed-source parser.
  //
  // Some sources flatten the complete Update Progress
  // section into one long line. In that situation the
  // first HH:mm must NOT consume every later update.
  //
  // Instead, each HH:mm token becomes the start of a
  // new timeline segment.
  //
  const collapsed = normalized
    .replace(/\s+/g, ' ')
    .trim();

  const entries: ProgressEntry[] = [];

  const segmentPattern =
    /(?:^|\s)(\d{1,2}:\d{2})\s+(.+?)(?=\s+\d{1,2}:\d{2}\s+|$)/g;

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
    .replace(/\u00a0/g, ' ')
    .replace(/\r/g, '')
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
    /\bUpdate\s*Progress\b/i;

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
      .replace(/\n+/g, ' ')
      .replace(/[ \t]+/g, ' ')
      .trim();

  const metadataLines =
    compactMetadata
      .replace(
        /\s+(?=(?:Occur\s*Time|(?:Dispacth|Dispatch)\s*Time|PIC|Root\s*Cause|Rootcause|Cut\s*Point)\s*=)/gi,
        '\n'
      )
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

  const header =
    metadataLines[0] ?? '';

  const completeHeader =
    header.match(
      /^\*?\s*\[([^\]]+)\]\s*(.*?)\s*,?\s*\[TT\s*:\s*([^\]]+)\]\s*\*?\s*$/i
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
        /,\s*$/,
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
        /^\*?\s*\[([^\]]+)\]\s*(.*?)\s*\*?$/
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
        /\[TT\s*:\s*([^\]]+)\]/i
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
      /^Occur\s*Time$/i.test(
        label
      )
    ) {
      report.occurTime = value;
      continue;
    }

    if (
      /^(?:Dispacth|Dispatch)\s*Time$/i.test(
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
      /^(?:Rootcause|Root\s*Cause)$/i.test(
        label
      )
    ) {
      report.rootcause = value;
      continue;
    }

    if (
      /^Cut\s*Point$/i.test(
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

export type ProgressKind =
  | 'coordination'
  | 'dispatch'
  | 'onsite'
  | 'repair'
  | 'restored'
  | 'update';

export function progressTimeToMinutes(
  time: string
): number | null {
  const match =
    time
      .trim()
      .match(
        /^(\d{1,2}):(\d{2})$/
      );

  if (!match) {
    return null;
  }

  const hours =
    Number(match[1]);

  const minutes =
    Number(match[2]);

  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  return hours * 60 + minutes;
}

export function sortProgressChronologically(
  entries: ProgressEntry[]
): ProgressEntry[] {
  return entries
    .map((entry, index) => ({
      entry,
      index,
      minutes:
        progressTimeToMinutes(
          entry.time
        ),
    }))
    .sort((left, right) => {
      if (
        left.minutes === null &&
        right.minutes === null
      ) {
        return left.index - right.index;
      }

      if (left.minutes === null) {
        return 1;
      }

      if (right.minutes === null) {
        return -1;
      }

      if (
        left.minutes ===
        right.minutes
      ) {
        return left.index - right.index;
      }

      return (
        left.minutes -
        right.minutes
      );
    })
    .map(({ entry }) => entry);
}

export function duplicateProgressTimes(
  entries: ProgressEntry[]
): string[] {
  const counts =
    new Map<string, number>();

  for (const entry of entries) {
    const time =
      entry.time.trim();

    if (
      progressTimeToMinutes(
        time
      ) === null
    ) {
      continue;
    }

    counts.set(
      time,
      (counts.get(time) ?? 0) + 1
    );
  }

  return Array.from(
    counts.entries()
  )
    .filter(
      ([, count]) =>
        count > 1
    )
    .map(([time]) => time)
    .sort(
      (left, right) =>
        (
          progressTimeToMinutes(
            left
          ) ?? 0
        ) -
        (
          progressTimeToMinutes(
            right
          ) ?? 0
        )
    );
}

export function detectProgressKind(
  text: string
): ProgressKind {
  const normalized =
    text
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();

  if (
    /\b(link|service|traffic)\b.*\b(up|normal|restore|restored|recovery|recovered)\b/.test(
      normalized
    ) ||
    /\balready\s+up\b/.test(
      normalized
    )
  ) {
    return 'restored';
  }

  if (
    /\b(otw|on the way|eta|depart|dispatch|menuju)\b/.test(
      normalized
    )
  ) {
    return 'dispatch';
  }

  if (
    /\b(on location|arrive|arrived|patrol|partol|found|inspection|checking location)\b/.test(
      normalized
    )
  ) {
    return 'onsite';
  }

  if (
    /\b(splic|splice|splicing|striping|stripping|closure|jumper|repair|joint|jointer|cable|extinguish)\w*\b/.test(
      normalized
    )
  ) {
    return 'repair';
  }

  if (
    /\b(open tt|prepare tools|prepare tool|escalat|coordinate|coordination|clearance|permit)\w*\b/.test(
      normalized
    )
  ) {
    return 'coordination';
  }

  return 'update';
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
