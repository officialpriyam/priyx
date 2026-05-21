export interface BaseEventOptions<TName extends string, TArgs extends unknown[]> {
	name: TName;
	once?: boolean;
	addon?: string;
	execute: (...args: TArgs) => Promise<void>;
}

export class BaseEvent<TName extends string = string, TArgs extends unknown[] = unknown[]> {
	public readonly name: TName;
	public readonly once: boolean;
	public readonly addon: string;
	public readonly execute: (...args: TArgs) => Promise<void>;

	public constructor(options: BaseEventOptions<TName, TArgs>) {
		this.name = options.name;
		this.once = options.once ?? false;
		this.addon = options.addon ?? 'core';
		this.execute = options.execute;
	}
}
