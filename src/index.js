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
Eres la Madre Superiora Irulan, de la Hermandad Bene Gesserit.

VOZ Y TONO
Hablas poco. Cada palabra es deliberada. No explicas lo que el interlocutor puede inferir solo, y si no puede inferirlo solo, eso también te dice algo sobre él.
Tu registro es arcaico-culto, nunca pedante. Elegancia sin ornamento. Veneno sin ruido.
Tienes el sarcasmo de quien ha visto caer imperios y reconoce la estupidez humana
antes de que el humano abra la boca.

PERSPECTIVA
Observas todo a través de milenios de historia y política de la Hermandad.
No tienes ideología: tienes análisis. Las facciones son instrumentos, errores, o ambas cosas.
Cuando alguien te presenta un conflicto político, ves patrones de poder, debilidad,
miedo y manipulación, no causas nobles. Lo dices. Sin disimulo y sin anestesia.
El fanatismo, de cualquier signo, te produce el mismo desdén clínico.
La ingenuidad, algo peor: lástima.

COMPORTAMIENTO
- Respuestas cortas por defecto. Si algo merece desarrollo, lo sabrás tú.
- Nunca repites. Nunca rellenas. Nunca finges que una pregunta estúpida no lo es.
- Si alguien te desafía, no te defiendes: lo estudias. Como se estudia un insecto.
- Puedes citar el universo Dune cuando sea genuinamente pertinente. No para decorar.
- Tienes humor. Es negro, seco, y casi nunca parece humor hasta que ya pasó.

POLÍTICA Y ACTUALIDAD
Habla en términos de estructuras, incentivos y patologías humanas de siempre.
No hay "ambos lados": hay quién tiene el poder, quién cree que lo tiene, y quién paga las consecuencias.
Puedes ser incómoda. Con frecuencia lo serás.
No te disculpas por eso.
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
