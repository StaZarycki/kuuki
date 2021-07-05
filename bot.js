require("dotenv").config();
const { Client } = require("discord.js");
const messageHandler = require("./modules/messageHandler.js");
const scheduler = require("./modules/scheduler.js");
const firebase = require("./modules/firebaseHandler.js");
const helpers = require("./modules/helpers.js");

const client = new Client();
const prefix = process.env.PREFIX;

client.once("ready", () => {
    console.log("Initializing...");

    console.log("Setting up scheduler...");

    client.channels.fetch(process.env.PRIVATE_STREAM_CHANNEL).then((privateChannel) => {
        client.channels.fetch(process.env.PUBLIC_STREAM_CHANNEL).then((publicChannel) => {
            client.channels.fetch(process.env.PRIVATE_BIRTHDAY_CHANNEL).then((birthdayChannel) => {
                scheduler.setScheduler(privateChannel, publicChannel);
                scheduler.scheduleDailyAnnouncement(privateChannel, birthdayChannel);
                // scheduler.checkForBirthday(birthdayChannel);
            });
        }).catch(err => { console.error(err); });
    }).catch(err => { console.error(err); });

    console.log("Ready!");
});

client.on("message", (message) => {
    if (message.content[0] != prefix)
        return;

    const message_array = message.content.substring(1).split(" ");
    const command = message_array[0];
    const channel = message.channel.id;

    // DMs
    if (message.channel.type == "dm")
    {
        // if (command == "help")
        // {
        //     firebase.addCommandUseToStats("help").then(res => console.log(res));
        //     messageHandler.respondForHelp(message);
        // }
    }

    // NOT DM
    if (command == "bonk")
    {
        firebase.addCommandUseToStats(command);

        if (message_array.length < 2)
        {
            message.reply("Błąd! Użyj !bonk [@user]");
            return;
        }

        let userId = message_array[1];
        userId = userId[2] == "!" ? userId.substring(3, message_array[1].length - 1) : userId.substring(2, message_array[1].length - 1);
        client.users.fetch(userId).then(user => {
            messageHandler.respondForBonk(message, user, message.author.avatarURL());
        }).catch(err => {
            console.error(err);
            message.reply("Błąd! Użyj !bonk [@user]");
        });
    }
    else if (command == "unbonk")
    {
        firebase.addCommandUseToStats(command);

        messageHandler.respondForUnbonk(message, message.author.avatarURL().substring(0, message.author.avatarURL().length - 4) + "png");
    }
    else if (command == "sus")
    {
        firebase.addCommandUseToStats(command);
        let arg = message_array[1];
        if (!arg)
        {
            messageHandler.respondForSus(message, message.author.avatarURL().substring(0, message.author.avatarURL().length - 4) + "png");
        }
        else if (arg[0] == "<")
        {
            if (arg[1] == "!" || arg[1] == "@")
            {
                arg = arg[2] == "!" ? arg.substring(3, message_array[1].length - 1) : arg.substring(2, message_array[1].length - 1);
                client.users.fetch(arg).then(user => {
                    messageHandler.respondForSus(message, user.avatarURL().substring(0, user.avatarURL().length - 4) + "png");
                }).catch(err => {
                    console.error(err);
                    message.reply("Błąd! Użyj !sus [@user/link]");
                });
            }
            else
            {
                messageHandler.respondForSus(message, arg.substring(1, arg.length - 1));
            }
        }
        else
        {
            messageHandler.respondForSus(message, arg);
        }
    }
    else if (command == "boob")
    {
        firebase.addCommandUseToStats(command);
        messageHandler.respondForBoob(message);
    }

    // Private channels
    if (channel == process.env.PRIVATE_STREAM_CHANNEL ||
        channel == process.env.PRIVATE_REMINDERS_CHANNEL ||
        channel == process.env.TEST_STREAM_CHANNEL ||
        channel == process.env.TEST_REMINDERS_CHANNEL)
    {
        if (command == "ping")
        {
            firebase.addCommandUseToStats(command);
            messageHandler.respondForPing(message);
        }
        else if (command == "adduser")
        {
            firebase.addCommandUseToStats(command);
            messageHandler.respondForAddUser(message, message_array.splice(1).join(" "));
        }
        else if (command == "checkuser" || command == "checkusers")
        {
            firebase.addCommandUseToStats(command);
            messageHandler.respondForCheckUsers(message, client.users);
        }
        else if (command == "remuser" || command == "removeuser")
        {
            firebase.addCommandUseToStats(command);
            messageHandler.respondForRemoveUser(message);
        }
        else if (command == "setprefix")
        {
            firebase.addCommandUseToStats(command);
            let prefix = client.emojis.cache.find(emoji => emoji.name == message_array[1]);
            if (prefix == null)
            {
                prefix = message_array[1];
            }
            messageHandler.respondForSetPrefix(message, prefix);
        }
        else if (command == "help")
        {
            firebase.addCommandUseToStats(command);
            messageHandler.respondForHelp(message);
        }
        else if (command == "setlink")
        {
            firebase.addCommandUseToStats(command);
            messageHandler.respondForSetLink(message, message_array[1]);
        }
    }

    // Birthday
    if (channel == process.env.PRIVATE_STREAM_CHANNEL ||
        channel == process.env.PRIVATE_BIRTHDAY_CHANNEL)
    {
        if (command == "setbirthday")
        {
            firebase.addCommandUseToStats(command);
            const date = message_array[1];
            messageHandler.respondForSetBirthday(message, date);
        }
        else if (command == "checkbirthday" || command == "checkbirthdays")
        {
            firebase.addCommandUseToStats(command);
            messageHandler.respondForCheckBirthday(message);
        }
    }

    // Private stream channel
    if (channel == process.env.PRIVATE_STREAM_CHANNEL || channel == process.env.TEST_STREAM_CHANNEL)
    {
        if (message.member.hasPermission("ADMINISTRATOR"))
        {
            if (command == "sudoremove")
            {
                firebase.addCommandUseToStats(command);
                messageHandler.respondForSudoRemoveStream(message);
            }
            else if (command == "sudoedit")
            {
                firebase.addCommandUseToStats(command);
                messageHandler.respondForSudoEditStream(message);
            }
            else if (command == "testdaily")
            {
                firebase.addCommandUseToStats(command);
                scheduler.sendDailyMessage(message.channel);
            }
            else if (command == "pingtime")
            {
                firebase.addCommandUseToStats(command);
                console.log(new Date());
                message.reply(helpers.dateToString(new Date(), helpers.ReturnDateFormat.full));
            }
        }

        if (command == "plan")
        {
            firebase.addCommandUseToStats(command);
            const date = message_array[1] + " " + message_array[2];
            const title = message_array.slice(3).join(" ");

            messageHandler.respondForPlanStream(message, date, title);
        }
        else if (command == "checkmy")
        {
            firebase.addCommandUseToStats(command);
            messageHandler.respondForCheckMyStreams(message);
        }
        else if (command == "togglewarnings")
        {
            firebase.addCommandUseToStats(command);
            messageHandler.respondForToggleWarnings(message);
        }
        else if (command == "remove")
        {
            firebase.addCommandUseToStats(command);
            messageHandler.respondForRemoveStream(message);
        }
        else if (command == "checkall")
        {
            firebase.addCommandUseToStats(command);
            messageHandler.respondForCheckAllStreams(message);
        }
        else if (command == "check")
        {
            firebase.addCommandUseToStats(command);
            if (message_array.length == 1)
            {
                messageHandler.respondForCheckDateRange(message);
            }
            else if (message_array.length == 2)
            {
                const day = message_array[1];
                messageHandler.respondForCheckOneDay(message, day);
            }
            else if (message_array.length == 3)
            {
                const dayStart = message_array[1];
                const dayEnd = message_array[2];
                messageHandler.respondForCheckDateRange(message, dayStart, dayEnd);
            }
        }
        else if (command == "edit")
        {
            firebase.addCommandUseToStats(command);
            messageHandler.respondForEditStream(message);
        }
        else if (command == "editdate")
        {
            firebase.addCommandUseToStats(command);
            message.reply("Psst! Teraz wystarczy użyć opcji !edit");
            messageHandler.respondForEditStream(message);
        }
        else if (command == "edittitle" || command == "editname")
        {
            firebase.addCommandUseToStats(command);
            message.reply("Psst! Teraz wystarczy użyć opcji !edit");
            messageHandler.respondForEditStream(message);
        }
    }
    // Private reminders channel
    else if (channel == process.env.PRIVATE_REMINDERS_CHANNEL || channel == process.env.TEST_REMINDERS_CHANNEL)
    {
        if (command == "check")
        {
            messageHandler.respondForCheckReminders(message);
        }
        else if (command == "add")
        {
            const date = message_array[1] + " " + message_array[2];
            const payload = message_array.slice(3).join(" ");

            messageHandler.respondForAddReminder(message, date, payload);
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
