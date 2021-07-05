require('dotenv').config();
const fs = require("fs");
const schedule = require("node-schedule");
const admin = require("firebase-admin");
const serviceAccount = require("./admin.json");
const { Client } = require("discord.js");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://kuuki-bot-default-rtdb.europe-west1.firebasedatabase.app"
});

const database = admin.database();

const client = new Client();
const prefix = process.env.PREFIX;

// Set interval for sending scheduled stream message
const rule = new schedule.RecurrenceRule();
rule.minute = 00;
rule.hour = 11;

const currentRule = new schedule.RecurrenceRule();
currentRule.minute = new schedule.Range(0, 59, 1);

const usersRef = database.ref("Users");
const streamsRef = database.ref("Streams");
const remindersRef = database.ref("Reminders");
const birthdaysRef = database.ref("Birthdays");

const streamChannel = "801798035872940052";
const reminderChannel = "816451765292892192";
const birthdayChannel = "819972167889453086";
const testChannel = "715545735088832513";

let streams = [];
let users = [];
let reminders = [];
let birthdays = [];

client.once("ready", () => {

    // usersRef.once("value", (snap) => {
    //     users = snap.val();
    // });

    // streamsRef.once("value", (snap) => {
    //     streams = snap.val();
    // });

    // remindersRef.once("value", (snap) => {
    //     reminders = snap.val();
    // });

    checkUsers();
    checkStreams();
    checkReminders();
    checkBirthdays();
    
    schedule.scheduleJob(rule, () => {
        // VPoland
        client.channels.fetch(streamChannel).then((channel) => {
            dailyCheckMessage(channel);
        }).catch(err => {
            console.log(err);
        });

        // Bot Testing
        // client.channels.fetch(testChannel).then((channel) => {
        //     dailyCheckMessage(channel);
        // }).catch(err => {
        //     console.log(err);
        // });

        checkOldStreams();
    });

    schedule.scheduleJob(currentRule, () => {
        checkCurrentStreams();
        checkCurrentReminders();
        checkCurrentBirthdays();
    });

});

client.on("message", (message) => {
    // Return if not a command
    if (message.content[0] != prefix)
        return;

    // Trim message
    const f_message = message.content.substring(1);

    // Test
    if (f_message == "ping")
        message.channel.send("Pong!");

    if (f_message == "testdaily")
    {
        dailyCheckMessage(message.channel);
        checkOldStreams();
    }

    // Admin commands
    if (message.member.hasPermission("ADMINISTRATOR"))
    {
        // Edit date
        if (f_message == "sudoeditdate")
        {
            // Check if user has any planned streams
            const get_streams = streams;
            if (get_streams == null)
            {
                message.reply("Brak zaplanowanych transmisji! Sprawdź !check");
                return;
            }

            let reply = "Którą transmisję chcesz edytować? (napisz 1, 2 etc. lub 'x' żeby anulować)\n\n";

            for (let i = 0; i < get_streams.length; i++)
            {
                reply += `${i+1}. ${get_streams[i].author} - ${get_streams[i].name} (${get_streams[i].display_date})\n`;
            }

            message.channel.send(reply);

            // Wait for response
            message.channel.awaitMessages(m => m.author.id == message.author.id, { max: 1, time: 120000 }).then(collected => {
                const messageContent = collected.first().content;

                // Cancel if user says so
                if (messageContent.toLowerCase() == "x")
                {
                    collected.first().reply("Ok, anuluję edycję");
                    return;
                }

                // Get stream number
                if (parseInt(messageContent) >= 1 && parseInt(messageContent) <= get_streams.length)
                {
                    const editObject = get_streams[parseInt(messageContent - 1)];

                    collected.first().reply(`Podaj nową datę dla streama: ${editObject.name} [dzień-miesiąc-rok godzina:minuta]`);

                    message.channel.awaitMessages(m2 => m2.author.id == message.author.id, { max: 1, time: 120000 }).then(collected2 => {

                        if (!(collected2.first().content.search(/^[0-3][0-9]+-[0-1][0-9]+-202[1-9]+ [0-2][0-9]+:[0-5][0-9]$/) != -1))
                        {
                            collected2.first().reply("Nieprawidłowy format! [dzień-miesiąc-rok godzina:minuta]\nSpróbuj jeszcze raz! (wymagane ponowne wywołanie komendy)");
                            return;
                        }
                        
                        const msg_f = collected2.first().content.split(" ");

                        const date = stringToDate(msg_f[0] + " " + msg_f[1]).toString();
                        const display_date = msg_f[0] + " " + msg_f[1];

                        const collidingStream = getStreamColliding(date, editObject.display_date);
                        if (collidingStream)
                        {
                            message.reply(`Uwaga! Jest zaplanowany stream: ${collidingStream.name} na: ${collidingStream.display_date}. Czy na pewno chcesz kontynuować?`).then((msg) => {
                                msg.react("✔️").then(r => {
                                    msg.react("✖️");
                                });

                                msg.awaitReactions((reaction, user) => user.id == message.author.id && (reaction.emoji.name == "✔️" || reaction.emoji.name == "✖️"),
                                { max: 1, time: 120000 }).then(collectedEmoji => {
                                    if (collectedEmoji.first().emoji.name == "✖️")
                                    {
                                        message.channel.send("Ok, anulowanie planowania streama.");
                                        return;
                                    }
                                    else if (collectedEmoji.first().emoji.name == "✔️")
                                    {
                                        editObject.date = date;
                                        editObject.display_date = display_date;

                                        get_streams[parseInt(messageContent - 1)] = editObject;

                                        message.channel.send(`Transmisja ${editObject.name} została zaplanowana na: ${display_date}!`);
                                        
                                        writeToStreams();
                                        return;
                                    }
                                });
                            });
                        }
                        else
                        {
                            editObject.date = date;
                            editObject.display_date = display_date;

                            get_streams[parseInt(messageContent - 1)] = editObject;

                            message.channel.send(`Transmisja ${editObject.name} została zaplanowana na: ${display_date}!`);
                            
                            writeToStreams();
                        }
                    });

                }
                // Return if value is not valid
                else {
                    collected.first().reply("Nieprawidłowa wartość.");
                }
            }).catch(() => {
                return;
            });
        }

        if (f_message == "sudoeditname")
        {
            // Check if user has any planned streams
            const get_streams = streams;
            if (get_streams == null)
            {
                message.reply("Brak zaplanowanych transmisji!");
                return;
            }

            let reply = "Którą transmisję chcesz edytować? (napisz 1, 2 etc. lub 'x' żeby anulować)\n\n";

            for (let i = 0; i < get_streams.length; i++)
            {
                reply += `${i+1}. ${get_streams[i].author} - ${get_streams[i].name} (${get_streams[i].display_date})\n`;
            }

            message.channel.send(reply);

            // Wait for response
            message.channel.awaitMessages(m => m.author.id == message.author.id, { max: 1, time: 120000 }).then(collected => {
                const messageContent = collected.first().content;

                // Cancel if user says so
                if (messageContent.toLowerCase() == "x")
                {
                    collected.first().reply("Ok, anuluję edycję");
                    return;
                }

                // Get stream number
                if (parseInt(messageContent) >= 1 && parseInt(messageContent) <= get_streams.length)
                {
                    const editObject = get_streams[parseInt(messageContent - 1)];

                    collected.first().reply(`Podaj nową nazwę streama dla: ${editObject.name}`);

                    message.channel.awaitMessages(m2 => m2.author.id == message.author.id, { max: 1, time: 120000 }).then(collected2 => {
                        editObject.name = collected2.first().content;
                        
                        get_streams[parseInt(messageContent - 1)] = editObject;
                        writeToStreams();

                        collected2.first().reply("Ok!");
                    });

                }
                // Return if value is not valid
                else {
                    collected.first().reply("Nieprawidłowa wartość.");
                }
            }).catch(() => {
                return;
            });
        }

        if (f_message == "sudoremove")
        {
            // Check if user has any planned streams
            const get_streams = streams;

            let reply = "Którą transmisję usunąć? (napisz 1, 2 etc. lub 'x' żeby anulować)\n\n";

            for (let i = 0; i < get_streams.length; i++)
            {
                reply += `${i+1}. ${get_streams[i].name} (${get_streams[i].display_date})\n`;
            }

            message.channel.send(reply);

            // Wait for response
            message.channel.awaitMessages(m => m.author.id == message.author.id, {max: 1, time: 120000}).then(collected => {
                const messageContent = collected.first().content;

                // Cancel if user says so
                if (messageContent.toLowerCase() == "x")
                {
                    collected.first().reply("Ok, anuluję usuwanie");
                    return;
                }

                // Get stream number
                if (parseInt(messageContent) >= 1 && parseInt(messageContent) <= get_streams.length)
                {
                    const removeObject = get_streams[parseInt(messageContent - 1)];

                    // Check if user really wants to remove this object
                    collected.first().reply(`Na pewno chcesz usunąć: ${removeObject.name}?`).then((replyMessage) => {
                        replyMessage.react("✔️").then(r => {
                            replyMessage.react("✖️");
                        });

                        // Check for reaction
                        replyMessage.awaitReactions((reaction, user) => user.id == message.author.id && (reaction.emoji.name == "✔️" || reaction.emoji.name == "✖️"),
                        { max: 1, time: 120000 }).then(collectedEmoji => {

                            // Cancel
                            if (collectedEmoji.first().emoji.name == "✖️")
                            {
                                replyMessage.reply("Ok, anuluję usuwanie");
                                return;
                            }

                            // Remove stream
                            else if (collectedEmoji.first().emoji.name == "✔️")
                            {
                                streams = streams.filter(stream => { return !(stream.author == removeObject.author && stream.name == removeObject.name && stream.date == removeObject.date); });
                                
                                replyMessage.reply("Usunięto pomyślnie!");
                                writeToStreams();
                            }
                        });
                    });
                }
                // Return if value is not valid
                else {
                    collected.first().reply("Nieprawidłowa wartość.");
                }
            }).catch(() => {
                return;
            });
        }
    }
    
    // Check users
    if (f_message == "checkusers" || f_message == "checkuser")
    {
        checkUsers();

        // Return if users[] is empty
        if (users.length == 0)
        {
            message.channel.send("Brak powiązanych kont!");
            return;
        }

        let reply = "Powiązane konta:\n";

        users.forEach(user => {
            reply += `:o: :detective: ${user.discord} => :movie_camera: ${user.youtube}\n`;
        });

        message.channel.send(reply);
    }

    // Add user
    if (f_message.search(/^(adduser) +/) != -1)
    {
        // Format message
        let message_array = f_message.split(" ");

        const discordName = message.member.user.username;
        const youtubeName = message_array[1];

        // Return if discord user is already in "database"
        if (users.find(user => user.discord == discordName))
        {
            message.reply("Jesteś już dodany do bazy! Sprawdź pod !checkusers");
            return;
        }

        // Add to "database"
        users.push({ "discord": discordName, "youtube": youtubeName});
        
        message.channel.send(`Konto ${youtubeName} zostało powiązane z kontem ${discordName}!`);
        writeToUsers();
    }
    else if (f_message.includes("adduser"))
    {
        message.reply("Poprawne użycie komendy: !adduser [nazwa konta YouTube]");
    }

    // Remove user
    if (f_message == "remuser")
    {
        const discordName = message.member.user.username;
        let youtubeName = "";

        // Return if user is not in "database"
        if (users.find(user => user.discord == discordName) == null)
        {
            message.reply("Nie ma cię w bazie! Sprawdź !checkusers");
            return;
        }

        // Remove user from users[]
        users = users.filter((user) => {
            if (user.discord == discordName)
                youtubeName = user.youtube;

            return user.discord != discordName;
        });
        
        message.channel.send(`Konto ${youtubeName} zostało usunięte!`);
        writeToUsers();
    }

    // Check birthdays
    if (f_message == "checkbirthday" || f_message == "checkbirthdays")
    {
        checkBirthdays();
        
        if (birthdays.length == 0)
        {
            message.reply("Brak urodzin w bazie!");
            return;
        }

        let returnMessage = "";

        birthdays.forEach(birthday => {
            returnMessage += `\n${birthday.author} - ${birthday.display_date}`;
        });

        message.channel.send(returnMessage);
    }

    // Set birthday
    if (f_message.search(/^(setbirthday) [0-3][0-9]+-[0-1][0-9]+/) != -1)
    {
        // Check if user is in database
        const user_author = users.find(user => user.discord == message.member.user.username);
        if (user_author == null)
        {
            message.reply("Nie mam cię w bazie danych! Sprawdź !checkusers");
            return;
        }

        const display_date = f_message.split(" ")[1];
        const date = stringToDate(`${display_date}-2000 12:00`);
        console.log(date);

        console.log("Birthdays: ");
        console.log(birthdays);

        // if (birthdays == null) birthdays = [];

        let bd = birthdays.find(birthday => birthday.author == user_author.discord)
        if (bd)
        {
            bd.date = date.toString();
            bd.display_date = display_date;
        }
        else
        {
            birthdays.push({ "author": user_author.discord, "date": date.toString(), "display_date": display_date });
        }
        console.log(bd);

        message.channel.send(`Urodziny zostały ustawione na ${display_date}!`);
        writeToBirthdays();
    }
    else if (f_message.includes("setbirthday"))
    {
        sendSetBirthdayErrorMessage(message);
    }
    
    // Check reminders
    if (f_message == "checkreminders")
    {
        // Check if user is in database
        const user_author = users.find(user => user.discord == message.member.user.username);
        if (user_author == null)
        {
            message.reply("Nie mam cię w bazie danych! Sprawdź !checkusers");
            return;
        }

        checkReminders();

        const usersRemindersTab = reminders.filter((reminder) => { return reminder.author == user_author.discord; });
        
        if (usersRemindersTab.length == 0)
        {
            message.reply("Nie masz żadnych zapisanych przypomnień!");
            return;
        }

        let returnMessage = "Twoje przypomnienia:\n";

        usersRemindersTab.forEach(reminder => {
            returnMessage += `\n${reminder.display_date} | ${reminder.payload}`;
        });

        message.channel.send(returnMessage);
    }

    // Remove reminder
    if (f_message == "removereminder")
    {
        // Check if user is in database
        const user_author = users.find(user => user.discord == message.member.user.username);
        if (user_author == null)
        {
            message.reply("Nie mam cię w bazie danych! Sprawdź !checkusers");
            return;
        }

        checkReminders();

        const usersRemindersTab = reminders.filter((reminder) => { return reminder.author == user_author.discord; });
        
        if (usersRemindersTab.length == 0)
        {
            message.reply("Nie masz żadnych zapisanych przypomnień!");
            return;
        }

        let msgReply = "Które przypomnienie chcesz usunąć? Wpisz 1, 2, 3 itp. lub x aby anulować\n";
        for (let i = 1; i <= usersRemindersTab.length; i++)
        {
            msgReply += `\n${i}. ${usersRemindersTab[i-1].display_date} | ${usersRemindersTab[i-1].payload}`
        }

        message.channel.send(msgReply);

        // Wait for response
        message.channel.awaitMessages(m => m.author.id == message.author.id, { max: 1, time: 120000 }).then(collected => {
            const messageContent = collected.first().content;

            // Cancel if user says so
            if (messageContent.toLowerCase() == "x")
            {
                collected.first().reply("Ok, anuluję");
                return;
            }

            // Get reminder number
            if (parseInt(messageContent) >= 1 && parseInt(messageContent) <= usersRemindersTab.length)
            {
                const removeObject = usersRemindersTab[parseInt(messageContent - 1)];

                // Check if user really wants to remove this object
                collected.first().reply(`Na pewno chcesz usunąć numerek ${messageContent}?`).then((replyMessage) => {
                    replyMessage.react("✔️").then(r => {
                        replyMessage.react("✖️");
                    });

                    // Check for reaction
                    replyMessage.awaitReactions((reaction, user) => user.id == message.author.id && (reaction.emoji.name == "✔️" || reaction.emoji.name == "✖️"),
                    { max: 1, time: 120000 }).then(collectedEmoji => {

                        // Cancel
                        if (collectedEmoji.first().emoji.name == "✖️")
                        {
                            replyMessage.reply("Ok, anuluję usuwanie");
                            return;
                        }

                        // Remove stream
                        else if (collectedEmoji.first().emoji.name == "✔️")
                        {
                            reminders = reminders.filter(reminder => { return !(reminder.author == user_author.discord && reminder.payload == removeObject.payload && reminder.date == removeObject.date); });
                            
                            replyMessage.reply("Usunięto pomyślnie!");
                            writeToReminders();
                        }
                    });
                });
            }
            // Return if value is not valid
            else {
                collected.first().reply("Nieprawidłowa wartość.");
            }
        }).catch(() => {
            return;
        });
    }

    // Create reminder
    if (f_message.search(/^(remind) [0-3][0-9]+-[0-1][0-9]+-202[1-9]+ [0-2][0-9]+:[0-5][0-9]+ /) != -1)
    {
        // Make an array
        let message_array = f_message.split(" ");

        // Send error message if is not in correct format
        if (message_array.length < 4)
        {
            sendAddReminderErrorMessage(message);
        }

        // Check if user is in "database"
        const user = users.find(user => user.discord == message.member.user.username);
        if (user == null)
        {
            message.reply("Nie mam cię w bazie danych! Sprawdź !checkusers");
            return;
        }

        // Create object
        const author = user.discord;
        const date = stringToDate(message_array[1] + " " + message_array[2]).toString();
        const display_date = message_array[1] + " " + message_array[2];
        const payload = message_array.splice(3).join(" ");

        reminders.push({ "author": author, "payload": payload, "date": date, "display_date": display_date });
        message.channel.send(`${payload} zostanie przypomniane: ${display_date}!`);
        writeToReminders();
    }
    else if (f_message.includes("remind") && !f_message.includes("checkreminder") && !f_message.includes("removereminder"))
    {
        sendAddReminderErrorMessage(message);
    }

    // Check users streams
    if (f_message == "checkmy")
    {
        checkStreams();
        const author = message.member.user.username;

        if (streams.length == 0)
        {
            message.channel.send("Brak zaplanowanych transmisji.");
            return;
        }

        let reply = `Twoje zaplanowane transmisje: \n`;

        let index = 0;
        let index2 = 0;
        streams.forEach(stream => {
            if (stream.author != users.filter(user => user.discord == author)[0].youtube)
                return;

            index++;
            index2++;
            const prefix = users.find(user => user.youtube == stream.author).prefix;
            reply += `${prefix != null ? prefix : ":white_circle:"} ${stream.display_date} - ${stream.name} (${stream.author})\n`;

            if (index >= 15)
            {
                message.channel.send(reply);
                reply = "";
                index = 0;
            }
        });

        if (index2 == 0)
        {
            reply += "Brak zaplanowanych transmisji!";
        }

        if (reply != "")
            message.channel.send(reply);
    }

    // Check all streams
    if (f_message == "checkall")
    {
        checkStreams();

        if (streams.length == 0)
        {
            message.channel.send("Brak zaplanowanych transmisji.");
            return;
        }

        let reply = "Zaplanowane transmisje (" + streams.length + "): " + (streams.length >= 30 ? "[pojebało was chyba]" : "") + "\n\n";

        let index = 0;
        streams.forEach(stream => {
            index++;
            const prefix = users.find(user => user.youtube == stream.author).prefix;
            reply += `${prefix != null ? prefix : ":white_circle:"} ${stream.display_date} - ${stream.name} (${stream.author})\n`;

            if (index >= 15)
            {
                message.channel.send(reply);
                reply = "";
                index = 0;
            }
        });

        if (reply != "")
            message.channel.send(reply);
    }

    // Check streams
    if (f_message.includes("check"))
    {
        const ff_message = f_message.split(" ");
        if (ff_message[0] != "check")
            return;

        checkStreams();

        if (streams.length == 0)
        {
            message.channel.send("Brak zaplanowanych transmisji.");
            return;
        }
        let reply = "";

        const currentDate = new Date();
        if (ff_message[1] == null)
        {
            const maxDate = new Date().setDate(currentDate.getDate() + 6);
            const maxDateDate = new Date(maxDate);
    
            const currentDateString = "".concat(currentDate.getDate().toString(),
                "-",
                ((currentDate.getMonth() + 1).toString()[0] == "0") ? (currentDate.getMonth() + 1).toString() : "0" + (currentDate.getMonth() + 1).toString(),
                "-",
                currentDate.getFullYear().toString());
    
            const maxDateString = "".concat(maxDateDate.getDate().toString(),
                "-",
                ((maxDateDate.getMonth() + 1).toString()[0] == "0") ? (maxDateDate.getMonth() + 1).toString() : "0" + (maxDateDate.getMonth() + 1).toString(),
                "-",
                maxDateDate.getFullYear().toString());
    
            reply = `Zaplanowane transmisje na ${currentDateString} - ${maxDateString}:\n`;
    
            let index = 0;
            let index2 = 0;
            streams.forEach(stream => {
    
                if (stringToDate(stream.display_date).getTime() >= maxDate)
                    return;
    
                index++;
                index2++;
                const prefix = users.find(user => user.youtube == stream.author).prefix;
                reply += `${prefix != null ? prefix : ":white_circle:"} ${stream.display_date} - ${stream.name} (${stream.author})\n`;
    
                if (index >= 15)
                {
                    message.channel.send(reply);
                    reply = "";
                    index = 0;
                }
            });
            if (index2 == 0)
            {
                reply += "Brak zaplanowanych transmisji!\n";
            }
        }
        else if (ff_message[2] == null)
        {
            const dateToCheck = stringToDate(ff_message[1] + " 01:00");
            const dateToCheckString = "".concat(dateToCheck.getDate().toString(),
                "-",
                ((dateToCheck.getMonth() + 1).toString()[0] == "0") ? (dateToCheck.getMonth() + 1).toString() : "0" + (dateToCheck.getMonth() + 1).toString(),
                "-",
                dateToCheck.getFullYear().toString());

            reply = `Zaplanowane transmisje na ${dateToCheckString}:\n`;

            let index = 0;
            let index2 = 0;
            streams.forEach(stream => {
                
                if (stringToDate(stream.display_date).getFullYear() != dateToCheck.getFullYear()
                    || stringToDate(stream.display_date).getMonth() != dateToCheck.getMonth()
                    || stringToDate(stream.display_date).getDate() != dateToCheck.getDate())
                    return;
                
                index++;
                index2++;
                const prefix = users.find(user => user.youtube == stream.author).prefix;
                reply += `${prefix != null ? prefix : ":white_circle:"} ${stream.display_date} - ${stream.name} (${stream.author})\n`;
    
                if (index >= 15)
                {
                    message.channel.send(reply);
                    reply = "";
                    index = 0;
                }
            });
            if (index2 == 0)
            {
                reply += "Brak zaplanowanych transmisji!\n";
            }
        }
        else
        {
            const dateStart = stringToDate(ff_message[1] + " 01:00");
            const dateEnd = stringToDate(ff_message[2] + " 24:00");

            const dateStartString = "".concat(dateStart.getDate().toString(),
                "-",
                ((dateStart.getMonth() + 1).toString()[0] == "0") ? (dateStart.getMonth() + 1).toString() : "0" + (dateStart.getMonth() + 1).toString(),
                "-",
                dateStart.getFullYear().toString());

            const dateEndString = "".concat(dateEnd.getDate().toString(),
                "-",
                ((dateEnd.getMonth() + 1).toString()[0] == "0") ? (dateEnd.getMonth() + 1).toString() : "0" + (dateEnd.getMonth() + 1).toString(),
                "-",
                dateEnd.getFullYear().toString());

            reply = `Zaplanowane transmisje na ${dateStartString} - ${dateEndString}:\n`;

            let index = 0;
            let index2 = 0;
            streams.forEach(stream => {
                
                if (stringToDate(stream.display_date).getTime() > dateEnd || stringToDate(stream.display_date).getTime() < dateStart)
                    return;
                
                index++;
                index2++;
                const prefix = users.find(user => user.youtube == stream.author).prefix;
                reply += `${prefix != null ? prefix : ":white_circle:"} ${stream.display_date} - ${stream.name} (${stream.author})\n`;
    
                if (index >= 15)
                {
                    message.channel.send(reply);
                    reply = "";
                    index = 0;
                }
            });
            if (index2 == 0)
            {
                reply += "Brak zaplanowanych transmisji!\n";
            }
        }

        if (reply != "")
        message.channel.send(reply);
    }

    // Add stream
    if (f_message.search(/^(plan) [0-3][0-9]+-[0-1][0-9]+-202[1-9]+ [0-2][0-9]+:[0-5][0-9]+ /) != -1)
    {
        // Make an array
        let message_array = f_message.split(" ");

        // Send error message if is not in correct format
        if (message_array.length < 4)
        {
            sendAddStreamErrorMessage(message);
        }

        // Check if user is in "database"
        const user = users.find(user => user.discord == message.member.user.username);
        if (user == null)
        {
            message.reply("Nie mam cię w bazie danych! Sprawdź !checkusers");
            return;
        }

        // Check how many streams are in database
        // if (streams.length >= 20)
        // {
        //     message.reply("Niestety, jest obecnie za dużo zaplanowanych streamów! Poczekaj, aż zwolni się trochę miejsca.");
        //     return;
        // }
        
        // Create object
        const author = user.youtube;
        const name = message_array.splice(3).join(" ");
        const date = stringToDate(message_array[1] + " " + message_array[2]).toString();
        const display_date = message_array[1] + " " + message_array[2];

        // Check date
        // if (stringToDate(message_array[1] + " " + message_array[2]).getTime() - new Date().getTime() >= (2592) * 1000000)
        // {
        //     message.reply("W zwizku z limitem ilości zaplanowanych transmisji nie jest możliwe utworzenie transmisji wcześniej niż 30 dni przed.");
        //     return;
        // }
        
        // Check for colliding streams
        const collidingStream = getStreamColliding(date);
        if (collidingStream)
        {
            message.reply(`Uwaga! Jest zaplanowany stream: ${collidingStream.name} na: ${collidingStream.display_date}. Czy na pewno chcesz kontynuować?`).then((msg) => {
                msg.react("✔️").then(r => {
                    msg.react("✖️");
                });

                msg.awaitReactions((reaction, user) => user.id == message.author.id && (reaction.emoji.name == "✔️" || reaction.emoji.name == "✖️"),
                { max: 1, time: 120000 }).then(collectedEmoji => {
                    if (collectedEmoji.first().emoji.name == "✖️")
                    {
                        message.channel.send("Ok, anulowanie planowania streama.");
                        return;
                    }
                    else if (collectedEmoji.first().emoji.name == "✔️")
                    {
                        streams.push({ "author": author, "name": name, "date": date, "display_date": display_date });

                        message.channel.send(`Transmisja ${name} została zaplanowana na: ${display_date}!`);
                
                        writeToStreams();
                        return;
                    }
                });
            });
        }
        else
        {
            streams.push({ "author": author, "name": name, "date": date, "display_date": display_date });
    
            message.channel.send(`Transmisja ${name} została zaplanowana na: ${display_date}!`);
    
            writeToStreams();
        }
    }
    else if (f_message.includes("plan"))
    {
        sendAddStreamErrorMessage(message);
    }

    // Remove stream
    if (f_message == "remove")
    {
        // Check if user is in "database"
        const user_author = users.find(user => user.discord == message.member.user.username);
        if (user_author == null)
        {
            message.reply("Nie mam cię w bazie danych! Sprawdź !checkusers");
            return;
        }

        // Check if user has any planned streams
        const user_streams = streams.filter(stream => stream.author == user_author.youtube);
        if (user_streams == null)
        {
            message.reply("Brak zaplanowanych transmisji! Sprawdź !check");
            return;
        }

        let reply = "Którą transmisję usunąć? (napisz 1, 2 etc. lub 'x' żeby anulować)\n\n";

        for (let i = 0; i < user_streams.length; i++)
        {
            reply += `${i+1}. ${user_streams[i].name} (${user_streams[i].display_date})\n`;
        }

        message.channel.send(reply);

        // Wait for response
        message.channel.awaitMessages(m => m.author.id == message.author.id, {max: 1, time: 120000}).then(collected => {
            const messageContent = collected.first().content;

            // Cancel if user says so
            if (messageContent.toLowerCase() == "x")
            {
                collected.first().reply("Ok, anuluję usuwanie");
                return;
            }

            // Get stream number
            if (parseInt(messageContent) >= 1 && parseInt(messageContent) <= user_streams.length)
            {
                const removeObject = user_streams[parseInt(messageContent - 1)];

                // Check if user really wants to remove this object
                collected.first().reply(`Na pewno chcesz usunąć: ${removeObject.name}?`).then((replyMessage) => {
                    replyMessage.react("✔️").then(r => {
                        replyMessage.react("✖️");
                    });

                    // Check for reaction
                    replyMessage.awaitReactions((reaction, user) => user.id == message.author.id && (reaction.emoji.name == "✔️" || reaction.emoji.name == "✖️"),
                    { max: 1, time: 120000 }).then(collectedEmoji => {

                        // Cancel
                        if (collectedEmoji.first().emoji.name == "✖️")
                        {
                            replyMessage.reply("Ok, anuluję usuwanie");
                            return;
                        }

                        // Remove stream
                        else if (collectedEmoji.first().emoji.name == "✔️")
                        {
                            streams = streams.filter(stream => { return !(stream.author == user_author.youtube && stream.name == removeObject.name && stream.date == removeObject.date); });
                            
                            replyMessage.reply("Usunięto pomyślnie!");
                            writeToStreams();
                        }
                    });
                });
            }
            // Return if value is not valid
            else {
                collected.first().reply("Nieprawidłowa wartość.");
            }
        }).catch(() => {
            return;
        });
    }

    // Edit stream's name
    if (f_message == "editname")
    {
        // Check if user is in "database"
        const user_author = users.find(user => user.discord == message.member.user.username);
        if (user_author == null)
        {
            message.reply("Nie mam cię w bazie danych! Sprawdź !checkusers");
            return;
        }

        // Check if user has any planned streams
        const user_streams = streams.filter(stream => stream.author == user_author.youtube);
        if (user_streams == null)
        {
            message.reply("Brak zaplanowanych transmisji! Sprawdź !check");
            return;
        }

        let reply = "Którą transmisję chcesz edytować? (napisz 1, 2 etc. lub 'x' żeby anulować)\n\n";

        for (let i = 0; i < user_streams.length; i++)
        {
            reply += `${i+1}. ${user_streams[i].name} (${user_streams[i].display_date})\n`;
        }

        message.channel.send(reply);

        // Wait for response
        message.channel.awaitMessages(m => m.author.id == message.author.id, { max: 1, time: 120000 }).then(collected => {
            const messageContent = collected.first().content;

            // Cancel if user says so
            if (messageContent.toLowerCase() == "x")
            {
                collected.first().reply("Ok, anuluję edycję");
                return;
            }

            // Get stream number
            if (parseInt(messageContent) >= 1 && parseInt(messageContent) <= user_streams.length)
            {
                const editObject = user_streams[parseInt(messageContent - 1)];

                collected.first().reply(`Podaj nową nazwę streama dla: ${editObject.name}`);

                message.channel.awaitMessages(m2 => m2.author.id == message.author.id, { max: 1, time: 120000 }).then(collected2 => {
                    editObject.name = collected2.first().content;
                    
                    user_streams[parseInt(messageContent - 1)] = editObject;
                    writeToStreams();

                    collected2.first().reply("Ok!");
                });

            }
            // Return if value is not valid
            else {
                collected.first().reply("Nieprawidłowa wartość.");
            }
        }).catch(() => {
            return;
        });
    }

    // Edit stream's date
    if (f_message == "editdate")
    {
        // Check if user is in "database"
        const user_author = users.find(user => user.discord == message.member.user.username);
        if (user_author == null)
        {
            message.reply("Nie mam cię w bazie danych! Sprawdź !checkusers");
            return;
        }

        // Check if user has any planned streams
        const user_streams = streams.filter(stream => stream.author == user_author.youtube);
        if (user_streams == null)
        {
            message.reply("Brak zaplanowanych transmisji! Sprawdź !check");
            return;
        }

        let reply = "Którą transmisję chcesz edytować? (napisz 1, 2 etc. lub 'x' żeby anulować)\n\n";

        for (let i = 0; i < user_streams.length; i++)
        {
            reply += `${i+1}. ${user_streams[i].name} (${user_streams[i].display_date})\n`;
        }

        message.channel.send(reply);

        // Wait for response
        message.channel.awaitMessages(m => m.author.id == message.author.id, { max: 1, time: 120000 }).then(collected => {
            const messageContent = collected.first().content;

            // Cancel if user says so
            if (messageContent.toLowerCase() == "x")
            {
                collected.first().reply("Ok, anuluję edycję");
                return;
            }

            // Get stream number
            if (parseInt(messageContent) >= 1 && parseInt(messageContent) <= user_streams.length)
            {
                const editObject = user_streams[parseInt(messageContent - 1)];

                collected.first().reply(`Podaj nową datę dla streama: ${editObject.name} [dzień-miesiąc-rok godzina:minuta]`);

                message.channel.awaitMessages(m2 => m2.author.id == message.author.id, { max: 1, time: 120000 }).then(collected2 => {

                    if (!(collected2.first().content.search(/^[0-3][0-9]+-[0-1][0-9]+-202[1-9]+ [0-2][0-9]+:[0-5][0-9]$/) != -1))
                    {
                        collected2.first().reply("Nieprawidłowy format! [dzień-miesiąc-rok godzina:minuta]\nSpróbuj jeszcze raz! (wymagane ponowne wywołanie komendy)");
                        return;
                    }
                    
                    const msg_f = collected2.first().content.split(" ");

                    const date = stringToDate(msg_f[0] + " " + msg_f[1]).toString();
                    const display_date = msg_f[0] + " " + msg_f[1];

                    const collidingStream = getStreamColliding(date, editObject.display_date);
                    if (collidingStream)
                    {
                        message.reply(`Uwaga! Jest zaplanowany stream: ${collidingStream.name} na: ${collidingStream.display_date}. Czy na pewno chcesz kontynuować?`).then((msg) => {
                            msg.react("✔️").then(r => {
                                msg.react("✖️");
                            });

                            msg.awaitReactions((reaction, user) => user.id == message.author.id && (reaction.emoji.name == "✔️" || reaction.emoji.name == "✖️"),
                            { max: 1, time: 120000 }).then(collectedEmoji => {
                                if (collectedEmoji.first().emoji.name == "✖️")
                                {
                                    message.channel.send("Ok, anulowanie planowania streama.");
                                    return;
                                }
                                else if (collectedEmoji.first().emoji.name == "✔️")
                                {
                                    editObject.date = date;
                                    editObject.display_date = display_date;

                                    user_streams[parseInt(messageContent - 1)] = editObject;

                                    message.channel.send(`Transmisja ${editObject.name} została zaplanowana na: ${display_date}!`);
                                    
                                    writeToStreams();
                                    return;
                                }
                            });
                        });
                    }
                    else
                    {
                        editObject.date = date;
                        editObject.display_date = display_date;

                        user_streams[parseInt(messageContent - 1)] = editObject;

                        message.channel.send(`Transmisja ${editObject.name} została zaplanowana na: ${display_date}!`);
                        
                        writeToStreams();
                    }
                });

            }
            // Return if value is not valid
            else {
                collected.first().reply("Nieprawidłowa wartość.");
            }
        }).catch(() => {
            return;
        });
    }

    // Set prefix
    if (f_message.search(/^(setprefix) +/) != -1)
    {
        // Check if user is in "database"
        const user = users.find(user => user.discord == message.member.user.username);
        if (user == null)
        {
            message.reply("Nie mam cię w bazie danych! Sprawdź !checkusers");
            return;
        }

        const message_array = f_message.split(" ");

        let prefix = client.emojis.cache.find(emoji => emoji.name == message_array[1]);
        if (prefix == null)
        {
            prefix = message_array[1];
        }

        user.prefix = prefix;
        const emoji = user.prefix;
        users.find(user => user.discord == message.member.user.username).prefix = user.prefix;
        
        message.reply(`nowy prefix: ${users.find(user => user.discord == message.member.user.username).prefix}`);

        writeToUsers();
    }
    else if (f_message.includes("setprefix"))
    {
        message.reply("Poprawne użycie komendy: !setprefix [:emoji:]");
    }
    
});


const sendAddStreamErrorMessage = function(message)
{
    message.reply("Poprawne użycie komendy: !plan [dzień-miesiąc-rok godzina:minuta] [nazwa streama]");
}

const sendAddReminderErrorMessage = function(message)
{
    message.reply("Poprawne użycie komendy: !remind [dzień-miesiąc-rok godzina:minuta] [wiadomość przypomnienia]");
}

const sendSetBirthdayErrorMessage = function(message)
{
    message.reply("Poprawne użycie komendy: !setbirthday [dzień-miesiąc]");
}

const writeToUsers = function()
{
    usersRef.set(users);
}

const writeToStreams = function()
{
    streams.sort((a, b) => new Date(a.date) - new Date(b.date));
    streamsRef.set(streams);
}

const writeToReminders = function()
{
    reminders.sort((a,b) => new Date(a.date) - new Date(b.date));
    remindersRef.set(reminders);
}

const writeToBirthdays = function()
{
    birthdays.sort((a, b) => new Date(a.date) - new Date(b.date));
    birthdaysRef.set(birthdays);
}

const checkUsers = function()
{
    usersRef.once("value", (snap) => {
        users = snap.val();
    });

    if (users == null)
        users = [];
}

const checkStreams = function()
{
    streamsRef.once("value", (snap) => {
        streams = snap.val();
    });

    if (streams == null)
        streams = [];
}

const checkReminders = function()
{
    remindersRef.once("value", (snap) => {
        reminders = snap.val();
    });

    if (reminders == null)
        reminders = [];
}

const checkBirthdays = function()
{
    birthdaysRef.once("value", snap => {
        birthdays = snap.val();
    });
    
    if (birthdays == null)
        birthdays = [];

}

const stringToDate = function(dateString)
{
    // Format: day-month-year hour:minute 
    const year = parseInt(dateString.substring(6, 10));
    const month = parseInt(dateString.substring(3, 5)) - 1;
    const day = parseInt(dateString.substring(0, 2));
    const hour = parseInt(dateString.substring(11, 13)) - 1;
    const minute = parseInt(dateString.substring(14, 16));

    const date = new Date(year, month, day, hour, minute, 0);

    return date;
}

const dailyCheckMessage = function(channel)
{
    fs.readFile("greetings.json", (err, data) => {
        const f_data = JSON.parse(data); 
        const currentDate = new Date();
        const currentDay = (currentDate.getDate() < 10) ? ("0" + currentDate.getDate().toString()) : (currentDate.getDate().toString());
        const currentMonth = (currentDate.getMonth() + 1) < 10 ? "0" + (currentDate.getMonth() + 1).toString() : (currentDate.getMonth() + 1).toString();
        const currentYear = currentDate.getFullYear().toString();
        const greeting = f_data[Math.floor(Math.random() * f_data.length)].replace("{date}", `${currentDay}-${currentMonth}-${currentYear}`) + "\n\n";
        
        let anyStreams = false;
        let message = greeting;

        streams.forEach(stream => {
            const streamDate = new Date(stream.date);

            if (streamDate.getDate() == currentDate.getDate() && streamDate.getMonth() == currentDate.getMonth())
            {
                anyStreams = true;
                const prefix = users.find(user => user.youtube == stream.author).prefix;
                message += `${prefix != null ? prefix : ':white_circle:'} ${stream.display_date} - ${stream.name} (${stream.author})\n`;
            }
        });

        if (!anyStreams)
            message += "Brak zaplanowanych streamów na dzisiaj! :woozy_face: \n";

        message += "\nTo tyle, życzę wszystkim miłego dzionka OwO";

        channel.send(message);

        // Respond to pucha
        channel.awaitMessages(m => m.author.id == "293016431891709962", { max: 1, time: 3600000 }).then(collected => {
            if (collected.first().content[0] != "!")
                collected.first().reply("uwu");
                
            return;
        });
    }); 
}

const checkOldStreams = function()
{
    const currentDate = new Date();

    streams = streams.filter(stream => {
        const streamDate = new Date(stream.date);

        if (streamDate < currentDate)
            return false;
        else
            return true;
    });

    writeToStreams();
}

const checkOldReminders = function()
{
    const currentDate = new Date();

    reminders = reminders.filter(reminder => {
        const reminderDate = new Date(reminder.date);

        if (reminderDate < currentDate)
            return false;
        else
            return true;
    })
}

const checkOldBirthdays = function()
{
    const currentDate = new Date();

    birthdays = birthdays.filter(birthday => {
        const birthdayDate = new Date(birthday.date);

        if (birthdayDate < currentDate)
            return false;
        else
            return true;
    })
}

const checkCurrentStreams = function()
{
    const currentDate = new Date();

    streams.forEach(stream => {
        const streamDate = new Date(stream.date);
        
        if (streamDate.getDate() == currentDate.getDate()
         && streamDate.getHours() == currentDate.getHours()
         && streamDate.getMinutes() == currentDate.getMinutes())
        {
            client.channels.fetch(streamChannel).then(channel => {
                channel.send(`@here, ${stream.author} ma teraz transmisję: ${stream.name}!`);
            });
        }
    });

    checkOldStreams();
}

const checkCurrentReminders = function()
{
    const currentDate = new Date();

    reminders.forEach(reminder => {
        const reminderDate = new Date(reminder.date);

        if (reminderDate.getDate() == currentDate.getDate()
         && reminderDate.getHours() == currentDate.getHours()
         && reminderDate.getMinutes() == currentDate.getMinutes())
        {
            client.channels.fetch(reminderChannel).then(channel => {
                channel.send(`${reminder.author}, przypominam: ${reminder.payload}`);
            })
        }
    });

    checkOldReminders();
}

const checkCurrentBirthdays = function()
{
    const currentDate = new Date();

    if (birthdays == null) return;

    birthdays.forEach(birthday => {
        const birthdayDate = new Date(birthday.date);
        const nextWeek = new Date(new Date().setDate(currentDate.getDate() + 6));

        if (birthdayDate.getDate() == nextWeek.getDate()
         && birthdayDate.getMonth() == nextWeek.getMonth())
        {
            client.channels.fetch(birthdayChannel).then(channel => {
                channel.send(`${birthday.author} ma urodziny za tydzień!`);
            });
        }

        if (birthdayDate.getDate() == currentDate.getDate()
         && birthdayDate.getMonth() == currentDate.getMonth())
        {
            client.channels.fetch(birthdayChannel).then(channel => {
                channel.send(`${birthday.author}, wszystkiego najlepszego! :partying_face:`);
            });
        }
    });

    checkOldBirthdays();
}

const getStreamColliding = function(newStreamDate, excludeDate = null)
{
    let streamColliding = null;

    const _newStreamDate = new Date(newStreamDate);
    streams.forEach(stream => {
        const _streamDate = new Date(stream.date);
        if (_streamDate.getDate() == _newStreamDate.getDate()
         && _streamDate.getMonth() == _newStreamDate.getMonth()
         && Math.abs(_streamDate.getHours() - _newStreamDate.getHours()) <= 2)
        {
            if (excludeDate != null && stream.display_date == excludeDate)
                return;

            streamColliding = stream;
        }
    });

    return streamColliding;
}

client.login(process.env.DISCORD_TOKEN);