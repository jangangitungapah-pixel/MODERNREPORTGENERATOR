'use client';

import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  CircleGauge,
  Crosshair,
  Database,
  Info,
  Network,
  Ruler,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react';

import {
  useMemo,
} from 'react';

import type {
  SorResult,
} from 'sor-reader/browser';

import {
  buildSorInsights,
  compactSorValue,
  formatInsightNumber,
} from '@/lib/sor-insights';

function screeningLabel(
  status:
    | 'clear'
    | 'attention'
    | 'informational'
): string {
  if (
    status ===
    'attention'
  ) {
    return 'Needs review';
  }

  if (
    status === 'clear'
  ) {
    return 'No exception detected';
  }

  return 'Informational';
}

function formatEventValue(
  value: number | null,
  suffix: string
): string {
  return formatInsightNumber(
    value,
    3,
    suffix
  );
}

function RawGroup({
  title,
  value,
}: {
  title: string;
  value:
    Record<string, unknown>;
}) {
  return (
    <section className="sor-raw-group">
      <h4>{title}</h4>

      <dl>
        {Object.entries(
          value
        ).map(
          ([key, entry]) => (
            <div
              key={key}
            >
              <dt>
                {key}
              </dt>

              <dd>
                {
                  compactSorValue(
                    entry
                  )
                }
              </dd>
            </div>
          )
        )}
      </dl>
    </section>
  );
}

export function SorAnalysisPanel({
  parsed,
}: {
  parsed: SorResult;
}) {
  const insights =
    useMemo(
      () =>
        buildSorInsights(
          parsed
        ),
      [parsed]
    );

  const summary =
    [
      insights.fiberLengthKm !==
      null
        ? 'Trace terbaca sampai ' +
          insights.fiberLengthKm.toFixed(
            3
          ) +
          ' km.'
        : 'Panjang fiber belum bisa disimpulkan dari file ini.',
      insights.totalLossDb !==
      null
        ? 'Total loss ' +
          insights.totalLossDb.toFixed(
            3
          ) +
          ' dB'
        : null,
      insights.averageAttenuationDbKm !==
      null
        ? 'dengan rata-rata sekitar ' +
          insights.averageAttenuationDbKm.toFixed(
            3
          ) +
          ' dB/km.'
        : '.',
      insights.eventCount +
        ' event terdeteksi.',
    ]
      .filter(Boolean)
      .join(' ');

  return (
    <section className="sor-analysis-stack">
      <article
        className="sor-quick-read glass-panel"
        data-screening={
          insights.screeningStatus
        }
      >
        <div className="sor-quick-head">
          <div>
            <span className="sor-analysis-kicker">
              QUICK READ
            </span>

            <h2>
              Yang paling penting
              dari trace ini.
            </h2>

            <p>
              {summary}
            </p>
          </div>

          <span className="sor-screening-badge">
            {insights.screeningStatus ===
            'attention' ? (
              <AlertTriangle
                size={13}
              />
            ) : insights.screeningStatus ===
              'clear' ? (
              <CheckCircle2
                size={13}
              />
            ) : (
              <Info
                size={13}
              />
            )}

            {
              screeningLabel(
                insights.screeningStatus
              )
            }
          </span>
        </div>

        <div className="sor-insight-grid">
          <div>
            <span className="sor-insight-icon">
              <Ruler
                size={15}
              />
            </span>

            <div>
              <span>
                FIBER LENGTH
              </span>

              <strong>
                {
                  formatInsightNumber(
                    insights.fiberLengthKm,
                    3,
                    ' km'
                  )
                }
              </strong>
            </div>
          </div>

          <div>
            <span className="sor-insight-icon">
              <CircleGauge
                size={15}
              />
            </span>

            <div>
              <span>
                TOTAL LOSS
              </span>

              <strong>
                {
                  formatInsightNumber(
                    insights.totalLossDb,
                    3,
                    ' dB'
                  )
                }
              </strong>
            </div>
          </div>

          <div>
            <span className="sor-insight-icon">
              <SlidersHorizontal
                size={15}
              />
            </span>

            <div>
              <span>
                AVG. ATTENUATION
              </span>

              <strong>
                {
                  formatInsightNumber(
                    insights.averageAttenuationDbKm,
                    3,
                    ' dB/km'
                  )
                }
              </strong>
            </div>
          </div>

          <div>
            <span className="sor-insight-icon">
              <Network
                size={15}
              />
            </span>

            <div>
              <span>
                EVENTS
              </span>

              <strong>
                {
                  insights.eventCount
                }
              </strong>
            </div>
          </div>

          <div>
            <span className="sor-insight-icon">
              <Crosshair
                size={15}
              />
            </span>

            <div>
              <span>
                WORST EVENT LOSS
              </span>

              <strong>
                {insights.worstLossEvent
                  ? '#' +
                    insights.worstLossEvent.number +
                    ' · ' +
                    formatEventValue(
                      insights.worstLossEvent.lossDb,
                      ' dB'
                    )
                  : '—'}
              </strong>
            </div>
          </div>

          <div>
            <span className="sor-insight-icon">
              <ShieldCheck
                size={15}
              />
            </span>

            <div>
              <span>
                ORL
              </span>

              <strong>
                {
                  formatInsightNumber(
                    insights.orlDb,
                    3,
                    ' dB'
                  )
                }
              </strong>
            </div>
          </div>
        </div>

        {insights.screeningNotes.length >
        0 ? (
          <div className="sor-screening-notes">
            <div>
              <Info
                size={14}
              />

              <strong>
                ReportOS screening
              </strong>
            </div>

            {insights.screeningNotes.map(
              (note) => (
                <p key={note}>
                  {note}
                </p>
              )
            )}

            <small>
              Screening ini hanya
              membantu membaca
              threshold yang tersimpan
              di SOR. Ini bukan
              sertifikasi PASS/FAIL
              resmi dari vendor OTDR.
            </small>
          </div>
        ) : null}
      </article>

      <article className="sor-event-map-card glass-panel">
        <div className="sor-card-heading">
          <div>
            <span>
              EVENT MAP
            </span>

            <h2>
              Baca kejadian tanpa
              tenggelam di angka.
            </h2>

            <p>
              Ringkas jenis event dan
              tunjukkan hanya titik
              yang perlu perhatian.
            </p>
          </div>

          <span className="sor-event-attention-chip">
            {
              insights.attentionEventCount
            } attention
          </span>
        </div>

        <div className="sor-event-composition">
          <div>
            <strong>
              {
                insights.reflectiveCount
              }
            </strong>

            <span>
              Reflective
            </span>
          </div>

          <div>
            <strong>
              {
                insights.nonReflectiveCount
              }
            </strong>

            <span>
              Non-reflective
            </span>
          </div>

          <div>
            <strong>
              {
                insights.endOfFiberCount
              }
            </strong>

            <span>
              End of fiber
            </span>
          </div>

          <div>
            <strong>
              {
                insights.otherEventCount
              }
            </strong>

            <span>
              Other
            </span>
          </div>
        </div>

        {insights.attentionEventCount >
        0 ? (
          <div className="sor-attention-list">
            {insights.events
              .filter(
                (event) =>
                  event.screening ===
                  'attention'
              )
              .map(
                (event) => (
                  <article
                    key={
                      event.number
                    }
                  >
                    <span>
                      #
                      {
                        event.number
                      }
                    </span>

                    <div>
                      <strong>
                        {
                          event.categoryLabel
                        }
                        {' · '}
                        {
                          formatEventValue(
                            event.distanceKm,
                            ' km'
                          )
                        }
                      </strong>

                      {event.screeningReasons.map(
                        (reason) => (
                          <p
                            key={
                              reason
                            }
                          >
                            {
                              reason
                            }
                          </p>
                        )
                      )}
                    </div>
                  </article>
                )
              )}
          </div>
        ) : (
          <div className="sor-no-attention">
            <CheckCircle2
              size={16}
            />

            <div>
              <strong>
                Tidak ada threshold
                exception yang
                terdeteksi.
              </strong>

              <span>
                Detail event tetap
                tersedia di Engineering
                Details jika diperlukan.
              </span>
            </div>
          </div>
        )}
      </article>

      <details className="sor-engineering-details glass-panel">
        <summary>
          <div>
            <span className="sor-engineering-icon">
              <SlidersHorizontal
                size={16}
              />
            </span>

            <div>
              <strong>
                Engineering details
              </strong>

              <span>
                Measurement windows,
                slope, thresholds,
                complete SOR fields,
                and block inventory.
              </span>
            </div>
          </div>

          <ChevronDown
            className="sor-details-chevron"
            size={16}
          />
        </summary>

        <div className="sor-engineering-body">
          <section className="sor-threshold-panel">
            <div className="sor-engineering-heading">
              <div>
                <span>
                  THRESHOLDS
                </span>

                <h3>
                  Stored OTDR
                  thresholds
                </h3>
              </div>

              <small>
                {
                  insights.thresholdCount
                } usable
              </small>
            </div>

            <div className="sor-threshold-grid">
              <div>
                <span>
                  EVENT LOSS
                </span>

                <strong>
                  {
                    formatInsightNumber(
                      insights.thresholds.lossDb,
                      3,
                      ' dB'
                    )
                  }
                </strong>
              </div>

              <div>
                <span>
                  REFLECTANCE
                </span>

                <strong>
                  {
                    formatInsightNumber(
                      insights.thresholds.reflectanceDb,
                      3,
                      ' dB'
                    )
                  }
                </strong>
              </div>

              <div>
                <span>
                  END OF FIBER
                </span>

                <strong>
                  {
                    formatInsightNumber(
                      insights.thresholds.endOfFiberDb,
                      3,
                      ' dB'
                    )
                  }
                </strong>
              </div>
            </div>
          </section>

          <section className="sor-detailed-event-section">
            <div className="sor-engineering-heading">
              <div>
                <span>
                  EVENT MEASUREMENT
                </span>

                <h3>
                  Full event
                  diagnostics
                </h3>
              </div>
            </div>

            <div className="sor-detailed-events">
              {insights.events.map(
                (event) => {
                  const hasWindow =
                    Object.values(
                      event.window
                    ).some(
                      (value) =>
                        value !==
                        null
                    );

                  return (
                    <details
                      className="sor-detailed-event"
                      key={
                        event.number
                      }
                    >
                      <summary>
                        <span className="sor-event-number">
                          #
                          {
                            event.number
                          }
                        </span>

                        <div>
                          <strong>
                            {
                              event.categoryLabel
                            }
                          </strong>

                          <span>
                            {
                              formatEventValue(
                                event.distanceKm,
                                ' km'
                              )
                            }
                            {' · '}
                            {
                              formatEventValue(
                                event.lossDb,
                                ' dB loss'
                              )
                            }
                          </span>
                        </div>

                        <span
                          className="sor-event-screening"
                          data-screening={
                            event.screening
                          }
                        >
                          {event.screening ===
                          'attention'
                            ? 'Review'
                            : event.screening ===
                                'normal'
                              ? 'Within threshold'
                              : 'Info'}
                        </span>
                      </summary>

                      <div className="sor-event-diagnostics">
                        <div>
                          <span>
                            DISTANCE
                          </span>

                          <strong>
                            {
                              formatEventValue(
                                event.distanceKm,
                                ' km'
                              )
                            }
                          </strong>
                        </div>

                        <div>
                          <span>
                            LOSS
                          </span>

                          <strong>
                            {
                              formatEventValue(
                                event.lossDb,
                                ' dB'
                              )
                            }
                          </strong>
                        </div>

                        <div>
                          <span>
                            SLOPE
                          </span>

                          <strong>
                            {
                              formatEventValue(
                                event.slopeDbKm,
                                ' dB/km'
                              )
                            }
                          </strong>
                        </div>

                        <div>
                          <span>
                            REFLECTANCE
                          </span>

                          <strong>
                            {
                              formatEventValue(
                                event.reflectanceDb,
                                ' dB'
                              )
                            }
                          </strong>
                        </div>

                        <div>
                          <span>
                            ACCUM. EVENT LOSS
                          </span>

                          <strong>
                            {
                              event.cumulativeEventLossDb.toFixed(
                                3
                              )
                            } dB
                          </strong>
                        </div>

                        <div>
                          <span>
                            RAW TYPE
                          </span>

                          <strong>
                            {
                              event.rawType
                            }
                          </strong>
                        </div>
                      </div>

                      {hasWindow ? (
                        <div className="sor-window-grid">
                          <div>
                            <span>
                              PREV END
                            </span>

                            <strong>
                              {
                                formatEventValue(
                                  event.window.endOfPreviousKm,
                                  ' km'
                                )
                              }
                            </strong>
                          </div>

                          <div>
                            <span>
                              CURR START
                            </span>

                            <strong>
                              {
                                formatEventValue(
                                  event.window.startOfCurrentKm,
                                  ' km'
                                )
                              }
                            </strong>
                          </div>

                          <div>
                            <span>
                              CURR END
                            </span>

                            <strong>
                              {
                                formatEventValue(
                                  event.window.endOfCurrentKm,
                                  ' km'
                                )
                              }
                            </strong>
                          </div>

                          <div>
                            <span>
                              NEXT START
                            </span>

                            <strong>
                              {
                                formatEventValue(
                                  event.window.startOfNextKm,
                                  ' km'
                                )
                              }
                            </strong>
                          </div>

                          <div>
                            <span>
                              PEAK
                            </span>

                            <strong>
                              {
                                formatEventValue(
                                  event.window.peakKm,
                                  ' km'
                                )
                              }
                            </strong>
                          </div>
                        </div>
                      ) : null}

                      {event.comments ? (
                        <p className="sor-event-comment">
                          {
                            event.comments
                          }
                        </p>
                      ) : null}
                    </details>
                  );
                }
              )}
            </div>
          </section>

          <section className="sor-raw-inspector">
            <div className="sor-engineering-heading">
              <div>
                <span>
                  RAW SOR INSPECTOR
                </span>

                <h3>
                  Standard parsed
                  fields
                </h3>
              </div>

              <small>
                {
                  insights.standardBlockCount
                } blocks
              </small>
            </div>

            <div className="sor-raw-grid">
              <RawGroup
                title="General Parameters"
                value={
                  parsed.GenParams as
                    unknown as
                    Record<
                      string,
                      unknown
                    >
                }
              />

              <RawGroup
                title="Fixed Parameters"
                value={
                  parsed.FxdParams as
                    unknown as
                    Record<
                      string,
                      unknown
                    >
                }
              />

              <RawGroup
                title="Supplier Parameters"
                value={
                  parsed.SupParams as
                    unknown as
                    Record<
                      string,
                      unknown
                    >
                }
              />

              <RawGroup
                title="Key Event Summary"
                value={
                  parsed.KeyEvents
                    .Summary as
                    unknown as
                    Record<
                      string,
                      unknown
                    >
                }
              />
            </div>

            <div className="sor-block-inventory">
              <div className="sor-block-heading">
                <Database
                  size={14}
                />

                <strong>
                  Block inventory
                </strong>
              </div>

              <div className="sor-block-list">
                {Object.entries(
                  parsed.blocks
                ).map(
                  ([name, block]) => (
                    <span
                      key={name}
                    >
                      <strong>
                        {name}
                      </strong>

                      {
                        block.size
                      } bytes · v
                      {
                        block.version
                      }
                    </span>
                  )
                )}
              </div>

              {insights.vendorBlockCount >
              0 ? (
                <div className="sor-vendor-blocks">
                  <strong>
                    Vendor /
                    proprietary blocks
                  </strong>

                  {insights.vendorBlocks.map(
                    (block) => (
                      <span
                        key={
                          block.name
                        }
                      >
                        {
                          block.name
                        }
                        {block.byteLength !==
                        null
                          ? ' · ' +
                            block.byteLength +
                            ' bytes'
                          : ''}
                      </span>
                    )
                  )}
                </div>
              ) : (
                <p className="sor-no-vendor-blocks">
                  No vendor-specific
                  block detected.
                </p>
              )}
            </div>
          </section>
        </div>
      </details>
    </section>
  );
}
