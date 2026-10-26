import {
  AssistantChatRequest,
  AssistantChatResponse,
  AssistantConversation,
} from '../types/rag';

export async function sendAssistantMessage(
  payload: AssistantChatRequest
): Promise<AssistantChatResponse> {
  const res = await fetch('/api/assistant/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Server responded with status ${res.status}`);
  }

  return res.json();
}

export async function fetchAssistantConversations(): Promise<
  { id: string; title: string; messageCount: number; updatedAt: string }[]
> {
  const res = await fetch('/api/assistant/conversations');
  if (!res.ok) throw new Error('Failed to fetch conversation list');
  return res.json();
}

export async function fetchAssistantConversation(
  id: string
): Promise<AssistantConversation> {
  const res = await fetch(`/api/assistant/conversations/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error('Failed to fetch conversation');
  return res.json();
}

export async function deleteAssistantConversation(id: string): Promise<void> {
  const res = await fetch(`/api/assistant/conversations/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete conversation');
}

export async function clearAllAssistantConversations(): Promise<void> {
  const res = await fetch('/api/assistant/conversations/all', {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to clear conversations');
}
