const Discord = require("discord.js");
const firebase = require("./firebaseHandler.js");
const helpers = require("./helpers.js");
const Jimp = require("jimp");
const fs = require("fs");
const { registerFont, createCanvas } = require('canvas');
registerFont('fonts/AmongUs-Regular.ttf', {family: 'sus'});

const timeToWait = 120000;

module.exports = {
    respondForPing: function(message)
    {
        message.reply("Pong!");
    },
    respondForAddUser: function(message, user)
    {
        if (user.length == 0)
        {
            message.reply("Poprawne użycie komendy: !adduser [nazwa konta w mediach]");
            return;
        }

        firebase.addUserToFirebase(message.author.id, user).then(val => {
            message.channel.send(val);
        }).catch(err => {
            message.reply(err);
        });
    },
    respondForCheckUsers: function(message, users)
    {
        message.channel.send("Zbieranie danych...");
        firebase.checkAllUsersInFirebase(users).then(arr => {
            arr.forEach(msg => {
                message.channel.send(msg);
            });
        }).catch(err => {
            message.reply(err);
        });
    },
    respondForRemoveUser: function(message)
    {
        firebase.removeUserFromFirebase(message.author.id).then(val => {
            message.channel.send(val);
        }).catch(err => {
            message.reply(err);
        });
    },
    respondForSetPrefix: function(message, prefix)
    {
        if (!prefix)
        {
            message.reply("Poprawne użycie komendy: !setprefix [prefix]");
            return;
        }

        firebase.setPrefixForUserInFirebase(message.author.id, prefix).then(val => {
            message.channel.send(val);
        }).catch(err => {
            message.reply(err);
        });
    },
    respondForSetBirthday: function(message, date)
    {
        if (!date || date.search(/^[0-3][0-9]+-[0-1][0-9]+/) == -1)
        {
            message.reply("Poprawne użycie komendy: !setbirthday [dd-mm]");
            return;
        }

        firebase.setBirthdayForUserInFirebase(message.author.id, date).then(val => {
            message.channel.send(val);
        }).catch(err => {
            message.reply(err);
        });
    },
    respondForCheckBirthday: function(message)
    {
        firebase.getAllUsersRawFromFirebase().then(users => {
            if (users.length == 0)
            {
                message.reply("Brak ustawionych urodzin!");
                return;
            }

            let sorted = users.sort((a, b) => {
                const dateA = a.birthday || helpers.stringToDate("31-12-2001 12:00");
                const dateB = b.birthday || helpers.stringToDate("31-12-2001 12:00");
                return new Date(dateA) - new Date(dateB);
            });

            let nameMaxLength = 0;
            users.forEach(user => nameMaxLength = Math.max(nameMaxLength, user.media.length));

            let returnMessage = "Ustawione urodziny:\n";
            sorted.forEach(user => {
                let signs = "";
                for (i = nameMaxLength; i >= user.media.length; i--)
                {
                    signs += "=";
                }
                returnMessage += `:cake: **${user.media}** ${signs}> :calendar: *${user.birthday ? helpers.dateToString(user.birthday, helpers.ReturnDateFormat.month) : "Brak!"}*\n`;
            });
            message.channel.send(returnMessage);
        });
    },
    respondForPlanStream: function(message, date, title)
    {
        if (!date || date.search(/^[0-3][0-9]+-[0-1][0-9]+-202[1-9]+ [0-2][0-9]+:[0-5][0-9]+/) == -1 || !title)
        {
            message.reply("Poprawne użycie komendy: !plan [dd-mm-yyyy hh:mm] [nazwa]");
            return;
        }

        firebase.addNewStreamInFirebase(message.author.id, date, title).then(val => {
            message.channel.send(val);
        }).catch(err => {
            message.reply(err);
        });
    },
    respondForCheckMyStreams: function(message)
    {
        firebase.getAllStreamsRawFromFirebase().then(streams => {
            if (streams.length == 0)
            {
                message.reply("Brak zaplanowanych streamów!");
                return;
            }

            firebase.getAllUsersRawFromFirebase().then(users => {
                let userMedia = users.find(user => user.discord == message.author.id);
                if (!userMedia)
                {
                    message.reply("Nie ma cię w bazie danych! Sprawdź !checkusers");
                    return;
                }

                userMedia = userMedia.youtube || userMedia.media;
                let searchedStreams = streams.filter(stream => stream.author == userMedia);

                let messageReply = `Twoje zaplanowane streamy (${searchedStreams.length}):\n\n`;
                let innerIndex = 0;
                searchedStreams.forEach(stream => {
                    const userPrefix = users.find(user => user.media == stream.author)?.prefix || ":white_circle:";
                    const streamDate = helpers.dateToString(stream.date, helpers.ReturnDateFormat.full);
                    const streamTitle = stream.title || stream.name;
                    const streamAuthor = stream.author;

                    try
                    {
                        let displayTitle;
                        if (streamTitle.includes("https://"))
                        {
                            displayTitle = streamTitle.split(" ");
                            displayTitle.forEach(word => {
                                if (word.includes("https://"))
                                {
                                    word = `<${word}>`;
                                }
                            });
                            displayTitle = displayTitle.join(" ");
                        }
                        messageReply += `${userPrefix} ${streamDate.substring(0, 10)} **${streamDate.substring(11)}** - ${displayTitle || streamTitle}  \|  **${streamAuthor}**\n`;
                        innerIndex++;
    
                        if (innerIndex >= 15)
                        {
                            message.channel.send(messageReply);
                            messageReply = '';
                            innerIndex = 0;
                        }
                    }
                    catch (error)
                    {
                        console.error(error);
                    }
                });

                if (messageReply != '')
                    message.channel.send(messageReply);

            });
        });
    },
    respondForToggleWarnings: function(message)
    {
        firebase.toggleWarningsForUser(message.author.id).then(val => {
            message.channel.send(val);
        }).catch(err => {
            message.reply(err);
        });
    },
    respondForRemoveStream: function(message)
    {
        firebase.getAllStreamsRawFromFirebase().then(streams => {
            firebase.getAuthorByDiscord(message.author.id).then(user => {
                if (!user)
                {
                    message.reply("Nie ma cię w bazie danych! Sprawdż !checkusers");
                    return;
                }
                const usersStreams = streams.filter(stream => stream.author == user.media);
                if (usersStreams.length == 0)
                {
                    message.reply("Nie masz żadnych zaplanowanych streamów!");
                    return;
                }

                let message1 = "Którą transmisję chcesz usunąc? (Wpisz 1, 2, etc lub 'x' żeby anulować)\n"
                for (let i = 1; i <= usersStreams.length; i++)
                {
                    try
                    {
                        let displayTitle;
                        if (usersStreams[i-1].title.includes("https://"))
                        {
                            let displayTitle = usersStreams[i-1].title.split(" ");
                            displayTitle.forEach(word => {
                                if (word.includes("https://"))
                                {
                                    word = `<${word}>`;
                                }
                            });
                            displayTitle = displayTitle.join(" ");
                        }
                        message1 += `${i}. ${displayTitle || usersStreams[i-1].title || usersStreams[i-1].name} (${helpers.dateToString(usersStreams[i-1].date, helpers.ReturnDateFormat.full)})\n`;
                    }
                    catch (error)
                    {
                        console.error(error);
                    }
                }

                message.channel.send(message1);
                message.channel.awaitMessages(res => res.author.id == message.author.id, { max: 1, time: timeToWait }).then(col => {
                    const resMes = col.first().content;

                    if (resMes.toLowerCase() == "x")
                    {
                        col.first().reply("Ok, anuluję");
                        return;
                    }

                    if (parseInt(resMes) >= 1 && parseInt(resMes) <= usersStreams.length)
                    {
                        // Check if user really wants to remove this object
                        col.first().reply(`Na pewno chcesz usunąć numerek ${resMes}?`).then((message2) => {
                            message2.react("✔️").then(() => {
                                message2.react("✖️");
                            });

                            // Check for reaction
                            message2.awaitReactions((reaction, user) => user.id == message.author.id && (reaction.emoji.name == "✔️" || reaction.emoji.name == "✖️"),
                            { max: 1, time: timeToWait }).then(collectedEmoji => {

                                // Cancel
                                if (collectedEmoji.first().emoji.name == "✖️")
                                {
                                    message2.reply("Ok, anuluję usuwanie");
                                    return;
                                }

                                // Remove stream
                                else if (collectedEmoji.first().emoji.name == "✔️")
                                {
                                    firebase.removeStreamFromFirebase(message.author.id, parseInt(resMes) - 1).then(val => {
                                        message.channel.send(val);
                                    }).catch(err => {
                                        message.reply(err);
                                    });
                                }
                            });
                        });
                    }
                    // Return if value is not valid
                    else
                    {
                        col.first().reply("Nieprawidłowa wartość.");
                    }
                });
            })
        });
    },
    respondForSudoRemoveStream: function(message)
    {
        firebase.getAllStreamsRawFromFirebase().then(streams => {
            if (streams.length == 0)
            {
                message.reply("Brak zaplanowanych streamów!");
                return;
            }
            firebase.getAuthorByDiscord(message.author.id).then(() => {
                const usersStreams = streams;

                let message1 = "Którą transmisję chcesz usunąc? (Wpisz 1, 2, etc lub 'x' żeby anulować)\n"
                for (let i = 1; i <= usersStreams.length; i++)
                {
                    try
                    {
                        let displayTitle;
                        if (usersStreams[i-1].title.includes("https://"))
                        {
                            displayTitle = usersStreams[i-1].title.split(" ");
                            displayTitle.forEach(word => {
                                if (word.includes("https://"))
                                {
                                    word = `<${word}>`;
                                }
                            });
                            displayTitle = displayTitle.join(" ");
                        }
                        message1 += `${i}. (${usersStreams[i-1].author}) ${displayTitle || usersStreams[i-1].title || usersStreams[i-1].name} (${helpers.dateToString(usersStreams[i-1].date, helpers.ReturnDateFormat.full)})\n`;
                    }
                    catch (error)
                    {
                        console.error(error);
                    }
                }

                message.channel.send(message1);
                message.channel.awaitMessages(res => res.author.id == message.author.id, { max: 1, time: timeToWait }).then(col => {
                    const resMes = col.first().content;

                    if (resMes.toLowerCase() == "x")
                    {
                        col.first().reply("Ok, anuluję");
                        return;
                    }

                    if (parseInt(resMes) >= 1 && parseInt(resMes) <= usersStreams.length)
                    {
                        // Check if user really wants to remove this object
                        col.first().reply(`Na pewno chcesz usunąć numerek ${resMes}?`).then((message2) => {
                            message2.react("✔️").then(() => {
                                message2.react("✖️");
                            });

                            // Check for reaction
                            message2.awaitReactions((reaction, user) => user.id == message.author.id && (reaction.emoji.name == "✔️" || reaction.emoji.name == "✖️"),
                            { max: 1, time: timeToWait }).then(collectedEmoji => {

                                // Cancel
                                if (collectedEmoji.first().emoji.name == "✖️")
                                {
                                    message2.reply("Ok, anuluję usuwanie");
                                    return;
                                }

                                // Remove stream
                                else if (collectedEmoji.first().emoji.name == "✔️")
                                {
                                    firebase.removeStreamFromFirebase("poweruser", parseInt(resMes) - 1).then(val => {
                                        message.channel.send(val);
                                    }).catch(err => {
                                        message.reply(err);
                                    });
                                }
                            });
                        });
                    }
                    // Return if value is not valid
                    else
                    {
                        col.first().reply("Nieprawidłowa wartość.");
                    }
                });
            })
        });
    },
    respondForCheckAllStreams: function(message)
    {
        firebase.getAllStreamsRawFromFirebase().then(streams => {
            if (streams.length == 0)
            {
                message.reply("Brak zaplanowanych streamów!");
                return;
            }

            firebase.getAllUsersRawFromFirebase().then(users => {
                let replyMessage = `Zaplanowane transmisje (${streams.length}):\n\n`;
                let innerIndex = 0;

                streams.forEach(stream => {
                    const userPrefix = users.find(user => user.media == stream.author)?.prefix || ":white_circle:";
                    const streamDate = helpers.dateToString(stream.date, helpers.ReturnDateFormat.full);
                    const streamTitle = stream.title || stream.name;
                    const streamAuthor = stream.author;
                    replyMessage += `${userPrefix} ${streamDate.substring(0, 10)} **${streamDate.substring(11)}** - ${streamTitle}  \|  **${streamAuthor}**\n`;
                    innerIndex++;

                    if (innerIndex >= 15)
                    {
                        message.channel.send(replyMessage);
                        innerIndex = 0;
                        replyMessage = '';
                    }
                });

                if (replyMessage != '')
                    message.channel.send(replyMessage);
            });
        });
    },
    respondForCheckOneDay: function(message, day)
    {
        if (day == "all")
        {
            this.respondForCheckAllStreams(message);
            return;
        }
        else if (day == "my")
        {
            this.respondForCheckMyStreams(message);
            return;
        }
        else if (day == "today")
        {
            day = new Date();
            day.setTime(day.getTime() + (2*60*60*1000));
            day.setHours(2, 0, 0, 0);
        }
        else if (day == "tomorrow")
        {
            day = new Date();
            day.setDate(day.getDate() + 1);
            day.setTime(day.getTime() + (2*60*60*1000));
            day.setHours(2, 0, 0, 0);
        }
        else if (day.search(/^[0-3][0-9]+-[0-1][0-9]+-202[1-9]+/) != -1)
        {
            day = helpers.stringToDate(day + " 03:00");
        }
        else if (day.search(/^[0-3][0-9]+-[0-1][0-9]+/) != -1)
        {
            day = helpers.stringToDate(day + "-" + new Date().getFullYear() + " 03:00");
        }
        else
        {
            message.reply("Nieprawidowa wartość!");
            return;
        }

        firebase.getAllStreamsRawFromFirebase().then(streams => {
            if (streams.length == 0)
            {
                message.reply("Brak zaplanowanych streamów!");
                return;
            }

            firebase.getAllUsersRawFromFirebase().then(users => {
                let searchedStreams = streams.filter(stream => {
                    const streamDate = new Date(Date.parse(stream.date)).getDate() + "-" + new Date(Date.parse(stream.date)).getMonth();
                    const daysDate = day.getDate() + "-" + day.getMonth();
                    return streamDate == daysDate;
                });

                if (searchedStreams.length == 0)
                {
                    message.reply("Brak zaplanowanych streamów na podaną datę!");
                    return;
                }

                let replyMessage = `Zaplanowane streamy na ${helpers.dateToString(day, helpers.ReturnDateFormat.month)} (${searchedStreams.length}):\n\n`;
                let innerIndex = 0;
                searchedStreams.forEach(stream => {
                    const userPrefix = users.find(user => user.media == stream.author)?.prefix || ":white_circle:";
                    const streamDate = helpers.dateToString(stream.date, helpers.ReturnDateFormat.full);
                    const streamTitle = stream.title || stream.name;
                    const streamAuthor = stream.author;
                    replyMessage += `${userPrefix} ${streamDate.substring(0, 10)} **${streamDate.substring(11)}** - ${streamTitle}  \|  **${streamAuthor}**\n`;
                    innerIndex++;

                    if (innerIndex >= 15)
                    {
                        message.channel.send(replyMessage);
                        innerIndex = 0;
                        replyMessage = '';
                    }
                });

                if (replyMessage != '')
                    message.channel.send(replyMessage);
            });
        });

    },
    respondForCheckDateRange: function(message, dayStart, dayEnd)
    {
        if (dayStart == null)
        {
            dayStart = new Date();
            dayStart.setTime(dayStart.getTime() + (2*60*60*1000));
            dayStart.setHours(1, 0, 0, 0);
        }
        else if (dayStart.search(/^[0-3][0-9]+-[0-1][0-9]+-202[1-9]+/) != -1)
        {
            dayStart = helpers.stringToDate(dayStart + " 03:00");
        }
        else if (dayStart.search(/^[0-3][0-9]+-[0-1][0-9]+/) != -1)
        {
            dayStart = helpers.stringToDate(dayStart + "-" + new Date().getFullYear() + " 03:00");
        }
        if (dayEnd == null)
        {
            dayEnd = new Date();
            dayEnd.setDate(dayEnd.getDate() + 7);
            dayEnd.setTime(dayEnd.getTime() + (2*60*60*1000));
            dayEnd.setHours(1, 0, 0, 0);
        }
        else if (dayEnd.search(/^[0-3][0-9]+-[0-1][0-9]+-202[1-9]+/) != -1)
        {
            dayEnd = helpers.stringToDate(dayEnd + " 03:00");
        }
        else if (dayEnd.search(/^[0-3][0-9]+-[0-1][0-9]+/) != -1)
        {
            dayEnd = helpers.stringToDate(dayEnd + "-" + new Date().getFullYear() + " 03:00");
        }
        dayEnd.setTime(dayEnd.getTime() + (21*60*60*1000));

        firebase.getAllStreamsRawFromFirebase().then(streams => {
            if (streams.length == 0)
            {
                message.reply("Brak zaplanowanych streamów!");
                return;
            }

            firebase.getAllUsersRawFromFirebase().then(users => {
                let searchedStreams = streams.filter(stream => {
                    const streamDate = Date.parse(stream.date);
                    return streamDate >= dayStart && streamDate <= dayEnd;
                });

                if (searchedStreams.length == 0)
                {
                    message.reply("Brak zaplanowanych streamów na podane daty!");
                    return;
                }

                let replyMessage = `Zaplanowane streamy na ${helpers.dateToString(dayStart, helpers.ReturnDateFormat.month)} - ${helpers.dateToString(dayEnd, helpers.ReturnDateFormat.month)} (${searchedStreams.length}):\n\n`;
                let innerIndex = 0;
                searchedStreams.forEach(stream => {
                    const userPrefix = users.find(user => user.media == stream.author)?.prefix || ":white_circle:";
                    const streamDate = helpers.dateToString(stream.date, helpers.ReturnDateFormat.full);
                    const streamTitle = stream.title || stream.name;
                    const streamAuthor = stream.author;
                    replyMessage += `${userPrefix} ${streamDate.substring(0, 10)} **${streamDate.substring(11)}** - ${streamTitle}  \|  **${streamAuthor}**\n`;
                    innerIndex++;

                    if (innerIndex >= 15)
                    {
                        message.channel.send(replyMessage);
                        innerIndex = 0;
                        replyMessage = '';
                    }
                });

                if (replyMessage != '')
                    message.channel.send(replyMessage);
            });
        });
    },
    respondForEditStream: function(message)
    {
        firebase.getAllStreamsRawFromFirebase().then(streams => {
            if (streams.length == 0)
            {
                message.reply("Brak zaplanowanych streamów!");
                return;
            }

            firebase.getAllUsersRawFromFirebase().then(users => {
                const userObject = users.find(user => user.discord == message.author.id);
                if (!userObject)
                {
                    message.reply("Nie ma cię w bazie danych! Sprawdź !checkusers");
                    return;
                }
                const usersStreams = streams.filter(stream => stream.author == userObject.media);

                if (usersStreams.length == 0)
                {
                    message.reply("Nie masz żadnych zaplanowanych streamów!");
                    return;
                }
                if (usersStreams.length == 1)
                {
                    const streamToEdit = usersStreams[0];

                    message.channel.send("Podaj nową datę [dd-mm-yyyy hh:mm/dd-mm-yyyy/hh:mm] lub nazwę dla " + (streamToEdit.title || streamToEdit.name) + " (lub 'x' żeby anulować)");
                    message.channel.awaitMessages(res => res.author.id == message.author.id, { max: 1, time: timeToWait }).then(col2 => {
                        const reply = col2.first().content;
                        if (reply.toLowerCase() == "x")
                        {
                            col2.first().reply("Ok, anuluję.");
                            return;
                        }
                        if (reply.search(/^[0-3][0-9]+-[0-1][0-9]+-202[1-9]+ [0-2][0-9]+:[0-5][0-9]+ .+/) != -1)
                        {
                            const arr = reply.split(" ");
                            streamToEdit.date = helpers.stringToDate(arr[0] + " " + arr[1]).toString();
                            streamToEdit.title = arr.splice(2).join(" ");
                        }
                        else if (reply.search(/^[0-3][0-9]+-[0-1][0-9]+-202[1-9]+ [0-2][0-9]+:[0-5][0-9]+/) != -1)
                        {
                            streamToEdit.date = helpers.stringToDate(reply).toString();
                        }
                        else if (reply.search(/^[0-3][0-9]+-[0-1][0-9]+-202[1-9]+/) != -1)
                        {
                            const streamHour = helpers.dateToString(streamToEdit.date, helpers.ReturnDateFormat.hour);
                            streamToEdit.date = helpers.stringToDate(reply + " " + streamHour).toString();
                        }
                        else if (reply.search(/^[0-2][0-9]+:[0-5][0-9]+/) != -1)
                        {
                            const streamDate = helpers.dateToString(streamToEdit.date, helpers.ReturnDateFormat.year);
                            streamToEdit.date = helpers.stringToDate(streamDate + " " + reply).toString();
                        }
                        else
                        {
                            streamToEdit.title = reply;
                        }

                        firebase.editStreamInFirebase(message.author.id, 0, streamToEdit).then((stream) => {
                            let replyMessage = "Ok! Nowa wartość streama:\n";
                            replyMessage += `(${helpers.dateToString(stream.date, helpers.ReturnDateFormat.full)}) - ${stream.title || stream.name}`;
                            message.channel.send(replyMessage);
                        }).catch(err => {
                            console.error(err);
                            col2.first().reply("Coś sie zesrało :c");
                            return;
                        });
                    });
                }
                else
                {
                    let message1 = "Którą transmisję chcesz edytować? (Wpisz 1, 2, etc lub 'x' żeby anulować)\n"
                    for (let i = 1; i <= usersStreams.length; i++)
                        message1 += `${i}. ${usersStreams[i-1].title || usersStreams[i-1].name} (${helpers.dateToString(usersStreams[i-1].date, helpers.ReturnDateFormat.full)})\n`;
    
                    message.channel.send(message1);
                    message.channel.awaitMessages(res => res.author.id == message.author.id, { max: 1, time: timeToWait }).then(col => {
                        const reply = col.first().content;
    
                        if (reply == "x")
                        {
                            col.first().reply("Ok, anuluję");
                            return;
                        }
                        if (parseInt(reply) >= 1 && parseInt(reply) <= usersStreams.length)
                        {
                            const indexToEdit = parseInt(reply) - 1;
                            const streamToEdit = usersStreams[indexToEdit];
    
                            message.channel.send("Podaj nową datę [dd-mm-yyyy hh:mm/dd-mm-yyyy/hh:mm] lub nazwę dla " + (streamToEdit.title || streamToEdit.name));
                            message.channel.awaitMessages(res => res.author.id == message.author.id, { max: 1, time: timeToWait }).then(col2 => {
                                const reply = col2.first().content;
                                if (reply.search(/^[0-3][0-9]+-[0-1][0-9]+-202[1-9]+ [0-2][0-9]+:[0-5][0-9]+ .+/) != -1)
                                {
                                    const arr = reply.split(" ");
                                    streamToEdit.date = helpers.stringToDate(arr[0] + " " + arr[1]).toString();
                                    streamToEdit.title = arr.splice(2).join(" ");
                                }
                                else if (reply.search(/^[0-3][0-9]+-[0-1][0-9]+-202[1-9]+ [0-2][0-9]+:[0-5][0-9]+/) != -1)
                                {
                                    streamToEdit.date = helpers.stringToDate(reply).toString();
                                }
                                else if (reply.search(/^[0-3][0-9]+-[0-1][0-9]+-202[1-9]+/) != -1)
                                {
                                    const streamHour = helpers.dateToString(streamToEdit.date, helpers.ReturnDateFormat.hour);
                                    streamToEdit.date = helpers.stringToDate(reply + " " + streamHour).toString();
                                }
                                else if (reply.search(/^[0-2][0-9]+:[0-5][0-9]+/) != -1)
                                {
                                    const streamDate = helpers.dateToString(streamToEdit.date, helpers.ReturnDateFormat.year);
                                    streamToEdit.date = helpers.stringToDate(streamDate + " " + reply).toString();
                                }
                                else
                                {
                                    streamToEdit.title = reply;
                                }
    
                                firebase.editStreamInFirebase(message.author.id, indexToEdit, streamToEdit).then((stream) => {
                                    let replyMessage = "Ok! Nowa wartość streama:\n";
                                    replyMessage += `(${helpers.dateToString(stream.date, helpers.ReturnDateFormat.full)}) - ${stream.title || stream.name}`;
                                    message.channel.send(replyMessage);
                                }).catch(err => {
                                    console.error(err);
                                    col2.first().reply("Coś sie zesrało :c");
                                    return;
                                });
                            });
                        }
                        else
                        {
                            col.first().reply("Nieprawidłowa wartość! Spróbuj ponownie");
                            return;
                        }
                    });
                }
            });
        });
    },
    respondForSudoEditStream: function(message)
    {
        firebase.getAllStreamsRawFromFirebase().then(streams => {
            if (streams.length == 0)
            {
                message.reply("Brak zaplanowanych streamów!");
                return;
            }

            firebase.getAllUsersRawFromFirebase().then(() => {
                const usersStreams = streams;

                let message1 = "Którą transmisję chcesz edytować? (Wpisz 1, 2, etc lub 'x' żeby anulować)\n"
                for (let i = 1; i <= usersStreams.length; i++)
                    message1 += `${i}. (${usersStreams[i-1].author}) ${usersStreams[i-1].title || usersStreams[i-1].name} (${helpers.dateToString(usersStreams[i-1].date, helpers.ReturnDateFormat.full)})\n`;

                message.channel.send(message1);
                message.channel.awaitMessages(res => res.author.id == message.author.id, { max: 1, time: timeToWait }).then(col => {
                    const reply = col.first().content;

                    if (reply == "x")
                    {
                        col.first().reply("Ok, anuluję");
                        return;
                    }
                    if (parseInt(reply) >= 1 && parseInt(reply) <= usersStreams.length)
                    {
                        const indexToEdit = parseInt(reply) - 1;
                        const streamToEdit = usersStreams[indexToEdit];

                        message.channel.send("Podaj nową datę [dd-mm-yyyy hh:mm/dd-mm-yyyy/hh:mm] lub nazwę dla " + streamToEdit.title || streamToEdit.name);
                        message.channel.awaitMessages(res => res.author.id == message.author.id, { max: 1, time: timeToWait }).then(col2 => {
                            const reply = col2.first().content;

                            if (reply.search(/^[0-3][0-9]+-[0-1][0-9]+-202[1-9]+ [0-2][0-9]+:[0-5][0-9]+/) != -1)
                            {
                                streamToEdit.date = helpers.stringToDate(reply).toString();
                            }
                            else if (reply.search(/^[0-3][0-9]+-[0-1][0-9]+-202[1-9]+/) != -1)
                            {
                                const streamHour = helpers.dateToString(streamToEdit.date, helpers.ReturnDateFormat.hour);
                                streamToEdit.date = helpers.stringToDate(reply + " " + streamHour).toString();
                            }
                            else if (reply.search(/^[0-2][0-9]+:[0-5][0-9]+/) != -1)
                            {
                                const streamDate = helpers.dateToString(streamToEdit.date, helpers.ReturnDateFormat.year);
                                streamToEdit.date = helpers.stringToDate(streamDate + " " + reply).toString();
                            }
                            else
                            {
                                streamToEdit.title = reply;
                            }

                            firebase.editStreamInFirebase("poweruser", indexToEdit, streamToEdit).then((stream) => {
                                let replyMessage = "Ok! Nowa wartość streama:\n";
                                replyMessage += `(${helpers.dateToString(stream.date, helpers.ReturnDateFormat.full)}) - ${stream.title || stream.name}`;
                                message.channel.send(replyMessage);
                            }).catch(err => {
                                console.error(err);
                                col2.first().reply("Coś sie zesrało :c");
                                return;
                            });
                        });
                    }
                    else
                    {
                        col.first().reply("Nieprawidłowa wartość! Spróbuj ponownie");
                        return;
                    }
                });
            });
        });
    },
    respondForHelp: function(message)
    {
        const replyEmbed = new Discord.MessageEmbed()
        .setColor("#5dee62")
        .setTitle("Pomoc")
        .setAuthor("Kuuki", "https://media.discordapp.net/attachments/714452471279386687/824957506136047626/ciasteczko2.png")
        .setDescription("Lista dostępnych komend")
        .setImage("https://media.discordapp.net/attachments/714452471279386687/824958148317151242/vibin.gif")
        .addFields(
            { name: "!help", value: "Wysyła wiadomość z listą dostępnycyh komend" },
            { name: "!adduser [nazwa konta]", value: "Powiązuje daną nazwę konta z Discordem (wymagane do użycia większości komend)" },
            { name: "!checkusers", value: "Wyświetla listę powiązanych kont na serwerze" },
            { name: "!remuser", value: "Usuwa powiązane z Tobą konto" },
            { name: "!setprefix [prefix]", value: "Ustawia wyświetlany prefix/emotikonę dla Twojego konta" },
            { name: "!setlink", value: "Ustawia link do Twojego kanału" },
            { name: "!setbirthday [dd-mm]", value: "Ustawia Twoją datę urodzin" },
        )
        .addField("\u200B", '\u200B')
        .addField("Polecenia dla kanału ze streamami", "\u200B")
        .addFields(
            { name: "!plan [dd-mm-yyyy hh:mm] [title]", value: "Planuje transmisję o podanym tytule na podaną datę" },
            { name: "!togglewarnings", value: "Włącza/wyłącza ostrzeżenia o kolidujących streamach" },
            { name: "!remove", value: "Usuwa zaplanowaną transmisję" },
            { name: "!checkmy", value: "Pokazuje wszystkie Twoje zaplanowane transmisje" },
            { name: "!checkall", value: "Pokazuje wszystkie transmisje zaplanowane na serwerze" },
            { name: "!check", value: "Pokazuje streamy zaplanowane na następne 7 dni" },
            { name: "!check [today/tomorrow/dd-mm/dd-mm-yyyy]", value: "Pokazuje streamy zaplanowane na dany dzień" },
            { name: "!check [dd-mm/dd-mm-yyyy] [dd-mm/dd-mm-yyyy]", value: "Pokazuje streamy zaplanowane na dany przedział czasowy" }
        )
        .addField("\u200B", '\u200B')
        .addField("Inne polecenia", "\u200B")
        .addFields(
            { name: "!bonk [@user]", value: "Bonknij kogoś" }
        )

        message.author.send(replyEmbed);
        message.reply("Pomoc wysłana!");
    },
    respondForBonk: function(message, user, bonker)
    {
        const backgroundImagePath = "https://media.discordapp.net/attachments/811659515103543327/825422443082022912/EBFE6D18C67B0599FFA3F25DA20F020E6C9854C8.png";
        const foregroundImagePath = "https://media.discordapp.net/attachments/811659515103543327/826106479609905212/bonk2.png";
        const bonkedAvatarImagePath = user.avatarURL().substring(0, user.avatarURL().length - 4) + "png";
        const bonkerAvatarImagePath = bonker.substring(0, bonker.length - 4) + "png";

        Jimp.read(backgroundImagePath, (err, backgroudImage) => {
            if (err)
            {
                console.error(err);
                return;
            }

            Jimp.read(bonkedAvatarImagePath, (err, bonkedAvatar) => {
                if (err)
                {
                    console.error(err);
                    return;
                }

                Jimp.read(bonkerAvatarImagePath, (err, bonkerAvatar) => {
                    if (err)
                    {
                        console.error(err);
                        return;
                    }

                    Jimp.read(foregroundImagePath, (err, foregroundImage) => {
                        if (err)
                        {
                            console.error(err);
                            return;
                        }

                        let image = backgroudImage
                        .composite(bonkedAvatar, 400, 200)
                        .composite(foregroundImage, 0, 0)
                        .composite(bonkerAvatar, 150, 60);

                        image.getBufferAsync(Jimp.MIME_PNG).then(img => {
                            const attachment = new Discord.MessageAttachment(img, "Bonk.png");
                            message.channel.send(attachment);
                        });
                    });
                });

            })
        });
    },
    respondForUnbonk: function(message, bonker)
    {
        const bonkerAvatarImagePath = bonker;
        const backgroundImagePath = "https://media.discordapp.net/attachments/811659515103543327/840673566512119819/unbonk-bg.png";
        const foregroundImagePath = "https://media.discordapp.net/attachments/811659515103543327/840673564403433482/unbonk-fg.png";

        Jimp.read(backgroundImagePath, (err, backgroundImage) => {
            if (err) console.error(err);

            Jimp.read(bonkerAvatarImagePath, (err, bonkerAvatar) => {
                if (err) console.error(err);

                Jimp.read(foregroundImagePath, (err, foregroundImage) => {
                    if(err) console.error(err);

                    let image = backgroundImage
                    .composite(bonkerAvatar, 100, 100)
                    .composite(foregroundImage, 0, 0);

                    image.getBufferAsync(Jimp.MIME_PNG).then(img => {
                        const attachment = new Discord.MessageAttachment(img, "Unbonk.png");
                        message.channel.send(attachment);
                    });
                });
            });
        });
    },
    respondForSetLink: function(message, link)
    {
        if (!link)
        {
            message.reply("Poprawne użycie komendy: !setlink [link]");
            return;
        }

        firebase.setLinkInFirebase(message.author.id, link).then(val => {
            message.channel.send(val);
        }).catch(err => {
            message.reply(err);
        });
    },
    respondForSus: function(message, link)
    {
        const foregroundImagePath = "https://media.discordapp.net/attachments/811659515103543327/826913104503898112/amongus3.png";
        const maskPath = "https://media.discordapp.net/attachments/811659515103543327/826911522809708564/susmask.png";

        Jimp.read(foregroundImagePath, (err, foregroundImage) => {
            if (err) console.error(err);

            Jimp.read(link, (err, avatarImage) => {
                if (err)
                {
                    console.error(err);
                    message.reply("Błąd! Użyj !sus [@user/link]");
                    return;
                }

                Jimp.read(maskPath, (err, maskImage) => {
                    if (err) console.error(err);

                    let foregroundImageClone = foregroundImage.clone();
                    let image = foregroundImage
                    .composite(avatarImage
                        .cover(180, 100), 120, 50)
                    .mask(maskImage, 0, 0)
                    .composite(foregroundImageClone, 0, 0);

                    image.getBufferAsync(Jimp.MIME_PNG).then(img => {
                        const attachment = new Discord.MessageAttachment(img, "Sus.png");
                        message.channel.send(attachment);
                    });
                });
            });
        });
    },
    respondForCheckReminders: function(message)
    {
        firebase.checkUsersRemindersInFirebase(message.author).then(reminders => {
            console.log(reminders);
        });
    },
    respondForAddReminder: function(message, date, payload)
    {
        if (!date || date.search(/^[0-3][0-9]+-[0-1][0-9]+-202[1-9]+ [0-2][0-9]+:[0-5][0-9]+/) == -1 || !payload)
        {
            message.reply("Poprawne użycie komendy: !add [dd-mm-yyyy hh:mm] [treść]");
            return;
        }

        firebase.addNewReminderInFirebase(message.author.id, date, payload).then(val => {
            message.channel.send(val);
        }).catch(err => {
            message.reply(err);
        });
    },
    respondForBoob: function(message)
    {
        let image = new Discord.MessageAttachment("https://media.discordapp.net/attachments/811659515103543327/832567363274014770/unknown.png");
        message.channel.send(image);
    },
    respondForAmong: function(message, params)
    {
        if (params.length == 0)
        {
            message.reply("Musisz podać argument po komendzie!");
            return;
        }

        let textToDraw = "";
        params.forEach(item => { textToDraw = textToDraw + " " + item.toUpperCase(); })

        let canvas = createCanvas(800, 200)
        let ctx = canvas.getContext('2d')
        let fontConfig = '120px "sus"';

        ctx.font = fontConfig;

        let newCanvasWidth = parseInt(ctx.measureText(textToDraw).width + 50);
        let newCanvasHeight = parseInt(parseInt(ctx.font) + 50) * (messageString.match(/^/gm).length);

        if (newCanvasWidth > 16384 || newCanvasHeight > 16384)
        {
            message.reply("Tekst jest za duży! Spróbuj jeszcze raz :)");
            return;
        }

        canvas = createCanvas(newCanvasWidth, newCanvasHeight);
        ctx = canvas.getContext('2d');
        ctx.font = fontConfig;

        ctx.strokeStyle = 'black';
        ctx.lineWidth = 20;
        ctx.textAlign = "center";
        ctx.strokeText(textToDraw, parseInt(25 + ctx.measureText(textToDraw).width/2.0), parseInt(60 + parseInt(ctx.font)  / 2.0), ctx.measureText(textToDraw).width);
        ctx.fillStyle = 'white';
        ctx.fillText(textToDraw, parseInt(25 +  ctx.measureText(textToDraw).width/2.0), parseInt(60 + parseInt(ctx.font) / 2.0), ctx.measureText(textToDraw).width)
        const attachment = new Discord.MessageAttachment(canvas.toBuffer(), 'very_sus_ngl.png');
        message.channel.send({ content: ``, files: [attachment] });
    }
}