import { Pool } from 'pg';
const url=new URL(process.env.DATABASE_URL!);
if(url.hostname!=='127.0.0.1'||url.port!=='55439'||!url.pathname.includes('_test'))throw Error('Isolated fixture DB required');
const pg=new Pool({connectionString:url.toString()});
async function seed(){
 const ids={project:'a0000000-0000-4000-8000-000000000001',villa:'a0000000-0000-4000-8000-000000000002',otherVilla:'a0000000-0000-4000-8000-000000000003',developer:'a0000000-0000-4000-8000-000000000004',pm:'a0000000-0000-4000-8000-000000000005',owner:'a0000000-0000-4000-8000-000000000006',otherOwner:'a0000000-0000-4000-8000-000000000007',buyer:'a0000000-0000-4000-8000-000000000008',otherBuyer:'a0000000-0000-4000-8000-000000000009',pmProfile:'a0000000-0000-4000-8000-000000000010'};
 for(const[role,key]of [['developer','developer'],['pm','pm'],['buyer','owner'],['buyer','otherOwner']] as const) await pg.query('insert into account(id,email,role,display_name)values($1,$2,$3,$4) on conflict(id)do nothing',[ids[key],`${key.toLowerCase()}@acceptance.invalid`,role,`Test ${key}`]);
 await pg.query('insert into project(id,name,slug)values($1,$2,$3) on conflict(id)do nothing',[ids.project,'Acceptance Atelier','acceptance-atelier']);
 for(const[key,code]of [['villa','ACPT-ROOT-01'],['otherVilla','ACPT-ROOT-02']]as const) await pg.query('insert into villa(id,project_id,code,status,price_total_usd,type_label,built_m2)values($1,$2,$3,$4,$5,$6,$7)on conflict(id)do nothing',[ids[key],ids.project,code,'in_build','160000.01','One-bedroom villa',90]);
 for(const[owner,buyer,villa]of [['owner','buyer','villa'],['otherOwner','otherBuyer','otherVilla']]as const){await pg.query('insert into buyer(id,account_id,name)values($1,$2,$3)on conflict(id)do nothing',[ids[buyer],ids[owner],`Test ${owner}`]);await pg.query('insert into buyer_villa(buyer_id,villa_id)values($1,$2)on conflict do nothing',[ids[buyer],ids[villa]]);}
 await pg.query('insert into project_manager(id,account_id)values($1,$2)on conflict(id)do nothing',[ids.pmProfile,ids.pm]);await pg.query('insert into pm_project(pm_id,project_id)values($1,$2)on conflict do nothing',[ids.pmProfile,ids.project]);
 await pg.query('insert into progress_task(id,villa_id,phase,percent_weight,sequence)values($1,$2,$3,100,0)on conflict(id)do nothing',['a0000000-0000-4000-8000-000000000011',ids.villa,'Structure']);
 console.log('Synthetic acceptance fixture ready');await pg.end();
}seed();
