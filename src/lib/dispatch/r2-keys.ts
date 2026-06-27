export type R2BodyKind = 'request' | 'response'

export function r2KeyFor(
  workspaceId: string,
  runId: string,
  attemptNumber: number,
  kind: R2BodyKind,
): string {
  return `runs/${workspaceId}/${runId}/${attemptNumber}.${kind}`
}
