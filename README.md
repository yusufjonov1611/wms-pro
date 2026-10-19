# Wildberries (WB) Uslubidagi Omborxona Boshqaruvi Tizimi (WMS Pro)

Ushbu tizim **Wildberries (WB)** omborxona va tarqatish markazlari (СЦ / Склад) standartlariga moslashtirilgan bo'lib, quyidagi yangi imkoniyatlar bilan boyitildi:

---

## 🔐 1. Login Paneli va Rollar (RBAC)

Tizimda rolli xavfsizlik (Role-Based Access Control) o'rnatilgan. Sinov uchun tayyor hisoblar:

| Foydalanuvchi | Login | Parol | Huquqlari |
| :--- | :--- | :--- | :--- |
| **Super Admin** | `superadmin` | `123456` | Barcha huquqlar: xodimlarni qo'shish, o'chirish, tahrirlash, barcha narxlar, tovarlar, tarixni tozalash |
| **Admin** | `admin` | `123456` | Tovar qo'shish/tahrirlash, WB qabul qilish, xodimlar ro'yxatini ko'rish |
| **Omborchi** | `omborchi` | `123456` | Faqat tovar qabul qilish (Kirim/Chiqim), skanerlash, qoldiqni ko'rish (tannarxlar yashirilgan) |

*Login ekranida tezkor sinov tugmalari (`Super Admin`, `Admin`, `Omborchi`) ham mavjud.*

---

## 👥 2. Foydalanuvchilarni Boshqarish (User CRUD)

* **Yangi xodim qo'shish**: Ism-sharif, Login, Parol, Rol (Super Admin, Admin, Omborchi), Filial/Ombor nomi.
* **Tahrirlash & O'chirish**: Xodim ma'lumotlarini yoki faollik holatini (Faol / Nofaol) istalgan vaqtda o'zgartirish.
* Super Admin boshqa xodimlarni boshqara oladi, o'zini esa tasodifiy o'chirib yuborishdan himoyalangan.

---

## 🏷️ 3. Wildberries (WB) Standartidagi Shtrix-kod va QR-kod Tizimi

* **Avtomatik 13-xonali EAN shtrix-kod va Artikul (SKU)**: Har bir mahsulot kiritilganda avtomatik generatsiya bo'ladi.
* **Termo-printer uchun tayyor WB Stikeri (58x40mm format)**:
  - Tovar nomi va WB Artikul;
  - Real Shtrix-kod (Code128 / EAN);
  - Dinamik QR-kod (skaner uchun);
  - Razmer (O'lcham), Rang va Ombor javoni (Polka joylashuvi).
* **"Chop etish" (Stiker)**: Bir bosishda printerga yuborish imkoniyati.

---

## 📥 4. Wildberries Qabul Qilish (Приемка / Inbound)

* Yangi partiya kelganda tovar shtrix-kodini yoki QR-kodini skaner qilib darhol tizimga kirim qilish.
* Kirim qilingan har bir mahsulot uchun bir zumda yorliq (stiker) ko'rsatiladi.

---

## 📱 5. Jonli Kamera Skaneri

* Veb-kamera yoki telefon kamerasi orqali QR-kod va Shtrix-kodlarni jonli o'qish.
* Tovar topilganda darhol Kirim/Chiqim oynasini ochish.

---

## 💻 Ishga tushirish

Faylni istalgan zamonaviy brauzerda ochish kifoya:
- `D:\Projeckt\wms-app\index.html` (yoki fayl ustiga ikki marta bosish)
