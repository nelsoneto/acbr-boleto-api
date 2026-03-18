export interface BoletoWorkerGateway {
  gerar(iniPath: string, nomeArquivo: string): Promise<string>;
}
