-- Defense-in-depth hardening for the owner-scoped metadata update RPC.
-- Keep SECURITY DEFINER because authenticated has no direct UPDATE grant on public.items,
-- but remove mutable schema resolution from the privileged execution context.

alter function public.update_private_item_metadata(uuid, text, text, text, text)
  set search_path = '';
