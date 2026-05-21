export type TranslationVariables = Record<string, string | number | boolean>;

export function interpolate(
	template: string,
	variables: TranslationVariables = {},
): string {
	return template.replace(/\{(\w+)\}/g, (match, key: string) => {
		const value = variables[key];
		return value === undefined ? match : String(value);
	});
}

export async function t(
	key: string,
	variables?: TranslationVariables,
): Promise<string> {
	return interpolate(key, variables);
}
