import type {
  jsPDF,
} from 'jspdf';

import type {
  SorResult,
} from 'sor-reader/browser';

import {
  buildSorInsights,
  compactSorValue,
} from './sor-insights';

function ascii(
  value: unknown
): string {
  return compactSorValue(
    value
  )
    .replace(
      /[^\x20-\x7E]/g,
      ''
    )
    .trim() ||
    '-';
}

export function appendSorEngineeringAppendix(
  doc: jsPDF,
  result: SorResult
): void {
  const insights =
    buildSorInsights(
      result
    );

  const pageWidth =
    210;

  const pageHeight =
    297;

  const margin =
    16;

  const contentWidth =
    pageWidth -
    margin * 2;

  let y =
    margin;

  function newPage(
    title?: string
  ) {
    doc.addPage();

    y = margin;

    if (title) {
      doc.setFont(
        'helvetica',
        'bold'
      );

      doc.setFontSize(
        15
      );

      doc.setTextColor(
        49,
        56,
        75
      );

      doc.text(
        title,
        margin,
        y
      );

      y += 9;
    }
  }

  function ensure(
    height: number
  ) {
    if (
      y + height >
      pageHeight -
        margin
    ) {
      newPage();
    }
  }

  function section(
    title: string,
    subtitle?: string
  ) {
    ensure(15);

    doc.setFont(
      'helvetica',
      'bold'
    );

    doc.setFontSize(9.5);

    doc.setTextColor(
      82,
      66,
      190
    );

    doc.text(
      title,
      margin,
      y
    );

    y += 5;

    if (subtitle) {
      doc.setFont(
        'helvetica',
        'normal'
      );

      doc.setFontSize(6.4);

      doc.setTextColor(
        139,
        145,
        161
      );

      const lines =
        doc.splitTextToSize(
          ascii(
            subtitle
          ),
          contentWidth
        );

      doc.text(
        lines,
        margin,
        y
      );

      y +=
        lines.length *
          3.2 +
        3;
    } else {
      y += 3;
    }
  }

  function keyValue(
    label: string,
    value: unknown
  ) {
    ensure(7);

    doc.setFont(
      'helvetica',
      'bold'
    );

    doc.setFontSize(6.3);

    doc.setTextColor(
      145,
      151,
      168
    );

    doc.text(
      label.toUpperCase(),
      margin,
      y
    );

    doc.setFont(
      'helvetica',
      'normal'
    );

    doc.setFontSize(7.5);

    doc.setTextColor(
      67,
      75,
      96
    );

    const lines =
      doc.splitTextToSize(
        ascii(value),
        112
      );

    doc.text(
      lines,
      margin + 50,
      y
    );

    y +=
      Math.max(
        6,
        lines.length *
          3.5
      );
  }

  newPage(
    'Engineering Appendix'
  );

  doc.setFont(
    'helvetica',
    'normal'
  );

  doc.setFontSize(7);

  doc.setTextColor(
    130,
    137,
    154
  );

  doc.text(
    doc.splitTextToSize(
      'Detailed analysis derived from the standard fields parsed from the SOR file. ReportOS screening is informational and is not a vendor-certified PASS/FAIL result.',
      contentWidth
    ),
    margin,
    y
  );

  y += 14;

  section(
    'Quick Read'
  );

  keyValue(
    'Fiber length',
    insights.fiberLengthKm !==
    null
      ? insights.fiberLengthKm.toFixed(
          3
        ) +
        ' km'
      : 'Unknown'
  );

  keyValue(
    'Measured span',
    insights.measuredSpanKm !==
    null
      ? insights.measuredSpanKm.toFixed(
          3
        ) +
        ' km'
      : 'Unknown'
  );

  keyValue(
    'Total loss',
    insights.totalLossDb !==
    null
      ? insights.totalLossDb.toFixed(
          3
        ) +
        ' dB'
      : 'Unknown'
  );

  keyValue(
    'Average attenuation',
    insights.averageAttenuationDbKm !==
    null
      ? insights.averageAttenuationDbKm.toFixed(
          3
        ) +
        ' dB/km'
      : 'Unknown'
  );

  keyValue(
    'ORL',
    insights.orlDb !==
    null
      ? insights.orlDb.toFixed(
          3
        ) +
        ' dB'
      : 'Unknown'
  );

  keyValue(
    'Event composition',
    insights.reflectiveCount +
      ' reflective, ' +
      insights.nonReflectiveCount +
      ' non-reflective, ' +
      insights.endOfFiberCount +
      ' end-of-fiber, ' +
      insights.otherEventCount +
      ' other'
  );

  keyValue(
    'Screening',
    insights.screeningStatus ===
      'attention'
      ? 'Needs review'
      : insights.screeningStatus ===
          'clear'
        ? 'No threshold exception detected'
        : 'Informational'
  );

  if (
    insights.screeningNotes.length >
    0
  ) {
    section(
      'Screening Notes'
    );

    for (
      const note of
      insights.screeningNotes
    ) {
      ensure(8);

      doc.setFont(
        'helvetica',
        'normal'
      );

      doc.setFontSize(7);

      doc.setTextColor(
        83,
        90,
        108
      );

      const lines =
        doc.splitTextToSize(
          '- ' +
            ascii(note),
          contentWidth
        );

      doc.text(
        lines,
        margin,
        y
      );

      y +=
        lines.length *
          3.4 +
        2;
    }
  }

  section(
    'Stored Thresholds',
    'Values below are read from the SOR fixed-parameter block.'
  );

  keyValue(
    'Event loss threshold',
    insights.thresholds.lossDb !==
    null
      ? insights.thresholds.lossDb.toFixed(
          3
        ) +
        ' dB'
      : 'Not available'
  );

  keyValue(
    'Reflectance threshold',
    insights.thresholds.reflectanceDb !==
    null
      ? insights.thresholds.reflectanceDb.toFixed(
          3
        ) +
        ' dB'
      : 'Not available'
  );

  keyValue(
    'End-of-fiber threshold',
    insights.thresholds.endOfFiberDb !==
    null
      ? insights.thresholds.endOfFiberDb.toFixed(
          3
        ) +
        ' dB'
      : 'Not available'
  );

  section(
    'Detailed Events'
  );

  for (
    const event of
    insights.events
  ) {
    ensure(31);

    doc.setFillColor(
      249,
      250,
      253
    );

    doc.setDrawColor(
      233,
      235,
      241
    );

    doc.roundedRect(
      margin,
      y,
      contentWidth,
      27,
      2,
      2,
      'FD'
    );

    doc.setFont(
      'helvetica',
      'bold'
    );

    doc.setFontSize(8);

    doc.setTextColor(
      66,
      73,
      94
    );

    doc.text(
      '#' +
        event.number +
        '  ' +
        ascii(
          event.categoryLabel
        ),
      margin + 4,
      y + 6
    );

    doc.setFont(
      'helvetica',
      'normal'
    );

    doc.setFontSize(6.5);

    doc.setTextColor(
      126,
      133,
      151
    );

    const lineOne =
      [
        event.distanceKm !==
        null
          ? event.distanceKm.toFixed(
              3
            ) +
            ' km'
          : 'distance -',
        event.lossDb !==
        null
          ? event.lossDb.toFixed(
              3
            ) +
            ' dB loss'
          : 'loss -',
        event.slopeDbKm !==
        null
          ? event.slopeDbKm.toFixed(
              3
            ) +
            ' dB/km slope'
          : 'slope -',
        event.reflectanceDb !==
        null
          ? event.reflectanceDb.toFixed(
              3
            ) +
            ' dB reflectance'
          : 'reflectance -',
      ].join('  |  ');

    doc.text(
      ascii(
        lineOne
      ),
      margin + 4,
      y + 12
    );

    const windowLine =
      [
        event.window.endOfPreviousKm !==
        null
          ? 'prev-end ' +
            event.window.endOfPreviousKm.toFixed(
              3
            )
          : null,
        event.window.startOfCurrentKm !==
        null
          ? 'curr-start ' +
            event.window.startOfCurrentKm.toFixed(
              3
            )
          : null,
        event.window.endOfCurrentKm !==
        null
          ? 'curr-end ' +
            event.window.endOfCurrentKm.toFixed(
              3
            )
          : null,
        event.window.startOfNextKm !==
        null
          ? 'next-start ' +
            event.window.startOfNextKm.toFixed(
              3
            )
          : null,
        event.window.peakKm !==
        null
          ? 'peak ' +
            event.window.peakKm.toFixed(
              3
            )
          : null,
      ]
        .filter(Boolean)
        .join('  |  ');

    doc.text(
      ascii(
        windowLine ||
          'Measurement window not present'
      ),
      margin + 4,
      y + 18
    );

    doc.setFont(
      'helvetica',
      'bold'
    );

    doc.setTextColor(
      event.screening ===
        'attention'
        ? 165
        : 82,
      event.screening ===
        'attention'
        ? 83
        : 113,
      event.screening ===
        'attention'
        ? 63
        : 94
    );

    doc.text(
      event.screening ===
        'attention'
        ? 'REVIEW'
        : event.screening ===
            'normal'
          ? 'WITHIN STORED THRESHOLD'
          : 'INFORMATIONAL',
      margin + 4,
      y + 24
    );

    y += 31;
  }

  newPage(
    'SOR Field Inventory'
  );

  section(
    'General Parameters'
  );

  for (
    const [
      key,
      value,
    ] of Object.entries(
      result.GenParams
    )
  ) {
    keyValue(
      key,
      value
    );
  }

  section(
    'Fixed Parameters'
  );

  for (
    const [
      key,
      value,
    ] of Object.entries(
      result.FxdParams
    )
  ) {
    keyValue(
      key,
      value
    );
  }

  section(
    'Supplier Parameters'
  );

  for (
    const [
      key,
      value,
    ] of Object.entries(
      result.SupParams
    )
  ) {
    keyValue(
      key,
      value
    );
  }

  section(
    'Key Event Summary'
  );

  for (
    const [
      key,
      value,
    ] of Object.entries(
      result.KeyEvents
        .Summary
    )
  ) {
    keyValue(
      key,
      value
    );
  }

  section(
    'Block Inventory'
  );

  for (
    const [
      name,
      block,
    ] of Object.entries(
      result.blocks
    )
  ) {
    keyValue(
      name,
      'v' +
        block.version +
        ' / ' +
        block.size +
        ' bytes / order ' +
        block.order
    );
  }

  if (
    insights.vendorBlockCount >
    0
  ) {
    section(
      'Vendor / Proprietary Blocks',
      'Raw proprietary blocks are preserved by sor-reader, but their vendor-specific semantics are not automatically decoded.'
    );

    for (
      const block of
      insights.vendorBlocks
    ) {
      keyValue(
        block.name,
        block.byteLength !==
        null
          ? block.byteLength +
            ' raw bytes'
          : 'present'
      );
    }
  }
}
