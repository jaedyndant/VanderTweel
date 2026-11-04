import { timingSafeEqual } from 'node:crypto';
import { dispatchMailOutbox } from '@/lib/mail-outbox';
export async function GET(request:Request) {
 const expected=process.env.CRON_SECRET;
 const received=request.headers.get('authorization') ?? '';
 const valid=expected && Buffer.byteLength(received)===Buffer.byteLength(`Bearer ${expected}`) && timingSafeEqual(Buffer.from(received),Buffer.from(`Bearer ${expected}`));
 if(!valid) return Response.json({error:'Unauthorized'},{status:401});
 await dispatchMailOutbox(30);
 return Response.json({ok:true},{headers:{'Cache-Control':'no-store'}});
}
