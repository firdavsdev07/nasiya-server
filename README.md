# 🏪 Nasiya - Credit Sales Management System

Nasiya savdo tizimi - bu nasiya asosida savdo qiluvchi bizneslar uchun to'liq boshqaruv tizimi.

## 🚀 Xususiyatlar

### 📊 **Dashboard**

- Real-time statistika va hisobotlar
- Moliyaviy ko'rsatkichlar
- Grafik va diagrammalar

### 👥 **Xodimlar boshqaruvi**

- Role-based access control (Admin, Moderator, Manager, Seller)
- Xodimlar ro'yxati va ma'lumotlari
- Ruxsatlar tizimi

### 🤝 **Mijozlar boshqaruvi**

- Mijozlar ma'lumotlari
- Telegram integratsiyasi
- Mijozlar tarixi
- Hujjatlar yuklash (passport, shartnoma, foto)

### 📋 **Shartnomalar**

- Nasiya shartnomalarini yaratish
- To'lov jadvalini boshqarish
- Shartnoma holati kuzatuvi

### 💰 **To'lovlar tizimi**

- To'lovlarni qayd qilish
- To'lov tarixi
- Qarzdorlar ro'yxati

### 💵 **Kassa Tizimi**

- Pending to'lovlarni ko'rish va boshqarish
- To'lovlarni tasdiqlash (bir yoki bir nechta)
- To'lovlarni rad etish (sabab bilan)
- Menejer bo'yicha filtrlash
- Real-time balans yangilanishi
- Kechikish kunlarini kuzatish
- To'lov ma'lumotlarini batafsil ko'rish

### 🤖 **Telegram Bot**

- Xodimlar uchun mobil interfeys
- Telefon raqami orqali autentifikatsiya
- Real-time ma'lumotlar

## 🛠 Texnologiyalar

### Backend

- **Node.js** + **Express.js**
- **TypeScript**
- **MongoDB** + **Mongoose**
- **JWT** autentifikatsiya
- **Telegraf** (Telegram Bot)

### Frontend

- **React** + **TypeScript**
- **Vite** build tool
- **Material-UI** (MUI)
- **Redux Toolkit** state management
- **React Router** routing

## 📦 O'rnatish

### Talablar

- Node.js 18+
- MongoDB
- npm yoki yarn

### 1. Repository'ni clone qiling

\`\`\`bash
git clone https://github.com/username/nasiya-system.git
cd nasiya-system
\`\`\`

### 2. Backend o'rnatish

\`\`\`bash
cd server
npm install
\`\`\`

### 3. Frontend o'rnatish

\`\`\`bash
cd web
npm install
\`\`\`

### 4. Environment o'rnatish

**server/.env** yarating:
\`\`\`env
NODE_ENV=development
PORT=3000
MONGO_DB=mongodb://localhost:27017/nasiya_db
JWT_ACCESS_KEY=your_jwt_access_key
JWT_REFRESH_KEY=your_jwt_refresh_key
BOT_TOKEN=your_telegram_bot_token
BOT_USERNAME=your_bot_username
DASHBOARD_HOST_URL=http://localhost:5173
BOT_HOST_URL=http://localhost:3000
ADMIN_FIRSTNAME=Super
ADMIN_LASTNAME=Admin
ADMIN_PHONENUMBER=+998901234567
ADMIN_PASSWORD=admin123
\`\`\`

**web/.env** yarating:
\`\`\`env
VITE_API_URL=http://localhost:3000/api
VITE_API_BASE_URL=http://localhost:3000
VITE_APP_NAME=Nasiya Dashboard
NODE_ENV=development
\`\`\`

## 🚀 Ishga tushirish

### Development rejimi

\`\`\`bash

# Backend

cd server
npm run dev

# Frontend (yangi terminal)

cd web
npm run dev
\`\`\`

### Production rejimi

\`\`\`bash

# Backend build

cd server
npm run build
npm start

# Frontend build

cd web
npm run build
npm run preview
\`\`\`

## 📱 Telegram Bot o'rnatish

1. **@BotFather** ga murojaat qiling
2. \`/newbot\` buyrug'ini yuboring
3. Bot nomini va username'ini kiriting
4. Olingan tokenni \`.env\` fayliga qo'shing

## 🔐 Xavfsizlik

- JWT token autentifikatsiya
- Role-based permissions
- Environment variables
- CORS konfiguratsiyasi
- Input validation

## 📊 API Endpoints

### Authentication

- \`POST /api/auth/login\` - Tizimga kirish
- \`POST /api/auth/refresh\` - Token yangilash

### Customers

- \`GET /api/customer\` - Mijozlar ro'yxati
- \`POST /api/customer\` - Yangi mijoz
- \`PUT /api/customer/:id\` - Mijoz ma'lumotini yangilash

### Contracts

- \`GET /api/contract\` - Shartnomalar ro'yxati
- \`POST /api/contract\` - Yangi shartnoma
- \`PUT /api/contract/:id\` - Shartnoma yangilash

### Cash (Kassa)

- \`GET /api/cash/pending\` - Pending to'lovlar ro'yxati
- \`POST /api/cash/confirm-payments\` - To'lovlarni tasdiqlash
- \`POST /api/cash/reject-payment\` - To'lovni rad etish

**Kassa API Tafsilotlari:**

#### GET /api/cash/pending

Tasdiqlanmagan (PENDING) to'lovlarni olish.

**Response:**
\`\`\`json
[
{
"_id": "payment_id",
"amount": 1000000,
"date": "2024-01-15T10:00:00.000Z",
"isPaid": false,
"status": "PENDING",
"paymentType": "monthly",
"customerId": {
"_id": "customer_id",
"firstName": "Ali",
"lastName": "Valiyev",
"phoneNumber": "+998901234567"
},
"managerId": {
"_id": "manager_id",
"firstName": "Vali",
"lastName": "Aliyev"
},
"notes": {
"text": "To'lov qabul qilindi"
}
}
]
\`\`\`

#### POST /api/cash/confirm-payments

Bir yoki bir nechta to'lovni tasdiqlash.

**Request Body:**
\`\`\`json
{
"paymentIds": ["payment_id_1", "payment_id_2"]
}
\`\`\`

**Response:**
\`\`\`json
{
"success": true,
"message": "To'lovlar tasdiqlandi",
"results": [
{
"paymentId": "payment_id_1",
"status": "success",
"contract": {...},
"balance": {...}
}
]
}
\`\`\`

#### POST /api/cash/reject-payment

To'lovni rad etish.

**Request Body:**
\`\`\`json
{
"paymentId": "payment_id",
"reason": "Noto'g'ri summa kiritilgan"
}
\`\`\`

**Response:**
\`\`\`json
{
"success": true,
"message": "To'lov rad etildi",
"payment": {...}
}
\`\`\`

### Bot API

- \`GET /api/bot/customer/get-all\` - Bot uchun mijozlar
- \`POST /api/bot/payment/pay-debt\` - To'lov qabul qilish

## 🤝 Hissa qo'shish

1. Fork qiling
2. Feature branch yarating (\`git checkout -b feature/AmazingFeature\`)
3. Commit qiling (\`git commit -m 'Add some AmazingFeature'\`)
4. Push qiling (\`git push origin feature/AmazingFeature\`)
5. Pull Request oching

## 📄 Litsenziya

Bu loyiha MIT litsenziyasi ostida tarqatiladi.

## 📞 Aloqa

- **Email**: your-email@example.com
- **Telegram**: @your_username
- **GitHub**: [your-github-username](https://github.com/your-github-username)

## 🙏 Minnatdorchilik

- [Material-UI](https://mui.com/) - UI komponentlar
- [Telegraf](https://telegraf.js.org/) - Telegram Bot framework
- [MongoDB](https://www.mongodb.com/) - Database
- [React](https://reactjs.org/) - Frontend framework
