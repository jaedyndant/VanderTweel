import { after } from 'next/server';
import { ZodError } from 'zod';
import { apiError, assertSameOrigin } from '@/lib/platform-access';
import { getCommunication, publishTeamMessage } from '@/lib/platform-communication';
import { dispatchMailOutbox } from '@/lib/mail-outbox';
export async function GET(request: Request) {
 try { return Response.json(await getCommunication(Object.fromEntries(new URL(request.url).searchParams)), {headers:{'Cache-Control':'private, no-store'}}); }
 catch(error) { return error instanceof ZodError ? Response.json({error:'Invalid selection.'},{status:400}) : apiError(error); }
}
export async function POST(request: Request) {
 try { assertSameOrigin(request); const result=await publishTeamMessage(await request.json()); after(()=>dispatchMailOutbox()); return Response.json(result); }
 catch(error) { return error instanceof ZodError ? Response.json({error:'Check the title, message and photo selection.'},{status:400}) : apiError(error); }
}
