export type ProgressEntry = {
  id: string;
  /**
   * Optional calendar date for the timeline entry.
   *
   * Kept optional so F3 workspace snapshots created before
   * the date-aware timeline remain runtime-compatible.
   *
   * Storage format: DD/MM/YYYY.
   * Report output intentionally remains HH:mm + text.
   */
  date?: string;
  time: string;
  text: string;
};

export type LinkMarker =
  | 'up'
  | 'down'
  | 'warning'
  | 'unknown';

export type ImpactLink = {
  id: string;
  marker: LinkMarker;
  region: string;
  statusTag: string;
  summary: string;
  ticket: string;
};

export type CutPointEntry = {
  id: string;
  label: string;
  rootcause: string;
  cutPoint: string;
  marker: LinkMarker;
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
  primaryMarker?: LinkMarker;
  statusTag?: string;
  impactLinks?: ImpactLink[];
  cutPoints?: CutPointEntry[];
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
  primaryMarker: 'unknown',
  statusTag: '',
  impactLinks: [],
  cutPoints: [],
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
  const markerSymbol = (
    marker: LinkMarker | undefined
  ): string => {
    if (marker === 'up') {
      return '✅';
    }

    if (marker === 'down') {
      return '❌';
    }

    if (marker === 'warning') {
      return '⚠️';
    }

    return '';
  };

  const statusTag =
    report.statusTag?.trim() ??
    '';

  const operationalSummary =
    statusTag &&
    report.summary
      .trim()
      .startsWith(statusTag)
      ? report.summary
          .trim()
          .slice(
            statusTag.length
          )
          .trim()
      : report.summary.trim();

  const usesOperationalHeader =
    Boolean(statusTag) &&
    /(?:^|-)(?:[A-Z0-9_]+-)*INC-\d{8}-\d+$/i.test(
      report.ticket.trim()
    );

  const header =
    usesOperationalHeader
      ? (
          '*' +
          markerSymbol(
            report.primaryMarker
          ) +
          '[' +
          report.region.trim() +
          ']' +
          statusTag +
          ' ' +
          operationalSummary +
          ' - ' +
          report.ticket.trim() +
          '*'
        )
      : (
          '*[' +
          report.region.trim() +
          '] ' +
          report.summary.trim() +
          ', [TT : ' +
          report.ticket.trim() +
          ']*'
        );

  const impactLinks =
    report.impactLinks ??
    [];

  const impactLines =
    impactLinks.map(
      (impact) => {
        const region =
          impact.region.trim();

        const statusTag =
          impact.statusTag.trim();

        const summary =
          impact.summary.trim();

        const ticket =
          impact.ticket.trim();

        const structuredPrefix =
          (
            region
              ? '[' +
                region +
                ']'
              : ''
          ) +
          statusTag;

        const body =
          [
            structuredPrefix,
            summary,
          ]
            .filter(Boolean)
            .join(' ')
            .trim();

        const content =
          ticket
            ? (
                body
                  ? body +
                    ' - ' +
                    ticket
                  : ticket
              )
            : body;

        return (
          '* ' +
          markerSymbol(
            impact.marker
          ) +
          content
        ).trimEnd();
      }
    );

  const cutPoints =
    report.cutPoints ??
    [];

  const rootcauseLines =
    cutPoints.length > 0
      ? [
          'Rootcause = ',
          ...cutPoints.map(
            (entry) =>
              (
                entry.label.trim() +
                ' ' +
                entry.rootcause.trim()
              ).trim()
          ),
        ]
      : [
          'Rootcause = ' +
          report.rootcause.trim(),
        ];

  const cutPointLines =
    cutPoints.length > 0
      ? [
          'Cut Point = ',
          ...cutPoints.map(
            (entry) =>
              (
                entry.label.trim() +
                ' ' +
                entry.cutPoint.trim() +
                markerSymbol(
                  entry.marker
                )
              ).trim()
          ),
        ]
      : [
          'Cut Point = ' +
          report.cutPoint.trim(),
        ];

  const progressLines =
    report.progress
      .filter(
        (entry) =>
          entry.time.trim() ||
          entry.text.trim()
      )
      .map(
        (entry) =>
          (
            entry.time.trim() +
            ' ' +
            entry.text.trim()
          ).trim()
      );

  return [
    header,
    ...(impactLines.length > 0
      ? [
          'Impact Link :',
          ...impactLines,
          '',
        ]
      : []),
    'Occur Time = ' +
      report.occurTime.trim(),
    'Dispacth Time = ' +
      report.dispatchTime.trim(),
    'PIC = ' +
      report.pic.trim(),
    ...rootcauseLines,
    ...cutPointLines,
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

function linkMarkerFromText(
  value: string
): LinkMarker {
  if (value.includes('✅')) {
    return 'up';
  }

  if (value.includes('❌')) {
    return 'down';
  }

  if (
    value.includes('⚠️') ||
    value.includes('⚠')
  ) {
    return 'warning';
  }

  return 'unknown';
}

function stripLinkMarkers(
  value: string
): string {
  return value
    .replace(
      /✅|❌|⚠️|⚠/g,
      ''
    )
    .trim();
}

function normalizeReportDateTime(
  value: string
): string {
  const cleaned =
    cleanImportedValue(
      value
    );

  const isoLike =
    cleaned.match(
      /^(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2})$/
    );

  if (!isoLike) {
    return cleaned;
  }

  return (
    isoLike[3] +
    '/' +
    isoLike[2] +
    '/' +
    isoLike[1] +
    ' ' +
    isoLike[4].padStart(
      2,
      '0'
    ) +
    ':' +
    isoLike[5]
  );
}

function parseOperationalTitle(
  value: string,
  index: number
): ImpactLink | null {
  const cleaned =
    value
      .trim()
      .replace(
        /^\*+\s*/,
        ''
      )
      .replace(
        /\s*\*+$/,
        ''
      )
      .replace(
        /^[-•]\s*/,
        ''
      )
      .trim();

  const marker =
    linkMarkerFromText(
      cleaned
    );

  const withoutMarker =
    stripLinkMarkers(
      cleaned
    );

  const match =
    withoutMarker.match(
      /^\[([^\]]+)\]\s*(\[[^\]]+\])?\s*(.*?)\s+-\s+((?:[A-Z0-9_]+-)*INC-\d{8}-\d+)\s*$/i
    );

  if (!match) {
    return null;
  }

  return {
    id:
      'impact-' +
      String(index + 1).padStart(
        3,
        '0'
      ),
    marker,
    region:
      cleanImportedValue(
        match[1]
      ),
    statusTag:
      cleanImportedValue(
        match[2] ??
          ''
      ),
    summary:
      cleanImportedValue(
        match[3]
      ),
    ticket:
      cleanImportedValue(
        match[4]
      ),
  };
}

function parseFlexibleImpactLink(
  value: string,
  index: number
): ImpactLink | null {
  const cleaned =
    value
      .trim()
      .replace(
        /^\*+\s*/,
        ''
      )
      .replace(
        /\s*\*+$/,
        ''
      )
      .replace(
        /^[-•]\s*/,
        ''
      )
      .trim();

  if (!cleaned) {
    return null;
  }

  const marker =
    linkMarkerFromText(
      cleaned
    );

  let body =
    stripLinkMarkers(
      cleaned
    );

  let ticket = '';

  const ticketMatch =
    body.match(
      /(?:\s+-\s+|\s+)((?:[A-Z0-9_]+-)*INC-\d{8}-\d+)\s*$/i
    );

  if (ticketMatch) {
    ticket =
      cleanImportedValue(
        ticketMatch[1]
      );

    body =
      body
        .slice(
          0,
          ticketMatch.index
        )
        .replace(
          /\s+-\s*$/,
          ''
        )
        .trim();
  }

  let region = '';
  let statusTag = '';
  let summary = body;

  const doubleBracket =
    body.match(
      /^\[([^\]]+)\]\s*(\[[^\]]+\])\s*(.*)$/i
    );

  if (doubleBracket) {
    region =
      cleanImportedValue(
        doubleBracket[1]
      );

    statusTag =
      cleanImportedValue(
        doubleBracket[2]
      );

    summary =
      cleanImportedValue(
        doubleBracket[3]
      );
  } else {
    const singleBracket =
      body.match(
        /^\[([^\]]+)\]\s*(.*)$/i
      );

    if (singleBracket) {
      const bracketValue =
        cleanImportedValue(
          singleBracket[1]
        );

      const remainder =
        cleanImportedValue(
          singleBracket[2]
        );

      if (
        /\b(open|close|closed|major|minor|critical|warning)\b/i.test(
          bracketValue
        )
      ) {
        statusTag =
          '[' +
          bracketValue +
          ']';
      } else {
        region =
          bracketValue;
      }

      summary =
        remainder;
    }
  }

  if (
    !region &&
    !statusTag &&
    !summary &&
    !ticket
  ) {
    return null;
  }

  return {
    id:
      'impact-' +
      String(index + 1).padStart(
        3,
        '0'
      ),
    marker,
    region,
    statusTag,
    summary,
    ticket,
  };
}

function extractOperationalImpactLinks(
  metadataRaw: string
): ImpactLink[] {
  const blockMatch =
    metadataRaw.match(
      /\bImpact\s*Link\s*:\s*([\s\S]*?)(?=\s*Occur\s*Time\s*=|$)/i
    );

  if (!blockMatch) {
    return [];
  }

  const rawBlock =
    blockMatch[1]
      .replace(
        /\r/g,
        ''
      )
      .trim();

  if (!rawBlock) {
    return [];
  }

  const normalizedBlock =
    rawBlock
      .replace(
        /[ \t]+(?=\*\s*(?:✅|❌|⚠️|⚠)?)/g,
        '\n'
      )
      .trim();

  const lines =
    normalizedBlock
      .split('\n')
      .map(
        (line) =>
          line.trim()
      )
      .filter(Boolean);

  return lines
    .map(
      (line, index) =>
        parseFlexibleImpactLink(
          line,
          index
        )
    )
    .filter(
      (
        entry
      ): entry is ImpactLink =>
        entry !== null
    );
}

type ParsedCpValue = {
  label: string;
  value: string;
  marker: LinkMarker;
};

function parseCpValues(
  raw: string
): ParsedCpValue[] {
  const normalized =
    raw
      .replace(
        /\s+/g,
        ' '
      )
      .trim();

  if (!normalized) {
    return [];
  }

  const pattern =
    /\b(CP\s*\d+)\s*(.*?)(?=\s+\bCP\s*\d+\b|$)/gi;

  const values:
    ParsedCpValue[] = [];

  let match:
    RegExpExecArray | null;

  while (
    (match =
      pattern.exec(
        normalized
      )) !== null
  ) {
    const marker =
      linkMarkerFromText(
        match[2]
      );

    values.push({
      label:
        match[1]
          .replace(
            /\s+/g,
            ''
          )
          .toUpperCase(),
      value:
        cleanImportedValue(
          stripLinkMarkers(
            match[2]
          )
        ),
      marker,
    });
  }

  return values;
}

function buildCutPointEntries(
  rootcauseRaw: string,
  cutPointRaw: string
): CutPointEntry[] {
  const rootcauseValues =
    parseCpValues(
      rootcauseRaw
    );

  const cutPointValues =
    parseCpValues(
      cutPointRaw
    );

  if (
    rootcauseValues.length === 0 &&
    cutPointValues.length === 0
  ) {
    return [];
  }

  const labels =
    Array.from(
      new Set([
        ...rootcauseValues.map(
          (entry) =>
            entry.label
        ),
        ...cutPointValues.map(
          (entry) =>
            entry.label
        ),
      ])
    );

  return labels.map(
    (label, index) => {
      const rootcause =
        rootcauseValues.find(
          (entry) =>
            entry.label ===
            label
        );

      const cutPoint =
        cutPointValues.find(
          (entry) =>
            entry.label ===
            label
        );

      return {
        id:
          'cp-' +
          String(index + 1).padStart(
            3,
            '0'
          ),
        label,
        rootcause:
          rootcause?.value ??
          '',
        cutPoint:
          cutPoint?.value ??
          '',
        marker:
          cutPoint?.marker ??
          rootcause?.marker ??
          'unknown',
      };
    }
  );
}

export function parseIncidentReport(
  raw: string
): IncidentParseResult {
  const normalized =
    raw
      .replace(
        /\u00a0/g,
        ' '
      )
      .replace(
        /\r/g,
        ''
      )
      .trim();

  const report:
    IncidentReport = {
      ...EMPTY_REPORT,
      progress: [],
      impactLinks: [],
      cutPoints: [],
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
            progressMarkerMatch[0]
              .length
        )
      : '';

  const compactMetadata =
    metadataRaw
      .replace(
        /\n+/g,
        ' '
      )
      .replace(
        /[ \t]+/g,
        ' '
      )
      .trim();

  const headerBoundary =
    compactMetadata.search(
      /\s+(?=(?:Impact\s*Link\s*:|Occur\s*Time\s*=))/i
    );

  const header =
    (
      headerBoundary >= 0
        ? compactMetadata.slice(
            0,
            headerBoundary
          )
        : compactMetadata
    ).trim();

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
    const operationalHeader =
      parseOperationalTitle(
        header,
        0
      );

    if (operationalHeader) {
      report.region =
        operationalHeader.region;

      report.statusTag =
        operationalHeader.statusTag;

      report.primaryMarker =
        operationalHeader.marker;

      report.summary =
        [
          operationalHeader.statusTag,
          operationalHeader.summary,
        ]
          .filter(Boolean)
          .join(' ')
          .trim();

      report.ticket =
        operationalHeader.ticket;
    } else {
      const partialHeader =
        stripLinkMarkers(
          header
        ).match(
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

      const looseBracketTicket =
        compactMetadata.match(
          /\[TT\s*:\s*([^\]]+)\]/i
        );

      if (looseBracketTicket) {
        report.ticket =
          cleanImportedValue(
            looseBracketTicket[1]
          );
      } else {
        const looseOperationalTicket =
          header.match(
            /\s+-\s+((?:[A-Z0-9_]+-)*INC-\d{8}-\d+)\s*\*?\s*$/i
          );

        if (
          looseOperationalTicket
        ) {
          report.ticket =
            cleanImportedValue(
              looseOperationalTicket[1]
            );
        }
      }
    }
  }

  report.impactLinks =
    extractOperationalImpactLinks(
      metadataRaw
    );

  const occurMatch =
    compactMetadata.match(
      /\bOccur\s*Time\s*=\s*(.*?)(?=\s+(?:Dispacth|Dispatch)\s*Time\s*=|$)/i
    );

  const dispatchMatch =
    compactMetadata.match(
      /\b(?:Dispacth|Dispatch)\s*Time\s*=\s*(.*?)(?=\s+PIC\s*=|$)/i
    );

  const picMatch =
    compactMetadata.match(
      /\bPIC\s*=\s*(.*?)(?=\s+(?:Root\s*Cause|Rootcause)\s*=|\s+Cut\s*Point\s*=|$)/i
    );

  const rootcauseMatch =
    compactMetadata.match(
      /\b(?:Root\s*Cause|Rootcause)\s*=\s*(.*?)(?=\s+Cut\s*Point\s*=|$)/i
    );

  const cutPointMatch =
    compactMetadata.match(
      /\bCut\s*Point\s*=\s*(.*?)$/i
    );

  if (occurMatch) {
    report.occurTime =
      normalizeReportDateTime(
        occurMatch[1]
      );
  }

  if (dispatchMatch) {
    report.dispatchTime =
      normalizeReportDateTime(
        dispatchMatch[1]
      );
  }

  if (picMatch) {
    report.pic =
      cleanImportedValue(
        picMatch[1]
      );
  }

  const rootcauseRaw =
    rootcauseMatch?.[1] ??
    '';

  const cutPointRaw =
    cutPointMatch?.[1] ??
    '';

  report.cutPoints =
    buildCutPointEntries(
      rootcauseRaw,
      cutPointRaw
    );

  if (
    report.cutPoints.length >
    0
  ) {
    report.rootcause =
      report.cutPoints
        .map(
          (entry) =>
            (
              entry.label +
              ' ' +
              entry.rootcause
            ).trim()
        )
        .join('\n');

    report.cutPoint =
      report.cutPoints
        .map(
          (entry) =>
            (
              entry.label +
              ' ' +
              entry.cutPoint
            ).trim()
        )
        .join('\n');
  } else {
    report.rootcause =
      cleanImportedValue(
        rootcauseRaw
      );

    report.cutPoint =
      cleanImportedValue(
        cutPointRaw
      );
  }

  report.progress =
    inferProgressDates(
      parseProgressEntries(
        progressRaw
      ),
      report.occurTime
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
      report.progress.length >
      0
        ? 'detected'
        : '',
    ],
  ] as const;

  const detectedFields =
    signals
      .filter(
        ([, value]) =>
          value.trim().length >
          0
      )
      .map(
        ([name]) => name
      );

  const missingFields =
    signals
      .filter(
        ([, value]) =>
          value.trim().length ===
          0
      )
      .map(
        ([name]) => name
      );

  const confidence =
    Math.round(
      (
        detectedFields.length /
        signals.length
      ) *
        100
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


type ProgressDateParts = {
  year: number;
  month: number;
  day: number;
};

function parseProgressDateParts(
  value: string
): ProgressDateParts | null {
  const match =
    value
      .trim()
      .match(
        /^(\d{2})\/(\d{2})\/(\d{4})$/
      );

  if (!match) {
    return null;
  }

  const day =
    Number(match[1]);

  const month =
    Number(match[2]);

  const year =
    Number(match[3]);

  const candidate =
    new Date(
      year,
      month - 1,
      day,
      0,
      0,
      0,
      0
    );

  if (
    candidate.getFullYear() !==
      year ||
    candidate.getMonth() !==
      month - 1 ||
    candidate.getDate() !==
      day
  ) {
    return null;
  }

  return {
    year,
    month,
    day,
  };
}

function progressAnchor(
  value: string
): {
  date: ProgressDateParts;
  clockMinutes: number;
} | null {
  const match =
    value
      .trim()
      .match(
        /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/
      );

  if (!match) {
    return null;
  }

  const date =
    parseProgressDateParts(
      match[1] +
        '/' +
        match[2] +
        '/' +
        match[3]
    );

  const clockMinutes =
    progressTimeToMinutes(
      match[4] +
        ':' +
        match[5]
    );

  if (
    !date ||
    clockMinutes === null
  ) {
    return null;
  }

  return {
    date,
    clockMinutes,
  };
}

function formatProgressDate(
  value: Date
): string {
  return (
    String(
      value.getDate()
    ).padStart(
      2,
      '0'
    ) +
    '/' +
    String(
      value.getMonth() +
        1
    ).padStart(
      2,
      '0'
    ) +
    '/' +
    String(
      value.getFullYear()
    )
  );
}

export function currentProgressStamp(
  now: Date =
    new Date()
): {
  date: string;
  time: string;
} {
  return {
    date:
      formatProgressDate(
        now
      ),
    time:
      String(
        now.getHours()
      ).padStart(
        2,
        '0'
      ) +
      ':' +
      String(
        now.getMinutes()
      ).padStart(
        2,
        '0'
      ),
  };
}

export function progressDateToInput(
  value: string
): string {
  const parts =
    parseProgressDateParts(
      value
    );

  if (!parts) {
    return '';
  }

  return (
    String(
      parts.year
    ).padStart(
      4,
      '0'
    ) +
    '-' +
    String(
      parts.month
    ).padStart(
      2,
      '0'
    ) +
    '-' +
    String(
      parts.day
    ).padStart(
      2,
      '0'
    )
  );
}

export function progressDateFromInput(
  value: string
): string {
  const match =
    value
      .trim()
      .match(
        /^(\d{4})-(\d{2})-(\d{2})$/
      );

  if (!match) {
    return '';
  }

  const date =
    match[3] +
    '/' +
    match[2] +
    '/' +
    match[1];

  return parseProgressDateParts(
    date
  )
    ? date
    : '';
}

export function progressEntryTimestamp(
  entry: ProgressEntry
): number | null {
  const date =
    parseProgressDateParts(
      entry.date ??
        ''
    );

  const clockMinutes =
    progressTimeToMinutes(
      entry.time
    );

  if (
    !date ||
    clockMinutes === null
  ) {
    return null;
  }

  const hours =
    Math.floor(
      clockMinutes /
        60
    );

  const minutes =
    clockMinutes %
    60;

  return new Date(
    date.year,
    date.month - 1,
    date.day,
    hours,
    minutes,
    0,
    0
  ).getTime();
}

export function progressDuplicateKey(
  entry: ProgressEntry
): string {
  const time =
    entry.time.trim();

  if (
    progressTimeToMinutes(
      time
    ) === null
  ) {
    return '';
  }

  const date =
    entry.date?.trim() ??
    '';

  return date
    ? date +
        '|' +
        time
    : time;
}

export function inferProgressDates(
  entries: ProgressEntry[],
  anchorDateTime: string
): ProgressEntry[] {
  const anchor =
    progressAnchor(
      anchorDateTime
    );

  if (!anchor) {
    return entries.map(
      (entry) => ({
        ...entry,
      })
    );
  }

  let cursor =
    new Date(
      anchor.date.year,
      anchor.date.month -
        1,
      anchor.date.day,
      0,
      0,
      0,
      0
    );

  let previousClockMinutes:
    number | null =
      anchor.clockMinutes;

  return entries.map(
    (entry) => {
      const explicitDate =
        parseProgressDateParts(
          entry.date ??
            ''
        );

      const clockMinutes =
        progressTimeToMinutes(
          entry.time
        );

      if (explicitDate) {
        cursor =
          new Date(
            explicitDate.year,
            explicitDate.month -
              1,
            explicitDate.day,
            0,
            0,
            0,
            0
          );

        if (
          clockMinutes !==
          null
        ) {
          previousClockMinutes =
            clockMinutes;
        }

        return {
          ...entry,
          date:
            formatProgressDate(
              cursor
            ),
        };
      }

      if (
        clockMinutes === null
      ) {
        return {
          ...entry,
        };
      }

      if (
        previousClockMinutes !==
          null &&
        (
          previousClockMinutes -
          clockMinutes
        ) >
          12 * 60
      ) {
        cursor =
          new Date(
            cursor.getFullYear(),
            cursor.getMonth(),
            cursor.getDate() +
              1,
            0,
            0,
            0,
            0
          );
      }

      previousClockMinutes =
        clockMinutes;

      return {
        ...entry,
        date:
          formatProgressDate(
            cursor
          ),
      };
    }
  );
}

export function sortProgressChronologically(
  entries: ProgressEntry[],
  anchorDateTime = ''
): ProgressEntry[] {
  const normalized =
    anchorDateTime.trim()
      ? inferProgressDates(
          entries,
          anchorDateTime
        )
      : entries.map(
          (entry) => ({
            ...entry,
          })
        );

  const withTimestamp =
    normalized.map(
      (entry, index) => ({
        entry,
        index,
        timestamp:
          progressEntryTimestamp(
            entry
          ),
      })
    );

  const hasExplicitDates =
    withTimestamp.some(
      (item) =>
        item.timestamp !==
        null
    );

  if (hasExplicitDates) {
    return withTimestamp
      .sort(
        (left, right) => {
          if (
            left.timestamp ===
              null &&
            right.timestamp ===
              null
          ) {
            return (
              left.index -
              right.index
            );
          }

          if (
            left.timestamp ===
            null
          ) {
            return 1;
          }

          if (
            right.timestamp ===
            null
          ) {
            return -1;
          }

          if (
            left.timestamp ===
            right.timestamp
          ) {
            return (
              left.index -
              right.index
            );
          }

          return (
            left.timestamp -
            right.timestamp
          );
        }
      )
      .map(
        ({ entry }) =>
          entry
      );
  }

  //
  // Backward-compatible fallback for legacy workspace
  // entries that have no calendar date yet.
  //
  let dayOffset = 0;

  let previousClockMinutes:
    number | null = null;

  return normalized
    .map(
      (entry, index) => {
        const clockMinutes =
          progressTimeToMinutes(
            entry.time
          );

        if (
          clockMinutes !== null &&
          previousClockMinutes !==
            null &&
          (
            previousClockMinutes -
            clockMinutes
          ) >
            12 * 60
        ) {
          dayOffset += 1;
        }

        const timelineMinutes =
          clockMinutes === null
            ? null
            : (
                clockMinutes +
                dayOffset *
                  24 *
                  60
              );

        if (
          clockMinutes !==
          null
        ) {
          previousClockMinutes =
            clockMinutes;
        }

        return {
          entry,
          index,
          timelineMinutes,
        };
      }
    )
    .sort(
      (left, right) => {
        if (
          left.timelineMinutes ===
            null &&
          right.timelineMinutes ===
            null
        ) {
          return (
            left.index -
            right.index
          );
        }

        if (
          left.timelineMinutes ===
          null
        ) {
          return 1;
        }

        if (
          right.timelineMinutes ===
          null
        ) {
          return -1;
        }

        if (
          left.timelineMinutes ===
          right.timelineMinutes
        ) {
          return (
            left.index -
            right.index
          );
        }

        return (
          left.timelineMinutes -
          right.timelineMinutes
        );
      }
    )
    .map(
      ({ entry }) =>
        entry
    );
}

export function duplicateProgressTimes(
  entries: ProgressEntry[]
): string[] {
  const counts =
    new Map<
      string,
      {
        count: number;
        entry: ProgressEntry;
      }
    >();

  for (const entry of entries) {
    const key =
      progressDuplicateKey(
        entry
      );

    if (!key) {
      continue;
    }

    const current =
      counts.get(key);

    counts.set(
      key,
      {
        count:
          (
            current?.count ??
            0
          ) + 1,
        entry:
          current?.entry ??
          entry,
      }
    );
  }

  return Array.from(
    counts.entries()
  )
    .filter(
      ([, value]) =>
        value.count > 1
    )
    .sort(
      (
        [, left],
        [, right]
      ) => {
        const leftTimestamp =
          progressEntryTimestamp(
            left.entry
          );

        const rightTimestamp =
          progressEntryTimestamp(
            right.entry
          );

        if (
          leftTimestamp !==
            null &&
          rightTimestamp !==
            null
        ) {
          return (
            leftTimestamp -
            rightTimestamp
          );
        }

        return (
          (
            progressTimeToMinutes(
              left.entry.time
            ) ??
            0
          ) -
          (
            progressTimeToMinutes(
              right.entry.time
            ) ??
            0
          )
        );
      }
    )
    .map(
      ([key]) => key
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
