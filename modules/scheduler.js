const schedule = require("node-schedule");
const helpers = require("./helpers.js");
const firebase = require("./firebaseHandler.js");
const puchaReplies = require("./jsons/puchaReplies.js");
require("dotenv").config();

const dailyStreamAnnouncementRule = new schedule.RecurrenceRule();
dailyStreamAnnouncementRule.minute = 0;
dailyStreamAnnouncementRule.hour = 10;

const everyMinuteTimerRule = new schedule.RecurrenceRule();
everyMinuteTimerRule.minute = new schedule.Range(0, 59, 1);

const setScheduler = function(privateChannel, publicChannel)
{
    schedule.scheduleJob(everyMinuteTimerRule, () => {
        firebase.getAllStreamsRawFromFirebase().then(arr => {
            if (arr.length == 0)
                return;

            const currentDate = helpers.dateToString(new Date(), helpers.ReturnDateFormat.full);

            firebase.getAllUsersRawFromFirebase().then(users => {
                arr.forEach(stream => {
                    const userObject = users.find(user => user.media == stream.author);
                    if (helpers.dateToString(stream.date, helpers.ReturnDateFormat.full) == currentDate)
                    {
                        let sendMessage = `@here, ${userObject.prefix || ":white_circle:"} ${stream.author} ma teraz transmisję: ${stream.title || stream.name}`;
                        if (userObject.link)
                            sendMessage += ` - ${userObject.link}`;

                        privateChannel.send(sendMessage);
                        console.log(`Private channel: ${stream.author} - ${stream.title || stream.name}`);

                        firebase.getAuthorByMedia(stream.author).then(userObject => {
                            if (userObject.vpoland)
                            {
                                publicChannel.send(sendMessage);
                                console.log(`Public channel: ${stream.author} - ${stream.title || stream.name}`);
                            }
                        })
                    }
                });
            })
        });

        firebase.filterOldStreamsInFirebase();
    });
}

const scheduleDaily = function(channel, birthdayChannel)
{
    schedule.scheduleJob(dailyStreamAnnouncementRule, () => {
        sendDailyMessage(channel);
        checkForBirthday(birthdayChannel);
    });
}

const sendDailyMessage = function(channel)
{
    firebase.getAllStreamsRawFromFirebase().then(arr => {
        if (arr.length == 0)
            return;

        const currentDate = helpers.dateToString(new Date(), helpers.ReturnDateFormat.year);
        const streams = arr.filter(stream => helpers.dateToString(stream.date, helpers.ReturnDateFormat.year) == currentDate);
        if (streams.length == 0)
            return;

        firebase.getAllUsersRawFromFirebase().then(users => {
            const messages = [];

            let sendMessage = `Witajcie misie, mamy ${currentDate.substr(0, 5)}, streamy na dziś:\n\n`;
            let innerIndex = 0;

            streams.forEach(stream => {
                const authorObject = users.find(user => user.media == stream.author);
                sendMessage += `${authorObject.prefix ? authorObject.prefix : ":white_circle:"} **${helpers.dateToString(stream.date, helpers.ReturnDateFormat.hour)}** - ${stream.title || stream.name} \| **${stream.author}**\n`;
                innerIndex++;

                if (innerIndex == 15)
                {
                    messages.push(currentMessage);
                    sendMessage = "";
                    innerIndex = 0;
                }
            });

            sendMessage += "\nTo tyle, życzę wszystkim miłego dzionka OwO";

            if (sendMessage != "")
                messages.push(sendMessage);

            messages.forEach(message => {
                channel.send(message);
            });

            channel.awaitMessages(m => m.author.id == "293016431891709962", { max: 1, time: 3600000 }).then(collected => {
                if (!collected.first()) return;
                if (collected.first().content[0] != "!")
                    collected.first().reply(puchaReplies.replies[Math.floor(Math.random() * puchaReplies.replies.length)]);

                return;
            });
        });
    }).catch(err => { console.error(err); });
}

const checkForBirthday = function(birthdayChannel)
{
    console.log("!Checking birthday!");
    firebase.getAllUsersRawFromFirebase().then(users => {
        if (users.length == 0) return;

        const currentDate = new Date();
        currentDate.setTime(currentDate.getTime() + (2*60*60*1000));
        currentDate.setHours(2, 0, 0, 0);

        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setTime(tomorrow.getTime() + (2*60*60*1000));
        tomorrow.setHours(2, 0, 0, 0);

        const in7Days = new Date();
        in7Days.setDate(in7Days.getDate() + 7);
        in7Days.setTime(in7Days.getTime() + (2*60*60*1000));
        in7Days.setHours(2, 0, 0, 0);

        const currentDateString = helpers.dateToString(currentDate, helpers.ReturnDateFormat.month);
        const tomorrowString = helpers.dateToString(tomorrow, helpers.ReturnDateFormat.month);
        const in7DaysString = helpers.dateToString(in7Days, helpers.ReturnDateFormat.month);

        users.forEach(user => {
            const usersBirthday = helpers.dateToString(user.birthday, helpers.ReturnDateFormat.month);

            if (usersBirthday == currentDateString)
            {
                birthdayChannel.send(`@everyone, <@${user.discord}> ma dzisiaj urodziny!!! :partying_face:`);
            }
            else if (usersBirthday == tomorrowString)
            {
                birthdayChannel.send(`Psst, ${user.media} ma jutro urodziny!!`);
            }
            else if (usersBirthday == in7DaysString)
            {
                birthdayChannel.send(`Pewien ptaszek mi wyćwierkał, że ${user.media} ma urodziny za tydzień!`);
            }
        });
    });
}

module.exports = {
    setScheduler: function(private, public)
    {
        setScheduler(private, public);
    },
    scheduleDailyAnnouncement: function(channel, birthdayChannel)
    {
        scheduleDaily(channel, birthdayChannel);
    },
    sendDailyMessage: function(channel)
    {
        sendDailyMessage(channel);
    },
    checkForBirthday: function(channel)
    {
       checkForBirthday(channel); 
    }
}
