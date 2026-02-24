import { z } from 'zod';

// Definindo o Schema de Validação
export const BoletoSchema = z.object({
  NumeroDocumento: z.string().min(1, "Número do documento é obrigatório"),
  Vencimento: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/, "Data deve ser DD/MM/YYYY"),
  Valor: z.number().positive("O valor deve ser maior que zero"),
  
  // Adicionando validação de tamanho para o Nome
  Sacado_Nome: z.string()
    .min(5, "Nome do sacado muito curto")
    .max(60, "Nome muito longo"),

  // Adicionando validação para CPF/CNPJ (tamanho)
  Sacado_CNPJCPF: z.string()
    .transform(val => val.replace(/\D/g, '')) // Limpa primeiro
    .refine(val => val.length === 11 || val.length === 14, {
      message: "CPF deve ter 11 dígitos ou CNPJ deve ter 14",
    }),

  Sacado_Logradouro: z.string().min(2, "Logradouro obrigatório"),
  Sacado_Numero: z.string().min(1, "Número obrigatório"),
  Sacado_Bairro: z.string().min(2, "Bairro obrigatório"),
  Sacado_Cidade: z.string().min(2, "Cidade obrigatória"),
  Sacado_UF: z.string().length(2, "UF deve ter exatamente 2 caracteres"),
  
  // CEP deve ter 8 dígitos após a limpeza
  Sacado_CEP: z.string()
    .transform(val => val.replace(/\D/g, ''))
    .refine(val => val.length === 8, "CEP inválido"),

  Mensagem: z.string().optional(),
});

// Extraindo o tipo do Schema
export type DadosBoleto = z.infer<typeof BoletoSchema>;

export class ACBrParser {
  static dadosParaIni(dados: DadosBoleto, index: number = 1): string {
    const valorFormatado = dados.Valor.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    return `
[Titulo${index}]
NumeroDocumento=${dados.NumeroDocumento}
Vencimento=${dados.Vencimento}
Valor=${valorFormatado}
Sacado_Nome=${dados.Sacado_Nome}
Sacado_CNPJCPF=${dados.Sacado_CNPJCPF}
Sacado_Logradouro=${dados.Sacado_Logradouro}
Sacado_Numero=${dados.Sacado_Numero}
Sacado_Bairro=${dados.Sacado_Bairro}
Sacado_Cidade=${dados.Sacado_Cidade}
Sacado_UF=${dados.Sacado_UF}
Sacado_CEP=${dados.Sacado_CEP}
${dados.Mensagem ? `Mensagem=${dados.Mensagem}` : ''}
`.trim();
  }
}

// export interface DadosBoleto {
//   NumeroDocumento: string;
//   Vencimento: string; // Formato DD/MM/YYYY
//   Valor: number;
//   Sacado_Nome: string;
//   Sacado_CNPJCPF: string;
//   Sacado_Logradouro: string;
//   Sacado_Numero: string;
//   Sacado_Bairro: string;
//   Sacado_Cidade: string;
//   Sacado_UF: string;
//   Sacado_CEP: string;
//   Mensagem?: string;
// }

// export class ACBrParser {
//   /**
//    * Converte um objeto de dados para o formato INI que a DLL entende
//    */
//   static dadosParaIni(dados: DadosBoleto, index: number = 1): string {
//     // A ACBrLib exige o valor com vírgula para decimais no INI
//     const valorFormatado = dados.Valor.toLocaleString('pt-BR', {
//       minimumFractionDigits: 2,
//       maximumFractionDigits: 2,
//     });

//     return `
// [Titulo${index}]
// NumeroDocumento=${dados.NumeroDocumento}
// Vencimento=${dados.Vencimento}
// Valor=${valorFormatado}
// Sacado_Nome=${dados.Sacado_Nome}
// Sacado_CNPJCPF=${dados.Sacado_CNPJCPF.replace(/\D/g, '')}
// Sacado_Logradouro=${dados.Sacado_Logradouro}
// Sacado_Numero=${dados.Sacado_Numero}
// Sacado_Bairro=${dados.Sacado_Bairro}
// Sacado_Cidade=${dados.Sacado_Cidade}
// Sacado_UF=${dados.Sacado_UF}
// Sacado_CEP=${dados.Sacado_CEP.replace(/\D/g, '')}
// ${dados.Mensagem ? `Mensagem=${dados.Mensagem}` : ''}
// `.trim();
//   }
// }