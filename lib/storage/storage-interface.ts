export type StorageBackend = {
	read(name: string): Promise<Blob>
	write(name: string, blob: Blob): Promise<void>
	del(name: string): Promise<void>
	list(): AsyncGenerator<string>
}
