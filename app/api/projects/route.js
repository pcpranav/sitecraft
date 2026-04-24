// app/api/projects/route.js
// List & create projects — Next.js App Router
// Auth via Auth.js session cookie (no Authorization header needed).

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { listProjectsForUser, createProjectForUser } from '@/lib/db';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const projects = await listProjectsForUser(session.user.id);
    return NextResponse.json({ projects });
  } catch (err) {
    console.error('Projects GET error:', err);
    return NextResponse.json({ error: 'Database unavailable' }, { status: 500 });
  }
}

export async function POST(req) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  let body;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  try {
    const project = await createProjectForUser(session.user.id, body);
    return NextResponse.json({ project }, { status: 201 });
  } catch (err) {
    console.error('Projects POST error:', err);
    if (err.status) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: 'Database unavailable' }, { status: 500 });
  }
}
