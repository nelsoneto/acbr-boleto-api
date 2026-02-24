import koffi from 'koffi';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ACBrBoleto {
    private lib: any;
    private Boleto_Inicializar: any;
    private Boleto_Finalizar: any;
    private Boleto_ConfigGravarValor: any;
    private Boleto_IncluirTitulos: any;
    private Boleto_GerarPDF: any;

    constructor() {
        const isWindows = process.platform === 'win32';
        
        const convention = isWindows ? '__stdcall' : '__cdecl';
        
        const dllPath = path.resolve(__dirname, '../../bin/ACBrBoleto64.dll');
        
        // Adiciona o diretório da DLL ao PATH para carregar dependências (ex: libxml2, openssl)
        const binPath = path.dirname(dllPath);
        const pathEnv = process.env.PATH || '';
        if (!pathEnv.includes(binPath)) {
            process.env.PATH = `${binPath}${path.delimiter}${pathEnv}`;
        }

        console.log('Carregando DLL em:', dllPath);

        try {
            this.lib = koffi.load(dllPath);

            this.Boleto_Inicializar = this.lib.func(convention, 'Boleto_Inicializar', 'int', ['string', 'string']);
            this.Boleto_Finalizar = this.lib.func(convention, 'Boleto_Finalizar', 'int', []);
            this.Boleto_ConfigGravarValor = this.lib.func(convention, 'Boleto_ConfigGravarValor', 'int', ['string', 'string', 'string']);
            this.Boleto_IncluirTitulos = this.lib.func(convention, 'Boleto_IncluirTitulos', 'int', ['string', 'string']);
            this.Boleto_GerarPDF = this.lib.func(convention, 'Boleto_GerarPDF', 'int', []);

        } catch (e) {
            throw new Error(`Falha no carregamento: ${e}`);
        }
    }

    inicializar(config = '', chave = '') {
        
        const res = this.Boleto_Inicializar(config, chave);
        return res;
    }
    configGravarValor(secao: string, chave: string, valor: string) {
        return this.Boleto_ConfigGravarValor(secao, chave, valor);
    }
    incluirTitulos(titulosIni: string, modo: string) {
        return this.Boleto_IncluirTitulos(titulosIni, modo);
    }
    gerarPDF() {
        return this.Boleto_GerarPDF();
    }

    limparLista() {
        // Para limpar a lista de títulos, basta chamar incluirTitulos com uma string vazia
        return this.Boleto_IncluirTitulos('', 'I');
    }

    finalizar() {
        return this.Boleto_Finalizar();
    }
}

export { ACBrBoleto };