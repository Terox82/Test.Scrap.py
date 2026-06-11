const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { authenticator } = require('otplib'); 

// --- কনফিগারেশন ---
const token = '8798012592:AAEDubfBAzXYSTHflCoiiWI2htFiGEwFbL0'; 
const bot = new TelegramBot(token, { polling: true });

const FB_URL = 'https://tafsir-bot-7983f-default-rtdb.asia-southeast1.firebasedatabase.app/bot';
const CHANNELS = ['@earnify_beckup', '@earnxotp'];

const app = express();
app.use(cors());

const userState = {}; 
let botInfo = {};

// লাইভ নাম্বার ট্র্যাকিং (Auto OTP Push & Updates এর জন্য)
const activeNumbers = {}; 

// --- সার্ভার স্টার্ট ও ডাটাবেজ থেকে রিস্টোর ---
app.get('/', (req, res) => res.send("TS OTP Bot is Live and Running!"));
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
    botInfo = await bot.getMe();
    console.log(`Bot Username: @${botInfo.username}`);
    console.log(`Server running on port ${PORT}`);
    
    // সার্ভার স্টার্ট হলে ডাটাবেজ থেকে আগের একটিভ নাম্বারগুলো রিস্টোর করবে (Permanent Check)
    try {
        const usersRes = await axios.get(`${FB_URL}/users.json`);
        if (usersRes.data) {
            const now = Date.now();
            for (const [userId, userData] of Object.entries(usersRes.data)) {
                const storeg = userData['user-local-storeg'];
                // 24 ঘন্টার (24  * 60 * 60 * 1000 ms) ভেতরের সেশন রিস্টোর করবে
                if (storeg && storeg.state === 'numbers' && storeg.numbers && (now - storeg.time < 24 * 60 * 60 * 1000)) {
                    storeg.numbers.forEach(num => {
                        activeNumbers[num] = { 
                            chatId: userId, 
                            time: storeg.time, 
                            lastMessage: storeg.lastMessages ? storeg.lastMessages[num] : "" 
                        };
                    });
                }
            }
        }
        console.log("Database Sync Completed. Active tracking restored.");
    } catch (e) {
        console.log("Error syncing DB on startup.");
    }
});

// --- হেল্পার ফাংশন ---
async function checkMembership(userId) {
    try {
        for (let ch of CHANNELS) {
            const m = await bot.getChatMember(ch, userId);
            if (m.status === 'left' || m.status === 'kicked') return false;
        }
        return true;
    } catch (e) { return false; }
}

async function getUserInfo(userId, msg, referrerId = null) {
    try {
        let res = await axios.get(`${FB_URL}/users/${userId}.json`);
        let user = res.data;
        
        if (!user) {
            user = {
                username: msg.from?.username || "NoUser",
                chat_id: userId,
                name: msg.from?.first_name || "User",
                balance: 0,
                refer_code: `ref_${userId}`,
                referred_by: referrerId ? referrerId : "none",
                total_referrals: 0,
                referral_rewarded: false
            };
            await axios.put(`${FB_URL}/users/${userId}.json`, user);
        }
        return user;
    } catch (e) { return null; }
}

// --- মেনু লেআউট ---
const bottomKeyboard = {
    reply_markup: {
        keyboard: [
            [{ text: "📱 Get Number" }, { text: "💰 Balance" }],
            [{ text: "💸 Withdraw" }, { text: "📊 Status" }],
            [{ text: "🔐 Get 2FA Code" }] 
        ],
        resize_keyboard: true,
        is_persistent: true
    }
};

// --- কমান্ড হ্যান্ডলার ---
bot.onText(/^\/start(?: (.*))?$/, async (msg, match) => {
    const chatId = msg.chat.id;
    const param = match[1] ? match[1].trim() : '';
    let referrerId = param.startsWith('ref_') ? param.split('_')[1] : null;

    await getUserInfo(chatId, msg, referrerId);

    const isMember = await checkMembership(chatId);
    if (!isMember) {
        const kb = [[{ text: "📢 Main Channel", url: "https://t.me/earnify_beckup" }], [{ text: "💬 OTP Group", url: "https://t.me/earnxotp" }], [{ text: "✅ Verify", callback_data: "verify" }]];
        return bot.sendMessage(chatId, "⚠️ <b>Channel Join Needed!</b>\nPlease join our channel and Click Verify to use the bot.", { parse_mode: 'HTML', reply_markup: { inline_keyboard: kb } });
    }

    bot.sendMessage(chatId, `🤖 <b>Welcome ${msg.from.first_name}!</b> 🎉\n\n🟢 <b>Main Menu</b>\n\n⬇️ Please select an option below:`, { parse_mode: 'HTML', ...bottomKeyboard });
});

// --- অটো মেসেজ চেকার (1 Hour Loop with DB Sync) ---
setInterval(async () => {
    const numbers = Object.keys(activeNumbers);
    if (numbers.length === 0) return;

    try {
        const retRes = await axios.get(`${FB_URL}/settings/ret.json`);
        const smsRate = retRes.data !== null ? Number(retRes.data) : 0.25;

        for (const phone of numbers) {
            const trackData = activeNumbers[phone];
            const now = Date.now();

            // ১ ঘন্টা (60 minutes) পার হয়ে গেলে ডেটাবেজ থেকে মেসেজ ডিলিট করবে এবং ট্র্যাকিং রিমুভ করবে
           



// ১ ঘণ্টা পর পুরো sms_logs ডিলিট করে আবার নির্দিষ্ট ডেটাসহ তৈরি করবে
if (now - trackData.time >  24 * 60 * 60 * 1000) {
    try {
        // ১. পুরো sms_logs ডিরেক্টরি ডিলিট করা
        await axios.delete(`${FB_URL}/sms_logs.json`);

        // ২. ডিলিট করার সাথে সাথেই আপনার দেওয়া মেসেজ ফরম্যাটটি সেট করা
        // এটি পুরো sms_logs পাথটি আবার তৈরি করবে এবং ডাটা ইনসার্ট করবে
        const resetData = {
            [phone]: {
                message: "Facebook Catalina Maribel prote number: 000000000",
                paid: "false",
                time: "2026-02-01 15:31:53"
            }
        };

        await axios.patch(`${FB_URL}/sms_logs.json`, resetData);

        // ৩. ট্র্যাকিং রিসেট করা
        activeNumbers[phone] = {
            time: Date.now()
        };

        console.log(`sms_logs deleted and recreated with default message for: ${phone}`);
    } catch (error) {
        console.error("Critical Reset Error:", error.message);
    }
    continue;
}

            
    

            try {
                const res = await axios.get(`${FB_URL}/sms_logs/${phone}.json`);
                if (res.data && res.data.message) {
                    const currentMsg = res.data.message;

                    // নতুন মেসেজ বা মেসেজ আপডেট হলে
                    if (currentMsg !== trackData.lastMessage) {
                        const isUpdate = trackData.lastMessage !== undefined && trackData.lastMessage !== "";
                        trackData.lastMessage = currentMsg; 

                        // ডেটাবেজে পারমানেন্ট আপডেট সেভ করা হচ্ছে
                        await axios.patch(`${FB_URL}/users/${trackData.chatId}/user-local-storeg/lastMessages.json`, { [phone]: currentMsg }).catch(()=>{});

                        const otpMatch = currentMsg.match(/\b(\d{3,4}[ -]?\d{3,4}|\d{4,8})\b/);
                        const otp = otpMatch ? otpMatch[0] : "";
                        
                        let header = isUpdate ? "📩<b>UPDATE MESSAGE ARRIVED </b>" : "📩 <b>NEW MESSAGE ARRIVED </b>\n";
                        let reportTxt = `${header} <code>${phone}</code>\n<blockquote>${currentMsg}</blockquote>\n`;
                        let otpButtons = [];
                        
                        if (otp) {
                            otpButtons.push([{ text: `${otp}`, copy_text: { text: otp } }]);
                            
                            // প্রথমবার মেসেজ আসলে ব্যালেন্স এড করবে
                            if (!res.data.paid) {
                                try {
                                    let uRes = await axios.get(`${FB_URL}/users/${trackData.chatId}.json`);
                                    if (uRes.data) {
                                        let newBal = (Number(uRes.data.balance) || 0) + smsRate;
                                        await axios.patch(`${FB_URL}/users/${trackData.chatId}.json`, { balance: newBal });
                                        reportTxt += `🎁 <b>Bonus:</b> নতুন মেসেজের জন্য<b>${smsRate} BDT</b> যোগ হয়েছে!\n`;
                                    }
                                    await axios.patch(`${FB_URL}/sms_logs/${phone}.json`, { paid: true });
                                } catch(e) {}
                            }
                        }
                        
                        bot.sendMessage(trackData.chatId, reportTxt, { parse_mode: 'HTML', reply_markup: { inline_keyboard: otpButtons } });
                    }
                }
            } catch (e) { }
        }
    } catch (e) { }
}, 3000);


// --- রিপ্লাই কীবোর্ড বাটন ও স্টেট হ্যান্ডলিং ---
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (!text || text.startsWith('/')) return; 

    const textUpper = text.toUpperCase().replace(/\s+/g, '');
    const isBase32 = /^[A-Z2-7]{16,64}$/.test(textUpper); 
    
    if (isBase32) {
        try {
            const code = authenticator.generate(textUpper);
            const msgText = `🔐 <b>2FA AUTHENTICATION</b>\n\n` +
                          `📦 <b>Your Code:</b> <code>${code}</code>\n` +
                          `⏳ <b>Validity:</b> 30 Seconds\n\n` +
                          `👤 <b>Admin:</b> @mhnirob1\n` +
                          `━━━━━━━━━━━━━━\n` +
                          `⚡ <i>TS BOT ADMIN TS NIROB</i>`;

            const inlineKeyboard = { reply_markup: { inline_keyboard: [[{ text: `📋 Copy Code: ${code}`, copy_text: { text: code } }]] } };
            return bot.sendMessage(chatId, msgText, { parse_mode: 'HTML', ...inlineKeyboard });
        } catch (e) {}
    }

    const menuCommands = ['📱 Get Number', '💰 Balance', '💸 Withdraw', '📊 Status', '🔐 Get 2FA Code'];
    if (menuCommands.includes(text)) delete userState[chatId]; 

    const isMember = await checkMembership(chatId);
    if (!isMember) {
        return bot.sendMessage(chatId, "❌ <b>আপনি চ্যানেল বা গ্রুপে নেই!</b> /start দিয়ে আগে ভেরিফাই করুন।", {parse_mode: 'HTML'});
    }

    if (text === '📱 Get Number') {
        // DB থেকে ইউজার স্টোরেজ চেক করবে
        let uRes = await axios.get(`${FB_URL}/users/${chatId}/user-local-storeg.json`);
        let storeg = uRes.data;

        // যদি ইউজারের ১ ঘন্টার মধ্যে আগের কোনো রিস্টোর করার ডেটা থাকে
        if (storeg && storeg.state === 'numbers' && storeg.numbers && storeg.numbers.length > 0) {
            if (Date.now() - (storeg.time || 0) < 60 * 60 * 1000) {
                let srv = storeg.srv;
                let batch = storeg.numbers;
                
                let txt = `🔄 <b>RESTORED NUMBERS (${srv.toUpperCase()})</b>\n\n`;
                let kb = [];
                
                batch.forEach((num) => {
                    kb.push([{ text: `📋 ${num}`, copy_text: { text: num } }]);
                    // ট্র্যাকিংয়ে রিস্টোর করা হচ্ছে
                    if(!activeNumbers[num]) {
                        activeNumbers[num] = { 
                            chatId: chatId, 
                            time: storeg.time, 
                            lastMessage: storeg.lastMessages ? storeg.lastMessages[num] : "" 
                        }; 
                    }
                });

                kb.push([{ text: "🌍 Change Country", callback_data: "get_country" }, { text: "OTP GROUP ↗️", url: "https://t.me/earnxotp" }]);
                kb.push([{ text: "🔄 Change Number", callback_data: `next_${srv}` }]);
                
                txt += "⏳ <i>অটোমেটিক মেসেজ  চেক  করা  হচ্ছে....\n      আপনার  আগের  নেওয়া নাম্বারগুলো\n                  রিস্টোর করা হয়েছে।</i>";
                
                return bot.sendMessage(chatId, txt, { parse_mode: 'HTML', reply_markup: { inline_keyboard: kb } });
            }
        }

        const res = await axios.get(`${FB_URL}/servers.json`);
        let kb = [];
        for (let s in res.data) kb.push([{ text: ` ${s.toUpperCase()}`, callback_data: `srv_${s}` }]);
        return bot.sendMessage(chatId, "🌐 <b>Select your country: 👇</b>", { parse_mode: 'HTML', reply_markup: { inline_keyboard: kb } });
    }
    else if (text === '🔐 Get 2FA Code') {
        return bot.sendMessage(chatId, "🔐 <b>আপনার 2FA Secret Key সেন্ড করুন:</b>\nযেমন: <code>WVPP 6AUW 75VU AHN7...</code>", { parse_mode: 'HTML' });
    }
    else if (text === '💰 Balance') {
        const u = await getUserInfo(chatId, msg);
        const refLink = `https://t.me/${botInfo.username}?start=ref_${chatId}`;
        const txt = `💰 <b>Balance:</b> ${u.balance || 0} BDT\n\n🔗 <b>Referral Link:</b> <code>${refLink}</code>\n\n👥 <b>Referrals:</b> ${u.total_referrals || 0}\n🎁 <b>Per Refer Earn:</b> 0.05 BDT`;
        const kb = [[{ text: "📋 Copy Referral Link", copy_text: { text: refLink } }]];
        return bot.sendMessage(chatId, txt, { parse_mode: 'HTML', reply_markup: { inline_keyboard: kb } });
    }
    else if (text === '💸 Withdraw') {
        const kb = [[{text: "🟣 bKash", callback_data: "wd_bkash"}, {text: "🟠 Nagad", callback_data: "wd_nagad"}], [{text: "🚀 Rocket", callback_data: "wd_rocket"}]];
        return bot.sendMessage(chatId, "💸 <b>উইথড্র মেথড সিলেক্ট করুন:</b>", { parse_mode: 'HTML', reply_markup: { inline_keyboard: kb } });
    }
    else if (text === '📊 Status') {
        const res = await axios.get(`${FB_URL}/withdrawals.json`);
        let wHistory = "";
        for (let key in res.data) {
            if (res.data[key].user_id == chatId) {
                let w = res.data[key];
                wHistory += `💸 <b>${w.method}</b> | ${w.amount} BDT\n📱 ${w.account}\n📊 Status: <b>${w.status}</b>\n━━━━━━━━━━━━━━\n`;
            }
        }
        if (!wHistory) wHistory = "❌ কোনো হিস্ট্রি পাওয়া যায়নি।";
        const kb = [[{ text: "🗑️ Clear History", callback_data: "clear_history" }]];
        return bot.sendMessage(chatId, `🕜 <b>আপনার উত্তোলনের হিস্ট্রি:</b>\n\n${wHistory}`, { parse_mode: 'HTML', reply_markup: { inline_keyboard: kb } });
    }

    // উইথড্র লজিক
    if (userState[chatId]) {
        if (userState[chatId].step === 'wait_number') {
            if (!/^\d{11}$/.test(text)) return bot.sendMessage(chatId, "❌ নাম্বারটি সঠিক নয়। ১১ ডিজিটের নাম্বার দিন:");
            userState[chatId].account = text;
            userState[chatId].step = 'wait_amount';
            return bot.sendMessage(chatId, "💰 এবার <b>এমাউন্ট</b> লিখুন (মিনিমাম 50 BDT):", {parse_mode:'HTML'});
        } 
        else if (userState[chatId].step === 'wait_amount') {
            const amount = parseFloat(text);
            if (isNaN(amount) || amount < 50) return bot.sendMessage(chatId, "❌ এমাউন্ট মিনিমাম 50 হতে হবে।");
            
            const u = await getUserInfo(chatId, msg);
            if (Number(u.balance) < amount) {
                delete userState[chatId]; 
                return bot.sendMessage(chatId, `❌ <b>অপর্যাপ্ত ব্যালেন্স!</b>\nআপনার ব্যালেন্স: ${u.balance} BDT`, {parse_mode:'HTML'});
            }

            u.balance = Number(u.balance) - amount;
            await axios.patch(`${FB_URL}/users/${chatId}.json`, { balance: u.balance });

            const wdData = {
                user_id: chatId,
                method: userState[chatId].method.toUpperCase(),
                account: userState[chatId].account,
                amount: amount,
                status: "Pending",
                time: new Date().toLocaleString("bn-BD", {timeZone: "Asia/Dhaka"})
            };
            await axios.post(`${FB_URL}/withdrawals.json`, wdData);

            delete userState[chatId];
            return bot.sendMessage(chatId, `✅ <b>উইথড্রয়াল রিকোয়েস্ট সফল!</b>\n\nপরিমাণ: ${amount} BDT\nঅ্যাকাউন্ট: ${wdData.account}`, {parse_mode:'HTML'});
        }
    }
});

// --- ইনলাইন বাটন লজিক ---
bot.on('callback_query', async (q) => {
    const chatId = q.message.chat.id;
    const msgId = q.message.message_id;
    const data = q.data;

    const isMember = await checkMembership(chatId);
    if (!isMember) {
        if (data === 'verify') return bot.answerCallbackQuery(q.id, { text: "❌ আগে জয়েন করুন!", show_alert: true });
        else return bot.answerCallbackQuery(q.id, { text: "❌ আপনি চ্যানেল থেকে লিভ নিয়েছেন!", show_alert: true });
    }

    bot.answerCallbackQuery(q.id).catch(()=>{});

    if (data === 'verify') {
        bot.editMessageText(`✅ <b>Verification Successful!</b>`, { chat_id: chatId, message_id: msgId, parse_mode: 'HTML' }).catch(()=>{});
        bot.sendMessage(chatId, `🟢 <b>Main Menu</b>\n\n⬇️ Please select an option below:`, { parse_mode: 'HTML', ...bottomKeyboard });

        try {
            let uRes = await axios.get(`${FB_URL}/users/${chatId}.json`);
            let currentUser = uRes.data;

            if (currentUser && currentUser.referred_by && currentUser.referred_by !== "none" && !currentUser.referral_rewarded) {
                let refId = currentUser.referred_by;
                let refUserRes = await axios.get(`${FB_URL}/users/${refId}.json`);
                if (refUserRes.data) {
                    let currentBal = Number(refUserRes.data.balance) || 0;
                    let currentRef = Number(refUserRes.data.total_referrals) || 0;
                    await axios.patch(`${FB_URL}/users/${refId}.json`, { balance: currentBal + 0.05, total_referrals: currentRef + 1 });
                    bot.sendMessage(refId, `🎉 <b>নতুন রেফারেল ভেরিফাইড!</b>\nআপনার ব্যালেন্সে <b>0.05 BDT</b> যোগ হয়েছে!`, {parse_mode:'HTML'}).catch(()=>{});
                    await axios.patch(`${FB_URL}/users/${chatId}.json`, { referral_rewarded: true });
                }
            }
        } catch (err) {}
    }

    else if (data === 'clear_history') {
        const res = await axios.get(`${FB_URL}/withdrawals.json`);
        if (res.data) {
            for (let key in res.data) {
                if (res.data[key].user_id == chatId) await axios.delete(`${FB_URL}/withdrawals/${key}.json`);
            }
        }
        bot.editMessageText(`✅ <b>আপনার সকল হিস্ট্রি ডিলিট করা হয়েছে!</b>`, { chat_id: chatId, message_id: msgId, parse_mode: 'HTML' }).catch(()=>{});
    }

    else if (data.startsWith('wd_')) {
        const method = data.split('_')[1];
        userState[chatId] = { step: 'wait_number', method: method };
        bot.sendMessage(chatId, `🟢 <b>${method.toUpperCase()}</b> সিলেক্ট করেছেন।\n১১ ডিজিটের নাম্বার লিখুন:`, {parse_mode:'HTML'});
    }

    else if (data.startsWith('srv_') || data.startsWith('next_')) {
        let srv = data.split('_')[1]; 

        try {
            const res = await axios.get(`${FB_URL}/servers/${encodeURIComponent(srv)}.json`);
            let allNumbers = res.data || [];
            
            if (!Array.isArray(allNumbers)) {
                allNumbers = Object.values(allNumbers).filter(n => n);
            } else {
                allNumbers = allNumbers.filter(n => n);
            }

            if (allNumbers.length === 0) {
                return bot.sendMessage(chatId, "❌ <b>এই কান্ট্রির নাম্বার শেষ!</b>", {parse_mode:'HTML'});
            }

            const batch = allNumbers.splice(0, 3);
            await axios.put(`${FB_URL}/servers/${encodeURIComponent(srv)}.json`, allNumbers);

            // DB তে ইউজারের user-local-storeg আপডেট করা হচ্ছে
            const storegData = { state: 'numbers', srv: srv, numbers: batch, time: Date.now(), lastMessages: {} };
            await axios.put(`${FB_URL}/users/${chatId}/user-local-storeg.json`, storegData);

            let txt = `⚡ <b>NEW NUMBERS (${srv.toUpperCase()})</b>\n\n`;
            let kb = [];
            
            batch.forEach((num) => {
                kb.push([{ text: `📋 ${num}`, copy_text: { text: num } }]);
                activeNumbers[num] = { chatId: chatId, time: Date.now(), lastMessage: "" }; 
            });

            kb.push([{ text: "🌍 Change Country", callback_data: "get_country" }, { text: "OTP GROUP ↗️", url: "https://t.me/earnx_otps" }]);
            kb.push([{ text: "🔄 Change Number", callback_data: `next_${srv}` }]);
            
            txt += "⏳ <i> অটোমেটিক মেসেজ  চেক  করা হচ্ছে.....\n         মেসেজ  আসলে এখানে সাথে সাথে \n                       পেয়ে যাবেন...</i>";
            if (q.data.startsWith('next_') || q.data.startsWith('srv_')) {
                bot.editMessageText(txt, { chat_id: chatId, message_id: msgId, parse_mode: 'HTML', reply_markup: { inline_keyboard: kb } }).catch(()=>{
                    bot.sendMessage(chatId, txt, { parse_mode: 'HTML', reply_markup: { inline_keyboard: kb } });
                });
            }
        } catch (error) {
            console.error("Server Fetch Error");
            bot.sendMessage(chatId, "❌ <b>সার্ভারে সমস্যা হচ্ছে, একটু পর আবার চেষ্টা করুন।</b>", {parse_mode:'HTML'});
        }
    }

    else if (data === 'get_country') {
        // নতুন কান্ট্রি সিলেক্ট করলে DB থেকে স্টেট 'country_list' করে আপডেট করে দেওয়া হলো
        await axios.patch(`${FB_URL}/users/${chatId}.json`, { 'user-local-storeg': { state: 'country_list', time: Date.now() } });

        const res = await axios.get(`${FB_URL}/servers.json`);
        let kb = [];
        for (let s in res.data) kb.push([{ text: ` ${s.toUpperCase()}`, callback_data: `srv_${s}` }]);
        bot.editMessageText("🌐 <b>Select your country: 👇</b>", { chat_id: chatId, message_id: msgId, parse_mode: 'HTML', reply_markup: { inline_keyboard: kb } }).catch(()=>{});
    }
});