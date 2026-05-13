import { describe, expect, it } from 'vitest'
import { JOB_TEMPLATE_TAGS } from '@/shared/schemas/job-template'
import { STARTER_RECIPES } from './starter-recipes'

describe('STARTER_RECIPES', () => {
  it('has unique slugs and valid tags', () => {
    const slugs = new Set<string>()
    for (const recipe of STARTER_RECIPES) {
      expect(slugs.has(recipe.slug)).toBe(false)
      slugs.add(recipe.slug)
      expect(JOB_TEMPLATE_TAGS).toContain(recipe.tag)
      expect(recipe.targetRef.length).toBeGreaterThan(0)
    }
    expect(STARTER_RECIPES).toHaveLength(8)
  })
})
