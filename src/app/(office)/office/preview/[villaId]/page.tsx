import { notFound } from 'next/navigation';
import Link from 'next/link';
import { eq } from 'drizzle-orm';
import { requireActor } from '@/lib/platform-access';
import { db } from '@/db/client';
import { buyer,buyerVilla } from '@/db/schema';
import { getClientPlatformData } from '@/lib/client-platform-data';
import { ClientPlatform } from '@/components/client-platform/client-platform';
import type {ClientPage} from '@/components/client-platform/types';
export const instant=false;
export const metadata={title:'Read-only owner preview'};
export default async function Preview({params,searchParams}:{params:Promise<{villaId:string}>;searchParams:Promise<{page?:string}>}){
 await requireActor(true);
 const {villaId}=await params;const {page:requested}=await searchParams;
 const pages:ClientPage[]=['home','villa','progress','payments','documents','updates'];
 const page=pages.includes(requested as ClientPage)?requested as ClientPage:'home';
 const [owner]=await db.select({accountId:buyer.accountId}).from(buyer).innerJoin(buyerVilla,eq(buyer.id,buyerVilla.buyerId)).where(eq(buyerVilla.villaId,villaId)).limit(1);
 if(!owner)return <main style={{padding:40}}><h1>No linked owner yet</h1><p>Assign an owner before previewing their workspace.</p><Link href="/office/villas">Back to villas</Link></main>;
 const data=await getClientPlatformData(owner.accountId,villaId,page);
 if(!data)notFound();
 return <><aside className="completion-preview"><strong>Read-only owner preview · Your developer session stays active.</strong><Link href="/office/villas">Exit preview</Link></aside><ClientPlatform data={{...data,account:null,villaChoices:data.villaChoices.filter(v=>v.id===villaId)}} page={page} preview/></>;
}
