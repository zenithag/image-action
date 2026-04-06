# Data Model

## Entidades principais

### Tenant

- `id`
- `name`
- `slug`
- `status`
- `plan_code`
- `created_at`

### TenantDomain

- `id`
- `tenant_id`
- `hostname`
- `is_primary`
- `status`
- `verified_at`

### TenantChannel

- `id`
- `tenant_id`
- `channel_type`
- `provider`
- `external_session_id`
- `status`

### LlmProfile

- `id`
- `tenant_id`
- `provider`
- `default_model`
- `fallback_model`
- `system_prompt`
- `guardrail_config`

### Contact

- `id`
- `tenant_id`
- `external_contact_id`
- `display_name`
- `phone`

### Conversation

- `id`
- `tenant_id`
- `channel_id`
- `contact_id`
- `status`
- `last_message_at`

### Message

- `id`
- `tenant_id`
- `conversation_id`
- `direction`
- `role`
- `content`
- `provider_message_id`
- `created_at`

### Asset

- `id`
- `tenant_id`
- `conversation_id`
- `role`
- `mime_type`
- `storage_key`
- `metadata_json`

### CompositionJob

- `id`
- `tenant_id`
- `conversation_id`
- `mode`
- `status`
- `input_payload`
- `review_required`
- `created_at`

### Render

- `id`
- `tenant_id`
- `job_id`
- `asset_id`
- `version`
- `score`

### UsageEvent

- `id`
- `tenant_id`
- `kind`
- `provider`
- `reference_id`
- `quantity`
- `unit_cost`
- `total_cost`
- `metadata_json`

## Observacoes

- `tenant_id` deve existir em todas as tabelas operacionais
- `Conversation`, `Message`, `Asset` e `CompositionJob` formam o nucleo do fluxo do MVP
