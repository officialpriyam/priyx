import type { AiStoredMessage } from '../database/models/AiConversation';

export interface ChatCompletionOptions {
	model: string;
	systemPrompt: string;
	maxTokens: number;
	messages: AiStoredMessage[];
	prompt: string;
}

interface GeminiGenerateResponse {
	candidates?: Array<{
		content?: {
			parts?: Array<{
				text?: string;
			}>;
		};
		finishReason?: string;
	}>;
	error?: {
		message?: string;
	};
}

function modelPath(model: string): string {
	return model.startsWith('models/') ? model : `models/${model}`;
}

function geminiRole(role: AiStoredMessage['role']): 'user' | 'model' {
	return role === 'assistant' ? 'model' : 'user';
}

export async function completeChat(
	options: ChatCompletionOptions,
): Promise<string> {
	const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GEMINI_API_KEY;
	if (!apiKey) {
		throw new Error('GEMINI_API_KEY is not configured.');
	}

	const response = await fetch(
		`https://generativelanguage.googleapis.com/v1beta/${modelPath(options.model)}:generateContent`,
		{
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'x-goog-api-key': apiKey,
			},
			body: JSON.stringify({
				systemInstruction: {
					parts: [{ text: options.systemPrompt }],
				},
				contents: [
					...options.messages.map((message) => ({
						role: geminiRole(message.role),
						parts: [{ text: message.content }],
					})),
					{
						role: 'user',
						parts: [{ text: options.prompt }],
					},
				],
				generationConfig: {
					maxOutputTokens: options.maxTokens,
				},
			}),
		},
	);

	const payload = (await response.json()) as GeminiGenerateResponse;
	if (!response.ok) {
		throw new Error(payload.error?.message ?? `Gemini request failed with ${response.status}.`);
	}

	const content = payload.candidates?.[0]?.content?.parts
		?.map((part) => part.text ?? '')
		.join('')
		.trim();
	if (!content) {
		throw new Error(
			payload.candidates?.[0]?.finishReason
				? `Gemini returned no text. Finish reason: ${payload.candidates[0].finishReason}.`
				: 'Gemini returned an empty response.',
		);
	}

	return content;
}
