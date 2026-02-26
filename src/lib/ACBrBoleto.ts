// lib/ACBrBoleto.ts
import koffi from 'koffi';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ACBrBoleto {
    private lib: any;
    private hACBr: any = null; 

    private Boleto_Inicializar: any;
    private Boleto_Finalizar: any;
    private Boleto_IncluirTitulos: any;
    private Boleto_GerarPDF: any;
    private Boleto_LimparLista: any;
    private Boleto_ConfigGravarValor: any;

    constructor() {
        const isWindows = process.platform === 'win32';
        const convention = isWindows ? '__stdcall' : '__cdecl';
        const libFileName = isWindows ? 'ACBrBoleto64.dll' : 'libacbrboleto64.so';
        const binPath = path.resolve(__dirname, '../../bin');
        const libPath = path.join(binPath, libFileName);

        try {
            this.lib = koffi.load(libPath);

            // Assinaturas definitivas usando os tipos corretos do Koffi
            this.Boleto_Inicializar = this.lib.func(convention, 'Boleto_Inicializar', 'int', [koffi.out('uintptr *'), 'string', 'string']);
            this.Boleto_Finalizar = this.lib.func(convention, 'Boleto_Finalizar', 'int', ['uintptr']);
            this.Boleto_ConfigGravarValor = this.lib.func(convention, 'Boleto_ConfigGravarValor', 'int', ['uintptr', 'string', 'string', 'string']);
            this.Boleto_IncluirTitulos = this.lib.func(convention, 'Boleto_IncluirTitulos', 'int', ['uintptr', 'string', 'string']);
            this.Boleto_GerarPDF = this.lib.func(convention, 'Boleto_GerarPDF', 'int', ['uintptr']);
            this.Boleto_LimparLista = this.lib.func(convention, 'Boleto_LimparLista', 'int', ['uintptr']);
        } catch (e) {
            throw new Error(`Erro ao carregar biblioteca: ${e}`);
        }
    }

    inicializar(eArqConfig: string = '', eChaveCrypt: string = '') {
        const outHandle: [bigint | null] = [null]; // Placeholder para um ponteiro de saída
        const res = this.Boleto_Inicializar(outHandle, eArqConfig, eChaveCrypt); // Passa o array
        if (res === 0) {
            this.hACBr = outHandle[0];
            console.log(`✅ Handle obtido: ${this.hACBr}`);
        } else {
            console.error(`❌ Erro Inicializar: ${res}`);
        }
        return res;
    }

    configGravarValor(secao: string, chave: string, valor: string) {
        if (!this.hACBr) return -10;
        const res = this.Boleto_ConfigGravarValor(this.hACBr, secao, chave, valor);
        console.log(`⚙️ ConfigGravarValor [${secao}.${chave}=${valor}] -> ${res}`);
        return res;
    }

    incluirTitulos(caminhoIni: string) {
        if (!this.hACBr) return -10;
        console.log(`📄 Tentando incluir título: ${caminhoIni}`);
        const res = this.Boleto_IncluirTitulos(this.hACBr, caminhoIni, 'I');
        console.log(`📝 Resultado incluirTitulos: ${res}`);
        return res;
    }

    limparLista() { 
        if (!this.hACBr) return -10; 
        const res = this.Boleto_LimparLista(this.hACBr);
        console.log(`🧹 LimparLista -> ${res}`);
        return res;
    }

    gerarPDF() { 
        if (!this.hACBr) return -10; 
        const res = this.Boleto_GerarPDF(this.hACBr);
        console.log(`📑 GerarPDF -> ${res}`);
        return res;
    }

    finalizar() {
        if (!this.hACBr) return 0;
        const res = this.Boleto_Finalizar(this.hACBr);
        console.log(`🔚 Finalizar -> ${res}`);
        this.hACBr = null;
        return res;
    }
}

export { ACBrBoleto };