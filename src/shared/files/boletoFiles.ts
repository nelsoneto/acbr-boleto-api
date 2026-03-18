import fs from "fs";
import path from "path";

export function sanitizeFileId(value?: string) {
  const normalized = (value || "boleto")
    .normalize("NFD")
    .replace(/[^\w\s-]/g, "")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/_/g, "-");

  return normalized.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 60) || "boleto";
}

export function ensureDirectory(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

export function buildUniqueFileId(directories: string[], preferred?: string) {
  const base = sanitizeFileId(preferred); // Base do nome do arquivo (sem extensão)
  let suffix = 0;

  while (true) {
    const candidate =
      suffix === 0
        ? `${base}-${Date.now()}`
        : `${base}-${Date.now()}-${suffix}`;
    const exists = directories.some((dir) => {
      const iniPath = path.join(dir, `${candidate}.ini`);
      const pdfPath = path.join(dir, `${candidate}.pdf`);
      return fs.existsSync(iniPath) || fs.existsSync(pdfPath);
    });

    if (!exists) {
      return candidate;
    }

    suffix += 1;
  }
}

export function cleanupExpiredFiles(
  dirPath: string, // Diretório a ser limpo
  ttlHours: number, // Tempo de vida em horas
  allowedExtensions: string[], // Ex: [".pdf", ".ini"]
) {
  if (!fs.existsSync(dirPath)) {
    // Diretorio não existe, nada a limpar.
    return;
  }

  const ttlMs = ttlHours * 60 * 60 * 1000; // Converte horas -> milissegundos
  const now = Date.now();

  // Verifica cada arquivo no diretório.
  for (const entry of fs.readdirSync(dirPath)) {
    const fullPath = path.join(dirPath, entry);
    const stat = fs.statSync(fullPath);

    if (!stat.isFile()) {
      continue;
    }

    const extension = path.extname(entry).toLowerCase();
    if (!allowedExtensions.includes(extension)) {
      continue;
    }

    if (now - stat.mtimeMs > ttlMs) {
      // Se o arquivo é mais velho que o TTL..
      fs.unlinkSync(fullPath); // ...remove o arquivo.
    }
  }
}

export function resolvePdfPath(pdfDir: string, fileId: string) {
  const safeId = sanitizeFileId(fileId); // Garante que o fileId seja seguro para uso como nome de arquivo.
  return path.join(pdfDir, `${safeId}.pdf`);
}
