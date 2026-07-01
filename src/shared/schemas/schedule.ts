import { z } from './openapi'

export const ProposeScheduleInput = z
  .object({
    text: z.string().min(1).max(500),
    timezone: z.string().min(1),
  })
  .meta({
    id: 'ProposeScheduleInput',
    description: 'A natural-language schedule description plus the timezone to resolve it against.',
  })
export type ProposeScheduleInput = z.infer<typeof ProposeScheduleInput>
