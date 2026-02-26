// src/server.ts
import Fastify from 'fastify';
import cors from '@fastify/cors';
import fs from 'fs';
import path from 'path';
import { ACBrBoleto } from './lib/ACBrBoleto.js';
import { ACBrParser, BoletoSchema } from './lib/ACBrParser.js';
import { z } from 'zod';

type BoletoInput = z.infer<typeof BoletoSchema>;
const server = Fastify();
server.register(cors, { origin: '*' });

const TEMP_DIR = '/app/temp';

server.post('/api/gerar-boleto', async (request, reply) => {
    const acbr = new ACBrBoleto();
    const body = request.body as BoletoInput;
    const numeroDoc = body.NumeroDocumento || Date.now().toString();
    const nomeArquivoPDF = `boleto_${numeroDoc}.pdf`;

    const iniConfigPath = path.join(TEMP_DIR, `cfg_${numeroDoc}.ini`);
    const iniTituloPath = path.join(TEMP_DIR, `tit_${numeroDoc}.ini`);

    try {
        const dados = BoletoSchema.parse(body);

        // Configuração base, agora incluindo as seções que a ACBrLib espera encontrar na inicialização.
        const configBase = [
            '[Principal]',
            'TipoResposta=0',
            'Codificacao=0',
            '[BoletoBancoConfig]',
            '[BoletoCedenteConfig]',
            `[BoletoDiretorioConfig]\r\nPathPDF=${TEMP_DIR}/\r\nNomeArquivo=${nomeArquivoPDF}\r\n`
        ].join('\r\n');
        fs.writeFileSync(iniConfigPath, configBase, 'latin1');

        const resInit = acbr.inicializar(iniConfigPath, '');
        if (resInit !== 0) throw new Error(`Erro Inicializar: ${resInit}`);

        // Configurações do Cedente 
        acbr.configGravarValor("BoletoBancoConfig", "TipoCobranca", "cobBancoTeste");
        acbr.configGravarValor("BoletoCedenteConfig", "Nome", "SUA EMPRESA LTDA");
        acbr.configGravarValor("BoletoCedenteConfig", "CNPJCPF", "12345678000195"); // CNPJ válido
        acbr.configGravarValor("BoletoCedenteConfig", "Agencia", "1234");
        acbr.configGravarValor("BoletoCedenteConfig", "Conta", "56789");
        acbr.configGravarValor("BoletoCedenteConfig", "ContaDigito", "0");

        // Campos adicionais obrigatórios
        acbr.configGravarValor("BoletoCedenteConfig", "Convenio", "1234567");
        acbr.configGravarValor("BoletoCedenteConfig", "CodigoTransmissao", "123456");
        acbr.configGravarValor("BoletoCedenteConfig", "CodigoCedente", "123456");
        acbr.configGravarValor("BoletoCedenteConfig", "Modalidade", "1");
        acbr.configGravarValor("BoletoCedenteConfig", "TipoCarteira", "1");
        acbr.configGravarValor("BoletoCedenteConfig", "TipoDocumento", "1");
        acbr.configGravarValor("BoletoCedenteConfig", "ResponEmissao", "1");

        // Gerar título
        let tituloConteudo = ACBrParser.dadosParaIni(dados);
        tituloConteudo = tituloConteudo.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        fs.writeFileSync(iniTituloPath, tituloConteudo, 'latin1');

        console.log('📄 Conteúdo do título INI:\n', tituloConteudo);

        acbr.limparLista();
        const resInc = acbr.incluirTitulos(iniTituloPath);
        console.log(`📝 Incluir: ${resInc} | Arquivo: ${iniTituloPath}`);

        if (resInc !== 0) throw new Error(`Erro Incluir: ${resInc}`);

        if (acbr.gerarPDF() !== 0) throw new Error("Erro ao chamar GerarPDF. Verifique os logs da ACBr.");

        const pdfPath = path.join(TEMP_DIR, nomeArquivoPDF);

        // Função robusta para aguardar a criação do arquivo pela lib nativa
        const waitForFile = async (filePath: string, timeoutMs = 3000) => {
            const start = Date.now();
            while (Date.now() - start < timeoutMs) {
                if (fs.existsSync(filePath) && fs.statSync(filePath).size > 0) {
                    return true;
                }
                await new Promise(resolve => setTimeout(resolve, 100)); // Tenta a cada 100ms
            }
            return false;
        }

        if (!await waitForFile(pdfPath)) {
            throw new Error(`Timeout: O arquivo PDF não foi encontrado ou está vazio após 3 segundos. Verifique os logs da ACBr na pasta /logs.`);
        }

        const pdfBuffer = fs.readFileSync(pdfPath);

        // Limpeza
        [iniConfigPath, iniTituloPath, pdfPath].forEach(f => { if(fs.existsSync(f)) fs.unlinkSync(f); });

        return reply.type('application/pdf').send(pdfBuffer);

    } catch (err: any) {
        console.error('❌', err.message);
        return reply.status(500).send({ error: err.message });
    } finally {
        acbr.finalizar();
    }
});

server.listen({ port: 3001, host: '0.0.0.0' }).then(() => console.log('🚀 Online'));