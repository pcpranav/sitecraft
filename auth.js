// auth.js
// Auth.js v5 configuration. Exports { auth, signIn, signOut, handlers }.
// `auth()` is callable from server components, route handlers, and middleware
// to retrieve the current session.

import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import PostgresAdapter from '@auth/pg-adapter';
import { createPool } from '@vercel/postgres';

const pool = createPool();

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PostgresAdapter(pool),
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  ],
  session: {
    strategy: 'database',
  },
  trustHost: true,
});
