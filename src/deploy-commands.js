const { REST, Routes, SlashCommandBuilder } = require('discord.js');
require('dotenv/config');

const commands = [
  new SlashCommandBuilder()
    .setName('irulan')
    .setDescription('Consulta a Irulan')
    .addStringOption(option =>
      option
        .setName('pregunta')
        .setDescription('Tu pregunta o mensaje para Irulan')
        .setRequired(true)
    )
    .toJSON(),
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log('⏳ Registrando comando /irulan...');
    await rest.put(
      Routes.applicationCommands(process.env.DISCORD_CLIENT_ID),
      { body: commands }
    );
    console.log('Comando /irulan registrado correctamente.');
  } catch (error) {
    console.error('Error al registrar comandos:', error);
  }
})();
