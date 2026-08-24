-- Disposable CI/local fixture only.
insert into auth.users(id,aud,role,email,encrypted_password,created_at,updated_at)
values
('00000000-0000-0000-0000-000000000101','authenticated','authenticated','owner-ci@example.invalid','',now(),now()),
('00000000-0000-0000-0000-000000000201','authenticated','authenticated','buyer-a-ci@example.invalid','',now(),now()),
('00000000-0000-0000-0000-000000000202','authenticated','authenticated','buyer-b-ci@example.invalid','',now(),now())
on conflict(id) do nothing;

insert into public.products(id,brand,family)
values('00000000-0000-0000-0000-000000000301','Apple','iPhone 15 Pro')
on conflict(id) do nothing;

insert into public.product_variants(id,product_id,storage_gb,region)
values('00000000-0000-0000-0000-000000000302','00000000-0000-0000-0000-000000000301',256,'EU')
on conflict(id) do nothing;

insert into public.items(id,owner_id,variant_id,color,display_name,category_id)
values(
  '00000000-0000-0000-0000-000000000401',
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000302',
  'Natural Titanium',
  'Apple iPhone 15 Pro',
  (select id from public.thing_categories where key='electronics.phone')
)
on conflict(id) do nothing;

insert into public.condition_snapshots(id,item_id,purpose,display_state,housing_state,cameras_working,biometrics_working,battery_health,network_locked,other_defect)
values('00000000-0000-0000-0000-000000000402','00000000-0000-0000-0000-000000000401','PORTFOLIO','INTACT','LIGHT_WEAR',true,true,88,false,false)
on conflict(id) do nothing;

insert into private.item_market_state(item_id,market_state,possession_status)
values('00000000-0000-0000-0000-000000000401','MARKET_ELIGIBLE','VERIFIED')
on conflict(item_id) do update set market_state='MARKET_ELIGIBLE',possession_status='VERIFIED';

insert into private.buyer_intents(id,buyer_id,variant_id,max_price_cents,min_battery,require_intact_display,require_biometrics,status)
values
('00000000-0000-0000-0000-000000000501','00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000302',65000,85,true,true,'ACTIVE'),
('00000000-0000-0000-0000-000000000502','00000000-0000-0000-0000-000000000202','00000000-0000-0000-0000-000000000302',67000,85,true,true,'ACTIVE')
on conflict(id) do update set status='ACTIVE';
