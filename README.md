# Bot DownTorrents Games Discord 🏴‍☠️

Este é um bot robusto e multifuncional para Discord, desenvolvido especificamente para a comunidade **DownTorrentsGames**. Ele atua como o núcleo de gerenciamento do servidor, automatizando a publicação de jogos/softwares, gerenciando suporte, anúncios bilíngues e mantendo uma biblioteca pesquisável via Banco de Dados.

> **Versão Atual:** v53 (PostgreSQL Edition + Free Games API)

## ✨ Funcionalidades Principais

### 📚 Biblioteca e Busca Inteligente
* **Banco de Dados PostgreSQL:** Todos os jogos e softwares são salvos em um banco de dados robusto.
* **Busca Inteligente (`/dtg buscar`):** Usuários podem pesquisar jogos instantaneamente com geração de tags automáticas.
* **Requisitos do Sistema (`/dtg requisitos`):** Integração com a **Steam Store API** para buscar e exibir os requisitos mínimos e recomendados de PC para qualquer jogo diretamente no chat.

### 🎁 Monitor de Jogos Grátis (Novo!)
* **Rastreamento Automático:** O bot monitora a API da *GamerPower* a cada 15 minutos.
* **Alertas em Tempo Real:** Sempre que um jogo pago fica 100% grátis (Steam, Epic, GOG, etc.), o bot avisa automaticamente no canal configurado.
* **Cache Inteligente:** Evita repetição de anúncios de jogos já postados.

### 📊 Estatísticas do Servidor (Live Stats)
* **Contadores Dinâmicos:** Cria canais de voz bloqueados que funcionam como contadores atualizados em tempo real (ou a cada 10 min) para:
    * 👥 Total de Membros (Piratas).
    * 🎮 Total de Jogos na Biblioteca.
    * 💾 Total de Softwares na Biblioteca.
    * 📅 Data Atual.
* *Nota: Funcionalidade otimizada para operar exclusivamente no Servidor Principal.*

### 📡 Sistema de Broadcast (Feed de Notícias)
* **Distribuição de Conteúdo:** Outros servidores podem "assinar" o feed do DownTorrents Games.
* **Publicação Automática:** Quando um novo jogo/software é adicionado no servidor principal, o bot envia um aviso formatado para todos os servidores parceiros configurados.

### 🚨 Sistema de Reporte e Suporte
* **Link Quebrado (`/dtg linkquebrado`):** Formulário para reportar links off. A Staff recebe um painel para corrigir e o bot avisa o usuário na DM quando resolvido.
* **Pedidos (`/dtg pedido`):** Sistema bilíngue (PT/EN) para solicitação de novos jogos com seleção de plataforma.
* **Chat Manual (`/dtg chat`):** Canal de texto privado temporário (Ticket) entre Staff e Membro.

---

## 🚀 Instalação e Configuração

### Pré-requisitos
* **Node.js** (v16 ou superior)
* **PostgreSQL** (Banco de dados local ou na nuvem)

### Passo a Passo

1.  **Clone o repositório:**
    ```bash
    git clone [https://github.com/MrG3H/Bot-DTG-Discord.git](https://github.com/MrG3H/Bot-DTG-Discord.git)
    cd Bot-DTG-Discord
    ```

2.  **Instale as dependências:**
    ```bash
    npm install
    ```

3.  **Configure o `.env`:**
    ```env
    DISCORD_TOKEN=SEU_TOKEN
    OWNER_ID=SEU_ID
    DISCORD_CLIENT_ID=SEU_CLIENT_ID
    DATABASE_URL=postgres://usuario:senha@host:porta/nome_banco
    ```

4.  **Registre os comandos:**
    ```bash
    node deploy-commands.js
    ```

5.  **Inicie o bot:**
    ```bash
    node index.js
    ```

---

## 🎮 Lista de Comandos (/dtg)

### 🌍 Comandos Públicos (Para Membros)
| Comando | Descrição |
| :--- | :--- |
| `/dtg buscar [nome]` | 🔍 Pesquisa um jogo/software na biblioteca. |
| `/dtg requisitos [nome]` | 💻 Exibe os requisitos de sistema (Steam) do jogo. |
| `/dtg linkquebrado` | ⚠️ Reportar links offline. |
| `/dtg pedido` | 🇧🇷 Fazer pedido de jogo (PT-BR). |
| `/dtg order` | 🇺🇸 Request a game (EN). |
| `/dtg convite` | 📩 Gera o convite oficial com banner animado. |
| `/dtg ajuda` | ❓ Mostra informações de ajuda. |

### 🛡️ Comandos Administrativos (Apenas Dono do BOT)

**Gerenciamento de Conteúdo:**
| Comando | Descrição |
| :--- | :--- |
| `/dtg addjogo` | Adiciona jogo ao banco, posta no canal e faz broadcast. |
| `/dtg addsoft` | Adiciona software ao banco, posta no canal e faz broadcast. |
| `/dtg chat [usuario]` | Abre ticket de suporte privado com um usuário. |
| `/dtg limpar [qtd]` | Limpa mensagens do chat (Bulk Delete). |
| `/dtg avisotds` | 📢 Envia um aviso global para todos os servidores configurados. |
| `/dtg servidores` | 🌐 Lista todos os servidores onde o bot está. |
| `/dtg teste_gfree` | 🧪 Testa o envio de um jogo grátis (Force Push). |

**Configuração do Servidor:**
| Comando | Descrição |
| :--- | :--- |
| `/dtg setup_stats` | Cria os canais contadores (Membros, Jogos, Soft, Data). |
| `/dtg setup_faq` | Cria o menu fixo de Dúvidas Frequentes. |
| `/dtg config_boasvindas`| Define o canal de boas-vindas. |
| `/dtg configquebrado` | Define o canal de recebimento de reports. |
| `/dtg addpedido` | Cria o painel fixo de "Faça seu Pedido". |

**Broadcast e Jogos Grátis (Admin Server):**
| Comando | Descrição |
| :--- | :--- |
| `/dtg config_att` | Define o canal deste servidor para receber novidades do DTG. |
| `/dtg remove_att` | Para de receber novidades do DTG. |
| `/dtg config_game_free` | Define o canal para receber avisos de Jogos Grátis. |
| `/dtg remove_game_free` | Para de receber avisos de Jogos Grátis. |

---

## 💻 Tecnologias Utilizadas

* **[Node.js](https://nodejs.org/)**: Runtime JavaScript.
* **[Discord.js v14](https://discord.js.org/)**: API Discord.
* **[PostgreSQL (pg)](https://node-postgres.com/)**: Banco de dados.
* **[Node-Fetch](https://www.npmjs.com/package/node-fetch)**: Requisições API (Steam/GamerPower).
* **Google Translate API**: Tradução automática de conteúdo.

---

<div align="center">
  <b>Bot Privado desenvolvido para a comunidade DownTorrentsGames</b><br>
  Feito com ❤️ e Código por <a href="https://github.com/MrGeeH">MrGeeH</a>
</div>