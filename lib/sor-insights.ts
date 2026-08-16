import type {
  SorResult,
} from 'sor-reader/browser';

type SorKeyEventLike = {
  type: string;
  distance: string;
  slope: string;
  'splice loss': string;
  'refl loss': string;
  comments: string;
  'end of prev'?: string;
  'start of curr'?: string;
  'end of curr'?: string;
  'start of next'?: string;
  peak?: string;
};

export type SorEventCategory =
  | 'reflective'
  | 'non-reflective'
  | 'multiple'
  | 'end-of-fiber'
  | 'unknown';

export type SorEventScreening =
  | 'normal'
  | 'attention'
  | 'not-evaluated';

export type SorDetailedEvent = {
  number: number;
  rawType: string;
  category: SorEventCategory;
  categoryLabel: string;
  distanceKm: number | null;
  slopeDbKm: number | null;
  lossDb: number | null;
  reflectanceDb: number | null;
  cumulativeEventLossDb: number;
  comments: string;
  screening: SorEventScreening;
  screeningReasons: string[];
  window: {
    endOfPreviousKm: number | null;
    startOfCurrentKm: number | null;
    endOfCurrentKm: number | null;
    startOfNextKm: number | null;
    peakKm: number | null;
  };
};

export type SorThresholds = {
  lossDb: number | null;
  reflectanceDb: number | null;
  endOfFiberDb: number | null;
};

export type SorInsights = {
  fiberLengthKm: number | null;
  measuredSpanKm: number | null;
  totalLossDb: number | null;
  averageAttenuationDbKm:
    | number
    | null;
  orlDb: number | null;
  events: SorDetailedEvent[];
  eventCount: number;
  reflectiveCount: number;
  nonReflectiveCount: number;
  endOfFiberCount: number;
  otherEventCount: number;
  attentionEventCount: number;
  worstLossEvent:
    | SorDetailedEvent
    | null;
  worstReflectanceEvent:
    | SorDetailedEvent
    | null;
  checksumValid: boolean;
  thresholds: SorThresholds;
  thresholdCount: number;
  screeningStatus:
    | 'clear'
    | 'attention'
    | 'informational';
  screeningNotes: string[];
  standardBlockCount: number;
  vendorBlockCount: number;
  vendorBlocks: Array<{
    name: string;
    byteLength: number | null;
  }>;
};

function numeric(
  value: unknown
): number | null {
  if (
    typeof value === 'number'
  ) {
    return Number.isFinite(value)
      ? value
      : null;
  }

  if (
    typeof value !== 'string'
  ) {
    return null;
  }

  const match =
    value
      .replace(',', '.')
      .match(
        /-?\d+(?:\.\d+)?/
      );

  if (!match) {
    return null;
  }

  const parsed =
    Number.parseFloat(
      match[0]
    );

  return Number.isFinite(parsed)
    ? parsed
    : null;
}

function isSorKeyEvent(
  value: unknown
): value is SorKeyEventLike {
  if (
    typeof value !== 'object' ||
    value === null
  ) {
    return false;
  }

  const record =
    value as Record<
      string,
      unknown
    >;

  return (
    typeof record.type ===
      'string' &&
    typeof record.distance ===
      'string' &&
    typeof record[
      'splice loss'
    ] === 'string'
  );
}

export function classifySorEvent(
  rawType: string
): {
  category: SorEventCategory;
  label: string;
} {
  const value =
    rawType.toLowerCase();

  if (
    /9999l[e]/i.test(
      rawType
    ) ||
    value.includes(
      'end of fiber'
    ) ||
    value.includes(
      'end-of-fiber'
    ) ||
    value.includes(
      'end of fibre'
    )
  ) {
    return {
      category:
        'end-of-fiber',
      label:
        'End of fiber',
    };
  }

  if (
    value.includes(
      'multiple'
    )
  ) {
    return {
      category:
        'multiple',
      label:
        'Multiple reflection',
    };
  }

  if (
    value.includes(
      'reflection'
    )
  ) {
    return {
      category:
        'reflective',
      label:
        'Reflective event',
    };
  }

  if (
    value.includes(
      'loss/drop/gain'
    ) ||
    value.includes(
      'loss'
    )
  ) {
    return {
      category:
        'non-reflective',
      label:
        'Non-reflective loss',
    };
  }

  return {
    category:
      'unknown',
    label:
      'Other event',
  };
}

function vendorByteLength(
  value: unknown
): number | null {
  if (
    value instanceof Uint8Array
  ) {
    return value.byteLength;
  }

  if (
    typeof value !== 'object' ||
    value === null
  ) {
    return null;
  }

  const record =
    value as Record<
      string,
      unknown
    >;

  if (
    record.bytes instanceof
    Uint8Array
  ) {
    return (
      record.bytes.byteLength
    );
  }

  return null;
}

function maxNullable(
  values: Array<
    number | null
  >
): number | null {
  const usable =
    values.filter(
      (
        value
      ): value is number =>
        value !== null &&
        Number.isFinite(value)
    );

  return usable.length > 0
    ? Math.max(...usable)
    : null;
}

export function buildSorInsights(
  result: SorResult
): SorInsights {
  const thresholds:
    SorThresholds = {
      lossDb:
        numeric(
          result.FxdParams[
            'loss thr'
          ]
        ),
      reflectanceDb:
        numeric(
          result.FxdParams[
            'refl thr'
          ]
        ),
      endOfFiberDb:
        numeric(
          result.FxdParams[
            'EOT thr'
          ]
        ),
    };

  let cumulativeEventLoss =
    0;

  const events =
    Object.entries(
      result.KeyEvents
    )
      .filter(
        ([key, value]) =>
          /^event \d+$/i.test(
            key
          ) &&
          isSorKeyEvent(
            value
          )
      )
      .map(
        ([key, value]) => {
          const event =
            value as SorKeyEventLike;

          return {
            number:
              Number(
                key.match(
                  /\d+/
                )?.[0] ??
                  0
              ),
            event,
          };
        }
      )
      .sort(
        (left, right) =>
          left.number -
          right.number
      )
      .map(
        ({
          number,
          event,
        }) => {
          const classification =
            classifySorEvent(
              event.type
            );

          const lossDb =
            numeric(
              event[
                'splice loss'
              ]
            );

          const reflectanceDb =
            numeric(
              event[
                'refl loss'
              ]
            );

          const reasons:
            string[] = [];

          if (
            lossDb !== null &&
            thresholds.lossDb !==
              null &&
            lossDb >
              thresholds.lossDb
          ) {
            reasons.push(
              'Loss ' +
                lossDb.toFixed(
                  3
                ) +
                ' dB exceeds stored threshold ' +
                thresholds.lossDb.toFixed(
                  3
                ) +
                ' dB.'
            );
          }

          if (
            reflectanceDb !==
              null &&
            thresholds.reflectanceDb !==
              null &&
            (
              classification.category ===
                'reflective' ||
              classification.category ===
                'multiple'
            ) &&
            reflectanceDb >
              thresholds.reflectanceDb
          ) {
            reasons.push(
              'Reflectance ' +
                reflectanceDb.toFixed(
                  3
                ) +
                ' dB is above stored threshold ' +
                thresholds.reflectanceDb.toFixed(
                  3
                ) +
                ' dB.'
            );
          }

          if (
            lossDb !== null &&
            lossDb > 0
          ) {
            cumulativeEventLoss +=
              lossDb;
          }

          const canEvaluate =
            thresholds.lossDb !==
              null ||
            (
              thresholds.reflectanceDb !==
                null &&
              (
                classification.category ===
                  'reflective' ||
                classification.category ===
                  'multiple'
              )
            );

          return {
            number,
            rawType:
              event.type,
            category:
              classification.category,
            categoryLabel:
              classification.label,
            distanceKm:
              numeric(
                event.distance
              ),
            slopeDbKm:
              numeric(
                event.slope
              ),
            lossDb,
            reflectanceDb,
            cumulativeEventLossDb:
              cumulativeEventLoss,
            comments:
              event.comments,
            screening:
              reasons.length > 0
                ? 'attention'
                : canEvaluate
                  ? 'normal'
                  : 'not-evaluated',
            screeningReasons:
              reasons,
            window: {
              endOfPreviousKm:
                numeric(
                  event[
                    'end of prev'
                  ]
                ),
              startOfCurrentKm:
                numeric(
                  event[
                    'start of curr'
                  ]
                ),
              endOfCurrentKm:
                numeric(
                  event[
                    'end of curr'
                  ]
                ),
              startOfNextKm:
                numeric(
                  event[
                    'start of next'
                  ]
                ),
              peakKm:
                numeric(
                  event.peak
                ),
            },
          } satisfies
            SorDetailedEvent;
        }
      );

  let traceLength:
    number | null = null;

  for (
    const point of
    result.trace
  ) {
    if (
      !Number.isFinite(
        point.distance
      )
    ) {
      continue;
    }

    traceLength =
      traceLength === null
        ? point.distance
        : Math.max(
            traceLength,
            point.distance
          );
  }

  const eventLength =
    maxNullable(
      events.map(
        (event) =>
          event.distanceKm
      )
    );

  const fiberLengthKm =
    maxNullable([
      traceLength,
      eventLength,
    ]);

  const summary =
    result.KeyEvents.Summary;

  const lossStart =
    numeric(
      summary[
        'loss start'
      ]
    );

  const lossEnd =
    numeric(
      summary[
        'loss end'
      ]
    );

  const measuredSpanKm =
    lossStart !== null &&
    lossEnd !== null &&
    lossEnd > lossStart
      ? lossEnd -
        lossStart
      : fiberLengthKm;

  const totalLossDb =
    numeric(
      summary[
        'total loss'
      ]
    );

  const averageAttenuationDbKm =
    totalLossDb !== null &&
    measuredSpanKm !== null &&
    measuredSpanKm > 0
      ? totalLossDb /
        measuredSpanKm
      : null;

  const worstLossEvent =
    events.reduce<
      SorDetailedEvent | null
    >(
      (worst, event) => {
        if (
          event.lossDb === null
        ) {
          return worst;
        }

        if (
          !worst ||
          worst.lossDb === null ||
          event.lossDb >
            worst.lossDb
        ) {
          return event;
        }

        return worst;
      },
      null
    );

  const worstReflectanceEvent =
    events.reduce<
      SorDetailedEvent | null
    >(
      (worst, event) => {
        if (
          event.reflectanceDb ===
          null
        ) {
          return worst;
        }

        if (
          !worst ||
          worst.reflectanceDb ===
            null ||
          event.reflectanceDb >
            worst.reflectanceDb
        ) {
          return event;
        }

        return worst;
      },
      null
    );

  const attentionEventCount =
    events.filter(
      (event) =>
        event.screening ===
        'attention'
    ).length;

  const thresholdCount =
    Object.values(
      thresholds
    ).filter(
      (value) =>
        value !== null
    ).length;

  const screeningNotes:
    string[] = [];

  if (
    !result.Cksum.match
  ) {
    screeningNotes.push(
      'SOR checksum validation failed. Verify file integrity before relying on the measurement.'
    );
  }

  if (
    attentionEventCount > 0
  ) {
    screeningNotes.push(
      attentionEventCount +
        ' event' +
        (
          attentionEventCount ===
          1
            ? ''
            : 's'
        ) +
        ' exceed threshold values stored inside this SOR file.'
    );
  }

  if (
    thresholdCount === 0
  ) {
    screeningNotes.push(
      'No usable event thresholds were found in this SOR file, so event screening is informational only.'
    );
  }

  const screeningStatus =
    !result.Cksum.match ||
    attentionEventCount > 0
      ? 'attention'
      : thresholdCount > 0
        ? 'clear'
        : 'informational';

  const vendorBlocks =
    Object.entries(
      result.vendorBlocks
    ).map(
      ([name, value]) => ({
        name,
        byteLength:
          vendorByteLength(
            value
          ),
      })
    );

  return {
    fiberLengthKm,
    measuredSpanKm,
    totalLossDb,
    averageAttenuationDbKm,
    orlDb:
      numeric(
        summary.ORL
      ),
    events,
    eventCount:
      events.length,
    reflectiveCount:
      events.filter(
        (event) =>
          event.category ===
          'reflective'
      ).length,
    nonReflectiveCount:
      events.filter(
        (event) =>
          event.category ===
          'non-reflective'
      ).length,
    endOfFiberCount:
      events.filter(
        (event) =>
          event.category ===
          'end-of-fiber'
      ).length,
    otherEventCount:
      events.filter(
        (event) =>
          event.category ===
            'unknown' ||
          event.category ===
            'multiple'
      ).length,
    attentionEventCount,
    worstLossEvent,
    worstReflectanceEvent,
    checksumValid:
      result.Cksum.match,
    thresholds,
    thresholdCount,
    screeningStatus,
    screeningNotes,
    standardBlockCount:
      Object.keys(
        result.blocks
      ).length,
    vendorBlockCount:
      vendorBlocks.length,
    vendorBlocks,
  };
}

export function formatInsightNumber(
  value: number | null,
  digits = 3,
  suffix = ''
): string {
  if (
    value === null ||
    !Number.isFinite(value)
  ) {
    return '—';
  }

  return (
    value.toFixed(digits) +
    suffix
  );
}

export function compactSorValue(
  value: unknown
): string {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return '—';
  }

  if (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'string'
  ) {
    return String(value);
  }

  if (
    Array.isArray(value)
  ) {
    return value
      .map(
        (entry) =>
          String(entry)
      )
      .join(', ');
  }

  if (
    value instanceof Uint8Array
  ) {
    return (
      value.byteLength +
      ' raw bytes'
    );
  }

  try {
    const serialized =
      JSON.stringify(
        value
      );

    if (
      serialized.length >
      180
    ) {
      return (
        serialized.slice(
          0,
          177
        ) +
        '...'
      );
    }

    return serialized;
  } catch {
    return String(value);
  }
}
