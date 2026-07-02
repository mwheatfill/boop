// A boop Schedule cron is exactly 5 fields: minute hour day-of-month month
// day-of-week. No seconds or year field, no Quartz-only tokens beyond what the
// 5-field grammar allows (see CONTEXT.md "Schedule"). This guards against an AI
// proposal (or any input) sneaking in a 6-field expression that would parse but
// mean something other than what the operator sees.
export function isFiveFieldCron(expression: string): boolean {
  const fields = expression.trim().split(/\s+/)
  return fields.length === 5 && fields.every((field) => field.length > 0)
}
