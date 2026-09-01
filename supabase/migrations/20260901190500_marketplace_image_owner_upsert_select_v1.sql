-- Allow a seller to read only their own Marketplace image projection so deterministic
-- Storage upserts can update an existing object without weakening buyer visibility.
-- Buyer-facing reads remain restricted to selected images on PUBLISHED listings.

drop policy if exists marketplace_images_selected_read on storage.objects;
create policy marketplace_images_selected_read on storage.objects
for select to authenticated
using (
  bucket_id = 'marketplace-images'
  and (
    public.marketplace_image_object_access(name, false)
    or public.marketplace_image_object_access(name, true)
  )
);

comment on function public.marketplace_image_object_access(text,boolean) is
  'Marketplace image authorization helper. p_manage=true is restricted to the Thing/image owner; read access is allowed to that owner for safe deterministic upserts and to authenticated users only while the selected image belongs to a published listing.';
