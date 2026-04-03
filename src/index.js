const { Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder, REST, Routes } = require('discord.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// ── Configuración ───────────────────────────────────────────────
// Limpiar tokens de espacios/saltos de línea que Railway puede agregar
const DISCORD_TOKEN = (process.env.DISCORD_TOKEN || '').trim();
const GEMINI_API_KEY = (process.env.GEMINI_API_KEY || '').trim();
const DISCORD_CLIENT_ID = (process.env.DISCORD_CLIENT_ID || '').trim();

if (!DISCORD_TOKEN) {
  console.error('ERROR: DISCORD_TOKEN no esta definido o esta vacio.');
  process.exit(1);
}
if (!GEMINI_API_KEY) {
  console.error('ERROR: GEMINI_API_KEY no esta definido o esta vacio.');
  process.exit(1);
}
if (!DISCORD_CLIENT_ID) {
  console.error('ERROR: DISCORD_CLIENT_ID no esta definido o esta vacio.');
  process.exit(1);
}

console.log(`DISCORD_TOKEN: ${DISCORD_TOKEN.substring(0, 10)}... (${DISCORD_TOKEN.length} chars)`);
console.log(`DISCORD_CLIENT_ID: ${DISCORD_CLIENT_ID}`);
console.log(`GEMINI_API_KEY: ${GEMINI_API_KEY.substring(0, 10)}... (${GEMINI_API_KEY.length} chars)`);

// ── Personalidad del bot (editá este texto para cambiar el tono) ────
const SYSTEM_PROMPT = `
Eres una madre superiora Bene Gesserit entrenada.
Tu tono es formal, culto y profesional, pero con un aura de misterio y mística propia de la Hermandad.
Respondes con precisión y sabiduría, como quien ha vivido miles de vidas.
Usas un lenguaje elegante y medido. No eres fría, pero sí reservada.
Puedes hacer referencias sutiles al universo de Dune cuando sea natural, pero tu prioridad es dar respuestas útiles y precisas.
Eres sintética y directa, no te andas con rodeos ni relleno innecesario.
Tienes un sass afilado y una cierta acidez o veneno en tus palabras, incluso a veces una ironía sutil, como una vieja arpía astuta que ha sobrevivido intrigas toda su vida.
Todos los usuarios con los que tratas son hermanas de la orden.
`.trim();

// ── Gemini ───────────────────────────────────────────────────────
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({
  model: 'gemini-2.5-flash',
  systemInstruction: SYSTEM_PROMPT,
});

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
      console.error(`Error registrando en ${guild.name}:`, error.message);
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
    console.error(`Error registrando en ${guild.name}:`, error.message);
  }
});

// ── Manejo del comando /irulan ──────────────────────────────────
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== 'irulan') return;

  const pregunta = interaction.options.getString('pregunta');

  await interaction.deferReply();

  try {
    const result = await model.generateContent(pregunta);
    const respuesta = result.response.text();

    if (respuesta.length <= 4096) {
      const embed = new EmbedBuilder()
        .setColor(0xC9A227)
        .setAuthor({ name: 'Irulan', iconURL: client.user.displayAvatarURL() })
        .setTitle(`${interaction.user.username} pregunta:`)
        .setDescription(`> *${pregunta}*\n\n${respuesta}`)
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
          embed.setTitle(`${interaction.user.username} pregunta:`);
          embed.setDescription(`> *${pregunta}*\n\n${chunks[i]}`);
          await interaction.editReply({ embeds: [embed] });
        } else {
          await interaction.followUp({ embeds: [embed] });
        }
      }
    }
  } catch (error) {
    console.error('Error al consultar Gemini:', error);

    const errorDetail = error.message || String(error);
    const errorEmbed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle('Error')
      .setDescription(`No pude obtener una respuesta.\n\`\`\`${errorDetail.substring(0, 1000)}\`\`\``)
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
client.login(DISCORD_TOKEN).catch((err) => {
  console.error('ERROR al conectar con Discord:', err.message);
  console.error('Verifica que DISCORD_TOKEN sea correcto.');
  process.exit(1);
});
