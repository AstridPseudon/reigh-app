INSERT INTO task_types (
  name,
  run_type,
  category,
  display_name,
  description,
  base_cost_per_second,
  billing_type,
  unit_cost,
  tool_type,
  content_type,
  is_active,
  is_visible,
  supports_progress
) VALUES (
  'flux_klein_edit',
  'api',
  'generation',
  'FLUX Klein Image Edit',
  'Image-to-image editing via FLUX.2 Klein models from Black Forest Labs',
  0.0,
  'per_unit',
  0.0100,
  'magic-edit',
  'image',
  true,
  true,
  true
)
ON CONFLICT (name) DO NOTHING;
