export function isImageContentType(contentType?: string | null): boolean {
	return Boolean(contentType?.startsWith('image/'));
}

export function normalizeImageFormat(format?: string): 'png' | 'jpeg' | 'webp' {
	if (format === 'jpeg' || format === 'webp') {
		return format;
	}

	return 'png';
}
