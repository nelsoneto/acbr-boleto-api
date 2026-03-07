// src/server.ts
import Fastify from 'fastify';
import cors from '@fastify/cors';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { z } from 'zod';

import ACBrBoleto from './lib/ACBrBoleto.js';
import { BoletoSchema, ACBrParser } from './lib/ACBrParser.js';

// ==============================
// ENV
// ==============================
dotenv.config({
  path:
    process.env.NODE_ENV === 'production'
      ? '.env.prod'
      : '.env.dev',
});

// ==============================
// FASTIFY
// ==============================
const server = Fastify({ logger: true });

await server.register(cors, { origin: true });

const PORT = Number(process.env.PORT || 3001);

// ==============================
// ACBr SINGLETON
// ==============================
const acbr = ACBrBoleto.getInstance();

// ==============================
// HEALTH CHECK
// ==============================
server.get('/', async () => {
  return { status: '🚀 ACBr API Online' };
});

// ==============================
// EXEMPLO (helper para testes)
// ==============================
server.get('/api/gerar-boleto', async () => {
  return {
    NumeroDocumento: '000001',
    Vencimento: '31/12/2026',
    Valor: 150.00,
    Sacado_Nome: 'João da Silva',
    Sacado_CNPJCPF: '123.456.789-09',
    Sacado_Logradouro: 'Rua das Flores',
    Sacado_Numero: '123',
    Sacado_Bairro: 'Centro',
    Sacado_Cidade: 'Porto Velho',
    Sacado_UF: 'RO',
    Sacado_CEP: '76801-000',
    Mensagem: 'Referente ao serviço prestado em Janeiro/2026',
    fileName: 'boleto-000001',  // opcional — nome do arquivo .ini temporário
  };
});

// ==============================
// REQUEST SCHEMA
// ==============================
const RequestSchema = BoletoSchema.extend({
  fileName: z.string().optional(),
});

type BoletoRequest = z.infer<typeof RequestSchema>;

// ==============================
// GERAR BOLETO
// ==============================
server.post('/api/gerar-boleto', async (request, reply) => {
  let iniPath: string | null = null;

  try {
    // ==========================
    // VALIDAÇÃO ZOD
    // ==========================
    const parseResult = RequestSchema.safeParse(request.body);

    if (!parseResult.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Dados inválidos',
        issues: parseResult.error.issues.map(e => ({
          campo: e.path.join('.'),
          mensagem: e.message,
        })),
      });
    }

    const body: BoletoRequest = parseResult.data;

    // ==========================
    // GERAR CONTEÚDO INI
    // ==========================
    const iniContent = ACBrParser.dadosParaIni(body);

    // ==========================
    // TEMP DIR
    // ==========================
    const tempDir = path.resolve('./temp');

    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const nomeArquivo = body.fileName || Date.now().toString();
    iniPath = path.join(tempDir, `${nomeArquivo}.ini`);

    fs.writeFileSync(iniPath, iniContent, 'utf8');
    console.log('📝 INI salvo:', iniPath);

    // ==========================
    // FLUXO ACBr
    // ==========================
    let ret;

    ret = acbr.limparLista();
    if (ret !== 0) throw new Error(`limparLista falhou: ret=${ret}`);

    ret = acbr.incluirTitulos(iniPath);
    if (ret !== 0) throw new Error(`incluirTitulos falhou: ret=${ret} — ${acbr.ultimoRetorno()}`);

    ret = acbr.gerarPDF();
    if (ret !== 0) throw new Error(`gerarPDF falhou: ret=${ret} — ${acbr.ultimoRetorno()}`);

    console.log('✅ PDF gerado');

    return reply.send({
      sucesso: true,
      mensagem: 'Boleto gerado com sucesso',
    });

  } catch (err: any) {
    console.error('🔥 ERRO:', err?.message ?? err);
    console.error(err?.stack);

    return reply.status(500).send({
      statusCode: 500,
      error: 'Internal Server Error',
      message: err?.message || String(err),
    });

  } finally {
    // Remove o arquivo INI temporário após o processamento
    if (iniPath && fs.existsSync(iniPath)) {
      fs.unlinkSync(iniPath);
    }
  }
});

// ==============================
// START
// ==============================
server.listen({
  port: PORT,
  host: '0.0.0.0',
}).then(() => {
  console.log('🚀 Online');
});