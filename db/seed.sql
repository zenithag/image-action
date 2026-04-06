-- Tenant demo
insert into tenants (id, name, slug, status, plan_code)
values (
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'Loja Revestimentos Demo',
  'loja-revestimentos',
  'active',
  'starter'
) on conflict (slug) do nothing;

-- Canal WhatsApp
insert into tenant_channels (id, tenant_id, channel_type, provider, external_session_id, status)
values (
  'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'whatsapp',
  'uazapi',
  'session-demo-001',
  'connected'
) on conflict do nothing;

-- Contato teste
insert into contacts (id, tenant_id, external_contact_id, display_name, phone)
values (
  'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  '5511999990000@s.whatsapp.net',
  'Cliente Teste',
  '+5511999990000'
) on conflict do nothing;

-- Contato 2
insert into contacts (id, tenant_id, external_contact_id, display_name, phone)
values (
  'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a34',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  '5511988880000@s.whatsapp.net',
  'Maria Oliveira',
  '+5511988880000'
) on conflict do nothing;

-- Contato 3
insert into contacts (id, tenant_id, external_contact_id, display_name, phone)
values (
  'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a35',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  '5511977770000@s.whatsapp.net',
  'Joao Santos',
  '+5511977770000'
) on conflict do nothing;

-- Conversa 1: collecting_preferences (AI)
insert into conversations (id, tenant_id, channel_id, contact_id, status, state, handled_by)
values (
  'd3eebc99-0001-4ef8-bb6d-6bb9bd380a01',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
  'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
  'open',
  'collecting_preferences',
  'ai'
) on conflict do nothing;

-- Conversa 2: composing (operador)
insert into conversations (id, tenant_id, channel_id, contact_id, status, state, handled_by)
values (
  'd3eebc99-0001-4ef8-bb6d-6bb9bd380a02',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
  'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a34',
  'open',
  'composing',
  'operator'
) on conflict do nothing;

-- Conversa 3: completed (AI)
insert into conversations (id, tenant_id, channel_id, contact_id, status, state, handled_by)
values (
  'd3eebc99-0001-4ef8-bb6d-6bb9bd380a03',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
  'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a35',
  'open',
  'completed',
  'ai'
) on conflict do nothing;

-- Mensagens da conversa 1
insert into messages (id, tenant_id, conversation_id, direction, role, content, content_type) values
  ('e4eebc99-0001-4ef8-bb6d-6bb9bd380001', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'd3eebc99-0001-4ef8-bb6d-6bb9bd380a01', 'inbound', 'customer', 'Oi, quero ver opcoes de revestimento para minha cozinha', 'text'),
  ('e4eebc99-0001-4ef8-bb6d-6bb9bd380002', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'd3eebc99-0001-4ef8-bb6d-6bb9bd380a01', 'outbound', 'assistant', 'Ola! Que tipo de revestimento voce procura? Temos porcelanato, ceramica e mosaicos.', 'text'),
  ('e4eebc99-0001-4ef8-bb6d-6bb9bd380003', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'd3eebc99-0001-4ef8-bb6d-6bb9bd380a01', 'inbound', 'customer', 'Porcelanato claro, estilo classico', 'text')
on conflict do nothing;

-- Mensagens da conversa 2
insert into messages (id, tenant_id, conversation_id, direction, role, content, content_type) values
  ('e4eebc99-0002-4ef8-bb6d-6bb9bd380001', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'd3eebc99-0001-4ef8-bb6d-6bb9bd380a02', 'inbound', 'customer', 'Boa tarde, quero aplicar esse porcelanato na minha sala', 'text'),
  ('e4eebc99-0002-4ef8-bb6d-6bb9bd380002', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'd3eebc99-0001-4ef8-bb6d-6bb9bd380a02', 'outbound', 'assistant', 'Perfeito! Me envie uma foto do ambiente e eu gero a composicao visual.', 'text'),
  ('e4eebc99-0002-4ef8-bb6d-6bb9bd380003', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'd3eebc99-0001-4ef8-bb6d-6bb9bd380a02', 'inbound', 'customer', '[Foto da sala]', 'image'),
  ('e4eebc99-0002-4ef8-bb6d-6bb9bd380004', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'd3eebc99-0001-4ef8-bb6d-6bb9bd380a02', 'outbound', 'assistant', 'Estou gerando a composicao, aguarde um momento...', 'text'),
  ('e4eebc99-0002-4ef8-bb6d-6bb9bd380005', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'd3eebc99-0001-4ef8-bb6d-6bb9bd380a02', 'outbound', 'operator', 'Oi Maria, aqui e o Pedro. Estou acompanhando seu pedido de composicao.', 'text')
on conflict do nothing;

-- Mensagens da conversa 3
insert into messages (id, tenant_id, conversation_id, direction, role, content, content_type) values
  ('e4eebc99-0003-4ef8-bb6d-6bb9bd380001', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'd3eebc99-0001-4ef8-bb6d-6bb9bd380a03', 'inbound', 'customer', 'Oi, quero ver o mosaico hexagonal aplicado no banheiro', 'text'),
  ('e4eebc99-0003-4ef8-bb6d-6bb9bd380002', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'd3eebc99-0001-4ef8-bb6d-6bb9bd380a03', 'outbound', 'assistant', 'Claro! Me envie a foto do banheiro.', 'text'),
  ('e4eebc99-0003-4ef8-bb6d-6bb9bd380003', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'd3eebc99-0001-4ef8-bb6d-6bb9bd380a03', 'inbound', 'customer', '[Foto do banheiro]', 'image'),
  ('e4eebc99-0003-4ef8-bb6d-6bb9bd380004', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'd3eebc99-0001-4ef8-bb6d-6bb9bd380a03', 'outbound', 'assistant', 'Aqui esta o resultado da composicao! O mosaico hexagonal ficou otimo no seu banheiro.', 'composition_result')
on conflict do nothing;

-- Categoria catalogo
insert into catalog_categories (id, tenant_id, name, sort_order)
values (
  'd3eebc99-9c0b-4ef8-bb6d-6bb9bd380a44',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'Revestimentos',
  1
) on conflict do nothing;

-- Itens catalogo (5 itens com tags variados)
insert into catalog_items (id, tenant_id, category_id, name, description, sku, tags) values
  ('e4eebc99-9c0b-4ef8-bb6d-6bb9bd380a55', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'd3eebc99-9c0b-4ef8-bb6d-6bb9bd380a44',
   'Porcelanato Carrara 60x60', 'Porcelanato polido inspirado em marmore de Carrara', 'PRC-001',
   '{"cor": "claro", "material": "porcelanato", "estilo": "classico", "marca": "Portinari"}'),
  ('e4eebc99-9c0b-4ef8-bb6d-6bb9bd380a56', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'd3eebc99-9c0b-4ef8-bb6d-6bb9bd380a44',
   'Ceramica Subway Branca', 'Ceramica retangular estilo metro para paredes', 'CER-002',
   '{"cor": "branco", "material": "ceramica", "estilo": "moderno", "marca": "Eliane"}'),
  ('e4eebc99-9c0b-4ef8-bb6d-6bb9bd380a57', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'd3eebc99-9c0b-4ef8-bb6d-6bb9bd380a44',
   'Mosaico Hexagonal Cinza', 'Mosaico hexagonal em tons de cinza para banheiros', 'MOS-003',
   '{"cor": "cinza", "material": "mosaico", "estilo": "contemporaneo", "marca": "Atlas"}'),
  ('e4eebc99-9c0b-4ef8-bb6d-6bb9bd380a58', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'd3eebc99-9c0b-4ef8-bb6d-6bb9bd380a44',
   'Porcelanato Madeira Carvalho', 'Porcelanato que reproduz madeira de carvalho', 'PRC-004',
   '{"cor": "madeira", "material": "porcelanato", "estilo": "rustico", "marca": "Portinari"}'),
  ('e4eebc99-9c0b-4ef8-bb6d-6bb9bd380a59', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'd3eebc99-9c0b-4ef8-bb6d-6bb9bd380a44',
   'Cimento Queimado Natural', 'Revestimento de cimento queimado para pisos e paredes', 'CIM-005',
   '{"cor": "cinza", "material": "cimento", "estilo": "industrial", "marca": "Bautech"}')
on conflict do nothing;

-- Asset fake para job de composicao
insert into assets (id, tenant_id, conversation_id, role, mime_type, storage_key) values
  ('f5eebc99-0001-4ef8-bb6d-6bb9bd380a01', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'd3eebc99-0001-4ef8-bb6d-6bb9bd380a03', 'base_image', 'image/jpeg', 'tenants/a0eebc99/conversations/d3eebc99-03/base.jpg')
on conflict do nothing;

-- Job de composicao (done)
insert into composition_jobs (id, tenant_id, conversation_id, mode, status, base_asset_id) values
  ('f6eebc99-0001-4ef8-bb6d-6bb9bd380a01', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'd3eebc99-0001-4ef8-bb6d-6bb9bd380a03', 'interior', 'done', 'f5eebc99-0001-4ef8-bb6d-6bb9bd380a01')
on conflict do nothing;
