require("dotenv").config();
const { Client } = require("discord.js");
const messageHandler = require("./modules/messageHandler.js");

const client = new Client();

// Initialize server
client.once("ready", () => {
    console.log("Initializing...");

    console.log("Ready!");
});

// Get messages
client.on("message", (message) => {
    const messageString = message.toString();

    // Please let me out I'm stuck in vim
    if (messageString[0] != process.env.PREFIX) return;

    messageHandler.replyToCommand(message);
});

// Login to discord
client.login(process.env.DISCORD_TOKEN);
