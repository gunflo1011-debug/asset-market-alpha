create index if not exists item_images_owner_id_idx
  on private.item_images (owner_id);

create index if not exists marketplace_listings_source_variant_id_idx
  on private.marketplace_listings (source_variant_id);

create index if not exists marketplace_messages_sender_id_idx
  on private.marketplace_messages (sender_id);

create index if not exists marketplace_offers_parent_offer_id_idx
  on private.marketplace_offers (parent_offer_id);

create index if not exists marketplace_offers_proposer_id_idx
  on private.marketplace_offers (proposer_id);
