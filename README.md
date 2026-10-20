# Vanguard WMS Pro - Zamonaviy Omborxona Boshqaruvi Tizimi

**Vanguard WMS Pro** — bu Wildberries (WB) omborlari va logistika markazlari standartlariga moslashtirilgan, o'rnatilgan **Node.js + SQLite** ma'lumotlar bazasi, **A4 Rasmiy Nakladnoy (Invoice)** chop etish tizimi hamda real vaqt rejimida ishlovchi **Telegram Bot** bilan to'liq integratsiya qilingan ombor boshqaruv tizimidir.

---

## 🚀 Asosiy Imkoniyatlar

### 🗄️ 1. Haqiqiy Ma'lumotlar Bazasi (Backend & SQLite)
* **O'rnatilgan doimiy baza**: Brauzer xotirasiga bog'liq emas, barcha tovarlar, harakatlar jurnali, nakladnoylar va foydalanuvchilar `wms.db` (SQLite) faylida doimiy va xavfsiz saqlanadi.
* **REST API & Tarmoq orqali ishlash**: Bir vaqtning o'zida bir nechta kompyuter, telefon yoki shtrix-kod skanerlaridan bitta ombor bazasiga ulanib ishlash imkoniyati (`http://localhost:3000` yoki `http://<KOMPYUTER_IP>:3000`).
* **Offline Fallback**: Agar server o'chiq bo'lsa ham dastur to'xtab qolmaydi, mahalliy kesh (`localStorage`) orqali ishlayveradi.

### 📄 2. Rasmiy A4 Nakladnoy va Hisob-Faktura (Invoice Print)
* **Kirim va Chiqim hujjatlari**: Har bir kirim (Приходная накладная) va chiqim (Расходная накладная) amalga oshirilganda avtomatik rasmiy A4 andozasi shakllanadi.
* **To'liq buxgalteriya talablari**:
  - Korxona nomi, telefon va ombor manzili;
  - Hujjat raqami, sana va yetkazib beruvchi / mijoz ma'lumotlari;
  - Tovarlar jadvali (Artikul, shtrix-kod, tovar nomi, o'lchov birligi, miqdor, narx, jami summa);
  - Jami to'lov summasi so'z bilan (masalan: *"O'n besh million so'm 00 tiyin"*);
  - Mas'ul shaxslar imzolari: *Topshirdi*, *Qabul qildi* va *M.P. (Muhr o'rni)*.
* **Bir zumda A4 formatda chop etish yoki PDF sifatida saqlash**.

### 🤖 3. Telegram Bot Integratsiyasi
* **Avtomatik Bildirishnomalar**:
  - 📥 **Yangi Kirim**: Yangi tovar partiyasi qabul qilinganda guruhga yoki adminga to'liq hisoboti bilan darhol xabar yuboradi.
  - 📤 **Yangi Chiqim**: Ombordan tovar jo'natilganda / sotilganda xabardor qiladi.
  - ⚠️ **Minimal Qoldiq Signali (Alert)**: Mahsulot kam qolganda yoki tugaganda darhol ogohlantiradi.
* **Telegram Bot Buyruqlari**:
  - `/stat` — Ombor balansi va pul qiymati;
  - `/qoldiq` — Barcha mahsulotlar ro'yxati va soni;
  - `/kamomad` — Tugayotgan tovarlar ro'yxati;
  - `/myid` — Foydalanuvchining Chat ID raqami.

### 🏷️ 4. Wildberries Uslubidagi Termo-Stikerlar (58x40mm)
* Mahsulot kiritilganda avtomatik EAN-13 shtrix-kod va SKU generatsiya bo'ladi.
* Termo-printer uchun tayyor stiker (Nomi, Artikul, Shtrix-kod, QR-kod, Joylashuv javoni).

### 👥 5. Rollar va Xavfsizlik (RBAC)
* **Super Admin**: Barcha huquqlar, xodimlarni boshqarish, barcha narxlar va sozlamalar.
* **Admin**: Tovar qo'shish/tahrirlash, kirim/chiqim, kategoriyalar.
* **Omborchi**: Faqat kirim/chiqim va skanerlash (tannarxlar yashirilgan).

---

## 💻 Loyihani Ishga Tushirish

### 1-usul: To'liq Backend va SQLite Baza bilan (Tavsiya etiladi)
Terminalda (PowerShell) loyiha papkasiga kiring va serverni yoqing:
```powershell
npm start
```
Brauzerda quyidagi manzilni oching:
👉 **`http://localhost:3000`**

*(Shuningdek, bir xil Wi-Fi tarmog'idagi telefon yoki boshqa kompyuterlardan `http://<KOMPYUTER_IP>:3000` orqali ham kirish mumkin).*

### 2-usul: Faqat Brauzerda (Server o'chiq bo'lsa)
To'g'ridan-to'g'ri `D:\Projeckt\wms-app\index.html` faylini brauzerda ochish kifoya.

---

## 🔑 Sinov Uchun Standart Hisoblar:

| Foydalanuvchi | Login | Parol | Huquqi |
| :--- | :--- | :--- | :--- |
| **Super Admin** | `superadmin` | `123456` | To'liq nazorat va foydalanuvchilar boshqaruvi |
| **Admin** | `admin` | `123456` | Tovar va kategoriyalar boshqaruvi |
| **Omborchi** | `omborchi` | `123456` | Kirim-chiqim va skanerlash |
