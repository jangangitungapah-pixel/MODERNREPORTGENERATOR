'use client';

import Link from 'next/link';

import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronDown,
  Clipboard,
  Copy,
  Layers3,
  Network,
  Plus,
  RotateCcw,
  ShieldCheck,
  Trash2,
  Users,
  X,
} from 'lucide-react';

import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  EMPTY_BACKBONE_IMPACT,
  IMPACT_STATUS_OPTIONS,
  SAMPLE_BACKBONE_IMPACT,
  backboneImpactStats,
  formatBackboneImpact,
  type BackboneImpactCustomer,
  type BackboneImpactDraft,
  type BackboneImpactService,
  type ImpactStatus,
} from '@/lib/backbone-impact';

const STORAGE_KEY =
  'reportos:backbone-impact:v1';

function createId(
  prefix: string
): string {
  if (
    typeof crypto !== 'undefined' &&
    'randomUUID' in crypto
  ) {
    return (
      prefix +
      '-' +
      crypto.randomUUID()
    );
  }

  return (
    prefix +
    '-' +
    Date.now() +
    '-' +
    Math.random()
      .toString(36)
      .slice(2, 8)
  );
}

function cloneSample():
  BackboneImpactDraft {
  return {
    ...SAMPLE_BACKBONE_IMPACT,
    customers:
      SAMPLE_BACKBONE_IMPACT
        .customers.map(
          (customer) => ({
            ...customer,
            services:
              customer.services.map(
                (service) => ({
                  ...service,
                })
              ),
          })
        ),
  };
}

function StatusSelector({
  value,
  onChange,
  label,
  compact = false,
}: {
  value: ImpactStatus;
  onChange: (
    value: ImpactStatus
  ) => void;
  label: string;
  compact?: boolean;
}) {
  return (
    <div
      className={
        compact
          ? 'impact-status-selector impact-status-selector-compact'
          : 'impact-status-selector'
      }
      role="group"
      aria-label={label}
    >
      {IMPACT_STATUS_OPTIONS.map(
        (option) => (
          <button
            className={
              value === option.value
                ? 'impact-status-option impact-status-option-active'
                : 'impact-status-option'
            }
            data-status={
              option.value
            }
            key={
              option.value
            }
            type="button"
            title={
              option.label
            }
            aria-label={
              compact
                ? option.label
                : undefined
            }
            aria-pressed={
              value === option.value
            }
            onClick={() =>
              onChange(
                option.value
              )
            }
          >
            <span>
              {
                option.symbol
              }
            </span>

            {!compact ? (
              <small>
                {
                  option.label
                }
              </small>
            ) : null}
          </button>
        )
      )}
    </div>
  );
}

export function BackboneImpactBoard() {
  const [
    draft,
    setDraft,
  ] = useState<BackboneImpactDraft>(
    () =>
      cloneSample()
  );

  const [
    hydrated,
    setHydrated,
  ] = useState(false);

  const [
    copyState,
    setCopyState,
  ] = useState<
    | 'idle'
    | 'success'
    | 'error'
  >('idle');

  const [
    persistenceState,
    setPersistenceState,
  ] = useState<
    | 'hydrating'
    | 'saved'
    | 'error'
  >('hydrating');

  const [
    mobilePane,
    setMobilePane,
  ] = useState<
    | 'editor'
    | 'preview'
  >('editor');

  const [
    confirmingClear,
    setConfirmingClear,
  ] = useState(false);

  useEffect(() => {
    let cancelled = false;

    queueMicrotask(() => {
      if (cancelled) {
        return;
      }

      try {
        const raw =
          window.localStorage.getItem(
            STORAGE_KEY
          );

        if (raw) {
          const parsed =
            JSON.parse(
              raw
            ) as BackboneImpactDraft;

          if (
            parsed &&
            typeof parsed.title ===
              'string' &&
            Array.isArray(
              parsed.customers
            )
          ) {
            setDraft(
              parsed
            );
          }
        }
      } catch {
        // Keep sample fallback.
        setPersistenceState(
          'error'
        );
      } finally {
        if (!cancelled) {
          setHydrated(
            true
          );

          setPersistenceState(
            (current) =>
              current ===
              'error'
                ? current
                : 'saved'
          );
        }
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    let nextPersistenceState:
      | 'saved'
      | 'error' =
      'saved';

    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(
          draft
        )
      );
    } catch {
      nextPersistenceState =
        'error';
    }

    const feedbackTimer =
      window.setTimeout(
        () => {
          setPersistenceState(
            nextPersistenceState
          );
        },
        0
      );

    return () => {
      window.clearTimeout(
        feedbackTimer
      );
    };
  }, [
    draft,
    hydrated,
  ]);

  const output =
    useMemo(
      () =>
        formatBackboneImpact(
          draft
        ),
      [draft]
    );

  const stats =
    useMemo(
      () =>
        backboneImpactStats(
          draft
        ),
      [draft]
    );

  function updateTitle(
    value: string
  ) {
    setDraft(
      (current) => ({
        ...current,
        title: value,
      })
    );
  }

  function addCustomer() {
    const customer:
      BackboneImpactCustomer = {
        id:
          createId(
            'customer'
          ),
        name: '',
        status: 'pending',
        note: '',
        services: [],
      };

    setDraft(
      (current) => ({
        ...current,
        customers: [
          ...current.customers,
          customer,
        ],
      })
    );
  }

  function updateCustomer<
    Key extends
      keyof BackboneImpactCustomer
  >(
    id: string,
    key: Key,
    value:
      BackboneImpactCustomer[Key]
  ) {
    setDraft(
      (current) => ({
        ...current,
        customers:
          current.customers.map(
            (customer) =>
              customer.id === id
                ? {
                    ...customer,
                    [key]:
                      value,
                  }
                : customer
          ),
      })
    );
  }

  function removeCustomer(
    id: string
  ) {
    setDraft(
      (current) => ({
        ...current,
        customers:
          current.customers.filter(
            (customer) =>
              customer.id !==
              id
          ),
      })
    );
  }

  function addService(
    customerId: string
  ) {
    setDraft(
      (current) => ({
        ...current,
        customers:
          current.customers.map(
            (customer) =>
              customer.id ===
              customerId
                ? {
                    ...customer,
                    services: [
                      ...customer.services,
                      {
                        id:
                          createId(
                            'service'
                          ),
                        name: '',
                        status:
                          'pending',
                        note: '',
                      },
                    ],
                  }
                : customer
          ),
      })
    );
  }

  function updateService<
    Key extends
      keyof BackboneImpactService
  >(
    customerId: string,
    serviceId: string,
    key: Key,
    value:
      BackboneImpactService[Key]
  ) {
    setDraft(
      (current) => ({
        ...current,
        customers:
          current.customers.map(
            (customer) =>
              customer.id ===
              customerId
                ? {
                    ...customer,
                    services:
                      customer.services.map(
                        (service) =>
                          service.id ===
                          serviceId
                            ? {
                                ...service,
                                [key]:
                                  value,
                              }
                            : service
                      ),
                  }
                : customer
          ),
      })
    );
  }

  function removeService(
    customerId: string,
    serviceId: string
  ) {
    setDraft(
      (current) => ({
        ...current,
        customers:
          current.customers.map(
            (customer) =>
              customer.id ===
              customerId
                ? {
                    ...customer,
                    services:
                      customer.services.filter(
                        (service) =>
                          service.id !==
                          serviceId
                      ),
                  }
                : customer
          ),
      })
    );
  }

  async function copyTemplate() {
    try {
      await navigator.clipboard.writeText(
        output
      );

      setCopyState(
        'success'
      );

      window.setTimeout(
        () =>
          setCopyState(
            'idle'
          ),
        1600
      );
    } catch {
      setCopyState(
        'error'
      );

      window.setTimeout(
        () =>
          setCopyState(
            'idle'
          ),
        2600
      );
    }
  }

  function resetSample() {
    setConfirmingClear(
      false
    );

    setDraft(
      cloneSample()
    );
  }

  function clearDraft() {
    setConfirmingClear(
      false
    );

    setDraft({
      ...EMPTY_BACKBONE_IMPACT,
      customers: [],
    });
  }

  const persistenceLabel =
    persistenceState ===
    'hydrating'
      ? 'Loading local draft'
      : persistenceState ===
          'error'
        ? 'Local save unavailable'
        : 'Saved locally';

  const persistenceShortLabel =
    persistenceState ===
    'hydrating'
      ? 'Loading'
      : persistenceState ===
          'error'
        ? 'Save error'
        : 'Local';

  return (
    <main className="impact-page-shell">
      <div
        className="ambient ambient-one"
        aria-hidden="true"
      />

      <div
        className="ambient ambient-two"
        aria-hidden="true"
      />

      <header className="impact-page-topbar">
        <Link
          className="impact-back-link"
          href="/"
        >
          <ArrowLeft
            size={16}
          />
          ReportOS
        </Link>

        <div className="impact-page-brand">
          <span className="impact-page-brand-icon">
            <Network
              size={18}
            />
          </span>

          <div>
            <strong>
              Impact Board
            </strong>

            <span>
              Backbone customer
              impact
            </span>
          </div>
        </div>

        <span
          className="impact-local-chip"
          data-state={
            persistenceState
          }
          role="status"
          aria-live="polite"
          aria-label={
            persistenceLabel
          }
        >
          <ShieldCheck
            size={13}
          />
          <span className="impact-local-chip-full">
            {persistenceLabel}
          </span>

          <span
            className="impact-local-chip-short"
            aria-hidden="true"
          >
            {persistenceShortLabel}
          </span>
        </span>
      </header>

      <section className="impact-page-content">
        <section className="impact-hero glass-panel">
          <div className="impact-hero-copy">
            <span className="impact-hero-kicker">
              BACKBONE / B2B IMPACT LIST
            </span>

            <h1>
              Track customer
              impact without
              losing the WAG
              format.
            </h1>

            <p>
              List every B2B,
              tenant, or customer
              service affected by
              a backbone outage.
              Simple customers stay
              one line. Multi-service
              customers expand into
              sub-impact rows.
            </p>

            <div className="impact-hero-badges">
              <span>
                B2B / Tenant
              </span>

              <span>
                Nested service
              </span>

              <span>
                WAG template
              </span>

              <span>
                Autosaved locally
              </span>
            </div>
          </div>

          <div
            className="impact-hero-visual"
            aria-hidden="true"
          >
            <span className="impact-hero-line" />
            <span className="impact-hero-node impact-hero-node-a" />
            <span className="impact-hero-node impact-hero-node-b" />
            <span className="impact-hero-node impact-hero-node-c" />
            <Network
              size={27}
            />
          </div>
        </section>

        <section className="impact-summary-grid">
          <article
            className="impact-summary-card glass-panel"
            data-tone="all"
          >
            <span>
              IMPACT LEAF
            </span>

            <strong>
              {
                stats.total
              }
            </strong>

            <small>
              customer / service
            </small>
          </article>

          <article
            className="impact-summary-card glass-panel"
            data-tone="down"
          >
            <span>
              DOWN
            </span>

            <strong>
              {
                stats.down
              }
            </strong>

            <small>
              ❌ affected
            </small>
          </article>

          <article
            className="impact-summary-card glass-panel"
            data-tone="warning"
          >
            <span>
              WARNING
            </span>

            <strong>
              {
                stats.warning
              }
            </strong>

            <small>
              ⚠️ degraded
            </small>
          </article>

          <article
            className="impact-summary-card glass-panel"
            data-tone="pending"
          >
            <span>
              PENDING
            </span>

            <strong>
              {
                stats.pending
              }
            </strong>

            <small>
              ⏳ checking
            </small>
          </article>

          <article
            className="impact-summary-card glass-panel"
            data-tone="up"
          >
            <span>
              UP / CLEAR
            </span>

            <strong>
              {
                stats.up
              }
            </strong>

            <small>
              ✅ healthy
            </small>
          </article>
        </section>

        <div
          className="impact-mobile-pane-switch"
          role="tablist"
          aria-label="Impact workspace view"
        >
          <button
            type="button"
            role="tab"
            aria-selected={
              mobilePane ===
              'editor'
            }
            aria-controls="impact-editor-pane"
            onClick={() =>
              setMobilePane(
                'editor'
              )
            }
          >
            Editor
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={
              mobilePane ===
              'preview'
            }
            aria-controls="impact-preview-pane"
            onClick={() =>
              setMobilePane(
                'preview'
              )
            }
          >
            Preview
          </button>
        </div>

        <div
          className="impact-workspace-grid"
          data-mobile-pane={
            mobilePane
          }
        >
          <section
            className="impact-editor-column"
            id="impact-editor-pane"
          >
            <article className="impact-editor-card glass-panel">
              <div className="impact-section-head">
                <div>
                  <span className="impact-section-kicker">
                    BACKBONE IDENTITY
                  </span>

                  <h2>
                    Backbone / route
                  </h2>

                  <p>
                    This becomes the
                    bold title at the
                    top of the WAG
                    template.
                  </p>
                </div>
              </div>

              <label className="impact-title-field">
                <span>
                  BACKBONE NAME
                </span>

                <input
                  value={
                    draft.title
                  }
                  placeholder="UJB tegal - pekalongan"
                  onChange={(
                    event
                  ) =>
                    updateTitle(
                      event.target
                        .value
                    )
                  }
                />
              </label>
            </article>

            <article className="impact-editor-card glass-panel">
              <div className="impact-section-head impact-customer-head">
                <div>
                  <span className="impact-section-kicker">
                    CUSTOMER / TENANT
                  </span>

                  <h2>
                    Impact listing
                  </h2>

                  <p>
                    Add a customer
                    directly, or add
                    child services when
                    one customer carries
                    multiple circuits.
                  </p>
                </div>

                <button
                  className="impact-add-customer"
                  type="button"
                  onClick={
                    addCustomer
                  }
                >
                  <Plus
                    size={14}
                  />
                  Customer
                </button>
              </div>

              <div className="impact-customer-list">
                {draft.customers.map(
                  (
                    customer,
                    index
                  ) => {
                    const grouped =
                      customer
                        .services
                        .length >
                      0;

                    return (
                      <article
                        className="impact-customer-card"
                        data-grouped={
                          grouped
                            ? 'true'
                            : 'false'
                        }
                        key={
                          customer.id
                        }
                      >
                        <div className="impact-customer-card-head">
                          <span className="impact-customer-number">
                            {
                              index +
                              1
                            }
                          </span>

                          <label className="impact-customer-name">
                            <span>
                              CUSTOMER /
                              TENANT
                            </span>

                            <input
                              value={
                                customer.name
                              }
                              placeholder="H3I / IFORTE / FIBERSTAR"
                              onChange={(
                                event
                              ) =>
                                updateCustomer(
                                  customer.id,
                                  'name',
                                  event
                                    .target
                                    .value
                                )
                              }
                            />
                          </label>

                          <button
                            className="impact-delete-button"
                            type="button"
                            title="Remove customer"
                            aria-label={
                              'Remove customer ' +
                              (
                                customer.name ||
                                index + 1
                              )
                            }
                            onClick={() =>
                              removeCustomer(
                                customer.id
                              )
                            }
                          >
                            <Trash2
                              size={14}
                            />
                          </button>
                        </div>

                        {!grouped ? (
                          <div className="impact-simple-row">
                            <div>
                              <span className="impact-mini-label">
                                STATUS
                              </span>

                              <StatusSelector
                                label={
                                  'Customer ' +
                                  (
                                    index +
                                    1
                                  ) +
                                  ' status'
                                }
                                value={
                                  customer.status
                                }
                                onChange={(
                                  status
                                ) =>
                                  updateCustomer(
                                    customer.id,
                                    'status',
                                    status
                                  )
                                }
                              />
                            </div>

                            <label className="impact-note-field">
                              <span>
                                NOTE · OPTIONAL
                              </span>

                              <input
                                value={
                                  customer.note
                                }
                                placeholder="RX / escalation / checking note"
                                onChange={(
                                  event
                                ) =>
                                  updateCustomer(
                                    customer.id,
                                    'note',
                                    event
                                      .target
                                      .value
                                  )
                                }
                              />
                            </label>
                          </div>
                        ) : (
                          <div className="impact-grouped-note">
                            <Layers3
                              size={14}
                            />

                            <span>
                              Parent status is
                              derived from the
                              service rows below
                              and is not counted
                              separately.
                            </span>
                          </div>
                        )}

                        <div className="impact-service-list">
                          {customer.services.map(
                            (
                              service,
                              serviceIndex
                            ) => (
                              <div
                                className="impact-service-row"
                                key={
                                  service.id
                                }
                              >
                                <span className="impact-service-index">
                                  {
                                    serviceIndex +
                                    1
                                  }
                                </span>

                                <label className="impact-service-name">
                                  <span>
                                    SERVICE /
                                    CIRCUIT
                                  </span>

                                  <input
                                    value={
                                      service.name
                                    }
                                    placeholder="JVBB / UJB / UAJB"
                                    onChange={(
                                      event
                                    ) =>
                                      updateService(
                                        customer.id,
                                        service.id,
                                        'name',
                                        event
                                          .target
                                          .value
                                      )
                                    }
                                  />
                                </label>

                                <StatusSelector
                                  compact
                                  label={
                                    'Service ' +
                                    (
                                      serviceIndex +
                                      1
                                    ) +
                                    ' status'
                                  }
                                  value={
                                    service.status
                                  }
                                  onChange={(
                                    status
                                  ) =>
                                    updateService(
                                      customer.id,
                                      service.id,
                                      'status',
                                      status
                                    )
                                  }
                                />

                                <label className="impact-service-note">
                                  <span>
                                    NOTE
                                  </span>

                                  <input
                                    value={
                                      service.note
                                    }
                                    placeholder="RX pekalongan 0.7 db"
                                    onChange={(
                                      event
                                    ) =>
                                      updateService(
                                        customer.id,
                                        service.id,
                                        'note',
                                        event
                                          .target
                                          .value
                                      )
                                    }
                                  />
                                </label>

                                <button
                                  className="impact-delete-button impact-delete-service"
                                  type="button"
                                  title="Remove service"
                                  aria-label={
                                    'Remove service ' +
                                    (
                                      service.name ||
                                      serviceIndex +
                                      1
                                    )
                                  }
                                  onClick={() =>
                                    removeService(
                                      customer.id,
                                      service.id
                                    )
                                  }
                                >
                                  <X
                                    size={13}
                                  />
                                </button>
                              </div>
                            )
                          )}
                        </div>

                        <button
                          className="impact-add-service"
                          type="button"
                          onClick={() =>
                            addService(
                              customer.id
                            )
                          }
                        >
                          <Plus
                            size={13}
                          />

                          {grouped
                            ? 'Add another service'
                            : 'Add sub-service / circuit'}
                        </button>
                      </article>
                    );
                  }
                )}

                {draft.customers
                  .length === 0 ? (
                  <div className="impact-empty-state">
                    <Users
                      size={22}
                    />

                    <strong>
                      No customer impact
                      yet
                    </strong>

                    <span>
                      Add the first B2B,
                      tenant, or customer
                      affected by this
                      backbone.
                    </span>

                    <button
                      type="button"
                      onClick={
                        addCustomer
                      }
                    >
                      <Plus
                        size={13}
                      />
                      Add customer
                    </button>
                  </div>
                ) : null}
              </div>
            </article>
          </section>

          <aside
            className="impact-preview-column"
            id="impact-preview-pane"
          >
            <article className="impact-preview-card glass-panel">
              <div className="impact-preview-head">
                <div>
                  <span className="impact-section-kicker">
                    LIVE WAG TEMPLATE
                  </span>

                  <h2>
                    Impact preview
                  </h2>

                  <p>
                    Numbering is
                    automatic. Customer
                    groups with services
                    become nested rows.
                  </p>
                </div>

                <span className="impact-live-chip">
                  <span />
                  LIVE
                </span>
              </div>

              <div className="impact-template-paper">
                <div className="impact-template-toolbar">
                  <div>
                    <span />
                    <span />
                    <span />
                  </div>

                  <strong>
                    impact-list.txt
                  </strong>

                  <Clipboard
                    size={13}
                  />
                </div>

                <pre aria-label="Generated WAG impact template">
                  {
                    output
                  }
                </pre>
              </div>

              <button
                className="impact-copy-button"
                type="button"
                onClick={
                  copyTemplate
                }
              >
                {copyState ===
                'success' ? (
                  <Check
                    size={16}
                  />
                ) : (
                  <Copy
                    size={16}
                  />
                )}

                {copyState ===
                'success'
                  ? 'Template copied'
                  : copyState ===
                      'error'
                    ? 'Copy failed · try again'
                    : 'Copy WAG template'}
              </button>

              <span
                className="impact-copy-feedback"
                role="status"
                aria-live="polite"
              >
                {copyState ===
                'success'
                  ? 'WAG template copied to the clipboard.'
                  : copyState ===
                      'error'
                    ? 'Clipboard access failed. Select the preview text and copy it manually.'
                    : ''}
              </span>

              <div className="impact-preview-hints">
                <div>
                  <Check
                    size={13}
                  />

                  <span>
                    Parent numbering is
                    regenerated
                    automatically.
                  </span>
                </div>

                <div>
                  <AlertTriangle
                    size={13}
                  />

                  <span>
                    ⚠️ is best used for
                    degraded / abnormal
                    RX that is not fully
                    down.
                  </span>
                </div>
              </div>
            </article>

            <article className="impact-actions-card glass-panel">
              <div>
                <strong>
                  Draft controls
                </strong>

                <span>
                  Data stays in this
                  browser via local
                  autosave.
                </span>
              </div>

              {confirmingClear ? (
                <div
                  className="impact-clear-confirmation"
                  role="alert"
                >
                  <div>
                    <strong>
                      Clear this local
                      draft?
                    </strong>

                    <span>
                      Customer and service
                      rows will be removed
                      from this browser.
                    </span>
                  </div>

                  <div className="impact-action-buttons">
                    <button
                      type="button"
                      onClick={() =>
                        setConfirmingClear(
                          false
                        )
                      }
                    >
                      Cancel
                    </button>

                    <button
                      className="impact-clear-button"
                      type="button"
                      onClick={
                        clearDraft
                      }
                    >
                      Clear draft
                    </button>
                  </div>
                </div>
              ) : (
                <div className="impact-action-buttons">
                  <button
                    type="button"
                    onClick={
                      resetSample
                    }
                  >
                    <RotateCcw
                      size={14}
                    />
                    Load sample
                  </button>

                  <button
                    className="impact-clear-button"
                    type="button"
                    onClick={() =>
                      setConfirmingClear(
                        true
                      )
                    }
                  >
                    <Trash2
                      size={14}
                    />
                    Clear
                  </button>
                </div>
              )}
            </article>

            <details className="impact-guide-card glass-panel">
              <summary>
                <div>
                  <strong>
                    Status guide
                  </strong>

                  <span>
                    Quick operator
                    reference
                  </span>
                </div>

                <ChevronDown
                  size={15}
                />
              </summary>

              <div className="impact-guide-list">
                {IMPACT_STATUS_OPTIONS.map(
                  (option) => (
                    <div
                      key={
                        option.value
                      }
                    >
                      <span>
                        {
                          option.symbol
                        }
                      </span>

                      <strong>
                        {
                          option.label
                        }
                      </strong>

                      <small>
                        {option.value ===
                        'up'
                          ? 'Service clear / normal.'
                          : option.value ===
                              'pending'
                            ? 'Still checking / waiting confirmation.'
                            : option.value ===
                                'down'
                              ? 'Service confirmed down.'
                              : option.value ===
                                  'warning'
                                ? 'Degraded / abnormal but not fully down.'
                                : 'Status not confirmed yet.'}
                      </small>
                    </div>
                  )
                )}
              </div>
            </details>
          </aside>
        </div>
      </section>
    </main>
  );
}
