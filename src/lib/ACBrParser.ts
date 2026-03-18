import { z } from 'zod';

import { getAppConfig } from '../shared/config/appConfig.js';
import {
  digitsOnly,
  isFutureOrTodayBrazilianDate,
  isValidCep,
  isValidCpfOrCnpj,
} from '../shared/validation/documentValidators.js';

export const BoletoSchema = z
  .object({
    NumeroDocumento: z.string().trim().regex(/^\d+$/, 'NumeroDocumento deve conter apenas numeros').max(20),
    NossoNumero: z.string().trim().regex(/^\d+$/, 'NossoNumero deve conter apenas numeros').max(20).optional(),
    Vencimento: z.string().trim().regex(/^\d{2}\/\d{2}\/\d{4}$/, 'Formato esperado: DD/MM/YYYY'),
    Valor: z.number().positive('Valor deve ser maior que zero').max(99999999.99, 'Valor acima do limite permitido'),
    Sacado_Nome: z.string().trim().min(5).max(60),
    Sacado_CNPJCPF: z.string().trim().transform(digitsOnly),
    Sacado_Logradouro: z.string().trim().min(2).max(80),
    Sacado_Numero: z.string().trim().min(1).max(20),
    Sacado_Bairro: z.string().trim().min(2).max(40),
    Sacado_Cidade: z.string().trim().min(2).max(40),
    Sacado_UF: z.string().trim().transform(value => value.toUpperCase()).pipe(z.string().length(2)),
    Sacado_CEP: z.string().trim().transform(digitsOnly),
    Mensagem: z.string().trim().max(200).optional(),
  })
  .superRefine((value, ctx) => {
    if (!isValidCpfOrCnpj(value.Sacado_CNPJCPF)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['Sacado_CNPJCPF'],
        message: 'Sacado_CNPJCPF deve conter um CPF ou CNPJ valido',
      });
    }

    if (!isValidCep(value.Sacado_CEP)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['Sacado_CEP'],
        message: 'Sacado_CEP deve conter 8 digitos',
      });
    }

    if (!/^[A-Z]{2}$/.test(value.Sacado_UF)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['Sacado_UF'],
        message: 'Sacado_UF deve conter uma UF valida com 2 letras',
      });
    }

    if (!isFutureOrTodayBrazilianDate(value.Vencimento)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['Vencimento'],
        message: 'Vencimento deve ser hoje ou uma data futura valida',
      });
    }
  });

export type BoletoData = z.infer<typeof BoletoSchema>;

export class ACBrParser {
  private static mapTipoDocumento(value: string): string {
    const map: Record<string, string> = {
      CH: '1',
      DM: '2',
      DMI: '3',
      DS: '4',
      DSI: '5',
      DR: '6',
      LC: '7',
      NCC: '8',
      NCE: '9',
      NCI: '10',
      NCR: '11',
      NP: '12',
      NPR: '13',
      TM: '14',
      TS: '15',
      NS: '16',
      RC: '17',
      FAT: '18',
      ND: '19',
      AP: '20',
      ME: '21',
      PC: '22',
    };

    return map[value.toUpperCase()] ?? value;
  }

  private static formatTelefone(raw?: string): string {
    const digits = digitsOnly(raw ?? '');
    if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return raw?.trim() || '-';
  }

  static dadosParaIni(dados: BoletoData, referenceDate = new Date()): string {
    const config = getAppConfig();
    const { cedente } = config;
    const dataHoje = referenceDate.toLocaleDateString('pt-BR');
    const tipoSacado = dados.Sacado_CNPJCPF.length === 14 ? 1 : 0;
    const valorFmt = dados.Valor.toFixed(2).replace('.', ',');
    const numeroDoc = digitsOnly(dados.NumeroDocumento);
    const nossoNumero = digitsOnly(dados.NossoNumero ?? numeroDoc).padStart(cedente.nossoNumeroTamanho, '0');
    const convenio = /^0+$/.test(cedente.convenio) ? '' : cedente.convenio;
    const cedenteTelefone = this.formatTelefone(cedente.telefone);
    const tipoDocumento = ACBrParser.mapTipoDocumento(cedente.especieDoc);
    const mensagem = dados.Mensagem?.trim() ?? '';

    const linhas = [
      `[Titulo1]`,
      `NumeroDocumento=${numeroDoc}`,
      `NossoNumero=${nossoNumero}`,
      `Carteira=${cedente.carteira}`,
      `Modalidade=${cedente.modalidade}`,
      `TipoCarteira=${cedente.tipoCarteira}`,
      `EspecieDoc=${cedente.especieDoc}`,
      `TipoDocumento=${tipoDocumento}`,
      `DataDocumento=${dataHoje}`,
      `DataProcessamento=${dataHoje}`,
      `Vencimento=${dados.Vencimento}`,
      `ValorDocumento=${valorFmt}`,
      `Especie=${cedente.especieDoc}`,
      `EspecieMod=R$`,
      `Quantidade=`,
      `PercentualMulta=2`,
      `PercentualJurosDia=0.033`,
      `LocalPagamento=Pagavel em qualquer banco ate o vencimento`,
      `Mensagem=${mensagem}`,
      `Instrucao1=`,
      `Instrucao2=`,
      `Aceite=1`,
      `Parcela=1`,
      `TotalParcelas=1`,
      `Cedente.Nome=${cedente.nomeBoleto}`,
      `Cedente.CNPJCPF=${cedente.cnpjCpf}`,
      `Cedente.Agencia=${cedente.agencia}`,
      `Cedente.AgenciaDigito=${cedente.agenciaDigito}`,
      `Cedente.Conta=${cedente.conta}`,
      `Cedente.ContaDigito=${cedente.contaDigito}`,
      `Cedente.Carteira=${cedente.carteira}`,
      `Cedente.Banco=${cedente.banco}`,
      `Cedente.Convenio=${convenio}`,
      `Cedente.CodigoCedente=${cedente.codigoCedente}`,
      `Cedente.CodigoTransmissao=${cedente.codigoTransmissao}`,
      `Cedente.Modalidade=${cedente.modalidade}`,
      `Cedente.TipoCarteira=${cedente.tipoCarteira}`,
      `Cedente.Logradouro=${cedente.logradouro}`,
      `Cedente.Numero=${cedente.numero}`,
      `Cedente.Bairro=${cedente.bairro}`,
      `Cedente.Cidade=${cedente.cidade}`,
      `Cedente.UF=${cedente.uf}`,
      `Cedente.CEP=${cedente.cep}`,
      `Cedente.Telefone=${cedenteTelefone}`,
      `Sacado.NomeSacado=${dados.Sacado_Nome}`,
      `Sacado.CNPJCPF=${dados.Sacado_CNPJCPF}`,
      `Sacado.Pessoa=${tipoSacado}`,
      `Sacado.Logradouro=${dados.Sacado_Logradouro}`,
      `Sacado.Numero=${dados.Sacado_Numero}`,
      `Sacado.Complemento=`,
      `Sacado.Bairro=${dados.Sacado_Bairro}`,
      `Sacado.Cidade=${dados.Sacado_Cidade}`,
      `Sacado.UF=${dados.Sacado_UF}`,
      `Sacado.CEP=${dados.Sacado_CEP}`,
      `Sacado.Email=`,
    ];

    return linhas.join('\r\n');
  }
}
