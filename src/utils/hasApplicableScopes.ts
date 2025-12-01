import { Connection } from '../types/Connection';

/**
 * Check if a connection has applicable data scopes configured.
 * Returns true if there are actual resources with read/write permissions.
 *
 * This is used to determine whether to show consent-related UI elements
 * (consent screen, permission badges, etc.)
 */
export const hasApplicableScopes = (
  connection: Connection | null | undefined
): boolean => {
  const scopes = connection?.application_data_scopes;

  if (!scopes?.enabled || !scopes.resources) {
    return false;
  }

  if (typeof scopes.resources === 'string') {
    return scopes.resources === '*';
  }

  // Check if any resource has fields with actual permissions
  return Object.values(scopes.resources).some((resource) =>
    Object.values(resource).some((field) => field.read || field.write)
  );
};

