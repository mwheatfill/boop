import { USER_ROLES } from '@/lib/db/schema'
import { z } from './openapi'

export const UserSchema = z
  .object({
    id: z.string().meta({ description: 'Stable user ID', example: 'usr_abc123' }),
    email: z.email().meta({ example: 'user@example.com' }),
    name: z.string().optional().meta({ example: 'Alex Doe' }),
    image: z.url().optional().meta({ example: 'https://example.com/avatar.png' }),
    role: z.enum(USER_ROLES).meta({ description: 'Operator role per ADR-016' }),
  })
  .meta({
    id: 'User',
    description: 'Authenticated user as returned by getCurrentUser(request).',
  })

export type User = z.infer<typeof UserSchema>
