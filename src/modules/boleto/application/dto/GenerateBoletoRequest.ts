import { z } from 'zod';

import { BoletoSchema } from '../../../../lib/ACBrParser.js';

export const GenerateBoletoSchema = BoletoSchema.extend({
  fileName: z.string().optional(),
});

export type GenerateBoletoRequest = z.infer<typeof GenerateBoletoSchema>;
