export * from './catalogue.js';
export * from './enquiry.js';
export * from './errors.js';

export function isJsonContentType(value: string | null | undefined): boolean {
	return value?.split(';', 1)[0]?.trim().toLowerCase() === 'application/json';
}