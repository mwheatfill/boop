export class DispatchError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'DispatchError'
  }
}

export class ClaimFailedError extends DispatchError {
  constructor(public readonly jobId: string) {
    super(`Job ${jobId} is already in progress`)
    this.name = 'ClaimFailedError'
  }
}

export class JobNotDispatchableError extends DispatchError {
  constructor(
    public readonly jobId: string,
    public readonly reason:
      | 'not_found'
      | 'paused'
      | 'archived'
      | 'workspace_archived'
      | 'target_archived',
  ) {
    super(`Job ${jobId} is not dispatchable: ${reason}`)
    this.name = 'JobNotDispatchableError'
  }
}

export class RenderError extends DispatchError {
  constructor(cause: unknown) {
    super(`Template render failed: ${cause instanceof Error ? cause.message : String(cause)}`, {
      cause,
    })
    this.name = 'RenderError'
  }
}

export class TargetTimeoutError extends DispatchError {
  constructor() {
    super('Target fetch timed out')
    this.name = 'TargetTimeoutError'
  }
}

export class TargetNetworkError extends DispatchError {
  constructor(cause: unknown) {
    super(
      `Target fetch network failure: ${cause instanceof Error ? cause.message : String(cause)}`,
      { cause },
    )
    this.name = 'TargetNetworkError'
  }
}

export class TargetHttpError extends DispatchError {
  constructor(public readonly status: number) {
    super(`Target returned HTTP ${status}`)
    this.name = 'TargetHttpError'
  }
}

export function isRetryableDispatchError(err: unknown): boolean {
  if (err instanceof TargetTimeoutError) return true
  if (err instanceof TargetNetworkError) return true
  if (err instanceof TargetHttpError) return err.status >= 500
  return false
}
