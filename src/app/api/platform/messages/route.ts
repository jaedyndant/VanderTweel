import { z } from 'zod';
import { apiError,requireActor,AccessError } from '@/lib/platform-access';
import { getBuyerMessages } from '@/lib/platform-communication';
export async function GET(request:Request){try{const actor=await requireActor();if(actor.role!=='buyer')throw new AccessError();const p=z.object({villa:z.uuid(),page:z.coerce.number().int().min(0).max(1000).default(0)}).parse(Object.fromEntries(new URL(request.url).searchParams));const rows=await getBuyerMessages(actor.id,p.villa,p.page);return Response.json({messages:rows.slice(0,30),hasMore:rows.length>30},{headers:{'Cache-Control':'private, no-store'}});}catch(error){return apiError(error);}}
