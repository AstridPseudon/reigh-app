import { Filter } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Checkbox } from '@/shared/components/ui/checkbox';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/shared/components/ui/popover';
import {
  getVisibleTaskLogFilterDescriptors,
  type TaskLogFilterDescriptor,
} from '../taskLogFilterDescriptors';
import type {
  TaskLogArrayFilterKey,
  TaskLogAvailableFilters,
  TaskLogFilters as TaskLogFiltersType,
} from '../types';

interface TaskLogFiltersProps {
  filters: TaskLogFiltersType;
  availableFilters: TaskLogAvailableFilters | undefined;
  filterCount: number;
  onUpdateFilter: <K extends keyof TaskLogFiltersType>(filterType: K, value: TaskLogFiltersType[K]) => void;
  onToggleArrayFilter: (filterType: TaskLogArrayFilterKey, value: string) => void;
  onClearFilters: () => void;
}

function TaskLogFilterToolbarLabel() {
  return (
    <>
      <Filter className="w-4 h-4 text-muted-foreground" />
      <span className="text-sm font-light text-foreground">Filter by:</span>
    </>
  );
}

function MultiSelectFilterPopover(props: {
  descriptor: Extract<TaskLogFilterDescriptor, { kind: 'multi' }>;
  filters: TaskLogFiltersType;
  availableFilters: TaskLogAvailableFilters | undefined;
  onUpdateFilter: <K extends keyof TaskLogFiltersType>(filterType: K, value: TaskLogFiltersType[K]) => void;
  onToggleArrayFilter: (filterType: TaskLogArrayFilterKey, value: string) => void;
}) {
  const { descriptor, filters, availableFilters, onUpdateFilter, onToggleArrayFilter } = props;
  const selectedValues = filters[descriptor.key];
  const options = descriptor.getOptions(availableFilters);
  const badgeCount = descriptor.badgeCount(filters);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8">
          {descriptor.label}
          {badgeCount > 0 && (
            <Badge variant="secondary" className="ml-2 h-5 w-5 p-0 text-xs flex items-center justify-center">
              {badgeCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className={`${descriptor.widthClass} mx-2`} align="start">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <h4 className="font-light text-sm">{descriptor.title}</h4>
            {badgeCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onUpdateFilter(descriptor.key, descriptor.clearValue)}
                className="h-6 px-2 text-xs"
              >
                Clear
              </Button>
            )}
          </div>
          <div className="flex items-center gap-x-2 pb-1 border-b">
            <Checkbox
              id={`${descriptor.key}-all`}
              checked={selectedValues.length === 0}
              onCheckedChange={() => onUpdateFilter(descriptor.key, descriptor.clearValue)}
            />
            <label htmlFor={`${descriptor.key}-all`} className="text-sm cursor-pointer font-light">
              {descriptor.allLabel(availableFilters)}
            </label>
          </div>
          {options.map((option) => (
            <div key={option.value} className="flex items-center gap-x-2">
              <Checkbox
                id={`${descriptor.key}-${option.value}`}
                checked={selectedValues.includes(option.value)}
                onCheckedChange={() => onToggleArrayFilter(descriptor.key, option.value)}
              />
              <label htmlFor={`${descriptor.key}-${option.value}`} className="text-sm cursor-pointer">
                {option.label}
              </label>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function RadioFilterPopover(props: {
  descriptor: Extract<TaskLogFilterDescriptor, { kind: 'radio' }>;
  filters: TaskLogFiltersType;
  onUpdateFilter: <K extends keyof TaskLogFiltersType>(filterType: K, value: TaskLogFiltersType[K]) => void;
}) {
  const { descriptor, filters, onUpdateFilter } = props;
  const badgeCount = descriptor.badgeCount(filters);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8">
          {descriptor.label}
          {badgeCount > 0 && (
            <Badge variant="secondary" className="ml-2 h-5 w-5 p-0 text-xs flex items-center justify-center">
              {badgeCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className={`${descriptor.widthClass} mx-2`} align="start">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <h4 className="font-light text-sm">{descriptor.title}</h4>
            {badgeCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onUpdateFilter(descriptor.key, descriptor.clearValue)}
                className="h-6 px-2 text-xs"
              >
                Clear
              </Button>
            )}
          </div>
          <div className="space-y-1.5">
            {descriptor.options.map((option) => (
              <div key={option.value} className="flex items-center gap-x-2">
                <input
                  type="radio"
                  id={`${descriptor.key}-${option.value}`}
                  name={`${descriptor.key}-filter`}
                  checked={filters.costFilter === option.value}
                  onChange={() => onUpdateFilter(descriptor.key, option.value)}
                  className="w-4 h-4"
                />
                <label htmlFor={`${descriptor.key}-${option.value}`} className="text-sm cursor-pointer">
                  {option.label}
                </label>
              </div>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function TaskLogFilters({
  filters,
  availableFilters,
  filterCount,
  onUpdateFilter,
  onToggleArrayFilter,
  onClearFilters,
}: TaskLogFiltersProps) {
  const descriptors = getVisibleTaskLogFilterDescriptors(availableFilters);

  return (
    <div className="p-4 bg-muted rounded-lg border border-border space-y-3 sm:space-y-0 mt-1 mb-6">
      <div className="flex items-center gap-2 sm:hidden">
        <TaskLogFilterToolbarLabel />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="hidden sm:flex items-center gap-2">
          <TaskLogFilterToolbarLabel />
        </div>

        {descriptors.map((descriptor) => (
          descriptor.kind === 'radio' ? (
            <RadioFilterPopover
              key={descriptor.key}
              descriptor={descriptor}
              filters={filters}
              onUpdateFilter={onUpdateFilter}
            />
          ) : (
            <MultiSelectFilterPopover
              key={descriptor.key}
              descriptor={descriptor}
              filters={filters}
              availableFilters={availableFilters}
              onUpdateFilter={onUpdateFilter}
              onToggleArrayFilter={onToggleArrayFilter}
            />
          )
        ))}

        {filterCount > 0 && (
          <Button variant="ghost" size="sm" onClick={onClearFilters} className="h-8 text-gray-500">
            Clear ({filterCount})
          </Button>
        )}
      </div>
    </div>
  );
}
