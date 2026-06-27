export interface CloudflareApiErrorDetail {
  code: number
  message: string
}

// Thrown when a Cloudflare API call returns a non-2xx status or an envelope
// with success=false. Carries the operation and Cloudflare's own error list so
// the provisioning saga can surface a precise message and decide on rollback.
export class CloudflareApiError extends Error {
  readonly status: number
  readonly operation: string
  readonly errors: CloudflareApiErrorDetail[]

  constructor(status: number, operation: string, errors: CloudflareApiErrorDetail[]) {
    const detail = errors.map((e) => `${e.code}: ${e.message}`).join('; ')
    super(`Cloudflare API ${operation} failed (${status})${detail ? `: ${detail}` : ''}`)
    this.name = 'CloudflareApiError'
    this.status = status
    this.operation = operation
    this.errors = errors
  }
}
