const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// ── Configuración ───────────────────────────────────────────────
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!DISCORD_TOKEN || !GEMINI_API_KEY) {
  console.error('❌ Faltan variables de entorno: DISCORD_TOKEN y/o GEMINI_API_KEY');
  process.exit(1);
}

// ── Gemini ───────────────────────────────────────────────────────
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

// ── Discord Client ──────────────────────────────────────────────
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', () => {
  console.log(`✅ Irulan está en línea como ${client.user.tag}`);
});

// ── Manejo del comando /irulan ──────────────────────────────────
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== 'irulan') return;

  const pregunta = interaction.options.getString('pregunta');

  // Defer para dar tiempo a Gemini de responder (máx 15 min)
  await interaction.deferReply();

  try {
    const result = await model.generateContent(pregunta);
    const respuesta = result.response.text();

    // Discord tiene un límite de 2000 caracteres por mensaje
    if (respuesta.length <= 4096) {
      const embed = new EmbedBuilder()
        .setColor(0xC9A227)
        .setAuthor({ name: 'Irulan', iconURL: client.user.displayAvatarURL() })
        .setTitle('📜 Respuesta')
        .setDescription(respuesta)
        .setFooter({ text: `Pregunta de ${interaction.user.username}` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } else {
      // Si la respuesta es muy larga, dividirla en chunks
      const chunks = splitText(respuesta, 4096);

      for (let i = 0; i < chunks.length; i++) {
        const embed = new EmbedBuilder()
          .setColor(0xC9A227)
          .setDescription(chunks[i])
          .setFooter({ text: `Parte ${i + 1}/${chunks.length}` });

        if (i === 0) {
          embed.setAuthor({ name: 'Irulan', iconURL: client.user.displayAvatarURL() });
          embed.setTitle('📜 Respuesta');
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
      .setTitle('❌ Error')
      .setDescription('No pude obtener una respuesta de Gemini. Intenta de nuevo más tarde.')
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

    // Intentar cortar en el último salto de línea dentro del límite
    let splitIndex = remaining.lastIndexOf('\n', maxLength);
    if (splitIndex === -1 || splitIndex < maxLength * 0.5) {
      // Si no hay buen punto de corte, cortar en el último espacio
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
