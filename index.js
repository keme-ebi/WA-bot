const { DisconnectReason, useMultiFileAuthState } = require("@whiskeysockets/baileys");
const makeWASocket = require("@whiskeysockets/baileys").default;

async function connect(){
    const { state, saveCreds} = await useMultiFileAuthState('auth_info_baileys');

    const sock = makeWASocket({
        printQRInTerminal: true,
        auth: state,
    });

    sock.ev.on("connection.update", async (update) => {
        const {connection, lastDisconnect} = update || {};

        if (update?.qr){
            console.log(update?.qr);
            // write custom logic here
        }

        if (connection === "close") {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;

            if (shouldReconnect) {
                connect();
            }
        }
    });
    sock.ev.on("message.update", (messafeInfo) => {
        console.log(messafeInfo);
    });

    sock.ev.on("messages.upsert", async (m) => {
        console.log(m);
        const message = m.messages[0];

        if (message.key.remoteJid.endsWith('@g.us')) {
            const groupId = message.key.remoteJid;

            // console.log(`Bot was tagged in the group: ${groupId}`);
            console.log(message);

            // get the bot's id
            const botId = sock.user.id.replace(":1", "");
            console.log(botId);

            const groupMetadata = await sock.groupMetadata(groupId);
            const participants = groupMetadata.participants;

            // get id of the sender
            const senderId = message.key.participant;

            // extract admins from metadata
            const admins = participants.filter(p => p.admin === 'admin' || p.admin === 'superadmin');

            const isAdmin = []

            // console.log(admins);
            // get only the ids of the admins in a group
            admins.forEach(p => {
                isAdmin.push(p.id);
            })

            // const group = await sock.groupMetadata(groupId);
            // console.log(group);

            const mess = message.message.conversation.toLowerCase();
            if (mess.includes('giveaway')) {
                const groupMetadata = await sock.groupMetadata(groupId);
                const groupName = groupMetadata.subject;
                await sock.sendMessage('2348097345248@s.whatsapp.net', { text: `check *${groupName}*, giveaway was mentioned`});
            }

            // if the bot gets mentioned in a chat
            if (message?.message?.extendedTextMessage?.contextInfo?.mentionedJid) {
                const mentionedJids = message?.message?.extendedTextMessage?.contextInfo?.mentionedJid;

                // reply to bot tag without a command attached
                if (mentionedJids.includes(botId) && message.message.extendedTextMessage.text === `@${botId.split('@')[0]}`) {
                    await sock.sendMessage(groupId, { text: 'Steeze' }, { quoted: message });
                }

                // tags everyone if there's a "tag everyone" command attached to the bot tag from the admin(s)
                if (isAdmin.includes(senderId) && mentionedJids.includes(botId) && message.message.extendedTextMessage.text.includes("tag everyone")) {
                    const mentions = [];
                    let reply = "Here you go...!!!\n\n";
                    participants.pop(botId); // remove bot tag from participants

                    // remove "@s.whatsapp.net" from tags in order to display participants names instead
                    participants.forEach(p => {
                        const displayName = p.id.split('@')[0];
                        reply += `@${displayName}`;
                        mentions.push(p.id);
                    })

                    await sock.sendMessage(groupId, { text: reply, mentions: mentions }, { quoted: message });
                } else if (!isAdmin.includes(senderId) && mentionedJids.includes(botId) && message.message.extendedTextMessage.text.includes("tag everyone")) {
                    // if sender is not an admin and requests to tag the group
                    await sock.sendMessage(groupId, { text: 'This command is only available to group admin(s)' }, { quoted: message })
                }
            }
        }
    });

    sock.ev.on("creds.update", saveCreds);
}

connect();