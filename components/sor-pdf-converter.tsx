'use client';

import Link from 'next/link';

import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Check,
  Database,
  Download,
  FileOutput,
  FileText,
  Gauge,
  RotateCcw,
  ShieldCheck,
  Upload,
  X,
} from 'lucide-react';

import {
  useMemo,
  useRef,
  useState,
} from 'react';

import type {
  SorResult,
  TracePoint,
} from 'sor-reader/browser';

import {
  downsampleTrace,
  extractSorEvents,
  formatFileSize,
  safePdfFilename,
  traceBounds,
  traceToSvgPoints,
} from '@/lib/sor-report';

import {
  SorAnalysisPanel,
} from '@/components/sor-analysis-panel';

import {
  appendSorEngineeringAppendix,
} from '@/lib/sor-pdf-appendix';

type ConverterStatus =
  | 'idle'
  | 'parsing'
  | 'ready'
  | 'error';

const SVG_WIDTH = 1000;
const SVG_HEIGHT = 260;
const SVG_PADDING = 24;

function displayValue(
  value: unknown,
  fallback = '—'
): string {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return fallback;
  }

  return String(value);
}

function shortEventType(
  value: string
): string {
  return value
    .replace(
      /\s*\{(?:manual|auto)\}/gi,
      ''
    )
    .replace(
      /^\S+\s*/,
      ''
    )
    .trim() ||
    value;
}

function pdfValue(
  value: unknown
): string {
  const text =
    displayValue(
      value
    );

  return text
    .replace(
      /[^\x20-\x7E]/g,
      ''
    )
    .trim() ||
    '-';
}

export function SorPdfConverter() {
  const inputRef =
    useRef<HTMLInputElement>(
      null
    );

  const [status, setStatus] =
    useState<ConverterStatus>(
      'idle'
    );

  const [
    selectedFile,
    setSelectedFile,
  ] = useState<File | null>(
    null
  );

  const [
    parsed,
    setParsed,
  ] = useState<SorResult | null>(
    null
  );

  const [
    errorMessage,
    setErrorMessage,
  ] = useState('');

  const [
    dragActive,
    setDragActive,
  ] = useState(false);

  const [
    exporting,
    setExporting,
  ] = useState(false);

  const events =
    useMemo(
      () =>
        parsed
          ? extractSorEvents(
              parsed
            )
          : [],
      [parsed]
    );

  const previewTrace =
    useMemo(
      () =>
        parsed
          ? downsampleTrace(
              parsed.trace,
              1200
            )
          : [],
      [parsed]
    );

  const bounds =
    useMemo(
      () =>
        traceBounds(
          parsed?.trace ??
            []
        ),
      [parsed]
    );

  const svgPoints =
    useMemo(
      () =>
        traceToSvgPoints(
          previewTrace,
          bounds,
          SVG_WIDTH,
          SVG_HEIGHT,
          SVG_PADDING
        ),
      [
        bounds,
        previewTrace,
      ]
    );

  const eventMarkers =
    useMemo(
      () => {
        const distanceRange =
          bounds.maxDistance -
          bounds.minDistance;

        return events
          .map(
            (event) => {
              const distance =
                Number.parseFloat(
                  event.distance
                );

              if (
                !Number.isFinite(
                  distance
                )
              ) {
                return null;
              }

              const x =
                SVG_PADDING +
                (
                  (
                    distance -
                    bounds.minDistance
                  ) /
                  distanceRange
                ) *
                  (
                    SVG_WIDTH -
                    SVG_PADDING *
                      2
                  );

              return {
                ...event,
                x,
              };
            }
          )
          .filter(
            (
              event
            ): event is
              NonNullable<
                typeof event
              > =>
              event !== null
          );
      },
      [
        bounds,
        events,
      ]
    );

  function reset() {
    setStatus('idle');
    setSelectedFile(
      null
    );
    setParsed(null);
    setErrorMessage('');
    setDragActive(false);

    if (inputRef.current) {
      inputRef.current.value =
        '';
    }
  }

  async function parseFile(
    file: File
  ) {
    const fileName =
      file.name.toLowerCase();

    if (
      !fileName.endsWith(
        '.sor'
      )
    ) {
      setStatus('error');
      setErrorMessage(
        'File harus berformat .SOR.'
      );
      setParsed(null);
      setSelectedFile(
        file
      );

      return;
    }

    if (
      file.size >
      64 *
        1024 *
        1024
    ) {
      setStatus('error');
      setErrorMessage(
        'File lebih besar dari 64 MB. Gunakan file SOR hasil OTDR asli atau export yang lebih kecil.'
      );
      setParsed(null);
      setSelectedFile(
        file
      );

      return;
    }

    setStatus('parsing');
    setErrorMessage('');
    setSelectedFile(
      file
    );
    setParsed(null);

    try {
      const buffer =
        await file.arrayBuffer();

      const {
        parseSor,
      } =
        await import(
          'sor-reader/browser'
        );

      const result =
        parseSor(
          new Uint8Array(
            buffer
          ),
          file.name
        );

      setParsed(result);
      setStatus('ready');
    } catch (error) {
      setStatus('error');

      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'SOR parser gagal membaca file.'
      );
    }
  }

  async function exportPdf() {
    if (
      !parsed ||
      !selectedFile
    ) {
      return;
    }

    setExporting(true);

    try {
      const {
        jsPDF,
      } =
        await import(
          'jspdf'
        );

      const doc =
        new jsPDF({
          orientation:
            'portrait',
          unit: 'mm',
          format: 'a4',
          compress: true,
        });

      const pageWidth =
        210;

      const pageHeight =
        297;

      const margin =
        16;

      const contentWidth =
        pageWidth -
        margin * 2;

      let cursorY =
        margin;

      function addPage() {
        doc.addPage();
        cursorY =
          margin;
      }

      function ensureSpace(
        height: number
      ) {
        if (
          cursorY +
            height >
          pageHeight -
            margin
        ) {
          addPage();
        }
      }

      function sectionTitle(
        title: string
      ) {
        ensureSpace(11);

        doc.setFont(
          'helvetica',
          'bold'
        );

        doc.setFontSize(10);
        doc.setTextColor(
          74,
          61,
          190
        );

        doc.text(
          title,
          margin,
          cursorY
        );

        cursorY += 7;
      }

      function keyValue(
        label: string,
        value: unknown
      ) {
        ensureSpace(8);

        doc.setFont(
          'helvetica',
          'bold'
        );

        doc.setFontSize(7);
        doc.setTextColor(
          125,
          132,
          151
        );

        doc.text(
          label.toUpperCase(),
          margin,
          cursorY
        );

        doc.setFont(
          'helvetica',
          'normal'
        );

        doc.setFontSize(8.4);
        doc.setTextColor(
          67,
          75,
          96
        );

        const lines =
          doc.splitTextToSize(
            pdfValue(
              value
            ),
            118
          );

        doc.text(
          lines,
          margin + 47,
          cursorY
        );

        cursorY +=
          Math.max(
            7,
            lines.length *
              4.2
          );
      }

      //
      // Report header
      //
      doc.setFillColor(
        248,
        249,
        253
      );

      doc.rect(
        0,
        0,
        pageWidth,
        42,
        'F'
      );

      doc.setFont(
        'helvetica',
        'bold'
      );

      doc.setFontSize(8);
      doc.setTextColor(
        105,
        88,
        220
      );

      doc.text(
        'REPORTOS / FIBER LAB',
        margin,
        15
      );

      doc.setFontSize(20);
      doc.setTextColor(
        44,
        51,
        70
      );

      doc.text(
        'OTDR SOR Analysis Report',
        margin,
        25
      );

      doc.setFont(
        'helvetica',
        'normal'
      );

      doc.setFontSize(8);
      doc.setTextColor(
        126,
        133,
        151
      );

      doc.text(
        pdfValue(
          selectedFile.name
        ),
        margin,
        33
      );

      cursorY = 51;

      //
      // Summary cards
      //
      const summaryCards = [
        [
          'FORMAT',
          'SOR v' +
            parsed.version,
        ],
        [
          'WAVELENGTH',
          parsed.FxdParams
            .wavelength,
        ],
        [
          'RANGE',
          parsed.FxdParams
            .range +
            ' km',
        ],
        [
          'EVENTS',
          String(
            parsed.KeyEvents[
              'num events'
            ]
          ),
        ],
        [
          'POINTS',
          String(
            parsed.FxdParams[
              'num data points'
            ]
          ),
        ],
        [
          'CHECKSUM',
          parsed.Cksum.match
            ? 'VALID'
            : 'FAILED',
        ],
      ];

      const cardGap =
        3;

      const cardWidth =
        (
          contentWidth -
          cardGap * 2
        ) /
        3;

      summaryCards.forEach(
        (
          card,
          index
        ) => {
          const row =
            Math.floor(
              index / 3
            );

          const column =
            index % 3;

          const x =
            margin +
            column *
              (
                cardWidth +
                cardGap
              );

          const y =
            cursorY +
            row * 20;

          doc.setFillColor(
            250,
            250,
            253
          );

          doc.setDrawColor(
            231,
            233,
            240
          );

          doc.roundedRect(
            x,
            y,
            cardWidth,
            16,
            2.5,
            2.5,
            'FD'
          );

          doc.setFont(
            'helvetica',
            'bold'
          );

          doc.setFontSize(6);
          doc.setTextColor(
            153,
            159,
            176
          );

          doc.text(
            card[0],
            x + 4,
            y + 5
          );

          doc.setFontSize(10);
          doc.setTextColor(
            71,
            78,
            99
          );

          doc.text(
            pdfValue(
              card[1]
            ),
            x + 4,
            y + 12
          );
        }
      );

      cursorY += 43;

      //
      // Trace graph
      //
      sectionTitle(
        'OTDR Trace'
      );

      const chartX =
        margin;

      const chartY =
        cursorY;

      const chartW =
        contentWidth;

      const chartH =
        64;

      doc.setFillColor(
        250,
        250,
        253
      );

      doc.setDrawColor(
        228,
        231,
        239
      );

      doc.roundedRect(
        chartX,
        chartY,
        chartW,
        chartH,
        2,
        2,
        'FD'
      );

      for (
        let index = 1;
        index < 5;
        index += 1
      ) {
        const x =
          chartX +
          (
            chartW *
            index
          ) /
            5;

        const y =
          chartY +
          (
            chartH *
            index
          ) /
            5;

        doc.setDrawColor(
          236,
          238,
          244
        );

        doc.line(
          x,
          chartY,
          x,
          chartY +
            chartH
        );

        doc.line(
          chartX,
          y,
          chartX +
            chartW,
          y
        );
      }

      const pdfTrace =
        downsampleTrace(
          parsed.trace,
          700
        );

      const pdfBounds =
        traceBounds(
          parsed.trace
        );

      const xRange =
        pdfBounds.maxDistance -
        pdfBounds.minDistance;

      const yRange =
        pdfBounds.maxPower -
        pdfBounds.minPower;

      const mapPoint = (
        point: TracePoint
      ) => ({
        x:
          chartX +
          (
            (
              point.distance -
              pdfBounds.minDistance
            ) /
            xRange
          ) *
            chartW,
        y:
          chartY +
          (
            1 -
            (
              point.power -
              pdfBounds.minPower
            ) /
              yRange
          ) *
            chartH,
      });

      doc.setDrawColor(
        96,
        76,
        219
      );

      doc.setLineWidth(
        0.35
      );

      for (
        let index = 1;
        index <
        pdfTrace.length;
        index += 1
      ) {
        const previous =
          mapPoint(
            pdfTrace[
              index - 1
            ]
          );

        const current =
          mapPoint(
            pdfTrace[
              index
            ]
          );

        doc.line(
          previous.x,
          previous.y,
          current.x,
          current.y
        );
      }

      doc.setDrawColor(
        210,
        126,
        58
      );

      doc.setLineWidth(
        0.15
      );

      for (const event of events) {
        const distance =
          Number.parseFloat(
            event.distance
          );

        if (
          !Number.isFinite(
            distance
          )
        ) {
          continue;
        }

        const x =
          chartX +
          (
            (
              distance -
              pdfBounds.minDistance
            ) /
            xRange
          ) *
            chartW;

        if (
          x >= chartX &&
          x <=
            chartX +
              chartW
        ) {
          doc.line(
            x,
            chartY,
            x,
            chartY +
              chartH
          );
        }
      }

      doc.setFont(
        'helvetica',
        'normal'
      );

      doc.setFontSize(6.5);
      doc.setTextColor(
        137,
        143,
        159
      );

      doc.text(
        pdfBounds.minDistance.toFixed(
          2
        ) +
          ' km',
        chartX,
        chartY +
          chartH +
          5
      );

      doc.text(
        pdfBounds.maxDistance.toFixed(
          2
        ) +
          ' km',
        chartX +
          chartW,
        chartY +
          chartH +
          5,
        {
          align:
            'right',
        }
      );

      doc.text(
        pdfBounds.maxPower.toFixed(
          2
        ) +
          ' dB',
        chartX + 2,
        chartY + 5
      );

      doc.text(
        pdfBounds.minPower.toFixed(
          2
        ) +
          ' dB',
        chartX + 2,
        chartY +
          chartH -
          2
      );

      cursorY += 76;

      //
      // Measurement summary
      //
      sectionTitle(
        'Measurement'
      );

      keyValue(
        'Date / time',
        parsed.FxdParams[
          'date/time'
        ]
      );

      keyValue(
        'Pulse width',
        parsed.FxdParams[
          'pulse width'
        ]
      );

      keyValue(
        'Resolution',
        parsed.FxdParams
          .resolution +
          ' m'
      );

      keyValue(
        'IOR',
        parsed.FxdParams
          .index
      );

      keyValue(
        'Averaging',
        parsed.FxdParams[
          'averaging time'
        ] ??
          parsed.FxdParams[
            'num averages'
          ]
      );

      const summary =
        parsed.KeyEvents
          .Summary;

      keyValue(
        'Total loss',
        summary[
          'total loss'
        ] +
          ' dB'
      );

      keyValue(
        'ORL',
        summary.ORL +
          ' dB'
      );

      //
      // Fiber / OTDR metadata
      //
      sectionTitle(
        'Fiber & Instrument Metadata'
      );

      keyValue(
        'Cable ID',
        parsed.GenParams[
          'cable ID'
        ]
      );

      keyValue(
        'Fiber ID',
        parsed.GenParams[
          'fiber ID'
        ]
      );

      keyValue(
        'Location A',
        parsed.GenParams[
          'location A'
        ]
      );

      keyValue(
        'Location B',
        parsed.GenParams[
          'location B'
        ]
      );

      keyValue(
        'Operator',
        parsed.GenParams
          .operator
      );

      keyValue(
        'OTDR',
        [
          parsed.SupParams
            .supplier,
          parsed.SupParams
            .OTDR,
        ]
          .filter(Boolean)
          .join(' ')
      );

      keyValue(
        'OTDR S/N',
        parsed.SupParams[
          'OTDR S/N'
        ]
      );

      keyValue(
        'Module',
        [
          parsed.SupParams
            .module,
          parsed.SupParams[
            'module S/N'
          ],
        ]
          .filter(Boolean)
          .join(' / ')
      );

      keyValue(
        'Software',
        parsed.SupParams
          .software
      );

      //
      // Events table
      //
      if (events.length > 0) {
        ensureSpace(24);
        sectionTitle(
          'Key Events'
        );

        const columns = [
          {
            label: '#',
            width: 9,
          },
          {
            label: 'TYPE',
            width: 67,
          },
          {
            label: 'DIST.',
            width: 24,
          },
          {
            label: 'SPLICE',
            width: 28,
          },
          {
            label: 'REFL.',
            width: 28,
          },
        ];

        const totalTableWidth =
          columns.reduce(
            (
              total,
              column
            ) =>
              total +
              column.width,
            0
          );

        function tableHeader() {
          ensureSpace(10);

          let x =
            margin;

          doc.setFillColor(
            244,
            245,
            249
          );

          doc.rect(
            margin,
            cursorY,
            totalTableWidth,
            8,
            'F'
          );

          doc.setFont(
            'helvetica',
            'bold'
          );

          doc.setFontSize(6.4);
          doc.setTextColor(
            123,
            130,
            149
          );

          for (
            const column of
            columns
          ) {
            doc.text(
              column.label,
              x + 2,
              cursorY + 5
            );

            x +=
              column.width;
          }

          cursorY += 9;
        }

        tableHeader();

        for (
          const event of
          events
        ) {
          const typeLines =
            doc.splitTextToSize(
              pdfValue(
                shortEventType(
                  event.type
                )
              ),
              62
            );

          const commentLines =
            event.comments
              ? doc.splitTextToSize(
                  pdfValue(
                    event.comments
                  ),
                  62
                )
              : [];

          const rowHeight =
            Math.max(
              9,
              typeLines.length *
                3.4 +
                (
                  commentLines.length >
                  0
                    ? commentLines.length *
                        3.1 +
                      2
                    : 0
                )
            );

          if (
            cursorY +
              rowHeight >
            pageHeight -
              margin
          ) {
            addPage();
            tableHeader();
          }

          let x =
            margin;

          doc.setDrawColor(
            233,
            235,
            241
          );

          doc.line(
            margin,
            cursorY +
              rowHeight,
            margin +
              totalTableWidth,
            cursorY +
              rowHeight
          );

          doc.setFontSize(7);
          doc.setTextColor(
            70,
            77,
            97
          );

          doc.setFont(
            'helvetica',
            'bold'
          );

          doc.text(
            String(
              event.number
            ),
            x + 2,
            cursorY + 5
          );

          x +=
            columns[0]
              .width;

          doc.setFont(
            'helvetica',
            'normal'
          );

          doc.text(
            typeLines,
            x + 2,
            cursorY + 4.5
          );

          if (
            commentLines.length >
            0
          ) {
            doc.setFontSize(
              6
            );

            doc.setTextColor(
              135,
              141,
              158
            );

            doc.text(
              commentLines,
              x + 2,
              cursorY +
                4.5 +
                typeLines.length *
                  3.4 +
                1
            );
          }

          x +=
            columns[1]
              .width;

          doc.setFontSize(7);
          doc.setTextColor(
            70,
            77,
            97
          );

          doc.text(
            pdfValue(
              event.distance
            ) +
              ' km',
            x + 2,
            cursorY + 5
          );

          x +=
            columns[2]
              .width;

          doc.text(
            pdfValue(
              event.spliceLoss
            ) +
              ' dB',
            x + 2,
            cursorY + 5
          );

          x +=
            columns[3]
              .width;

          doc.text(
            pdfValue(
              event.reflectance
            ) +
              ' dB',
            x + 2,
            cursorY + 5
          );

          cursorY +=
            rowHeight;
        }
      }

      //
      // Footer note
      //
      ensureSpace(20);

      cursorY += 7;

      doc.setDrawColor(
        232,
        234,
        240
      );

      doc.line(
        margin,
        cursorY,
        pageWidth -
          margin,
        cursorY
      );

      cursorY += 7;

      doc.setFont(
        'helvetica',
        'normal'
      );

      doc.setFontSize(6.3);
      doc.setTextColor(
        145,
        151,
        168
      );

      const note =
        'Generated locally in ReportOS from the selected SOR file. Vendor-specific blocks are not rendered unless represented by standard parsed fields.';

      doc.text(
        doc.splitTextToSize(
          note,
          contentWidth
        ),
        margin,
        cursorY
      );

      appendSorEngineeringAppendix(
        doc,
        parsed
      );

      doc.save(
        safePdfFilename(
          selectedFile.name
        )
      );
    } catch (error) {
      setStatus('error');

      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'PDF generation failed.'
      );
    } finally {
      setExporting(false);
    }
  }

  return (
    <main className="sor-page-shell">
      <div
        className="ambient ambient-one"
        aria-hidden="true"
      />

      <div
        className="ambient ambient-two"
        aria-hidden="true"
      />

      <header className="sor-page-topbar">
        <Link
          className="sor-back-link"
          href="/"
        >
          <ArrowLeft
            size={16}
          />
          ReportOS
        </Link>

        <div className="sor-page-brand">
          <span className="sor-page-brand-icon">
            <FileOutput
              size={18}
            />
          </span>

          <div>
            <strong>
              Fiber Lab
            </strong>

            <span>
              SOR intelligence
            </span>
          </div>
        </div>

        <span className="sor-local-chip">
          <ShieldCheck
            size={13}
          />
          Local processing
        </span>
      </header>

      <section className="sor-page-content">
        <section className="sor-page-hero glass-panel">
          <div className="sor-hero-copy">
            <span className="sor-hero-kicker">
              OTDR / SOR CONVERTER
            </span>

            <h1>
              SOR to PDF,
              with the trace
              still meaningful.
            </h1>

            <p>
              Parse OTDR Standard
              Record files locally,
              inspect measurement
              metadata and events,
              then generate a clean
              PDF report with the
              actual trace graph.
            </p>

            <div className="sor-hero-badges">
              <span>
                SOR v1 + v2
              </span>

              <span>
                Trace graph
              </span>

              <span>
                Event table
              </span>

              <span>
                No server upload
              </span>
            </div>
          </div>

          <div className="sor-hero-orbit">
            <span />
            <span />

            <div>
              <Activity
                size={28}
              />
            </div>
          </div>
        </section>

        <section
          className={
            dragActive
              ? 'sor-dropzone glass-panel sor-dropzone-active'
              : 'sor-dropzone glass-panel'
          }
          onDragEnter={(
            event
          ) => {
            event.preventDefault();
            setDragActive(
              true
            );
          }}
          onDragOver={(
            event
          ) => {
            event.preventDefault();
            setDragActive(
              true
            );
          }}
          onDragLeave={(
            event
          ) => {
            event.preventDefault();
            setDragActive(
              false
            );
          }}
          onDrop={(
            event
          ) => {
            event.preventDefault();
            setDragActive(
              false
            );

            const file =
              event.dataTransfer
                .files[0];

            if (file) {
              void parseFile(
                file
              );
            }
          }}
        >
          <input
            ref={inputRef}
            className="sor-file-input"
            type="file"
            accept=".sor,.SOR,application/octet-stream"
            onChange={(
              event
            ) => {
              const file =
                event.target
                  .files?.[0];

              if (file) {
                void parseFile(
                  file
                );
              }
            }}
          />

          <button
            className="sor-dropzone-button"
            type="button"
            onClick={() =>
              inputRef.current?.click()
            }
          >
            <span className="sor-upload-icon">
              <Upload
                size={21}
              />
            </span>

            <span className="sor-dropzone-copy">
              <strong>
                Drop .SOR file here
              </strong>

              <small>
                or click to browse
                from your computer
              </small>
            </span>

            <span className="sor-file-limit">
              MAX 64 MB
            </span>
          </button>

          {selectedFile ? (
            <div className="sor-selected-file">
              <FileText
                size={16}
              />

              <div>
                <strong>
                  {
                    selectedFile.name
                  }
                </strong>

                <span>
                  {
                    formatFileSize(
                      selectedFile.size
                    )
                  }
                </span>
              </div>

              {status ===
              'parsing' ? (
                <span className="sor-processing-chip">
                  Parsing…
                </span>
              ) : (
                <button
                  type="button"
                  title="Clear file"
                  onClick={
                    reset
                  }
                >
                  <X
                    size={14}
                  />
                </button>
              )}
            </div>
          ) : null}
        </section>

        {status ===
        'error' ? (
          <section className="sor-error-card glass-panel">
            <AlertTriangle
              size={18}
            />

            <div>
              <strong>
                Unable to process
                this SOR file
              </strong>

              <span>
                {
                  errorMessage
                }
              </span>
            </div>

            <button
              type="button"
              onClick={
                reset
              }
            >
              <RotateCcw
                size={14}
              />
              Reset
            </button>
          </section>
        ) : null}

        {parsed ? (
          <>
            <section className="sor-kpi-grid">
              <article className="sor-kpi glass-panel">
                <span className="sor-kpi-icon">
                  <Gauge
                    size={16}
                  />
                </span>

                <div>
                  <span>
                    WAVELENGTH
                  </span>

                  <strong>
                    {
                      displayValue(
                        parsed
                          .FxdParams
                          .wavelength
                      )
                    }
                  </strong>
                </div>
              </article>

              <article className="sor-kpi glass-panel">
                <span className="sor-kpi-icon">
                  <Activity
                    size={16}
                  />
                </span>

                <div>
                  <span>
                    RANGE
                  </span>

                  <strong>
                    {
                      parsed
                        .FxdParams
                        .range
                    } km
                  </strong>
                </div>
              </article>

              <article className="sor-kpi glass-panel">
                <span className="sor-kpi-icon">
                  <Database
                    size={16}
                  />
                </span>

                <div>
                  <span>
                    TRACE POINTS
                  </span>

                  <strong>
                    {
                      parsed
                        .FxdParams[
                        'num data points'
                      ].toLocaleString()
                    }
                  </strong>
                </div>
              </article>

              <article
                className="sor-kpi glass-panel"
                data-checksum={
                  parsed.Cksum.match
                    ? 'valid'
                    : 'invalid'
                }
              >
                <span className="sor-kpi-icon">
                  <ShieldCheck
                    size={16}
                  />
                </span>

                <div>
                  <span>
                    CHECKSUM
                  </span>

                  <strong>
                    {parsed.Cksum
                      .match
                      ? 'VALID'
                      : 'FAILED'}
                  </strong>
                </div>
              </article>
            </section>

            <section className="sor-result-grid">
              <article className="sor-trace-card glass-panel">
                <div className="sor-card-heading">
                  <div>
                    <span>
                      REFLECTOGRAM
                    </span>

                    <h2>
                      OTDR trace
                    </h2>

                    <p>
                      {
                        bounds.minDistance.toFixed(
                          2
                        )
                      } – {
                        bounds.maxDistance.toFixed(
                          2
                        )
                      } km · {
                        events.length
                      } detected events
                    </p>
                  </div>

                  <span className="sor-ready-chip">
                    <Check
                      size={12}
                    />
                    Parsed
                  </span>
                </div>

                <div className="sor-trace-canvas">
                  <svg
                    viewBox={
                      '0 0 ' +
                      SVG_WIDTH +
                      ' ' +
                      SVG_HEIGHT
                    }
                    role="img"
                    aria-label="OTDR trace graph"
                  >
                    {[
                      1,
                      2,
                      3,
                      4,
                    ].map(
                      (
                        index
                      ) => (
                        <g
                          key={
                            index
                          }
                        >
                          <line
                            className="sor-grid-line"
                            x1={
                              (
                                SVG_WIDTH *
                                index
                              ) /
                              5
                            }
                            x2={
                              (
                                SVG_WIDTH *
                                index
                              ) /
                              5
                            }
                            y1="0"
                            y2={
                              SVG_HEIGHT
                            }
                          />

                          <line
                            className="sor-grid-line"
                            x1="0"
                            x2={
                              SVG_WIDTH
                            }
                            y1={
                              (
                                SVG_HEIGHT *
                                index
                              ) /
                              5
                            }
                            y2={
                              (
                                SVG_HEIGHT *
                                index
                              ) /
                              5
                            }
                          />
                        </g>
                      )
                    )}

                    {eventMarkers.map(
                      (event) => (
                        <line
                          className="sor-event-line"
                          key={
                            event.number
                          }
                          x1={
                            event.x
                          }
                          x2={
                            event.x
                          }
                          y1={
                            SVG_PADDING
                          }
                          y2={
                            SVG_HEIGHT -
                            SVG_PADDING
                          }
                        />
                      )
                    )}

                    <polyline
                      className="sor-trace-line"
                      fill="none"
                      points={
                        svgPoints
                      }
                    />
                  </svg>

                  <div className="sor-trace-axis">
                    <span>
                      {
                        bounds.minDistance.toFixed(
                          2
                        )
                      } km
                    </span>

                    <span>
                      {
                        bounds.maxDistance.toFixed(
                          2
                        )
                      } km
                    </span>
                  </div>
                </div>

                <div className="sor-trace-summary">
                  <div>
                    <span>
                      TOTAL LOSS
                    </span>

                    <strong>
                      {
                        parsed
                          .KeyEvents
                          .Summary[
                          'total loss'
                        ]
                      } dB
                    </strong>
                  </div>

                  <div>
                    <span>
                      ORL
                    </span>

                    <strong>
                      {
                        parsed
                          .KeyEvents
                          .Summary
                          .ORL
                      } dB
                    </strong>
                  </div>

                  <div>
                    <span>
                      RESOLUTION
                    </span>

                    <strong>
                      {
                        parsed
                          .FxdParams
                          .resolution
                      } m
                    </strong>
                  </div>

                  <div>
                    <span>
                      PULSE
                    </span>

                    <strong>
                      {
                        displayValue(
                          parsed
                            .FxdParams[
                            'pulse width'
                          ]
                        )
                      }
                    </strong>
                  </div>
                </div>
              </article>

              <aside className="sor-export-card glass-panel">
                <span className="sor-export-kicker">
                  PDF DELIVERY
                </span>

                <h2>
                  Report ready.
                </h2>

                <p>
                  PDF includes the
                  reflectogram,
                  measurement setup,
                  instrument metadata,
                  event table, loss /
                  ORL summary, and
                  checksum state.
                </p>

                <div className="sor-export-stats">
                  <div>
                    <span>
                      FORMAT
                    </span>

                    <strong>
                      SOR v{
                        parsed.version
                      }
                    </strong>
                  </div>

                  <div>
                    <span>
                      EVENTS
                    </span>

                    <strong>
                      {
                        events.length
                      }
                    </strong>
                  </div>

                  <div>
                    <span>
                      VENDOR BLOCKS
                    </span>

                    <strong>
                      {
                        Object.keys(
                          parsed
                            .vendorBlocks
                        ).length
                      }
                    </strong>
                  </div>
                </div>

                <button
                  className="sor-export-button"
                  type="button"
                  disabled={
                    exporting
                  }
                  onClick={() =>
                    void exportPdf()
                  }
                >
                  <Download
                    size={17}
                  />

                  {exporting
                    ? 'Generating PDF…'
                    : 'Export PDF'}
                </button>

                <span className="sor-export-note">
                  The SOR file stays
                  on this device.
                  Conversion happens
                  in your browser.
                </span>
              </aside>
            </section>

            <SorAnalysisPanel
              parsed={parsed}
            />

            <section className="sor-detail-grid">
              <article className="sor-metadata-card glass-panel">
                <div className="sor-card-heading">
                  <div>
                    <span>
                      MEASUREMENT
                    </span>

                    <h2>
                      Fiber metadata
                    </h2>
                  </div>
                </div>

                <dl className="sor-metadata-list">
                  <div>
                    <dt>
                      Cable ID
                    </dt>

                    <dd>
                      {
                        displayValue(
                          parsed
                            .GenParams[
                            'cable ID'
                          ]
                        )
                      }
                    </dd>
                  </div>

                  <div>
                    <dt>
                      Fiber ID
                    </dt>

                    <dd>
                      {
                        displayValue(
                          parsed
                            .GenParams[
                            'fiber ID'
                          ]
                        )
                      }
                    </dd>
                  </div>

                  <div>
                    <dt>
                      Location A
                    </dt>

                    <dd>
                      {
                        displayValue(
                          parsed
                            .GenParams[
                            'location A'
                          ]
                        )
                      }
                    </dd>
                  </div>

                  <div>
                    <dt>
                      Location B
                    </dt>

                    <dd>
                      {
                        displayValue(
                          parsed
                            .GenParams[
                            'location B'
                          ]
                        )
                      }
                    </dd>
                  </div>

                  <div>
                    <dt>
                      Operator
                    </dt>

                    <dd>
                      {
                        displayValue(
                          parsed
                            .GenParams
                            .operator
                        )
                      }
                    </dd>
                  </div>

                  <div>
                    <dt>
                      Date / time
                    </dt>

                    <dd>
                      {
                        displayValue(
                          parsed
                            .FxdParams[
                            'date/time'
                          ]
                        )
                      }
                    </dd>
                  </div>

                  <div>
                    <dt>
                      IOR
                    </dt>

                    <dd>
                      {
                        displayValue(
                          parsed
                            .FxdParams
                            .index
                        )
                      }
                    </dd>
                  </div>

                  <div>
                    <dt>
                      Averaging
                    </dt>

                    <dd>
                      {
                        displayValue(
                          parsed
                            .FxdParams[
                            'averaging time'
                          ] ??
                            parsed
                              .FxdParams[
                              'num averages'
                            ]
                        )
                      }
                    </dd>
                  </div>
                </dl>
              </article>

              <article className="sor-metadata-card glass-panel">
                <div className="sor-card-heading">
                  <div>
                    <span>
                      INSTRUMENT
                    </span>

                    <h2>
                      OTDR identity
                    </h2>
                  </div>
                </div>

                <dl className="sor-metadata-list">
                  <div>
                    <dt>
                      Supplier
                    </dt>

                    <dd>
                      {
                        displayValue(
                          parsed
                            .SupParams
                            .supplier
                        )
                      }
                    </dd>
                  </div>

                  <div>
                    <dt>
                      OTDR model
                    </dt>

                    <dd>
                      {
                        displayValue(
                          parsed
                            .SupParams
                            .OTDR
                        )
                      }
                    </dd>
                  </div>

                  <div>
                    <dt>
                      OTDR S/N
                    </dt>

                    <dd>
                      {
                        displayValue(
                          parsed
                            .SupParams[
                            'OTDR S/N'
                          ]
                        )
                      }
                    </dd>
                  </div>

                  <div>
                    <dt>
                      Module
                    </dt>

                    <dd>
                      {
                        displayValue(
                          parsed
                            .SupParams
                            .module
                        )
                      }
                    </dd>
                  </div>

                  <div>
                    <dt>
                      Module S/N
                    </dt>

                    <dd>
                      {
                        displayValue(
                          parsed
                            .SupParams[
                            'module S/N'
                          ]
                        )
                      }
                    </dd>
                  </div>

                  <div>
                    <dt>
                      Software
                    </dt>

                    <dd>
                      {
                        displayValue(
                          parsed
                            .SupParams
                            .software
                        )
                      }
                    </dd>
                  </div>
                </dl>
              </article>
            </section>

            <section className="sor-events-card glass-panel">
              <div className="sor-card-heading">
                <div>
                  <span>
                    KEY EVENTS
                  </span>

                  <h2>
                    Detected events
                  </h2>

                  <p>
                    Splices,
                    reflections,
                    losses, and
                    end-of-fiber
                    records exposed
                    by the SOR file.
                  </p>
                </div>

                <span className="sor-event-count">
                  {
                    events.length
                  } events
                </span>
              </div>

              {events.length >
              0 ? (
                <div className="sor-events-table-wrap">
                  <table className="sor-events-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>
                          Type
                        </th>
                        <th>
                          Distance
                        </th>
                        <th>
                          Splice loss
                        </th>
                        <th>
                          Reflectance
                        </th>
                        <th>
                          Comments
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {events.map(
                        (event) => (
                          <tr
                            key={
                              event.number
                            }
                          >
                            <td>
                              {
                                event.number
                              }
                            </td>

                            <td>
                              <strong>
                                {
                                  shortEventType(
                                    event.type
                                  )
                                }
                              </strong>
                            </td>

                            <td>
                              {
                                event.distance
                              } km
                            </td>

                            <td>
                              {
                                event.spliceLoss
                              } dB
                            </td>

                            <td>
                              {
                                event.reflectance
                              } dB
                            </td>

                            <td>
                              {
                                event.comments ||
                                '—'
                              }
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="sor-events-empty">
                  <Activity
                    size={20}
                  />

                  <strong>
                    No key events
                    reported
                  </strong>

                  <span>
                    The trace is
                    still available
                    in the PDF.
                  </span>
                </div>
              )}
            </section>
          </>
        ) : null}
      </section>
    </main>
  );
}
