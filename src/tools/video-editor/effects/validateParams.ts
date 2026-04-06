import type { ParameterDefinition, ParameterSchema } from '@/tools/video-editor/types';

const COLOR_RE = /^#[0-9a-f]{3,8}$/i;

const getFallbackValue = (parameter: ParameterDefinition): number | string | boolean => {
  if (parameter.default !== undefined) return parameter.default;
  if (parameter.type === 'number') return parameter.min ?? 0;
  if (parameter.type === 'select') return parameter.options?.[0]?.value ?? '';
  if (parameter.type === 'boolean') return false;
  if (parameter.type === 'color') return '#000000';
  return '';
};

export function validateAndCoerceParams(
  params: Record<string, unknown> | undefined,
  schema: ParameterSchema | undefined,
): Record<string, unknown> {
  if (!schema?.length) return params ?? {};
  return schema.reduce<Record<string, unknown>>((result, parameter) => {
    const fallback = getFallbackValue(parameter);
    const value = params?.[parameter.name];
    if (parameter.type === 'number') {
      result[parameter.name] = typeof value === 'number' && Number.isFinite(value)
        ? Math.min(parameter.max ?? value, Math.max(parameter.min ?? value, value))
        : fallback;
    } else if (parameter.type === 'boolean') {
      result[parameter.name] = typeof value === 'boolean' ? value : fallback;
    } else if (parameter.type === 'select') {
      result[parameter.name] = typeof value === 'string' && (parameter.options ?? []).some((option) => option.value === value) ? value : fallback;
    } else {
      result[parameter.name] = typeof value === 'string' && COLOR_RE.test(value) ? value : fallback;
    }
    return result;
  }, { ...(params ?? {}) });
}
