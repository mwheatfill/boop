import { sql } from 'drizzle-orm'
import type { Database } from '@/lib/db/client'
import { newId } from '@/lib/db/ids'
import { users } from '@/lib/db/schema'
import type { User } from '@/shared/schemas/auth'

export interface ProvisionClaims {
  email: string
  name?: string
  image?: string
}

export async function provisionUser(db: Database, claims: ProvisionClaims): Promise<User> {
  const rows = await db
    .insert(users)
    .values({
      id: newId('usr'),
      email: claims.email,
      name: claims.name ?? null,
      image: claims.image ?? null,
      role: sql`CASE WHEN (SELECT COUNT(*) FROM users) = 0 THEN 'admin' ELSE 'operator' END`,
    })
    .onConflictDoUpdate({
      target: users.email,
      set: {
        name: sql`coalesce(excluded.name, ${users.name})`,
        image: sql`coalesce(excluded.image, ${users.image})`,
        updatedAt: new Date(),
      },
    })
    .returning({
      id: users.id,
      email: users.email,
      name: users.name,
      image: users.image,
      role: users.role,
    })

  const row = rows[0]
  if (!row) {
    throw new Error('provisionUser: insert returned no rows')
  }
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    ...(row.name !== null ? { name: row.name } : {}),
    ...(row.image !== null ? { image: row.image } : {}),
  }
}
