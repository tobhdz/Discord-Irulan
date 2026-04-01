# 📜 Irulan — Bot de Discord con Gemini AI

Bot de Discord que responde consultas usando **Google Gemini** a través del comando `/irulan`.

## 🚀 Setup

### 1. Crear el bot en Discord

1. Ve a [Discord Developer Portal](https://discord.com/developers/applications)
2. Crea una nueva aplicación llamada **Irulan**
3. Ve a la sección **Bot** y crea un bot
4. Copia el **Token** del bot
5. Ve a **OAuth2 → URL Generator**:
   - Scopes: `bot`, `applications.commands`
   - Bot Permissions: `Send Messages`, `Use Slash Commands`, `Embed Links`
6. Usa la URL generada para invitar el bot a tu servidor

### 2. Variables de entorno

El bot necesita estas variables:

| Variable           | Descripción                          |
|--------------------|--------------------------------------|
| `DISCORD_TOKEN`    | Token del bot de Discord             |
| `DISCORD_CLIENT_ID`| Client ID de tu aplicación de Discord|
| `GEMINI_API_KEY`   | API Key de Google Gemini             |

### 3. Deploy en Railway

1. Sube este repo a GitHub
2. En [Railway](https://railway.app), crea un nuevo proyecto desde GitHub
3. Configura las variables de entorno en Railway
4. Railway desplegará automáticamente el bot

## 💬 Uso

```
/irulan pregunta: ¿Cuál es el sentido de la vida?
```

El bot responderá con un embed dorado con la respuesta de Gemini.

## 🛠 Desarrollo local

```bash
npm install
# Configura las variables de entorno en un archivo .env
npm run deploy-commands  # Registrar el comando (solo una vez)
npm start                # Iniciar el bot
```
