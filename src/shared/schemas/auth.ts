import { z } from './openapi'

export const UserSchema = z
  .object({
    id: z.string().meta({ description: 'Stable user ID', example: 'usr_abc123' }),
    email: z.email().meta({ example: 'user@example.com' }),
    name: z.string().optional().meta({ example: 'Alex Doe' }),
    image: z.url().optional().meta({ example: 'https://example.com/avatar.png' }),
    groups: z
      .array(z.string())
      .meta({ description: 'Group claims for in-app RBAC', example: ['admins'] }),
  })
  .meta({ id: 'User' })

export type UserSchemaType = z.infer<typeof UserSchema>
