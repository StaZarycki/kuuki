const fb = require("./firebaseHandler.js");
const { registerFont, createCanvas, loadImage } = require('canvas')
const { MessageAttachment } = require('discord.js');
registerFont('fonts/AmongUs-Regular.ttf', {family: 'sus'})


module.exports = {
    replyToCommand(message) {
        const messageString = message.toString();
        const messageArray = messageString.substring(1).split(" ");

        const command = messageArray[0];
        const params = messageArray.slice(1);

        switch (command) {
            case "ping":
                ping(message);
                break;
            case "among":
            
                if(params[0] == null) 
                {
                    message.reply("Musisz podać argument po komendzie!");
                    break;
                }
                
                let textToDraw = "";
                params.forEach(item => {textToDraw = textToDraw + " " + item.toUpperCase()})

                let canvas = createCanvas(800, 200)
                let ctx = canvas.getContext('2d')
                let fontConfig = '120px "sus"';
                
                ctx.font = fontConfig;
                
                let newCanvasWidth = parseInt(ctx.measureText(textToDraw).width + 50);
                let newCanvasHeight = parseInt(parseInt(ctx.font) + 50) * (messageString.match(/^/gm).length);

                if(newCanvasWidth > 16384 || newCanvasHeight > 16384)
                {
                    message.reply("Tekst jest za duży! Spróbuj jeszcze raz :)");
                    break;
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
                const attachment = new MessageAttachment(canvas.toBuffer(), 'very_sus_ngl.png');
                message.channel.send({ content: ``, files: [attachment] });

                break;
        }
    } 
}

const ping = function(message) {
    message.reply("Pong!");
}