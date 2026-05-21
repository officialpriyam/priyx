import type { AiStoredMessage } from '../database/models/AiConversation';

export interface ChatCompletionOptions {
	model: string;
	systemPrompt: string;
	maxTokens: number;
	messages: AiStoredMessage[];
	prompt: string;
}

interface OpenAIChatCompletionResponse {
	choices?: Array<{
		message?: {
			content?: string;
		};
	}>;
	error?: {
		message?: string;
	};
}

export async function completeChat(
	options: ChatCompletionOptions,
): Promise<string> {
	const apiKey = process.env.OPENAI_API_KEY;
	if (!apiKey) {
		throw new Error('OPENAI_API_KEY is not configured.');
	}

	const response = await fetch('https://api.openai.com/v1/chat/completions', {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${apiKey}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			model: options.model,
			max_tokens: options.maxTokens,
			messages: [
				{ role: 'system', content: options.systemPrompt },
				...options.messages.map((message) => ({
					role: message.role,
					content: message.content,
				})),
				{ role: 'user', content: options.prompt },
			],
		}),
	});

	const payload = (await response.json()) as OpenAIChatCompletionResponse;
	if (!response.ok) {
		throw new Error(payload.error?.message ?? `OpenAI request failed with ${response.status}.`);
	}

	const content = payload.choices?.[0]?.message?.content?.trim();
	if (!content) {
		throw new Error('OpenAI returned an empty response.');
	}

	return content;
}
