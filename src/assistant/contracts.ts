import type { ComponentType } from 'react';

export type AssistantAccess = 'loading' | 'allowed' | 'paused' | 'forbidden';

export interface AssistantPageObject {
  objectType: string;
  objectId: string;
}

export interface AssistantInvocationRequest {
  route: string;
  object_type: string | null;
  object_id: string | null;
}

export interface AssistantClient {
  invoke(context: AssistantInvocationRequest, signal: AbortSignal): Promise<void>;
}

export interface AssistantChatProps {
  context: AssistantInvocationRequest;
}

export interface AssistantProviderProps {
  access: AssistantAccess;
  route: string;
  client: AssistantClient;
  Chat: ComponentType<AssistantChatProps>;
  objectLabels?: Readonly<Record<string, string>>;
}

export class AssistantUnavailableError extends Error {
  constructor() {
    super('Assistant is unavailable for this session.');
    this.name = 'AssistantUnavailableError';
  }
}

export function createAssistantClient(endpoint = '/api/assistant/invoke'): AssistantClient {
  if (!/^\/(?!\/)[^\s\\]*$/.test(endpoint)) {
    throw new Error('Assistant endpoint must be a same-origin path.');
  }

  return {
    async invoke(context, signal) {
      const payload: AssistantInvocationRequest = {
        route: context.route,
        object_type: context.object_type,
        object_id: context.object_id,
      };
      const response = await fetch(endpoint, {
        method: 'POST',
        credentials: 'same-origin',
        redirect: 'error',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal,
      });

      if ([401, 403, 423].includes(response.status)) throw new AssistantUnavailableError();
      if (!response.ok) throw new Error(`Assistant request failed (${response.status}).`);
    },
  };
}

export function contextForRoute(route: string, object?: AssistantPageObject): AssistantInvocationRequest {
  const pathname = route.split(/[?#]/, 1)[0];
  const safeRoute = /^\/(?!\/)[^\s\\]*$/.test(pathname) ? pathname : '/';

  return {
    route: safeRoute,
    object_type: object?.objectType ?? null,
    object_id: object?.objectId ?? null,
  };
}
