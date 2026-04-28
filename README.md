# Envolve · Sistema Operacional

Sistema interno da Envolve. Marketing/captação, social selling, comercial e finanças num só hub.

## Estrutura

```
.
├── index.html               → Hub central (porta de entrada)
├── hawkins-marketing.html   → Comercial · Leads & Propostas (captação)
├── social-selling.html      → Prospecção e engajamento multi-canal
├── comercial.html           → Carteira ativa, pipeline e plano de vendas
├── controle-financeiro.html → Receitas e despesas PF + PJ
├── netlify.toml             → Configuração de deploy
└── README.md                → Este arquivo
```

## Deploy no Netlify

### Opção 1 — Drag & Drop (mais rápido, ~30 segundos)

1. Acesse https://app.netlify.com/drop
2. Arraste a pasta inteira do projeto pra área indicada
3. Pronto — o Netlify gera uma URL pública (ex: `https://nome-aleatorio.netlify.app`)
4. Pra trocar o nome da URL: Site settings → Site name → Change site name

### Opção 2 — Git (recomendado pra atualizações contínuas)

1. Suba os arquivos pra um repositório Git (GitHub, GitLab ou Bitbucket)
   ```
   git init
   git add .
   git commit -m "Sistema Envolve inicial"
   git remote add origin <url-do-seu-repo>
   git push -u origin main
   ```
2. No Netlify: **Add new site → Import from Git**
3. Conecte o repo, deixe build settings como `publish: .` (já configurado no `netlify.toml`)
4. Cada push no `main` vira deploy automático

### Opção 3 — Netlify CLI (pra quem usa terminal)

```bash
npm install -g netlify-cli
netlify login
cd /caminho/da/pasta
netlify deploy --prod
```

## Domínio customizado

Depois do deploy, em **Domain settings → Add custom domain**, configure (ex: `envolve.com.br`). O Netlify gera SSL automático em ~1 minuto.

## Importante saber sobre os dados

**Os dados ficam no navegador (localStorage), não no servidor Netlify.**

Implicações:
- ✅ Privacidade total — nenhum dado sai do seu navegador
- ✅ Funciona offline depois do primeiro carregamento
- ✅ Zero custo de servidor/banco
- ⚠️ Cada navegador tem seus próprios dados — se você usar 2 computadores, eles não sincronizam
- ⚠️ Limpar cache do navegador apaga os dados (use Exportar JSON pra fazer backup)
- ⚠️ Se compartilhar o link com alguém, ela verá o sistema vazio (não os seus dados)

### Backup recomendado

Cada módulo tem botão **Exportar JSON** na aba Dados. Recomendado:
- Backup mensal — guarde os JSONs no Google Drive/Dropbox
- Antes de trocar de navegador ou limpar cache

## Quem deve ter acesso?

Como os dados são locais ao navegador, qualquer pessoa com a URL pode usar — mas só verá os próprios dados (que ela mesma cadastrou).

Se quiser **restringir o acesso**, use Netlify Identity ou Password Protection (em Settings → Visitor access). Plan gratuito do Netlify suporta password básico nas Forms; pra autenticação real considere o plano Pro.

## Atualizações futuras

Sempre que precisar atualizar:
1. **Drag & drop:** arraste a nova pasta inteira no painel do site (vai sobrescrever)
2. **Git:** commit + push, deploy automático
3. **CLI:** `netlify deploy --prod`

Os dados dos usuários (no navegador deles) **não** são afetados por atualizações no código.

## Suporte técnico

Tudo é HTML/CSS/JS puro num único arquivo por módulo, com Chart.js carregado via CDN. Nenhuma dependência de build, framework ou backend.

Se algo quebrar:
1. Abra o módulo em modo anônimo (descarta cache)
2. Console do navegador (F12) mostra erros JS
3. Cada módulo tem botão "Apagar todos os dados" como fallback
