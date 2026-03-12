require('dotenv').config();
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const { SlashCommandBuilder, ChannelType } = require('discord.js');

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

if (!TOKEN || !CLIENT_ID) {
    console.error("Erro: .env incompleto.");
    process.exit(1);
}

// --- DEFINIÇÃO DOS COMANDOS ---
const commands = [
    new SlashCommandBuilder()
        .setName('dtg')
        .setDescription('Comandos DownTorrentsGames.')
        
        // --- COMANDOS PÚBLICOS ---
        .addSubcommand(sub => sub.setName('ajuda').setDescription('Exibe a lista de comandos disponíveis.'))
        .addSubcommand(sub => sub.setName('convite').setDescription('Gera um convite para o servidor.'))
        .addSubcommand(sub => sub.setName('buscar').setDescription('🔍 Pesquisa um jogo ou software.')
            .addStringOption(op => op.setName('nome').setDescription('Nome do jogo.').setRequired(true)))
        .addSubcommand(sub => sub.setName('requisitos').setDescription('💻 Mostra os requisitos de sistema.')
            .addStringOption(op => op.setName('nome').setDescription('Nome do jogo.').setRequired(true)))
        .addSubcommand(sub => sub.setName('linkquebrado').setDescription('⚠️ Reporta um link quebrado.'))
        .addSubcommand(sub => sub.setName('pedido').setDescription('🇧🇷 Fazer pedido de jogo.'))
        .addSubcommand(sub => sub.setName('order').setDescription('🇺🇸 Request a game.'))

        // --- CONFIGURAÇÃO DE SERVIDORES ---
        .addSubcommand(sub => sub.setName('config_att').setDescription('🔔 [Adm] Canal de notificações DTG.')
            .addChannelOption(op => op.setName('canal').setDescription('Canal.').setRequired(true).addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)))
        .addSubcommand(sub => sub.setName('remove_att').setDescription('🔕 [Adm] Remover notificações.'))
        .addSubcommand(sub => sub.setName('config_game_free').setDescription('🎁 [Adm] Canal de Jogos Grátis.')
            .addChannelOption(op => op.setName('canal').setDescription('Canal.').setRequired(true).addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)))
        .addSubcommand(sub => sub.setName('remove_game_free').setDescription('🔕 [Adm] Remover avisos de Jogos Grátis.'))
        .addSubcommand(sub => sub.setName('proibirlink').setDescription('🚫 [Adm] Ativar Anti-Link.'))
        .addSubcommand(sub => sub.setName('remproibirlink').setDescription('✅ [Adm] Desativar Anti-Link.'))

        // --- COMANDOS DO DONO (AGRUPADOS EM ADMIN) ---
        .addSubcommandGroup(group => 
            group.setName('admin')
            .setDescription('🛠️ Comandos exclusivos do Dono/Staff.')
            
            .addSubcommand(sub => sub.setName('chat').setDescription('(Dono) Abre chat manual.')
                .addUserOption(op => op.setName('usuario').setDescription('Usuário.').setRequired(true)))
            
            .addSubcommand(sub => sub.setName('teste_gfree').setDescription('(Dono) Teste Jogo Grátis.')
                .addChannelOption(op => op.setName('canal').setDescription('Canal.').setRequired(true).addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)))
            
            .addSubcommand(sub => sub.setName('avisotds').setDescription('(Dono) Aviso Global.'))
            
            .addSubcommand(sub => sub.setName('servidores').setDescription('(Dono) Lista servidores.'))
            
            .addSubcommand(sub => sub.setName('setup_stats').setDescription('(Dono) Setup Stats.')
                .addStringOption(op => op.setName('tipo').setDescription('Tipo').setRequired(true)
                    .addChoices({name:'Jogos',value:'jogos'},{name:'Soft',value:'softwares'},{name:'Membros',value:'membros'},{name:'Data',value:'data'})))
            
            .addSubcommand(sub => sub.setName('configquebrado').setDescription('(Dono) Config Reports.')
                .addChannelOption(op => op.setName('canal').setDescription('Canal.').setRequired(true).addChannelTypes(ChannelType.GuildText)))
            
            .addSubcommand(sub => sub.setName('config_boasvindas').setDescription('(Dono) Config Welcome.')
                .addChannelOption(op => op.setName('canal').setDescription('Canal.').setRequired(true).addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)))
            
            .addSubcommand(sub => sub.setName('aviso').setDescription('(Dono) Novo aviso.')
                .addChannelOption(op => op.setName('canal').setDescription('Canal.').setRequired(false).addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)))
            
            .addSubcommand(sub => sub.setName('setup_faq').setDescription('(Dono) Setup FAQ.'))
            
            .addSubcommand(sub => sub.setName('addsoft').setDescription('(Dono) Add Soft.')
                .addChannelOption(o => o.setName('canal_principal').setDescription('P').setRequired(true).addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
                .addChannelOption(o => o.setName('canal_notificacao').setDescription('N').setRequired(true).addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)))
            
            .addSubcommand(sub => sub.setName('addjogo').setDescription('(Dono) Add Jogo.')
                .addChannelOption(o => o.setName('canal_principal').setDescription('P').setRequired(true).addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
                .addChannelOption(o => o.setName('canal_notificacao').setDescription('N').setRequired(true).addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)))
            
            .addSubcommand(sub => sub.setName('limpar').setDescription('(Dono) Limpa mensagens.')
                .addIntegerOption(o => o.setName('quantidade').setDescription('Qtd.').setRequired(true)))
            
            .addSubcommand(sub => sub.setName('addpedido').setDescription('(Dono) Config Pedido.')
                .addChannelOption(o => o.setName('canal_apresentacao').setDescription('A').setRequired(true).addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
                .addChannelOption(o => o.setName('canal_logs').setDescription('L').setRequired(true).addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)))
            
            // --- NOVOS COMANDOS DE EDIÇÃO DE MENSAGENS ---
            .addSubcommand(sub => sub.setName('editpost').setDescription('(Dono) Edita post (jogo/soft).')
                .addStringOption(op => op.setName('msg_id').setDescription('Cole o Link da Mensagem ou o ID dela aqui.').setRequired(true)))
            
            .addSubcommand(sub => sub.setName('editaviso').setDescription('(Dono) Edita um Aviso Global.'))
        ),
].map(command => command.toJSON());

const rest = new REST({ version: '9' }).setToken(TOKEN);

async function fazerDeploy() {
    try {
        console.log('🔄 Iniciando processo de limpeza e atualização...');

        if (GUILD_ID) {
            console.log(`🗑️  Limpando comandos antigos da Guilda ${GUILD_ID}...`);
            await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: [] });
        }

        console.log('🌍 Registrando comandos GLOBALMENTE...');
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });

        console.log('✅ Sucesso! Comandos registrados.');
        console.log('⚠️ Nota: Comandos de dono agora estão sob "/dtg admin <comando>".');

    } catch (error) {
        console.error('❌ Erro no deploy:', error);
    }
}

fazerDeploy();