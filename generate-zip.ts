import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ZipArchive } from 'archiver';

const appDir = (() => {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.url) {
      return path.dirname(fileURLToPath(import.meta.url));
    }
  } catch {}
  return process.cwd();
})();

export async function createPublicationZip(
  outputZipPath?: string, 
  dataDump?: any
): Promise<{ success: boolean; filePath: string; sizeBytes: number }> {
  const rootDir = process.cwd() || appDir;
  const targetZipPath = outputZipPath || path.join(rootDir, 'publicacao-site-studio.zip');

  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(targetZipPath);
    const archive = new ZipArchive({
      zlib: { level: 9 } // Maximum compression
    });

    output.on('close', () => {
      const sizeBytes = archive.pointer();
      console.log(`[ZIP Generator] Pacote de publicação gerado com sucesso: ${targetZipPath} (${(sizeBytes / 1024 / 1024).toFixed(2)} MB)`);
      resolve({
        success: true,
        filePath: targetZipPath,
        sizeBytes,
      });
    });

    archive.on('error', (err) => {
      console.error('[ZIP Generator] Erro ao criar arquivo ZIP:', err);
      reject(err);
    });

    archive.pipe(output);

    // 1. Arquivo de Instruções Passo a Passo
    const readmeContent = `# GUIA COMPLETO DE PUBLICAÇÃO DO SITE & PAINEL DO STUDIO

Parabéns! Este arquivo ZIP contém todo o sistema do seu estúdio/salão pronto para publicação em produção na internet.

Este pacote é atualizado automaticamente pelo sistema sempre que alterações são realizadas no painel administrativo (serviços, profissionais, permissões, fotos, promoções, dados de contato e financeiro).

---

## 🚀 OPÇÕES DE HOSPEDAGEM E PUBLICAÇÃO

### OPÇÃO 1: HOSPEDAGEM COM NODE.JS / SERVIDOR COMPLETO (RECOMENDADO)
Ideal para ter todas as funcionalidades: agendamentos, banco de dados criptografado SQLite, notificações em tempo real, fidelidade, indicações, financeiro e personalização.

1. Plataformas Gratuitas / Acessíveis:
   - **Render** (render.com): Crie um "Web Service", selecione Node.js, comando de build: \`npm install && npm run build\`, comando de start: \`npm start\`.
   - **Railway** (railway.app): Crie um projeto a partir desta pasta e execute \`npm start\`.
   - **VPS / cPanel com Node.js Selector**:
     - Envie o conteúdo deste ZIP para a pasta da sua aplicação (ex: \`public_html\` ou pasta da aplicação Node no cPanel).
     - Instale os pacotes: \`npm install --production\`
     - Configure o arquivo de inicialização como: \`dist/server.cjs\`
     - Inicie a aplicação no painel!

### OPÇÃO 2: HOSPEDAGEM ESTÁTICA DO FRONTEND (Vercel, Netlify, Cloudflare Pages, Hostinger)
Se você deseja publicar apenas a parte visual do site em serviços como Netlify ou Vercel:
1. A pasta **dist/** contém todos os arquivos HTML, CSS, JavaScript, imagens e fontes estáticas já compilados.
2. Basta arrastar a pasta **dist/** para o Netlify Drop ou apontar o diretório de publicação para ela.

---

## 🔒 CREDENCIAIS DE ACESSO AO SISTEMA

- **Acesso Secreto do Técnico (Exclusivo)**:
  - Usuário: \`cleiltonlira\`
  - Senha: \`21061994\`
  - *Função*: Técnico Responsável / Super Admin. Acesso exclusivo aos arquivos-fonte e pacote de publicação do site.

- **Acesso da Administradora do Salão**:
  - Usuário padrão: \`admin\`
  - Senha padrão: \`admin123\`
  - *Nota*: A administradora pode alterar suas credenciais no Painel > Dados & Pagamento.

- **Acesso das Colaboradoras da Equipe**:
  - Usuários e senhas individuais configurados na aba "Equipe & Acessos", com permissões selecionadas por caixa de seleção para cada módulo (Studio, Clientes, Fidelidade, Agendamentos, etc).

- **Acesso 100% Discreto**:
  - O acesso da equipe e administradora é integrado na mesma tela das clientes para máxima discrição.

- **Segurança Militar & LGPD**:
  - Dados de clientes (CPF, WhatsApp, anotações) protegidos com criptografia autenticada AES-256-GCM em repouso.
  - Senhas com algoritmo de derivação criptográfica \`scrypt\` com salt individual de 128 bits.
  - Escudo Anti-Robô com Honeypot ativo e bloqueio por IP contra ataques de força bruta.

---

## 📁 ESTRUTURA DO PACOTE

- \`src/\`: Todo o código-fonte React / TypeScript atualizado
- \`dist/\`: Código compilado de alta performance para produção
- \`database.sqlite\`: Banco de dados já estruturado com serviços, configurações e equipe
- \`site-backup-dados-atualizados.json\`: Exportação completa em JSON dos dados atuais do site
- \`server.ts\`: Servidor Node.js Express com proteção e rotas da API
- \`package.json\`: Dependências e comandos de execução (\`npm start\`)
- \`.env.example\`: Modelo de variáveis de ambiente

---

© Studio Bella Beauty - Sistema de Agendamento Profissional. Todos os direitos reservados.
`;

    archive.append(readmeContent, { name: 'COMO-PUBLICAR.md' });
    archive.append(readmeContent, { name: 'INSTRUCOES-PUBLICACAO.txt' });

    // 2. Incluir JSON com dados atualizados do site se fornecido
    if (dataDump) {
      archive.append(JSON.stringify(dataDump, null, 2), { name: 'site-backup-dados-atualizados.json' });
    }

    // 3. Incluir a pasta src/ completa
    const srcDir = path.join(rootDir, 'src');
    if (fs.existsSync(srcDir)) {
      archive.directory(srcDir, 'src');
    }

    // 4. Incluir pasta public/ se existir
    const publicDir = path.join(rootDir, 'public');
    if (fs.existsSync(publicDir)) {
      archive.directory(publicDir, 'public');
    }

    // 5. Incluir a pasta dist/ se existir
    const distDir = path.join(rootDir, 'dist');
    if (fs.existsSync(distDir)) {
      archive.directory(distDir, 'dist');
    }

    // 6. Incluir o database.sqlite se existir
    const dbPath = path.join(rootDir, 'database.sqlite');
    if (fs.existsSync(dbPath)) {
      archive.file(dbPath, { name: 'database.sqlite' });
    }

    // 7. Incluir arquivos-fonte essenciais
    const sourceFiles = [
      'package.json',
      '.env.example',
      'index.html',
      'server.ts',
      'security-firewall.ts',
      'generate-zip.ts',
      'vite.config.ts',
      'tsconfig.json',
      'tsconfig.node.json'
    ];

    for (const fileName of sourceFiles) {
      const filePath = path.join(rootDir, fileName);
      if (fs.existsSync(filePath)) {
        archive.file(filePath, { name: fileName });
      }
    }

    // 8. Finalizar arquivo ZIP
    archive.finalize();
  });
}

// Se executado diretamente via terminal (ex: tsx generate-zip.ts)
if (process.argv[1] && process.argv[1].endsWith('generate-zip.ts')) {
  createPublicationZip()
    .then((res) => {
      console.log('ZIP pronto:', res.filePath);
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
