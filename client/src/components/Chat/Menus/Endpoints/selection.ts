import { Constants, isAgentsEndpoint, isAssistantsEndpoint } from 'bizu-data-provider';
import type { TModelSpec } from 'bizu-data-provider';
import type { Endpoint, SelectedValues } from '~/common';
import { getPreferredModelForPlan, isModelAllowedForPlan } from '~/utils/planModels';

type AutoSelectionParams = {
  conversationId?: string | null;
  mappedEndpoints: Endpoint[];
  modelSpecs: TModelSpec[];
  plan?: string;
  selectedValues: SelectedValues;
};

export type AutoSelectionResult =
  | { type: 'spec'; spec: TModelSpec }
  | { type: 'endpoint'; endpoint: Endpoint }
  | { type: 'model'; endpoint: Endpoint; model: string }
  | null;

export function isModelSpecLocked(spec: TModelSpec, plan?: string): boolean {
  const endpointValue = spec.preset?.endpoint;
  const modelId = spec.preset?.model;

  if (!endpointValue || !modelId) {
    return false;
  }

  return isEndpointModelLocked(endpointValue, modelId, plan);
}

function getPreferredSpec(modelSpecs: TModelSpec[], plan?: string): TModelSpec | null {
  for (const spec of modelSpecs) {
    if (!isModelSpecLocked(spec, plan)) {
      return spec;
    }
  }

  return null;
}

export function isEndpointModelLocked(
  endpointValue: string | null | undefined,
  modelId: string | null | undefined,
  plan?: string,
): boolean {
  if (!endpointValue || !modelId) {
    return false;
  }

  if (isAgentsEndpoint(endpointValue) || isAssistantsEndpoint(endpointValue)) {
    return false;
  }

  return !isModelAllowedForPlan(plan, modelId);
}

function getSelectableModel(endpoint: Endpoint, plan?: string): string | null {
  const availableModels = endpoint.models?.map((model) => model.name).filter(Boolean) ?? [];

  if (availableModels.length === 0) {
    return null;
  }

  if (isAgentsEndpoint(endpoint.value) || isAssistantsEndpoint(endpoint.value)) {
    return availableModels[0] ?? null;
  }

  return getPreferredModelForPlan(plan, availableModels);
}

export function getAutoSelection({
  conversationId,
  mappedEndpoints,
  modelSpecs,
  plan,
  selectedValues,
}: AutoSelectionParams): AutoSelectionResult {
  if (conversationId !== Constants.NEW_CONVO) {
    return null;
  }

  if (selectedValues.modelSpec) {
    const selectedSpec = modelSpecs.find((spec) => spec.name === selectedValues.modelSpec);

    if (selectedSpec && !isModelSpecLocked(selectedSpec, plan)) {
      return null;
    }
  }

  const preferredSpec = getPreferredSpec(modelSpecs, plan);
  if (preferredSpec && preferredSpec.name !== selectedValues.modelSpec) {
    return {
      type: 'spec',
      spec: preferredSpec,
    };
  }

  const selectedEndpoint = mappedEndpoints.find((endpoint) => endpoint.value === selectedValues.endpoint);

  if (selectedEndpoint) {
    if (selectedEndpoint.hasModels) {
      const selectedModelExists = selectedEndpoint.models?.some(
        (model) => model.name === selectedValues.model,
      );
      const selectedModelLocked = isEndpointModelLocked(
        selectedEndpoint.value,
        selectedValues.model,
        plan,
      );

      if (selectedModelExists && !selectedModelLocked) {
        return null;
      }

      const fallbackModel = getSelectableModel(selectedEndpoint, plan);
      if (fallbackModel && fallbackModel !== selectedValues.model) {
        return {
          type: 'model',
          endpoint: selectedEndpoint,
          model: fallbackModel,
        };
      }
    }
  }

  for (const endpoint of mappedEndpoints) {
    const model = getSelectableModel(endpoint, plan);
    if (model) {
      return {
        type: 'model',
        endpoint,
        model,
      };
    }
  }

  for (const endpoint of mappedEndpoints) {
    if (!endpoint.hasModels) {
      return {
        type: 'endpoint',
        endpoint,
      };
    }
  }

  return null;
}
