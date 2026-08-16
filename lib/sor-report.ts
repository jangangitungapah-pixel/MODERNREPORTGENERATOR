import type {
  SorResult,
  TracePoint,
} from 'sor-reader/browser';

type SorKeyEvent = {
  type: string;
  distance: string;
  slope: string;
  'splice loss': string;
  'refl loss': string;
  comments: string;
};

export type SorEventRow = {
  number: number;
  type: string;
  distance: string;
  slope: string;
  spliceLoss: string;
  reflectance: string;
  comments: string;
};

export type TraceBounds = {
  minDistance: number;
  maxDistance: number;
  minPower: number;
  maxPower: number;
};

function isSorKeyEvent(
  value: unknown
): value is SorKeyEvent {
  if (
    typeof value !== 'object' ||
    value === null
  ) {
    return false;
  }

  const candidate =
    value as Record<
      string,
      unknown
    >;

  return (
    typeof candidate.type ===
      'string' &&
    typeof candidate.distance ===
      'string'
  );
}

export function extractSorEvents(
  result: SorResult
): SorEventRow[] {
  return Object.entries(
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
          value as SorKeyEvent;

        const number =
          Number(
            key.match(
              /\d+/
            )?.[0] ??
              0
          );

        return {
          number,
          type:
            event.type,
          distance:
            event.distance,
          slope:
            event.slope,
          spliceLoss:
            event[
              'splice loss'
            ],
          reflectance:
            event[
              'refl loss'
            ],
          comments:
            event.comments,
        };
      }
    )
    .sort(
      (left, right) =>
        left.number -
        right.number
    );
}

export function traceBounds(
  trace: TracePoint[]
): TraceBounds {
  if (trace.length === 0) {
    return {
      minDistance: 0,
      maxDistance: 1,
      minPower: 0,
      maxPower: 1,
    };
  }

  let minDistance =
    trace[0].distance;

  let maxDistance =
    trace[0].distance;

  let minPower =
    trace[0].power;

  let maxPower =
    trace[0].power;

  for (const point of trace) {
    minDistance =
      Math.min(
        minDistance,
        point.distance
      );

    maxDistance =
      Math.max(
        maxDistance,
        point.distance
      );

    minPower =
      Math.min(
        minPower,
        point.power
      );

    maxPower =
      Math.max(
        maxPower,
        point.power
      );
  }

  if (
    minDistance ===
    maxDistance
  ) {
    maxDistance =
      minDistance + 1;
  }

  if (
    minPower ===
    maxPower
  ) {
    maxPower =
      minPower + 1;
  }

  return {
    minDistance,
    maxDistance,
    minPower,
    maxPower,
  };
}

export function downsampleTrace(
  trace: TracePoint[],
  maxPoints = 1000
): TracePoint[] {
  if (
    trace.length <=
      maxPoints ||
    maxPoints < 8
  ) {
    return [...trace];
  }

  const interiorLimit =
    Math.max(
      2,
      maxPoints - 2
    );

  const bucketCount =
    Math.max(
      1,
      Math.floor(
        interiorLimit / 2
      )
    );

  const bucketSize =
    (
      trace.length -
      2
    ) /
    bucketCount;

  const sampled:
    Array<{
      index: number;
      point: TracePoint;
    }> = [
      {
        index: 0,
        point: trace[0],
      },
    ];

  for (
    let bucket = 0;
    bucket < bucketCount;
    bucket += 1
  ) {
    const start =
      1 +
      Math.floor(
        bucket *
          bucketSize
      );

    const end =
      Math.min(
        trace.length - 1,
        1 +
          Math.floor(
            (
              bucket +
              1
            ) *
              bucketSize
          )
      );

    if (start >= end) {
      continue;
    }

    let minIndex = start;
    let maxIndex = start;

    for (
      let index = start + 1;
      index < end;
      index += 1
    ) {
      if (
        trace[index].power <
        trace[minIndex].power
      ) {
        minIndex = index;
      }

      if (
        trace[index].power >
        trace[maxIndex].power
      ) {
        maxIndex = index;
      }
    }

    const indices =
      minIndex === maxIndex
        ? [minIndex]
        : [
            Math.min(
              minIndex,
              maxIndex
            ),
            Math.max(
              minIndex,
              maxIndex
            ),
          ];

    for (const index of indices) {
      sampled.push({
        index,
        point:
          trace[index],
      });
    }
  }

  sampled.push({
    index:
      trace.length - 1,
    point:
      trace[
        trace.length - 1
      ],
  });

  return sampled
    .sort(
      (left, right) =>
        left.index -
        right.index
    )
    .slice(
      0,
      maxPoints
    )
    .map(
      (item) =>
        item.point
    );
}

export function traceToSvgPoints(
  trace: TracePoint[],
  bounds: TraceBounds,
  width: number,
  height: number,
  padding = 20
): string {
  const innerWidth =
    Math.max(
      1,
      width -
        padding * 2
    );

  const innerHeight =
    Math.max(
      1,
      height -
        padding * 2
    );

  const xRange =
    bounds.maxDistance -
    bounds.minDistance;

  const yRange =
    bounds.maxPower -
    bounds.minPower;

  return trace
    .map(
      (point) => {
        const x =
          padding +
          (
            (
              point.distance -
              bounds.minDistance
            ) /
            xRange
          ) *
            innerWidth;

        const y =
          padding +
          (
            1 -
            (
              point.power -
              bounds.minPower
            ) /
              yRange
          ) *
            innerHeight;

        return (
          x.toFixed(2) +
          ',' +
          y.toFixed(2)
        );
      }
    )
    .join(' ');
}

export function safePdfFilename(
  filename: string
): string {
  const base =
    filename
      .replace(
        /\.sor$/i,
        ''
      )
      .replace(
        /[<>:"/\\|?*\u0000-\u001f]/g,
        '_'
      )
      .trim() ||
    'otdr-trace';

  return (
    base +
    '-OTDR-report.pdf'
  );
}

export function formatFileSize(
  bytes: number
): string {
  if (
    !Number.isFinite(bytes) ||
    bytes <= 0
  ) {
    return '0 KB';
  }

  if (bytes < 1024) {
    return (
      bytes + ' B'
    );
  }

  if (
    bytes <
    1024 * 1024
  ) {
    return (
      (
        bytes / 1024
      ).toFixed(1) +
      ' KB'
    );
  }

  return (
    (
      bytes /
      (
        1024 *
        1024
      )
    ).toFixed(2) +
    ' MB'
  );
}
