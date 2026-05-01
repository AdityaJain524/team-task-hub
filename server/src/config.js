// Central config. Hardcoded defaults so the server runs with zero env setup.
// Override by setting env vars in production.
module.exports = {
  PORT: process.env.PORT || 4000,
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
  DATABASE_URL:
    process.env.DATABASE_URL ||
    'postgres://postgres:postgres@localhost:5432/team_task_manager',
  JWT_SECRET:
    process.env.JWT_SECRET ||
    'dev-only-jwt-secret-change-me-in-production-0123456789abcdef',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  JWT_ISSUER: 'team-task-manager',
  JWT_AUDIENCE: 'team-task-manager-client',
};
