# Dropaine Banner

Primeira versão funcional do sistema web para criar artes de:

- Filmes
- Séries
- Futebol
- Logo e telefone personalizados
- Login com usuário e senha
- Histórico de artes

## 1. O que já funciona

- Tela de login protegida
- Painel principal responsivo
- Minha Marca (nome, telefone e troca de logo)
- Pesquisa de Filmes e Séries via TMDB
- Futebol do dia via API-Sports / API-Football
- Geração de banner 1080 x 1350
- Inserção automática da logo e WhatsApp
- Legenda automática básica
- Integração opcional com webhook do n8n para gerar legenda por IA
- Histórico das artes
- Dockerfile pronto para EasyPanel

## 2. Variáveis de ambiente

Copie `.env.example` para `.env` no ambiente local ou cadastre as variáveis direto no EasyPanel.

Obrigatórias:
- `SESSION_SECRET`
- `ADMIN_USER`
- `ADMIN_PASSWORD`

Para Filmes e Séries:
- `TMDB_API_KEY`

Para Futebol:
- `APISPORTS_KEY`

Opcional:
- `N8N_CAPTION_WEBHOOK_URL`

## 3. Rodar localmente

```bash
npm install
npm start
```

Abra:
`http://localhost:3000`

## 4. Subir no EasyPanel

Crie um novo projeto/serviço para o Dropaine Banner.

Use o `Dockerfile` deste projeto e exponha a porta:

`3000`

Cadastre as variáveis de ambiente no serviço.

É importante criar volumes persistentes para:

`/app/data`

`/app/uploads`

Assim o banco SQLite, sua logo e as artes continuam existindo mesmo se o container for recriado.

## 5. Primeiro acesso

O usuário e senha são definidos pelas variáveis:

`ADMIN_USER`

`ADMIN_PASSWORD`

Não deixe a senha de exemplo em produção.

## 6. Próximas etapas sugeridas

- Escolha de modelos de banner
- Editor de posição/tamanho da logo
- Gerador de legenda por IA
- Canal de transmissão automático para jogos
- Filtro de campeonatos brasileiros
- PWA para instalar no celular
- Recuperação/troca de senha
- Administração de vários usuários
- Integração direta com Evolution API / WhatsApp
