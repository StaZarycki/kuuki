const admin = require("firebase-admin");
const serviceAccount = require("../admin.json");

// Login to database
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://kuuki-dev-default-rtdb.europe-west1.firebasedatabase.app/"
})

const database = admin.database();

// Create db references
const usersRef = database.ref("Users");
const streamsRef = database.ref("Streams");
const remindersRef = database.ref("Reminders");
const statsRef = database.ref("Stats");

module.exports = {
    // Users
    async readUsers() {
        let users = (await usersRef.once("value")).val();
        return users;
    },
    async writeToUsers(users) {
        usersRef.set(users);
    },

    // Streams
    async readStreams() {
        let streams = (await streamsRef.once("value")).val();
        return streams;
    },
    async writeToStreams(streams) {
        streamsRef.set(streams);
    },

    // Reminders
    async readReminders() {
        let reminders = (await remindersRef.once("value")).val();
        return reminders;
    },
    async writeToReminders(reminders) {
        remindersRef.set(reminders);
    },

    // Stats
    async readStats() {
        let stats = (await statsRef.once("value")).val();
        return stats;
    },
    async writeToStats(stats) {
        statsRef.set(stats);
    }
}