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

  private constructor() {

    const isWindows = process.platform === 'win32';
    const convention = isWindows ? '__stdcall' : '__cdecl';

    const libName = isWindows
      ? 'ACBrBoleto64.dll'
      : 'libacbrboleto64.so';

    const libPath = path.resolve(__dirname, '../../bin', libName);

    console.log('📦 Carregando ACBrLib:', libPath);

    this.lib = koffi.load(libPath);

    /**
     * No Linux 64-bit, o handle da ACBrLib é PtrInt (8 bytes = ponteiro).
     * void * é o tipo correto — platform-sized e opaco.
     * koffi.out(koffi.pointer('void *')) garante a leitura do valor de saída.
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
      ['void *', 'string', 'string']
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
      ['void *', 'string', 'int']
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

    const cedenteDoc = (process.env.CEDENTE_CNPJCPF ?? '').replace(/\D/g, '');
    const tipoCedente = cedenteDoc.length === 14 ? 2 : 1;

    const configIni = [
      `[ACBrBoleto]`,
      `TipoCobranca=${process.env.TIPO_COBRANCA ?? 'cobBancoTeste'}`,
      ``,
      `[Cedente]`,
      `Nome=${process.env.CEDENTE_NOME ?? ''}`,
      `CNPJCPF=${cedenteDoc}`,
      `TipoInscricao=${tipoCedente}`,
      `Banco=${process.env.CEDENTE_BANCO ?? ''}`,
      `Agencia=${process.env.CEDENTE_AGENCIA ?? ''}`,
      `AgenciaDigito=${process.env.CEDENTE_AGENCIA_DIGITO ?? '0'}`,
      `Conta=${process.env.CEDENTE_CONTA ?? ''}`,
      `ContaDigito=${process.env.CEDENTE_CONTA_DIGITO ?? '0'}`,
      `Carteira=${process.env.CEDENTE_CARTEIRA ?? '1'}`,
      `Convenio=${process.env.CEDENTE_CONVENIO ?? ''}`,
      `CodigoCedente=${process.env.CEDENTE_CODIGO_CEDENTE ?? ''}`,
      `CodigoTransmissao=${process.env.CEDENTE_CODIGO_TRANSMISSAO ?? ''}`,
      `Modalidade=${process.env.CEDENTE_MODALIDADE ?? '1'}`,
      `TipoCarteira=${process.env.CEDENTE_TIPO_CARTEIRA ?? '1'}`,
      `TipoDocumento=${process.env.CEDENTE_TIPO_DOCUMENTO ?? 'DM'}`,
      `ResponEmissao=${process.env.CEDENTE_RESPON_EMISSAO ?? '1'}`,
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
    console.log('🔧 limparLista ret:', ret, '| DLL:', this.ultimoRetorno());
    return ret;
  }

  incluirTitulos(iniPath: string) {
    const ret = this.Boleto_IncluirTitulos(this.handle, iniPath, 'I');
    console.log('🔧 incluirTitulos ret:', ret, '| DLL:', this.ultimoRetorno());
    return ret;
  }

  gerarPDF() {
    const ret = this.Boleto_GerarPDF(this.handle);
    console.log('🔧 gerarPDF ret:', ret, '| DLL:', this.ultimoRetorno());
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
}

export default ACBrBoleto;