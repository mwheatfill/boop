// Side-effect import that wires zod-openapi 5.x into Zod 4. With this
// loaded, decorate schemas using the built-in `.meta({ description, example,
// id, ... })` API and the OpenAPI generator picks it up. Import `z` from
// this module everywhere instead of directly from 'zod' so the side effect
// is loaded before any schema is defined.
import 'zod-openapi'
import { z } from 'zod'

export { z }
