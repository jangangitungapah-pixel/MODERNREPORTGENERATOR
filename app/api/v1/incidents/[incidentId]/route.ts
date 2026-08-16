import {
  NextResponse,
} from 'next/server';

import {
  requireFirebasePrincipal,
} from '@/lib/server/auth/firebase-rest-auth';

import {
  reportOsDb,
} from '@/lib/server/db/d1';

import {
  ensureWorkspaceContext,
} from '@/lib/server/workspace-service';

import {
  ApiError,
  errorResponse,
  requestId,
} from '@/lib/server/http/api-response';

export const dynamic =
  'force-dynamic';

type IncidentRow = {
  id: string;
  lifecycle: string;
  region: string;
  summary: string;
  ticket: string;
  occur_time: string;
  dispatch_time: string;
  pic: string;
  rootcause: string;
  cut_point: string;
  primary_marker: string | null;
  status_tag: string | null;
  revision: number;
  created_at: number;
  updated_at: number;
};

export async function GET(
  request: Request,
  {
    params,
  }: {
    params: Promise<{
      incidentId: string;
    }>;
  }
) {
  const id = requestId();

  try {
    const principal =
      await requireFirebasePrincipal(
        request
      );

    const context =
      await ensureWorkspaceContext(
        principal
      );

    const {
      incidentId,
    } = await params;

    const db = reportOsDb();

    const incident =
      await db
        .prepare(
          `SELECT
            id,
            lifecycle,
            region,
            summary,
            ticket,
            occur_time,
            dispatch_time,
            pic,
            rootcause,
            cut_point,
            primary_marker,
            status_tag,
            revision,
            created_at,
            updated_at
          FROM incidents
          WHERE id = ?
            AND workspace_id = ?
            AND deleted_at IS NULL
          LIMIT 1`
        )
        .bind(
          incidentId,
          context.id
        )
        .first<IncidentRow>();

    if (!incident) {
      throw new ApiError(
        404,
        'INCIDENT_NOT_FOUND',
        'Trouble ticket was not found.'
      );
    }

    const [
      progress,
      impacts,
      cutPoints,
      closure,
    ] = await Promise.all([
      db
        .prepare(
          `SELECT
            id,
            date,
            time,
            text,
            position,
            updated_at
          FROM progress_entries
          WHERE incident_id = ?
          ORDER BY position ASC`
        )
        .bind(incidentId)
        .all<{
          id: string;
          date: string | null;
          time: string;
          text: string;
          position: number;
          updated_at: number;
        }>(),
      db
        .prepare(
          `SELECT
            id,
            marker,
            region,
            status_tag,
            summary,
            ticket,
            position
          FROM impact_links
          WHERE incident_id = ?
          ORDER BY position ASC`
        )
        .bind(incidentId)
        .all<{
          id: string;
          marker: string;
          region: string;
          status_tag: string;
          summary: string;
          ticket: string;
          position: number;
        }>(),
      db
        .prepare(
          `SELECT
            id,
            label,
            rootcause,
            cut_point,
            marker,
            position
          FROM cut_points
          WHERE incident_id = ?
          ORDER BY position ASC`
        )
        .bind(incidentId)
        .all<{
          id: string;
          label: string;
          rootcause: string;
          cut_point: string;
          marker: string;
          position: number;
        }>(),
      db
        .prepare(
          `SELECT
            statement_up_wag,
            matoa_status_tt,
            matoa_event_and_photo,
            matoa_rfo,
            sent_closed_email,
            updated_at
          FROM closure_states
          WHERE incident_id = ?
          LIMIT 1`
        )
        .bind(incidentId)
        .first<{
          statement_up_wag: number;
          matoa_status_tt: number;
          matoa_event_and_photo: number;
          matoa_rfo: number;
          sent_closed_email: number;
          updated_at: number;
        }>(),
    ]);

    return NextResponse.json(
      {
        ok: true,
        requestId: id,
        workspace: {
          id: context.id,
          role: context.role,
        },
        incident: {
          id: incident.id,
          lifecycle:
            incident.lifecycle,
          region: incident.region,
          summary:
            incident.summary,
          ticket: incident.ticket,
          occurTime:
            incident.occur_time,
          dispatchTime:
            incident.dispatch_time,
          pic: incident.pic,
          rootcause:
            incident.rootcause,
          cutPoint:
            incident.cut_point,
          primaryMarker:
            incident.primary_marker,
          statusTag:
            incident.status_tag,
          revision:
            incident.revision,
          createdAt:
            incident.created_at,
          updatedAt:
            incident.updated_at,
          progress:
            progress.results.map(
              (entry) => ({
                id: entry.id,
                date: entry.date,
                time: entry.time,
                text: entry.text,
                position:
                  entry.position,
                updatedAt:
                  entry.updated_at,
              })
            ),
          impactLinks:
            impacts.results.map(
              (entry) => ({
                id: entry.id,
                marker:
                  entry.marker,
                region:
                  entry.region,
                statusTag:
                  entry.status_tag,
                summary:
                  entry.summary,
                ticket:
                  entry.ticket,
                position:
                  entry.position,
              })
            ),
          cutPoints:
            cutPoints.results.map(
              (entry) => ({
                id: entry.id,
                label: entry.label,
                rootcause:
                  entry.rootcause,
                cutPoint:
                  entry.cut_point,
                marker:
                  entry.marker,
                position:
                  entry.position,
              })
            ),
          closure: closure
            ? {
                statementUpWag:
                  Boolean(
                    closure.statement_up_wag
                  ),
                matoaClearance: {
                  statusTt:
                    Boolean(
                      closure.matoa_status_tt
                    ),
                  eventAndPhoto:
                    Boolean(
                      closure.matoa_event_and_photo
                    ),
                  rfo:
                    Boolean(
                      closure.matoa_rfo
                    ),
                },
                sentClosedEmail:
                  Boolean(
                    closure.sent_closed_email
                  ),
                updatedAt:
                  closure.updated_at,
              }
            : null,
        },
      },
      {
        headers: {
          'Cache-Control':
            'no-store',
          'X-Request-Id': id,
        },
      }
    );
  } catch (error) {
    return errorResponse(
      error,
      id
    );
  }
}
