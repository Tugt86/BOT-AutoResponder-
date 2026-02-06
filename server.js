const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(express.static('public'));

// مسار البيانات
const DATA_DIR = path.join(__dirname, 'data');
const PLAYERS_FILE = path.join(DATA_DIR, 'players.json');
const MESSAGES_LOG = path.join(DATA_DIR, 'messages_log.json');
const PENDING_REGISTRATIONS = path.join(DATA_DIR, 'pending.json');

// تأكد من وجود مجلد البيانات
(async () => {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(PLAYERS_FILE);
  } catch {
    await fs.writeFile(PLAYERS_FILE, JSON.stringify({}));
  }
  try {
    await fs.access(PENDING_REGISTRATIONS);
  } catch {
    await fs.writeFile(PENDING_REGISTRATIONS, JSON.stringify({}));
  }
  try {
    await fs.access(MESSAGES_LOG);
  } catch {
    await fs.writeFile(MESSAGES_LOG, JSON.stringify([]));
  }
})();

// ====== دوال مساعدة ======

// استخراج اسم المرسل الحقيقي من groupParticipant
function extractRealSender(groupParticipant) {
  if (!groupParticipant) return '';
  const parts = groupParticipant.split(' إلى ');
  if (parts.length > 0) {
    return parts[0].trim().replace(/[\u200E\u200F\u202A-\u202E]/g, '');
  }
  return groupParticipant;
}

// استخراج المملكة من اسم القروب
function extractKingdom(groupName) {
  if (!groupName) return '';
  
  const groupNameClean = groupName.replace(/[\u200E\u200F\u202A-\u202E]/g, '');
  
  if (groupNameClean.includes('FALORYA KINGDOM')) {
    return 'فالوريا';
  } else if (groupNameClean.includes('AZMAR KINGDOM')) {
    return 'ازمار';
  } else if (groupNameClean.includes('DIVALA KINGDOM')) {
    return 'ديفالا';
  }
  return '';
}

// تنظيف النص من المسافات الزائدة
function cleanText(text) {
  return text ? text.trim().replace(/\s+/g, ' ') : '';
}

// ====== دوال الحقيبة ======

// ====== متجر الأغراض ======

const SHOP_ITEMS = {
  'بطاقة تغيير اللقب': {
    price: 50,
    description: 'استعملها لتغيير لقبك (مرة واحدة)',
    type: 'usable'
  },
  'حمامة الرسائل': {
    price: 20,
    description: 'تقوم الحمامة بتوصيل رسائلك لأي لاعب',
    type: 'usable'
  },
  'مسرع الهدية': {
    price: 15,
    description: 'يقوم بتقليل مدة انتظار الهدية الحالية للنصف',
    type: 'usable'
  },
  'بطاقة ازالة انذار': {
    price: 60,
    description: 'يقوم بازالة انذار واحد من ملفك',
    type: 'usable'
  },
  'مضاعف الهدية': {
    price: 30,
    description: 'الهدية التالية التي تحصل عليها ستضاعف ×2 (مرة واحدة)',
    type: 'consumable'
  },
  'مشروب الطاقة': {
    price: 30,
    description: 'يقوم بزيادة نقاط الطاقة للحد الاقصى',
    type: 'usable'
  },
  'عدة العلاج': {
    price: 30,
    description: 'يقوم بزيادة نقاط الحياة ب 20 نقطة',
    type: 'usable'
  },
  'عدة العلاج المطورة': {
    price: 50,
    description: 'يقوم بزيادة نقاط الحياة ب 50 نقطة',
    type: 'usable'
  },
  'عدة العلاج الخارقة': {
    price: 85,
    description: 'يقوم بزيادة نقاط الحياة للحد الاقصى',
    type: 'usable'
  },
  'الخيط السحري': {
    price: 35,
    description: 'يقوم بترقية الحقيبة للمستوى التالي (الحد الأقصى: 10)',
    type: 'usable'
  },
  'شجرة الكوينز': {
    price: 20,
    description: 'اغرس الشجرة لتجنى 40 كوينز بعد ساعة (الحد: 10 أشجار)',
    type: 'consumable'
  },
  'رادار كشف': {
    price: 400,
    description: 'يقوم بكشف الألقاب والرتب لـ3-5 من اعضاء مملكة تحددها',
    type: 'usable'
  }
};

// عرض المتجر
function displayShop() {
  let shopText = `⚐ ═〘 اهلا بك في متجر الاغراض 〙═ ⚐\n`;
  
  for (const [itemName, itemInfo] of Object.entries(SHOP_ITEMS)) {
    shopText += `▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
الغرض : ${itemName}
السعر : ${itemInfo.price}
الكمية : غير محدود
معلومات : ${itemInfo.description}\n`;
  }
  
  shopText += `▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
⬅️ لشراء اي غرض اكتب "شراء (اسم الغرض)"
⬅️ لاستعمال اي غرض اكتب "استعمال (اسم الغرض)"
🔰 ⚐ ═ ⚐ ═〘 ༄ 〙 ═ ⚐ ═ ⚐ 🔰`;
  
  return shopText;
}

// شراء غرض
async function handleBuyItem(player, itemName, players) {
  const itemInfo = SHOP_ITEMS[itemName];
  
  if (!itemInfo) {
    return {
      success: false,
      message: `❌ لا يوجد غرض باسم "${itemName}" في المتجر`
    };
  }
  
  // التحقق من الرصيد
  if (player.coins < itemInfo.price) {
    const needed = itemInfo.price - player.coins;
    return {
      success: false,
      message: `❌ رصيدك غير كافي!
السعر: ${itemInfo.price} كوينز 🪙
رصيدك: ${player.coins} كوينز 🪙
تحتاج: ${needed} كوينز إضافية`
    };
  }
  
  // التحقق من سعة الحقيبة
  const inventory = initializeInventory(player);
  if (!hasSpace(inventory)) {
    return {
      success: false,
      message: `❌ حقيبتك ممتلئة!
السعة: ${inventory.capacity} أغراض
المستخدم: ${inventory.items.length} أغراض
حرر مساحة قبل الشراء`
    };
  }
  
  // إضافة الغرض للحقيبة
  addItem(inventory, itemName);
  player.inventory = inventory;
  player.coins -= itemInfo.price;
  
  // حفظ التغييرات
  players[player.id] = player;
  
  return {
    success: true,
    message: `✅ تم شراء "${itemName}" بنجاح
تم خصم: ${itemInfo.price} كوينز 🪙
الرصيد المتبقي: ${player.coins} كوينز 🪙
تمت الإضافة إلى حقيبتك 🎒`,
    itemName: itemName,
    price: itemInfo.price,
    remainingCoins: player.coins
  };
}

// تأكيد الشراء
function confirmPurchaseMessage(itemName, price, remainingCoins) {
  return `▭▭▭▭▭▭▭▭▭▭▭▭
هل انت متأكد من شراء هاذا الغرض 
الغرض : ${itemName}
السعر : ${price} كوينز 🪙
الكوينز المتبقي بعد الشراء : ${remainingCoins} كوينز 🪙
《تأكيد》▪︎▪︎▪︎▪︎▪︎《الغاء》
▭▭▭▭▭▭▭▭▭▭▭▭`;
}

// تهيئة حقيبة اللاعب
function initializeInventory(player) {
  if (!player.inventory) {
    player.inventory = {
      level: 1,
      capacity: 5,
      items: []
    };
  }
  return player.inventory;
}

// حساب سعة الحقيبة حسب المستوى
function calculateCapacity(level) {
  return level * 5;
}

// تحقق إذا كان هناك مساحة في الحقيبة
function hasSpace(inventory) {
  return inventory.items.length < inventory.capacity;
}

// إضافة غرض للحقيبة
function addItem(inventory, itemName) {
  if (hasSpace(inventory)) {
    inventory.items.push(itemName);
    return true;
  }
  return false;
}

// إزالة غرض من الحقيبة
function removeItem(inventory, itemName) {
  const index = inventory.items.findIndex(item => 
    item.toLowerCase() === itemName.toLowerCase()
  );
  
  if (index !== -1) {
    inventory.items.splice(index, 1);
    return true;
  }
  return false;
}

// التحقق من وجود غرض
function hasItem(inventory, itemName) {
  return inventory.items.some(item => 
    item.toLowerCase() === itemName.toLowerCase()
  );
}

// عرض محتويات الحقيبة
function displayInventory(inventory, playerNickname) {
  let itemsText = '';
  
  if (inventory.items.length === 0) {
    itemsText = 'الحقيبة فارغة 🗃';
  } else {
    itemsText = inventory.items.map(item => `❏ ${item}`).join('\n');
  }
  
  return `════════════════
🎒 حقيبة ${playerNickname}
════════════════
مستوى الحقيبة : ${inventory.level} / قدرة الحمل : ${inventory.capacity} اغراض 
════════════════
${itemsText}
════════════════`;
}

// معالجة أمر "حقيبتي"
function handleMyInventory(player) {
  const inventory = initializeInventory(player);
  return displayInventory(inventory, player.nickname);
}

// معالجة أمر "ارسال الغرض"
async function handleSendItem(player, targetNickname, itemName, players) {
  const inventory = initializeInventory(player);
  
  // التحقق من وجود الغرض
  if (!hasItem(inventory, itemName)) {
    return {
      success: false,
      message: `❌ لا تملك الغرض "${itemName}" في حقيبتك`
    };
  }
  
  // منع إرسال الدروع
  if (itemName.toLowerCase().includes('درع')) {
    return {
      success: false,
      message: '❌ لا يمكن إرسال الدروع بين اللاعبين'
    };
  }
  
  // البحث عن اللاعب المستقبل
  const targetPlayer = await getPlayerByNickname(targetNickname);
  if (!targetPlayer) {
    return {
      success: false,
      message: `❌ لا يوجد لاعب باسم "${targetNickname}"`
    };
  }
  
  // التحقق من عدم الإرسال للنفس
  if (targetPlayer.id === player.id) {
    return {
      success: false,
      message: '❌ لا يمكن إرسال الغرض لنفسك'
    };
  }
  
  const targetInventory = initializeInventory(targetPlayer);
  
  // التحقق من وجود مساحة عند المستقبل
  if (!hasSpace(targetInventory)) {
    return {
      success: false,
      message: `❌ حقيبة ${targetNickname} ممتلئة`
    };
  }
  
  // تنفيذ العملية
  removeItem(inventory, itemName);
  addItem(targetInventory, itemName);
  
  // تحديث بيانات اللاعبين
  player.inventory = inventory;
  targetPlayer.inventory = targetInventory;
  players[player.id] = player;
  players[targetPlayer.id] = targetPlayer;
  
  // إضافة إشعار للمستقبل
  targetPlayer.notifications = targetPlayer.notifications || [];
  targetPlayer.notifications.push({
    message: `🎁 تلقيت غرضاً جديداً!
المرسل: ${player.nickname}
الغرض: ${itemName}
📦 تمت الإضافة إلى حقيبتك`,
    timestamp: new Date().toISOString()
  });
  
  return {
    success: true,
    message: `✅ تم إرسال "${itemName}" إلى ${targetNickname} بنجاح`
  };
}

// معالجة أمر "حذف الغرض"
function handleDeleteItem(player, itemName) {
  const inventory = initializeInventory(player);
  
  if (!hasItem(inventory, itemName)) {
    return {
      success: false,
      message: `❌ لا تملك الغرض "${itemName}" في حقيبتك`
    };
  }
  
  removeItem(inventory, itemName);
  player.inventory = inventory;
  
  return {
    success: true,
    message: `🗑 تم حذف "${itemName}" من حقيبتك`
  };
}

// تحويل التاريخ إلى "قبل ..."
function timeAgo(timestamp) {
  const now = new Date();
  const past = new Date(timestamp);
  const diffMs = now - past;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) {
    return `قبل ${diffMins} دقيقة`;
  } else if (diffHours < 24) {
    return `قبل ${diffHours} ساعة`;
  } else {
    return `قبل ${diffDays} يوم`;
  }
}

// توليد بار الحياة والطاقة
function generateBar(value, max = 100) {
  const filledSquares = Math.floor(value / 20);
  const emptySquares = 5 - filledSquares;
  return '■'.repeat(filledSquares) + '□'.repeat(emptySquares);
}

// ====== دوال جديدة للميزات ======

// دالة الهدية
async function handleGiftCommand(playerId, player, players) {
  const now = new Date();
  const lastGift = player.lastGift ? new Date(player.lastGift) : null;
  
  // إذا لم يحصل على هدية من قبل أو مرت ساعة كاملة
  if (!lastGift || (now - lastGift) >= 60 * 60 * 1000) {
    // توليد كوينز عشوائية من 0 إلى 50
    let giftCoins = Math.floor(Math.random() * 51);
    
    // تطبيق مضاعف الهدية إذا كان مفعّلاً
    const multiplier = player.giftMultiplier || 1;
    giftCoins *= multiplier;
    player.giftMultiplier = 1; // إعادة الضبط لـ 1
    
    // تحديث بيانات اللاعب
    player.coins += giftCoins;
    player.lastGift = now.toISOString();
    
    // حفظ التغييرات في قاعدة البيانات
    players[playerId] = player;
    await savePlayers(players);
    
    return {
      success: true,
      message: `      🎁 مبروك! لقد حصلت على هدية!
════════════════
💰 ربحت: ${giftCoins} كوينز 🪙✨️

💰 رصيدك الحالي: ${player.coins} كوينز 🪙
════════════════
📝 يمكنك طلب هدية أخرى بعد ساعة واحدة
════════════════`
    };
  } else {
    // حساب الوقت المتبقي
    const nextGiftTime = new Date(lastGift.getTime() + 60 * 60 * 1000);
    const timeLeft = Math.ceil((nextGiftTime - now) / 60000); // بالدقائق
    
    let timeText;
    if (timeLeft < 60) {
      timeText = `${timeLeft} دقيقة`;
    } else {
      const hours = Math.floor(timeLeft / 60);
      const minutes = timeLeft % 60;
      timeText = `${hours} ساعة و ${minutes} دقيقة`;
    }
    
    return {
      success: false,
      message: `🎁 🔐 ═ ═ ═  ‏🎁  ═ ═ ═🔐 🎁 

  قد طلبت الهدية قبل اقل من ساعة ❌️⏰️
  يمكنك فتح الهدية القادمة بعد ${timeText}      

🎁 🔐 ═ ═ ═  ‏🎁  ═ ═ ═🔐 🎁`
    };
  }
}

// دالة التحويل
async function handleTransferCommand(playerId, player, message, players) {
  // تحليل الأمر: "تحويل 100 كوينز الى لقب"
  const parts = message.split(' ');
  
  // التحقق من صيغة الأمر
  if (parts.length < 5) {
    return {
      success: false,
      message: `❌️ صيغة الأمر غير صحيحة
استعمل: تحويل <عدد> كوينز الى <لقب>`
    };
  }
  
  // استخراج العدد واللقب
  let amount;
  try {
    amount = parseInt(parts[1]);
  } catch {
    return {
      success: false,
      message: '❌️ ادخل عدد صحيح ✅️'
    };
  }
  
  // التحقق من العدد
  if (isNaN(amount) || amount <= 0) {
    return {
      success: false,
      message: '❌️ ادخل عدد صحيح ✅️'
    };
  }
  
  if (amount > 1000000) { // حد أقصى
    return {
      success: false,
      message: '❌️ الحد الأقصى للتحويل هو 1,000,000 كوينز'
    };
  }
  
  // العثور على لقب المستقبل (كل الكلمات بعد "الى")
  const toIndex = parts.indexOf('الى');
  if (toIndex === -1) {
    return {
      success: false,
      message: '❌️ استعمل: تحويل <عدد> كوينز الى <لقب>'
    };
  }
  
  const targetNickname = parts.slice(toIndex + 1).join(' ');
  
  // التحقق من أن اللاعب لا يحول لنفسه
  if (targetNickname.toLowerCase() === player.nickname.toLowerCase()) {
    return {
      success: false,
      message: '⚠️ لايمكنك تحويل الكوينز لنفسك'
    };
  }
  
  // العثور على اللاعب المستقبل
  const targetPlayer = await getPlayerByNickname(targetNickname);
  if (!targetPlayer) {
    return {
      success: false,
      message: `❌️ لايوجد لاعب بهاذا اللقب ❌️

⚠️ تأكد من كتابة اللقب بشكل صحيح ⚠️`
    };
  }
  
  // التحقق من رصيد اللاعب
  if (player.coins < amount) {
    return {
      success: false,
      message: `📤 انت لاتملك كوينز كافي لاتمام عملية التحويل 
❌️يافقير 🙁🫵`
    };
  }
  
  // حفظ عملية التحويل المؤقتة
  const pending = await loadPending();
  pending[playerId] = {
    ...(pending[playerId] || {}),
    transfer: {
      amount: amount,
      targetId: targetPlayer.id,
      targetNickname: targetPlayer.nickname,
      timestamp: new Date().toISOString()
    }
  };
  await savePending(pending);
  
  // حساب الرصيد المتبقي
  const remainingCoins = player.coins - amount;
  
  return {
    success: true,
    needsConfirmation: true,
    message: `🪙📤 ═ ═ ═  🔰  ═ ═ ═ 📤🪙

هل انت متأكد من  عملية التحويل ⚠️
الكوينز المحول  💰   : ${amount}
اللاعب المستلم  👤  : ${targetPlayer.nickname}
الكوينز المتبقي عندك : ${remainingCoins}

لتأكيد العملية اكتب 《تأكيد》
لالغاء العملية اكتب  《 الغاء 》

🪙📤 ═ ═ ═  🔰  ═ ═ ═ 📤🪙`
  };
}

// تأكيد عملية التحويل
async function confirmTransfer(playerId) {
  const pending = await loadPending();
  const transferData = pending[playerId]?.transfer;
  
  if (!transferData) {
    return { success: false, message: '❌️ لا توجد عملية تحويل قيد الانتظار' };
  }
  
  // تنفيذ التحويل
  const playersData = await loadPlayers();
  const currentPlayer = playersData[playerId];
  const targetPlayer = playersData[transferData.targetId];
  
  if (!currentPlayer || !targetPlayer) {
    delete pending[playerId].transfer;
    await savePending(pending);
    return { success: false, message: '❌ خطأ في تحميل بيانات اللاعبين' };
  }
  
  // التحقق من الرصيد مرة أخرى
  if (currentPlayer.coins < transferData.amount) {
    delete pending[playerId].transfer;
    await savePending(pending);
    return { success: false, message: '❌️ لم يعد لديك رصيد كافي' };
  }
  
  currentPlayer.coins -= transferData.amount;
  targetPlayer.coins += transferData.amount;
  
  // إضافة إشعار للمستلم
  targetPlayer.notifications = targetPlayer.notifications || [];
  targetPlayer.notifications.push({
    message: `💰 تلقيت تحويل كوينز!
المُرسل: ${currentPlayer.nickname}
المبلغ: ${transferData.amount} كوينز 🪙
الرصيد الحالي: ${targetPlayer.coins} كوينز`,
    timestamp: new Date().toISOString()
  });
  
  // إضافة إشعار للمرسل
  currentPlayer.notifications = currentPlayer.notifications || [];
  currentPlayer.notifications.push({
    message: `✅ تم تحويل ${transferData.amount} كوينز إلى ${targetPlayer.nickname}
الرصيد المتبقي: ${currentPlayer.coins} كوينز 🪙`,
    timestamp: new Date().toISOString()
  });
  
  // حفظ التغييرات
  await savePlayers(playersData);
  
  // تنظيف بيانات التحويل المؤقتة
  delete pending[playerId].transfer;
  await savePending(pending);
  
  return {
    success: true,
    message: `✅ تم تحويل ${transferData.amount} كوينز بنجاح إلى ${targetPlayer.nickname}`
  };
}

// إلغاء عملية التحويل
async function cancelTransfer(playerId) {
  const pending = await loadPending();
  if (pending[playerId]) {
    delete pending[playerId].transfer;
  }
  await savePending(pending);
  
  return {
    success: true,
    message: '❌ تم إلغاء عملية التحويل'
  };
}

// استعمال الأغراض
async function handleUseItem(player, itemName, players) {
  const inventory = initializeInventory(player);
  
  // التحقق من وجود الغرض
  if (!hasItem(inventory, itemName)) {
    return {
      success: false,
      message: `❌ لا تملك "${itemName}" في حقيبتك`
    };
  }
  
  const itemInfo = SHOP_ITEMS[itemName];
  if (!itemInfo) {
    return {
      success: false,
      message: `❌ "${itemName}" ليس غرضاً صالحاً للاستعمال`
    };
  }
  
  let result;
  
  // استدعاء الدالة المناسبة حسب نوع الغرض
  switch (itemName) {
    case 'بطاقة تغيير اللقب':
      result = await handleChangeNickname(player, players);
      break;
    case 'حمامة الرسائل':
      result = await handleSendPigeonMessage(player, players);
      break;
    case 'مسرع الهدية':
      result = await handleGiftAccelerator(player, players);
      break;
    case 'بطاقة ازالة انذار':
      result = await handleRemoveWarning(player, players);
      break;
    case 'مضاعف الهدية':
      result = await handleGiftMultiplier(player);
      break;
    case 'مشروب الطاقة':
      result = await handleEnergyDrink(player, players);
      break;
    case 'عدة العلاج':
      result = await handleHealKit(player, 20);
      break;
    case 'عدة العلاج المطورة':
      result = await handleHealKit(player, 50);
      break;
    case 'عدة العلاج الخارقة':
      result = await handleHealKit(player, 100 - player.health);
      break;
    case 'الخيط السحري':
      result = await handleUpgradeBag(player, players);
      break;
    case 'شجرة الكوينز':
      result = await handleCoinTree(player, players);
      break;
    case 'رادار كشف':
      result = await handleRadarScan(player, players);
      break;
    default:
      return {
        success: false,
        message: '❌ لا يمكن استعمال هذا الغرض'
      };
  }
  
  if (result.success) {
    // إزالة الغرض من الحقيبة
    removeItem(inventory, itemName);
    player.inventory = inventory;
    
    // حفظ التغييرات
    players[player.id] = player;
    await savePlayers(players);
  } else if (result.returnItem) {
    // إرجاع الغرض للحقيبة
    return {
      replies: [{ message: result.message }]
    };
  }
  
  return result;
}

// تغيير اللقب
async function handleChangeNickname(player, players) {
  return {
    success: true,
    needsInput: true,
    inputType: 'new_nickname',
    message: `🔄 بطاقة تغيير اللقب
════════════════
لقبك الحالي: ${player.nickname}
════════════════
⦿ رجائا ارسل لقبك الجديد ⏎`
  };
}

// إرسال رسالة بالحمامة
async function handleSendPigeonMessage(player, players) {
  return {
    success: true,
    needsInput: true,
    inputType: 'pigeon_target',
    message: `🐦 حمامة الرسائل
════════════════
أرسل حمامتك لتوصيل رسالة
════════════════
⦿ اكتب لقب اللاعب المرسل إليه ⏎`
  };
}

// مسرع الهدية
async function handleGiftAccelerator(player, players) {
  if (!player.lastGift) {
    return {
      success: true,
      message: `⚡ مسرع الهدية
════════════════
✅ يمكنك طلب هدية الآن!
المسرّع سيبقى محفوظاً لحين الحاجة`
    };
  }
  
  const lastGift = new Date(player.lastGift);
  const nextGift = new Date(lastGift.getTime() + 60 * 60 * 1000);
  const now = new Date();
  
  if (now >= nextGift) {
    return {
      success: true,
      message: `⚡ مسرع الهدية
════════════════
✅ يمكنك طلب هدية الآن!
المسرّع سيبقى محفوظاً لحين الحاجة`
    };
  }
  
  // حساب المدة المتبقية
  const remainingMs = nextGift - now;
  const remainingMins = Math.ceil(remainingMs / 60000);
  const acceleratedMins = Math.ceil(remainingMins / 2);
  
  // تحديث وقت الهدية إلى وقت أقرب
  const acceleratedTime = new Date(now.getTime() + acceleratedMins * 60000);
  player.lastGift = acceleratedTime.toISOString();
  players[player.id] = player;
  await savePlayers(players);
  
  return {
    success: true,
    message: `⚡ مسرع الهدية
════════════════
✅ تم تفعيل مسرع الهدية!
الانتظار الأصلي: ${remainingMins} دقيقة
الانتظار الجديد: ${acceleratedMins} دقيقة
تم تقليل المدة للنصف!`
  };
}

// إزالة إنذار
async function handleRemoveWarning(player, players) {
  if (player.warnings <= 0) {
    // إرجاع الغرض للحقيبة
    return {
      success: false,
      returnItem: true,
      message: `✅ بطاقة ازالة انذار
════════════════
❌ ليس لديك أي إنذارات لإزالتها
تم إرجاع الغرض إلى حقيبتك`
    };
  }
  
  player.warnings -= 1;
  players[player.id] = player;
  await savePlayers(players);
  
  return {
    success: true,
    message: `✅ بطاقة ازالة انذار
════════════════
✔ تم ازالة إنذار واحد
الإنذارات المتبقية: ${player.warnings}`
  };
}

// مضاعف الهدية
async function handleGiftMultiplier(player) {
  player.giftMultiplier = true;
  players[player.id] = player;
  await savePlayers(players);
  
  return {
    success: true,
    message: `✨ مضاعف الهدية
════════════════
✅ تم تفعيل مضاعف الهدية!
الهدية التالية ستكون مضاعفة ×2`
  };
}

// مشروب الطاقة
async function handleEnergyDrink(player, players) {
  if (player.energy >= 100) {
    // إرجاع الغرض للحقيبة
    return {
      success: false,
      returnItem: true,
      message: `⚡ مشروب الطاقة
════════════════
❌ لا تحتاج إلى مشروب الطاقة
نقاط الطاقة ممتلئة: 100/100
تم إرجاع الغرض إلى حقيبتك`
    };
  }
  
  const oldEnergy = player.energy;
  player.energy = 100;
  players[player.id] = player;
  await savePlayers(players);
  
  return {
    success: true,
    message: `⚡ مشروب الطاقة
════════════════
✅ تم تعبئة الطاقة!
من: ${oldEnergy} نقطة
إلى: 100 نقطة
+${100 - oldEnergy} نقطة جديدة`
  };
}

// عدة العلاج
async function handleHealKit(player, amount, players) {
  if (player.health >= 100) {
    // إرجاع الغرض للحقيبة
    return {
      success: false,
      returnItem: true,
      message: `💊 عدة العلاج
════════════════
❌ لا تحتاج إلى علاج
نقاط الحياة ممتلئة: 100/100
تم إرجاع الغرض إلى حقيبتك`
    };
  }
  
  const oldHealth = player.health;
  player.health = Math.min(100, player.health + amount);
  const healed = player.health - oldHealth;
  players[player.id] = player;
  await savePlayers(players);
  
  return {
    success: true,
    message: `💊 عدة العلاج
════════════════
✅ تم العلاج بنجاح!
من: ${oldHealth} نقطة
إلى: ${player.health} نقطة
+${healed} نقطة حياة جديدة`
  };
}

// ترقية الحقيبة
async function handleUpgradeBag(player, players) {
  const inventory = initializeInventory(player);
  
  // التحقق من الحد الأقصى للمستوى
  if (inventory.level >= 10) {
    // إرجاع الغرض للحقيبة
    return {
      success: false,
      returnItem: true,
      message: `🧵 الخيط السحري
════════════════
❌ الحقيبة بالفعل في أقصى مستوى (10)
السعة القصوى: 50 أغراض
تم إرجاع الغرض إلى حقيبتك`
    };
  }
  
  inventory.level += 1;
  inventory.capacity = calculateCapacity(inventory.level);
  players[player.id] = player;
  await savePlayers(players);
  
  return {
    success: true,
    message: `🧵 الخيط السحري
════════════════
✨ تم ترقية حقيبتك!
المستوى الجديد: ${inventory.level}/10
السعة الجديدة: ${inventory.capacity} أغراض
+5 سعة إضافية`
  };
}

// شجرة الكوينز
async function handleCoinTree(player, players) {
  // التحقق من عدد الأشجار المزروعة
  const activeTrees = (player.coinTrees || []).filter(tree => new Date(tree.harvestTime) > new Date()).length;
  
  if (activeTrees >= 10) {
    return {
      success: false,
      message: `🌳 شجرة الكوينز
════════════════
❌ لديك بالفعل 10 أشجار مزروعة (الحد الأقصى)
يمكنك زراعة شجرة جديدة بعد حصاد إحداها`
    };
  }
  
  const harvestTime = new Date(Date.now() + 60 * 60 * 1000);
  const treeId = Math.random().toString(36).substr(2, 9); // معرف فريد للشجرة
  
  player.coinTrees = player.coinTrees || [];
  player.coinTrees.push({
    id: treeId,
    plantTime: new Date().toISOString(),
    harvestTime: harvestTime.toISOString()
  });
  players[player.id] = player;
  await savePlayers(players);
  
  return {
    success: true,
    message: `🌳 شجرة الكوينز
════════════════
✅ تم زرع شجرة الكوينز رقم ${activeTrees + 1}!
ستحصد 40 كوينز بعد ساعة
وقت الحصاد: ${harvestTime.toLocaleTimeString()}
الأشجار النشطة: ${activeTrees + 1}/10`
  };
}

// رادار الكشف
async function handleRadarScan(player, players) {
  // إرسال قائمة ممالك للاختيار
  const kingdoms = ['فالوريا', 'ازمار', 'ديفالا'];
  const otherKingdoms = kingdoms.filter(k => k !== player.kingdom);
  
  let kingdomList = `📡 رادار كشف
════════════════
اختر المملكة التي تريد كشفها:
════════════════\n`;
  
  otherKingdoms.forEach((kingdom, index) => {
    kingdomList += `${index + 1}. ${kingdom}\n`;
  });
  
  kingdomList += `════════════════
اكتب رقم المملكة (1-${otherKingdoms.length})`;
  
  // تخزين حالة الاستخدام المؤقتة
  return {
    success: true,
    needsInput: true,
    inputType: 'radar_kingdom_selection',
    kingdomList: otherKingdoms,
    message: kingdomList
  };
}

// ====== إدارة البيانات ======

async function loadPlayers() {
  const data = await fs.readFile(PLAYERS_FILE, 'utf8');
  return JSON.parse(data);
}

async function savePlayers(players) {
  await fs.writeFile(PLAYERS_FILE, JSON.stringify(players, null, 2));
}

async function loadPending() {
  const data = await fs.readFile(PENDING_REGISTRATIONS, 'utf8');
  return JSON.parse(data);
}

async function savePending(pending) {
  await fs.writeFile(PENDING_REGISTRATIONS, JSON.stringify(pending, null, 2));
}

async function logMessage(messageData) {
  const logs = JSON.parse(await fs.readFile(MESSAGES_LOG, 'utf8'));
  logs.push({
    timestamp: new Date().toISOString(),
    ...messageData
  });
  
  // حذف الرسائل القديمة (أكثر من 20 يوم)
  const twentyDaysAgo = new Date();
  twentyDaysAgo.setDate(twentyDaysAgo.getDate() - 20);
  
  const filteredLogs = logs.filter(log => new Date(log.timestamp) > twentyDaysAgo);
  
  await fs.writeFile(MESSAGES_LOG, JSON.stringify(filteredLogs, null, 2));
}

// ====== دوال التسجيل ======

async function isPlayerRegistered(senderId) {
  const players = await loadPlayers();
  return players[senderId] !== undefined;
}

async function getPlayerByNickname(nickname) {
  const players = await loadPlayers();
  nickname = cleanText(nickname).toLowerCase();
  
  for (const playerId in players) {
    if (players[playerId].nickname.toLowerCase() === nickname) {
      return players[playerId];
    }
  }
  return null;
}

// ====== معالجة الويب هوك ======

app.post('/webhook', async (req, res) => {
  try {
    const { query } = req.body;
    
    // تسجيل الرسالة
    await logMessage({
      sender: query.sender,
      message: query.message,
      isGroup: query.isGroup,
      groupParticipant: query.groupParticipant,
      ruleId: query.ruleId
    });
    
    // استخراج البيانات
    const isGroup = query.isGroup || false;
    let realSender = query.sender;
    
    if (isGroup && query.groupParticipant) {
      realSender = extractRealSender(query.groupParticipant);
    }
    
    const kingdom = extractKingdom(query.sender);
    const message = cleanText(query.message);
    
    // إذا كانت رسالة تجريبية، تجاهلها
    if (query.isTestMessage) {
      return res.json({ replies: [] });
    }
    
    // تحقق مما إذا كان اللاعب مسجلاً
    const playerId = realSender;
    const isRegistered = await isPlayerRegistered(playerId);
    
    let response = { replies: [] };
    
    // تأكد من تحديث البيانات في كل خطوة
    const players = await loadPlayers();
    const pending = await loadPending();

    if (!isRegistered) {
      // لاعب غير مسجل
      response = await handleUnregisteredPlayer(playerId, message, kingdom, isGroup, realSender);
    } else {
      // لاعب مسجل
      response = await handleRegisteredPlayer(playerId, message, kingdom, isGroup, realSender, players, pending);

      // === معالجة حالات الانتظار للأغراض ===
      if (pending[playerId] && pending[playerId].itemAction) {
        const state = pending[playerId];
        const p = players[playerId];

        // التحقق من أن الرسالة ليست أمر الاستعمال نفسه
        const isUsageCommand = message.startsWith('استعمال ');

        if (!isUsageCommand) {
          // حالة تغيير اللقب
          if (state.itemAction === 'WAITING_NICKNAME') {
            const isTaken = Object.values(players).some(pl => pl.nickname === message);
            if (isTaken) return res.json({ replies: [{ message: "❌ اللقب محجوز، اختر غيره:" }] });

            p.nickname = message;
            p.inventory.items.splice(state.itemIdx, 1); // حذف البطاقة بعد النجاح فقط
            delete pending[playerId].itemAction;
            delete pending[playerId].itemIdx;
            await savePlayers(players);
            await savePending(pending);
            return res.json({ replies: [{ message: `✅ تم تغيير لقبك إلى: ${message}` }] });
          }

          // حالة اختيار مملكة الرادار
          if (state.itemAction === 'WAITING_RADAR_KING') {
            const kMap = { "1": "فالوريا", "2": "ديفالا", "3": "ازمار" };
            const targetK = kMap[message] || message;
            const targets = Object.values(players).filter(pl => pl.kingdom === targetK && pl.id !== playerId).sort(() => 0.5 - Math.random()).slice(0, 5);

            if (targets.length === 0) {
              delete pending[playerId].itemAction;
              delete pending[playerId].itemIdx;
              await savePending(pending);
              return res.json({ replies: [{ message: `📡 الرادار لم يجد أحداً في مملكة ${targetK}.` }] });
            }

            const list = targets.map(t => `• ${t.nickname} (${t.rank})`).join('\n');
            p.inventory.items.splice(state.itemIdx, 1);
            delete pending[playerId].itemAction;
            delete pending[playerId].itemIdx;
            await savePlayers(players);
            await savePending(pending);
            return res.json({ replies: [{ message: `📡 نتائج الرادار في ${targetK}:\n${list}` }] });
          }
        }
      }
    }

    res.json(response);
    
  } catch (error) {
    console.error('Error:', error);
    res.json({ replies: [] });
  }
});

// ====== معالجة اللاعب غير المسجل ======

async function handleUnregisteredPlayer(playerId, message, kingdom, isGroup, realSender) {
  const pending = await loadPending();
  
  // إذا كان في مجموعة غير تابعة لمملكة معروفة
  if (!kingdom && isGroup) {
    return { replies: [] };
  }
  
  const step = pending[playerId] ? pending[playerId].step : null;

  // إذا كانت أول رسالة له في المملكة
  if (!step) {
    pending[playerId] = {
      kingdom: kingdom,
      step: 'welcome_sent',
      welcomeSent: true
    };
    await savePending(pending);
    
    return {
      replies: [{
        message: `╔══ ❖•ೋ 🌟ೋ•❖ ══╗
⚜️ اهلا بك في مملكة ${kingdom} ⚜️.          
╚══ ❖•ೋ 🌟ೋ•❖ ══╝
⫘⫘⫘⫘⫘⫘⫘⫘⫘⫘⫘
⊹ ﹏𓊝﹏𓂁﹏⊹ ˖⊹ ﹏𓊝﹏𓂁﹏⊹ ˖⊹ ﹏
انضم الى عالم الحروب والصراع الاقتصادي  في نضام صراع الممالك طور رتبتك ، اجمع الكنوز ، تحدى لاعبين اخرين او تحالف معهم ، اقصف وسيطر على الممالك ، احفر اسمك في النضام 🫅
⊹ ﹏𓊝﹏𓂁﹏⊹ ˖⊹ ﹏𓊝﹏𓂁﹏⊹ ˖⊹ ﹏

⫘⫘⫘⫘⫘⫘⫘⫘⫘⫘⫘
════════════════
☠️ اكتب كلمة "تسجيل" وبدأ مغامرتك ☠️
════════════════`
      }]
    };
  }
  
  // إذا كتب "تسجيل"
  if (message.toLowerCase() === 'تسجيل') {
    pending[playerId].step = 'ask_nickname';
    await savePending(pending);
    
    return {
      replies: [{
        message: `🔱 ═〘مرحبا بك ايها المجند 〙═ 🔱  

 〚${realSender}〛              

⦿ رجائا ارسل لقبك ⏎`
      }]
    };
  }
  
  // إذا كان في خطوات التسجيل
  if (step === 'ask_nickname' || step === 'confirm_nickname' || step === 'join_group' || step === 'ask_inviter') {
    return await continueRegistration(playerId, message, kingdom, realSender);
  }

  return { replies: [] };
}

// ====== معالجة اللاعب المسجل ======

async function handleRegisteredPlayer(playerId, message, kingdom, isGroup, realSender, players, pending) {
  const player = players[playerId];
  
  // تحقق إذا كان في مجموعة غير مملكته
  if (isGroup && kingdom && player.kingdom !== kingdom) {
    // إضافة إنذار
    player.warnings = (player.warnings || 0) + 1;
    await savePlayers(players);
    
    return {
      replies: [{
        message: `🚨🚨═ ═《 انذار دخيل》 ═ ═🚨🚨

🛡 تم اكتشاف دخيل من مملكة اخرى 
 اسم الحساب 👤: ${realSender}
اللقب 🆔️ : ${player.nickname}
المملكة🔰 : ${player.kingdom}
🚨🚨═ ═🚨🚨🚨 ═ ═🚨🚨`
      }]
    };
  }
  
  // معالجة الأوامر
  const command = message.toLowerCase();

  // === منطق استعمال الأغراض ===
  if (message.startsWith('استعمال ')) {
    const itemName = message.replace('استعمال ', '').trim();
    const inventory = initializeInventory(player);
    const itemIdx = inventory.items.indexOf(itemName);

    if (itemIdx === -1) return { replies: [{ message: "❌ لا تملك هذا الغرض في حقيبتك." }] };

    // 1. بطاقة تغيير اللقب
    if (itemName === 'بطاقة تغيير اللقب') {
      pending[playerId] = { ...pending[playerId], itemAction: 'WAITING_NICKNAME', itemIdx };
      await savePending(pending);
      return { replies: [{ message: "🔄 جاري التفعيل.. أدخل لقبك الجديد الآن:" }] };
    }

    // 2. مسرع الهدية
    if (itemName === 'مسرع الهدية') {
      if (!player.lastGift) return { replies: [{ message: "❌ لا يوجد توقيت انتظار لتسريعه." }] };
      const waitTime = 3600000;
      const passed = Date.now() - new Date(player.lastGift).getTime();
      const remaining = waitTime - passed;
      if (remaining <= 0) return { replies: [{ message: "❌ الهدية متاحة بالفعل!" }] };

      player.lastGift = new Date(new Date(player.lastGift).getTime() - (remaining / 2)).toISOString();
      player.inventory.items.splice(itemIdx, 1);
      await savePlayers(players);
      return { replies: [{ message: "⚡ تم تسريع الوقت! تحقق من 'هدية' الآن." }] };
    }

    // 3. مضاعف الهدية
    if (itemName === 'مضاعف الهدية') {
      player.giftMultiplier = 2;
      player.inventory.items.splice(itemIdx, 1);
      await savePlayers(players);
      return { replies: [{ message: "✨ تم التفعيل! هديتك القادمة ستكون مضاعفة." }] };
    }

    // 4. رادار كشف
    if (itemName === 'رادار كشف') {
      pending[playerId] = { ...pending[playerId], itemAction: 'WAITING_RADAR_KING', itemIdx };
      await savePending(pending);
      return { replies: [{ message: "📡 اختر المملكة لكشفها:\n1. فالوريا\n2. ديفالا\n3. ازمار\n(اكتب الرقم أو الاسم)" }] };
    }
  }

  // أمر متجر الأغراض
  if (command === 'متجر الاغراض' || command === 'المتجر') {
    const shopText = displayShop();
    return {
      replies: [{ message: shopText }]
    };
  }
  
  // أمر شراء
  if (message.startsWith('شراء')) {
    const itemName = message.replace('شراء', '').trim();
    
    if (!itemName) {
      return {
        replies: [{ message: '❌ الرجاء كتابة اسم الغرض بعد كلمة "شراء"' }]
      };
    }
    
    // البحث عن اسم الغرض (قد يكون مطابقاً جزئياً)
    let exactItemName = null;
    for (const shopItem of Object.keys(SHOP_ITEMS)) {
      if (shopItem.includes(itemName) || itemName.includes(shopItem)) {
        exactItemName = shopItem;
        break;
      }
    }
    
    if (!exactItemName) {
      return {
        replies: [{ message: `❌ لا يوجد غرض باسم "${itemName}" في المتجر` }]
      };
    }
    
    const purchaseResult = await handleBuyItem(player, exactItemName, players);
    
    if (purchaseResult.success) {
      // عرض تأكيد الشراء
      const confirmMsg = confirmPurchaseMessage(
        purchaseResult.itemName,
        purchaseResult.price,
        purchaseResult.remainingCoins
      );
      
      // حفظ بيانات الشراء المؤقتة
      const pendingData = await loadPending();
      pendingData[playerId] = {
        ...(pendingData[playerId] || {}),
        pendingPurchase: {
          itemName: purchaseResult.itemName,
          price: purchaseResult.price
        }
      };
      await savePending(pendingData);
      
      return {
        replies: [{ message: confirmMsg }]
      };
    } else {
      return {
        replies: [{ message: purchaseResult.message }]
      };
    }
  }
  
  // أمر استعمال
  if (message.startsWith('استعمال')) {
    const itemName = message.replace('استعمال', '').trim();
    
    if (!itemName) {
      return {
        replies: [{ message: '❌ الرجاء كتابة اسم الغرض بعد كلمة "استعمال"' }]
      };
    }
    
    const useResult = await handleUseItem(player, itemName, players);
    
    if (useResult.success && useResult.needsInput) {
      // حفظ حالة الاستعمال المؤقتة
      const pendingData = await loadPending();
      pendingData[playerId] = {
        ...(pendingData[playerId] || {}),
        usingItem: {
          itemName: itemName,
          inputType: useResult.inputType,
          kingdomList: useResult.kingdomList
        }
      };
      await savePending(pendingData);
    }
    
    return {
      replies: [{ message: useResult.message }]
    };
  }
  
  // تأكيد أو إلغاء الشراء
  if (command === 'تأكيد' || command === 'الغاء') {
    const pendingData = await loadPending();
    const pendingPurchase = pendingData[playerId]?.pendingPurchase;
    
    if (pendingPurchase) {
      if (command === 'تأكيد') {
        // تنفيذ الشراء النهائي
        const purchaseResult = await handleBuyItem(player, pendingPurchase.itemName, players);
        
        // حفظ التغييرات
        await savePlayers(players);
        
        delete pendingData[playerId].pendingPurchase;
        await savePending(pendingData);
        
        return {
          replies: [{ message: purchaseResult.message }]
        };
      } else if (command === 'الغاء') {
        delete pendingData[playerId].pendingPurchase;
        await savePending(pendingData);
        
        return {
          replies: [{ message: '❌ تم إلغاء عملية الشراء' }]
        };
      }
    }
  }
  
  // أمر حقيبتي
  if (command === 'حقيبتي') {
    const inventoryText = handleMyInventory(player);
    return {
      replies: [{ message: inventoryText }]
    };
  }
  
  // أمر حذف الغرض
  if (message.startsWith('حذف الغرض')) {
    // استخراج اسم الغرض
    const itemName = message.replace('حذف الغرض', '').trim();
    
    if (!itemName) {
      return {
        replies: [{ message: '❌ الرجاء كتابة اسم الغرض المراد حذفه' }]
      };
    }
    
    const result = handleDeleteItem(player, itemName);
    if (result.success) {
      // حفظ التغييرات
      players[playerId] = player;
      await savePlayers(players);
    }
    
    return {
      replies: [{ message: result.message }]
    };
  }
  
  // أمر إرسال الغرض
  if (message.startsWith('ارسال الغرض')) {
    // تحليل الأمر: "ارسال الغرض سيف الى علي"
    const parts = message.split(' ');
    
    if (parts.length < 5) {
      return {
        replies: [{ message: '❌ استعمل: ارسال الغرض <اسم الغرض> الى <لقب اللاعب>' }]
      };
    }
    
    // العثور على "الى"
    const toIndex = parts.indexOf('الى');
    if (toIndex === -1 || toIndex < 2) {
      return {
        replies: [{ message: '❌ استعمل: ارسال الغرض <اسم الغرض> الى <لقب اللاعب>' }]
      };
    }
    
    // استخراج اسم الغرض (كل الكلمات بين "الغرض" و "الى")
    const itemName = parts.slice(2, toIndex).join(' ');
    const targetNickname = parts.slice(toIndex + 1).join(' ');
    
    if (!itemName || !targetNickname) {
      return {
        replies: [{ message: '❌ استعمل: ارسال الغرض <اسم الغرض> الى <لقب اللاعب>' }]
      };
    }
    
    const result = await handleSendItem(player, targetNickname, itemName, players);
    if (result.success) {
      // حفظ التغييرات
      await savePlayers(players);
    }
    
    return {
      replies: [{ message: result.message }]
    };
  }
  
  // معالجة أمر الهدية
  if (command === 'هدية' || command === 'الهدية') {
    const giftResult = await handleGiftCommand(playerId, player, players);
    return {
      replies: [{ message: giftResult.message }]
    };
  }
  
  // أمر الحصاد
  if (command === 'حصاد') {
    const harvestedTrees = [];
    for (let i = 0; i < (player.coinTrees || []).length; i++) {
      const tree = player.coinTrees[i];
      if (new Date(tree.harvestTime) <= new Date()) {
        harvestedTrees.push(tree);
        player.coinTrees.splice(i, 1);
        i--;
      }
    }

    if (harvestedTrees.length > 0) {
      const totalCoins = harvestedTrees.length * 40;
      player.coins += totalCoins;
      players[playerId] = player;
      await savePlayers(players);
      
      let harvestMessage = `🌾 حصاد شجرة الكوينز!
════════════════
تم حصاد ${harvestedTrees.length} شجرة`;
      
      if (harvestedTrees.length > 1) {
        harvestMessage += `ات`;
      }
      
      harvestMessage += `:
💰 +${totalCoins} كوينز 🪙
الرصيد الحالي: ${player.coins} كوينز`;
      
      return {
        replies: [{ message: harvestMessage }]
      };
    } else {
      return {
        replies: [{ message: `🌾 حصاد شجرة الكوينز!
════════════════
❌ لا توجد أشجار جاهزة للحصاد
الأشجار النشطة: ${player.coinTrees ? player.coinTrees.length : 0}/10` }]
      };
    }
  }
  
  // معالجة أمر التحويل
  const pendingTransferCheck = await loadPending();
  const hasPendingTransfer = pendingTransferCheck[playerId]?.transfer;

  if (message.startsWith('تحويل') || (hasPendingTransfer && (command === 'تأكيد' || command === 'الغاء'))) {
    if (hasPendingTransfer && command === 'تأكيد') {
      const result = await confirmTransfer(playerId);
      return {
        replies: [{ message: result.message }]
      };
    }
    
    if (hasPendingTransfer && command === 'الغاء') {
      const result = await cancelTransfer(playerId);
      return {
        replies: [{ message: result.message }]
      };
    }
    
    if (message.startsWith('تحويل')) {
      // عملية تحويل جديدة
      const transferResult = await handleTransferCommand(playerId, player, message, players);
      return {
        replies: [{ message: transferResult.message }]
      };
    }
  }
  
  if (command === 'ملفي') {
    // التحقق من حصاد شجرة الكوينز التلقائي
    const harvestedTrees = [];
    for (let i = 0; i < (player.coinTrees || []).length; i++) {
      const tree = player.coinTrees[i];
      if (new Date(tree.harvestTime) <= new Date()) {
        harvestedTrees.push(tree);
        player.coinTrees.splice(i, 1);
        i--;
      }
    }

    if (harvestedTrees.length > 0) {
      const totalCoins = harvestedTrees.length * 40;
      player.coins += totalCoins;
      
      let harvestMessage = `🌾 حصاد شجرة الكوينز!
════════════════
تم حصاد ${harvestedTrees.length} شجرة`;
      
      if (harvestedTrees.length > 1) {
        harvestMessage += `ات`;
      }
      
      harvestMessage += `:
💰 +${totalCoins} كوينز 🪙
الرصيد الحالي: ${player.coins} كوينز

`;
      
      // إضافة إشعار
      player.notifications = player.notifications || [];
      player.notifications.unshift({
        message: harvestMessage + `\n════════════════`,
        timestamp: new Date().toISOString()
      });
    }
    
    // جلب الإشعارات المعلقة
    const notifications = player.notifications || [];
    let notificationText = '';
    
    if (notifications.length > 0) {
      notificationText = `🔔═🔔اشعارات جديدة 🔔 ═🔔\n`;
      notifications.slice(0, 3).forEach((notif, index) => { // عرض آخر 3 إشعارات فقط
        notificationText += `${notif.message}\n`;
      });
      notificationText += `\n`;
      
      // مسح الإشعارات بعد عرضها
      player.notifications = [];
    }
    
    // حفظ التغييرات
    players[playerId] = player;
    await savePlayers(players);
    
    return {
      replies: [{
        message: `${notificationText}‏❏───━━━࿇━━━───❏
‏- 『 اللقب ⊹』       ⇔   ${player.nickname}
‏- 『المملكة 𖠿』     ⇔   ${player.kingdom}
‏- 『 الرتبة ⚔』    ⇔   ${player.rank}
‏- 『 الانذارات !』   ⇔   ${player.warnings > 0 ? '🔴'.repeat(player.warnings) : 'لايوجد'}
  ░░░░░░░░░░░░░░░
‏- 『 الكوينز ⛃ 』: ${player.coins}
‏- 『 نقاط الحياة』: ${generateBar(player.health)} 》${player.health}
‏- 『 نقاط الطاقة』: ${generateBar(player.energy)} 》${player.energy}
‏- 『 الأشجار 🌳 』: ${player.coinTrees ? player.coinTrees.length : 0}/10
❏───━━━࿇━━━───❏`
      }]
    };
  }
  
  // إذا كان في منتصف عملية التسجيل
  if (pending[playerId]) {
    return await continueRegistration(playerId, message, kingdom, realSender);
  }
  
  // معالجة استخدام الأغراض التي تحتاج مدخلات
  const usingItem = pending[playerId]?.usingItem;
  
  if (usingItem) {
    const player = players[playerId];
    
    if (usingItem.inputType === 'new_nickname') {
      // تغيير اللقب
      const newNickname = cleanText(message);
      
      // التحقق من صحة اللقب الجديد
      if (newNickname.length < 1 || newNickname.length > 50) {
        return {
          replies: [{
            message: `❌ اللقب يجب أن يكون بين 1 و 50 حرفاً
الرجاء إعادة إدخال لقب جديد:`
          }]
        };
      }
      
      // التحقق من التكرار
      const existingPlayer = await getPlayerByNickname(newNickname);
      if (existingPlayer) {
        return {
          replies: [{
            message: `❌ اللقب "${newNickname}" مستعمل من قبل
الرجاء إدخال لقب آخر:`
          }]
        };
      }
      
      // تأكيد تغيير اللقب
      pending[playerId].usingItem.newNickname = newNickname;
      await savePending(pending);
      
      return {
        replies: [{
          message: `🔄 تأكيد تغيير اللقب
════════════════
اللقب الحالي: ${player.nickname}
اللقب الجديد: ${newNickname}
════════════════
هل أنت متأكد؟ اكتب "نعم" للتأكيد أو "لا" للإلغاء`
        }]
      };
    }
    
    if (usingItem.inputType === 'pigeon_target') {
      // إرسال رسالة بالحمامة
      const targetNickname = cleanText(message);
      const targetPlayer = await getPlayerByNickname(targetNickname);
      
      if (!targetPlayer) {
        return {
          replies: [{
            message: `❌ لا يوجد لاعب باسم "${targetNickname}"
الرجاء إدخال لقب لاعب صحيح:`
          }]
        };
      }
      
      if (targetPlayer.id === player.id) {
        return {
          replies: [{
            message: `❌ لا يمكن إرسال رسالة لنفسك
الرجاء إدخال لقب لاعب آخر:`
          }]
        };
      }
      
      pending[playerId].usingItem.targetPlayerId = targetPlayer.id;
      pending[playerId].usingItem.step = 'enter_message';
      await savePending(pending);
      
      return {
        replies: [{
          message: `🐦 إرسال رسالة إلى ${targetNickname}
════════════════
الرجاء كتابة الرسالة التي تريد إرسالها:`
        }]
      };
    }
    
    if (usingItem.inputType === 'radar_kingdom_selection') {
      // اختيار المملكة للرادار
      const selectedIndex = parseInt(message) - 1;
      const selectedKingdom = usingItem.kingdomList[selectedIndex];
      
      if (isNaN(selectedIndex) || selectedIndex < 0 || selectedIndex >= usingItem.kingdomList.length) {
        return {
          replies: [{
            message: `📡 رادار كشف
════════════════
❌ اختيار غير صحيح
الرجاء إدخال رقم صحيح (1-${usingItem.kingdomList.length})`
          }]
        };
      }
      
      // جمع لاعبين من المملكة المختارة
      const otherKingdomsPlayers = [];
      for (const pId in players) {
        if (pId !== player.id && players[pId].kingdom === selectedKingdom) {
          otherKingdomsPlayers.push(players[pId]);
        }
      }
      
      // اختيار 3-5 لاعبين عشوائيًا
      const selectedCount = Math.min(5, Math.max(3, otherKingdomsPlayers.length));
      const selectedPlayers = [];
      
      for (let i = 0; i < selectedCount && otherKingdomsPlayers.length > 0; i++) {
        const randomIndex = Math.floor(Math.random() * otherKingdomsPlayers.length);
        selectedPlayers.push(otherKingdomsPlayers.splice(randomIndex, 1)[0]);
      }
      
      // تنظيف البيانات المؤقتة
      delete pending[playerId].usingItem;
      await savePending(pending);
      
      if (selectedPlayers.length === 0) {
        return {
          replies: [{
            message: `📡 رادار كشف
════════════════
❌ لم يتم العثور على لاعبين في مملكة ${selectedKingdom}`
          }]
        };
      }
      
      let resultText = `📡 رادار كشف
════════════════
تم كشف ${selectedPlayers.length} من لاعبي مملكة ${selectedKingdom}:
════════════════\n`;
      
      selectedPlayers.forEach((p, index) => {
        resultText += `👤 اللاعب ${index + 1}:
اللقب: ${p.nickname}
الرتبة: ${p.rank}
════════════════\n`;
      });
      
      return {
        replies: [{ message: resultText }]
      };
    }
    
    if (usingItem.step === 'enter_message') {
      // إكمال إرسال الرسالة
      const messageText = cleanText(message);
      const targetPlayer = players[pending[playerId].usingItem.targetPlayerId];
      
      if (targetPlayer) {
        // إضافة إشعار للمستقبل
        targetPlayer.notifications = targetPlayer.notifications || [];
        targetPlayer.notifications.unshift({
          message: `✉️ حمامة رسالة جديدة!
════════════════
المرسل: ${player.nickname}
المملكة: ${player.kingdom}
الرتبة: ${player.rank}
════════════════
الرسالة: ${messageText}
════════════════
🐦 وصلت الحمامة برسالتك`,
          timestamp: new Date().toISOString()
        });
        
        // حفظ التغييرات
        players[targetPlayer.id] = targetPlayer;
        await savePlayers(players);
      }
      
      // تنظيف البيانات المؤقتة
      delete pending[playerId].usingItem;
      await savePending(pending);
      
      return {
        replies: [{
          message: `✅ تم إرسال الرسالة بنجاح!
════════════════
إلى: ${targetPlayer?.nickname || 'لاعب'}
الرسالة: ${messageText}
════════════════
🐦 وصلت الحمامة وجهتها`
        }]
      };
    }
  }
  
  return { replies: [] };
}

// ====== متابعة التسجيل ======

async function continueRegistration(playerId, message, kingdom, realSender) {
  const pending = await loadPending();
  const players = await loadPlayers();
  const step = pending[playerId]?.step;

  // تأكيد تغيير اللقب
  if (message.toLowerCase().includes('نعم') && pending[playerId]?.usingItem?.newNickname) {
    const player = players[playerId];
    const newNickname = pending[playerId].usingItem.newNickname;
    
    // تغيير اللقب
    player.nickname = newNickname;
    players[playerId] = player;
    await savePlayers(players);
    
    // تنظيف البيانات المؤقتة
    delete pending[playerId].usingItem;
    await savePending(pending);
    
    return {
      replies: [{
        message: `✅ تم تغيير اللقب بنجاح!
════════════════
اللقب الجديد: ${newNickname}
تم تحديث ملفك الشخصي`
      }]
    };
  }
  
  if (message.toLowerCase().includes('لا') && pending[playerId]?.usingItem?.newNickname) {
    // إلغاء تغيير اللقب
    delete pending[playerId].usingItem;
    await savePending(pending);
    
    return {
      replies: [{
        message: '❌ تم إلغاء تغيير اللقب'
      }]
    };
  }

  if (step === 'ask_nickname') {
    const nickname = cleanText(message);
    
    // التحقق من الطول
    if (nickname.length > 50) {
      return {
        replies: [{
          message: `🔱 ═〘مرحبا بك ايها المجند 〙═ 🔱  

 〚${realSender}〛             
 
❌️ يجب الا يكون  اللقب  اكبر من 50 حرفا 
⬅️ رجائا ارسل لقبا مناسبا`
        }]
      };
    }
    
    if (nickname.length < 1) {
      return {
        replies: [{
          message: `🔱 ═〘مرحبا بك ايها المجند 〙═ 🔱  

 〚${realSender}〛              




❌️ يجب الا يكون اللقب اقل من حرف واحد 
⬅️ رجائا ارسل لقبا مناسبا`
        }]
      };
    }
    
    // التحقق من التكرار
    const existingPlayer = await getPlayerByNickname(nickname);
    if (existingPlayer) {
      return {
        replies: [{
          message: `🔱 ═〘مرحبا بك ايها المجند 〙═ 🔱  

 〚${realSender}〛              


❌️ استعمل لاعب اخر هاذا اللقب 
⬅️ رجائا ارسل لقبا مناسبا`
        }]
      };
    }
    
    // حفظ اللقب مؤقتاً
    pending[playerId].nickname = nickname;
    pending[playerId].step = 'confirm_nickname';
    await savePending(pending);
    
    return {
      replies: [{
        message: `⎙ هل انت متأكد من استعمال هاذا اللقب ؟

✎ اكتب 《 نعم 》 للتأكيد.      🟢
✎ اكتب 《 تعديل 》 لتعديله   🔴`
      }]
    };
  }
  
  if (step === 'confirm_nickname') {
    const response = message.toLowerCase();
    
    if (response.includes('تعديل')) {
      pending[playerId].step = 'ask_nickname';
      await savePending(pending);
      
      return {
        replies: [{
          message: `🔱 ═〘مرحبا بك ايها المجند 〙═ 🔱  

 〚${realSender}〛              

⦿ رجائا ارسل لقبك ⏎`
        }]
      };
    }
    
    if (response.includes('نعم')) {
      pending[playerId].step = 'join_group';
      await savePending(pending);
      
      return {
        replies: [{
          message: `حسنا يا ${pending[playerId].nickname} رجائا انضم الى المجموعة الرسمية للنضام ستحتاجها لاحقا 🌐
https://facebook.com/groups/1970196400432434/
⌖ بعد الانضمام اكتب 《 تم 》𓊝`
        }]
      };
    }
    
    // إذا كان الرد غير متوقع، نعيد الطلب
    return {
      replies: [{
        message: `⎙ هل انت متأكد من استعمال هاذا اللقب ؟

✎ اكتب 《 نعم 》 للتأكيد.      🟢
✎ اكتب 《 تعديل 》 لتعديله   🔴`
      }]
    };
  }
  
  if (step === 'join_group') {
    if (message.toLowerCase().includes('تم')) {
      pending[playerId].step = 'ask_inviter';
      await savePending(pending);
      
      return {
        replies: [{
          message: `⏎ 👥️ 》 اذا كان هناك شخص دعاك للمملكة اكتب لقبه 
⏎ 👤 》لتخطي هذه المرحلة اكتب《 تخطي 》`
        }]
      };
    }
    
    // إعادة الطلب إذا لم يكن "تم"
    return {
      replies: [{
        message: `حسنا يا ${pending[playerId].nickname} رجائا انضم الى المجموعة الرسمية للنضام ستحتاجها لاحقا 🌐
https://facebook.com/groups/1970196400432434/
⌖ بعد الانضمام اكتب 《 تم 》𓊝`
      }]
    };
  }
  
  if (step === 'ask_inviter') {
    if (message.toLowerCase().includes('تخطي')) {
      // إكمال التسجيل بدون مدعٍ
      await completeRegistration(playerId, null);
      delete pending[playerId];
      await savePending(pending);
      
      return {
        replies: [{
          message: `تم تسجيلك بنجاح ✅️

⚜️ مملكة ${kingdom} ترحب بك  ⚜️

▪︎ ¤ 》اكتب 《 ملفي 》 لعرض ملفك`
        }]
      };
    }
    
    // البحث عن المدعو
    const inviter = await getPlayerByNickname(message);
    if (!inviter) {
      return {
        replies: [{
          message: `❌ اللقب غير موجود
⏎ 👥️ 》 اذا كان هناك شخص دعاك للمملكة اكتب لقبه 
⏎ 👤 》لتخطي هذه المرحلة اكتب《 تخطي 》`
        }]
      };
    }
    
    // تحقق إذا كان المدعو في نفس المملكة
    if (inviter.kingdom !== kingdom) {
      return {
        replies: [{
          message: `❌ اللاعب ليس في نفس مملكتك
⏎ 👥️ 》 اذا كان هناك شخص دعاك للمملكة اكتب لقبه 
⏎ 👤 》لتخطي هذه المرحلة اكتب《 تخطي 》`
        }]
      };
    }
    
    // إكمال التسجيل مع المدعو
    const playerNickname = pending[playerId].nickname;
    await completeRegistration(playerId, inviter);
    delete pending[playerId];
    await savePending(pending);
    
    // إرسال إشعار للمدعو
    const currentPlayers = await loadPlayers();
    const inviterPlayer = currentPlayers[inviter.id];
    if (inviterPlayer) {
      inviterPlayer.coins += 50;
      inviterPlayer.notifications = inviterPlayer.notifications || [];
      inviterPlayer.notifications.unshift({
        message: `لقد دعوت لاعبا جديدا 👤+ ✨️
اللقب : ${playerNickname}
${timeAgo(new Date())}
🟢 تم اضافة 50 كوينز  الى الرصيد  🪙`,
        timestamp: new Date().toISOString()
      });
      await savePlayers(currentPlayers);
    }
    
    return {
      replies: [{
        message: `تم تسجيلك بنجاح ✅️

⚜️ مملكة ${kingdom} ترحب بك  ⚜️

▪︎ ¤ 》اكتب 《 ملفي 》 لعرض ملفك 

▪︎ 👥️ + 》 حصل اللاعب 〘 ${inviter.nickname} 〙 على كوينز لدعوتك`
      }]
    };
  }
  
  return { replies: [] };
}

async function completeRegistration(playerId, inviter) {
  const pending = await loadPending();
  const players = await loadPlayers();
  
  const playerData = pending[playerId];
  
  players[playerId] = {
    id: playerId,
    nickname: playerData.nickname,
    kingdom: playerData.kingdom,
    rank: 'مجند',
    coins: 20, // الرصيد الابتدائي
    health: 100,
    energy: 100,
    warnings: 0,
    notifications: [],
    registeredAt: new Date().toISOString(),
    inviter: inviter ? inviter.id : null,
    lastGift: null,
    giftMultiplier: false, // إضافة حقل مضاعف الهدية
    coinTrees: [], // إضافة مصفوفة لتتبع الأشجار المزروعة
    inventory: {
      level: 1,
      capacity: 5,
      items: []
    }
  };
  
  await savePlayers(players);
}

// ====== نقطة فحص الصحة ======

app.get('/health', (req, res) => {
  res.json({ 
    status: 'online',
    timestamp: new Date().toISOString()
  });
});

// ====== تشغيل السيرفر ======

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔗 Webhook URL: http://localhost:${PORT}/webhook`);
});
