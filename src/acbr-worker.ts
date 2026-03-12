import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

import ACBrBoleto from './lib/ACBrBoleto.js';

dotenv.config({
  path:
    process.env.NODE_ENV === 'production'
      ? '.env.prod'
      : '.env.dev',
  quiet: true,
});

async function main() {
  const iniPath = process.argv[2];
  const nomeArquivo = process.argv[3] || Date.now().toString();

  if (!iniPath) {
    throw new Error('Parâmetro iniPath não informado');
  }

  if (!fs.existsSync(iniPath)) {
    throw new Error(`INI não encontrado: ${iniPath}`);
  }

  const iniContent = fs.readFileSync(iniPath, 'utf8');
  const acbr = ACBrBoleto.getInstance();

  let ret = acbr.limparLista();
  if (ret !== 0) throw new Error(`limparLista falhou: ret=${ret}`);

  ret = acbr.incluirTitulos(iniContent);
  if (ret !== 0) throw new Error(`incluirTitulos falhou: ret=${ret}`);

  ret = acbr.gerarPDF();
  if (ret !== 0) throw new Error(`gerarPDF falhou: ret=${ret}`);

  const pdfBasePath = acbr.getConfiguredPdfPath();
  const pdfDir = acbr.getOutputDir();
  if (!fs.existsSync(pdfDir)) {
    fs.mkdirSync(pdfDir, { recursive: true });
  }

  const pdfNome = `${nomeArquivo}.pdf`;
  const pdfFinalPath = path.join(pdfDir, pdfNome);

  let pdfOrigemPath = pdfBasePath;
  if (!fs.existsSync(pdfOrigemPath)) {
    const pdfs = fs.readdirSync(pdfDir)
      .filter(name => name.toLowerCase().endsWith('.pdf'))
      .map(name => {
        const fullPath = path.join(pdfDir, name);
        const stat = fs.statSync(fullPath);
        return { fullPath, mtimeMs: stat.mtimeMs };
      })
      .sort((a, b) => b.mtimeMs - a.mtimeMs);

    if (pdfs.length === 0) {
      throw new Error(`PDF não encontrado no caminho configurado (${pdfBasePath}) e nenhum PDF foi encontrado em ${pdfDir}`);
    }

    pdfOrigemPath = pdfs[0].fullPath;
  }

  fs.copyFileSync(pdfOrigemPath, pdfFinalPath);

  process.stdout.write(`__RESULT__${JSON.stringify({ pdfPath: pdfFinalPath })}\n`);
}

main().catch((err: any) => {
  const msg = err?.message || String(err);
  process.stderr.write(msg);
  process.exit(1);
});
