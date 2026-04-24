// app/api/auth/[...nextauth]/route.js
// Re-exports Auth.js handlers for /api/auth/* routes:
//   /api/auth/signin, /api/auth/callback/google, /api/auth/signout,
//   /api/auth/session, /api/auth/providers, /api/auth/csrf
import { handlers } from '@/auth';

export const { GET, POST } = handlers;
