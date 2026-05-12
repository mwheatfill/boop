async function toBytes(
  value: ReadableStream | ArrayBuffer | ArrayBufferView | string | null | Blob,
): Promise<Uint8Array> {
  if (value === null) return new Uint8Array()
  if (typeof value === 'string') return new TextEncoder().encode(value)
  if (value instanceof Uint8Array) return value
  if (value instanceof ArrayBuffer) return new Uint8Array(value)
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
  }
  if (value instanceof Blob) return new Uint8Array(await value.arrayBuffer())
  const buf = await new Response(value).arrayBuffer()
  return new Uint8Array(buf)
}

export function createTestR2(): R2Bucket & { _store: Map<string, Uint8Array> } {
  const store = new Map<string, Uint8Array>()
  const bucket = {
    _store: store,
    async put(
      key: string,
      value: ReadableStream | ArrayBuffer | ArrayBufferView | string | null | Blob,
    ) {
      store.set(key, await toBytes(value))
      return null
    },
    async get(key: string) {
      const bytes = store.get(key)
      if (!bytes) return null
      return {
        async text() {
          return new TextDecoder().decode(bytes)
        },
      }
    },
  }
  return bucket as unknown as R2Bucket & { _store: Map<string, Uint8Array> }
}
