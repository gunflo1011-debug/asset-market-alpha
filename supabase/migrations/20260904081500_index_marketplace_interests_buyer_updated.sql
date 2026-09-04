create index if not exists marketplace_interests_buyer_updated_idx
  on private.marketplace_interests (buyer_id, updated_at desc);
