import * as Sentry from "@sentry/nextjs";

// No secrets here: NEXT_PUBLIC_SENTRY_DSN is a public value by design (it
// identifies a project, not a credential). Sentry's SDK no-ops safely when
// no DSN is configured, so this file is inert until one is set.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  // Server-side errors can carry request data — never enable
  // sendDefaultPii here without reviewing what that includes.
});
