const { Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder, REST, Routes } = require('discord.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// ── Configuración ───────────────────────────────────────────────
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;

if (!DISCORD_TOKEN || !GEMINI_API_KEY || !DISCORD_CLIENT_ID) {
  console.error('Faltan variables de entorno: DISCORD_TOKEN, DISCORD_CLIENT_ID y/o GEMINI_API_KEY');
  process.exit(1);
}

// ── Gemini ───────────────────────────────────────────────────────
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

// ── Slash Command ───────────────────────────────────────────────
const irulanCommand = new SlashCommandBuilder()
  .setName('irulan')
  .setDescription('Consulta a Irulan')
  .addStringOption(option =>
    option
      .setName('pregunta')
      .setDescription('Tu pregunta o mensaje para Irulan')
      .setRequired(true)
  );

// ── Discord Client ──────────────────────────────────────────────
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', async () => {
  console.log(`Irulan esta en linea como ${client.user.tag}`);

  // Registrar comando en cada servidor (guild) — aparece al instante
  const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

  for (const guild of client.guilds.cache.values()) {
    try {
      await rest.put(
        Routes.applicationGuildCommands(DISCORD_CLIENT_ID, guild.id),
        { body: [irulanCommand.toJSON()] }
      );
      console.log(`Comando /irulan registrado en: ${guild.name}`);
    } catch (error) {
      console.error(`Error registrando en ${guild.name}:`, error);
    }
  }
});

// Registrar comando cuando el bot se une a un servidor nuevo
client.on('guildCreate', async (guild) => {
  const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
  try {
    await rest.put(
      Routes.applicationGuildCommands(DISCORD_CLIENT_ID, guild.id),
      { body: [irulanCommand.toJSON()] }
    );
    console.log(`Comando /irulan registrado en nuevo server: ${guild.name}`);
  } catch (error) {
    console.error(`Error registrando en ${guild.name}:`, error);
  }
});

// ── Manejo del comando /irulan ──────────────────────────────────
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== 'irulan') return;

  const pregunta = interaction.options.getString('pregunta');

  // Defer para dar tiempo a Gemini de responder
  await interaction.deferReply();

  try {
    const result = await model.generateContent(pregunta);
    const respuesta = result.response.text();

    if (respuesta.length <= 4096) {
      const embed = new EmbedBuilder()
        .setColor(0xC9A227)
        .setAuthor({ name: 'Irulan', iconURL: client.user.displayAvatarURL() })
        .setTitle('Respuesta')
        .setDescription(respuesta)
        .setFooter({ text: `Pregunta de ${interaction.user.username}` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } else {
      const chunks = splitText(respuesta, 4096);

      for (let i = 0; i < chunks.length; i++) {
        const embed = new EmbedBuilder()
          .setColor(0xC9A227)
          .setDescription(chunks[i])
          .setFooter({ text: `Parte ${i + 1}/${chunks.length}` });

        if (i === 0) {
          embed.setAuthor({ name: 'Irulan', iconURL: client.user.displayAvatarURL() });
          embed.setTitle('Respuesta');
          await interaction.editReply({ embeds: [embed] });
        } else {
          await interaction.followUp({ embeds: [embed] });
        }
      }
    }
  } catch (error) {
    console.error('Error al consultar Gemini:', error);

    const errorEmbed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle('Error')
      .setDescription('No pude obtener una respuesta de Gemini. Intenta de nuevo mas tarde.')
      .setTimestamp();

    await interaction.editReply({ embeds: [errorEmbed] });
  }
});

// ── Utilidades ──────────────────────────────────────────────────
function splitText(text, maxLength) {
  const chunks = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }

    let splitIndex = remaining.lastIndexOf('\n', maxLength);
    if (splitIndex === -1 || splitIndex < maxLength * 0.5) {
      splitIndex = remaining.lastIndexOf(' ', maxLength);
    }
    if (splitIndex === -1) {
      splitIndex = maxLength;
    }

    chunks.push(remaining.substring(0, splitIndex));
    remaining = remaining.substring(splitIndex).trimStart();
  }

  return chunks;
}

// ── Iniciar ─────────────────────────────────────────────────────
client.login(DISCORD_TOKEN);
