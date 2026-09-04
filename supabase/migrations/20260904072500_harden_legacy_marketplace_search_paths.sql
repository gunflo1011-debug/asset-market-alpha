alter function public.load_interest_summary_for_my_listings() set search_path = '';
alter function public.load_my_marketplace_interests() set search_path = '';
alter function public.load_my_marketplace_listings() set search_path = '';
alter function public.set_my_marketplace_interest(uuid, boolean) set search_path = '';
alter function public.withdraw_my_marketplace_listing(uuid) set search_path = '';
