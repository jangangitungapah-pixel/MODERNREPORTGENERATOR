import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core';

import {
  appUsers,
  workspaces,
} from './schema';

export const workspaceStates =
  sqliteTable(
    'workspace_states',
    {
      workspaceId:
        text(
          'workspace_id'
        )
          .primaryKey()
          .references(
            () =>
              workspaces.id,
            {
              onDelete:
                'cascade',
            }
          ),
      activeIncidentId:
        text(
          'active_incident_id'
        )
          .notNull()
          .default(''),
      payloadJson:
        text(
          'payload_json'
        ).notNull(),
      revision:
        integer(
          'revision'
        )
          .notNull()
          .default(1),
      checksum:
        text('checksum')
          .notNull(),
      createdAt:
        integer(
          'created_at'
        ).notNull(),
      updatedAt:
        integer(
          'updated_at'
        ).notNull(),
      updatedBy:
        text(
          'updated_by'
        )
          .notNull()
          .references(
            () =>
              appUsers.uid
          ),
    },
    (table) => [
      index(
        'idx_workspace_states_updated'
      ).on(
        table.updatedAt
      ),
    ]
  );

export const idempotencyKeys =
  sqliteTable(
    'idempotency_keys',
    {
      workspaceId:
        text(
          'workspace_id'
        )
          .notNull()
          .references(
            () =>
              workspaces.id,
            {
              onDelete:
                'cascade',
            }
          ),
      requestKey:
        text(
          'request_key'
        )
          .notNull(),
      actorUid:
        text(
          'actor_uid'
        )
          .notNull()
          .references(
            () =>
              appUsers.uid
          ),
      responseJson:
        text(
          'response_json'
        )
          .notNull(),
      createdAt:
        integer(
          'created_at'
        ).notNull(),
    },
    (table) => [
      primaryKey({
        columns: [
          table.workspaceId,
          table.requestKey,
        ],
      }),
      index(
        'idx_idempotency_created'
      ).on(
        table.createdAt
      ),
    ]
  );
