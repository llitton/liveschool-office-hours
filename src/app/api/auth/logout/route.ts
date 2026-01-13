import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete('admin_session');
  return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/admin`);
}

export async function GET() {
  const cookieStore = await cookies();
  cookieStore.delete('admin_session');
  return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/admin`);
}
