// Side-effect import that registers the .openapi() method on Zod schemas.
// Import `z` from this module everywhere instead of directly from 'zod'.
import 'zod-openapi'
import { z } from 'zod'

export { z }
