import path from 'path';
// import { fileURLToPath } from 'url';

const __dirname_root = path.resolve();
const binPath = path.join(__dirname_root, 'bin');

// Adiciona a pasta bin ao PATH do processo atual
// Isso garante que o Windows encontre as dependências que já estão lá dentro
process.env.PATH = binPath + ';' + process.env.PATH;

import { ACBrBoleto } from './lib/ACBrBoleto.js';

const acbr = new ACBrBoleto();

try {
    console.log('Diretório de dependências configurado:', binPath);
    console.log('--- Iniciando Teste ACBrLib ---');
    
    // Inicialização
    acbr.inicializar(path.resolve('acbrlib.ini'), "");
    console.log('✅ DLL Inicializada com sucesso!');

    // evitar vazamentos de memória ou travamento do arquivo de log
    acbr.finalizar();
    console.log('✅ DLL Finalizada corretamente.');
} catch (error: any) {
    console.error('❌ ERRO:', error.message);
}