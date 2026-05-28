// app/studio/layout.js
// Server-side auth gate for the studio. Runs in the Node runtime (not edge),
// so the database-backed session check via auth() works. Unauthenticated
// visitors — whether they clicked through or typed /studio directly — are
// redirected home, where the login modal lives.

import { redirect } from 'next/navigation';
import { auth } from '@/auth';

export default async function StudioLayout({ children }) {
  const session = await auth();
  if (!session?.user) {
    redirect('/?login=1');
  }
  return children;
}
