// lib/ACBrParser.ts
import { z } from 'zod';

export const BoletoSchema = z.object({
  NumeroDocumento: z.string().min(1),
  Vencimento: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/, 'Formato esperado: DD/MM/YYYY'),
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

export type BoletoData = z.infer<typeof BoletoSchema>;

export class ACBrParser {
  static dadosParaIni(dados: BoletoData): string {
    const hoje = new Date();
    const dataHoje = hoje.toLocaleDateString('pt-BR'); // dd/mm/yyyy

    // -------------------------------------------------------
    // Detecta tipo de inscrição pelo tamanho do documento
    // 1 = CPF (11 dígitos) | 2 = CNPJ (14 dígitos)
    // -------------------------------------------------------
    const sacadoDoc = dados.Sacado_CNPJCPF;
    const tipoSacado = sacadoDoc.length === 14 ? 2 : 1;

    const cedenteDoc = (process.env.CEDENTE_CNPJCPF ?? '').replace(/\D/g, '');
    const tipoCedente = cedenteDoc.length === 14 ? 2 : 1;

    const linhas = [
      `[Titulo1]`,
      `NumeroDocumento=${dados.NumeroDocumento}`,
      `NossoNumero=${dados.NumeroDocumento.replace(/\D/g, '').padStart(8, '0')}`,
      `NossoNumeroFormatado=${dados.NumeroDocumento.replace(/\D/g, '').padStart(8, '0')}`,
      `Carteira=${process.env.CEDENTE_CARTEIRA ?? '1'}`,
      `EspecieDoc=DM`,
      `TipoDocumento=DM`,
      `TipoInscricaoCedente=${tipoCedente}`,
      `TipoInscricaoSacado=${tipoSacado}`,
      `DataCreditoLanc=30/12/1899`,
      `NumeroArquivo=1`,
      `Especie=R$`,
      `PercentualMulta=2`,
      `PercentualJurosDia=0.033`,
      `DataDocumento=${dataHoje}`,
      `DataProcessamento=${dataHoje}`,
      `Vencimento=${dados.Vencimento}`,
      `Valor=${dados.Valor.toFixed(2).replace('.', ',')}`,
      // -------------------------------------------------------
      // Cedente (empresa/banco) — lido dos .env
      // -------------------------------------------------------
      `Cedente.Nome=${process.env.CEDENTE_NOME ?? ''}`,
      `Cedente.CNPJCPF=${cedenteDoc}`,
      `Cedente.Agencia=${process.env.CEDENTE_AGENCIA ?? ''}`,
      `Cedente.AgenciaDigito=${process.env.CEDENTE_AGENCIA_DIGITO ?? ''}`,
      `Cedente.Conta=${process.env.CEDENTE_CONTA ?? ''}`,
      `Cedente.ContaDigito=${process.env.CEDENTE_CONTA_DIGITO ?? ''}`,
      `Cedente.Carteira=${process.env.CEDENTE_CARTEIRA ?? '1'}`,
      `Cedente.Banco=${process.env.CEDENTE_BANCO ?? ''}`,
      // -------------------------------------------------------
      // Sacado (cliente)
      // -------------------------------------------------------
      `Sacado.Nome=${dados.Sacado_Nome}`,
      `Sacado.CNPJCPF=${sacadoDoc}`,
      `Sacado.TipoInscricao=${tipoSacado}`,
      `Sacado.Logradouro=${dados.Sacado_Logradouro}`,
      `Sacado.Numero=${dados.Sacado_Numero}`,
      `Sacado.Bairro=${dados.Sacado_Bairro}`,
      `Sacado.Cidade=${dados.Sacado_Cidade}`,
      `Sacado.UF=${dados.Sacado_UF}`,
      `Sacado.CEP=${dados.Sacado_CEP}`,
      `LocalPagamento=Pagável em qualquer banco até o vencimento`,
      `Instrucao1=${dados.Mensagem ?? ''}`,
      `Instrucao2=`,
      `Aceite=N`,
      `Moeda=9`,
    ];

    return linhas.join('\r\n');
  }
}