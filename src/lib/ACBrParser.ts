// lib/ACBrParser.ts
import { z } from 'zod';

export const BoletoSchema = z.object({
  NumeroDocumento: z.string().regex(/^\d+$/, 'NumeroDocumento deve conter apenas números'),
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
    const valorFmt = dados.Valor.toFixed(2).replace('.', ',');
    const numeroDoc = dados.NumeroDocumento.replace(/\D/g, '');
    const nossoNumero = numeroDoc.padStart(8, '0');

    const linhas = [
      `[Titulo1]`,
      `NumeroDocumento=${numeroDoc}`,
      `NossoNumero=${nossoNumero}`,
      `NossoNumeroFormatado=${nossoNumero}`,
      `BancoNumero=${process.env.CEDENTE_BANCO ?? ''}`,
      `Carteira=${process.env.CEDENTE_CARTEIRA ?? '1'}`,
      `Modalidade=${process.env.CEDENTE_MODALIDADE ?? '1'}`,
      `TipoCarteira=${process.env.CEDENTE_TIPO_CARTEIRA ?? '1'}`,
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
      `ValorDocumento=${valorFmt}`,
      `Valor=${valorFmt}`,
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
      `Cedente.Convenio=${process.env.CEDENTE_CONVENIO ?? ''}`,
      `Cedente.CodigoCedente=${process.env.CEDENTE_CODIGO_CEDENTE ?? ''}`,
      `Cedente.CodigoTransmissao=${process.env.CEDENTE_CODIGO_TRANSMISSAO ?? ''}`,
      `Cedente.Modalidade=${process.env.CEDENTE_MODALIDADE ?? '1'}`,
      `Cedente.TipoCarteira=${process.env.CEDENTE_TIPO_CARTEIRA ?? '1'}`,
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