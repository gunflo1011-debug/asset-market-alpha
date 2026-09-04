create policy "item_product_identifiers_owner_select"
on private.item_product_identifiers
for select
to authenticated
using (
  exists (
    select 1
    from public.items i
    where i.id = item_product_identifiers.item_id
      and i.owner_id = (select auth.uid())
  )
);

create policy "item_product_identifiers_owner_insert"
on private.item_product_identifiers
for insert
to authenticated
with check (
  exists (
    select 1
    from public.items i
    where i.id = item_product_identifiers.item_id
      and i.owner_id = (select auth.uid())
  )
);

create policy "item_product_identifiers_owner_update"
on private.item_product_identifiers
for update
to authenticated
using (
  exists (
    select 1
    from public.items i
    where i.id = item_product_identifiers.item_id
      and i.owner_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.items i
    where i.id = item_product_identifiers.item_id
      and i.owner_id = (select auth.uid())
  )
);

create policy "item_product_identifiers_owner_delete"
on private.item_product_identifiers
for delete
to authenticated
using (
  exists (
    select 1
    from public.items i
    where i.id = item_product_identifiers.item_id
      and i.owner_id = (select auth.uid())
  )
);
