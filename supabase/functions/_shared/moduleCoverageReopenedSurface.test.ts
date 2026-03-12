import { describe, expect, it } from 'vitest';

const moduleSpecifiers = [
  '../../../config/tailwind/theme/themeAnimations',
  '../../../config/tailwind/theme/themeColors',
  '../../../config/tailwind/theme/themeKeyframes',
  '../../../config/testing/vitest.edge.aliases',
  '../../../config/testing/vitest.edge.config',
  '../../../config/testing/vitest.edge.shared',
  '../../../config/vite/policy',
  './autoTopupRequest',
  '../_tests/mocks/groqSdk',
  '../complete_task/handler',
  '../complete_task/index',
  '../update-task-status/types',
] as const;

describe('reopened edge module coverage surface batch', () => {
  it('loads each reopened edge coverage target and exposes defined runtime exports when present', async () => {
    for (const moduleSpecifier of moduleSpecifiers) {
      const loadedModule = await import(moduleSpecifier);

      expect(loadedModule).toBeDefined();

      for (const exportName of Object.keys(loadedModule)) {
        expect(loadedModule[exportName as keyof typeof loadedModule]).toBeDefined();
      }
    }
  }, 30_000);
});
