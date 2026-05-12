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
    public readonly reason: 'not_found' | 'paused' | 'archived' | 'customer_archived',
  ) {
    super(`Job ${jobId} is not dispatchable: ${reason}`)
    this.name = 'JobNotDispatchableError'
  }
}
