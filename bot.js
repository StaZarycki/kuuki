require("dotenv").config();
const { Client } = require("discord.js");

const client = new Client();

// Initialize server
client.once("ready", () => {
    console.log("Initializing...");

    console.log("Ready!");
});

// Get messages
client.on("message", (message) => {
    
    if (message[0] != process.env.PREFIX) return;


});

// Login to discord
client.login(process.env.DISCORD_TOKEN);
