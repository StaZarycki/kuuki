const admin = require("firebase-admin");
const serviceAccount = require("../admin.json");
const helpers = require("./helpers.js");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://kuuki-bot-default-rtdb.europe-west1.firebasedatabase.app"
});

// Initialize database

const database = admin.database();

const usersRef = database.ref("Users");
const streamsRef = database.ref("Streams");
const remindersRef = database.ref("Reminders");
const statsRef = database.ref("Stats");
// const birthdaysRef = database.ref("Birthdays");

// Methods

const addUser = function(discordUser, mediaUser)
{
    return new Promise((resolve, reject) => {
        let users = [];

        usersRef.once("value", snap => {
            users = snap.val();
        }).then(() => {
            let inDatabase = false;

            users.forEach(user => {
                if (user.discord == discordUser)
                {
                    reject("Jesteś już dodany do bazy! Sprawdź pod !checkusers");
                    inDatabase = true;
                }
            });

            if (inDatabase) return;

            users.push({
                "discord": discordUser,
                "media": mediaUser
            });

            usersRef.set(users);
            resolve("Ok!");
        });
    });
}

const checkAllUsers = function(usersToFetch)
{
    return new Promise((resolve, reject) => {
        let users = [];
        let messages = [];
        let innerIndex = 0;

        usersRef.once("value", snap => {
            users = snap.val();
        }).then(() => {

            if (users.length == 0)
            {
                reject("Brak użytkowników w bazie!");
                return;
            }

            let currentMessage = "Powiązane konta:\n";

            let outerIndex = 0;
            users.forEach(user => {
                usersToFetch.fetch(user.discord).then(currentUser => {
                    currentMessage += `:o: :detective: ${currentUser.username} => :movie_camera: ${user.media}\n`;
                    innerIndex++;

                    if (innerIndex == 15)
                    {
                        messages.push(currentMessage);
                        currentMessage = "";
                        innerIndex = 0;
                    }
                    outerIndex++;
                    if (outerIndex == users.length)
                    {
                        if (currentMessage != "")
                        messages.push(currentMessage);

                        resolve(messages);
                    }
                });

            });

        });
    });
}

const removeUser = function(discordUser)
{
    return new Promise((resolve, reject) => {
        let users = [];

        usersRef.once("value", snap => {
            users = snap.val();
        }).then(() => {
            let inDatabase = false;

            users.forEach(user => {
                if (user.discord == discordUser)
                    inDatabase = true;
            });

            if (!inDatabase)
            {
                reject("Nie ma cię w bazie danych! Sprawdź !checkusers");
                return;
            }

            users = users.filter((user) => { return user.discord != discordUser; });

            usersRef.set(users);
            resolve("Ok!");
        });
    });
}

const setPrefix = function(discordUser, prefix)
{
    return new Promise((resolve, reject) => {
        let users = [];

        usersRef.once("value", snap => {
            users = snap.val();
        }).then(() => {
            let inDatabase = false;

            users.forEach(user => {
                if (user.discord == discordUser)
                {
                    inDatabase = true;
                    user.prefix = prefix;
                }
            });

            if (!inDatabase)
            {
                reject("Nie ma cię w bazie danych! Sprawdź !checkusers");
                return;
            }

            usersRef.set(users);
            resolve("Ok! Nowy prefix: " + prefix);
        });
    });
}

const setLink = function(discordUser, link)
{
    return new Promise((resolve, reject) => {
        let users = [];

        usersRef.once("value", snap => {
            users = snap.val();
        }).then(() => {
            let inDatabase = false;

            users.forEach(user => {
                if (user.discord == discordUser)
                {
                    inDatabase = true;
                    user.link = link;
                }
            });

            if (!inDatabase)
            {
                reject("Nie ma cię w bazie danych! Sprawdź !checkusers");
                return;
            }

            usersRef.set(users);
            resolve("Ok! Nowy link: <" + link + ">");
        });
    });
}

const setBirthday = function(discordUser, date)
{
    return new Promise((resolve, reject) => {
        let users = [];

        usersRef.once("value", snap => {
            users = snap.val();
        }).then(() => {
            let inDatabase = false;
            const birthday = helpers.stringToDate(`${date}-2000 12:00`)

            let returnUser = null;
            users.forEach(user => {
                if (user.discord == discordUser)
                {
                    inDatabase = true;
                    returnUser = user;
                    user.birthday = birthday.toString();
                }
            });

            if (!inDatabase)
            {
                reject("Nie ma cię w bazie danych! Sprawdź !checkusers");
                return;
            }

            usersRef.set(users);
            resolve("Ok! Urodziny ustawione na: " + helpers.dateToString(returnUser.birthday, helpers.ReturnDateFormat.month));
        });
    });
}

const addStrem = function(discordUser, date, title)
{
    return new Promise((resolve, reject) => {
        let streams = [];
        let userObject = {};

        usersRef.once("value", snap => {
            userObject = snap.val().filter(user => user.discord == discordUser)[0];
        }).then(() => {
            if (!userObject)
            {
                reject("Nie ma cię w bazie danych! Sprawdź !checkusers");
                return;
            }

            streamsRef.once("value", snap => {
                streams = snap.val();
            }).then(() => {

                if (userObject.warnings)
                {
                    // Check colliding streams
                }
                else
                {
                    streams.push({
                        "author": userObject.media,
                        "date": helpers.stringToDate(date).toString(),
                        "title": title
                    });

                    streamsRef.set(streams);

                    try
                    {
                        let displayTitle;
                        if (title.includes("https://"))
                        {
                            displayTitle = title.split(" ");
                            displayTitle.forEach(word => {
                                if (word.includes("https://"))
                                {
                                    word = `<${word}>`;
                                }
                            });
                            displayTitle = displayTitle.join(" ");
                        }
                        resolve(`Ok! Transmisja ${displayTitle || title} została zaplanowana na ${date}`);
                    }
                    catch (error)
                    {
                        console.error(error);
                    }
                }
            });
        });
    });
}

const checkUsersStreams = function(discordUser)
{
    return new Promise((resolve, reject) => {
        let streams = [];
        let messages = [];
        let innerIndex = 0;
        let userObject = {};

        usersRef.once("value", usersSnap => {
            userObject = usersSnap.val().filter(user => user.discord == discordUser)[0];
        }).then(() => {
            if (!userObject)
            {
                reject("Nie ma cię w bazie danych! Sprawdź !checkusers");
                return;
            }

            streamsRef.once("value", streamsSnap => {
                streams = streamsSnap.val().filter(stream => stream.author == userObject.media);
            }).then(() => {
                if (streams.length == 0)
                {
                    reject("Nie masz żadnych zaplanowanych streamów!");
                    return;
                }

                streams.sort((a, b) => new Date(a.date) - new Date(b.date));

                let currentMessage = "Twoje zaplanowane streamy:\n";

                streams.forEach(stream => {

                    try
                    {
                        if (stream.title.includes("https://"))
                        {
                            let displayTitle = stream.title.split(" ");
                            displayTitle.forEach(word => {
                                if (word.includes("https://"))
                                {
                                    word = `<${word}>`;
                                }
                            });
                            displayTitle = displayTitle.join(" ");
                        }
                    }
                    catch (error)
                    {
                        console.error(error);
                    }

                    currentMessage += `${userObject.prefix} ${helpers.dateToString(stream.date, helpers.ReturnDateFormat.full)} - ${displayTitle || stream.title || stream.name}\n`;
                    innerIndex++;

                    if (innerIndex == 15)
                    {
                        messages.push(currentMessage);
                        currentMessage = "";
                        innerIndex = 0;
                    }
                });

                if (currentMessage != "")
                    messages.push(currentMessage);

                resolve(messages);
            });
        });
    });
}

const getStreamsRaw = function()
{
    return new Promise((resolve, reject) => {
        let streams = [];

        streamsRef.once("value", snap => {
            streams = snap.val();
            streams.sort((a, b) => new Date(a.date) - new Date(b.date));
        }).then(() => { resolve(streams); }).catch(err => { reject(err); });
    });
}

const getUsersRaw = function()
{
    return new Promise((resolve, reject) => {
        let users = [];

        usersRef.once("value", snap => {
            users = snap.val();
        }).then(() => { resolve(users); }).catch(err => { reject(err); });
    });
}

const getStreamerByDiscord = function(discordUser)
{
    return new Promise((resolve, reject) => {
        let userObject = {};

        usersRef.once("value", snap => {
            userObject = snap.val().find(user => user.discord == discordUser);
        }).then(() => { resolve(userObject); }).catch(err => { reject(err); });
    });
}

const getStreamerByMedia = function(mediaUser)
{
    return new Promise((resolve, reject) => {
        let userObject = {};

        usersRef.once("value", snap => {
            userObject = snap.val().find(user => user.media == mediaUser) || snap.val().find(user => user.youtube == mediaUser);
        }).then(() => { resolve(userObject); }).catch(err => { reject(err); });
    });
}

const toggleWarningsForUser = function(discordUser)
{
    return new Promise((resolve, reject) => {
        let users = [];

        usersRef.once("value", snap => {
            users = snap.val();
        }).then(() => {
            let inDatabase = false;
            let isEnabled = false;

            users.forEach(user => {
                if (user.discord == discordUser)
                {
                    inDatabase = true;
                    if (user.warnings)
                        user.warnings = false;
                    else
                    {
                        user.warnings = true;
                        isEnabled = true;
                    }
                }
            });

            if (!inDatabase)
            {
                reject("Nie ma cię w bazie danych! Sprawdź !checkusers");
                return;
            }

            usersRef.set(users);
            resolve(`Ok! ${isEnabled ? "Ostrzeżenia zostały włączone!" : "Ostrzeżenia zostały wyłączone!"}`);
        });
    });
}

const removeStream = function(discordUser, streamId)
{
    return new Promise((resolve, reject) => {
        let userObject = {};
        let streams = [];

        usersRef.once("value", snapUser => {
            if (discordUser != "poweruser")
                userObject = snapUser.val().filter(user => user.discord == discordUser)[0];
        }).then(() => {
            if (!userObject && discordUser != "poweruser")
            {
                reject("Nie ma cię w bazie danych! Sprawdź !checkusers");
                return;
            }

            streamsRef.once("value", snapStreams => {
                streams = snapStreams.val();
            }).then(() => {
                if (discordUser == "poweruser")
                {
                    const usersStreams = streams;

                    usersStreams.splice(streamId, 1);
                    streams = usersStreams;
                    streams.sort((a, b) => new Date(a.date) - new Date(b.date));
                    streamsRef.set(streams);

                    resolve("Ok!");
                }
                else
                {
                    if (streams.filter(stream => stream.author == userObject.media).length == 0)
                    {
                        reject("Błąd :woozy_face:");
                        return;
                    }
                    streams.sort((a, b) => new Date(a.date) - new Date(b.date));
                    const usersStreams = streams.filter(stream => stream.author == userObject.media);
                    usersStreams.splice(streamId, 1);
                    streams = streams.filter(stream => stream.author != userObject.media);
                    streams.push(...usersStreams);
                    streams.sort((a, b) => new Date(a.date) - new Date(b.date));
                    streamsRef.set(streams);
                    resolve("Ok!");
                }
            });
        });
    });
}

const editStream = function(discordUser, streamId, streamObject)
{
    return new Promise((resolve, reject) => {
        getUsersRaw().then(users => {
            let userObject;
            if (discordUser != "poseruser")
                userObject = users.find(user => user.discord == discordUser);

            getStreamsRaw().then(streams => {
                if (discordUser == "poweruser")
                {
                    const usersStreams = streams;

                    usersStreams[streamId] = streamObject;
                    streams = usersStreams;
                    streams.sort((a, b) => new Date(a.date) - new Date(b.date));
                    streamsRef.set(streams).catch(err => { reject(err); });

                    resolve(streamObject);
                }
                else
                {
                    const usersStreams = streams.filter(stream => stream.author == userObject.media);
                    usersStreams[streamId] = streamObject;

                    streams = streams.filter(stream => stream.author != userObject.media);
                    streams.push(...usersStreams);
                    streams.sort((a, b) => new Date(a.date) - new Date(b.date));
                    streamsRef.set(streams).catch(err => { reject(err); });

                    resolve(streamObject);
                }
            });
        });
    });
}

const filterOldStreams = function()
{
    const now = new Date();

    getStreamsRaw().then(streams => {
        if (streams.length == 0) return;
        const newStreams = streams.filter(stream => Date.parse(stream.date) > now.getTime());
        streamsRef.set(newStreams);
    });
}

const checkUsersReminders = function(discordUser)
{
    return new Promise((resolve, reject) => {
        let usersReminders = [];

        remindersRef.once("value", snap => {
            usersReminders = snap.val().filter(reminder => reminder.author == discordUser);
        }).then(() => {
            resolve(usersReminders);
        }).catch(err => {
            reject(err);
        });
    });
}

const addReminder = function(discordUser, date, payload)
{
    return new Promise((resolve, reject) => {
        let reminders = [];
        let userObject = {};

        remindersRef.once("value", snap => {
            reminders = snap.val();
        }).then(() => {
            reminders.push({
                "author": discordUser,
                "date": helpers.stringToDate(date).toString(),
                "payload": payload
            });

            remindersRef.set(reminders);
            resolve(`Ok! ${payload} zostanie przypomniane ${date}`);
        })
        .catch(err => {
            resolve(err);
        });
    });
}

const getStats = function()
{
    return new Promise((resolve, reject) => {
        let stats = {};
        statsRef.once("value", snap => {
            stats = snap.val();
        }).then(() => {
            resolve(stats);
        }).catch(err => {
            reject(err);
        });
    });
}

const addCommandUse = function(command)
{
    return new Promise((resolve, reject) => {
        getStats().then(stats => {

            if (!stats) stats = {};
            const commandsStats = stats.commands || {};

            const today = helpers.dateToString(new Date(), helpers.ReturnDateFormat.year);

            const currentStat = commandsStats[command] || {};
            
            if (!currentStat.total || currentStat.total == 0)
            {
                currentStat.total = 1;
                currentStat[today] = 1;
            }
            else
            {
                currentStat.total += 1;
                if (currentStat[today])
                {
                    currentStat[today] += 1;
                }
                else
                {
                    currentStat[today] = 1;
                }
            }
            
            commandsStats[command] = currentStat;
            stats.commands = commandsStats;
            statsRef.set(stats);

            resolve(stats);
        }).catch(err => reject(err));
    });
}

// Export

module.exports = {
    addUserToFirebase: function(discordUser, mediaUser)
    {
        return addUser(discordUser, mediaUser);
    },
    checkAllUsersInFirebase: function(users)
    {
        return checkAllUsers(users);
    },
    removeUserFromFirebase: function(discordUser)
    {
        return removeUser(discordUser);
    },
    setPrefixForUserInFirebase: function(discordUser, prefix)
    {
        return setPrefix(discordUser, prefix);
    },
    setBirthdayForUserInFirebase: function(discordUser, date)
    {
        return setBirthday(discordUser, date);
    },
    addNewStreamInFirebase: function(discordUser, date, title)
    {
        return addStrem(discordUser, date, title);
    },
    checkUsersStreamsInFirebase: function(discordUser)
    {
        return checkUsersStreams(discordUser);
    },
    getAllStreamsRawFromFirebase: function()
    {
        return getStreamsRaw();
    },
    getAllUsersRawFromFirebase: function()
    {
        return getUsersRaw();
    },
    getAuthorByDiscord: function(discordUser)
    {
        return getStreamerByDiscord(discordUser);
    },
    getAuthorByMedia: function(mediaUser)
    {
        return getStreamerByMedia(mediaUser);
    },
    toggleWarningsForUser: function(discordUser)
    {
        return toggleWarningsForUser(discordUser);
    },
    removeStreamFromFirebase: function(discordUser, streamId)
    {
        return removeStream(discordUser, streamId);
    },
    editStreamInFirebase: function(discordUser, streamId, streamObject)
    {
        return editStream(discordUser, streamId, streamObject);
    },
    filterOldStreamsInFirebase: function()
    {
        filterOldStreams();
    },
    setLinkInFirebase: function(discordUser, link)
    {
        return setLink(discordUser, link);
    },
    checkUsersRemindersInFirebase: function(discordUser)
    {
        return checkUsersReminders(discordUser);
    },
    addNewReminderInFirebase: function(discordUser, date, payload)
    {
        return addReminder(discordUser, date, payload);
    },
    getStatsRawFromFirebase: function()
    {
        return getStats();
    },
    addCommandUseToStats: function(command)
    {
        return addCommandUse(command);
    }
}
