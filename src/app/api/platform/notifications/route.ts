import { z } from 'zod';
import { apiError, assertSameOrigin } from '@/lib/platform-access';
import { getBuyerNotifications, markNotificationRead } from '@/lib/platform-communication';
export async function GET(request:Request) {
 try { const page=z.coerce.number().int().min(0).max(1000).parse(new URL(request.url).searchParams.get('page') ?? 0); return Response.json(await getBuyerNotifications(page),{headers:{'Cache-Control':'private, no-store'}}); }
 catch(error) { return apiError(error); }
}
export async function PATCH(request:Request) {
 try { assertSameOrigin(request); const {id}=z.object({id:z.uuid()}).parse(await request.json()); await markNotificationRead(id); return Response.json({ok:true}); }
 catch(error) { return apiError(error); }
}
