import {randomUUID} from 'node:crypto';
import {beforeAll,describe,it,expect} from 'vitest';
import {eq} from 'drizzle-orm';
import {db} from '@/db/client';
import {verificationToken} from '@/db/schema';
import {buildAuthAdapter} from '@/lib/auth-adapter';
beforeAll(()=>{const u=new URL(process.env.DATABASE_URL!);if(process.env.VDT_LOCAL_TEST!=='1'||u.hostname!=='127.0.0.1'||!u.pathname.includes('test'))throw Error('Isolated local test database required');});
describe('real PostgreSQL one-time sign-in tokens',()=>{
 it('allows only one of eight concurrent consumers and never recreates a token',async()=>{
  const identifier=`${randomUUID()}@acceptance.invalid`;const token=randomUUID();const expires=new Date(Date.now()+60_000);
  await db.insert(verificationToken).values({identifier,token,expires});
  const adapter=buildAuthAdapter();const results=await Promise.all(Array.from({length:8},()=>adapter.useVerificationToken!({identifier,token})));
  expect(results.filter(Boolean)).toHaveLength(1);
  expect(await db.select().from(verificationToken).where(eq(verificationToken.identifier,identifier))).toHaveLength(0);
  expect(await adapter.useVerificationToken!({identifier,token})).toBeNull();
 });
});
