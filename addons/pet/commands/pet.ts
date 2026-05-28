import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import { PriyxCommand } from '../../../src/structures/Command';
import type { ModuleValue } from '../../../src/types/modules';
import {
	errorEmbed,
	primaryEmbed,
	successEmbed,
} from '../../../src/utils/embed';
import { pick, randomInt } from '../../../src/utils/random';
import { PetProfile } from '../database/models/PetProfile';

type PetRarity = 'common' | 'rare' | 'legendary';

interface PetStats {
	maxHunger: number;
	maxHappiness: number;
	decayAmount: number;
}

interface StoredPet {
	id: string;
	name: string;
	species: string;
	rarity: PetRarity;
	hunger: number;
	happiness: number;
	bornAt: number;
	lastFedAt: number;
	lastPlayedAt: number;
	updatedAt: number;
}

interface PetData {
	pets: StoredPet[];
	activePetId?: string;
	rolls: number;
}

const petSpecies: Record<PetRarity, string[]> = {
	common: ['Cat', 'Dog', 'Bunny', 'Hamster', 'Turtle'],
	rare: ['Fox', 'Owl', 'Panda', 'Axolotl'],
	legendary: ['Phoenix', 'Kitsune', 'Dragon', 'Griffin'],
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown, fallback: string): string {
	return typeof value === 'string' && value.trim() ? value : fallback;
}

function numberValue(value: unknown, fallback: number): number {
	return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

function configNumber(
	config: Record<string, ModuleValue>,
	key: string,
	fallback: number,
): number {
	return numberValue(config[key], fallback);
}

function resolveStats(config: Record<string, ModuleValue>): PetStats {
	const stats = isRecord(config.stats) ? config.stats : {};
	return {
		maxHunger: numberValue(stats.maxHunger, 100),
		maxHappiness: numberValue(stats.maxHappiness, 100),
		decayAmount: numberValue(stats.decayAmount, 5),
	};
}

function resolveRarity(config: Record<string, ModuleValue>): PetRarity {
	const rates = isRecord(config.gachaRates) ? config.gachaRates : {};
	const common = Math.max(0, numberValue(rates.common, 0.75));
	const rare = Math.max(0, numberValue(rates.rare, 0.2));
	const legendary = Math.max(0, numberValue(rates.legendary, 0.05));
	const total = common + rare + legendary || 1;
	const roll = Math.random() * total;

	if (roll < legendary) {
		return 'legendary';
	}

	if (roll < legendary + rare) {
		return 'rare';
	}

	return 'common';
}

function normalizePet(
	value: Record<string, unknown>,
	index: number,
	stats: PetStats,
): StoredPet {
	const rarity = ['common', 'rare', 'legendary'].includes(String(value.rarity))
		? (value.rarity as PetRarity)
		: 'common';
	const species = stringValue(value.species, petSpecies[rarity][0]);
	const bornAt = numberValue(value.bornAt, Date.now());

	return {
		id: stringValue(value.id, `pet-${index + 1}`),
		name: stringValue(value.name, species),
		species,
		rarity,
		hunger: clamp(
			numberValue(value.hunger, stats.maxHunger),
			0,
			stats.maxHunger,
		),
		happiness: clamp(
			numberValue(value.happiness, stats.maxHappiness),
			0,
			stats.maxHappiness,
		),
		bornAt,
		lastFedAt: numberValue(value.lastFedAt, 0),
		lastPlayedAt: numberValue(value.lastPlayedAt, 0),
		updatedAt: numberValue(value.updatedAt, bornAt),
	};
}

function profileData(profile: PetProfile, stats: PetStats): PetData {
	const raw = isRecord(profile.data) ? profile.data : {};
	const pets = Array.isArray(raw.pets)
		? raw.pets
				.filter(isRecord)
				.map((pet, index) => normalizePet(pet, index, stats))
		: [];
	const activePetId = stringValue(raw.activePetId, pets[0]?.id ?? '');

	return {
		pets,
		activePetId: activePetId || undefined,
		rolls: numberValue(raw.rolls, 0),
	};
}

function activePet(data: PetData): StoredPet | undefined {
	return (
		data.pets.find((pet) => pet.id === data.activePetId) ?? data.pets.at(0)
	);
}

function applyDecay(
	data: PetData,
	config: Record<string, ModuleValue>,
	stats: PetStats,
): boolean {
	const decaySeconds = Math.max(1, configNumber(config, 'decayInterval', 3600));
	const now = Date.now();
	let changed = false;

	for (const pet of data.pets) {
		const elapsed = now - Math.max(pet.updatedAt, pet.bornAt);
		const intervals = Math.floor(elapsed / (decaySeconds * 1000));
		if (intervals <= 0) {
			continue;
		}

		pet.hunger = clamp(
			pet.hunger - stats.decayAmount * intervals,
			0,
			stats.maxHunger,
		);
		pet.happiness = clamp(
			pet.happiness - stats.decayAmount * intervals,
			0,
			stats.maxHappiness,
		);
		pet.updatedAt = now;
		changed = true;
	}

	return changed;
}

function createPet(
	config: Record<string, ModuleValue>,
	stats: PetStats,
): StoredPet {
	const rarity = resolveRarity(config);
	const species = pick(petSpecies[rarity]);
	const now = Date.now();

	return {
		id: `${now.toString(36)}-${randomInt(1000, 9999)}`,
		name: species,
		species,
		rarity,
		hunger: stats.maxHunger,
		happiness: stats.maxHappiness,
		bornAt: now,
		lastFedAt: 0,
		lastPlayedAt: 0,
		updatedAt: now,
	};
}

function cooldownRemaining(
	lastUsedAt: number,
	cooldownSeconds: number,
): number {
	if (!lastUsedAt || cooldownSeconds <= 0) {
		return 0;
	}

	return Math.max(
		0,
		cooldownSeconds - Math.floor((Date.now() - lastUsedAt) / 1000),
	);
}

function formatPet(pet: StoredPet, stats: PetStats): string {
	return [
		`**${pet.name}** (${pet.rarity} ${pet.species})`,
		`Hunger: **${pet.hunger}/${stats.maxHunger}**`,
		`Happiness: **${pet.happiness}/${stats.maxHappiness}**`,
		`Adopted: <t:${Math.floor(pet.bornAt / 1000)}:R>`,
	].join('\n');
}

async function findOrCreateProfile(
	guildId: string,
	userId: string,
): Promise<PetProfile> {
	const existing = await PetProfile.findOne({ where: { guildId, userId } });
	if (existing) {
		return existing;
	}

	return PetProfile.create({ guildId, userId, data: { pets: [], rolls: 0 } });
}

async function saveProfile(profile: PetProfile, data: PetData): Promise<void> {
	profile.data = {
		pets: data.pets,
		activePetId: data.activePetId ?? null,
		rolls: data.rolls,
	};
	await profile.save();
}

export default new PriyxCommand({
	data: new SlashCommandBuilder()
		.setName('pet')
		.setDescription('Care for Priyx pets.')
		.addSubcommand((subcommand) =>
			subcommand.setName('status').setDescription('Show pet status.'),
		)
		.addSubcommand((subcommand) =>
			subcommand.setName('feed').setDescription('Feed your active pet.'),
		)
		.addSubcommand((subcommand) =>
			subcommand.setName('play').setDescription('Play with your active pet.'),
		)
		.addSubcommand((subcommand) =>
			subcommand.setName('gacha').setDescription('Roll for a pet.'),
		)
		.addSubcommand((subcommand) =>
			subcommand.setName('adopt').setDescription('Adopt a random pet.'),
		)
		.addSubcommand((subcommand) =>
			subcommand.setName('info').setDescription('Show pet info.'),
		),
	category: 'pet',
	addon: 'pet',
	async execute(interaction, client) {
		if (!interaction.guild) {
			await interaction.reply({
				embeds: [errorEmbed('Server only', 'Pet commands are server-scoped.')],
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		const subcommand = interaction.options.getSubcommand(true);
		const config = await client.guildModule(interaction.guild.id, 'pet');
		const stats = resolveStats(config);

		if (subcommand === 'info') {
			const rates = isRecord(config.gachaRates) ? config.gachaRates : {};
			await interaction.reply({
				embeds: [
					primaryEmbed(
						'Pet Info',
						[
							`Max pets: **${configNumber(config, 'maxPets', 3)}**`,
							`Feed cooldown: **${configNumber(config, 'feedCooldown', 300)}s**`,
							`Play cooldown: **${configNumber(config, 'playCooldown', 600)}s**`,
							`Rarity rates: **common ${Math.round(numberValue(rates.common, 0.75) * 100)}%**, **rare ${Math.round(numberValue(rates.rare, 0.2) * 100)}%**, **legendary ${Math.round(numberValue(rates.legendary, 0.05) * 100)}%**`,
							'Use `/pet gacha` to roll and `/pet status` to check your pets.',
						].join('\n'),
					),
				],
			});
			return;
		}

		const profile = await findOrCreateProfile(
			interaction.guild.id,
			interaction.user.id,
		);
		const data = profileData(profile, stats);
		const decayed = applyDecay(data, config, stats);

		if (subcommand === 'status') {
			if (decayed) {
				await saveProfile(profile, data);
			}

			await interaction.reply({
				embeds: [
					primaryEmbed(
						'Pet Status',
						data.pets.length
							? data.pets
									.map((pet, index) => `${index + 1}. ${formatPet(pet, stats)}`)
									.join('\n\n')
							: 'You do not have a pet yet. Use `/pet gacha` to roll one.',
					),
				],
			});
			return;
		}

		if (subcommand === 'gacha' || subcommand === 'adopt') {
			const maxPets = configNumber(config, 'maxPets', 3);
			if (data.pets.length >= maxPets) {
				if (decayed) {
					await saveProfile(profile, data);
				}

				await interaction.reply({
					embeds: [
						errorEmbed(
							'Pet limit reached',
							`You already have ${data.pets.length}/${maxPets} pets.`,
						),
					],
					flags: MessageFlags.Ephemeral,
				});
				return;
			}

			const pet = createPet(config, stats);
			data.pets.push(pet);
			data.activePetId = data.activePetId ?? pet.id;
			data.rolls += 1;
			await saveProfile(profile, data);

			await interaction.reply({
				embeds: [
					successEmbed(
						subcommand === 'gacha' ? 'Pet Gacha' : 'Pet Adopted',
						[
							`You got **${pet.name}**, a **${pet.rarity} ${pet.species}**.`,
							`Pets: **${data.pets.length}/${maxPets}**`,
						].join('\n'),
					),
				],
			});
			return;
		}

		const pet = activePet(data);
		if (!pet) {
			await interaction.reply({
				embeds: [
					errorEmbed('No pet', 'Use `/pet gacha` before caring for a pet.'),
				],
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		if (subcommand === 'feed') {
			const remaining = cooldownRemaining(
				pet.lastFedAt,
				configNumber(config, 'feedCooldown', 300),
			);
			if (remaining > 0) {
				if (decayed) {
					await saveProfile(profile, data);
				}

				await interaction.reply({
					embeds: [
						errorEmbed('Feed cooldown', `Try again in ${remaining} second(s).`),
					],
					flags: MessageFlags.Ephemeral,
				});
				return;
			}

			pet.hunger = stats.maxHunger;
			pet.lastFedAt = Date.now();
			pet.updatedAt = Date.now();
			await saveProfile(profile, data);
			await interaction.reply({
				embeds: [successEmbed('Pet Fed', `${pet.name}'s hunger is now full.`)],
			});
			return;
		}

		if (subcommand === 'play') {
			const remaining = cooldownRemaining(
				pet.lastPlayedAt,
				configNumber(config, 'playCooldown', 600),
			);
			if (remaining > 0) {
				if (decayed) {
					await saveProfile(profile, data);
				}

				await interaction.reply({
					embeds: [
						errorEmbed('Play cooldown', `Try again in ${remaining} second(s).`),
					],
					flags: MessageFlags.Ephemeral,
				});
				return;
			}

			pet.happiness = stats.maxHappiness;
			pet.lastPlayedAt = Date.now();
			pet.updatedAt = Date.now();
			await saveProfile(profile, data);
			await interaction.reply({
				embeds: [
					successEmbed('Pet Played', `${pet.name}'s happiness is now full.`),
				],
			});
		}
	},
});
