begin;
select plan(14);

select has_table('private','marketplace_offers','Private marketplace offer history exists');
select has_column('private','marketplace_offers','amount_cents','Offers store amount in cents');
select has_column('private','marketplace_offers','parent_offer_id','Counter offers retain their parent offer');

select ok(
  not has_table_privilege('authenticated','private.marketplace_offers','SELECT'),
  'authenticated cannot read private offer rows directly'
);
select ok(
  not has_table_privilege('authenticated','private.marketplace_offers','INSERT'),
  'authenticated cannot insert private offer rows directly'
);
select ok(
  not has_table_privilege('authenticated','private.marketplace_offers','UPDATE'),
  'authenticated cannot mutate private offer rows directly'
);

select ok(
  (select p.prosecdef from pg_catalog.pg_proc p
   where p.oid='public.make_my_marketplace_offer(uuid,bigint,text)'::regprocedure),
  'make offer RPC is SECURITY DEFINER'
);
select ok(
  (select p.proconfig @> array['search_path=""']::text[] from pg_catalog.pg_proc p
   where p.oid='public.make_my_marketplace_offer(uuid,bigint,text)'::regprocedure),
  'make offer RPC has empty search_path'
);
select ok(
  (select p.prosecdef from pg_catalog.pg_proc p
   where p.oid='public.respond_to_my_marketplace_offer(uuid,text,bigint,text)'::regprocedure),
  'offer response RPC is SECURITY DEFINER'
);
select ok(
  (select p.proconfig @> array['search_path=""']::text[] from pg_catalog.pg_proc p
   where p.oid='public.respond_to_my_marketplace_offer(uuid,text,bigint,text)'::regprocedure),
  'offer response RPC has empty search_path'
);
select ok(
  not has_function_privilege('anon','public.make_my_marketplace_offer(uuid,bigint,text)','EXECUTE'),
  'anon cannot make offers'
);
select ok(
  not has_function_privilege('anon','public.respond_to_my_marketplace_offer(uuid,text,bigint,text)','EXECUTE'),
  'anon cannot respond to offers'
);
select ok(
  has_function_privilege('authenticated','public.make_my_marketplace_offer(uuid,bigint,text)','EXECUTE'),
  'authenticated buyer can call guarded make-offer RPC'
);
select ok(
  has_function_privilege('authenticated','public.respond_to_my_marketplace_offer(uuid,text,bigint,text)','EXECUTE'),
  'authenticated participant can call guarded response RPC'
);

select * from finish();
rollback;
