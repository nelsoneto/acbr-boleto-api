import path from 'path';

import { z } from 'zod';

const booleanFlag = z
  .union([z.literal('1'), z.literal('0'), z.literal('true'), z.literal('false')])
  .optional()
  .transform(value => value === '1' || value === 'true');

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().int().positive().default(3001),
    DEBUG_KEEP_INI: booleanFlag,
    TEMP_DIR: z.string().trim().optional(),
    TEMP_PDF_DIR: z.string().trim().optional(),
    TEMP_FILE_TTL_HOURS: z.coerce.number().positive().default(24),
    DIR_LOGO: z.string().trim().optional(),
    LOGO_BANCO: z.string().trim().optional(),
    // Valor numerico do enum TipoCobranca da ACBrLib.
    // Ex.: 9 = Bancoob, 1 = Banco do Brasil, 5 = Bradesco, 6 = Itau.
    TIPO_COBRANCA: z.coerce.number().int().min(0).default(0),
    BOLETO_LAYOUT: z.string().trim().default('1'),
    BOLETO_ESCALA: z.string().trim().default('92'),
    BOLETO_MARGEM_SUPERIOR: z.string().trim().default('6'),
    BOLETO_MARGEM_INFERIOR: z.string().trim().default('6'),
    BOLETO_MARGEM_ESQUERDA: z.string().trim().default('5'),
    BOLETO_MARGEM_DIREITA: z.string().trim().default('4'),
    // VersaoArquivo para [Banco] no INI de titulos. Sicoob usa 810 para nao calcular DV do NossoNumero.
    BOLETO_VERSAO_ARQUIVO: z.string().trim().default(''),
    CEDENTE_NOME: z.string().trim().optional(),
    CEDENTE_NOME_BOLETO: z.string().trim().optional(),
    CEDENTE_CNPJCPF: z.string().trim().optional(),
    CEDENTE_BANCO: z.string().trim().optional(),
    CEDENTE_AGENCIA: z.string().trim().optional(),
    CEDENTE_AGENCIA_DIGITO: z.string().trim().optional(),
    CEDENTE_CONTA: z.string().trim().optional(),
    CEDENTE_CONTA_DIGITO: z.string().trim().optional(),
    CEDENTE_CARTEIRA: z.string().trim().optional(),
    CEDENTE_CONVENIO: z.string().trim().optional(),
    CEDENTE_CODIGO_CEDENTE: z.string().trim().optional(),
    CEDENTE_CODIGO_TRANSMISSAO: z.string().trim().optional(),
    CEDENTE_MODALIDADE: z.string().trim().optional(),
    CEDENTE_TIPO_CARTEIRA: z.string().trim().optional(),
    // TipoDocumento para [BoletoCedenteConfig]: 0=Tradicional, 1=Escritural.
    CEDENTE_TIPO_DOCUMENTO: z.string().trim().optional(),
    // EspecieDoc do Titulo INI: DM, DS, NP, etc.
    CEDENTE_ESPECIE_DOC: z.string().trim().optional(),
    CEDENTE_RESPON_EMISSAO: z.string().trim().optional(),
    // Tamanho do NossoNumero com zero-padding. Bancoob/756 usa 7.
    NOSSO_NUMERO_TAMANHO: z.coerce.number().int().min(1).max(20).default(7),
    CEDENTE_LOGRADOURO: z.string().trim().optional(),
    CEDENTE_NUMERO: z.string().trim().optional(),
    CEDENTE_BAIRRO: z.string().trim().optional(),
    CEDENTE_CIDADE: z.string().trim().optional(),
    CEDENTE_UF: z.string().trim().optional(),
    CEDENTE_CEP: z.string().trim().optional(),
    CEDENTE_TELEFONE: z.string().trim().optional(),
  })
  .superRefine((env, ctx) => {
    if (!(env.CEDENTE_NOME_BOLETO || env.CEDENTE_NOME)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['CEDENTE_NOME_BOLETO'],
        message: 'Informe CEDENTE_NOME_BOLETO ou CEDENTE_NOME',
      });
    }

    const cedenteDoc = (env.CEDENTE_CNPJCPF ?? '').replace(/\D/g, '');
    if (!cedenteDoc) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['CEDENTE_CNPJCPF'],
        message: 'CEDENTE_CNPJCPF e obrigatorio',
      });
    } else if (![11, 14].includes(cedenteDoc.length)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['CEDENTE_CNPJCPF'],
        message: 'CEDENTE_CNPJCPF deve conter 11 ou 14 digitos',
      });
    }

    const banco = (env.CEDENTE_BANCO ?? '').replace(/\D/g, '');
    if (!banco) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['CEDENTE_BANCO'],
        message: 'CEDENTE_BANCO e obrigatorio',
      });
    }
  });

export type AppConfig = ReturnType<typeof buildConfig>;

let cachedConfig: AppConfig | null = null;

function buildConfig(env: z.infer<typeof envSchema>) {
  const tempDir = path.resolve(env.TEMP_DIR || './temp');
  const tempPdfDir = path.resolve(env.TEMP_PDF_DIR || path.join(tempDir, 'pdf'));
  const logoDir = path.resolve(env.DIR_LOGO || './assets/logos');

  return {
    runtime: {
      nodeEnv: env.NODE_ENV,
      debugKeepIni: env.DEBUG_KEEP_INI,
      tempDir,
      tempPdfDir,
      tempFileTtlHours: env.TEMP_FILE_TTL_HOURS,
      workerPath: path.resolve('./src/acbr-worker.ts'),
    },
    server: {
      port: env.PORT,
    },
    boleto: {
      tipoCobranca: env.TIPO_COBRANCA,
      layout: env.BOLETO_LAYOUT,
      escala: env.BOLETO_ESCALA,
      margemSuperior: env.BOLETO_MARGEM_SUPERIOR,
      margemInferior: env.BOLETO_MARGEM_INFERIOR,
      margemEsquerda: env.BOLETO_MARGEM_ESQUERDA,
      margemDireita: env.BOLETO_MARGEM_DIREITA,
      versaoArquivo: env.BOLETO_VERSAO_ARQUIVO,
    },
    assets: {
      logoDir,
      logoBanco: env.LOGO_BANCO || '',
    },
    cedente: {
      nome: (env.CEDENTE_NOME || '').trim(),
      nomeBoleto: (env.CEDENTE_NOME_BOLETO || env.CEDENTE_NOME || '').trim(),
      cnpjCpf: (env.CEDENTE_CNPJCPF || '').replace(/\D/g, ''),
      banco: (env.CEDENTE_BANCO || '').replace(/\D/g, ''),
      agencia: env.CEDENTE_AGENCIA || '',
      agenciaDigito: env.CEDENTE_AGENCIA_DIGITO || '0',
      conta: env.CEDENTE_CONTA || '',
      contaDigito: env.CEDENTE_CONTA_DIGITO || '0',
      carteira: env.CEDENTE_CARTEIRA || '1',
      convenio: env.CEDENTE_CONVENIO || '',
      codigoCedente: env.CEDENTE_CODIGO_CEDENTE || '',
      codigoTransmissao: env.CEDENTE_CODIGO_TRANSMISSAO || '',
      modalidade: env.CEDENTE_MODALIDADE || '1',
      tipoCarteira: env.CEDENTE_TIPO_CARTEIRA || '1',
      tipoDocumento: env.CEDENTE_TIPO_DOCUMENTO || '0',
      especieDoc: env.CEDENTE_ESPECIE_DOC || 'DM',
      responEmissao: env.CEDENTE_RESPON_EMISSAO || '1',
      nossoNumeroTamanho: env.NOSSO_NUMERO_TAMANHO,
      logradouro: env.CEDENTE_LOGRADOURO || '-',
      numero: env.CEDENTE_NUMERO || '-',
      bairro: env.CEDENTE_BAIRRO || '-',
      cidade: env.CEDENTE_CIDADE || '-',
      uf: env.CEDENTE_UF || '--',
      cep: (env.CEDENTE_CEP || '').replace(/\D/g, '') || '00000000',
      telefone: env.CEDENTE_TELEFONE || '',
    },
  };
}

export function getAppConfig(): AppConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const parsedEnv = envSchema.safeParse(process.env);
  if (!parsedEnv.success) {
    const details = parsedEnv.error.issues
      .map(issue => `${issue.path.join('.') || 'env'}: ${issue.message}`)
      .join('; ');

    throw new Error(`Configuracao invalida: ${details}`);
  }

  cachedConfig = buildConfig(parsedEnv.data);
  return cachedConfig;
}

export function resetAppConfigForTests() {
  cachedConfig = null;
}
