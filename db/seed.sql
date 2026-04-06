insert into tenants (id, name, slug, status, plan_code)
values (
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'Loja Revestimentos Demo',
  'loja-revestimentos',
  'active',
  'starter'
) on conflict (slug) do nothing;

insert into tenant_channels (id, tenant_id, channel_type, provider, external_session_id, status)
values (
  'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'whatsapp',
  'uazapi',
  'session-demo-001',
  'connected'
) on conflict do nothing;

insert into contacts (id, tenant_id, external_contact_id, display_name, phone)
values (
  'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  '5511999990000@s.whatsapp.net',
  'Cliente Teste',
  '+5511999990000'
) on conflict do nothing;

insert into catalog_categories (id, tenant_id, name, sort_order)
values (
  'd3eebc99-9c0b-4ef8-bb6d-6bb9bd380a44',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'Revestimentos',
  1
) on conflict do nothing;

insert into catalog_items (id, tenant_id, category_id, name, description, tags)
values (
  'e4eebc99-9c0b-4ef8-bb6d-6bb9bd380a55',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'd3eebc99-9c0b-4ef8-bb6d-6bb9bd380a44',
  'Porcelanato Carrara 60x60',
  'Porcelanato polido inspirado em marmore de Carrara',
  '{"cor": "claro", "material": "porcelanato", "estilo": "classico", "marca": "Portinari", "dimensao": "60x60"}'
) on conflict do nothing;
