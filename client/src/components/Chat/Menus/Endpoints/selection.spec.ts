import { Constants, EModelEndpoint } from 'bizu-data-provider';
import type { Endpoint, SelectedValues } from '~/common';
import { getAutoSelection, isEndpointModelLocked, isModelSpecLocked } from './selection';

const NEW_CONVO_ID = String(Constants.NEW_CONVO);

describe('isEndpointModelLocked', () => {
  it('locks unsupported raw models for free users', () => {
    expect(
      isEndpointModelLocked(EModelEndpoint.openAI, 'deepseek/deepseek-r1', 'free'),
    ).toBe(true);
  });

  it('does not lock agent selections', () => {
    expect(isEndpointModelLocked(EModelEndpoint.agents, 'agent-123', 'free')).toBe(false);
  });
});

describe('getAutoSelection', () => {
  const specs = [
    {
      name: 'deepseek-v3',
      label: 'DeepSeek V3',
      preset: {
        endpoint: 'OpenRouter',
        model: 'deepseek/deepseek-chat-v3-0324',
      },
    },
    {
      name: 'deepseek-r1',
      label: 'DeepSeek R1',
      preset: {
        endpoint: 'OpenRouter',
        model: 'deepseek/deepseek-r1',
      },
    },
  ] as any;

  const openRouterEndpoint: Endpoint = {
    value: EModelEndpoint.openAI,
    label: 'OpenRouter',
    hasModels: true,
    models: [
      { name: 'deepseek/deepseek-chat-v3-0324' },
      { name: 'deepseek/deepseek-r1' },
    ],
    icon: null,
  };

  it('locks premium model specs for free users', () => {
    expect(isModelSpecLocked(specs[1], 'free')).toBe(true);
    expect(isModelSpecLocked(specs[0], 'free')).toBe(false);
  });

  it('prefers a free model spec on a new chat', () => {
    expect(
      getAutoSelection({
        conversationId: NEW_CONVO_ID,
        mappedEndpoints: [openRouterEndpoint],
        modelSpecs: specs,
        plan: 'free',
        selectedValues,
      }),
    ).toEqual({
      type: 'spec',
      spec: specs[0],
    });
  });

  const selectedValues: SelectedValues = {
    endpoint: '',
    model: '',
    modelSpec: '',
  };

  it('selects the free default model for a new chat', () => {
    expect(
      getAutoSelection({
        conversationId: NEW_CONVO_ID,
        mappedEndpoints: [openRouterEndpoint],
        modelSpecs: [],
        plan: 'free',
        selectedValues,
      }),
    ).toEqual({
      type: 'model',
      endpoint: openRouterEndpoint,
      model: 'deepseek/deepseek-chat-v3-0324',
    });
  });

  it('replaces an invalid carried-over endpoint with the first selectable model', () => {
    expect(
      getAutoSelection({
        conversationId: NEW_CONVO_ID,
        mappedEndpoints: [openRouterEndpoint],
        modelSpecs: [],
        plan: 'free',
        selectedValues: {
          endpoint: EModelEndpoint.agents,
          model: '',
          modelSpec: '',
        },
      }),
    ).toEqual({
      type: 'model',
      endpoint: openRouterEndpoint,
      model: 'deepseek/deepseek-chat-v3-0324',
    });
  });

  it('keeps an already valid selection unchanged', () => {
    expect(
      getAutoSelection({
        conversationId: NEW_CONVO_ID,
        mappedEndpoints: [openRouterEndpoint],
        modelSpecs: [],
        plan: 'free',
        selectedValues: {
          endpoint: EModelEndpoint.openAI,
          model: 'deepseek/deepseek-chat-v3-0324',
          modelSpec: '',
        },
      }),
    ).toBeNull();
  });

  it('replaces a locked selected spec with the free spec', () => {
    expect(
      getAutoSelection({
        conversationId: NEW_CONVO_ID,
        mappedEndpoints: [openRouterEndpoint],
        modelSpecs: specs,
        plan: 'free',
        selectedValues: {
          endpoint: 'OpenRouter',
          model: 'deepseek/deepseek-r1',
          modelSpec: 'deepseek-r1',
        },
      }),
    ).toEqual({
      type: 'spec',
      spec: specs[0],
    });
  });
});
