require("dotenv").config();
const { Client } = require("discord.js");

const client = new Client();
const prefix = process.env.PREFIX;

client.once("ready", () => {
    console.log("Initializing...");

    console.log("Ready!");
});

client.on("message", (message) => {
    
    if (message[0] != process.env.PREFIX) return;
});

client.login(process.env.DISCORD_TOKEN);
