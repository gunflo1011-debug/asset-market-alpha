-- Hosted-schema compatibility/performance hardening.
-- Some existing projects still contain public.thing_attribute_values from the earlier
-- generic Thing schema. Keep clean rebuilds compatible by doing nothing when the table
-- is absent, while preserving the exact owner/category authorization semantics when present.
do $$
begin
  if to_regclass('public.thing_attribute_values') is null then
    return;
  end if;

  execute $policy$
    alter policy "owners read own thing attributes"
    on public.thing_attribute_values
    using (
      exists (
        select 1
        from public.items i
        where i.id = thing_attribute_values.item_id
          and i.owner_id = (select auth.uid())
      )
    )
  $policy$;

  execute $policy$
    alter policy "owners add own thing attributes"
    on public.thing_attribute_values
    with check (
      exists (
        select 1
        from public.items i
        join public.thing_attribute_definitions d
          on d.id = thing_attribute_values.definition_id
        where i.id = thing_attribute_values.item_id
          and i.owner_id = (select auth.uid())
          and d.category_id = i.category_id
      )
    )
  $policy$;

  execute $policy$
    alter policy "owners update own thing attributes"
    on public.thing_attribute_values
    using (
      exists (
        select 1
        from public.items i
        where i.id = thing_attribute_values.item_id
          and i.owner_id = (select auth.uid())
      )
    )
    with check (
      exists (
        select 1
        from public.items i
        join public.thing_attribute_definitions d
          on d.id = thing_attribute_values.definition_id
        where i.id = thing_attribute_values.item_id
          and i.owner_id = (select auth.uid())
          and d.category_id = i.category_id
      )
    )
  $policy$;

  execute $policy$
    alter policy "owners delete own thing attributes"
    on public.thing_attribute_values
    using (
      exists (
        select 1
        from public.items i
        where i.id = thing_attribute_values.item_id
          and i.owner_id = (select auth.uid())
      )
    )
  $policy$;
end
$$;
