-- Legacy Marketplace RPCs remain in the schema for migration compatibility, but the
-- mobile client has moved to their v2 replacements. Remove signed-in client access
-- to the obsolete SECURITY DEFINER entry points while preserving service-role access.

revoke execute on function public.load_marketplace_v1() from authenticated;
revoke execute on function public.load_my_marketplace_listings() from authenticated;
revoke execute on function public.save_my_marketplace_listing(uuid, bigint, boolean) from authenticated;
revoke execute on function public.set_my_marketplace_conversation_status(uuid, text) from authenticated;
