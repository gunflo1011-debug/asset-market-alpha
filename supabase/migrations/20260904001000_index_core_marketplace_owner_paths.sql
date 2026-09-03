create index if not exists marketplace_buyer_adoptions_buyer_idx
  on private.marketplace_buyer_adoptions (buyer_id);

create index if not exists marketplace_listings_seller_idx
  on private.marketplace_listings (seller_id);
