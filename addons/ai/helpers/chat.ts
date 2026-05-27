import type { PriyxClient } from '../../../src/client';
import type { AiModuleConfig } from '../../../src/types/modules';
import { AiConversation, type AiStoredMessage } from '../database/models/AiConversation';
import { completeChat, defaultGeminiModel, normalizeGeminiModel } from './gemini';

const defaultSystemPrompt = 'You are Priyx, a helpful Discord assistant.';
const maxKnowledgeChars = 12_000;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function numberSetting(value: unknown, key: string, fallback: number): number {
	if (!isRecord(value)) {
		return fallback;
	}

	const parsed = Number(value[key] ?? fallback);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function historyLimit(value: unknown): number {
	return Math.max(2, Math.min(100, numberSetting(value, 'maxMessages', 20)));
}

function historyTtl(value: unknown): number {
	return Math.max(60, numberSetting(value, 'ttl', 3600));
}

function trimBlock(value: unknown, limit = maxKnowledgeChars): string {
	if (typeof value !== 'string') {
		return '';
	}

	return value.replace(/\s+\n/g, '\n').trim().slice(0, limit);
}

function knowledgeContext(config: AiModuleConfig): string {
	const sections: string[] = [];
	const base = trimBlock(config.knowledgeBase, 4000);
	if (base) {
		sections.push(`Pinned server knowledge\n${base}`);
	}

	for (const document of config.knowledgeDocuments ?? []) {
		if (document?.enabled === false) {
			continue;
		}

		const content = trimBlock(document?.content, 5000);
		if (!content) {
			continue;
		}

		const title = trimBlock(document?.title || document?.source || 'Knowledge source', 120);
		sections.push(`${title}\n${content}`);
	}

	return sections.join('\n\n---\n\n').slice(0, maxKnowledgeChars);
}

function systemPrompt(config: AiModuleConfig, includeKnowledge = true): string {
	const base = trimBlock(config.systemPrompt) || defaultSystemPrompt;
	const knowledge = includeKnowledge ? knowledgeContext(config) : '';
	if (!knowledge) {
		return base;
	}

	return [
		base,
		'Use the following server support knowledge when it is relevant. Do not invent server facts that are not in this knowledge.',
		knowledge,
	].join('\n\n');
}

async function getConversation(guildId: string, userId: string): Promise<AiConversation> {
	const [conversation] = await AiConversation.findOrCreate({
		where: { guildId, userId },
		defaults: { guildId, userId, messages: [] },
	});
	return conversation;
}

export async function forgetAiHistory(
	client: PriyxClient,
	guildId: string,
	userId: string,
): Promise<void> {
	await AiConversation.destroy({
		where: { guildId, userId },
	});
	await client.cache.delete(`ai:history:${guildId}:${userId}`);
}

export async function runAiChat({
	client,
	config,
	guildId,
	includeKnowledge = true,
	prompt,
	userId,
}: {
	client: PriyxClient;
	config: AiModuleConfig;
	guildId: string;
	includeKnowledge?: boolean;
	prompt: string;
	userId: string;
}): Promise<string> {
	const conversation = await getConversation(guildId, userId);
	const existingMessages = (conversation.messages ?? []) as AiStoredMessage[];
	const reply = await completeChat({
		model: normalizeGeminiModel(config.model ?? defaultGeminiModel),
		systemPrompt: systemPrompt(config, includeKnowledge),
		maxTokens: config.maxTokens ?? 500,
		messages: existingMessages,
		prompt,
	});

	const nextMessages: AiStoredMessage[] = [
		...existingMessages,
		{ role: 'user' as const, content: prompt, at: Date.now() },
		{ role: 'assistant' as const, content: reply, at: Date.now() },
	].slice(-historyLimit(config.history));

	conversation.messages = nextMessages;
	await conversation.save();
	await client.cache.set(
		`ai:history:${guildId}:${userId}`,
		nextMessages,
		historyTtl(config.history),
	);

	return reply;
}

export function aiSettingsDescription(config: AiModuleConfig): string {
	const documentCount = (config.knowledgeDocuments ?? []).filter(
		(document) => document?.enabled !== false && trimBlock(document?.content, 1),
	).length;
	const configuredModel = String(config.model ?? '').replace(/^models\//, '');
	const activeModel = normalizeGeminiModel(config.model ?? defaultGeminiModel);
	const modelNote =
		configuredModel && configuredModel !== activeModel
			? ` fallback from ${configuredModel}`
			: '';
	return [
		`Model: **${activeModel}**${modelNote}`,
		`Max tokens: **${config.maxTokens ?? 500}**`,
		`Support channel: **${config.supportChannel ? `<#${config.supportChannel}>` : 'not configured'}**`,
		`Knowledge sources: **${documentCount}**`,
		`History TTL: **${historyTtl(config.history)} seconds**`,
	].join('\n');
}

export function formatAiReply(reply: string): string {
	return reply.length > 3900 ? `${reply.slice(0, 3900)}\n\n...` : reply;
}
