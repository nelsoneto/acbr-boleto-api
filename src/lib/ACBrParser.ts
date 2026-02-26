// lib/ACBrParser.ts
import { z } from 'zod';

export const BoletoSchema = z.object({
  NumeroDocumento: z.string().min(1),
  Vencimento: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/),
  Valor: z.number().positive(),
  Sacado_Nome: z.string().min(5).max(60),
  Sacado_CNPJCPF: z.string().transform(val => val.replace(/\D/g, '')),
  Sacado_Logradouro: z.string().min(2),
  Sacado_Numero: z.string().min(1),
  Sacado_Bairro: z.string().min(2),
  Sacado_Cidade: z.string().min(2),
  Sacado_UF: z.string().length(2),
  Sacado_CEP: z.string().transform(val => val.replace(/\D/g, '')),
  Mensagem: z.string().optional(),
});

export class ACBrParser {
  static dadosParaIni(dados: any): string {
    const hoje = new Date();
    const dataHoje = hoje.toLocaleDateString('pt-BR'); // dd/mm/yyyy

    const linhas = [
      `[Titulo1]`,
      `NumeroDocumento=${dados.NumeroDocumento}`,
      `NossoNumero=${dados.NumeroDocumento.padStart(8, '0')}`, // formatado corretamente
      `Carteira=09`, // exemplo de carteira para Itaú
      `EspecieDoc=DM`, // duplicata mercantil
      `DataDocumento=${dataHoje}`,
      `DataProcessamento=${dataHoje}`,
      `Vencimento=${dados.Vencimento}`,
      `Valor=${dados.Valor.toFixed(2).replace('.', ',')}`,
      `Sacado.Nome=${dados.Sacado_Nome}`,
      `Sacado.CNPJCPF=${dados.Sacado_CNPJCPF}`,
      `Sacado.Logradouro=${dados.Sacado_Logradouro}`,
      `Sacado.Numero=${dados.Sacado_Numero}`,
      `Sacado.Bairro=${dados.Sacado_Bairro}`,
      `Sacado.Cidade=${dados.Sacado_Cidade}`,
      `Sacado.UF=${dados.Sacado_UF}`,
      `Sacado.CEP=${dados.Sacado_CEP}`,
      `Mensagem=${dados.Mensagem || ''}`
    ];
    return linhas.join('\r\n');
  }
}