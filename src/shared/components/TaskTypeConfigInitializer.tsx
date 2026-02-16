import type { ReactNode } from 'react';
import { useAllTaskTypesConfig } from '@/shared/hooks/useTaskType';

export const TaskTypeConfigInitializer = ({ children }: { children?: ReactNode }) => {
  useAllTaskTypesConfig();
  return <>{children}</>;
};
