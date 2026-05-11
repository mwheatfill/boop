// Bare import activates zod-openapi's TypeScript module augmentation,
// which adds OpenAPI keys (description, example, id, ...) to Zod's
// `.meta()` parameter type. Zero runtime effect; import `z` from here
// so the augmentation is in scope at every schema definition.
import 'zod-openapi'
import { z } from 'zod'

export { z }
