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

        // Configuração mínima
        const configBase = `[Principal]\r\nTipoResposta=0\r\nCodificacao=0\r\n[BoletoDiretorioConfig]\r\nPathPDF=${TEMP_DIR}/\r\nNomeArquivo=${nomeArquivoPDF}\r\n`;
        fs.writeFileSync(iniConfigPath, configBase, 'latin1');

        const resInit = acbr.inicializar(iniConfigPath, '');
        if (resInit !== 0) throw new Error(`Erro Inicializar: ${resInit}`);

        // Configurações do Cedente (empresa emissora)
        acbr.configGravarValor("BoletoBancoConfig", "TipoCobranca", "cobBradesco");
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

        await new Promise(r => setTimeout(r, 100));

        acbr.limparLista();
        const resInc = acbr.incluirTitulos(iniTituloPath);
        console.log(`📝 Incluir: ${resInc} | Arquivo: ${iniTituloPath}`);

        if (resInc !== 0) throw new Error(`Erro Incluir: ${resInc}`);

        if (acbr.gerarPDF() !== 0) throw new Error("Erro PDF");

        await new Promise(r => setTimeout(r, 500));
        const pdfPath = path.join(TEMP_DIR, nomeArquivoPDF);

        if (!fs.existsSync(pdfPath)) throw new Error("PDF sumiu!");

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