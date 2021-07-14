module.exports = {
    replyToCommand(message) {
        const messageString = message.toString();
        const messageArray = messageString.substring(1).split(" ");

        const command = messageArray[0];
        const params = messageArray.slice(1);

        switch (command) {
            case "ping":
                message.reply("Pong!");
        }
    } 
}

const ping = function() {

}