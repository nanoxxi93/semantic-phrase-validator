/**
 * Asserts that the target environment is safe for running integration tests.
 * Standard industry practice: blocks tests if NODE_ENV is set to 'production'
 * or if the connection string explicitly targets a production database name.
 */
export function assertSafeTestDatabase(databaseUrl: string, nodeEnv: string): void {
  if (nodeEnv === 'production') {
    throw new Error(
      'CRITICAL SAFETY CHECK: Running destructive integration tests in a PRODUCTION environment (NODE_ENV=production) is strictly forbidden.'
    );
  }

  // Guard against accidental connection to databases explicitly named 'production' or 'prod'
  const urlPath = databaseUrl.split('/').pop()?.split('?')[0]?.toLowerCase() || '';
  if (urlPath === 'production' || urlPath === 'prod' || urlPath.startsWith('production_') || urlPath.startsWith('prod_')) {
    throw new Error(
      `CRITICAL SAFETY CHECK: DATABASE_URL targets a database named "${urlPath}". Running tests on databases with production names is forbidden.`
    );
  }
}
