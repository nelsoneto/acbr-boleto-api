// lib/ACBrParser.ts
import { z } from 'zod';

export const BoletoSchema = z.object({
  NumeroDocumento: z.string().regex(/^\d+$/, 'NumeroDocumento deve conter apenas números'),
  NossoNumero: z.string().regex(/^\d+$/, 'NossoNumero deve conter apenas números').optional(),
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
  private static formatTelefone(raw?: string): string {
    const digits = (raw ?? '').replace(/\D/g, '');
    if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return raw?.trim() || '-';
  }

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
    const nossoNumero = (dados.NossoNumero ?? numeroDoc).replace(/\D/g, '').padStart(8, '0');
    const nomeCedenteBoleto = (process.env.CEDENTE_NOME_BOLETO ?? process.env.CEDENTE_NOME ?? '').trim();
    const convenioRaw = (process.env.CEDENTE_CONVENIO ?? '').trim();
    const convenio = /^0+$/.test(convenioRaw) ? '' : convenioRaw;
    const cedenteLogradouro = (process.env.CEDENTE_LOGRADOURO ?? '-').trim() || '-';
    const cedenteNumero = (process.env.CEDENTE_NUMERO ?? '-').trim() || '-';
    const cedenteBairro = (process.env.CEDENTE_BAIRRO ?? '-').trim() || '-';
    const cedenteCidade = (process.env.CEDENTE_CIDADE ?? '-').trim() || '-';
    const cedenteUF = (process.env.CEDENTE_UF ?? '--').trim() || '--';
    const cedenteCEP = (process.env.CEDENTE_CEP ?? '').replace(/\D/g, '') || '00000000';
    const cedenteTelefone = this.formatTelefone(process.env.CEDENTE_TELEFONE);

    const linhas = [
      `[Titulo1]`,
      `NumeroDocumento=${numeroDoc}`,
      `NossoNumero=${nossoNumero}`,
      `NossoNumeroFormatado=${nossoNumero}`,
      `CodBanco=${process.env.CEDENTE_BANCO ?? ''}`,
      `CodigoBanco=${process.env.CEDENTE_BANCO ?? ''}`,
      `Banco=${process.env.CEDENTE_BANCO ?? ''}`,
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
      `Cedente.Nome=${nomeCedenteBoleto}`,
      `Cedente.CNPJCPF=${cedenteDoc}`,
      `Cedente.TipoInscricao=${tipoCedente}`,
      `Cedente.Agencia=${process.env.CEDENTE_AGENCIA ?? ''}`,
      `Cedente.AgenciaDigito=${process.env.CEDENTE_AGENCIA_DIGITO ?? ''}`,
      `Cedente.Conta=${process.env.CEDENTE_CONTA ?? ''}`,
      `Cedente.ContaDigito=${process.env.CEDENTE_CONTA_DIGITO ?? ''}`,
      `Cedente.Carteira=${process.env.CEDENTE_CARTEIRA ?? '1'}`,
      `Cedente.Banco=${process.env.CEDENTE_BANCO ?? ''}`,
      `Cedente.Convenio=${convenio}`,
      `Cedente.CodigoCedente=${process.env.CEDENTE_CODIGO_CEDENTE ?? ''}`,
      `Cedente.CodigoTransmissao=${process.env.CEDENTE_CODIGO_TRANSMISSAO ?? ''}`,
      `Cedente.Modalidade=${process.env.CEDENTE_MODALIDADE ?? '1'}`,
      `Cedente.TipoCarteira=${process.env.CEDENTE_TIPO_CARTEIRA ?? '1'}`,
      `Cedente.Logradouro=${cedenteLogradouro}`,
      `Cedente.Numero=${cedenteNumero}`,
      `Cedente.Bairro=${cedenteBairro}`,
      `Cedente.Cidade=${cedenteCidade}`,
      `Cedente.UF=${cedenteUF}`,
      `Cedente.CEP=${cedenteCEP}`,
      `Cedente.Telefone=${cedenteTelefone}`,
      // -------------------------------------------------------
      // Sacado (cliente)
      // -------------------------------------------------------
      `Sacado.Nome=${dados.Sacado_Nome}`,
      `Sacado.NomeSacado=${dados.Sacado_Nome}`,
      `Sacado.RazaoSocial=${dados.Sacado_Nome}`,
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