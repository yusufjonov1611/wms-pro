const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');
const { Telegraf } = require('telegraf');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'wms.db');

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// ==================== MA'LUMOTLAR BAZASI (SQLite) ====================
const db = new DatabaseSync(DB_FILE);

// Jadval va indekslarni yaratish
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    fullName TEXT NOT NULL,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL,
    warehouse TEXT,
    status TEXT DEFAULT 'active'
  );

  CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    code TEXT,
    description TEXT,
    color TEXT,
    icon TEXT
  );

  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    unit TEXT DEFAULT 'dona',
    price REAL DEFAULT 0,
    sellPrice REAL DEFAULT 0,
    quantity REAL DEFAULT 0,
    minStock REAL DEFAULT 5,
    sku TEXT UNIQUE NOT NULL,
    barcode TEXT UNIQUE NOT NULL,
    expiryDate TEXT,
    location TEXT,
    createdAt TEXT
  );

  CREATE TABLE IF NOT EXISTS logs (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    user TEXT NOT NULL,
    sku TEXT,
    productName TEXT NOT NULL,
    type TEXT NOT NULL, -- 'IN' yoki 'OUT'
    qty REAL NOT NULL,
    partner TEXT,
    docNo TEXT,
    note TEXT,
    unit TEXT,
    price REAL DEFAULT 0,
    totalPrice REAL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    docNo TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL, -- 'IN' yoki 'OUT'
    date TEXT NOT NULL,
    partner TEXT,
    responsibleUser TEXT,
    items TEXT NOT NULL, -- JSON format
    totalQty REAL NOT NULL,
    totalSum REAL NOT NULL,
    note TEXT,
    createdAt TEXT
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);

// Boshlang'ich sozlamalarni tekshirish va kiritish
function getSetting(key, defaultValue = '') {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : defaultValue;
}

function setSetting(key, value) {
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, String(value));
}

// Standart sozlamalar
if (!getSetting('company_name')) {
  setSetting('company_name', 'Vanguard Logistics & WMS MChJ');
  setSetting('company_phone', '+998 71 200-00-00');
  setSetting('company_address', 'Toshkent sh., Markaziy Logistika Markazi, 1-Omborxona');
  setSetting('telegram_alerts_enabled', '1');
}

// Boshlang'ich xodimlarni tekshirish
const userCount = db.prepare('SELECT COUNT(*) as cnt FROM users').get().cnt;
if (userCount === 0) {
  const insertUser = db.prepare(`
    INSERT INTO users (id, fullName, username, password, role, warehouse, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  insertUser.run('usr-1', 'Rustam Karimov', 'superadmin', '123456', 'superadmin', 'Bosh Omborxona', 'active');
  insertUser.run('usr-2', 'Dilshod Rahmatov', 'admin', '123456', 'admin', 'Bosh Omborxona', 'active');
  insertUser.run('usr-3', 'Jasur Saidov', 'omborchi', '123456', 'omborchi', 'Bosh Omborxona', 'active');
}

// ==================== TELEGRAM BOT XIZMATI ====================
let botInstance = null;
let botUsername = null;

async function initTelegramBot() {
  const token = getSetting('telegram_bot_token', '').trim();
  if (!token) {
    if (botInstance) {
      try { botInstance.stop(); } catch (e) {}
      botInstance = null;
      botUsername = null;
    }
    return;
  }

  try {
    if (botInstance) {
      try { botInstance.stop(); } catch (e) {}
    }

    const bot = new Telegraf(token);

    bot.command('start', (ctx) => {
      ctx.reply(
        `📦 *Vanguard WMS Pro - Omborxona Boti*\\n\\n` +
        `Assalomu alaykum, *${ctx.from.first_name || 'Foydalanuvchi'}*!\\n` +
        `Ushbu bot omborxonadagi kirim-chiqimlar va mahsulot qoldiqlari haqida real vaqtda xabardor qilib boradi.\\n\\n` +
        `*Mavjud buyruqlar:*\\n` +
        `📊 /stat - Omborxona balansi va statistikasi\\n` +
        `📦 /qoldiq - Barcha mahsulotlar qoldig'i\\n` +
        `⚠️ /kamomad - Tugayotgan tovarlar ro'yxati\\n` +
        `🆔 /myid - Sizning Telegram Chat ID raqamingiz`,
        { parse_mode: 'Markdown' }
      );
    });

    bot.command('myid', (ctx) => {
      ctx.reply(`Sizning Chat ID: \`${ctx.chat.id}\``, { parse_mode: 'Markdown' });
    });

    bot.command('stat', (ctx) => {
      const stats = getWarehouseStats();
      ctx.reply(
        `📊 *OMBORXONA STATISTIKASI*\\n\\n` +
        `💰 Jami tovarlar qiymati: *${stats.totalValueFormatted}*\\n` +
        `🏷️ Tovar turlari: *${stats.totalItems} xil*\\n` +
        `📦 Jami donalar soni: *${stats.totalUnits} dona*\\n` +
        `⚠️ Minimal qoldiqdagi tovarlar: *${stats.lowStockCount} ta*\\n` +
        `❌ Tugagan tovarlar: *${stats.outOfStockCount} ta*`,
        { parse_mode: 'Markdown' }
      );
    });

    bot.command('qoldiq', (ctx) => {
      const products = db.prepare('SELECT name, quantity, unit, sku, location FROM products ORDER BY name ASC').all();
      if (products.length === 0) {
        return ctx.reply("Omborda hozircha tovarlar mavjud emas.");
      }
      let msg = `📦 *OMBOR QOLDIG'I (${products.length} xil):*\\n\\n`;
      products.slice(0, 30).forEach((p, idx) => {
        msg += `${idx + 1}. *${p.name}* — ${p.quantity} ${p.unit || 'dona'} (${p.sku}) [${p.location || 'Polka yo\'q'}]\\n`;
      });
      if (products.length > 30) {
        msg += `\\n_...va yana ${products.length - 30} ta mahsulot._`;
      }
      ctx.reply(msg, { parse_mode: 'Markdown' });
    });

    bot.command('kamomad', (ctx) => {
      const low = db.prepare('SELECT name, quantity, minStock, unit, sku FROM products WHERE quantity <= minStock ORDER BY quantity ASC').all();
      if (low.length === 0) {
        return ctx.reply("✅ Zo'r! Tugayotgan yoki kamomaddagi mahsulotlar yo'q.");
      }
      let msg = `⚠️ *DIQQAT! KAM QOLGAN TOVARLAR (${low.length} ta):*\\n\\n`;
      low.forEach((p, idx) => {
        const icon = p.quantity <= 0 ? '🔴 TUGAGAN' : '🟡 KAM QOLGAN';
        msg += `${idx + 1}. ${icon}: *${p.name}*\\n   Qoldiq: *${p.quantity}* / Min: ${p.minStock} ${p.unit || 'dona'} (${p.sku})\\n`;
      });
      ctx.reply(msg, { parse_mode: 'Markdown' });
    });

    bot.launch().then(() => {
      console.log('🤖 Telegram Bot muvaffaqiyatli ishga tushdi!');
    }).catch(err => {
      console.error('Telegram bot launch error:', err.message);
    });

    const botInfo = await bot.telegram.getMe();
    botUsername = botInfo.username;
    botInstance = bot;
  } catch (err) {
    console.error('Telegram Bot sozlashda xatolik:', err.message);
    botInstance = null;
    botUsername = null;
  }
}

// Telegramga xabar yuborish yordamchisi
async function sendTelegramAlert(text) {
  const alertsEnabled = getSetting('telegram_alerts_enabled', '1') === '1';
  if (!alertsEnabled || !botInstance) return;

  const chatId = getSetting('telegram_chat_id', '').trim();
  if (!chatId) return;

  try {
    await botInstance.telegram.sendMessage(chatId, text, { parse_mode: 'Markdown' });
  } catch (err) {
    console.error('Telegram alert yuborishda xatolik:', err.message);
  }
}

// Statistika hisoblash yordamchisi
function getWarehouseStats() {
  const products = db.prepare('SELECT quantity, price, minStock FROM products').all();
  let totalValue = 0;
  let totalUnits = 0;
  let lowStockCount = 0;
  let outOfStockCount = 0;

  products.forEach(p => {
    const q = Number(p.quantity) || 0;
    const pr = Number(p.price) || 0;
    const min = Number(p.minStock) || 0;
    totalValue += q * pr;
    totalUnits += q;
    if (q === 0) outOfStockCount++;
    else if (q <= min) lowStockCount++;
  });

  return {
    totalValue,
    totalValueFormatted: new Intl.NumberFormat('uz-UZ').format(totalValue) + " so'm",
    totalItems: products.length,
    totalUnits,
    lowStockCount,
    outOfStockCount
  };
}

// ==================== REST API ENDPOINTS ====================

// 1. Tizim holati (Health & Stats)
app.get('/api/status', (req, res) => {
  const stats = getWarehouseStats();
  res.json({
    status: 'online',
    db: 'SQLite (wms.db)',
    botConnected: !!botInstance,
    botUsername: botUsername,
    stats
  });
});

// 2. Auth / Login
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Login va parol kiritilishi shart' });
  }

  const user = db.prepare('SELECT * FROM users WHERE LOWER(username) = LOWER(?) AND password = ?').get(username.trim(), password);
  if (!user) {
    return res.status(401).json({ error: 'Login yoki parol noto\'g\'ri' });
  }

  if (user.status === 'inactive') {
    return res.status(403).json({ error: 'Ushbu xodim hisobi faolsizlantirilgan' });
  }

  res.json({
    user: {
      id: user.id,
      fullName: user.fullName,
      username: user.username,
      role: user.role,
      warehouse: user.warehouse,
      status: user.status
    }
  });
});

// 3. Foydalanuvchilar (Users CRUD)
app.get('/api/users', (req, res) => {
  const rows = db.prepare('SELECT id, fullName, username, password, role, warehouse, status FROM users').all();
  res.json(rows);
});

app.post('/api/users', (req, res) => {
  const { fullName, username, password, role, warehouse, status } = req.body;
  if (!fullName || !username || !password || !role) {
    return res.status(400).json({ error: 'Barcha majburiy maydonlarni to\'ldiring' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE LOWER(username) = LOWER(?)').get(username.trim());
  if (existing) {
    return res.status(400).json({ error: 'Ushbu login tizimda allaqachon mavjud' });
  }

  const id = 'usr-' + Date.now();
  db.prepare(`
    INSERT INTO users (id, fullName, username, password, role, warehouse, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, fullName.trim(), username.trim(), password, role, warehouse || 'Bosh Omborxona', status || 'active');

  res.json({ success: true, id });
});

app.put('/api/users/:id', (req, res) => {
  const { id } = req.params;
  const { fullName, username, password, role, warehouse, status } = req.body;

  const existing = db.prepare('SELECT id FROM users WHERE LOWER(username) = LOWER(?) AND id != ?').get(username.trim(), id);
  if (existing) {
    return res.status(400).json({ error: 'Ushbu login boshqa xodimda mavjud' });
  }

  db.prepare(`
    UPDATE users SET fullName = ?, username = ?, password = ?, role = ?, warehouse = ?, status = ?
    WHERE id = ?
  `).run(fullName.trim(), username.trim(), password, role, warehouse || '', status || 'active', id);

  res.json({ success: true });
});

app.delete('/api/users/:id', (req, res) => {
  const { id } = req.params;
  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(id);
  if (user && user.role === 'superadmin') {
    return res.status(400).json({ error: 'Super Admin hisobini o\'chirish mumkin emas' });
  }
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  res.json({ success: true });
});

// 4. Kategoriyalar (Categories CRUD)
app.get('/api/categories', (req, res) => {
  const rows = db.prepare('SELECT * FROM categories ORDER BY name ASC').all();
  res.json(rows);
});

app.post('/api/categories', (req, res) => {
  const { name, code, description, color, icon } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Kategoriya nomi kiritilishi shart' });
  }

  const existing = db.prepare('SELECT id FROM categories WHERE LOWER(name) = LOWER(?)').get(name.trim());
  if (existing) {
    return res.status(400).json({ error: 'Bunday nomdagi kategoriya mavjud' });
  }

  const id = 'cat-' + Date.now();
  db.prepare(`
    INSERT INTO categories (id, name, code, description, color, icon)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, name.trim(), code || '', description || '', color || '#cb11ab', icon || 'tag');

  res.json({ success: true, id });
});

app.delete('/api/categories/:id', (req, res) => {
  const { id } = req.params;
  db.prepare('DELETE FROM categories WHERE id = ? OR name = ?').run(id, id);
  res.json({ success: true });
});

// 5. Mahsulotlar (Products CRUD)
app.get('/api/products', (req, res) => {
  const rows = db.prepare('SELECT * FROM products ORDER BY createdAt DESC').all();
  res.json(rows);
});

app.post('/api/products', (req, res) => {
  const {
    name, category, unit, price, sellPrice, quantity, minStock,
    sku, barcode, expiryDate, location
  } = req.body;

  if (!name || !category || !sku || !barcode) {
    return res.status(400).json({ error: 'Nom, kategoriya, SKU va shtrix-kod majburiy' });
  }

  const existSku = db.prepare('SELECT id FROM products WHERE sku = ?').get(sku.trim());
  if (existSku) return res.status(400).json({ error: 'Ushbu SKU tizimda mavjud' });

  const existBc = db.prepare('SELECT id FROM products WHERE barcode = ?').get(barcode.trim());
  if (existBc) return res.status(400).json({ error: 'Ushbu shtrix-kod tizimda mavjud' });

  const id = 'prod-' + Date.now();
  const createdAt = new Date().toISOString().split('T')[0];

  db.prepare(`
    INSERT INTO products (id, name, category, unit, price, sellPrice, quantity, minStock, sku, barcode, expiryDate, location, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, name.trim(), category, unit || 'dona', Number(price) || 0, Number(sellPrice) || 0,
    Number(quantity) || 0, Number(minStock) || 5, sku.trim(), barcode.trim(),
    expiryDate || null, location || null, createdAt
  );

  res.json({ success: true, id });
});

app.put('/api/products/:id', (req, res) => {
  const { id } = req.params;
  const {
    name, category, unit, price, sellPrice, quantity, minStock,
    sku, barcode, expiryDate, location
  } = req.body;

  const existSku = db.prepare('SELECT id FROM products WHERE sku = ? AND id != ?').get(sku.trim(), id);
  if (existSku) return res.status(400).json({ error: 'Ushbu SKU boshqa mahsulotda mavjud' });

  const existBc = db.prepare('SELECT id FROM products WHERE barcode = ? AND id != ?').get(barcode.trim(), id);
  if (existBc) return res.status(400).json({ error: 'Ushbu shtrix-kod boshqa mahsulotda mavjud' });

  db.prepare(`
    UPDATE products SET
      name = ?, category = ?, unit = ?, price = ?, sellPrice = ?,
      quantity = ?, minStock = ?, sku = ?, barcode = ?,
      expiryDate = ?, location = ?
    WHERE id = ?
  `).run(
    name.trim(), category, unit || 'dona', Number(price) || 0, Number(sellPrice) || 0,
    Number(quantity) || 0, Number(minStock) || 5, sku.trim(), barcode.trim(),
    expiryDate || null, location || null, id
  );

  res.json({ success: true });
});

app.delete('/api/products/:id', (req, res) => {
  const { id } = req.params;
  db.prepare('DELETE FROM products WHERE id = ?').run(id);
  res.json({ success: true });
});

// 6. Operatsiyalar: Kirim va Chiqim (Inbound & Outbound with Documents & Telegram Alerts)
app.post('/api/operations', async (req, res) => {
  const {
    type, // 'IN' yoki 'OUT'
    items, // [{ productId, qty, price, sellPrice, note }]
    partner, // Yetkazib beruvchi yoki Qabul qiluvchi
    docNo, // Hujjat raqami (masalan, NAKL-2026-001)
    note,
    userName
  } = req.body;

  if (!type || !items || !items.length) {
    return res.status(400).json({ error: 'Operatsiya turi va mahsulotlar kiritilishi shart' });
  }

  const dateStr = new Date().toISOString().replace('T', ' ').substring(0, 16);
  const generatedDocNo = docNo && docNo.trim() ? docNo.trim() : (type === 'IN' ? 'KIR-' : 'CHIQ-') + Date.now().toString().slice(-6);

  let totalQty = 0;
  let totalSum = 0;
  const processedItems = [];
  const lowStockAlerts = [];

  try {
    for (const item of items) {
      const product = db.prepare('SELECT * FROM products WHERE id = ?').get(item.productId);
      if (!product) continue;

      const qty = Number(item.qty);
      if (qty <= 0) continue;

      let newQty = product.quantity;
      const itemPrice = type === 'IN' ? (Number(item.price) || product.price) : (Number(item.sellPrice) || product.sellPrice || product.price);
      const rowTotal = qty * itemPrice;

      if (type === 'IN') {
        newQty += qty;
        // Agar yangi narx kiritilgan bo'lsa yangilash
        if (item.price) {
          db.prepare('UPDATE products SET quantity = ?, price = ? WHERE id = ?').run(newQty, itemPrice, product.id);
        } else {
          db.prepare('UPDATE products SET quantity = ? WHERE id = ?').run(newQty, product.id);
        }
      } else {
        if (product.quantity < qty) {
          return res.status(400).json({
            error: `Mahsulot zaxirasi yetarli emas: "${product.name}" (Qoldiq: ${product.quantity}, So'raldi: ${qty})`
          });
        }
        newQty -= qty;
        db.prepare('UPDATE products SET quantity = ? WHERE id = ?').run(newQty, product.id);

        // Minimal qoldiq tekshiruvi
        if (newQty <= product.minStock) {
          lowStockAlerts.push({
            name: product.name,
            sku: product.sku,
            quantity: newQty,
            minStock: product.minStock,
            unit: product.unit
          });
        }
      }

      totalQty += qty;
      totalSum += rowTotal;

      processedItems.push({
        productId: product.id,
        name: product.name,
        sku: product.sku,
        barcode: product.barcode,
        unit: product.unit || 'dona',
        qty,
        price: itemPrice,
        total: rowTotal,
        location: product.location
      });

      // Log kiritish
      db.prepare(`
        INSERT INTO logs (id, date, user, sku, productName, type, qty, partner, docNo, note, unit, price, totalPrice)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        'log-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
        dateStr,
        userName || 'Xodim',
        product.sku,
        product.name,
        type,
        qty,
        partner || '',
        generatedDocNo,
        note || '',
        product.unit || 'dona',
        itemPrice,
        rowTotal
      );
    }

    // Hujjatni (Nakladnoyni) documents jadvaliga saqlash
    const docId = 'doc-' + Date.now();
    db.prepare(`
      INSERT INTO documents (id, docNo, type, date, partner, responsibleUser, items, totalQty, totalSum, note, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      docId,
      generatedDocNo,
      type,
      dateStr,
      partner || '',
      userName || 'Xodim',
      JSON.stringify(processedItems),
      totalQty,
      totalSum,
      note || '',
      new Date().toISOString()
    );

    // ==================== TELEGRAM NOTIFICATIONS ====================
    const icon = type === 'IN' ? '📥 *YANGI KIRIM (Приемка)*' : '📤 *YANGI CHIQIM (Отгрузка)*';
    const partnerLabel = type === 'IN' ? 'Yetkazib beruvchi' : 'Qabul qiluvchi (Filial/Mijoz)';
    
    let tgMsg = `${icon}\\n\\n` +
      `📄 Hujjat №: \`${generatedDocNo}\`\\n` +
      `📅 Sana: *${dateStr}*\\n` +
      `👤 Xodim: *${userName || 'Xodim'}*\\n` +
      `🏢 ${partnerLabel}: *${partner || 'Ko\'rsatilmadi'}*\\n` +
      `📦 Tovarlar soni: *${processedItems.length} xil (${totalQty} dona)*\\n` +
      `💰 Jami summa: *${new Intl.NumberFormat('uz-UZ').format(totalSum)} so'm*\\n\\n` +
      `*Tovarlar ro'yxati:*\\n`;

    processedItems.slice(0, 10).forEach((it, idx) => {
      tgMsg += `${idx + 1}. *${it.name}* — ${it.qty} ${it.unit} x ${new Intl.NumberFormat('uz-UZ').format(it.price)} = ${new Intl.NumberFormat('uz-UZ').format(it.total)} so'm\\n`;
    });
    if (processedItems.length > 10) {
      tgMsg += `_...va yana ${processedItems.length - 10} ta mahsulot._\\n`;
    }

    sendTelegramAlert(tgMsg);

    // Kam qolgan tovarlar signali
    if (lowStockAlerts.length > 0) {
      let alertMsg = `⚠️ *DIQQAT! KAM QOLDIQ SIGNALI:*\\n\\n`;
      lowStockAlerts.forEach(a => {
        const status = a.quantity === 0 ? '🔴 BUTUNLAY TUGADI' : '🟡 MINIMAL LIMITDAN KAM';
        alertMsg += `${status}: *${a.name}*\\nQoldiq: *${a.quantity} ${a.unit}* (Min limit: ${a.minStock}) [SKU: ${a.sku}]\\n\\n`;
      });
      sendTelegramAlert(alertMsg);
    }

    res.json({
      success: true,
      docId,
      docNo: generatedDocNo,
      totalQty,
      totalSum,
      items: processedItems
    });
  } catch (err) {
    console.error('Operation error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 7. Hujjatlar (Nakladnoylar jurnali)
app.get('/api/documents', (req, res) => {
  const rows = db.prepare('SELECT * FROM documents ORDER BY createdAt DESC').all();
  const parsed = rows.map(r => ({
    ...r,
    items: JSON.parse(r.items || '[]')
  }));
  res.json(parsed);
});

app.get('/api/documents/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Hujjat topilmadi' });
  res.json({
    ...row,
    items: JSON.parse(row.items || '[]')
  });
});

// 8. Tarix / Audit jurnali (Logs)
app.get('/api/logs', (req, res) => {
  const rows = db.prepare('SELECT * FROM logs ORDER BY date DESC LIMIT 200').all();
  res.json(rows);
});

app.delete('/api/logs', (req, res) => {
  db.prepare('DELETE FROM logs').run();
  res.json({ success: true });
});

// 9. Sozlamalar (Settings: Telegram, Kompaniya rekvizitlari)
app.get('/api/settings', (req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const settingsObj = {};
  rows.forEach(r => { settingsObj[r.key] = r.value; });
  settingsObj.botConnected = !!botInstance;
  settingsObj.botUsername = botUsername;
  res.json(settingsObj);
});

app.post('/api/settings', async (req, res) => {
  const settingsData = req.body;
  const oldToken = getSetting('telegram_bot_token', '');

  for (const [key, value] of Object.entries(settingsData)) {
    setSetting(key, value);
  }

  // Agar bot token o'zgargan bo'lsa botni qayta ishga tushirish
  if (settingsData.telegram_bot_token !== undefined && settingsData.telegram_bot_token !== oldToken) {
    await initTelegramBot();
  }

  res.json({
    success: true,
    botConnected: !!botInstance,
    botUsername: botUsername
  });
});

// Telegram test xabar yuborish
app.post('/api/telegram/test', async (req, res) => {
  if (!botInstance) {
    return res.status(400).json({ error: 'Telegram bot ulanmagan. Tokenni kiriting va saqlang.' });
  }
  const chatId = getSetting('telegram_chat_id', '').trim();
  if (!chatId) {
    return res.status(400).json({ error: 'Chat ID kiritilmagan!' });
  }

  try {
    await botInstance.telegram.sendMessage(
      chatId,
      `🔔 *Vanguard WMS Pro - Test Xabari*\\n\\n` +
      `✅ Telegram Bot muvaffaqiyatli bog'landi!\\n` +
      `Endi ushbu chatga yangi kirim-chiqimlar va minimal qoldiq signallari kelib turadi.`,
      { parse_mode: 'Markdown' }
    );
    res.json({ success: true, message: 'Test xabari muvaffaqiyatli yuborildi!' });
  } catch (err) {
    res.status(500).json({ error: 'Xabar yuborishda xatolik: ' + err.message });
  }
});

// ==================== ISHGA TUSHIRISH ====================
app.listen(PORT, async () => {
  console.log(`=======================================================`);
  console.log(`🚀 Vanguard WMS Pro Server ishga tushdi!`);
  console.log(`📡 URL: http://localhost:${PORT}`);
  console.log(`💾 SQLite Baza: ${DB_FILE}`);
  console.log(`=======================================================`);

  // Telegram botni ishga tushirish
  await initTelegramBot();
});
