import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import koffi from 'koffi';

import { getAppConfig } from '../shared/config/appConfig.js';
import { AcbrIntegrationError } from '../shared/errors/AppError.js';
import { ensureDirectory } from '../shared/files/boletoFiles.js';
import { createLogger } from '../shared/logging/appLogger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const logger = createLogger('acbr-lib');

class ACBrBoleto {
  private static instance: ACBrBoleto;

  private lib: any;
  private handle: any = null;
  private Boleto_Inicializar: any;
  private Boleto_Finalizar: any;
  private Boleto_IncluirTitulos: any;
  private Boleto_GerarPDF: any;
  private Boleto_LimparLista: any;
  private Boleto_UltimoRetorno: any;
  private outputDir: string;
  private outputFilePath: string;

  private constructor() {
    const config = getAppConfig();
    const isWindows = process.platform === 'win32';
    const convention = isWindows ? '__stdcall' : '__cdecl';
    const libName = isWindows ? 'ACBrBoleto64.dll' : 'libacbrboleto64.so';
    const libPath = path.resolve(__dirname, '../../bin', libName);

    this.outputDir = config.runtime.tempPdfDir;
    this.outputFilePath = path.join(this.outputDir, 'acbr-output.pdf');

    logger.info('library.load.start', { libPath, platform: process.platform });

    try {
      this.lib = koffi.load(libPath);
    } catch (error) {
      throw new AcbrIntegrationError('Falha ao carregar biblioteca ACBr', {
        libPath,
        message: error instanceof Error ? error.message : String(error),
      });
    }

    this.Boleto_Inicializar = this.lib.func(
      convention,
      'Boleto_Inicializar',
      'int',
      [koffi.out(koffi.pointer('void *')), 'string', 'string']
    );
    this.Boleto_Finalizar = this.lib.func(convention, 'Boleto_Finalizar', 'int', ['void *']);
    this.Boleto_IncluirTitulos = this.lib.func(
      convention,
      'Boleto_IncluirTitulos',
      'int',
      ['void *', 'string', 'void *', 'int']
    );
    this.Boleto_GerarPDF = this.lib.func(convention, 'Boleto_GerarPDF', 'int', ['void *']);
    this.Boleto_LimparLista = this.lib.func(convention, 'Boleto_LimparLista', 'int', ['void *']);
    this.Boleto_UltimoRetorno = this.lib.func(
      convention,
      'Boleto_UltimoRetorno',
      'int',
      ['void *', 'void *', 'int']
    );

    this.inicializar();
  }

  static getInstance() {
    if (!this.instance) {
      this.instance = new ACBrBoleto();
    }
    return this.instance;
  }

  private buildConfigIni() {
    const config = getAppConfig();
    const configDir = config.runtime.tempDir;
    const { assets, boleto, cedente } = config;

    ensureDirectory(configDir);
    ensureDirectory(this.outputDir);

    const bancoNumero = cedente.banco.padStart(3, '0');
    let logoBancoPath = '';

    if (assets.logoBanco) {
      logoBancoPath = path.isAbsolute(assets.logoBanco)
        ? assets.logoBanco
        : path.resolve(__dirname, '../../', assets.logoBanco);
    } else {
      const logoBmp = path.join(assets.logoDir, `${bancoNumero}.bmp`);
      const logoPng = path.join(assets.logoDir, `${bancoNumero}.png`);
      if (fs.existsSync(logoBmp)) logoBancoPath = logoBmp;
      else if (fs.existsSync(logoPng)) logoBancoPath = logoPng;
    }

    if (logoBancoPath && fs.existsSync(logoBancoPath)) {
      const aliasNames = [`${bancoNumero}.bmp`, `${bancoNumero}-0.bmp`, `${bancoNumero}_0.bmp`, 'Banco.bmp', 'banco.bmp'];
      for (const aliasName of aliasNames) {
        const aliasPath = path.join(assets.logoDir, aliasName);
        if (!fs.existsSync(aliasPath)) {
          fs.copyFileSync(logoBancoPath, aliasPath);
        }
      }
      logger.info('library.logo.selected', { bancoNumero, logoBancoPath });
    } else {
      logger.warn('library.logo.missing', { bancoNumero, logoDir: assets.logoDir });
    }

    // TipoInscricao: 1=PJ (CNPJ 14 digitos), 0=PF (CPF 11 digitos)
    const tipoInscricao = cedente.cnpjCpf.length === 14 ? 1 : 0;
    const convenio = /^0+$/.test(cedente.convenio) ? '' : cedente.convenio;
    const telefone = this.formatTelefone(cedente.telefone);

    // NOTA: O formato correto para Boleto_Inicializar e o formato interno da ACBrLib:
    // [BoletoCedenteConfig], [BoletoBancoConfig], etc.
    // O formato [Cedente]/[Conta]/[Banco] e usado apenas no INI de titulos (Boleto_IncluirTitulos).
    return [
      `[BoletoCedenteConfig]`,
      `Nome=${cedente.nomeBoleto}`,
      `CNPJCPF=${cedente.cnpjCpf}`,
      `TipoInscricao=${tipoInscricao}`,
      `Agencia=${cedente.agencia}`,
      `AgenciaDigito=${cedente.agenciaDigito}`,
      `Conta=${cedente.conta}`,
      `ContaDigito=${cedente.contaDigito}`,
      `Carteira=${cedente.carteira}`,
      `Convenio=${convenio}`,
      `CodigoCedente=${cedente.codigoCedente}`,
      `CodigoTransmissao=${cedente.codigoTransmissao}`,
      `Modalidade=${cedente.modalidade}`,
      `TipoCarteira=${cedente.tipoCarteira}`,
      `TipoDocumento=${cedente.tipoDocumento}`,
      `ResponEmissao=${cedente.responEmissao}`,
      `Logradouro=${cedente.logradouro}`,
      `NumeroRes=${cedente.numero}`,
      `Bairro=${cedente.bairro}`,
      `Cidade=${cedente.cidade}`,
      `UF=${cedente.uf}`,
      `CEP=${cedente.cep}`,
      `Telefone=${telefone}`,
      `CaracTitulo=0`,
      ``,
      `[BoletoBancoConfig]`,
      `Numero=${cedente.banco}`,
      `TipoCobranca=${boleto.tipoCobranca}`,
      ``,
      `[BoletoDiretorioConfig]`,
      `DirArqRemessa=${configDir}`,
      `DirArqRetorno=${configDir}`,
      ``,
      `[BoletoBancoFCFortesConfig]`,
      `DirLogo=${assets.logoDir}`,
      `LogoMarca=${logoBancoPath}`,
      `Layout=${boleto.layout}`,
      `AlterarEscalaPadrao=1`,
      `NovaEscala=${boleto.escala}`,
      `MargemSuperior=${boleto.margemSuperior}`,
      `MargemInferior=${boleto.margemInferior}`,
      `MargemEsquerda=${boleto.margemEsquerda}`,
      `MargemDireita=${boleto.margemDireita}`,
      `CalcularNomeArquivoPDFIndividual=0`,
      `NomeArquivo=${this.outputFilePath}`,
    ].join('\r\n');
  }

  inicializar() {
    const config = getAppConfig();
    const configPath = path.join(config.runtime.tempDir, 'acbr-config.ini');
    const configIni = this.buildConfigIni();

    fs.writeFileSync(configPath, configIni, 'utf8');
    logger.info('library.config.generated', { configPath });

    const handleArr: [any] = [null];
    const ret = this.Boleto_Inicializar(handleArr, configPath, '');

    this.assertSuccess('Boleto_Inicializar', ret, handleArr[0]);

    this.handle = handleArr[0];
    if (!this.handle) {
      throw new AcbrIntegrationError('ACBr inicializou mas retornou handle nulo');
    }

    logger.info('library.initialized', { hasHandle: Boolean(this.handle) });
  }

  limparLista() {
    const ret = this.Boleto_LimparLista(this.handle);
    this.assertSuccess('Boleto_LimparLista', ret);
  }

  incluirTitulos(iniPath: string) {
    const retorno = Buffer.alloc(4096);
    logger.info('library.incluirTitulos.start', { iniPath });
    const ret = this.Boleto_IncluirTitulos(this.handle, iniPath, retorno, retorno.length);
    logger.info('library.incluirTitulos.done', { ret });
    this.assertSuccess('Boleto_IncluirTitulos', ret);
  }

  gerarPDF() {
    const ret = this.Boleto_GerarPDF(this.handle);
    if (ret !== 0) {
      // Nao chamar UltimoRetorno apos falha em GerarPDF: a lib entra em estado
      // invalido e qualquer chamada subsequente causa Segmentation fault.
      logger.info('library.operation.finished', { operation: 'Boleto_GerarPDF', ret });
      throw new AcbrIntegrationError('Falha na operacao Boleto_GerarPDF', {
        operation: 'Boleto_GerarPDF',
        ret,
        ultimoRetorno: '(indisponivel: lib em estado invalido apos falha no GerarPDF)',
      });
    }
    this.assertSuccess('Boleto_GerarPDF', ret);
  }

  ultimoRetorno(): string {
    if (!this.handle) {
      return '';
    }

    const buffer = Buffer.alloc(4096);
    this.Boleto_UltimoRetorno(this.handle, buffer, buffer.length);
    return buffer.toString('utf8').replace(/\0/g, '').trim();
  }

  finalizar() {
    if (!this.handle) {
      return;
    }

    this.Boleto_Finalizar(this.handle);
    this.handle = null;
    logger.info('library.finalized');
  }

  getConfiguredPdfPath() {
    return this.outputFilePath;
  }

  getOutputDir() {
    return this.outputDir;
  }

  private formatTelefone(raw?: string): string {
    const digits = (raw ?? '').replace(/\D/g, '');
    if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return raw?.trim() || '-';
  }

  private assertSuccess(operation: string, ret: number, handleOverride = this.handle) {
    logger.info('library.operation.finished', { operation, ret });
    if (ret === 0) {
      return;
    }

    const ultimoRetorno = this.readLastReturn(handleOverride);
    throw new AcbrIntegrationError(`Falha na operacao ${operation}`, {
      operation,
      ret,
      ultimoRetorno,
    });
  }

  private readLastReturn(handleOverride = this.handle) {
    if (!handleOverride) {
      return '';
    }

    try {
      const buffer = Buffer.alloc(4096);
      this.Boleto_UltimoRetorno(handleOverride, buffer, buffer.length);
      return buffer.toString('utf8').replace(/\0/g, '').trim();
    } catch {
      return '';
    }
  }
}

export default ACBrBoleto;
