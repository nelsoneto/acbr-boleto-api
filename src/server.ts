import Fastify from 'fastify';
import cors from '@fastify/cors';
import fs from 'fs';
import path from 'path';
import { ACBrBoleto } from './lib/ACBrBoleto.js';
import { ACBrParser, BoletoSchema } from './lib/ACBrParser.js';
import z from 'zod';


const server = Fastify({ logger: true });

server.register(cors, { origin: '*' });

// Criar pasta temp se não existir
if (!fs.existsSync('./temp')) fs.mkdirSync('./temp');

server.post('/api/gerar-boleto', async (request, reply) => {
  // Instanciar fora para garantir acesso no finally
  const acbr = new ACBrBoleto();

  try {
    // Validar antes de qualquer lógica pesada
    // parse() lança ZodError automaticamente, caindo no seu catch (err instanceof z.ZodError)
    const dadosValidados = BoletoSchema.parse(request.body);

    // Inicializar a Lib
    acbr.inicializar(path.resolve('acbrlib.ini'), '');

    // Usar o Parser (agora com garantia de tipos)
    const tituloIni = ACBrParser.dadosParaIni(dadosValidados);

    acbr.limparLista();
    acbr.incluirTitulos(tituloIni, 'I');

    // Configurações e Geração
    acbr.configGravarValor("Principal", "LogPath", path.resolve('logs'));
    acbr.configGravarValor("BoletoCedenteConfig", "Nome", "Minha Empresa Mock");
    acbr.configGravarValor("BoletoBancoConfig", "TipoCobranca", "cobItau");
    
    // Configura onde o PDF será salvo
    const tempDir = path.resolve('./temp');
    acbr.configGravarValor("BoletoDiretorioConfig", "PathPDF", tempDir);
    acbr.configGravarValor("BoletoDiretorioConfig", "DirLogo", "");
    
    acbr.gerarPDF();

    // Localizar o arquivo gerado
    // Nota: A ACBrLib costuma nomear o arquivo baseado no NumeroDocumento ou um padrão interno
    const pdfPath = path.join(tempDir, `boleto_${dadosValidados.NumeroDocumento}.pdf`);
    
    // Pequena espera ou verificação se o arquivo existe (DLLs as vezes são assíncronas no I/O)
    if (!fs.existsSync(pdfPath)) {
        throw new Error("Falha ao localizar o PDF gerado pela DLL.");
    }

    const buffer = fs.readFileSync(pdfPath);

    // Retorno
    return reply
      .type('application/pdf')
      .send(buffer);

  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return reply.status(400).send({ 
        error: "Dados inválidos", 
        details: err.flatten().fieldErrors 
      });
    }
    server.log.error(err);
    return reply.status(500).send({ error: err.message });
  } finally {
    // SEMPRE finalizar para liberar memória RAM e arquivos
    try { acbr.finalizar(); } catch (e) { /* ignore */ }
  }
});

server.listen({ port: 3001, host: '0.0.0.0' }, (err) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log('🚀 API ACBr Boleto rodando em http://localhost:3001');
});