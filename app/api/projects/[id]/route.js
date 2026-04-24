// app/api/projects/[id]/route.js
// Single-project CRUD — Next.js App Router dynamic route.
// Auth via Auth.js session cookie.

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  getProjectForUser,
  updateProjectForUser,
  deleteProjectForUser,
} from '@/lib/db';

export async function GET(req, { params }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await params;
  try {
    const project = await getProjectForUser(session.user.id, id);
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    return NextResponse.json({ project });
  } catch (err) {
    console.error('Project GET error:', err);
    return NextResponse.json({ error: 'Database unavailable' }, { status: 500 });
  }
}

export async function PUT(req, { params }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await params;
  let body;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  try {
    const project = await updateProjectForUser(session.user.id, id, body);
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    return NextResponse.json({ project });
  } catch (err) {
    console.error('Project PUT error:', err);
    if (err.status) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: 'Database unavailable' }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await params;
  try {
    const ok = await deleteProjectForUser(session.user.id, id);
    if (!ok) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    return NextResponse.json({ deleted: true });
  } catch (err) {
    console.error('Project DELETE error:', err);
    return NextResponse.json({ error: 'Database unavailable' }, { status: 500 });
  }
}
