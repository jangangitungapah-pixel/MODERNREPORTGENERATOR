import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  requireWorkspaceRole,
  roleAtLeast,
} from './permissions';

describe(
  'workspace permissions',
  () => {
    it(
      'orders operator supervisor and admin access',
      () => {
        expect(
          roleAtLeast(
            'operator',
            'operator'
          )
        ).toBe(true);

        expect(
          roleAtLeast(
            'operator',
            'supervisor'
          )
        ).toBe(false);

        expect(
          roleAtLeast(
            'admin',
            'supervisor'
          )
        ).toBe(true);
      }
    );

    it(
      'throws a stable authorization error',
      () => {
        expect(() =>
          requireWorkspaceRole(
            'operator',
            'admin'
          )
        ).toThrow(
          'requires admin workspace access'
        );
      }
    );
  }
);
