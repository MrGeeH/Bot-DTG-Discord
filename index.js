// BY: MrGeH - Versão Final v53

require('dotenv').config();
const fs = require('fs');
const fetch = require('node-fetch');
const { Pool } = require('pg'); 

const {
    Client, GatewayIntentBits, EmbedBuilder, ActivityType, ModalBuilder,
    TextInputBuilder, TextInputStyle, ActionRowBuilder, Collection,
    PermissionFlagsBits, MessageFlags, StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder, ButtonBuilder, ButtonStyle, ComponentType,
    ChannelType
} = require('discord.js');

const { translate } = require('@vitalets/google-translate-api');

const TOKEN = process.env.DISCORD_TOKEN;
const OWNER_ID = process.env.OWNER_ID;
const PREFIX = '!dtg';
const DATABASE_URL = process.env.DATABASE_URL;

const AVISO_GIF_URL = "https://media3.giphy.com/media/v1.Y2lkPTc5MGI3NjExamQxcGRlanRhNWZvNnBnNnM3MDhqYXR2MmJ2czE1ZTQ0N2NkZHJsNyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/vqGMs1Sgv0y5gnbkMP/giphy.gif";
const INVITE_LINK = "https://discord.gg/uKCrBCNqCT";

// Logos das Lojas para o Thumbnail
const STORE_LOGOS = {
    'Steam': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/83/Steam_icon_logo.svg/512px-Steam_icon_logo.svg.png',
    'Epic Games Store': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/31/Epic_Games_logo.svg/512px-Epic_Games_logo.svg.png',
    'GOG': 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2e/GOG.com_logo.svg/512px-GOG.com_logo.svg.png',
    'Ubisoft': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/78/Ubisoft_logo.svg/512px-Ubisoft_logo.svg.png',
    'Itch.io': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/79/Itch.io_logo.svg/512px-Itch.io_logo.svg.png'
};
const DEFAULT_LOGO = 'https://cdn-icons-png.flaticon.com/512/263/263142.png';

if (!TOKEN || !OWNER_ID || !process.env.DISCORD_CLIENT_ID || !DATABASE_URL) {
    console.error("Erro: .env incompleto.");
    process.exit(1);
}

const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    keepAlive: true 
});

pool.on('error', (err, client) => {
    console.error('⚠️ Erro no Pool do PostgreSQL (não fatal):', err.message);
});

// Inicialização do Banco
pool.connect().then(async client => {
    console.log('✅ Conectado ao PostgreSQL com sucesso!');
    await client.query(`
        CREATE TABLE IF NOT EXISTS jogos (
            id SERIAL PRIMARY KEY,
            titulo TEXT NOT NULL,
            link TEXT NOT NULL,
            tipo TEXT NOT NULL,
            obs TEXT,
            tags_busca TEXT,
            data_add TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `);
    await client.query(`
        CREATE TABLE IF NOT EXISTS canais_externos (
            guild_id TEXT PRIMARY KEY,
            channel_id TEXT NOT NULL
        );
    `);
    await client.query(`
        CREATE TABLE IF NOT EXISTS canais_jogos_gratis (
            guild_id TEXT PRIMARY KEY,
            channel_id TEXT NOT NULL
        );
    `);
    // --- NOVO: Tabela para Configuração de Anti-Link ---
    await client.query(`
        CREATE TABLE IF NOT EXISTS anti_link_config (
            guild_id TEXT PRIMARY KEY
        );
    `);
    // ---------------------------------------------------
    console.log('📦 Tabelas verificadas/criadas.');
    client.release();
}).catch(err => console.error('❌ Erro fatal ao conectar no PostgreSQL:', err));

const configPath = './config.json';
function loadConfig() {
    const defaultStructure = { 
        presentationChannelId: null, 
        logChannelId: null, 
        welcomeChannelId: null, 
        reportChannelId: null,
        stats: { memberCh: null, gameCh: null, softCh: null, dateCh: null } 
    };
    if (fs.existsSync(configPath)) {
        try { 
            const current = JSON.parse(fs.readFileSync(configPath, 'utf8')); 
            if (!current.stats) current.stats = { memberCh: null, gameCh: null, softCh: null, dateCh: null };
            if (current.stats.softCh === undefined) current.stats.softCh = null;
            return { ...defaultStructure, ...current }; 
        } catch (error) { return defaultStructure; }
    }
    fs.writeFileSync(configPath, JSON.stringify(defaultStructure, null, 2));
    return defaultStructure;
}
let config = loadConfig();
function saveConfig() { fs.writeFileSync(configPath, JSON.stringify(config, null, 2)); }

function gerarTagsAutomaticas(titulo) {
    const t = titulo.toLowerCase();
    const limpo = t.replace(/[^a-z0-9 ]/g, '');
    const palavras = limpo.split(' ');
    const sigla = palavras.map(p => p.length > 0 ? p[0] : '').join('');
    return `${t} ${limpo} ${sigla}`;
}

function cleanSteamHTML(html) {
    if (!html) return 'Não informado.';
    return html.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
}

// --- FUNÇÃO DE JOGOS GRÁTIS (API GAMERPOWER) ---
const CACHE_FILE = './free_games_cache.json';
async function checkFreeGamesLoop(client) {
    try {
        const res = await fetch('https://www.gamerpower.com/api/giveaways?type=game&sort-by=date');
        const giveaways = await res.json();

        if (!giveaways || giveaways.length === 0) return;

        const latestGames = giveaways.slice(0, 3);
        let cachedIds = [];
        if (fs.existsSync(CACHE_FILE)) {
            try { cachedIds = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')); } catch(e) {}
        }

        const newGames = latestGames.filter(g => !cachedIds.includes(g.id)).reverse(); 

        if (newGames.length === 0) return; 

        const dbRes = await pool.query('SELECT channel_id FROM canais_jogos_gratis');
        const channels = dbRes.rows;

        if (channels.length === 0) {
            const allIds = latestGames.map(g => g.id);
            fs.writeFileSync(CACHE_FILE, JSON.stringify(allIds));
            return;
        }

        console.log(`🎁 Encontrados ${newGames.length} jogos grátis novos! Enviando...`);

        for (const game of newGames) {
            let storeIcon = DEFAULT_LOGO;
            for (const [store, icon] of Object.entries(STORE_LOGOS)) {
                if (game.platforms.includes(store)) { storeIcon = icon; break; }
            }
            const worth = game.worth === 'N/A' ? '' : `~~${game.worth}~~`;
            const endDate = game.end_date === 'N/A' ? 'Por tempo limitado' : `até ${game.end_date}`;
            
            const embed = new EmbedBuilder()
                .setTitle(game.title)
                .setURL(game.open_giveaway_url)
                .setDescription(`**${worth} Grátis** ${endDate}\n\n${game.description.substring(0, 300)}...`)
                .setColor('#2B2D31')
                .setThumbnail(storeIcon)
                .setImage(game.image)
                .setFooter({ text: `• DownTorrents Games •`, iconURL: client.user.displayAvatarURL() })
                .setTimestamp();

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setLabel('Abrir no Navegador ↗').setStyle(ButtonStyle.Link).setURL(game.open_giveaway_url),
                new ButtonBuilder().setLabel('Abrir Instruções').setStyle(ButtonStyle.Link).setURL(game.gamerpower_url)
            );

            for (const ch of channels) {
                try {
                    const channel = await client.channels.fetch(ch.channel_id);
                    if (channel) await channel.send({ content: '@everyone', embeds: [embed], components: [row] });
                } catch (e) {}
            }
            cachedIds.push(game.id);
        }

        if (cachedIds.length > 20) cachedIds = cachedIds.slice(-20);
        fs.writeFileSync(CACHE_FILE, JSON.stringify(cachedIds));

    } catch (error) {
        console.error('Erro no checkFreeGamesLoop:', error);
    }
}

const MAIN_GUILD_ID = '1130603259900469280';

async function updateServerStats(client) {
    // Verifica se há alguma configuração de canal antes de prosseguir
    if (!config.stats.memberCh && !config.stats.gameCh && !config.stats.softCh && !config.stats.dateCh) return;

    try {
        // 1. Busca ESPECIFICAMENTE o seu servidor principal
        // Se o bot não estiver nele, ou não encontrar, ele para a função aqui.
        const guild = await client.guilds.fetch(MAIN_GUILD_ID).catch(() => null);
        if (!guild) return; 

        // 2. Atualiza o cache de membros apenas desse servidor
        await guild.members.fetch().catch(() => {});

        // --- ATUALIZAÇÃO: MEMBROS ---
        if (config.stats.memberCh) {
            try {
                // Tenta pegar o canal DENTRO desse servidor específico
                const ch = await guild.channels.fetch(config.stats.memberCh).catch(() => null);
                if (ch) {
                    const humans = guild.members.cache.filter(member => !member.user.bot).size;
                    await ch.setName(`👥 Piratas: ${humans.toLocaleString('pt-BR')}`);
                }
            } catch (e) {}
        }

        // --- ATUALIZAÇÃO: JOGOS (Banco de Dados) ---
        if (config.stats.gameCh) {
            try {
                const ch = await guild.channels.fetch(config.stats.gameCh).catch(() => null);
                if (ch) {
                    const res = await pool.query("SELECT COUNT(*) FROM jogos WHERE tipo = 'jogo'");
                    const total = res.rows[0].count;
                    await ch.setName(`🎮 Jogos: ${total}`);
                }
            } catch (e) {}
        }

        // --- ATUALIZAÇÃO: SOFTWARES (Banco de Dados) ---
        if (config.stats.softCh) {
            try {
                const ch = await guild.channels.fetch(config.stats.softCh).catch(() => null);
                if (ch) {
                    const res = await pool.query("SELECT COUNT(*) FROM jogos WHERE tipo = 'software'");
                    const total = res.rows[0].count;
                    await ch.setName(`💾 Softwares: ${total}`);
                }
            } catch (e) {}
        }

        // --- ATUALIZAÇÃO: DATA ---
        if (config.stats.dateCh) {
            try {
                const ch = await guild.channels.fetch(config.stats.dateCh).catch(() => null);
                if (ch) {
                    const date = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                    await ch.setName(`📅 Data: ${date}`);
                }
            } catch (e) {}
        }

    } catch (error) {
        console.error("Erro ao atualizar stats do servidor principal:", error);
    }
}

async function broadcastNewContent(client, title, type, imgUrl, originalMessageUrl) {
    try {
        const res = await pool.query('SELECT channel_id, guild_id FROM canais_externos');
        const channels = res.rows;
        if (channels.length === 0) return;

        console.log(`📡 Iniciando broadcast para ${channels.length} canais externos...`);

        const tipoTextoPT = type === 'jogo' ? 'um Novo Jogo' : 'um Novo Software';
        const tipoTextoEN = type === 'jogo' ? 'a New Game' : 'a New Software';
        
        const description = `🇧🇷 Foi Adicionado ${tipoTextoPT} no **DownTorrents Games**!\n\n` +
                            `**${title}**\n\n` +
                            `Link do convite discord: [Clique Aqui](${INVITE_LINK})\n\n` +
                            `---------------------------------\n\n` +
                            `🇺🇸 ${tipoTextoEN} has been added to **DownTorrents Games**!\n\n` +
                            `**${title}**\n\n` +
                            `Discord invite link: [Click Here](${INVITE_LINK})`;

        const embed = new EmbedBuilder()
            .setTitle(type === 'jogo' ? '🎮 New Game Alert!' : '💾 New Software Alert!')
            .setDescription(description)
            .setColor(getRandomColor())
            .setThumbnail(imgUrl)
            .setImage(AVISO_GIF_URL)
            .setFooter({ text: 'DownTorrents Games - By: MrGeH', iconURL: client.user.displayAvatarURL() });

        const btn = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel('Ir para o Download | Go to Download')
                .setStyle(ButtonStyle.Link)
                .setURL(originalMessageUrl)
        );

        let sucesso = 0;
        let falha = 0;

        for (const row of channels) {
            try {
                const channel = await client.channels.fetch(row.channel_id);
                if (channel) {
                    await channel.send({ 
                        content: '📢 **Nova Atualização Disponível!** @everyone', 
                        embeds: [embed], 
                        components: [btn] 
                    });
                    sucesso++;
                } else { falha++; }
            } catch (err) { falha++; }
        }
        console.log(`✅ Broadcast finalizado. Sucessos: ${sucesso} | Falhas: ${falha}`);
    } catch (error) { console.error('Erro CRÍTICO no broadcast:', error); }
}

const FAQ_DATA = {
    'encurta': { title: '🔗 Como Passar no Encurtador de Links | How to Get Through a Link Shortener', desc: '🇧🇷\n1. Para Links do stfly na primeira janela click em "Click here to proceed". **Lembrando que toda vez que abrir uma aba nova você que fechar.**\n2. após isso irá a mesma aba mudara para uma tela com o print do link a seguir:\nhttps://biovetro.net/wp-content/uploads/2026/01/google_results.jpg\nVocê vai ver que em baixo do print tem um botão "Continue" Click nele e na mesma aba ele ira mudar para a pesquisa do google.\n\n3. No print ele da a instrução de você abrir o primeiro link da pesquisa com o site biovetro .net, então abra.\n4. Agora e so seguir os botões preto com "Begin", "Click here to verify". **Observação:** Tem um que ele pede para click na imagem abaixo, de um click no anuncio fecha aba e vá até o final da pagina e click no mesmo botão que ele vai continuar.\n5. Após passar por todo o encurtador ele tem que te levar ou para o **MediaFire** ou **Google Drive**, as vezes leva para Gofile\n\n**----------------------------------------------**\n\n🇺🇸\nFor stfly links, click "Click here to proceed" in the first window. Remember that every time a new tab opens, you must close it.\n2. After that, the same tab will change to a screen matching the following screenshot:\nhttps://biovetro.net/wp-content/uploads/2026/01/google_results.jpg\nYou will see a "Continue" button below the screenshot. Click it, and the same tab will redirect to a Google search.\n\n3. The screenshot provides instructions to open the first search result with the website biovetro .net; go ahead and open it.\n4. Now, just follow the black buttons labeled "Begin" and "Click here to verify." Note: There is one part where it asks you to click the image below; click the ad, close the new tab, scroll to the bottom of the page, and click the same button again to continue.\n5. After completing the entire shortener process, it should take you to either MediaFire or Google Drive (sometimes it leads to Gofile).\n' },
    'instalar': { title: '🛠️ Como Instalar | How to Install', desc: '🇧🇷\n1. Baixe o arquivo...\n\n🇺🇸\n1. Download the file...' },
    'dll': { title: '⚠️ Erro de DLL | DLL Error', desc: '🇧🇷\nErro de DLL...\n\n🇺🇸\nDLL errors...' },
    'online': { title: '🌐 Jogar Online | Play Online', desc: '🇧🇷 Jogos que funcionam online...\n\n🇺🇸 Games that work online...' },
    'pedido': { title: '📦 Como Pedir | How to Request', desc: '🇧🇷 Vá ao canal de pedidos...\n\n🇺🇸 Go to the order channel...' }
};

const embedColors = ['#5865F2', '#0099ff', '#41B454', '#E67E22', '#E91E63', '#9B59B6', '#F1C40F', '#1ABC9C', '#2ECC71', '#3498DB', '#E74C3C'];
function getRandomColor() { return embedColors[Math.floor(Math.random() * embedColors.length)]; }

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.DirectMessages, GatewayIntentBits.GuildMembers]
});

client.tempPedidoData = new Collection();
client.tempAddJogoData = new Collection();
client.activeChats = new Collection();
// --- NOVO: Cache para armazenar servidores com Anti-Link ativado ---
client.antiLinkGuilds = new Set();
// -------------------------------------------------------------------

client.on('clientReady', async () => { 
    console.log(`Bot ${client.user.tag} está online!`);
    
    // --- NOVO: Carregar configurações de Anti-Link do DB para a memória ---
    try {
        const res = await pool.query('SELECT guild_id FROM anti_link_config');
        res.rows.forEach(row => client.antiLinkGuilds.add(row.guild_id));
        console.log(`🔒 Anti-Link ativo em ${client.antiLinkGuilds.size} servidores.`);
    } catch (e) {
        console.error('Erro ao carregar anti_link_config:', e);
    }
    // ---------------------------------------------------------------------

    updateServerStats(client); 
    setInterval(() => updateServerStats(client), 600000); 
    
    checkFreeGamesLoop(client);
    setInterval(() => checkFreeGamesLoop(client), 900000);

    let i = 0;
    // LISTA DE STATUS ATUALIZADA (Inclui contagem de servers)
    setInterval(() => { 
        const serverCount = client.guilds.cache.size;
        const activities = [
            'Melhor Discord de Jogos', 
            'Criado por MrGeH!', 
            'Use /dtg linkquebrado', 
            'Use /dtg requisitos',
            `Ativo em ${serverCount} Servers` // NOVO STATUS
        ];
        client.user.setActivity(activities[i++ % activities.length], { type: ActivityType.Playing }); 
    }, 15000);
});

client.on('guildMemberAdd', async member => {
    updateServerStats(client);
    if (!config.welcomeChannelId) return;
    const channel = member.guild.channels.cache.get(config.welcomeChannelId);
    if (!channel) return;
    let desc = `🇧🇷 Seja bem-vindo(a) à **DownTorrentsGames**! <@${member.id}>\nLeia as regras e aproveite o conteúdo!\n\n`;
    desc += `🇺🇸 Welcome to **DownTorrentsGames**! <@${member.id}>\nRead the rules and enjoy the content!\n\n`;
    try {
        const res = await pool.query('SELECT titulo, link, tipo FROM jogos ORDER BY id DESC LIMIT 5');
        if (res.rows.length > 0) {
            desc += `---------------------------------\n**🔥 Últimos Lançamentos / Last Releases:**\n`;
            res.rows.forEach(g => desc += `• [${g.titulo}](${g.link}) (${g.tipo === 'jogo' ? '🎮' : '💾'})\n`);
        }
    } catch (e) {}
    const embed = new EmbedBuilder().setTitle(`Bem-vindo à Tripulação Pirata🏴‍☠️`).setDescription(desc).setThumbnail(member.user.displayAvatarURL()).setColor(getRandomColor()).setImage(AVISO_GIF_URL);
    await channel.send({ content: `<@${member.id}>`, embeds: [embed] });
});

client.on('guildMemberRemove', () => { updateServerStats(client); });

client.on('messageCreate', async message => {
    if (message.author.bot) return;
    
    // --- LÓGICA DO ANTI-LINK DINÂMICO ---
    // Verifica se o servidor atual está na lista de servidores protegidos
    if (message.guild && client.antiLinkGuilds.has(message.guild.id)) {
        // Se o usuário NÃO for Dono do Bot E NÃO tiver permissão de Gerenciar Mensagens (Mod/Adm)
        if (message.author.id !== OWNER_ID && !message.member?.permissions.has(PermissionFlagsBits.ManageMessages)) {
            // Verifica se tem link
            if (message.content.toLowerCase().includes('discord.gg/') || (message.content.includes('http') && message.attachments.size === 0)) {
                await message.delete().catch(()=>{});
                const w = await message.channel.send(`🚫 ${message.author}, links não são permitidos neste servidor!`);
                setTimeout(()=>w.delete().catch(()=>{}), 5000);
                return;
            }
        }
    }
    // -------------------------------------

    if (message.channel.type === ChannelType.DM) {
        const cId = client.activeChats.get(message.author.id);
        if (cId) {
            const c = client.channels.cache.get(cId);
            if (c) {
                const files = message.attachments.map(a => a.url);
                await c.send({ embeds: [new EmbedBuilder().setAuthor({name:message.author.tag, iconURL:message.author.displayAvatarURL()}).setDescription(message.content||'*Arquivo*').setColor('#00ff00')], files });
                await message.react('📨');
            }
            return;
        }
    }
    if (message.guild && client.activeChats.has(message.channel.id)) {
        const tId = client.activeChats.get(message.channel.id);
        const tUser = await client.users.fetch(tId).catch(()=>null);
        if (tUser) {
            const files = message.attachments.map(a => a.url);
            try { await tUser.send({ embeds: [new EmbedBuilder().setAuthor({name:`Staff: ${message.author.username}`, iconURL:message.guild.iconURL()}).setDescription(message.content||'*Arquivo*').setColor('#ff0000')], files }); await message.react('✅'); } catch(e) { message.reply('❌ Falha DM.'); }
        }
        return;
    }

    if (client.tempAddJogoData.has(message.author.id)) {
        const data = client.tempAddJogoData.get(message.author.id);
        if (data.status === 'awaiting_image') {
            const att = message.attachments.first();
            if (att && att.contentType.startsWith('image')) {
                client.tempAddJogoData.delete(message.author.id);
                const tags = gerarTagsAutomaticas(data.title);
                try {
                    await pool.query('INSERT INTO jogos (titulo, link, tipo, obs, tags_busca) VALUES ($1, $2, $3, $4, $5)', [data.title, data.link, data.type, data.obs||'', tags]);
                    const postedMessage = await sendGameOrSoftwareEmbed(data.interaction, data.primaryChannelId, data.notificationChannelId, data.title, data.obs, data.link, att.url, data.type);
                    updateServerStats(client);
                    
                    if (postedMessage) {
                        broadcastNewContent(client, data.title, data.type, att.url, postedMessage.url);
                    }

                    if(data.waitingMessageId) (await message.channel.messages.fetch(data.waitingMessageId)).delete().catch(()=>{});
                    await message.react('✅');
                } catch(e) { await message.reply('❌ Erro DB ou Broadcast.'); }
                return;
            } else { await message.reply('❌ Mande imagem.'); }
        }
    }

    if (!message.content.startsWith(PREFIX)) return;
    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const cmd = args.shift().toLowerCase();
    if (cmd === 'ajuda') await handleAjudaPrefix(message);
    else if (cmd === 'ajogo') message.reply('Use `/dtg addjogo`.');
});

client.on('interactionCreate', async interaction => {
    if (!interaction.inGuild()) {
        if (interaction.isRepliable()) return interaction.reply({ content: '⚠️ Este comando deve ser usado dentro de um servidor Discord.', flags: [MessageFlags.Ephemeral] });
        return;
    }

    if (interaction.isStringSelectMenu()) {
        if (interaction.customId.startsWith('pedido_platform_select_')) {
            const parts = interaction.customId.split('_');
            const u = parts[3];
            const l = parts[4];
            if (interaction.user.id !== u) return interaction.reply({content:'❌', flags:[MessageFlags.Ephemeral]});
            const d = client.tempPedidoData.get(u) || {};
            d.platform = interaction.values[0];
            client.tempPedidoData.set(u, d);
            const btn = new ButtonBuilder().setCustomId(`pedido_continue_button_${u}_${l}`).setLabel(l==='en'?'Continue':'Continuar').setStyle(ButtonStyle.Success).setDisabled(!(d.platform && d.online));
            await interaction.update({ components: [
                getPedidoPlatformSelectMenu(u, l, d.platform), 
                getPedidoOnlineSelectMenu(u, l, d.online), 
                new ActionRowBuilder().addComponents(btn)
            ] });
        }
        else if (interaction.customId.startsWith('pedido_online_select_')) {
            const parts = interaction.customId.split('_');
            const u = parts[3];
            const l = parts[4];
            if (interaction.user.id !== u) return interaction.reply({content:'❌', flags:[MessageFlags.Ephemeral]});
            const d = client.tempPedidoData.get(u) || {};
            d.online = interaction.values[0];
            client.tempPedidoData.set(u, d);
            const btn = new ButtonBuilder().setCustomId(`pedido_continue_button_${u}_${l}`).setLabel(l==='en'?'Continue':'Continuar').setStyle(ButtonStyle.Success).setDisabled(!(d.platform && d.online));
            await interaction.update({ components: [
                getPedidoPlatformSelectMenu(u, l, d.platform),
                getPedidoOnlineSelectMenu(u, l, d.online),
                new ActionRowBuilder().addComponents(btn)
            ] });
        }
        else if (interaction.customId === 'faq_select') {
            const val = interaction.values[0];
            if (FAQ_DATA[val]) {
                await interaction.reply({ embeds: [new EmbedBuilder().setTitle(FAQ_DATA[val].title).setDescription(FAQ_DATA[val].desc).setColor('#00FF00')], flags: [MessageFlags.Ephemeral] });
            }
        }
    }

    else if (interaction.isChatInputCommand()) {
        const { commandName, options } = interaction;
        if (commandName === 'dtg') {
            const subcommand = options.getSubcommand();
            const ownerOnly = ['aviso', 'addsoft', 'addjogo', 'limpar', 'addpedido', 'setup_faq', 'config_boasvindas', 'chat', 'configquebrado', 'setup_stats', 'teste_gfree', 'avisotds', 'servidores'];
            
            if (ownerOnly.includes(subcommand) && interaction.user.id !== OWNER_ID) {
                return interaction.reply({ content: '❌ Somente o Dono do Bot pode usar esse comando!', flags: [MessageFlags.Ephemeral] });
            }
            
            // --- ATUALIZADO: Lista de comandos de ADM ---
            const admCommands = ['config_att', 'remove_att', 'config_game_free', 'remove_game_free', 'proibirlink', 'remproibirlink'];
            // --------------------------------------------
            if (admCommands.includes(subcommand)) {
                if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
                    return interaction.reply({ content: '❌ Você precisa ser **Administrador** deste servidor para usar este comando.', flags: [MessageFlags.Ephemeral] });
                }
                if (subcommand === 'config_att') {
                    const channel = options.getChannel('canal');
                    try {
                        await pool.query(`INSERT INTO canais_externos (guild_id, channel_id) VALUES ($1, $2) ON CONFLICT (guild_id) DO UPDATE SET channel_id = $2`, [interaction.guildId, channel.id]);
                        return interaction.reply({ content: `✅ Configurado! Notícias DTG em <#${channel.id}>.` });
                    } catch (e) { return interaction.reply({ content: '❌ Erro ao salvar.', flags: [MessageFlags.Ephemeral] }); }
                }
                else if (subcommand === 'remove_att') {
                    try {
                        const res = await pool.query('DELETE FROM canais_externos WHERE guild_id = $1', [interaction.guildId]);
                        return interaction.reply({ content: res.rowCount > 0 ? `✅ Notificações DTG removidas!` : `⚠️ Nenhuma configuração encontrada.` });
                    } catch (e) { return interaction.reply({ content: '❌ Erro.', flags: [MessageFlags.Ephemeral] }); }
                }
                else if (subcommand === 'config_game_free') {
                    const channel = options.getChannel('canal');
                    try {
                        await pool.query(`INSERT INTO canais_jogos_gratis (guild_id, channel_id) VALUES ($1, $2) ON CONFLICT (guild_id) DO UPDATE SET channel_id = $2`, [interaction.guildId, channel.id]);
                        return interaction.reply({ content: `🎁 Configurado! **Jogos Grátis** serão avisados em <#${channel.id}>.` });
                    } catch (e) { return interaction.reply({ content: '❌ Erro ao salvar.', flags: [MessageFlags.Ephemeral] }); }
                }
                else if (subcommand === 'remove_game_free') {
                    try {
                        const res = await pool.query('DELETE FROM canais_jogos_gratis WHERE guild_id = $1', [interaction.guildId]);
                        return interaction.reply({ content: res.rowCount > 0 ? `🎁 Avisos de Jogos Grátis removidos!` : `⚠️ Nenhuma configuração encontrada.` });
                    } catch (e) { return interaction.reply({ content: '❌ Erro.', flags: [MessageFlags.Ephemeral] }); }
                }
                // --- NOVOS COMANDOS: ANTI-LINK ---
                else if (subcommand === 'proibirlink') {
                    try {
                        await pool.query(`INSERT INTO anti_link_config (guild_id) VALUES ($1) ON CONFLICT (guild_id) DO NOTHING`, [interaction.guildId]);
                        client.antiLinkGuilds.add(interaction.guildId);
                        return interaction.reply({ content: `🔒 **Sistema Anti-Link Ativado!**\nAgora, apenas Administradores e Moderadores podem enviar links neste servidor.` });
                    } catch (e) { return interaction.reply({ content: '❌ Erro ao ativar anti-link.', flags: [MessageFlags.Ephemeral] }); }
                }
                else if (subcommand === 'remproibirlink') {
                    try {
                        await pool.query('DELETE FROM anti_link_config WHERE guild_id = $1', [interaction.guildId]);
                        client.antiLinkGuilds.delete(interaction.guildId);
                        return interaction.reply({ content: `🔓 **Sistema Anti-Link Desativado!**\nTodos os membros podem enviar links novamente.` });
                    } catch (e) { return interaction.reply({ content: '❌ Erro ao desativar anti-link.', flags: [MessageFlags.Ephemeral] }); }
                }
                // ---------------------------------
            }

            // ===============================================
            // NOVO: COMANDO /dtg servidores
            // ===============================================
            if (subcommand === 'servidores') {
                if (interaction.user.id !== OWNER_ID) return interaction.reply({ content: '❌ Apenas o dono.', flags: [MessageFlags.Ephemeral] });
                
                const guilds = client.guilds.cache.map(guild => `• ${guild.name} (ID: ${guild.id}) - ${guild.memberCount} membros`).join('\n');
                
                // Divide se for muito grande
                if (guilds.length > 2000) {
                    const parts = guilds.match(/[\s\S]{1,1900}/g);
                    await interaction.reply({ content: `**🌐 Estou em ${client.guilds.cache.size} servidores:**\n(Lista parcial 1)`, flags: [MessageFlags.Ephemeral] });
                    for (const part of parts) {
                        await interaction.followUp({ content: part, flags: [MessageFlags.Ephemeral] });
                    }
                } else {
                    await interaction.reply({ content: `**🌐 Estou em ${client.guilds.cache.size} servidores:**\n\n${guilds}`, flags: [MessageFlags.Ephemeral] });
                }
            }

            if (subcommand === 'teste_gfree') {
                if (interaction.user.id !== OWNER_ID) return interaction.reply({ content: '❌ Apenas o dono.', flags: [MessageFlags.Ephemeral] });
                await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
                const targetChannel = options.getChannel('canal');
                try {
                    const res = await fetch('https://www.gamerpower.com/api/giveaways?type=game&sort-by=date');
                    const giveaways = await res.json();
                    if (!giveaways || giveaways.length === 0) return interaction.editReply('❌ Nenhum jogo encontrado na API agora.');
                    const game = giveaways[0];
                    let storeIcon = DEFAULT_LOGO;
                    for (const [store, icon] of Object.entries(STORE_LOGOS)) {
                        if (game.platforms.includes(store)) { storeIcon = icon; break; }
                    }
                    const worth = game.worth === 'N/A' ? '' : `~~${game.worth}~~`;
                    const endDate = game.end_date === 'N/A' ? 'Por tempo limitado' : `até ${game.end_date}`;
                    const embed = new EmbedBuilder().setTitle(game.title).setURL(game.open_giveaway_url).setDescription(`**${worth} Grátis** ${endDate}\n\n${game.description.substring(0, 300)}...`).setColor('#2B2D31').setThumbnail(storeIcon).setImage(game.image).setFooter({ text: 'via GamerPower • DownTorrents Games Bot', iconURL: client.user.displayAvatarURL() }).setTimestamp();
                    const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setLabel('Abrir no Navegador ↗').setStyle(ButtonStyle.Link).setURL(game.open_giveaway_url), new ButtonBuilder().setLabel('Abrir Instruções').setStyle(ButtonStyle.Link).setURL(game.gamerpower_url));
                    await targetChannel.send({ content: '@everyone', embeds: [embed], components: [row] });
                    await interaction.editReply(`✅ Teste enviado para <#${targetChannel.id}>!`);
                } catch (e) { console.error(e); await interaction.editReply('❌ Erro ao buscar ou enviar.'); }
            }
            if (subcommand === 'avisotds') {
                if (interaction.user.id !== OWNER_ID) return interaction.reply({ content: '❌ Apenas o dono.', flags: [MessageFlags.Ephemeral] });
                const modal = new ModalBuilder().setCustomId('avisotds_modal').setTitle('Aviso Global (Todos os Servidores)');
                modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('avisotds_titulo').setLabel('Título').setStyle(TextInputStyle.Short).setRequired(true)), new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('avisotds_corpo').setLabel('Mensagem').setStyle(TextInputStyle.Paragraph).setRequired(true)));
                await interaction.showModal(modal);
            }

            if (subcommand === 'ajuda') await handleAjudaSlash(interaction);
            else if (subcommand === 'buscar') {
                const termo = options.getString('nome').toLowerCase().trim();
                try {
                    const res = await pool.query(`SELECT * FROM jogos WHERE tags_busca ILIKE $1 OR titulo ILIKE $1 LIMIT 10`, [`%${termo}%`]);
                    if (res.rows.length === 0) return interaction.reply({content:`❌ Nada encontrado.`, flags:[MessageFlags.Ephemeral]});
                    let desc = `🔎 **Resultados:**\n\n`;
                    res.rows.forEach(r => desc += `${r.tipo==='jogo'?'🎮':'💾'} **[${r.titulo}](${r.link})**\n`);
                    await interaction.reply({ embeds: [new EmbedBuilder().setTitle('📚 Busca').setDescription(desc).setColor('#00FF00')], flags: [MessageFlags.Ephemeral] });
                } catch(e) { interaction.reply({content:'❌ Erro na busca.', flags:[MessageFlags.Ephemeral]}); }
            }
            else if (subcommand === 'setup_stats') {
                await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
                const tipo = options.getString('tipo'); 
                try {
                    const guild = interaction.guild || await client.guilds.fetch(interaction.guildId);
                    const perms = [{ id: guild.id, deny: [PermissionFlagsBits.Connect], allow: [PermissionFlagsBits.ViewChannel] }];
                    let createdChannel;
                    if (tipo === 'jogos') { createdChannel = await guild.channels.create({ name: '🎮 Jogos: ...', type: ChannelType.GuildVoice, permissionOverwrites: perms }); config.stats.gameCh = createdChannel.id; }
                    else if (tipo === 'softwares') { createdChannel = await guild.channels.create({ name: '💾 Softwares: ...', type: ChannelType.GuildVoice, permissionOverwrites: perms }); config.stats.softCh = createdChannel.id; }
                    else if (tipo === 'membros') { createdChannel = await guild.channels.create({ name: '👥 Membros: ...', type: ChannelType.GuildVoice, permissionOverwrites: perms }); config.stats.memberCh = createdChannel.id; }
                    else if (tipo === 'data') { createdChannel = await guild.channels.create({ name: '📅 Data: ...', type: ChannelType.GuildVoice, permissionOverwrites: perms }); config.stats.dateCh = createdChannel.id; }
                    saveConfig(); await updateServerStats(client);
                    await interaction.editReply({ content: `✅ Contador de **${tipo.toUpperCase()}** criado!` });
                } catch (err) { await interaction.editReply({ content: '❌ Erro ao criar canal.' }); }
            }
            else if (subcommand === 'requisitos') {
                await interaction.deferReply();
                const query = options.getString('nome');
                try {
                    const searchRes = await fetch(`https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(query)}&l=english&cc=US`).then(res => res.json());
                    if (!searchRes.items || searchRes.items.length === 0) return interaction.editReply({ content: `❌ Jogo não encontrado.` });
                    const appId = searchRes.items[0].id;
                    const detailsRes = await fetch(`https://store.steampowered.com/api/appdetails?appids=${appId}&l=brazilian`).then(res => res.json());
                    const data = detailsRes[appId].data;
                    const embedReq = new EmbedBuilder().setTitle(`💻 Requisitos: ${data.name}`).setColor('#0099ff').setThumbnail(data.header_image).setFooter({ text: 'Steam Store' });
                    embedReq.addFields({ name: '📉 Mínimo', value: cleanSteamHTML(data.pc_requirements?.minimum || 'N/A').substring(0, 1024) }, { name: '📈 Recomendado', value: cleanSteamHTML(data.pc_requirements?.recommended || 'N/A').substring(0, 1024) });
                    await interaction.editReply({ embeds: [embedReq], components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setLabel('Steam').setStyle(ButtonStyle.Link).setURL(`https://store.steampowered.com/app/${appId}`))] });
                } catch (error) { await interaction.editReply({ content: '❌ Erro ao buscar requisitos.' }); }
            }
            else if (subcommand === 'configquebrado') {
                config.reportChannelId = options.getChannel('canal').id; saveConfig(); await interaction.reply({ content: `✅ Configurado!`, flags: [MessageFlags.Ephemeral] });
            }
            else if (subcommand === 'linkquebrado') {
                if (!config.reportChannelId) return interaction.reply({ content: '❌ Sistema não configurado.', flags: [MessageFlags.Ephemeral] });
                const isPt = interaction.locale === 'pt-BR';
                const modal = new ModalBuilder().setCustomId(`report_broken_link_modal`).setTitle(isPt ? 'Reportar Link' : 'Report Broken Link');
                modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('broken_game_name').setLabel(isPt ? 'Nome do jogo:' : 'Game Name:').setStyle(TextInputStyle.Short).setRequired(true)), new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('broken_obs').setLabel(isPt ? 'Obs:' : 'Obs:').setStyle(TextInputStyle.Paragraph).setRequired(false)));
                await interaction.showModal(modal);
            }
            else if (subcommand === 'aviso') await handleAvisoChat(interaction);
            else if (subcommand === 'chat') { const u = options.getUser('usuario'); await createChatChannel(interaction, u.id); }
            else if (subcommand === 'addsoft') { 
                const p = options.getChannel('canal_principal'); const n = options.getChannel('canal_notificacao');
                const m = new ModalBuilder().setCustomId(`addsoft_modal_${p.id}_${n.id}`).setTitle('Add Soft');
                m.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('addsoft_titulo').setLabel("Título").setStyle(TextInputStyle.Short).setRequired(true)), new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('addsoft_link').setLabel("Link").setStyle(TextInputStyle.Short).setRequired(true)));
                await interaction.showModal(m);
            }
            else if (subcommand === 'addjogo') { 
                const p = options.getChannel('canal_principal'); const n = options.getChannel('canal_notificacao');
                const m = new ModalBuilder().setCustomId(`addjogo_modal_${p.id}_${n.id}`).setTitle('Add Jogo');
                m.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('addjogo_titulo').setLabel("Título").setStyle(TextInputStyle.Short).setRequired(true)), new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('addjogo_obs').setLabel("Obs").setStyle(TextInputStyle.Paragraph).setRequired(false)), new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('addjogo_link').setLabel("Link").setStyle(TextInputStyle.Short).setRequired(true)));
                await interaction.showModal(m);
            }
            else if (subcommand === 'addpedido') {
                const pc = options.getChannel('canal_apresentacao'); const lc = options.getChannel('canal_logs');
                config.presentationChannelId = pc.id; config.logChannelId = lc.id; saveConfig();
                await pc.send({ content: `**🇧🇷 Faça o Pedido:**\n\n**🇺🇸 Make your Request:**\n\n${AVISO_GIF_URL}`, components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('iniciar_pedido_pt').setLabel('Fazer Pedido!').setStyle(ButtonStyle.Success).setEmoji('🇧🇷'), new ButtonBuilder().setCustomId('iniciar_pedido_en').setLabel('Make Request!').setStyle(ButtonStyle.Primary).setEmoji('🇺🇸'))] });
                await interaction.reply({ content: `✅ Configurado!`, flags: [MessageFlags.Ephemeral] });
            }
            else if (subcommand === 'pedido' || subcommand === 'order') await sendPedidoInitialEphemeralMessage(interaction, subcommand === 'order');
            else if (subcommand === 'setup_faq') {
                await interaction.channel.send({ embeds: [new EmbedBuilder().setTitle('❓ Central de Ajuda').setColor('#00FF00').setThumbnail(AVISO_GIF_URL)], components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('open_faq_menu').setLabel('Ajuda / Help').setStyle(ButtonStyle.Success).setEmoji('💡'))] });
                await interaction.reply({ content: '✅ FAQ criado!', flags: [MessageFlags.Ephemeral] });
            }
            else if (subcommand === 'limpar') await handleLimparSlash(interaction);
            else if (subcommand === 'config_boasvindas') { config.welcomeChannelId = options.getChannel('canal').id; saveConfig(); await interaction.reply({ content: '✅ Configurado!', flags: [MessageFlags.Ephemeral] }); }
            
            // ============================================
            // NOVO: CONVITE PERSONALIZADO
            // ============================================
            else if (subcommand === 'convite') {
                const embed = new EmbedBuilder()
                    .setTitle('🏴‍☠️ Junte-se à Tripulação! | Join the Crew!')
                    .setDescription(
                        `🇧🇷 **Você foi convidado para o DownTorrents Games!**\n` +
                        `O melhor lugar para encontrar jogos, softwares e muito mais.\n` +
                        `Clique no botão abaixo para entrar!\n\n` +
                        `---------------------------------\n\n` +
                        `🇺🇸 **You have been invited to DownTorrents Games!**\n` +
                        `The best place to find games, software, and much more.\n` +
                        `Click the button below to join!`
                    )
                    .setColor(getRandomColor())
                    .setThumbnail(client.user.displayAvatarURL())
                    .setImage(AVISO_GIF_URL)
                    .setFooter({ text: 'DownTorrents Games • MrGeH' });

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setLabel('Entrar no Servidor | Join Server')
                        .setStyle(ButtonStyle.Link)
                        .setURL(INVITE_LINK)
                );

                await interaction.reply({ embeds: [embed], components: [row] });
            }
        }
    }
    
    else if (interaction.isButton()) {
        // --- LÓGICA DO FAQ ADICIONADA AQUI ---
        if (interaction.customId === 'open_faq_menu') {
            const menu = new StringSelectMenuBuilder()
                .setCustomId('faq_select')
                .setPlaceholder('Selecione uma dúvida / Select a topic')
                .addOptions(
                    new StringSelectMenuOptionBuilder().setLabel('Como Passar no Encurtador de Links | How to Get Through a Link Shortener').setValue('encurta').setEmoji('🔗'),
                    new StringSelectMenuOptionBuilder().setLabel('Como Instalar | How to Install').setValue('instalar').setEmoji('🛠️'),
                    new StringSelectMenuOptionBuilder().setLabel('Erro de DLL | DLL Error').setValue('dll').setEmoji('⚠️'),
                    new StringSelectMenuOptionBuilder().setLabel('Jogar Online | Play Online').setValue('online').setEmoji('🌐'),
                    new StringSelectMenuOptionBuilder().setLabel('Como Pedir | How to Request').setValue('pedido').setEmoji('📦')
                );

            return interaction.reply({
                content: '🇧🇷 **Selecione sua dúvida abaixo:**\n🇺🇸 **Select your question below:**',
                components: [new ActionRowBuilder().addComponents(menu)],
                flags: [MessageFlags.Ephemeral]
            });
        }
        // --------------------------------------

        if (interaction.customId === 'iniciar_pedido_pt' || interaction.customId === 'iniciar_pedido_en') { await sendPedidoInitialEphemeralMessage(interaction, interaction.customId === 'iniciar_pedido_en'); return; }
        
        if (interaction.customId.startsWith('pedido_continue_button_')) {
             const parts = interaction.customId.split('_'); const userId = parts[3]; const lang = parts[4]; const isEn = lang === 'en';
             if (interaction.user.id !== userId) return interaction.reply({ content: '❌', flags: [MessageFlags.Ephemeral] });
             const d = client.tempPedidoData.get(userId);
             if (!d || !d.platform) return interaction.reply({ content: '❌ Selecione as opções.', flags: [MessageFlags.Ephemeral] });
             await handlePedidoModalFinal(interaction, d.platform, d.online, isEn);
        }
        if (interaction.customId.startsWith('start_chat_')) await createChatChannel(interaction, interaction.customId.split('_')[2]);
        if (interaction.customId.startsWith('close_chat_')) {
            const tId = interaction.customId.split('_')[2]; const c = interaction.channel;
            await interaction.reply({ content: '🔒 Fechando...', flags: [MessageFlags.Ephemeral] });
            try {
                if (config.logChannelId) { 
                    const msgs = await c.messages.fetch({limit:100}); 
                    const txt = msgs.reverse().map(m => {
                        const time = m.createdAt.toLocaleString();
                        const author = m.author.id === client.user.id ? 'Staff (Bot)' : m.author.tag;
                        const content = m.content || '[Arquivo/Embed]';
                        return `[${time}] ${author}: ${content}`;
                    }).join('\n');
                    const l = await client.channels.fetch(config.logChannelId); 
                    if (l) l.send({ content: `📑 **Backup do Chat** com <@${tId}>`, files: [{ attachment: Buffer.from(txt), name: `log_${tId}.txt` }] }); 
                }
                client.activeChats.delete(tId); client.activeChats.delete(c.id); setTimeout(()=>c.delete(), 5000);
            } catch(e) { console.error('Erro no backup:', e); }
        }
        if (interaction.customId.startsWith('pedido_res|')) {
            if (interaction.user.id !== OWNER_ID) return interaction.reply({ content: '❌', flags: [MessageFlags.Ephemeral] });
            const parts = interaction.customId.split('|'); const action = parts[1]; const uId = parts[2]; const gName = parts[3].replace(/_/g, ' '); const lang = parts[6];
            await interaction.deferUpdate();
            try { 
                const u = await client.users.fetch(uId); 
                const title = lang === 'en' ? (action==='added'?"ADDED!":"NOTICE") : (action==='added'?"ADICIONADO!":"AVISO");
                const body = lang === 'en' ? (action==='added'?`Request **${gName}** fulfilled!`:`Request **${gName}** rejected.`) : (action==='added'?`Pedido **${gName}** atendido!`:`Pedido **${gName}** negado (Sem Crack).`);
                await u.send(`${title}\n\n${body}\n\n**MrGeH**`);
                await interaction.message.edit({ components: [] }); 
                await interaction.channel.send(`*Resolvido por ${interaction.user.tag}*`);
            } catch(e) {}
        }
        if (interaction.customId.startsWith('fix_link|')) {
            await interaction.deferUpdate();
            const parts = interaction.customId.split('|'); const tId = parts[1]; const gName = parts[2];
            try {
                const u = await client.users.fetch(tId);
                await u.send(`🇧🇷 Seu reporte referente ao link quebrado do jogo/software **${gName}** foi corrigido.\n\n---------------------------------\n\n🇺🇸 Your report regarding the broken link for game/software **${gName}** has been fixed.\n\n**Obrigado! / Thank you!**`);
                const oldEmbed = interaction.message.embeds[0];
                const newEmbed = EmbedBuilder.from(oldEmbed).setColor('#00FF00').setFooter({ text: `✅ Resolvido por ${interaction.user.username}` });
                await interaction.message.edit({ embeds: [newEmbed], components: [] });
            } catch (e) {
                await interaction.followUp({ content: '⚠️ Link corrigido, mas DM falhou (Bloqueado).', flags: [MessageFlags.Ephemeral] });
                const oldEmbed = interaction.message.embeds[0];
                const newEmbed = EmbedBuilder.from(oldEmbed).setColor('#FFFF00').setFooter({ text: `⚠️ Resolvido por ${interaction.user.username} (DM Falhou)` });
                await interaction.message.edit({ embeds: [newEmbed], components: [] });
            }
        }
    }

    else if (interaction.isModalSubmit()) {
        const { customId, fields } = interaction;
        
        if (customId === 'report_broken_link_modal') {
            await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
            const name = fields.getTextInputValue('broken_game_name');
            const obs = fields.getTextInputValue('broken_obs');
            const rc = await client.channels.fetch(config.reportChannelId).catch(()=>null);
            if (!rc) return interaction.editReply('❌ Erro: Canal de reports não configurado.');
            const embed = new EmbedBuilder().setTitle('🚨 Reporte de Link Quebrado').setColor('#FF0000').addFields({name:'👤 Usuário', value:`<@${interaction.user.id}>`, inline:true}, {name:'🎮 Jogo', value:name, inline:true}, {name:'📝 Obs', value:obs||'Nenhuma.'}).setTimestamp().setThumbnail(AVISO_GIF_URL);
            const safeName = name.length > 50 ? name.substring(0,50)+'...' : name;
            const btn = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`fix_link|${interaction.user.id}|${safeName.replace(/\|/g,'-')}`).setLabel('Link Corrigido').setStyle(ButtonStyle.Success).setEmoji('🔧'));
            await rc.send({ embeds: [embed], components: [btn] });
            await interaction.editReply('✅ Reporte enviado! | Report sent!');
        }

        else if (customId.startsWith('pedido_modal_final|')) {
             await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
             const parts = customId.split('|'); const u = parts[1]; const plat = parts[2]; const on = parts[3]; const lang = parts[4];
             const name = fields.getTextInputValue('pedido_game_software_name').replace(/\|/g, '-');
             const link = fields.getTextInputValue('pedido_original_link');
             const info = fields.getTextInputValue('pedido_info_msg');
             const log = await client.channels.fetch(config.logChannelId);
             const embed = new EmbedBuilder().setTitle(lang==='en'?'📦 New Request':'📦 Novo Pedido').setColor(getRandomColor()).setDescription(`User: <@${u}>\nName: ${name}\nPlataforma: ${plat}\nLink: ${link}\nInfo: ${info}`);
             const btns = new ActionRowBuilder().addComponents(
                 new ButtonBuilder().setCustomId(`pedido_res|added|${u}|${name.replace(/ /g,'_')}|${plat.replace(/ /g,'_')}|${on.replace(/ /g,'_')}|${lang}`).setLabel('Add').setStyle(ButtonStyle.Success),
                 new ButtonBuilder().setCustomId(`pedido_res|rejected|${u}|${name.replace(/ /g,'_')}|${plat.replace(/ /g,'_')}|${on.replace(/ /g,'_')}|${lang}`).setLabel('No Crack').setStyle(ButtonStyle.Danger),
                 new ButtonBuilder().setCustomId(`start_chat_${u}`).setLabel('Chat').setStyle(ButtonStyle.Primary)
             );
             await log.send({ embeds: [embed], components: [btns] });
             await interaction.editReply({ content: '✅' });
             client.tempPedidoData.delete(u);
        }
        else if (customId.startsWith('addsoft_modal_') || customId.startsWith('addjogo_modal_')) {
            await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
            const isJ = customId.startsWith('addjogo'); const [, , pId, nId] = customId.split('_');
            const tit = fields.getTextInputValue(isJ?'addjogo_titulo':'addsoft_titulo'); 
            const link = fields.getTextInputValue(isJ?'addjogo_link':'addsoft_link'); 
            const obs = isJ?fields.getTextInputValue('addjogo_obs'):null;
            client.tempAddJogoData.set(interaction.user.id, { status: 'awaiting_image', interaction, primaryChannelId: pId, notificationChannelId: nId, title: tit, obs, link, type: isJ?'jogo':'software' });
            const msg = await interaction.editReply('✅ Mande a IMAGEM.');
            const d = client.tempAddJogoData.get(interaction.user.id); d.waitingMessageId = msg.id; client.tempAddJogoData.set(interaction.user.id, d);
        }
        
        else if (customId.startsWith('aviso_modal_|')) {
            await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
            const parts = customId.split('|');
            const targetChannelId = parts[1]; 

            const tit = fields.getTextInputValue('aviso_titulo');
            const corpo = fields.getTextInputValue('aviso_corpo');
            
            let desc = corpo;
            try { 
                const resTitle = await translate(tit, {to:'en'});
                const resBody = await translate(corpo, {to:'en'});
                desc = `🇧🇷 **${tit}**\n${corpo}\n\n---------------------------------\n\n🇺🇸 **${resTitle.text}**\n${resBody.text}`;
            } catch(e){}

            const embed = new EmbedBuilder().setTitle('📢 Aviso Oficial | Official Announcement').setDescription(desc).setColor(getRandomColor()).setThumbnail(AVISO_GIF_URL).setFooter({ text: '• DownTorrents Games • MrGeH' });
            
            try {
                const c = await client.channels.fetch(targetChannelId);
                await c.send({content:'@everyone', embeds:[embed]});
                await interaction.editReply('✅ Enviado.');
            } catch(e){
                await interaction.editReply('❌ Erro: Canal não encontrado.');
            }
        }
        else if (customId === 'avisotds_modal') {
            await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
            const tit = fields.getTextInputValue('avisotds_titulo');
            const corpo = fields.getTextInputValue('avisotds_corpo');

            try {
                const resTitle = await translate(tit, {to:'en'});
                const resBody = await translate(corpo, {to:'en'});
                
                const description = `🇧🇷 **${tit}**\n${corpo}\n\n---------------------------------\n\n🇺🇸 **${resTitle.text}**\n${resBody.text}`;

                const embed = new EmbedBuilder()
                    .setTitle('📢 Aviso Oficial / Official Announcement')
                    .setDescription(description)
                    .setColor(getRandomColor())
                    .setThumbnail(AVISO_GIF_URL)
                    .setFooter({ text: '• DownTorrents Games • MrGeH' });

                const res = await pool.query('SELECT channel_id FROM canais_externos');
                const channels = res.rows;

                let count = 0;
                for (const row of channels) {
                    try {
                        const channel = await client.channels.fetch(row.channel_id);
                        if (channel) {
                            await channel.send({ content: '@everyone', embeds: [embed] });
                            count++;
                        }
                    } catch (e) {}
                }

                await interaction.editReply(`✅ Aviso enviado para **${count}** servidores!`);

            } catch (e) {
                console.error(e);
                await interaction.editReply('❌ Erro ao processar o aviso.');
            }
        }
    }
});

// --- FUNÇÕES AUXILIARES ---
async function sendGameOrSoftwareEmbed(oi, pid, nid, tit, obs, lnk, img, typ) {
    const mc = await oi.guild.channels.fetch(pid); const nc = await oi.guild.channels.fetch(nid);
    let finalObs = '';
    if (obs) { try { const tr = await translate(obs, {to:'en'}); finalObs = `\n\n**Observação / Note:**\n🇧🇷 ${obs}\n---------------------\n🇺🇸 ${tr.text}`; } catch(e) { finalObs=`\n\n**Obs:** ${obs}`; } }
    const m = await mc.send({ content: `**${tit}**\n\n**Link:** [Clique Aqui! | Click Here!](${lnk})${finalObs}`, files: img ? [{ attachment: img, name: 'image.png' }] : [] });
    const emb = new EmbedBuilder().setTitle(`🎉 Novo ${typ==='jogo'?'Jogo':'Software'}!`).setColor(getRandomColor()).setDescription(`🇧🇷 Confira: **${tit}**\n🇺🇸 Check out: **${tit}**`).setThumbnail(img);
    await nc.send({ content: '@everyone', embeds: [emb], components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Clique Aqui | Click Here').setURL(m.url))] });
    await oi.editReply('✅ Sucesso!');
    return m;
}

async function handleAjudaPrefix(m){ m.reply('Use `/dtg`.'); }
async function handleAjudaSlash(i){ i.reply({content:'Use os comandos `/dtg`.', flags:[MessageFlags.Ephemeral]}); }

async function handleAvisoChat(i) {
    const c = i.options.getChannel('canal') || i.channel;
    const m = new ModalBuilder().setCustomId(`aviso_modal_|${c.id}`).setTitle('Aviso');
    m.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('aviso_titulo').setLabel('Título').setStyle(TextInputStyle.Short)), new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('aviso_corpo').setLabel('Mensagem').setStyle(TextInputStyle.Paragraph)));
    await i.showModal(m);
}

async function handlePedidoModalFinal(i, p, o, isEn) {
    const u = i.user.id; 
    const langCode = isEn ? 'en' : 'pt';
    const safeP = p.replace(/\|/g, ''); 
    const safeO = o.replace(/\|/g, '');

    const m = new ModalBuilder()
        .setCustomId(`pedido_modal_final|${u}|${safeP}|${safeO}|${langCode}`)
        .setTitle(isEn ? 'Request Details' : 'Detalhes do Pedido');

    m.addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('pedido_game_software_name').setLabel(isEn ? 'Name (Game/Software)' : 'Nome (Jogo/Software)').setStyle(TextInputStyle.Short).setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('pedido_original_link').setLabel('Link').setStyle(TextInputStyle.Short).setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('pedido_info_msg').setLabel(isEn ? 'Extra Info / Observations' : 'Observações / Info Extra').setStyle(TextInputStyle.Paragraph).setRequired(false))
    );
    await i.showModal(m);
}

async function handleLimparSlash(i){ const q=i.options.getInteger('quantidade'); await i.channel.bulkDelete(q, true); i.reply({content:`Apagadas ${q}`, flags:[MessageFlags.Ephemeral]}); }
async function createChatChannel(i, tId) {
    if(client.activeChats.has(tId)) return i.reply({content:'⚠️ Chat já existe.', flags:[MessageFlags.Ephemeral]});
    if(!i.replied) await i.deferReply({flags:[MessageFlags.Ephemeral]});
    try {
        const u = await client.users.fetch(tId);
        const c = await i.guild.channels.create({ name:`chat-${u.username}`, type:ChannelType.GuildText, permissionOverwrites:[{id:i.guild.id,deny:[PermissionFlagsBits.ViewChannel]},{id:client.user.id,allow:[PermissionFlagsBits.ViewChannel]},{id:i.user.id,allow:[PermissionFlagsBits.ViewChannel]}] });
        client.activeChats.set(tId, c.id); client.activeChats.set(c.id, tId);
        await c.send({ content: `👋 Chat com ${u} iniciado.`, components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`close_chat_${tId}`).setLabel('Fechar').setStyle(ButtonStyle.Danger))] });
        try { await u.send('📩 **Suporte Iniciado!** Responda por aqui.'); } catch(e) { await c.send('⚠️ DMs fechadas.'); }
        await i.editReply(`✅ Chat: ${c}`);
    } catch(e) { i.editReply('❌ Erro.'); }
}

function getPedidoPlatformSelectMenu(u, l, v) { 
    const opts = [
        {l:'PC',v:'PC'}, {l:'SOFTWARE',v:'SOFTWARE'}, {l:'PS4',v:'PS4'}, {l:'PS5',v:'PS5'},{l:'PS3',v:'PS3'},
        {l:'XBOX 360',v:'XBOX360'},{l:'XBOX ONE',v:'XBOXONE'}, {l:'XBOX SERIES',v:'XBOXSERIES'},{l:'NINTENDO SWITCH',v:'NINTENDOSWITCH'}, {l:'SUPER NINTENDO',v:'SUPERNINTENDO'},{l:'MEGADRIVE',v:'MEGA DRIVE'}
    ].map(x => new StringSelectMenuOptionBuilder()
        .setLabel(x.l)
        .setValue(x.v)
        .setDefault(x.v === v)
    ); 
    
    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(`pedido_platform_select_${u}_${l}`)
            .setPlaceholder('Plataforma')
            .addOptions(opts)
    ); 
}

function getPedidoOnlineSelectMenu(u, l, v) { 
    const opts = [
        {l:'Sim',v:'Sim'}, {l:'Não',v:'Não'}, {l:'Inrelevante(Software)',v:'Inrelevante(Software)'}
    ].map(x => new StringSelectMenuOptionBuilder()
        .setLabel(x.l)
        .setValue(x.v)
        .setDefault(x.v === v)
    ); 
    
    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(`pedido_online_select_${u}_${l}`)
            .setPlaceholder('Online?')
            .addOptions(opts)
    ); 
}

async function sendPedidoInitialEphemeralMessage(i,e){
    await i.deferReply({flags:[MessageFlags.Ephemeral]}); const u=i.user.id; const l=e?'en':'pt'; client.tempPedidoData.set(u,{});
    await i.editReply({content:l==='en'?'Select:':'Selecione:',components:[getPedidoPlatformSelectMenu(u,l),getPedidoOnlineSelectMenu(u,l),new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`pedido_continue_button_${u}_${l}`).setLabel(l==='en'?'Continue':'Continuar').setStyle(ButtonStyle.Success).setDisabled(true))]});
}

process.on('uncaughtException', (err) => { console.error('⚠️ Uncaught Exception:', err); });
process.on('unhandledRejection', (reason, promise) => { console.error('⚠️ Unhandled Rejection:', reason); });

client.login(TOKEN);