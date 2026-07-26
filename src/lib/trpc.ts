/**
 * tRPC client. Routes all calls to /api/trpc on the same origin (the express
 * server hosts both the Vite middleware and the tRPC mount in dev, and the
 * built static files plus tRPC mount in production).
 *
 * The AppRouter import gives us full end-to-end type inference: every
 * procedure's input + output is checked against the server schema at compile
 * time, with no codegen step.
 *
 * Tenant id is derived server-side from the authenticated user's email
 * (see `server/middleware/tenant.ts`). Before P6.14 this was an `x-tenant-id`
 * request header set by the client — that approach was spoofable.
 */

import { createTRPCReact, httpBatchLink } from '@trpc/react-query';
import superjson from 'superjson';
import type { AppRouter } from '../../server/routers';

export const trpc = createTRPCReact<AppRouter>();

export const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: '/api/trpc',
      // Send the session cookie on every request (httpOnly, SameSite=Lax in dev).
      // The tenant id is no longer in headers — the server resolves it from
      // the authenticated user's record.
      fetch(url, options) {
        return fetch(url, { ...options, credentials: 'include' });
      },
    }),
  ],
  transformer: superjson,
});
