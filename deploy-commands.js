require('dotenv').config();
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const { SlashCommandBuilder, ChannelType } = require('discord.js');

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

if (!TOKEN || !CLIENT_ID) {
    console.error("Erro: As variáveis DISCORD_TOKEN e DISCORD_CLIENT_ID precisam ser definidas no arquivo .env");
    process.exit(1);
}

// --- DEFINIÇÃO DOS COMANDOS ---
const commands = [
    new SlashCommandBuilder()
        .setName('dtg')
        .setDescription('Comandos DownTorrentsGames.')
        
        // --- COMANDOS PÚBLICOS ---
        .addSubcommand(subcommand =>
            subcommand.setName('ajuda').setDescription('Exibe a lista de comandos disponíveis.')
        )
        .addSubcommand(subcommand =>
            subcommand.setName('convite').setDescription('Gera um convite para o servidor DownTorrentsGames.')
        )
        .addSubcommand(subcommand =>
            subcommand.setName('buscar').setDescription('🔍 Pesquisa um jogo ou software na biblioteca.')
                .addStringOption(option => option.setName('nome').setDescription('Nome do jogo ou software.').setRequired(true))
        )
        .addSubcommand(subcommand =>
            subcommand.setName('requisitos').setDescription('💻 Mostra os requisitos de sistema (PC) de um jogo.')
                .addStringOption(option => option.setName('nome').setDescription('Nome do jogo (ex: Bully, Grand Theft Auto V).').setRequired(true))
        )
        .addSubcommand(subcommand =>
            subcommand.setName('linkquebrado').setDescription('⚠️ Reporta um link quebrado de um jogo ou software.')
        )
        .addSubcommand(subcommand =>
            subcommand.setName('pedido').setDescription('🇧🇷 Abre um formulário para solicitar um jogo ou software.')
        )
        .addSubcommand(subcommand =>
            subcommand.setName('order').setDescription('🇺🇸 Opens a form to request a game or software.')
        )

        // --- COMANDOS PARA ADMINISTRADORES DE OUTROS SERVIDORES ---
        .addSubcommand(subcommand =>
            subcommand.setName('config_att')
                .setDescription('🔔 [Adm Server] Define onde as notificações de novos uploads do DTG chegarão.')
                .addChannelOption(option =>
                    option.setName('canal').setDescription('O canal de notícias.').setRequired(true).addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
                )
        )
        .addSubcommand(subcommand =>
            subcommand.setName('remove_att')
                .setDescription('🔕 [Adm Server] Para de receber notificações de uploads do DTG.')
        )
        .addSubcommand(subcommand =>
            subcommand.setName('config_game_free')
                .setDescription('🎁 [Adm Server] Avisar neste canal sobre Jogos Grátis (Steam, Epic, etc).')
                .addChannelOption(option =>
                    option.setName('canal').setDescription('Canal para avisos de jogos grátis.').setRequired(true).addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
                )
        )
        .addSubcommand(subcommand =>
            subcommand.setName('remove_game_free')
                .setDescription('🔕 [Adm Server] Parar de avisar sobre Jogos Grátis.')
        )

        // --- COMANDOS ADMINISTRATIVOS (Dono) ---
        .addSubcommand(subcommand =>
            subcommand.setName('chat').setDescription('(Dono) Abre chat manual.')
                .addUserOption(option => option.setName('usuario').setDescription('Usuário alvo.').setRequired(true))
        )
        .addSubcommand(subcommand =>
            subcommand.setName('teste_gfree')
                .setDescription('(Dono) Testa o envio de um Jogo Grátis (Debug).')
                .addChannelOption(option =>
                    option.setName('canal').setDescription('O canal para enviar o teste.').setRequired(true).addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
                )
        )
        .addSubcommand(subcommand =>
            subcommand.setName('avisotds')
                .setDescription('(Dono) Envia um aviso oficial para todos os servidores configurados.')
        )
        .addSubcommand(subcommand =>
            subcommand.setName('servidores')
                .setDescription('(Dono) Lista todos os servidores onde o bot está.')
        )
        .addSubcommand(subcommand =>
            subcommand.setName('setup_stats').setDescription('(Dono) Cria contadores de estatísticas.')
                .addStringOption(option =>
                    option.setName('tipo').setDescription('Tipo').setRequired(true)
                    .addChoices(
                        { name: 'Jogos', value: 'jogos' }, 
                        { name: 'Softwares', value: 'softwares' }, 
                        { name: 'Membros', value: 'membros' }, 
                        { name: 'Data', value: 'data' }
                    )
                )
        )
        .addSubcommand(subcommand =>
            subcommand.setName('configquebrado').setDescription('(Dono) Define canal de reports.')
                .addChannelOption(option => option.setName('canal').setDescription('Canal de logs.').setRequired(true).addChannelTypes(ChannelType.GuildText))
        )
        .addSubcommand(subcommand =>
            subcommand.setName('config_boasvindas').setDescription('(Dono) Define canal de boas-vindas.')
                .addChannelOption(option => option.setName('canal').setDescription('Canal de entrada.').setRequired(true).addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
        )
        .addSubcommand(subcommand =>
            subcommand.setName('aviso').setDescription('(Dono) Cria um novo aviso.')
                .addChannelOption(option => option.setName('canal').setDescription('Canal opcional.').setRequired(false).addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
        )
        .addSubcommand(subcommand =>
            subcommand.setName('setup_faq').setDescription('(Dono) Cria menu FAQ.')
        )
        .addSubcommand(subcommand =>
            subcommand.setName('addsoft').setDescription('(Dono) Adiciona software.')
                .addChannelOption(o => o.setName('canal_principal').setDescription('Canal Principal').setRequired(true).addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
                .addChannelOption(o => o.setName('canal_notificacao').setDescription('Canal Notificação').setRequired(true).addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
        )
        .addSubcommand(subcommand =>
            subcommand.setName('addjogo').setDescription('(Dono) Adiciona jogo.')
                .addChannelOption(o => o.setName('canal_principal').setDescription('Canal Principal').setRequired(true).addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
                .addChannelOption(o => o.setName('canal_notificacao').setDescription('Canal Notificação').setRequired(true).addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
        )
        .addSubcommand(subcommand =>
            subcommand.setName('limpar').setDescription('(Dono) Limpa mensagens.')
                .addIntegerOption(o => o.setName('quantidade').setDescription('Qtd (1-100).').setRequired(true))
        )
        .addSubcommand(subcommand =>
            subcommand.setName('addpedido').setDescription('(Dono) Configura canais de pedido.')
                .addChannelOption(o => o.setName('canal_apresentacao').setDescription('Canal Apresentação').setRequired(true).addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
                .addChannelOption(o => o.setName('canal_logs').setDescription('Canal Logs').setRequired(true).addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
        ),
].map(command => command.toJSON());

const rest = new REST({ version: '9' }).setToken(TOKEN);

(async () => {
    try {
        console.log('🔄 Iniciando processo de limpeza e atualização...');

        if (GUILD_ID) {
            console.log(`🗑️  Limpando comandos antigos da Guilda ${GUILD_ID}...`);
            await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: [] });
        }

        console.log('🌍 Registrando comandos GLOBALMENTE (Isso evita duplicatas, mas pode demorar alguns minutos para atualizar)...');
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });

        console.log('✅ Sucesso! Comandos atualizados e duplicatas removidas.');
        console.log('⚠️ Nota: Se os comandos sumirem temporariamente, reinicie o Discord (Ctrl+R).');

    } catch (error) {
        console.error('❌ Erro no deploy:', error);
    }
})();