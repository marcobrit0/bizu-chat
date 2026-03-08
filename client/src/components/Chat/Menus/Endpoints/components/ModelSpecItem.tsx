import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { VisuallyHidden } from '@ariakit/react';
import type { TModelSpec } from 'librechat-data-provider';
import { CustomMenuItem as MenuItem } from '../CustomMenu';
import { useModelSelectorContext } from '../ModelSelectorContext';
import { useLocalize } from '~/hooks';
import SpecIcon from './SpecIcon';
import { cn } from '~/utils';

interface ModelSpecItemProps {
  spec: TModelSpec;
  isSelected: boolean;
}

export function ModelSpecItem({ spec, isSelected }: ModelSpecItemProps) {
  const localize = useLocalize();
  const { handleSelectSpec, endpointsConfig } = useModelSelectorContext();
  const { user } = useAuthContext();
  const { showIconInMenu = true } = spec;
  const isLocked = isModelSpecLocked(spec, user?.plan);
  return (
    <MenuItem
      key={spec.name}
      onClick={() => handleSelectSpec(spec)}
      aria-selected={isSelected || undefined}
      className={cn(
        'flex w-full items-center justify-between rounded-lg px-2 text-sm',
        isLocked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
      )}
    >
      <div
        className={cn(
          'flex w-full min-w-0 gap-2 px-1 py-1',
          spec.description ? 'items-start' : 'items-center',
        )}
      >
        {showIconInMenu && (
          <div className="flex-shrink-0">
            <SpecIcon currentSpec={spec} endpointsConfig={endpointsConfig} />
          </div>
        )}
        <div className="flex min-w-0 flex-col gap-1">
          <span className="truncate text-left">{spec.label}</span>
          {spec.description && (
            <span className="break-words text-xs font-normal">{spec.description}</span>
          )}
        </div>
      </div>
      {isLocked && (
        <span className="ml-auto mr-2 flex flex-shrink-0 items-center gap-1 rounded-full bg-yellow-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-yellow-400">
          <LockIcon className="size-3" />
          Premium
        </span>
      )}
      {isSelected && (
        <>
          <CheckCircle2
            className="size-4 shrink-0 self-center text-text-primary"
            aria-hidden="true"
          />
          <VisuallyHidden>{localize('com_a11y_selected')}</VisuallyHidden>
        </>
      )}
    </MenuItem>
  );
}

export function renderModelSpecs(specs: TModelSpec[], selectedSpec: string) {
  if (!specs || specs.length === 0) {
    return null;
  }

  return specs.map((spec) => (
    <ModelSpecItem key={spec.name} spec={spec} isSelected={selectedSpec === spec.name} />
  ));
}
