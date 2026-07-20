require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, SlashCommandBuilder, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences
    ]
});

const channelId = process.env.CHANNEL_ID;
const guildId = process.env.GUILD_ID;
const ownerId = process.env.OWNER_ID;
const UPDATE_INTERVAL = 15 * 60 * 1000; // 15 minutes in milliseconds
const DATA_FILE = path.join(__dirname, 'bot_data.json');
const BOOT_USER_ID = '407366542142210049'; // User who can use /boot command
const BOOT_DATA_FILE = path.join(__dirname, 'boot_data.json');
const POLLS_FILE = path.join(__dirname, 'polls_data.json');

// Load or initialize data
function loadData() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
            return data;
        }
    } catch (error) {
        console.error('Error loading data:', error);
    }
    return { messageId: null };
}

// Save data to file
function saveData(data) {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error saving data:', error);
    }
}

// Load boot data
function loadBootData() {
    try {
        if (fs.existsSync(BOOT_DATA_FILE)) {
            const data = JSON.parse(fs.readFileSync(BOOT_DATA_FILE, 'utf8'));
            return data;
        }
    } catch (error) {
        console.error('Error loading boot data:', error);
    }
    return { bootedUsers: [] };
}

// Save boot data
function saveBootData(data) {
    try {
        fs.writeFileSync(BOOT_DATA_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error saving boot data:', error);
    }
}

// Load polls data
function loadPollsData() {
    try {
        if (fs.existsSync(POLLS_FILE)) {
            const data = JSON.parse(fs.readFileSync(POLLS_FILE, 'utf8'));
            return data;
        }
    } catch (error) {
        console.error('Error loading polls data:', error);
    }
    return { polls: {} };
}

// Save polls data
function savePollsData(data) {
    try {
        fs.writeFileSync(POLLS_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error saving polls data:', error);
    }
}

let botData = loadData();
let messageId = botData.messageId;
let bootData = loadBootData();
let pollsData = loadPollsData();

// Track users being processed to prevent loops
const processingUsers = new Set();

// Minecraft server status check with retry
async function getServerStatus(retryCount = 0) {
    try {
        const response = await axios.get(`https://api.mcsrvstat.us/2/lns.falix.gg`, {
            timeout: 8000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; DiscordBot/1.0)'
            }
        });
        const data = response.data;
        
        let iconURL = null;
        if (data.icon) {
            iconURL = `https://api.mcsrvstat.us/icon/${data.ip}`;
        }
        
        const embed = new EmbedBuilder()
            .setColor(data.online ? '#55FF55' : '#FF5555')
            .setTitle('🎮 LARP WAGON MINECRAFT SERVER')
            .setDescription('**Survival - Hard - Grief Prevention**')
            .setThumbnail(iconURL || 'https://cdn.discordapp.com/attachments/123456789/abcdef/minecraft-icon.png')
            .addFields(
                { name: '📌 IP', value: '`lns.falix.gg`', inline: true },
                { name: '🌍 Data Center', value: 'Germany', inline: true },
                { name: '📦 Version', value: data.version || 'Latest', inline: true },
                { name: '🟢 Status', value: data.online ? '✅ **Online**' : '❌ **Offline**', inline: true },
                { name: '👥 Players', value: data.online ? `${data.players?.online || 0} / ${data.players?.max || 100}` : '0 / 100', inline: true },
                { name: '📅 Schedule', value: 'Mostly active on weekends, also online some weekdays', inline: false },
                { name: '📋 Rules', value: 'No griefing - No hacking - Be respectful', inline: false },
                { name: '🔗 How to Join', value: 'Add server `lns.falix.gg` and join', inline: false },
                { name: '🏢 Hosted in', value: 'Germany - FalixNodes', inline: false }
            )
            .setTimestamp()
            .setFooter({ text: `🔄 Auto-updates every 15 minutes • ${data.online ? '🟢 Server Online' : '🔴 Server Offline'}` });

        if (data.online && data.players?.list && data.players.list.length > 0) {
            const playerList = data.players.list.slice(0, 10).join(', ');
            embed.addFields({ 
                name: '👤 Online Players', 
                value: playerList + (data.players.list.length > 10 ? ` (+${data.players.list.length - 10} more)` : ''),
                inline: false 
            });
        }

        return { embed, online: data.online, players: data.players?.online || 0 };
    } catch (error) {
        console.error(`Error fetching server status (attempt ${retryCount + 1}):`, error.message);
        
        if (retryCount < 2) {
            console.log(`Retrying in 2 seconds...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
            return getServerStatus(retryCount + 1);
        }
        
        const embed = new EmbedBuilder()
            .setColor('#FF5555')
            .setTitle('🎮 LARP WAGON MINECRAFT SERVER')
            .setDescription('**Survival - Hard - Grief Prevention**')
            .addFields(
                { name: '📌 IP', value: '`lns.falix.gg`', inline: true },
                { name: '🌍 Data Center', value: 'Germany', inline: true },
                { name: '📦 Version', value: 'Latest', inline: true },
                { name: '🟢 Status', value: '⚠️ **Unable to fetch**', inline: true },
                { name: '👥 Players', value: '0 / 100', inline: true },
                { name: '📅 Schedule', value: 'Mostly active on weekends, also online some weekdays', inline: false },
                { name: '📋 Rules', value: 'No griefing - No hacking - Be respectful', inline: false },
                { name: '🔗 How to Join', value: 'Add server `lns.falix.gg` and join', inline: false },
                { name: '🏢 Hosted in', value: 'Germany - FalixNodes', inline: false }
            )
            .setTimestamp()
            .setFooter({ text: '🔄 Auto-updates every 15 minutes • ⚠️ Error fetching status' });

        return { embed, online: false, players: 0 };
    }
}

// Register slash commands
async function registerCommands() {
    const commands = [
        new SlashCommandBuilder()
            .setName('mcupdate')
            .setDescription('Update the LARP Wagon Minecraft server status embed'),
        new SlashCommandBuilder()
            .setName('boot')
            .setDescription('Boot a user from voice chat whenever they join')
            .addUserOption(option => 
                option.setName('user')
                    .setDescription('The user to boot from voice chat')
                    .setRequired(true)),
        new SlashCommandBuilder()
            .setName('mimic')
            .setDescription('Perfectly mimic a user (copies name, avatar, nickname, pronouns, EVERYTHING)')
            .addUserOption(option => 
                option.setName('user')
                    .setDescription('The user to perfectly mimic')
                    .setRequired(true))
            .addStringOption(option =>
                option.setName('message')
                    .setDescription('The message to send as the user')
                    .setRequired(true)),
        new SlashCommandBuilder()
            .setName('poll')
            .setDescription('Create a poll for the gang to vote on')
            .addStringOption(option =>
                option.setName('question')
                    .setDescription('What we voting on?')
                    .setRequired(true))
            .addStringOption(option =>
                option.setName('option1')
                    .setDescription('First option')
                    .setRequired(true))
            .addStringOption(option =>
                option.setName('option2')
                    .setDescription('Second option')
                    .setRequired(true))
            .addIntegerOption(option =>
                option.setName('duration')
                    .setDescription('How long should the poll last? (in minutes)')
                    .setRequired(true)
                    .setMinValue(1)
                    .setMaxValue(1440))
            .addStringOption(option =>
                option.setName('option3')
                    .setDescription('Third option (optional)')
                    .setRequired(false))
            .addStringOption(option =>
                option.setName('option4')
                    .setDescription('Fourth option (optional)')
                    .setRequired(false))
            .addStringOption(option =>
                option.setName('option5')
                    .setDescription('Fifth option (optional)')
                    .setRequired(false))
    ];

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

    try {
        console.log('Registering slash commands...');
        await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT_ID, guildId),
            { body: commands.map(cmd => cmd.toJSON()) }
        );
        console.log('Slash commands registered successfully!');
    } catch (error) {
        console.error('Error registering commands:', error);
    }
}

// Send initial embed
async function sendInitialEmbed() {
    try {
        const channel = await client.channels.fetch(channelId);
        if (!channel) {
            console.error('Channel not found!');
            return;
        }

        const { embed } = await getServerStatus();
        const message = await channel.send({ embeds: [embed] });
        messageId = message.id;
        
        botData.messageId = messageId;
        saveData(botData);
        
        console.log(`✅ Initial embed sent with ID: ${messageId}`);
        console.log(`📊 Server Status: ${embed.data.fields.find(f => f.name === '🟢 Status')?.value}`);
    } catch (error) {
        console.error('Error sending initial embed:', error);
    }
}

// Find existing embed or create new one
async function findOrCreateEmbed() {
    try {
        const channel = await client.channels.fetch(channelId);
        if (!channel) {
            console.error('Channel not found!');
            return;
        }

        if (messageId) {
            try {
                const message = await channel.messages.fetch(messageId);
                if (message) {
                    console.log(`✅ Found existing embed with ID: ${messageId}`);
                    return message;
                }
            } catch (error) {
                if (error.code === 10008) {
                    console.log('⚠️ Saved message not found, creating new embed...');
                } else {
                    console.error('Error fetching message:', error);
                }
            }
        }

        const { embed } = await getServerStatus();
        const message = await channel.send({ embeds: [embed] });
        messageId = message.id;
        
        botData.messageId = messageId;
        saveData(botData);
        
        console.log(`✅ New embed created with ID: ${messageId}`);
        return message;
    } catch (error) {
        console.error('Error finding or creating embed:', error);
        return null;
    }
}

// Update existing embed
async function updateEmbed() {
    try {
        const channel = await client.channels.fetch(channelId);
        if (!channel) {
            console.error('Channel not found!');
            return;
        }

        let message = null;
        if (messageId) {
            try {
                message = await channel.messages.fetch(messageId);
            } catch (error) {
                if (error.code === 10008) {
                    console.log('⚠️ Saved message not found, creating new one...');
                } else {
                    console.error('Error fetching message:', error);
                }
            }
        }

        if (!message) {
            const { embed } = await getServerStatus();
            message = await channel.send({ embeds: [embed] });
            messageId = message.id;
            
            botData.messageId = messageId;
            saveData(botData);
            
            console.log(`✅ New embed created with ID: ${messageId}`);
            return;
        }

        const { embed } = await getServerStatus();
        await message.edit({ embeds: [embed] });
        
        const status = embed.data.fields.find(f => f.name === '🟢 Status')?.value || 'Unknown';
        const players = embed.data.fields.find(f => f.name === '👥 Players')?.value || '0 / 100';
        console.log(`✅ Embed updated at ${new Date().toLocaleTimeString()} | Status: ${status} | Players: ${players}`);
    } catch (error) {
        console.error('Error updating embed:', error);
    }
}

// Start auto-update interval
function startAutoUpdate() {
    console.log(`⏰ Auto-update enabled: Every ${UPDATE_INTERVAL / 60000} minutes`);
    
    setTimeout(async () => {
        console.log('🔄 Performing initial auto-update...');
        await updateEmbed();
    }, 5000);
    
    setInterval(async () => {
        console.log(`🔄 Auto-updating at ${new Date().toLocaleTimeString()}...`);
        await updateEmbed();
    }, UPDATE_INTERVAL);
}

// Toggle boot status for a user
function toggleBootUser(userId) {
    const index = bootData.bootedUsers.indexOf(userId);
    if (index === -1) {
        bootData.bootedUsers.push(userId);
        saveBootData(bootData);
        return true;
    } else {
        bootData.bootedUsers.splice(index, 1);
        saveBootData(bootData);
        return false;
    }
}

function isUserBooted(userId) {
    return bootData.bootedUsers.includes(userId);
}

// Voice state update handler
client.on('voiceStateUpdate', async (oldState, newState) => {
    const userId = newState.member.id;
    const userTag = newState.member.user.tag;
    
    if (isUserBooted(userId)) {
        if (newState.channelId && newState.channelId !== oldState.channelId) {
            console.log(`👢 Boot: Kicking ${userTag} from voice`);
            try {
                await newState.member.voice.disconnect();
                console.log(`✅ Boot: Successfully kicked ${userTag}`);
                try {
                    await newState.member.send(`🔇 You have been booted from voice chat. Use \`/boot @user\` to remove yourself from the list.`);
                } catch (dmError) {}
            } catch (error) {
                console.error(`❌ Boot: Failed to kick ${userTag}:`, error.message);
            }
        }
    }
});

// Check expired polls
async function checkExpiredPolls() {
    const now = Date.now();
    let expiredPolls = [];
    
    for (const [messageId, pollData] of Object.entries(pollsData.polls)) {
        if (pollData.expiresAt <= now) {
            expiredPolls.push({ messageId, pollData });
        }
    }
    
    for (const { messageId, pollData } of expiredPolls) {
        try {
            const channel = await client.channels.fetch(channelId);
            const message = await channel.messages.fetch(messageId);
            
            if (message) {
                // Edit the message to show it's ended
                const embed = EmbedBuilder.from(message.embeds[0])
                    .setColor('#FF4444')
                    .setTitle(`🔒 ${message.embeds[0].title || 'Poll Ended'}`)
                    .setDescription('⏰ This poll has ended!')
                    .setFooter({ text: 'Poll closed • Thanks for voting!' });
                
                // Disable all buttons
                const components = message.components;
                const disabledRow = new ActionRowBuilder();
                for (const component of components) {
                    for (const button of component.components) {
                        disabledRow.addComponents(
                            new ButtonBuilder()
                                .setCustomId(button.customId)
                                .setLabel(button.label)
                                .setStyle(ButtonStyle.Secondary)
                                .setEmoji(button.emoji)
                                .setDisabled(true)
                        );
                    }
                }
                
                await message.edit({ embeds: [embed], components: [disabledRow] });
                console.log(`✅ Poll ${messageId} has ended and been closed`);
                
                // Remove from tracking
                delete pollsData.polls[messageId];
                savePollsData(pollsData);
            }
        } catch (error) {
            console.error(`Error closing poll ${messageId}:`, error.message);
        }
    }
}

// Start poll checker
function startPollChecker() {
    setInterval(checkExpiredPolls, 60000); // Check every minute
    console.log('✅ Poll expiry checker started (checks every minute)');
}

// Bot ready event
client.once('ready', async () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
    console.log(`📡 Bot is ready for LARP Wagon Discord Server`);
    console.log(`🔗 Channel ID: ${channelId}`);
    console.log(`👑 Owner ID: ${ownerId}`);
    console.log(`💾 Saved message ID: ${messageId || 'None'}`);
    console.log(`👢 Booted users: ${bootData.bootedUsers.length > 0 ? bootData.bootedUsers.map(id => `<@${id}>`).join(', ') : 'None'}`);
    console.log(`📊 Active polls: ${Object.keys(pollsData.polls).length}`);
    console.log('='.repeat(50));
    
    await registerCommands();
    
    setTimeout(async () => {
        await findOrCreateEmbed();
        startAutoUpdate();
        startPollChecker();
        await checkExpiredPolls(); // Check for expired polls on startup
    }, 2000);
});

// Slash command handler
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'mcupdate') {
        if (interaction.user.id !== ownerId) {
            await interaction.reply({
                content: '❌ You do not have permission to use this command. Only the LARP Wagon server owner can update the status.',
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        await updateEmbed();
        await interaction.editReply({ 
            content: '✅ LARP Wagon Minecraft server status updated successfully!\n🔄 Next auto-update in 15 minutes.'
        });
    }

    if (interaction.commandName === 'boot') {
        if (interaction.user.id !== BOOT_USER_ID) {
            await interaction.reply({
                content: '❌ You do not have permission to use this command. Only authorized users can boot others from voice chat.',
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        const targetUser = interaction.options.getUser('user');
        if (!targetUser) {
            await interaction.reply({
                content: '❌ Please mention a valid user to boot.',
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        const isNowBooted = toggleBootUser(targetUser.id);
        const status = isNowBooted ? '✅ **ENABLED**' : '❌ **DISABLED**';
        
        await interaction.reply({
            content: `👢 Boot status for **${targetUser.tag}** is now ${status}\n\n` +
                    `When enabled, they will be instantly kicked from any voice channel they join.\n` +
                    `Use \`/boot @${targetUser.username}\` again to toggle it off.`,
            flags: MessageFlags.Ephemeral
        });

        console.log(`👢 Boot toggled for ${targetUser.tag} (${targetUser.id}) - Now: ${isNowBooted ? 'Enabled' : 'Disabled'}`);
    }

    if (interaction.commandName === 'mimic') {
        if (interaction.user.id !== ownerId) {
            await interaction.reply({
                content: '❌ You do not have permission to use this command. Only the server owner can mimic users.',
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        const targetUser = interaction.options.getUser('user');
        const messageContent = interaction.options.getString('message');
        
        if (!targetUser) {
            await interaction.reply({
                content: '❌ Please mention a valid user to mimic.',
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        if (!messageContent) {
            await interaction.reply({
                content: '❌ Please provide a message to send.',
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        try {
            await interaction.reply({
                content: '✅ Perfect mimic sent!',
                flags: MessageFlags.Ephemeral
            });

            const targetMember = await interaction.guild.members.fetch(targetUser.id);
            
            let displayName = targetMember.displayName || targetUser.username;
            const avatarURL = targetUser.displayAvatarURL({ dynamic: true, size: 1024 });
            
            const webhook = await interaction.channel.createWebhook({
                name: displayName,
                avatar: avatarURL,
                reason: `Perfect mimic command used by ${interaction.user.tag}`
            });

            await webhook.send({
                content: messageContent,
                username: displayName,
                avatarURL: avatarURL
            });

            await webhook.delete();
            
            console.log(`✅ Perfect mimic sent: ${interaction.user.tag} -> ${targetUser.tag}: "${messageContent}"`);

        } catch (error) {
            console.error('Error sending mimic message:', error);
            await interaction.followUp({
                content: `❌ Failed to send mimic message. Make sure I have permission to create webhooks in this channel.\nError: ${error.message}`,
                flags: MessageFlags.Ephemeral
            });
        }
    }

    if (interaction.commandName === 'poll') {
        const question = interaction.options.getString('question');
        const options = [
            interaction.options.getString('option1'),
            interaction.options.getString('option2')
        ];
        
        const durationMinutes = interaction.options.getInteger('duration');
        const option3 = interaction.options.getString('option3');
        const option4 = interaction.options.getString('option4');
        const option5 = interaction.options.getString('option5');
        
        if (option3) options.push(option3);
        if (option4) options.push(option4);
        if (option5) options.push(option5);
        
        const expiresAt = Date.now() + (durationMinutes * 60 * 1000);
        
        const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'];
        const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7'];
        
        // Track who voted for each option
        const votes = {};
        options.forEach((_, index) => {
            votes[index] = [];
        });
        
        // Store poll data
        const pollId = Date.now().toString();
        
        // Create a clean, friend-style embed
        const pollEmbed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle(`📊 ${question}`)
            .setDescription(`**${interaction.user.username}** started a vote!`)
            .addFields(
                options.map((option, index) => ({
                    name: `${emojis[index]} ${option}`,
                    value: '🟩 0 votes (0%)',
                    inline: false
                }))
            )
            .setFooter({ 
                text: `⏳ ${durationMinutes} minutes remaining • Created by ${interaction.user.username}`,
                iconURL: interaction.user.displayAvatarURL()
            })
            .setTimestamp();
        
        // Create buttons
        const row = new ActionRowBuilder();
        for (let i = 0; i < options.length; i++) {
            const color = [ButtonStyle.Success, ButtonStyle.Primary, ButtonStyle.Secondary, ButtonStyle.Danger, ButtonStyle.Success][i] || ButtonStyle.Primary;
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`poll_${pollId}_${i}`)
                    .setLabel(options[i].substring(0, 80))
                    .setStyle(color)
                    .setEmoji(emojis[i])
            );
        }
        
        // Send the poll
        const message = await interaction.reply({
            embeds: [pollEmbed],
            components: [row],
            fetchReply: true
        });
        
        // Save poll data
        pollsData.polls[message.id] = {
            pollId: pollId,
            question: question,
            options: options,
            votes: votes,
            expiresAt: expiresAt,
            creator: interaction.user.id,
            voterHistory: {}
        };
        savePollsData(pollsData);
        
        console.log(`📊 Poll created: "${question}" by ${interaction.user.tag} (${durationMinutes} minutes)`);
        
        // Send confirmation
        await interaction.followUp({
            content: `✅ Poll created! Vote now! (ends in ${durationMinutes} minutes)`,
            flags: MessageFlags.Ephemeral
        });
    }
});

// Handle button interactions for polls
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;
    
    if (interaction.customId.startsWith('poll_')) {
        const [, pollId, optionIndex] = interaction.customId.split('_');
        const messageId = interaction.message.id;
        
        // Check if poll exists
        if (!pollsData.polls[messageId]) {
            await interaction.reply({
                content: '❌ This poll has expired or no longer exists!',
                flags: MessageFlags.Ephemeral
            });
            return;
        }
        
        const poll = pollsData.polls[messageId];
        const userId = interaction.user.id;
        const username = interaction.user.username;
        const index = parseInt(optionIndex);
        
        // Check if poll has expired
        if (Date.now() > poll.expiresAt) {
            await interaction.reply({
                content: '❌ This poll has ended!',
                flags: MessageFlags.Ephemeral
            });
            return;
        }
        
        // Check if user already voted
        if (poll.voterHistory && poll.voterHistory[userId]) {
            const alreadyVotedOption = poll.voterHistory[userId];
            await interaction.reply({
                content: `❌ You already voted! You chose: **${poll.options[alreadyVotedOption]}**\n*Can't change your vote now, that's cheating!*`,
                flags: MessageFlags.Ephemeral
            });
            return;
        }
        
        // Initialize voter history if needed
        if (!poll.voterHistory) {
            poll.voterHistory = {};
        }
        
        // Record the vote
        poll.voterHistory[userId] = index;
        if (!poll.votes[index]) {
            poll.votes[index] = [];
        }
        poll.votes[index].push(userId);
        
        // Calculate votes
        const totalVotes = Object.keys(poll.voterHistory).length;
        
        // Update the embed
        const embed = EmbedBuilder.from(interaction.message.embeds[0]);
        
        const updatedFields = poll.options.map((option, i) => {
            const voteCount = poll.votes[i] ? poll.votes[i].length : 0;
            const percentage = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
            
            // Create a visual bar
            const barLength = 20;
            const filledBars = Math.round((percentage / 100) * barLength);
            const emptyBars = barLength - filledBars;
            const bar = '█'.repeat(filledBars) + '░'.repeat(emptyBars);
            
            return {
                name: `${['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'][i]} ${option}`,
                value: `${bar} **${voteCount}** vote${voteCount !== 1 ? 's' : ''} (${percentage}%)`,
                inline: false
            };
        });
        
        embed.setFields(updatedFields);
        
        // Update description to show total votes
        const timeRemaining = Math.max(0, Math.round((poll.expiresAt - Date.now()) / 60000));
        embed.setDescription(`**${interaction.user.username}** just voted! (${totalVotes} total vote${totalVotes !== 1 ? 's' : ''})`);
        embed.setFooter({ 
            text: `⏳ ${timeRemaining} minutes remaining • ${totalVotes} total votes`,
            iconURL: interaction.user.displayAvatarURL()
        });
        
        await interaction.update({ embeds: [embed] });
        
        // Save updated poll data
        savePollsData(pollsData);
        
        // Send confirmation
        await interaction.followUp({
            content: `✅ Thanks for voting, ${interaction.user.username}! You chose: **${poll.options[index]}**`,
            flags: MessageFlags.Ephemeral
        });
        
        console.log(`📊 Vote recorded: ${interaction.user.tag} voted for option ${index + 1} in poll "${poll.question}"`);
    }
});

// Handle bot errors gracefully
client.on('error', (error) => {
    console.error('❌ Discord client error:', error);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n👋 Bot shutting down...');
    saveData(botData);
    saveBootData(bootData);
    savePollsData(pollsData);
    process.exit(0);
});

// Login
client.login(process.env.DISCORD_TOKEN);
