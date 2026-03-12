import koffi from 'koffi';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

    const isWindows = process.platform === 'win32';
    const convention = isWindows ? '__stdcall' : '__cdecl';

    const libName = isWindows
      ? 'ACBrBoleto64.dll'
      : 'libacbrboleto64.so';

    const libPath = path.resolve(__dirname, '../../bin', libName);
    this.outputDir = path.resolve(__dirname, '../../temp/pdf');
    this.outputFilePath = path.join(this.outputDir, 'boleto.pdf');

    console.log('📦 Carregando ACBrLib:', libPath);

    this.lib = koffi.load(libPath);

    /**
     * O handle da ACBrLib é um ponteiro opaco (TObject do Pascal).
     * koffi.out(koffi.pointer('void *')) devolve um External opaco
     * que é passado de volta intacto para todas as funções da DLL.
     * int/int64 causam segfault porque a DLL dereferencia o handle como ponteiro.
     */
    this.Boleto_Inicializar = this.lib.func(
      convention,
      'Boleto_Inicializar',
      'int',
      [koffi.out(koffi.pointer('void *')), 'string', 'string']
    );

    this.Boleto_Finalizar = this.lib.func(
      convention,
      'Boleto_Finalizar',
      'int',
      ['void *']
    );

    this.Boleto_IncluirTitulos = this.lib.func(
      convention,
      'Boleto_IncluirTitulos',
      'int',
      ['void *', 'string', 'void *', 'int']
    );

    this.Boleto_GerarPDF = this.lib.func(
      convention,
      'Boleto_GerarPDF',
      'int',
      ['void *']
    );

    this.Boleto_LimparLista = this.lib.func(
      convention,
      'Boleto_LimparLista',
      'int',
      ['void *']
    );

    this.Boleto_UltimoRetorno = this.lib.func(
      convention,
      'Boleto_UltimoRetorno',
      'int',
      ['void *', 'void *', 'int']
    );

    this.inicializar();
  }

  // ===============================
  // SINGLETON
  // ===============================
  static getInstance() {
    if (!this.instance) {
      this.instance = new ACBrBoleto();
    }
    return this.instance;
  }

  // ===============================
  // INIT
  // ===============================
  inicializar() {

    // --------------------------------------------------
    // Gera o INI de configuração da DLL a partir dos envs
    // --------------------------------------------------
    const configDir = path.resolve(__dirname, '../../temp');
    if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });

    const configPath = path.join(configDir, 'acbr-config.ini');
    // Permite sobrescrever via .env e mantém fallback para o projeto local/container.
    const logoDir = process.env.DIR_LOGO ?? path.resolve(__dirname, '../../assets/logos');
    const bancoNumero = (process.env.CEDENTE_BANCO ?? '').replace(/\D/g, '').padStart(3, '0');
    const logoEnv = (process.env.LOGO_BANCO ?? '').trim();
    const layoutBoleto = process.env.BOLETO_LAYOUT ?? '1';
    const escalaBoleto = process.env.BOLETO_ESCALA ?? '92';
    const margemSuperior = process.env.BOLETO_MARGEM_SUPERIOR ?? '6';
    const margemInferior = process.env.BOLETO_MARGEM_INFERIOR ?? '6';
    const margemEsquerda = process.env.BOLETO_MARGEM_ESQUERDA ?? '5';
    const margemDireita = process.env.BOLETO_MARGEM_DIREITA ?? '4';

    let logoBancoPath = '';
    if (logoEnv) {
      logoBancoPath = path.isAbsolute(logoEnv)
        ? logoEnv
        : path.resolve(__dirname, '../../', logoEnv);
    } else {
      const logoBmp = path.join(logoDir, `${bancoNumero}.bmp`);
      const logoPng = path.join(logoDir, `${bancoNumero}.png`);
      if (fs.existsSync(logoBmp)) logoBancoPath = logoBmp;
      else if (fs.existsSync(logoPng)) logoBancoPath = logoPng;
    }

    // Aliases para aumentar compatibilidade.
    if (logoBancoPath && fs.existsSync(logoBancoPath)) {
      const aliasNames = [
        `${bancoNumero}.bmp`,
        `${bancoNumero}-0.bmp`,
        `${bancoNumero}_0.bmp`,
        'Banco.bmp',
        'banco.bmp',
      ];
      for (const aliasName of aliasNames) {
        const aliasPath = path.join(logoDir, aliasName);
        if (!fs.existsSync(aliasPath)) {
          fs.copyFileSync(logoBancoPath, aliasPath);
        }
      }
      console.log('🏦 Logo banco selecionada:', logoBancoPath);
    } else {
      console.log('⚠️ Logo do banco não encontrada para', bancoNumero, 'em', logoDir);
    }

    if (!fs.existsSync(this.outputDir)) fs.mkdirSync(this.outputDir, { recursive: true });

    const formatTelefone = (raw?: string) => {
      const digits = (raw ?? '').replace(/\D/g, '');
      if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
      if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
      return raw?.trim() || '-';
    };

    const nomeCedenteBoleto = (process.env.CEDENTE_NOME_BOLETO ?? process.env.CEDENTE_NOME ?? '').trim();
    const cedenteDoc = (process.env.CEDENTE_CNPJCPF ?? '').replace(/\D/g, '');
    const tipoCedente = cedenteDoc.length === 14 ? 2 : 1;
    const convenioRaw = (process.env.CEDENTE_CONVENIO ?? '').trim();
    const convenio = /^0+$/.test(convenioRaw) ? '' : convenioRaw;
    const cedenteLogradouro = (process.env.CEDENTE_LOGRADOURO ?? '-').trim() || '-';
    const cedenteNumero = (process.env.CEDENTE_NUMERO ?? '-').trim() || '-';
    const cedenteBairro = (process.env.CEDENTE_BAIRRO ?? '-').trim() || '-';
    const cedenteCidade = (process.env.CEDENTE_CIDADE ?? '-').trim() || '-';
    const cedenteUF = (process.env.CEDENTE_UF ?? '--').trim() || '--';
    const cedenteCEP = (process.env.CEDENTE_CEP ?? '').replace(/\D/g, '') || '00000000';
    const cedenteTelefone = formatTelefone(process.env.CEDENTE_TELEFONE);

    const configIni = [
      `[ACBrBoleto]`,
      `TipoCobranca=${process.env.TIPO_COBRANCA ?? 'cobBancoTeste'}`,
      ``,
      `[BoletoCedenteConfig]`,
      `Nome=${nomeCedenteBoleto}`,
      `CNPJCPF=${cedenteDoc}`,
      `TipoInscricao=${tipoCedente}`,
      `Agencia=${process.env.CEDENTE_AGENCIA ?? ''}`,
      `AgenciaDigito=${process.env.CEDENTE_AGENCIA_DIGITO ?? '0'}`,
      `Conta=${process.env.CEDENTE_CONTA ?? ''}`,
      `ContaDigito=${process.env.CEDENTE_CONTA_DIGITO ?? '0'}`,
      `Carteira=${process.env.CEDENTE_CARTEIRA ?? '1'}`,
      `Convenio=${convenio}`,
      `CodigoCedente=${process.env.CEDENTE_CODIGO_CEDENTE ?? ''}`,
      `CodigoTransmissao=${process.env.CEDENTE_CODIGO_TRANSMISSAO ?? ''}`,
      `Modalidade=${process.env.CEDENTE_MODALIDADE ?? '1'}`,
      `TipoCarteira=${process.env.CEDENTE_TIPO_CARTEIRA ?? '1'}`,
      `TipoDocumento=${process.env.CEDENTE_TIPO_DOCUMENTO ?? 'DM'}`,
      `ResponEmissao=${process.env.CEDENTE_RESPON_EMISSAO ?? '1'}`,
      `Logradouro=${cedenteLogradouro}`,
      `NumeroRes=${cedenteNumero}`,
      `Bairro=${cedenteBairro}`,
      `Cidade=${cedenteCidade}`,
      `UF=${cedenteUF}`,
      `CEP=${cedenteCEP}`,
      `Telefone=${cedenteTelefone}`,
      ``,
      `[BoletoBancoConfig]`,
      `Numero=${process.env.CEDENTE_BANCO ?? ''}`,
      ``,
      `[BoletoDiretorioConfig]`,
      `DirArqRemessa=${configDir}`,
      `DirArqRetorno=${configDir}`,
      ``,
      `[BoletoBancoFCFortesConfig]`,
      `DirLogo=${logoDir}`,
      `LogoMarca=${logoBancoPath}`,
      `Layout=${layoutBoleto}`,
      `AlterarEscalaPadrao=1`,
      `NovaEscala=${escalaBoleto}`,
      `MargemSuperior=${margemSuperior}`,
      `MargemInferior=${margemInferior}`,
      `MargemEsquerda=${margemEsquerda}`,
      `MargemDireita=${margemDireita}`,
      `CalcularNomeArquivoPDFIndividual=0`,
      `NomeArquivo=${this.outputFilePath}`,
    ].join('\r\n');

    fs.writeFileSync(configPath, configIni, 'utf8');
    console.log('📄 Config INI gerado:', configPath);

    // --------------------------------------------------
    // Inicializa a DLL passando o caminho do config INI
    // --------------------------------------------------
    const handleArr: [any] = [null];

    const ret = this.Boleto_Inicializar(
      handleArr,
      configPath,
      ''
    );

    console.log('🔧 Boleto_Inicializar ret:', ret);

    if (ret !== 0)
      throw new Error(`Erro Inicializar ACBr: ret=${ret}`);

    this.handle = handleArr[0];

    console.log('🔧 Handle recebido:', this.handle);

    if (!this.handle)
      throw new Error('ACBr inicializou (ret=0) mas o handle é nulo');

    console.log('✅ ACBr inicializado com sucesso');
  }

  limparLista() {
    const ret = this.Boleto_LimparLista(this.handle);
    console.log('🔧 limparLista ret:', ret);
    return ret;
  }

  incluirTitulos(iniContent: string) {
    const retorno = Buffer.alloc(4096);
    const ret = this.Boleto_IncluirTitulos(this.handle, iniContent, retorno, retorno.length);
    console.log('🔧 incluirTitulos ret:', ret);
    return ret;
  }

  gerarPDF() {
    const ret = this.Boleto_GerarPDF(this.handle);
    console.log('🔧 gerarPDF ret:', ret);
    return ret;
  }

  ultimoRetorno(): string {

    const buffer = Buffer.alloc(2048);

    this.Boleto_UltimoRetorno(
      this.handle,
      buffer,
      buffer.length
    );

    return buffer.toString('utf8').replace(/\0/g, '');
  }

  finalizar() {
    if (this.handle) {
      this.Boleto_Finalizar(this.handle);
      this.handle = null;
    }
  }

  getConfiguredPdfPath() {
    return this.outputFilePath;
  }

  getOutputDir() {
    return this.outputDir;
  }
}

export default ACBrBoleto;