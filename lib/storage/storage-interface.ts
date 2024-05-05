/**
 * Options for reading a file.
 */
export type WriteOptions = {
	/**
	 * Cache control header for the file
	 */
	cacheControl: string
	/**
	 * Content type for the file
	 */
	contentType?: string
}

/**
 * Interface for file storage backends.
 */
export type StorageBackend = {
	/**
	 * Read a file from storage.
	 * @param name File name
	 * @returns The file as a blob and its cache control header provided at write
	 * time
	 */
	read(name: string): Promise<{ blob: Blob; cacheControl: string }>

	/**
	 * Write a file to storage.
	 * @param name File name
	 * @param blob File data
	 * @param cacheControl Cache control header for the file
	 */
	write(
		name: string,
		blob: Blob | ReadableStream<Uint8Array>,
		options: WriteOptions,
	): Promise<void>

	/**
	 * Delete a file from storage.
	 * @param name File name
	 */
	del(name: string): Promise<void>

	/**
	 * List all files in storage.
	 * @returns An async generator of all file names
	 */
	list(): AsyncGenerator<string>
}
