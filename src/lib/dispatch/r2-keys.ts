export type R2BodyKind = 'request' | 'response'

export function r2KeyFor(
  customerId: string,
  runId: string,
  attemptNumber: number,
  kind: R2BodyKind,
): string {
  return `runs/${customerId}/${runId}/${attemptNumber}.${kind}`
}
