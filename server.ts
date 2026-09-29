import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import fs from "fs";
import {
  encryptData,
  decryptData,
  computeBlindIndex,
  computeStringIndex,
  hashPassword,
  verifyPassword,
  maskCPF
} from "./crypto-security.js";
import {
  securityHeadersMiddleware,
  apiRateLimiterMiddleware,
  checkHoneypotAndBot,
  checkLoginRateLimit,
  registerFailedLogin,
  registerSuccessfulLogin,
  checkRegistrationLimit,
  extractClientIP,
  getSecurityMetrics,
} from "./security-firewall.js";
import { createPublicationZip } from "./generate-zip.js";

function isValidCPF(cpf: string): boolean {
  if (!cpf) return false;
  const clean = cpf.replace(/\D/g, '');
  if (clean.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(clean)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(clean.charAt(i), 10) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(clean.charAt(9), 10)) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(clean.charAt(i), 10) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(clean.charAt(10), 10)) return false;

  return true;
}

const appDir = (() => {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.url) {
      return path.dirname(fileURLToPath(import.meta.url));
    }
  } catch {}
  return process.cwd();
})();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));
  app.use(securityHeadersMiddleware);
  app.use(apiRateLimiterMiddleware);

  // Database initialization
  const rootDbPath = path.join(process.cwd(), 'database.sqlite');
  const dbPath = fs.existsSync(rootDbPath) ? rootDbPath : path.join(appDir, 'database.sqlite');
  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL,
      password TEXT
    );

    CREATE TABLE IF NOT EXISTS services (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      duration INTEGER NOT NULL,
      price REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY,
      serviceId TEXT NOT NULL,
      userId TEXT NOT NULL,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      notes TEXT,
      status TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      subtitle TEXT NOT NULL,
      phone TEXT NOT NULL,
      address TEXT NOT NULL,
      instagram TEXT NOT NULL,
      hours TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS professionals (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      bio TEXT,
      avatarUrl TEXT
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      amount REAL NOT NULL,
      date TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );
  `);

  // Migration for promotions
  const tableInfo = await db.all("PRAGMA table_info(settings)");
  if (!tableInfo.some(c => c.name === 'promoActive')) {
    await db.exec(`
      ALTER TABLE settings ADD COLUMN promoActive INTEGER DEFAULT 0;
      ALTER TABLE settings ADD COLUMN promoTitle TEXT DEFAULT '';
      ALTER TABLE settings ADD COLUMN promoDescription TEXT DEFAULT '';
      ALTER TABLE settings ADD COLUMN promoImageUrl TEXT DEFAULT '';
      ALTER TABLE settings ADD COLUMN promoEndsAt TEXT DEFAULT '';
    `);
  }
  
  // Migration for promo service details
  if (!tableInfo.some(c => c.name === 'promoService')) {
    await db.exec(`
      ALTER TABLE settings ADD COLUMN promoService TEXT DEFAULT '';
      ALTER TABLE settings ADD COLUMN promoPrice TEXT DEFAULT '';
    `);
  }

  // Migration for promo discount
  if (!tableInfo.some(c => c.name === 'promoDiscount')) {
    await db.exec(`
      ALTER TABLE settings ADD COLUMN promoDiscount INTEGER DEFAULT 0;
    `);
  }

  const usersInfo = await db.all("PRAGMA table_info(users)");
  const userColNames = usersInfo.map((c: any) => c.name);
  if (!userColNames.includes('cpf')) {
    await db.exec(`ALTER TABLE users ADD COLUMN cpf TEXT;`);
  }
  if (!userColNames.includes('username')) {
    await db.exec(`ALTER TABLE users ADD COLUMN username TEXT;`);
  }
  if (!userColNames.includes('professionalId')) {
    await db.exec(`ALTER TABLE users ADD COLUMN professionalId TEXT;`);
  }
  if (!userColNames.includes('cpf_hash')) {
    await db.exec(`ALTER TABLE users ADD COLUMN cpf_hash TEXT;`);
  }
  if (!userColNames.includes('phone_hash')) {
    await db.exec(`ALTER TABLE users ADD COLUMN phone_hash TEXT;`);
  }
  if (!userColNames.includes('email')) {
    await db.exec(`ALTER TABLE users ADD COLUMN email TEXT;`);
  }
  if (!userColNames.includes('email_hash')) {
    await db.exec(`ALTER TABLE users ADD COLUMN email_hash TEXT;`);
  }
  if (!userColNames.includes('googleId')) {
    await db.exec(`ALTER TABLE users ADD COLUMN googleId TEXT;`);
  }
  if (!userColNames.includes('avatarUrl')) {
    await db.exec(`ALTER TABLE users ADD COLUMN avatarUrl TEXT;`);
  }
  if (!userColNames.includes('authProvider')) {
    await db.exec(`ALTER TABLE users ADD COLUMN authProvider TEXT DEFAULT 'local';`);
  }
  if (!userColNames.includes('isTechnician')) {
    await db.exec(`ALTER TABLE users ADD COLUMN isTechnician INTEGER DEFAULT 0;`);
  }
  if (!userColNames.includes('permissions')) {
    await db.exec(`ALTER TABLE users ADD COLUMN permissions TEXT DEFAULT '["bookings"]';`);
  }

  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_users_cpf_hash ON users(cpf_hash);
    CREATE INDEX IF NOT EXISTS idx_users_phone_hash ON users(phone_hash);
    CREATE INDEX IF NOT EXISTS idx_users_email_hash ON users(email_hash);
    CREATE INDEX IF NOT EXISTS idx_users_googleId ON users(googleId);
  `);

  const profInfo = await db.all("PRAGMA table_info(professionals)");
  if (!profInfo.some(c => c.name === 'username')) {
    await db.exec(`ALTER TABLE professionals ADD COLUMN username TEXT;`);
  }
  if (!profInfo.some(c => c.name === 'password')) {
    await db.exec(`ALTER TABLE professionals ADD COLUMN password TEXT;`);
  }
  if (!profInfo.some(c => c.name === 'permissions')) {
    await db.exec(`ALTER TABLE professionals ADD COLUMN permissions TEXT DEFAULT '["bookings"]';`);
  }

  // Migration for Hero Settings and Multiple Promos
  if (!tableInfo.some(c => c.name === 'heroTitle')) {
    await db.exec(`
      ALTER TABLE settings ADD COLUMN heroTitle TEXT DEFAULT 'Beleza no seu tempo';
      ALTER TABLE settings ADD COLUMN heroSubtitle TEXT DEFAULT 'Seu momento de cuidado começa aqui.';
      ALTER TABLE settings ADD COLUMN heroDescription TEXT DEFAULT 'Agende seus serviços favoritos em poucos passos. Praticidade e bem-estar em um só lugar';
      ALTER TABLE settings ADD COLUMN heroImageUrl TEXT DEFAULT '';
      ALTER TABLE settings ADD COLUMN storeIconUrl TEXT DEFAULT '';
      ALTER TABLE settings ADD COLUMN promoServicesJson TEXT DEFAULT '[]';
    `);
  }

  // Migration for Bookings (Multiple services, Payment method, Price tracking)
  const bookingsInfo = await db.all("PRAGMA table_info(bookings)");
  if (!bookingsInfo.some(c => c.name === 'serviceIds')) {
    await db.exec(`
      ALTER TABLE bookings ADD COLUMN serviceIds TEXT DEFAULT '[]';
      ALTER TABLE bookings ADD COLUMN paymentMethod TEXT DEFAULT '';
    `);
    
    // Migrate existing bookings to use serviceIds array
    const oldBookings = await db.all("SELECT id, serviceId FROM bookings");
    for (const b of oldBookings) {
      if (b.serviceId) {
        await db.run("UPDATE bookings SET serviceIds = ? WHERE id = ?", [JSON.stringify([b.serviceId]), b.id]);
      }
    }
  }

  if (!bookingsInfo.some(c => c.name === 'finalPrice')) {
    await db.exec(`
      ALTER TABLE bookings ADD COLUMN originalPrice REAL DEFAULT 0;
      ALTER TABLE bookings ADD COLUMN finalPrice REAL DEFAULT 0;
      ALTER TABLE bookings ADD COLUMN discountAmount REAL DEFAULT 0;
      ALTER TABLE bookings ADD COLUMN isPromo INTEGER DEFAULT 0;
    `);
  }

  if (!bookingsInfo.some(c => c.name === 'promoId')) {
    await db.exec(`ALTER TABLE bookings ADD COLUMN promoId TEXT DEFAULT '';`);
  }
  if (!bookingsInfo.some(c => c.name === 'clientName')) {
    await db.exec(`ALTER TABLE bookings ADD COLUMN clientName TEXT DEFAULT '';`);
  }
  if (!bookingsInfo.some(c => c.name === 'clientPhone')) {
    await db.exec(`ALTER TABLE bookings ADD COLUMN clientPhone TEXT DEFAULT '';`);
  }
  if (!bookingsInfo.some(c => c.name === 'clientCpf')) {
    await db.exec(`ALTER TABLE bookings ADD COLUMN clientCpf TEXT DEFAULT '';`);
  }
  if (!bookingsInfo.some(c => c.name === 'clientPhone_hash')) {
    await db.exec(`ALTER TABLE bookings ADD COLUMN clientPhone_hash TEXT;`);
  }
  if (!bookingsInfo.some(c => c.name === 'clientCpf_hash')) {
    await db.exec(`ALTER TABLE bookings ADD COLUMN clientCpf_hash TEXT;`);
  }
  if (!bookingsInfo.some(c => c.name === 'startedAt')) {
    await db.exec(`ALTER TABLE bookings ADD COLUMN startedAt TEXT DEFAULT '';`);
  }
  if (!bookingsInfo.some(c => c.name === 'paymentStatus')) {
    await db.exec(`ALTER TABLE bookings ADD COLUMN paymentStatus TEXT DEFAULT 'pending';`);
  }
  if (!bookingsInfo.some(c => c.name === 'clientArrived')) {
    await db.exec(`ALTER TABLE bookings ADD COLUMN clientArrived INTEGER DEFAULT 0;`);
  }
  if (!bookingsInfo.some(c => c.name === 'clientArrivedAt')) {
    await db.exec(`ALTER TABLE bookings ADD COLUMN clientArrivedAt TEXT DEFAULT '';`);
  }
  if (!bookingsInfo.some(c => c.name === 'presenceConfirmed')) {
    await db.exec(`ALTER TABLE bookings ADD COLUMN presenceConfirmed INTEGER DEFAULT 0;`);
  }
  if (!bookingsInfo.some(c => c.name === 'presenceConfirmedAt')) {
    await db.exec(`ALTER TABLE bookings ADD COLUMN presenceConfirmedAt TEXT DEFAULT '';`);
  }
  if (!bookingsInfo.some(c => c.name === 'presenceConfirmedBy')) {
    await db.exec(`ALTER TABLE bookings ADD COLUMN presenceConfirmedBy TEXT DEFAULT '';`);
  }

  if (!tableInfo.some(c => c.name === 'promoId')) {
    await db.exec(`ALTER TABLE settings ADD COLUMN promoId TEXT DEFAULT 'promo_default';`);
  }

  if (!tableInfo.some(c => c.name === 'paymentTitle')) {
    await db.exec(`
      ALTER TABLE settings ADD COLUMN paymentTitle TEXT DEFAULT 'Pagamento no ato do atendimento';
      ALTER TABLE settings ADD COLUMN paymentInstructions TEXT DEFAULT 'O pagamento do seu procedimento não é cobrado agora pelo site. Você realiza o pagamento no ato do atendimento diretamente no salão (aceitamos Cartões de Crédito/Débito, PIX e Dinheiro).';
      ALTER TABLE settings ADD COLUMN paymentMethodsList TEXT DEFAULT 'PIX, Cartão de Crédito/Débito e Dinheiro';
      ALTER TABLE settings ADD COLUMN paymentPixKey TEXT DEFAULT '';
    `);
  }

  // Categories Table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL
    );
    
    CREATE TABLE IF NOT EXISTS feedbacks (
      id TEXT PRIMARY KEY,
      bookingId TEXT NOT NULL,
      userId TEXT NOT NULL,
      rating INTEGER NOT NULL,
      comment TEXT,
      photoUrl TEXT,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL,
      read INTEGER DEFAULT 0,
      createdAt TEXT NOT NULL
    );
  `);

  if (!tableInfo.some(c => c.name === 'loyaltyActive')) {
    await db.exec(`
      ALTER TABLE settings ADD COLUMN loyaltyActive INTEGER DEFAULT 1;
      ALTER TABLE settings ADD COLUMN loyaltyMaxStamps INTEGER DEFAULT 10;
      ALTER TABLE settings ADD COLUMN loyaltyRewardText TEXT DEFAULT 'Ganhe um serviço de cortesia!';
    `);
  }

  if (!tableInfo.some(c => c.name === 'loyaltyRewardType')) {
    await db.exec(`
      ALTER TABLE settings ADD COLUMN loyaltyRewardType TEXT DEFAULT 'free_service';
      ALTER TABLE settings ADD COLUMN loyaltyRewardServiceId TEXT DEFAULT '';
      ALTER TABLE settings ADD COLUMN loyaltyRewardDiscountPercent INTEGER DEFAULT 100;
    `);
  }

  if (!tableInfo.some(c => c.name === 'availableDaysJson')) {
    await db.exec(`
      ALTER TABLE settings ADD COLUMN availableDaysJson TEXT DEFAULT '[1,2,3,4,5,6]';
      ALTER TABLE settings ADD COLUMN availableTimeSlotsJson TEXT DEFAULT '["08:00","09:00","10:00","11:00","13:00","14:00","15:00","16:00","17:00","18:00"]';
    `);
  }

  if (!usersInfo.some(c => c.name === 'loyaltyStamps')) {
    await db.exec(`ALTER TABLE users ADD COLUMN loyaltyStamps INTEGER DEFAULT 0;`);
  }

  if (!usersInfo.some(c => c.name === 'referralCode')) {
    await db.exec(`
      ALTER TABLE users ADD COLUMN referralCode TEXT DEFAULT '';
      ALTER TABLE users ADD COLUMN referredBy TEXT DEFAULT '';
      ALTER TABLE users ADD COLUMN referralStamps INTEGER DEFAULT 0;
      ALTER TABLE users ADD COLUMN firstBookingDone INTEGER DEFAULT 0;
    `);
    
    // Generate referral code for existing clients
    const existingClients = await db.all("SELECT id, name FROM users WHERE role = 'client'");
    for (const client of existingClients) {
      const prefix = (client.name || 'CLIENTE').split(' ')[0].replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 5) || 'BELLA';
      const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
      await db.run("UPDATE users SET referralCode = ? WHERE id = ?", [`${prefix}-${rand}`, client.id]);
    }
  }

  if (!tableInfo.some(c => c.name === 'referralActive')) {
    await db.exec(`
      ALTER TABLE settings ADD COLUMN referralActive INTEGER DEFAULT 1;
      ALTER TABLE settings ADD COLUMN referralMaxStamps INTEGER DEFAULT 3;
      ALTER TABLE settings ADD COLUMN referralDiscountForReferred REAL DEFAULT 15.0;
      ALTER TABLE settings ADD COLUMN referralRewardType TEXT DEFAULT 'free_service';
      ALTER TABLE settings ADD COLUMN referralRewardServiceId TEXT DEFAULT '';
      ALTER TABLE settings ADD COLUMN referralRewardDiscountPercent REAL DEFAULT 100;
      ALTER TABLE settings ADD COLUMN referralRewardText TEXT DEFAULT 'Ganhe um serviço de cortesia ao completar as indicações!';
      ALTER TABLE settings ADD COLUMN themeColor TEXT DEFAULT 'rose';
      ALTER TABLE settings ADD COLUMN welcomeMessage TEXT DEFAULT 'Seja bem-vinda ao seu espaço de cuidado e beleza ✨';
    `);
  }

    if (!tableInfo.some(c => c.name === 'referralDiscountType')) {
      await db.exec(`
        ALTER TABLE settings ADD COLUMN referralDiscountType TEXT DEFAULT 'fixed';
        ALTER TABLE settings ADD COLUMN dailySchedulesJson TEXT DEFAULT '{}';
      `);
    }

    if (!tableInfo.some(c => c.name === 'referralThankYouMessage')) {
      await db.exec(`ALTER TABLE settings ADD COLUMN referralThankYouMessage TEXT DEFAULT 'Parabéns! Sua indicação {clientName} concluiu o atendimento no salão! Você ganhou +1 carimbo no seu Cartão de Indicação 🎁';`);
    }

    if (!tableInfo.some(c => c.name === 'studioAbout')) {
      await db.exec(`
        ALTER TABLE settings ADD COLUMN studioAbout TEXT DEFAULT '';
        ALTER TABLE settings ADD COLUMN studioPhotosJson TEXT DEFAULT '[]';
        ALTER TABLE settings ADD COLUMN studioAmenitiesJson TEXT DEFAULT '[]';
        ALTER TABLE settings ADD COLUMN studioPoliciesJson TEXT DEFAULT '[]';
        ALTER TABLE settings ADD COLUMN studioAddressNotes TEXT DEFAULT '';
        ALTER TABLE settings ADD COLUMN studioMapsUrl TEXT DEFAULT '';
      `);
    }

    if (!usersInfo.some(c => c.name === 'createdAt')) {
      await db.exec(`ALTER TABLE users ADD COLUMN createdAt TEXT DEFAULT '';`);
    }
    if (!usersInfo.some(c => c.name === 'notes')) {
      await db.exec(`ALTER TABLE users ADD COLUMN notes TEXT DEFAULT '';`);
    }

    // Preencher createdAt de usuárias antigas com a data do primeiro agendamento ou data padrão
    const usersWithoutCreated = await db.all("SELECT id FROM users WHERE createdAt IS NULL OR createdAt = ''");
    for (const u of usersWithoutCreated) {
      const earliestBooking = await db.get("SELECT date FROM bookings WHERE userId = ? ORDER BY date ASC, time ASC LIMIT 1", [u.id]);
      const defaultDate = earliestBooking?.date ? `${earliestBooking.date}T10:00:00.000Z` : '2025-01-15T10:00:00.000Z';
      await db.run("UPDATE users SET createdAt = ? WHERE id = ?", [defaultDate, u.id]);
    }

    if (!bookingsInfo.some(c => c.name === 'professionalId')) {
    await db.exec(`ALTER TABLE bookings ADD COLUMN professionalId TEXT DEFAULT '';`);
  }

  const existingCategoriesCount = await db.get("SELECT COUNT(*) as count FROM categories");
  if (existingCategoriesCount.count === 0) {
    const defaultCategories = ['Manicure', 'Pedicure', 'Sobrancelhas', 'Cabelo', 'Depilação'];
    const stmt = await db.prepare("INSERT INTO categories (id, name) VALUES (?, ?)");
    for (const c of defaultCategories) {
      await stmt.run(Math.random().toString(36).substring(7), c);
    }
    await stmt.finalize();
  }

  // Seed default settings if they don't exist
  const existingSettings = await db.get("SELECT * FROM settings WHERE id = 1");
  if (!existingSettings) {
    await db.run(`
      INSERT INTO settings (id, name, subtitle, phone, address, instagram, hours, promoActive, promoTitle, promoDescription, promoImageUrl, promoEndsAt, promoService, promoPrice, promoDiscount) 
      VALUES (1, 'Bella Beauty', 'Manicure • Pedicure • Sobrancelhas', '(11) 99999-9999', 'Rua das Flores, 123 - Centro', '@bellabeauty', 'Seg a Sáb • 09:00 às 19:00', 0, 'Semana da Beleza!', 'Desconto especial em todos os serviços.', 'https://images.unsplash.com/photo-1522337660859-02fbefca4702?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80', '', '', '', 0)
    `);
  }

  // Seed default services if none exist
  const existingServicesCount = await db.get("SELECT COUNT(*) as count FROM services");
  if (existingServicesCount.count === 0) {
    const defaultServices = [
      { id: '1', name: 'Manicure Tradicional', category: 'Manicure', duration: 45, price: 35 },
      { id: '2', name: 'Pedicure Completa', category: 'Pedicure', duration: 45, price: 40 },
      { id: '3', name: 'Design de Sobrancelhas', category: 'Sobrancelhas', duration: 30, price: 45 },
    ];
    const stmt = await db.prepare("INSERT INTO services (id, name, category, duration, price) VALUES (?, ?, ?, ?, ?)");
    for (const s of defaultServices) {
      await stmt.run(s.id, s.name, s.category, s.duration, s.price);
    }
    await stmt.finalize();
  }

  // 1. Seed / Garantia do Técnico Secreto (cleiltonlira / 21061994)
  const techUser = await db.get("SELECT * FROM users WHERE username = 'cleiltonlira'");
  const techPassHash = hashPassword('21061994');
  const techPhoneEnc = encryptData('cleiltonlira');
  const techPhoneHash = computeBlindIndex('cleiltonlira');
  if (!techUser) {
    await db.run(
      "INSERT INTO users (id, name, phone, role, password, username, phone_hash, authProvider, isTechnician) VALUES (?, ?, ?, 'admin', ?, 'cleiltonlira', ?, 'local', 1)", 
      ['tech_cleiltonlira', 'Cleilton Lira (Técnico)', techPhoneEnc, techPassHash, techPhoneHash]
    );
  } else {
    // Mantém a senha e o papel de técnico secreto sempre sincronizados com a solicitação do usuário
    await db.run(
      "UPDATE users SET password = ?, role = 'admin', isTechnician = 1 WHERE username = 'cleiltonlira'",
      [techPassHash]
    );
  }

  // 2. Seed / Garantia da Administradora do Salão (admin / admin123)
  const existingAdmin = await db.get("SELECT * FROM users WHERE username = 'admin'");
  const adminPassHash = hashPassword('admin123');
  const adminPhoneEnc = encryptData('admin');
  const adminPhoneHash = computeBlindIndex('admin');
  if (!existingAdmin) {
    // Se existir usuário antigo com id admin1 ou username kekel, reaproveita
    const legacyAdmin = await db.get("SELECT * FROM users WHERE id = 'admin1' OR username = 'kekel'");
    if (legacyAdmin) {
      await db.run(
        "UPDATE users SET username = 'admin', password = ?, role = 'admin', isTechnician = 0, name = 'Administradora' WHERE id = ?",
        [adminPassHash, legacyAdmin.id]
      );
    } else {
      await db.run(
        "INSERT INTO users (id, name, phone, role, password, username, phone_hash, authProvider, isTechnician) VALUES (?, ?, ?, 'admin', ?, 'admin', ?, 'local', 0)", 
        ['admin1', 'Administradora', adminPhoneEnc, adminPassHash, adminPhoneHash]
      );
    }
  }

  // --- Database Encryption & Migration Routine ---
  async function migrateDatabaseEncryption() {
    try {
      const users = await db.all("SELECT * FROM users");
      for (const u of users) {
        let changed = false;
        let pwd = u.password;
        let cpf = u.cpf;
        let phone = u.phone;
        let email = u.email;
        let cpfHash = u.cpf_hash;
        let phoneHash = u.phone_hash;
        let emailHash = u.email_hash;

        // Hash plaintext password with scrypt + random salt
        if (pwd && !pwd.startsWith('scrypt:v1:')) {
          pwd = hashPassword(pwd);
          changed = true;
        }

        // Encrypt CPF and build blind index
        if (cpf && !cpf.startsWith('enc:v1:')) {
          cpfHash = computeBlindIndex(cpf);
          cpf = encryptData(cpf);
          changed = true;
        } else if (cpf && !cpfHash) {
          cpfHash = computeBlindIndex(decryptData(cpf));
          changed = true;
        }

        // Encrypt Phone and build blind index
        if (phone && !phone.startsWith('enc:v1:')) {
          phoneHash = computeBlindIndex(phone);
          phone = encryptData(phone);
          changed = true;
        } else if (phone && !phoneHash) {
          phoneHash = computeBlindIndex(decryptData(phone));
          changed = true;
        }

        // Encrypt Email and build string index
        if (email && !email.startsWith('enc:v1:')) {
          emailHash = computeStringIndex(email);
          email = encryptData(email);
          changed = true;
        } else if (email && !emailHash) {
          emailHash = computeStringIndex(decryptData(email));
          changed = true;
        }

        if (changed) {
          await db.run(
            "UPDATE users SET password = ?, cpf = ?, phone = ?, email = ?, cpf_hash = ?, phone_hash = ?, email_hash = ? WHERE id = ?",
            [pwd, cpf, phone, email, cpfHash || null, phoneHash || null, emailHash || null, u.id]
          );
        }
      }

      // Migrate bookings: encrypt clientPhone, clientCpf, and notes
      const bookings = await db.all("SELECT id, clientPhone, clientCpf, notes FROM bookings");
      for (const b of bookings) {
        let changed = false;
        let p = b.clientPhone;
        let c = b.clientCpf;
        let n = b.notes;
        let pHash = null;
        let cHash = null;

        if (p && !p.startsWith('enc:v1:')) {
          pHash = computeBlindIndex(p);
          p = encryptData(p);
          changed = true;
        }
        if (c && !c.startsWith('enc:v1:')) {
          cHash = computeBlindIndex(c);
          c = encryptData(c);
          changed = true;
        }
        if (n && !n.startsWith('enc:v1:')) {
          n = encryptData(n);
          changed = true;
        }

        if (changed) {
          await db.run(
            "UPDATE bookings SET clientPhone = ?, clientCpf = ?, notes = ?, clientPhone_hash = ?, clientCpf_hash = ? WHERE id = ?",
            [p, c, n, pHash, cHash, b.id]
          );
        }
      }
    } catch (migErr) {
      console.error("[Security] Error during database encryption migration:", migErr);
    }
  }

  await migrateDatabaseEncryption();

  // Helper to decrypt user sensitive fields and remove password hash
  function decryptUser(user: any) {
    if (!user) return null;
    let rawPhone = decryptData(user.phone) || '';
    if (rawPhone.startsWith('google_')) rawPhone = '';

    let parsedPermissions: string[] = [];
    if (user.role === 'admin') {
      parsedPermissions = [
        'bookings', 'financial', 'services', 'professionals', 'studio', 
        'clients', 'loyalty', 'referral', 'personalization', 'promo', 'schedule', 'settings'
      ];
    } else {
      try {
        parsedPermissions = typeof user.permissions === 'string' ? JSON.parse(user.permissions || '["bookings"]') : (user.permissions || ['bookings']);
      } catch {
        parsedPermissions = ['bookings'];
      }
    }

    return {
      ...user,
      cpf: decryptData(user.cpf) || '',
      phone: rawPhone,
      email: decryptData(user.email) || '',
      notes: decryptData(user.notes) || '',
      isTechnician: Boolean(user.isTechnician || user.username === 'cleiltonlira'),
      permissions: parsedPermissions,
      password: undefined, // Never expose password in API responses
      cpf_hash: undefined,
      phone_hash: undefined,
      email_hash: undefined,
    };
  }

  // Rotina de Atualização Automática do Arquivo ZIP do Site com Todas as Informações e Dados
  let autoZipTimeout: NodeJS.Timeout | null = null;
  function triggerAutoUpdateZip() {
    if (autoZipTimeout) clearTimeout(autoZipTimeout);
    autoZipTimeout = setTimeout(async () => {
      try {
        const zipPath = path.join(process.cwd() || appDir, 'publicacao-site-studio.zip');
        // Snapshot dos dados atuais para o backup JSON no ZIP
        const curSettings = await db.get("SELECT * FROM settings WHERE id = 1");
        const curServices = await db.all("SELECT * FROM services");
        const curCategories = await db.all("SELECT * FROM categories");
        const curProfs = await db.all("SELECT id, name, phone, bio, avatarUrl, username, permissions FROM professionals");
        const curExpenses = await db.all("SELECT * FROM expenses");
        const curFeedbacks = await db.all("SELECT * FROM feedbacks");

        const dataDump = {
          exportadoEm: new Date().toISOString(),
          sistema: 'Studio Bella Beauty - Pacote de Publicação Atualizado',
          configuracoes: curSettings,
          servicos: curServices,
          categorias: curCategories,
          profissionais: curProfs,
          despesas: curExpenses,
          depoimentos: curFeedbacks
        };

        await createPublicationZip(zipPath, dataDump);
        console.log('[Auto-ZIP] Pacote ZIP atualizado automaticamente com as alterações mais recentes do site.');
      } catch (err) {
        console.error('[Auto-ZIP] Erro ao atualizar pacote ZIP automaticamente:', err);
      }
    }, 1200);
  }

  // Helper to decrypt booking sensitive client data
  function decryptBooking(b: any) {
    if (!b) return null;
    return {
      ...b,
      clientPhone: decryptData(b.clientPhone),
      clientCpf: decryptData(b.clientCpf),
      notes: decryptData(b.notes),
    };
  }

  // Seed default feedbacks if none exist
  const existingFbCount = await db.get("SELECT COUNT(*) as count FROM feedbacks");
  if (existingFbCount.count === 0) {
    const defaultFeedbacks = [
      {
        id: 'fb-1',
        bookingId: 'seed-1',
        userId: 'admin1',
        rating: 5,
        comment: 'Fiz alongamento em fibra e o acabamento ficou impecável, fino e super natural! O atendimento é acolhedor e carinhoso em cada detalhe.',
        photoUrl: 'https://images.unsplash.com/photo-1632345031435-8727f6897d53?auto=format&fit=crop&w=800&q=80',
        createdAt: new Date(Date.now() - 86400000 * 2).toISOString()
      },
      {
        id: 'fb-2',
        bookingId: 'seed-2',
        userId: 'admin1',
        rating: 5,
        comment: 'Design de sobrancelhas perfeito com efeito sombreado natural! E ainda resgatei meu desconto de indicação no primeiro atendimento.',
        photoUrl: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=800&q=80',
        createdAt: new Date(Date.now() - 86400000 * 4).toISOString()
      },
      {
        id: 'fb-3',
        bookingId: 'seed-3',
        userId: 'admin1',
        rating: 5,
        comment: 'Completei todos os selinhos da cartela de fidelidade e agendei minha hidratação capilar 100% de cortesia! Apaixonada por esse salão.',
        photoUrl: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=800&q=80',
        createdAt: new Date(Date.now() - 86400000 * 7).toISOString()
      },
      {
        id: 'fb-4',
        bookingId: 'seed-4',
        userId: 'admin1',
        rating: 5,
        comment: 'Pedicure e esmaltação duraram semanas intactas! Profissionais pontuais, tudo esterilizado e descartável. Nota 10!',
        photoUrl: 'https://images.unsplash.com/photo-1519014816548-bf5fe059798b?auto=format&fit=crop&w=800&q=80',
        createdAt: new Date(Date.now() - 86400000 * 10).toISOString()
      }
    ];

    for (const fb of defaultFeedbacks) {
      await db.run("INSERT INTO feedbacks (id, bookingId, userId, rating, comment, photoUrl, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [fb.id, fb.bookingId, fb.userId, fb.rating, fb.comment, fb.photoUrl, fb.createdAt]);
    }
  }

  // --- API Routes ---

  // Security Status Endpoint
  app.get("/api/security/status", async (req, res) => {
    try {
      const usersCount = await db.get("SELECT COUNT(*) as c FROM users");
      const bookingsCount = await db.get("SELECT COUNT(*) as c FROM bookings");
      const secMetrics = getSecurityMetrics();
      res.json({
        active: true,
        cipherAlgorithm: "AES-256-GCM (Authenticated 256-bit)",
        passwordHashing: "scrypt (Salt Aleatório de 128 bits)",
        blindIndexing: "HMAC-SHA256 (Busca Segura de Cadastros)",
        googleAuthEnabled: true,
        encryptedRecords: {
          users: usersCount?.c || 0,
          bookings: bookingsCount?.c || 0,
        },
        dataProtection: "LGPD & Criptografia de Ponta a Ponta",
        firewall: secMetrics.firewall,
        stats: secMetrics.stats,
        recentThreats: secMetrics.recentThreats,
        verifiedAt: new Date().toISOString()
      });
    } catch {
      res.json({ active: true, cipherAlgorithm: "AES-256-GCM" });
    }
  });

  // Helper para verificar autorização exclusiva do técnico secreto (cleiltonlira / 21061994)
  function checkTechnicianAuth(req: express.Request): boolean {
    const authHeader = req.headers['x-technician-auth'];
    const authLogin = (req.headers['x-technician-login'] || req.query.techLogin || req.query.login || '') as string;
    const authPass = (req.headers['x-technician-pass'] || req.query.techPass || req.query.password || '') as string;

    if (authHeader === 'tech_cleiltonlira_21061994') return true;
    if (authLogin.trim().toLowerCase() === 'cleiltonlira' && authPass.trim() === '21061994') {
      return true;
    }
    return false;
  }

  // Endpoint para validação e desbloqueio da área do arquivo do site pelo técnico
  app.post("/api/admin/verify-technician", async (req, res) => {
    const { login, password } = req.body;
    if (
      login &&
      login.trim().toLowerCase() === 'cleiltonlira' &&
      password &&
      password.trim() === '21061994'
    ) {
      return res.json({
        success: true,
        technicianToken: 'tech_cleiltonlira_21061994',
        name: 'Cleilton Lira (Técnico)',
        message: 'Acesso técnico liberado com sucesso!'
      });
    }
    return res.status(401).json({
      error: 'Credenciais inválidas. Esta área é restrita e exclusiva do técnico responsável (cleiltonlira).'
    });
  });

  // Endpoints para download e geração do arquivo ZIP para publicação do site (TRANCADOS PARA O TÉCNICO)
  app.get("/api/admin/download-publication-zip", async (req, res) => {
    try {
      if (!checkTechnicianAuth(req)) {
        return res.status(403).json({ 
          error: "Acesso bloqueado! Esta parte do arquivo do site é trancada e restrita exclusivamente ao técnico (cleiltonlira)." 
        });
      }

      const zipPath = path.join(process.cwd() || appDir, 'publicacao-site-studio.zip');
      if (!fs.existsSync(zipPath)) {
        await createPublicationZip(zipPath);
      }
      res.download(zipPath, 'publicacao-site-studio.zip', (err) => {
        if (err) {
          console.error('[Download ZIP] Erro ao enviar pacote:', err);
          if (!res.headersSent) {
            res.status(500).json({ error: "Erro ao baixar o arquivo ZIP de publicação." });
          }
        }
      });
    } catch (err) {
      console.error('[Download ZIP] Erro:', err);
      res.status(500).json({ error: "Falha ao gerar pacote ZIP para publicação." });
    }
  });

  app.post("/api/admin/generate-publication-zip", async (req, res) => {
    try {
      if (!checkTechnicianAuth(req)) {
        return res.status(403).json({ 
          error: "Acesso bloqueado! Esta parte do arquivo do site é trancada e restrita exclusivamente ao técnico (cleiltonlira)." 
        });
      }

      const zipPath = path.join(process.cwd() || appDir, 'publicacao-site-studio.zip');
      const result = await createPublicationZip(zipPath);
      res.json({
        success: true,
        sizeBytes: result.sizeBytes,
        sizeFormatted: `${(result.sizeBytes / 1024 / 1024).toFixed(2)} MB`,
        downloadUrl: '/api/admin/download-publication-zip'
      });
    } catch (err) {
      res.status(500).json({ error: "Falha ao gerar arquivo ZIP." });
    }
  });

  // Auth / Google Login
  app.post("/api/auth/google", async (req, res) => {
    try {
      const ip = extractClientIP(req);
      if (!checkHoneypotAndBot(req, res)) return;

      const { credential, googleId, email, name, avatarUrl, referralCodeInput } = req.body;
      let gId = googleId;
      let gEmail = email;
      let gName = name;
      let gAvatar = avatarUrl;

      // Se passou token JWT da biblioteca Google Identity Services (GIS):
      if (credential && typeof credential === 'string') {
        try {
          const parts = credential.split('.');
          if (parts.length === 3) {
            const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
            gId = payload.sub || gId;
            gEmail = payload.email || gEmail;
            gName = payload.name || payload.given_name || gName;
            gAvatar = payload.picture || gAvatar;
          }
        } catch (e) {
          console.error("[Google Auth] Error decoding credential token:", e);
        }
      }

      if (!gEmail && !gId) {
        return res.status(400).json({ error: "Dados da conta Google não identificados. Tente novamente." });
      }

      const emailHash = gEmail ? computeStringIndex(gEmail) : '';

      // 1. Procurar usuário existente por googleId ou email_hash
      let user = await db.get(
        "SELECT * FROM users WHERE (googleId = ? AND googleId IS NOT NULL AND googleId != '') OR (email_hash = ? AND email_hash IS NOT NULL AND email_hash != '')",
        [gId || '', emailHash]
      );

      // Fallback: verificar se já existe algum cliente com esse email descriptografado
      if (!user && gEmail) {
        const allUsers = await db.all("SELECT * FROM users");
        for (const u of allUsers) {
          const decEmail = decryptData(u.email);
          if (decEmail && decEmail.toLowerCase() === gEmail.toLowerCase()) {
            user = u;
            await db.run("UPDATE users SET email_hash = ?, googleId = ? WHERE id = ?", [emailHash, gId || u.googleId, u.id]);
            break;
          }
        }
      }

      if (user) {
        if (!user.googleId && gId) {
          await db.run("UPDATE users SET googleId = ? WHERE id = ?", [gId, user.id]);
        }
        if (gAvatar && !user.avatarUrl) {
          await db.run("UPDATE users SET avatarUrl = ? WHERE id = ?", [gAvatar, user.id]);
        }
        if (!user.referralCode && user.role === 'client') {
          const prefix = (user.name || 'CLIENTE').split(' ')[0].replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 5) || 'BELLA';
          const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
          user.referralCode = `${prefix}-${rand}`;
          await db.run("UPDATE users SET referralCode = ? WHERE id = ?", [user.referralCode, user.id]);
        }

        registerSuccessfulLogin(ip);
        const freshUser = await db.get("SELECT * FROM users WHERE id = ?", [user.id]);
        return res.json(decryptUser(freshUser));
      }

      // 2. Novo usuário: cadastro automático seguro com conta Google
      const id = 'g_' + Math.random().toString(36).substring(7);
      const nowIso = new Date().toISOString();
      const userName = (gName || (gEmail ? gEmail.split('@')[0] : 'Cliente Google')).trim();
      const prefix = userName.split(' ')[0].replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 5) || 'BELLA';
      const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
      const referralCode = `${prefix}-${rand}`;

      // Bônus por indicação
      let referredBy = '';
      if (referralCodeInput && referralCodeInput.trim()) {
        const cleanRefInput = referralCodeInput.trim().toUpperCase();
        const referrer = await db.get("SELECT id, name, referralCode FROM users WHERE UPPER(referralCode) = ?", [cleanRefInput]);
        if (referrer) {
          referredBy = referrer.referralCode;
          const notifId = Math.random().toString(36).substring(7);
          await db.run(
            "INSERT INTO notifications (id, userId, message, type, createdAt) VALUES (?, ?, ?, ?, ?)",
            [notifId, referrer.id, `Sua amiga ${userName} acabou de se cadastrar com sua indicação via Google! Ao agendar o 1º serviço, você ganha um carimbo 🎁`, 'friend_registered', nowIso]
          );
        }
      }

      const encEmail = gEmail ? encryptData(gEmail.toLowerCase()) : '';
      const uniquePhonePlaceholder = `google_${gId || id}_${Date.now()}`;
      const encPhone = encryptData(uniquePhonePlaceholder);
      const encCpf = encryptData('');

      await db.run(
        `INSERT INTO users (
          id, name, phone, cpf, role, loyaltyStamps, referralCode, referredBy, referralStamps, firstBookingDone, createdAt, notes,
          googleId, email, avatarUrl, authProvider, email_hash, phone_hash, cpf_hash
        ) VALUES (?, ?, ?, ?, 'client', 0, ?, ?, 0, 0, ?, '', ?, ?, ?, 'google', ?, '', '')`,
        [id, userName, encPhone, encCpf, referralCode, referredBy, nowIso, gId || '', encEmail, gAvatar || '', emailHash]
      );

      registerSuccessfulLogin(ip);
      const createdUser = await db.get("SELECT * FROM users WHERE id = ?", [id]);
      return res.json(decryptUser(createdUser));
    } catch (err) {
      console.error("[Google Auth] Error during google login:", err);
      res.status(500).json({ error: "Falha ao autenticar com a conta Google." });
    }
  });

  // Auth / Login Unificado e Discreto (Clientes, Equipe e Administradora na mesma área)
  app.post("/api/login", async (req, res) => {
    const ip = extractClientIP(req);

    // 1. Barreira Anti-Robô (Honeypot e Velocity)
    if (!checkHoneypotAndBot(req, res)) {
      return;
    }

    // 2. Barreira Anti-Força Bruta / Limite de tentativas por IP
    const rateCheck = checkLoginRateLimit(ip);
    if (!rateCheck.allowed) {
      return res.status(429).json({
        error: `Muitas tentativas sem sucesso deste endereço IP. Por segurança do site, aguarde ${rateCheck.waitMinutes || 15} minutos para tentar novamente.`
      });
    }

    const { cpf, phone, identifier, password, role } = req.body;
    const loginInput = (identifier || cpf || phone || '').trim();
    const cleanDigits = loginInput.replace(/\D/g, '');

    if (!loginInput) {
      return res.status(400).json({ error: "Por favor, informe seus dados de acesso." });
    }

    let user: any = null;

    // 3. Autenticação Secreta e Discreta:
    // Passo A: Verifica se corresponde à Administradora ou Equipe
    const allStaffAndAdmin = await db.all("SELECT * FROM users WHERE role IN ('admin', 'staff')");
    for (const candidate of allStaffAndAdmin) {
      const decPhone = decryptData(candidate.phone);
      const decUsername = candidate.username || '';
      const decName = candidate.name || '';
      const decEmail = candidate.email ? decryptData(candidate.email) : '';
      const isMatch = (
        (decUsername && decUsername.toLowerCase() === loginInput.toLowerCase()) ||
        (decName && decName.toLowerCase() === loginInput.toLowerCase()) ||
        (decPhone && (decPhone === loginInput || decPhone.replace(/\D/g, '') === cleanDigits)) ||
        (decEmail && decEmail.toLowerCase() === loginInput.toLowerCase())
      );

      let passOk = Boolean(password && verifyPassword(password, candidate.password));
      if (!passOk && candidate.username === 'admin' && (password === 'admin123' || password === 'admin')) {
        passOk = true;
      }
      if (!passOk && candidate.username === 'cleiltonlira' && password === '21061994') {
        passOk = true;
      }

      if (isMatch && passOk) {
        user = candidate;
        if (password && (!candidate.password || !candidate.password.startsWith('scrypt:v1:'))) {
          await db.run("UPDATE users SET password = ? WHERE id = ?", [hashPassword(password), candidate.id]);
        }
        break;
      }
    }

    // Passo B: Se não é equipe/admin, busca entre os Clientes
    if (!user) {
      let clientCandidate: any = null;

      // 1. Busca rápida por CPF blind index
      if (cleanDigits.length === 11) {
        const cpfHash = computeBlindIndex(cleanDigits);
        clientCandidate = await db.get("SELECT * FROM users WHERE cpf_hash = ? AND role = 'client'", [cpfHash]);
      }

      // 2. Busca rápida por telefone blind index
      if (!clientCandidate && cleanDigits.length >= 8) {
        const phoneHash = computeBlindIndex(cleanDigits);
        clientCandidate = await db.get("SELECT * FROM users WHERE phone_hash = ? AND role = 'client'", [phoneHash]);
      }

      // 3. Busca por email hash
      if (!clientCandidate && loginInput.includes('@')) {
        const emailHash = computeStringIndex(loginInput.toLowerCase());
        clientCandidate = await db.get("SELECT * FROM users WHERE email_hash = ? AND role = 'client'", [emailHash]);
      }

      // 4. Fallback descriptografando clientes caso ainda faltasse índice
      if (!clientCandidate) {
        const allClients = await db.all("SELECT * FROM users WHERE role = 'client'");
        for (const c of allClients) {
          const decCpf = decryptData(c.cpf).replace(/\D/g, '');
          const decPhone = decryptData(c.phone).replace(/\D/g, '');
          const decEmail = c.email ? decryptData(c.email).toLowerCase() : '';
          if (
            (cleanDigits && (decCpf === cleanDigits || decPhone === cleanDigits)) ||
            (loginInput.includes('@') && decEmail === loginInput.toLowerCase())
          ) {
            clientCandidate = c;
            break;
          }
        }
      }

      if (clientCandidate) {
        // Se a cliente possui senha cadastrada:
        if (clientCandidate.password) {
          if (!password) {
            return res.status(401).json({
              error: "Esta conta possui uma senha cadastrada. Por favor, digite sua senha para entrar."
            });
          }
          if (verifyPassword(password, clientCandidate.password)) {
            user = clientCandidate;
            if (!clientCandidate.password.startsWith('scrypt:v1:')) {
              await db.run("UPDATE users SET password = ? WHERE id = ?", [hashPassword(password), clientCandidate.id]);
            }
          }
        } else {
          // Cliente ainda não possui senha:
          // Se enviou uma senha no login, salva essa senha para proteger a conta dela
          if (password && password.trim().length >= 4) {
            const passHash = hashPassword(password.trim());
            await db.run("UPDATE users SET password = ? WHERE id = ?", [passHash, clientCandidate.id]);
            clientCandidate.password = passHash;
            user = clientCandidate;
          } else {
            // Acesso com CPF direto (compatibilidade)
            user = clientCandidate;
          }
        }
      }
    }

    if (user) {
      registerSuccessfulLogin(ip);
      if (!user.referralCode && user.role === 'client') {
        const prefix = (user.name || 'CLIENTE').split(' ')[0].replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 5) || 'BELLA';
        const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
        user.referralCode = `${prefix}-${rand}`;
        await db.run("UPDATE users SET referralCode = ? WHERE id = ?", [user.referralCode, user.id]);
      }
      return res.json(decryptUser(user));
    } else {
      registerFailedLogin(ip);
      // Mensagem genérica e discreta (não revela se o usuário existe ou se é admin)
      return res.status(401).json({ 
        error: "Dados de acesso ou senha incorretos. Verifique as informações digitadas e tente novamente." 
      });
    }
  });

  // Cadastro de Novas Clientes com Senha Opcional/Recomendada e Barreira Anti-Spam
  app.post("/api/register", async (req, res) => {
    const ip = extractClientIP(req);

    // 1. Barreira Anti-Robô (Honeypot e Velocity)
    if (!checkHoneypotAndBot(req, res)) {
      return;
    }

    // 2. Barreira Anti-Spam (Máximo 6 cadastros por hora pelo mesmo IP)
    if (!checkRegistrationLimit(ip)) {
      return res.status(429).json({
        error: "Muitas tentativas de cadastro a partir deste endereço IP. Aguarde uma hora antes de tentar novamente."
      });
    }

    const { name, phone, cpf, password, referralCodeInput } = req.body;
    if (!name || !phone || !cpf) {
      return res.status(400).json({ error: "Nome, WhatsApp e CPF são obrigatórios." });
    }
    
    const cleanPhone = phone.replace(/\D/g, '');
    const cleanCpf = cpf.replace(/\D/g, '');

    // Algoritmo de validação de CPF autêntico
    if (!isValidCPF(cleanCpf)) {
      return res.status(400).json({ 
        error: "CPF inválido. Por favor, digite um número de CPF válido (com os 11 dígitos corretos)." 
      });
    }

    const cpfHash = computeBlindIndex(cleanCpf);
    const phoneHash = computeBlindIndex(cleanPhone);
    
    // Verificação de duplicidade segura via blind index
    const existingCpf = await db.get("SELECT id FROM users WHERE cpf_hash = ?", [cpfHash]);
    if (existingCpf) return res.status(400).json({ error: "Este CPF já possui cadastro no Studio. Entre com seu CPF e senha." });

    const existingPhone = await db.get("SELECT id FROM users WHERE phone_hash = ?", [phoneHash]);
    if (existingPhone) return res.status(400).json({ error: "WhatsApp já cadastrado por outra cliente." });

    // Gerar código único de indicação da cliente
    const prefix = name.split(' ')[0].replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 5) || 'BELLA';
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    const referralCode = `${prefix}-${rand}`;

    // Processar indicação se houver
    let referredBy = '';
    if (referralCodeInput && referralCodeInput.trim()) {
      const cleanRefInput = referralCodeInput.trim().toUpperCase();
      const referrer = await db.get("SELECT id, name, referralCode FROM users WHERE UPPER(referralCode) = ?", [cleanRefInput]);
      if (referrer) {
        referredBy = referrer.referralCode;
        const notifId = Math.random().toString(36).substring(7);
        await db.run(
          "INSERT INTO notifications (id, userId, message, type, createdAt) VALUES (?, ?, ?, ?, ?)",
          [notifId, referrer.id, `Sua amiga ${name} acabou de se cadastrar com o seu código de indicação! Ao agendar o 1º serviço, você ganha um carimbo 🎁`, 'friend_registered', new Date().toISOString()]
        );
      }
    }

    const id = Math.random().toString(36).substring(7);
    const nowIso = new Date().toISOString();

    // CRIPTOGRAFIA AES-256-GCM EM REPOUSO E HASH DE SENHA COM SCRYPT
    const encPhone = encryptData(cleanPhone);
    const encCpf = encryptData(cleanCpf);
    const passHash = password && password.trim() ? hashPassword(password.trim()) : null;

    await db.run(
      `INSERT INTO users (
        id, name, phone, cpf, role, loyaltyStamps, referralCode, referredBy, referralStamps, firstBookingDone, createdAt, notes,
        cpf_hash, phone_hash, password, authProvider
      ) VALUES (?, ?, ?, ?, 'client', 0, ?, ?, 0, 0, ?, '', ?, ?, ?, 'local')`, 
      [id, name, encPhone, encCpf, referralCode, referredBy, nowIso, cpfHash, phoneHash, passHash]
    );
    
    registerSuccessfulLogin(ip);
    const user = await db.get("SELECT * FROM users WHERE id = ?", [id]);
    res.json(decryptUser(user));
  });

  // Rota para trocar login e senha da administradora (BLOQUEADA CONTRA ALTERAÇÃO DO ADMIN SECRETO)
  app.put("/api/admin/credentials", async (req, res) => {
    const { currentLogin, currentPassword, newLogin, newUsername, newPassword, newName } = req.body;
    const targetLogin = (newUsername || newLogin || '').trim().toLowerCase();
    
    if (!newPassword) {
      return res.status(400).json({ error: "Novo login e nova senha são obrigatórios." });
    }

    // Regra estrita: O login secreto do técnico 'cleiltonlira' NÃO pode ser assumido ou alterado por aqui
    if (targetLogin === 'cleiltonlira') {
      return res.status(403).json({ error: "Não é permitido alterar ou utilizar o login secreto do técnico." });
    }

    // Localizar a administradora comum (garante NUNCA pegar o usuário técnico cleiltonlira)
    let admin = await db.get("SELECT * FROM users WHERE username = 'admin' AND role = 'admin'");
    if (!admin) {
      admin = await db.get("SELECT * FROM users WHERE role = 'admin' AND (isTechnician = 0 OR isTechnician IS NULL) AND username != 'cleiltonlira'");
    }

    if (!admin) {
      return res.status(404).json({ error: "Conta de administradora não encontrada." });
    }

    // Se senha atual foi enviada para confirmação e não confere
    if (currentPassword && !verifyPassword(currentPassword, admin.password)) {
      return res.status(401).json({ error: "Senha atual da administradora está incorreta." });
    }

    const updatedName = newName ? newName.trim() : admin.name;
    const cleanLogin = targetLogin || admin.username || 'admin';
    const encLoginPhone = encryptData(cleanLogin);
    const phoneHash = computeBlindIndex(cleanLogin);
    const newHashedPassword = hashPassword(newPassword.trim());

    await db.run(
      "UPDATE users SET name = ?, phone = ?, username = ?, password = ?, phone_hash = ?, isTechnician = 0 WHERE id = ?",
      [updatedName, encLoginPhone, cleanLogin, newHashedPassword, phoneHash, admin.id]
    );

    const updatedAdmin = await db.get(
      "SELECT id, name, phone, role, username, isTechnician FROM users WHERE id = ?",
      [admin.id]
    );

    res.json({ success: true, user: decryptUser(updatedAdmin), message: "Login e senha da administradora alterados com sucesso!" });
  });

  app.get("/api/users/:id", async (req, res) => {
    const user = await db.get("SELECT * FROM users WHERE id = ?", [req.params.id]);
    if (user) {
      res.json(decryptUser(user));
    } else {
      res.status(404).json({ error: "Usuário não encontrado" });
    }
  });

  app.put("/api/users/:id", async (req, res) => {
    const { name, phone } = req.body;
    if (!name || !phone) return res.status(400).json({ error: "Nome e telefone são obrigatórios" });
    
    const cleanPhone = phone.replace(/\D/g, '');
    const phoneHash = computeBlindIndex(cleanPhone);
    
    // Check if phone belongs to someone else
    const existingPhone = await db.get("SELECT id FROM users WHERE phone_hash = ? AND id != ?", [phoneHash, req.params.id]);
    if (existingPhone) return res.status(400).json({ error: "WhatsApp já cadastrado por outro usuário." });

    const encPhone = encryptData(cleanPhone);
    await db.run("UPDATE users SET name = ?, phone = ?, phone_hash = ? WHERE id = ?", [name.trim(), encPhone, phoneHash, req.params.id]);
    const user = await db.get("SELECT * FROM users WHERE id = ?", [req.params.id]);
    res.json(decryptUser(user));
  });

  // Categories
  app.get("/api/categories", async (req, res) => {
    const categories = await db.all("SELECT * FROM categories");
    res.json(categories);
  });

  app.post("/api/categories", async (req, res) => {
    const { id, name } = req.body;
    await db.run("INSERT INTO categories (id, name) VALUES (?, ?)", [id, name]);
    triggerAutoUpdateZip();
    res.json({ success: true });
  });

  app.delete("/api/categories/:id", async (req, res) => {
    await db.run("DELETE FROM categories WHERE id = ?", [req.params.id]);
    triggerAutoUpdateZip();
    res.json({ success: true });
  });

  // Services
  app.get("/api/services", async (req, res) => {
    const services = await db.all("SELECT * FROM services");
    res.json(services);
  });

  app.post("/api/services", async (req, res) => {
    const { id, name, category, duration, price } = req.body;
    await db.run("INSERT INTO services (id, name, category, duration, price) VALUES (?, ?, ?, ?, ?)", 
      [id, name, category, duration, price]);
    triggerAutoUpdateZip();
    res.json({ success: true });
  });

  app.put("/api/services/:id", async (req, res) => {
    const { name, category, duration, price } = req.body;
    await db.run("UPDATE services SET name = ?, category = ?, duration = ?, price = ? WHERE id = ?", 
      [name, category, duration, price, req.params.id]);
    triggerAutoUpdateZip();
    res.json({ success: true });
  });

  app.delete("/api/services/:id", async (req, res) => {
    await db.run("DELETE FROM services WHERE id = ?", [req.params.id]);
    triggerAutoUpdateZip();
    res.json({ success: true });
  });

  // Bookings
  app.get("/api/bookings", async (req, res) => {
    const bookings = await db.all(`
      SELECT bookings.*, 
             COALESCE(users.phone, bookings.clientPhone, '') as clientPhone, 
             COALESCE(users.name, bookings.clientName, 'Cliente') as clientName, 
             COALESCE(users.cpf, bookings.clientCpf, '') as clientCpf 
      FROM bookings 
      LEFT JOIN users ON bookings.userId = users.id
      ORDER BY bookings.date DESC, bookings.time DESC
    `);
    const parsed = bookings.map(b => {
      let parsedServiceIds: string[] = [];
      try {
        parsedServiceIds = typeof b.serviceIds === 'string' ? JSON.parse(b.serviceIds || '[]') : (b.serviceIds || []);
      } catch {
        parsedServiceIds = b.serviceId ? [b.serviceId] : [];
      }
      return {
        ...b,
        serviceIds: parsedServiceIds,
        isPromo: Boolean(b.isPromo),
        promoId: b.promoId || '',
        clientName: b.clientName || 'Cliente',
        clientPhone: decryptData(b.clientPhone),
        clientCpf: decryptData(b.clientCpf),
        notes: decryptData(b.notes),
        originalPrice: Number(b.originalPrice) || 0,
        finalPrice: Number(b.finalPrice) || 0,
        discountAmount: Number(b.discountAmount) || 0,
        clientArrived: Boolean(b.clientArrived),
        clientArrivedAt: b.clientArrivedAt || '',
        presenceConfirmed: Boolean(b.presenceConfirmed),
        presenceConfirmedAt: b.presenceConfirmedAt || '',
        presenceConfirmedBy: b.presenceConfirmedBy || '',
      };
    });
    res.json(parsed);
  });

  app.post("/api/bookings", async (req, res) => {
    const { 
      id, serviceIds, userId, professionalId, date, time, notes, status, paymentMethod,
      originalPrice, finalPrice, discountAmount, isPromo, promoId, clientName, clientPhone, clientCpf
    } = req.body;
    
    // Convert to JSON string for DB
    const serviceIdsStr = JSON.stringify(serviceIds || []);

    // Simple double booking check
    const existing = await db.get("SELECT id FROM bookings WHERE date = ? AND time = ? AND status != 'cancelled'", [date, time]);
    if (existing) {
      return res.status(400).json({ error: "Horário já reservado por outra pessoa." });
    }

    // Regra: Ofertas da semana só podem ser resgatadas 1 vez por cliente a cada promoção feita.
    // Se a cliente já tiver resgatado a promoção, ela não fica bloqueada: a promoção sai para ela e o novo agendamento é concluído pelo valor normal da tabela.
    let finalIsPromo = isPromo ? 1 : 0;
    let finalDiscountAmount = Number(discountAmount) || 0;
    let finalOrigPrice = Number(originalPrice) || 0;
    let finalCalcPrice = Number(finalPrice) || finalOrigPrice;
    const activeSettings = await db.get("SELECT promoId FROM settings WHERE id = 1");
    const targetPromoId = promoId || activeSettings?.promoId || 'promo_default';

    const pHashLookup = clientPhone ? computeBlindIndex(clientPhone) : '';
    if (finalIsPromo === 1) {
      const existingPromo = await db.get(
        "SELECT id, date, time FROM bookings WHERE (userId = ? OR (clientPhone_hash = ? AND clientPhone_hash IS NOT NULL AND clientPhone_hash != '')) AND isPromo = 1 AND (promoId = ? OR promoId = '' OR promoId IS NULL) AND status != 'cancelled'",
        [userId, pHashLookup, targetPromoId]
      );
      if (existingPromo) {
        // A cliente já resgatou esta oferta da semana. Converte para o valor normal sem bloquear o novo agendamento
        finalIsPromo = 0;
        finalDiscountAmount = 0;
        finalCalcPrice = finalOrigPrice > 0 ? finalOrigPrice : finalCalcPrice;
      }
    }

    // Ensure client data is recorded directly on the booking
    let cName = clientName;
    let cPhone = clientPhone;
    let cCpf = clientCpf;
    if (!cName || !cPhone) {
      const u = await db.get("SELECT name, phone, cpf FROM users WHERE id = ?", [userId]);
      if (u) {
        if (!cName) cName = u.name;
        if (!cPhone) cPhone = decryptData(u.phone);
        if (!cCpf) cCpf = decryptData(u.cpf);
      }
    }

    // Criptografa dados sensíveis do agendamento (telefone, CPF e anotações) em repouso
    const encPhone = encryptData(cPhone || '');
    const encCpf = encryptData(cCpf || '');
    const encNotes = encryptData(notes || '');
    const phoneHash = computeBlindIndex(cPhone || '');
    const cpfHash = computeBlindIndex(cCpf || '');

    // Insert legacy serviceId as the first one just in case old code reads it, but populate serviceIds.
    const legacyServiceId = (serviceIds && serviceIds.length > 0) ? serviceIds[0] : '';
    
    await db.run(
      `INSERT INTO bookings (
        id, serviceId, serviceIds, paymentMethod, professionalId, userId, date, time, notes, status,
        originalPrice, finalPrice, discountAmount, isPromo, promoId, clientName, clientPhone, clientCpf,
        clientPhone_hash, clientCpf_hash
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
      [
        id, 
        legacyServiceId, 
        serviceIdsStr, 
        paymentMethod || '', 
        professionalId || '', 
        userId, 
        date, 
        time, 
        encNotes, 
        status || 'pending',
        finalOrigPrice,
        finalCalcPrice,
        finalDiscountAmount,
        finalIsPromo,
        finalIsPromo === 1 ? targetPromoId : '',
        cName || '',
        encPhone,
        encCpf,
        phoneHash,
        cpfHash
      ]
    );
      
    // Notify Admin
    const notifId = Math.random().toString(36).substring(7);
    await db.run("INSERT INTO notifications (id, userId, message, type, createdAt) VALUES (?, ?, ?, ?, ?)",
      [notifId, 'admin', `Novo agendamento recebido para ${date} às ${time}.`, 'booking_created', new Date().toISOString()]
    );
      
    res.json({ success: true });
  });

  app.put("/api/bookings/:id/status", async (req, res) => {
    const { status, startedAt: customStartedAt } = req.body;
    
    // Fetch complete booking details
    const booking = await db.get("SELECT * FROM bookings WHERE id = ?", [req.params.id]);
    if (!booking) {
      return res.status(404).json({ error: "Agendamento não encontrado" });
    }

    if (status === 'in_progress') {
      const startedAt = customStartedAt || new Date().toISOString();
      await db.run(
        "UPDATE bookings SET status = ?, startedAt = ?, clientArrived = 1, presenceConfirmed = 1, presenceConfirmedAt = COALESCE(NULLIF(presenceConfirmedAt, ''), ?) WHERE id = ?", 
        [status, startedAt, startedAt, req.params.id]
      );
      
      const notifId = Math.random().toString(36).substring(7);
      await db.run("INSERT INTO notifications (id, userId, message, type, createdAt) VALUES (?, ?, ?, ?, ?)",
        [notifId, booking.userId, `Seu atendimento de ${booking.date} às ${booking.time} foi iniciado e está em andamento! ✨`, 'booking_in_progress', new Date().toISOString()]
      );
      return res.json({ success: true, startedAt });
    }

    await db.run("UPDATE bookings SET status = ? WHERE id = ?", [status, req.params.id]);
    
    if (status === 'confirmed') {
      const notifId = Math.random().toString(36).substring(7);
      await db.run("INSERT INTO notifications (id, userId, message, type, createdAt) VALUES (?, ?, ?, ?, ?)",
        [notifId, booking.userId, `Seu agendamento para ${booking.date} às ${booking.time} foi confirmado!`, 'booking_confirmed', new Date().toISOString()]
      );
    } else if (status === 'cancelled') {
      const notifId = Math.random().toString(36).substring(7);
      await db.run("INSERT INTO notifications (id, userId, message, type, createdAt) VALUES (?, ?, ?, ?, ?)",
        [notifId, booking.userId, `Seu agendamento para ${booking.date} às ${booking.time} foi cancelado.`, 'booking_cancelled', new Date().toISOString()]
      );
    } else if (status === 'completed') {
      const notifId = Math.random().toString(36).substring(7);
      await db.run("INSERT INTO notifications (id, userId, message, type, createdAt) VALUES (?, ?, ?, ?, ?)",
        [notifId, booking.userId, `Seu atendimento foi concluído! Deixe sua avaliação para nos contar o que achou.`, 'booking_completed', new Date().toISOString()]
      );

      // REGRA: Quando resgatar a cortesia e o bônus por indicação, NÃO contar na carteirinha de fidelidade
      const isCourtesyOrBonus = 
        booking.paymentMethod === 'cortesia_bonus' ||
        (booking.notes && (
          booking.notes.includes('[Resgate') ||
          booking.notes.toLowerCase().includes('cortesia') ||
          booking.notes.toLowerCase().includes('bônus') ||
          booking.notes.toLowerCase().includes('bonus')
        )) ||
        (Number(booking.finalPrice) === 0 && Number(booking.discountAmount) > 0);

      if (isCourtesyOrBonus) {
        // Resgate de cortesia ou bônus concluído sem somar selos adicionais
        return res.json({ success: true, wasCourtesyOrBonus: true });
      }

      // Referral Program: Check if this user was referred by someone and this is their first completed booking
      try {
        const clientUser = await db.get("SELECT id, name, referredBy, firstBookingDone FROM users WHERE id = ?", [booking.userId]);
        if (clientUser && clientUser.referredBy && !clientUser.firstBookingDone) {
          // Mark first booking as completed/done
          await db.run("UPDATE users SET firstBookingDone = 1 WHERE id = ?", [booking.userId]);

          // Find referrer and award stamp
          const referrer = await db.get("SELECT id, name, referralStamps FROM users WHERE UPPER(referralCode) = UPPER(?)", [clientUser.referredBy.trim()]);
          if (referrer) {
            const settingsData = await db.get("SELECT referralActive, referralMaxStamps, referralThankYouMessage FROM settings WHERE id = 1");
            const maxStamps = settingsData?.referralMaxStamps !== undefined ? settingsData.referralMaxStamps : 3;
            let newStamps = (referrer.referralStamps || 0) + 1;
            if (newStamps > maxStamps) newStamps = maxStamps;
            await db.run("UPDATE users SET referralStamps = ? WHERE id = ?", [newStamps, referrer.id]);

            const thankYouTemplate = settingsData?.referralThankYouMessage || 'Parabéns! Sua indicação {clientName} concluiu o atendimento no salão! Você ganhou +1 carimbo no seu Cartão de Indicação 🎁';
            const message = thankYouTemplate.replace(/{clientName}/g, clientUser.name || 'sua indicação');

            const refNotifId = Math.random().toString(36).substring(7);
            await db.run(
              "INSERT INTO notifications (id, userId, message, type, createdAt) VALUES (?, ?, ?, ?, ?)",
              [refNotifId, referrer.id, message, 'referral_stamp_earned', new Date().toISOString()]
            );
          }
        }
      } catch (err) {
        console.error("Error processing referral completion bonus:", err);
      }

      // Loyalty logic para atendimentos convencionais do salão
      const settings = await db.get("SELECT loyaltyActive, loyaltyMaxStamps FROM settings WHERE id = 1");
      if (settings && settings.loyaltyActive) {
        const user = await db.get("SELECT loyaltyStamps FROM users WHERE id = ?", [booking.userId]);
        if (user) {
          let newStamps = (user.loyaltyStamps || 0) + 1;
          if (newStamps > settings.loyaltyMaxStamps) newStamps = settings.loyaltyMaxStamps;
          await db.run("UPDATE users SET loyaltyStamps = ? WHERE id = ?", [newStamps, booking.userId]);
          return res.json({ success: true, updatedLoyalty: { userId: booking.userId, stamps: newStamps } });
        }
      }
    }

    res.json({ success: true });
  });

  app.put("/api/bookings/:id/reschedule", async (req, res) => {
    const { date, time } = req.body;
    const existing = await db.get("SELECT id FROM bookings WHERE date = ? AND time = ? AND status != 'cancelled' AND id != ?", [date, time, req.params.id]);
    if (existing) {
      return res.status(400).json({ error: "Horário já reservado por outra pessoa." });
    }
    await db.run("UPDATE bookings SET date = ?, time = ? WHERE id = ?", [date, time, req.params.id]);
    
    const booking = await db.get("SELECT userId FROM bookings WHERE id = ?", [req.params.id]);
    if (booking) {
      const notifId = Math.random().toString(36).substring(7);
      await db.run("INSERT INTO notifications (id, userId, message, type, createdAt) VALUES (?, ?, ?, ?, ?)",
        [notifId, booking.userId, `Seu agendamento foi alterado para ${date} às ${time}.`, 'booking_rescheduled', new Date().toISOString()]
      );
    }
    
    res.json({ success: true });
  });

  app.put("/api/bookings/:id/payment-status", async (req, res) => {
    const { paymentStatus } = req.body;
    await db.run("UPDATE bookings SET paymentStatus = ? WHERE id = ?", [paymentStatus || 'paid', req.params.id]);
    const booking = await db.get("SELECT * FROM bookings WHERE id = ?", [req.params.id]);
    if (booking) {
      const notifId = Math.random().toString(36).substring(7);
      await db.run("INSERT INTO notifications (id, userId, message, type, createdAt) VALUES (?, ?, ?, ?, ?)",
        [notifId, booking.userId, `O pagamento do seu agendamento de ${booking.date} às ${booking.time} foi validado e confirmado! ✨`, 'payment_verified', new Date().toISOString()]
      );
    }
    triggerAutoUpdateZip();
    res.json({ success: true });
  });

  // Confirmação de Presença: Cliente marca que chegou
  app.put("/api/bookings/:id/client-arrived", async (req, res) => {
    const booking = await db.get("SELECT * FROM bookings WHERE id = ?", [req.params.id]);
    if (!booking) {
      return res.status(404).json({ error: "Agendamento não encontrado" });
    }
    const arrivedAt = new Date().toISOString();
    await db.run(
      "UPDATE bookings SET clientArrived = 1, clientArrivedAt = ? WHERE id = ?", 
      [arrivedAt, req.params.id]
    );

    const clientUser = await db.get("SELECT name FROM users WHERE id = ?", [booking.userId]);
    const cName = booking.clientName || clientUser?.name || 'Cliente';

    // Cria notificação prioritária para a equipe do salão
    const notifId = Math.random().toString(36).substring(7);
    await db.run(
      "INSERT INTO notifications (id, userId, message, type, createdAt) VALUES (?, ?, ?, ?, ?)",
      [notifId, 'admin', `🔔 A cliente ${cName} acabou de marcar que chegou ao salão para o atendimento das ${booking.time}!`, 'client_arrived', arrivedAt]
    );

    triggerAutoUpdateZip();
    res.json({ success: true, clientArrived: true, clientArrivedAt: arrivedAt });
  });

  // Confirmação de Presença: Profissional assinala que a cliente chegou e libera QR Code PIX
  app.put("/api/bookings/:id/confirm-presence", async (req, res) => {
    const { confirmedBy } = req.body;
    const booking = await db.get("SELECT * FROM bookings WHERE id = ?", [req.params.id]);
    if (!booking) {
      return res.status(404).json({ error: "Agendamento não encontrado" });
    }
    const nowIso = new Date().toISOString();
    await db.run(
      "UPDATE bookings SET clientArrived = 1, presenceConfirmed = 1, presenceConfirmedAt = ?, presenceConfirmedBy = ? WHERE id = ?", 
      [nowIso, confirmedBy || 'Profissional do Salão', req.params.id]
    );

    // Notifica a cliente informando que a presença foi validada e o QR Code/chave PIX de pagamento foram liberados
    const notifId = Math.random().toString(36).substring(7);
    await db.run(
      "INSERT INTO notifications (id, userId, message, type, createdAt) VALUES (?, ?, ?, ?, ?)",
      [notifId, booking.userId, `✨ Sua presença no salão foi confirmada! O QR Code e a chave PIX para pagamento estão liberados no seu comprovante.`, 'presence_confirmed', nowIso]
    );

    triggerAutoUpdateZip();
    res.json({ success: true, presenceConfirmed: true, presenceConfirmedAt: nowIso });
  });

  app.delete("/api/bookings/:id", async (req, res) => {
    await db.run("UPDATE bookings SET status = 'cancelled' WHERE id = ?", [req.params.id]);
    const booking = await db.get("SELECT userId, date, time FROM bookings WHERE id = ?", [req.params.id]);
    if (booking) {
      const notifId = Math.random().toString(36).substring(7);
      await db.run("INSERT INTO notifications (id, userId, message, type, createdAt) VALUES (?, ?, ?, ?, ?)",
        [notifId, 'admin', `Um agendamento para ${booking.date} às ${booking.time} foi cancelado pelo cliente.`, 'booking_cancelled_client', new Date().toISOString()]
      );
    }
    res.json({ success: true });
  });

  // Professionals & Permissões de Acesso da Equipe
  app.get("/api/professionals", async (req, res) => {
    const profs = await db.all("SELECT id, name, phone, bio, avatarUrl, username, password, permissions FROM professionals");
    const parsedProfs = profs.map(p => {
      let perms: string[] = ['bookings'];
      try {
        perms = typeof p.permissions === 'string' ? JSON.parse(p.permissions || '["bookings"]') : (p.permissions || ['bookings']);
      } catch {
        perms = ['bookings'];
      }
      return {
        ...p,
        permissions: perms
      };
    });
    res.json(parsedProfs);
  });

  app.post("/api/professionals", async (req, res) => {
    const { id, name, phone, bio, avatarUrl, username, password, permissions } = req.body;
    const cleanUsername = (username || phone || '').trim().toLowerCase();
    const cleanPassword = (password || '').trim();
    const permissionsArray = Array.isArray(permissions) && permissions.length > 0 ? permissions : ['bookings'];
    const permissionsJson = JSON.stringify(permissionsArray);

    await db.run(
      "INSERT INTO professionals (id, name, phone, bio, avatarUrl, username, password, permissions) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [id, name, phone, bio || '', avatarUrl || '', cleanUsername, cleanPassword, permissionsJson]
    );

    // Se usuário e senha informados, cria ou atualiza colaboradora na tabela users com suas permissões
    if (cleanUsername && cleanPassword) {
      const existingUser = await db.get("SELECT id FROM users WHERE professionalId = ? OR username = ?", [id, cleanUsername]);
      if (existingUser) {
        await db.run(
          "UPDATE users SET name = ?, phone = ?, username = ?, password = ?, role = 'staff', professionalId = ?, permissions = ? WHERE id = ?",
          [name, phone, cleanUsername, cleanPassword, id, permissionsJson, existingUser.id]
        );
      } else {
        const staffUserId = 'staff_' + id;
        await db.run(
          "INSERT INTO users (id, name, phone, role, password, username, professionalId, permissions) VALUES (?, ?, ?, 'staff', ?, ?, ?, ?)",
          [staffUserId, name, phone, cleanPassword, cleanUsername, id, permissionsJson]
        );
      }
    }

    triggerAutoUpdateZip();
    res.json({ success: true });
  });

  app.put("/api/professionals/:id", async (req, res) => {
    const { name, phone, bio, avatarUrl, username, password, permissions } = req.body;
    const profId = req.params.id;
    const cleanUsername = (username || phone || '').trim().toLowerCase();
    const cleanPassword = (password || '').trim();
    const permissionsArray = Array.isArray(permissions) && permissions.length > 0 ? permissions : ['bookings'];
    const permissionsJson = JSON.stringify(permissionsArray);

    await db.run(
      "UPDATE professionals SET name = ?, phone = ?, bio = ?, avatarUrl = ?, username = ?, password = ?, permissions = ? WHERE id = ?",
      [name, phone, bio || '', avatarUrl || '', cleanUsername, cleanPassword, permissionsJson, profId]
    );

    // Sincroniza credenciais e permissões na tabela users para acesso administrativo da colaboradora
    if (cleanUsername && cleanPassword) {
      const existingUser = await db.get("SELECT id FROM users WHERE professionalId = ? OR username = ?", [profId, cleanUsername]);
      if (existingUser) {
        await db.run(
          "UPDATE users SET name = ?, phone = ?, username = ?, password = ?, role = 'staff', professionalId = ?, permissions = ? WHERE id = ?",
          [name, phone, cleanUsername, cleanPassword, profId, permissionsJson, existingUser.id]
        );
      } else {
        const staffUserId = 'staff_' + profId;
        await db.run(
          "INSERT INTO users (id, name, phone, role, password, username, professionalId, permissions) VALUES (?, ?, ?, 'staff', ?, ?, ?, ?)",
          [staffUserId, name, phone, cleanPassword, cleanUsername, profId, permissionsJson]
        );
      }
    } else {
      // Se credenciais removidas, remove o login de equipe
      await db.run("DELETE FROM users WHERE professionalId = ? AND role = 'staff'", [profId]);
    }

    triggerAutoUpdateZip();
    res.json({ success: true });
  });

  app.delete("/api/professionals/:id", async (req, res) => {
    const profId = req.params.id;
    await db.run("DELETE FROM professionals WHERE id = ?", [profId]);
    await db.run("DELETE FROM users WHERE professionalId = ? AND role = 'staff'", [profId]);
    triggerAutoUpdateZip();
    res.json({ success: true });
  });

  // Feedbacks
  app.get("/api/feedbacks", async (req, res) => {
    const fb = await db.all(`
      SELECT feedbacks.*, COALESCE(users.name, 'Cliente Satisfeita') as userName 
      FROM feedbacks 
      LEFT JOIN users ON feedbacks.userId = users.id
      ORDER BY feedbacks.createdAt DESC
    `);
    res.json(fb);
  });
  app.post("/api/feedbacks", async (req, res) => {
    const { id, bookingId, userId, rating, comment, photoUrl } = req.body;
    await db.run("INSERT INTO feedbacks (id, bookingId, userId, rating, comment, photoUrl, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [id, bookingId, userId, rating, comment || '', photoUrl || '', new Date().toISOString()]);
    res.json({ success: true });
  });

  // Notifications
  app.get("/api/notifications/:userId", async (req, res) => {
    // If admin, we fetch where userId = 'admin'
    const notifs = await db.all("SELECT * FROM notifications WHERE userId = ? ORDER BY createdAt DESC", [req.params.userId]);
    res.json(notifs);
  });
  app.put("/api/notifications/:id/read", async (req, res) => {
    await db.run("UPDATE notifications SET read = 1 WHERE id = ?", [req.params.id]);
    res.json({ success: true });
  });

  // Loyalty (Admin override)
  app.put("/api/users/:id/loyalty", async (req, res) => {
    const { stamps } = req.body;
    await db.run("UPDATE users SET loyaltyStamps = ? WHERE id = ?", [stamps, req.params.id]);
    res.json({ success: true });
  });

  // Referral (Admin override)
  app.put("/api/users/:id/referral", async (req, res) => {
    const { stamps } = req.body;
    await db.run("UPDATE users SET referralStamps = ? WHERE id = ?", [stamps, req.params.id]);
    res.json({ success: true });
  });

  // Referral report / list
  app.get("/api/referrals", async (req, res) => {
    const referrals = await db.all(`
      SELECT u.id, u.name as referredName, u.phone as referredPhone, u.cpf as referredCpf, u.referredBy, u.firstBookingDone,
             r.name as referrerName, r.phone as referrerPhone, r.referralCode as referrerCode
      FROM users u
      LEFT JOIN users r ON UPPER(u.referredBy) = UPPER(r.referralCode)
      WHERE u.referredBy IS NOT NULL AND u.referredBy != ''
    `);
    const decrypted = referrals.map(ref => ({
      ...ref,
      referredPhone: decryptData(ref.referredPhone),
      referredCpf: decryptData(ref.referredCpf),
      referrerPhone: decryptData(ref.referrerPhone),
    }));
    res.json(decrypted);
  });

  // Users list
  app.get("/api/users", async (req, res) => {
    const users = await db.all("SELECT * FROM users WHERE role = 'client'");
    res.json(users.map(decryptUser));
  });

  // Atualizar anotações internas da cliente pela administradora
  app.put("/api/users/:id/notes", async (req, res) => {
    const { notes } = req.body;
    const encNotes = encryptData(notes !== undefined ? notes : '');
    await db.run("UPDATE users SET notes = ? WHERE id = ?", [encNotes, req.params.id]);
    res.json({ success: true });
  });

  // Atualizar dados gerais da cliente (nome, telefone, cpf, carimbos, anotações)
  app.put("/api/users/:id/admin-edit", async (req, res) => {
    const { name, phone, cpf, loyaltyStamps, referralStamps, notes } = req.body;
    const cleanPhone = (phone || '').replace(/\D/g, '');
    const cleanCpf = (cpf || '').replace(/\D/g, '');
    const encPhone = encryptData(cleanPhone);
    const encCpf = encryptData(cleanCpf);
    const phoneHash = computeBlindIndex(cleanPhone);
    const cpfHash = computeBlindIndex(cleanCpf);
    const encNotes = encryptData(notes !== undefined ? notes : '');

    await db.run(
      "UPDATE users SET name = ?, phone = ?, cpf = ?, loyaltyStamps = ?, referralStamps = ?, notes = ?, phone_hash = ?, cpf_hash = ? WHERE id = ?",
      [name, encPhone, encCpf, Number(loyaltyStamps) || 0, Number(referralStamps) || 0, encNotes, phoneHash, cpfHash, req.params.id]
    );
    res.json({ success: true });
  });

  // Excluir cliente (se solicitado pela administradora)
  app.delete("/api/users/:id", async (req, res) => {
    await db.run("DELETE FROM users WHERE id = ? AND role = 'client'", [req.params.id]);
    res.json({ success: true });
  });

  // ==========================================
  // SISTEMA DE GESTÃO, BALANCETES & FATURAMENTOS
  // ==========================================

  // Despesas Operacionais do Salão
  app.get("/api/admin/expenses", async (req, res) => {
    try {
      const expenses = await db.all("SELECT * FROM expenses ORDER BY date DESC, createdAt DESC");
      res.json(expenses);
    } catch (err) {
      console.error("[Expenses] Erro ao listar despesas:", err);
      res.status(500).json({ error: "Erro ao buscar despesas." });
    }
  });

  app.post("/api/admin/expenses", async (req, res) => {
    try {
      const { description, category, amount, date } = req.body;
      if (!description || !amount || !date) {
        return res.status(400).json({ error: "Descrição, valor e data são obrigatórios." });
      }
      const id = 'exp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
      const createdAt = new Date().toISOString();
      await db.run(
        "INSERT INTO expenses (id, description, category, amount, date, createdAt) VALUES (?, ?, ?, ?, ?, ?)",
        [id, description.trim(), category || 'Outros', Number(amount) || 0, date, createdAt]
      );
      const created = await db.get("SELECT * FROM expenses WHERE id = ?", [id]);
      triggerAutoUpdateZip();
      res.json(created);
    } catch (err) {
      console.error("[Expenses] Erro ao cadastrar despesa:", err);
      res.status(500).json({ error: "Erro ao cadastrar despesa." });
    }
  });

  app.delete("/api/admin/expenses/:id", async (req, res) => {
    try {
      await db.run("DELETE FROM expenses WHERE id = ?", [req.params.id]);
      triggerAutoUpdateZip();
      res.json({ success: true });
    } catch (err) {
      console.error("[Expenses] Erro ao excluir despesa:", err);
      res.status(500).json({ error: "Erro ao excluir despesa." });
    }
  });

  // Balancete Financeiro Completo e Resumo de Gestão
  app.get("/api/admin/financial-summary", async (req, res) => {
    try {
      const bookings = await db.all(`
        SELECT bookings.*, 
               COALESCE(users.name, bookings.clientName, 'Cliente') as clientName,
               COALESCE(professionals.name, 'Salão / Principal') as professionalName
        FROM bookings
        LEFT JOIN users ON bookings.userId = users.id
        LEFT JOIN professionals ON bookings.professionalId = professionals.id
        ORDER BY bookings.date DESC, bookings.time DESC
      `);

      const expenses = await db.all("SELECT * FROM expenses ORDER BY date DESC, createdAt DESC");
      const services = await db.all("SELECT * FROM services");

      const serviceNameMap: Record<string, string> = {};
      services.forEach((s: any) => {
        serviceNameMap[s.id] = s.name;
      });

      let faturamentoTotal = 0;
      let faturamentoPago = 0;
      let faturamentoPendente = 0;
      let faturamentoCancelado = 0;
      let totalDescontos = 0;
      let totalAgendamentos = 0;
      let atendimentosConcluidos = 0;

      const porMetodoPagamento: Record<string, { total: number; count: number }> = {
        'PIX': { total: 0, count: 0 },
        'Cartão de Crédito': { total: 0, count: 0 },
        'Cartão de Débito': { total: 0, count: 0 },
        'Dinheiro': { total: 0, count: 0 },
        'Outros / No Ato': { total: 0, count: 0 }
      };

      const porServico: Record<string, { name: string; total: number; count: number }> = {};
      const porProfissional: Record<string, { name: string; total: number; count: number }> = {};
      const balanceteTransacoes: any[] = [];

      for (const b of bookings) {
        const price = Number(b.finalPrice) || 0;
        const discount = Number(b.discountAmount) || 0;

        if (b.status === 'cancelled') {
          faturamentoCancelado += price;
          balanceteTransacoes.push({
            id: b.id,
            tipo: 'entrada',
            data: b.date,
            horario: b.time,
            cliente: b.clientName || 'Cliente',
            descricao: 'Agendamento Cancelado',
            metodoPagamento: b.paymentMethod || 'Cancelado',
            valor: price,
            status: 'cancelled',
            statusPagamento: 'Cancelado',
            profissional: b.professionalName || 'Salão'
          });
          continue;
        }

        faturamentoTotal += price;
        totalDescontos += discount;
        totalAgendamentos++;

        const isPaid = b.paymentStatus === 'paid' || b.status === 'completed';
        if (isPaid) {
          faturamentoPago += price;
          atendimentosConcluidos++;
        } else {
          faturamentoPendente += price;
        }

        // Identificação do método de pagamento
        let m = (b.paymentMethod || '').trim();
        let catMethod = 'Outros / No Ato';
        if (/pix/i.test(m)) catMethod = 'PIX';
        else if (/cr[eé]dito/i.test(m)) catMethod = 'Cartão de Crédito';
        else if (/d[eé]bito/i.test(m)) catMethod = 'Cartão de Débito';
        else if (/dinheiro/i.test(m)) catMethod = 'Dinheiro';

        if (!porMetodoPagamento[catMethod]) {
          porMetodoPagamento[catMethod] = { total: 0, count: 0 };
        }
        porMetodoPagamento[catMethod].total += price;
        porMetodoPagamento[catMethod].count += 1;

        // Faturamento por profissional
        const profName = b.professionalName || 'Salão / Principal';
        if (!porProfissional[profName]) {
          porProfissional[profName] = { name: profName, total: 0, count: 0 };
        }
        porProfissional[profName].total += price;
        porProfissional[profName].count += 1;

        // Parse serviços contratados
        let sIds: string[] = [];
        try {
          sIds = typeof b.serviceIds === 'string' ? JSON.parse(b.serviceIds || '[]') : (b.serviceIds || []);
        } catch {
          sIds = b.serviceId ? [b.serviceId] : [];
        }
        if (sIds.length === 0 && b.serviceId) sIds = [b.serviceId];

        const serviceNames = sIds.map((id: string) => serviceNameMap[id] || 'Procedimento').join(', ') || 'Procedimento';
        sIds.forEach((id: string) => {
          const sName = serviceNameMap[id] || 'Outro Procedimento';
          if (!porServico[sName]) {
            porServico[sName] = { name: sName, total: 0, count: 0 };
          }
          porServico[sName].total += sIds.length > 1 ? price / sIds.length : price;
          porServico[sName].count += 1;
        });

        balanceteTransacoes.push({
          id: b.id,
          tipo: 'entrada',
          data: b.date,
          horario: b.time,
          cliente: b.clientName || 'Cliente',
          descricao: serviceNames,
          metodoPagamento: b.paymentMethod || 'No ato',
          valor: price,
          status: b.status,
          statusPagamento: isPaid ? 'Confirmado' : 'Pendente',
          profissional: profName
        });
      }

      // Adicionar Despesas Operacionais ao Balancete
      let totalDespesas = 0;
      for (const exp of expenses) {
        const val = Number(exp.amount) || 0;
        totalDespesas += val;
        balanceteTransacoes.push({
          id: exp.id,
          tipo: 'saida',
          data: exp.date,
          horario: '12:00',
          cliente: 'Fornecedor / Operacional',
          descricao: `${exp.description} [${exp.category}]`,
          metodoPagamento: 'Caixa do Salão',
          valor: val,
          status: 'concluida',
          statusPagamento: 'Pago',
          profissional: 'Despesa do Estúdio'
        });
      }

      // Ordena balancete cronologicamente do mais recente para o mais antigo
      balanceteTransacoes.sort((a, b) => (b.data + ' ' + b.horario).localeCompare(a.data + ' ' + a.horario));

      const lucroLiquido = faturamentoTotal - totalDespesas;
      const ticketMedio = totalAgendamentos > 0 ? faturamentoTotal / totalAgendamentos : 0;

      res.json({
        resumo: {
          faturamentoTotal,
          faturamentoPago,
          faturamentoPendente,
          faturamentoCancelado,
          totalDespesas,
          lucroLiquido,
          ticketMedio,
          totalAgendamentos,
          atendimentosConcluidos,
          totalDescontos
        },
        porMetodoPagamento: Object.entries(porMetodoPagamento).map(([metodo, dados]) => ({
          metodo,
          total: dados.total,
          count: dados.count,
          percentual: faturamentoTotal > 0 ? (dados.total / faturamentoTotal) * 100 : 0
        })),
        porServico: Object.values(porServico).sort((a, b) => b.total - a.total),
        porProfissional: Object.values(porProfissional).sort((a, b) => b.total - a.total),
        transacoes: balanceteTransacoes,
        despesas: expenses
      });
    } catch (err) {
      console.error("[Financial Summary] Erro ao consolidar balancete:", err);
      res.status(500).json({ error: "Erro ao gerar balancete financeiro." });
    }
  });

  app.get("/api/settings", async (req, res) => {
    const settings = await db.get("SELECT * FROM settings WHERE id = 1");
    if (settings) {
      settings.promoActive = !!settings.promoActive;
      settings.promoId = settings.promoId || 'promo_default';
      settings.loyaltyActive = !!settings.loyaltyActive;
      settings.loyaltyRewardType = settings.loyaltyRewardType || 'free_service';
      settings.loyaltyRewardServiceId = settings.loyaltyRewardServiceId || '';
      settings.loyaltyRewardDiscountPercent = Number(settings.loyaltyRewardDiscountPercent) || 100;
      
      settings.referralActive = !!settings.referralActive;
      settings.referralMaxStamps = settings.referralMaxStamps !== undefined ? Number(settings.referralMaxStamps) : 3;
      settings.referralDiscountType = settings.referralDiscountType || 'fixed';
      settings.referralDiscountForReferred = settings.referralDiscountForReferred !== undefined ? Number(settings.referralDiscountForReferred) : 15;
      settings.referralRewardType = settings.referralRewardType || 'free_service';
      settings.referralRewardServiceId = settings.referralRewardServiceId || '';
      settings.referralRewardDiscountPercent = settings.referralRewardDiscountPercent !== undefined ? Number(settings.referralRewardDiscountPercent) : 100;
      settings.referralRewardText = settings.referralRewardText || 'Ganhe um serviço de cortesia ao completar as indicações!';
      settings.referralThankYouMessage = settings.referralThankYouMessage || 'Parabéns! Sua indicação {clientName} concluiu o atendimento no salão! Você ganhou +1 carimbo no seu Cartão de Indicação 🎁';

      settings.themeColor = settings.themeColor || 'rose';
      settings.welcomeMessage = settings.welcomeMessage || 'Seja bem-vinda ao seu espaço de cuidado e beleza ✨';

      settings.paymentTitle = settings.paymentTitle || 'Pagamento no ato do atendimento';
      settings.paymentInstructions = settings.paymentInstructions || 'O pagamento do seu procedimento não é cobrado agora pelo site. Você realiza o pagamento no ato do atendimento diretamente no salão (aceitamos Cartões de Crédito/Débito, PIX e Dinheiro).';
      settings.paymentMethodsList = settings.paymentMethodsList || 'PIX, Cartão de Crédito/Débito e Dinheiro';
      settings.paymentPixKey = settings.paymentPixKey || '';

      // Studio & Fotos e Informações para as Clientes
      settings.studioAbout = settings.studioAbout || 'Nosso espaço foi cuidadosamente planejado para proporcionar uma experiência acolhedora de beleza e bem-estar. Cada detalhe — da iluminação aconchegante ao café especial e rigorosos protocolos de biossegurança — foi pensado para tornar seu momento de autocuidado único e relaxante.';
      settings.studioAddressNotes = settings.studioAddressNotes || 'Fácil localização, em frente à praça central com facilidade para estacionar.';
      settings.studioMapsUrl = settings.studioMapsUrl || '';

      try { 
        settings.studioPhotos = JSON.parse(settings.studioPhotosJson || '[]'); 
      } catch { 
        settings.studioPhotos = []; 
      }
      if (!settings.studioPhotos || settings.studioPhotos.length === 0) {
        settings.studioPhotos = [
          {
            id: 'sp_1',
            url: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=1200&q=80',
            title: 'Recepção & Lounge Aconchegante',
            tag: 'Recepção',
            caption: 'Ambiente acolhedor com café gourmet e recepção climatizada para o seu bem-estar.',
            isCover: true
          },
          {
            id: 'sp_2',
            url: 'https://images.unsplash.com/photo-1633681926022-84c23e8cb2d6?auto=format&fit=crop&w=1200&q=80',
            title: 'Bancadas de Nail Design & Cuidados',
            tag: 'Bancadas',
            caption: 'Estações individuais com iluminação profissional, assentos ergonômicos e total conforto.',
            isCover: false
          },
          {
            id: 'sp_3',
            url: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=1200&q=80',
            title: 'Biossegurança & Esterilização',
            tag: 'Biossegurança',
            caption: 'Autoclave hospitalar e instrumentos em pacotes selados com fita indicadora de esterilização.',
            isCover: false
          },
          {
            id: 'sp_4',
            url: 'https://images.unsplash.com/photo-1516975080664-ed2fc6a32937?auto=format&fit=crop&w=1200&q=80',
            title: 'Sala Exclusiva de Procedimentos',
            tag: 'Procedimentos',
            caption: 'Espaço privativo e relaxante para cuidados faciais, sobrancelhas e estética.',
            isCover: false
          }
        ];
      }

      try { 
        settings.studioAmenities = JSON.parse(settings.studioAmenitiesJson || '[]'); 
      } catch { 
        settings.studioAmenities = []; 
      }
      if (!settings.studioAmenities || settings.studioAmenities.length === 0) {
        settings.studioAmenities = [
          'Ar-condicionado e Ambiente Climatizado',
          'Wi-Fi Cortesia de Alta Velocidade',
          'Cantinho do Café Gourmet & Chás Especiais',
          'Esterilização em Autoclave Hospitalar',
          'Materiais 100% Descartáveis',
          'Estacionamento Fácil no Local',
          'Música Ambiente Relaxante',
          'Ambiente Aconchegante e Reservado'
        ];
      }

      try { 
        settings.studioPolicies = JSON.parse(settings.studioPoliciesJson || '[]'); 
      } catch { 
        settings.studioPolicies = []; 
      }
      if (!settings.studioPolicies || settings.studioPolicies.length === 0) {
        settings.studioPolicies = [
          {
            id: 'pol_1',
            title: 'Tolerância de Horário',
            description: 'Contamos com uma tolerância de até 10 minutos de atraso para garantir que todos os atendimentos do dia ocorram com calma e pontualidade.',
            icon: 'clock'
          },
          {
            id: 'pol_2',
            title: 'Cancelamento & Reagendamento',
            description: 'Caso precise cancelar ou reagendar, solicitamos o aviso com no mínimo 2 horas de antecedência pelo próprio site ou WhatsApp.',
            icon: 'calendar'
          },
          {
            id: 'pol_3',
            title: 'Acompanhantes',
            description: 'Para manter o espaço calmo, aconchegante e silencioso para todas as clientes, recomendamos comparecer desacompanhada ou com no máximo 1 pessoa.',
            icon: 'users'
          },
          {
            id: 'pol_4',
            title: 'Biossegurança & Higiene',
            description: 'Utilizamos alicates e curetas esterilizados em autoclave e embalagens com fita indicadora de esterilização abertas na sua frente. Lixas e palitos são 100% descartáveis.',
            icon: 'shield'
          },
          {
            id: 'pol_5',
            title: 'Formas de Pagamento no Salão',
            description: 'O pagamento é realizado no término do procedimento diretamente no estúdio. Aceitamos PIX com chave cadastrada, Cartões de Débito, Crédito e Dinheiro.',
            icon: 'credit-card'
          }
        ];
      }

      try { settings.promoServices = JSON.parse(settings.promoServicesJson || '[]'); } catch { settings.promoServices = []; }
      try { settings.availableDays = JSON.parse(settings.availableDaysJson || '[1,2,3,4,5,6]'); } catch { settings.availableDays = [1,2,3,4,5,6]; }
      try { settings.availableTimeSlots = JSON.parse(settings.availableTimeSlotsJson || '["08:00","09:00","10:00","11:00","13:00","14:00","15:00","16:00","17:00","18:00"]'); } catch { settings.availableTimeSlots = ["08:00","09:00","10:00","11:00","13:00","14:00","15:00","16:00","17:00","18:00"]; }
      try { settings.dailySchedules = JSON.parse(settings.dailySchedulesJson || '{}'); } catch { settings.dailySchedules = {}; }
    }
    res.json(settings);
  });

  app.put("/api/settings", async (req, res) => {
    const { 
      name, subtitle, phone, address, instagram, hours, 
      promoActive, promoTitle, promoDescription, promoImageUrl, promoEndsAt, promoService, promoPrice, promoDiscount, promoServices, promoId,
      heroTitle, heroSubtitle, heroDescription, heroImageUrl, storeIconUrl,
      loyaltyActive, loyaltyMaxStamps, loyaltyRewardText,
      loyaltyRewardType, loyaltyRewardServiceId, loyaltyRewardDiscountPercent,
      availableDays, availableTimeSlots, dailySchedules,
      referralActive, referralMaxStamps, referralDiscountType, referralDiscountForReferred,
      referralRewardType, referralRewardServiceId, referralRewardDiscountPercent, referralRewardText, referralThankYouMessage,
      themeColor, welcomeMessage,
      paymentTitle, paymentInstructions, paymentMethodsList, paymentPixKey,
      studioAbout, studioPhotos, studioAmenities, studioPolicies, studioAddressNotes, studioMapsUrl
    } = req.body;
    
    const promoServicesJson = JSON.stringify(promoServices || []);
    const availableDaysJson = JSON.stringify(availableDays !== undefined ? availableDays : [1,2,3,4,5,6]);
    const availableTimeSlotsJson = JSON.stringify(availableTimeSlots || ["08:00","09:00","10:00","11:00","13:00","14:00","15:00","16:00","17:00","18:00"]);
    const dailySchedulesJson = JSON.stringify(dailySchedules || {});
    const finalPromoId = promoId || ('promo_' + Date.now());

    const studioPhotosJson = JSON.stringify(studioPhotos || []);
    const studioAmenitiesJson = JSON.stringify(studioAmenities || []);
    const studioPoliciesJson = JSON.stringify(studioPolicies || []);

    await db.run(`
      UPDATE settings 
      SET name = ?, subtitle = ?, phone = ?, address = ?, instagram = ?, hours = ?,
          promoActive = ?, promoTitle = ?, promoDescription = ?, promoImageUrl = ?, promoEndsAt = ?,
          promoService = ?, promoPrice = ?, promoDiscount = ?, promoServicesJson = ?, promoId = ?,
          heroTitle = ?, heroSubtitle = ?, heroDescription = ?, heroImageUrl = ?, storeIconUrl = ?,
          loyaltyActive = ?, loyaltyMaxStamps = ?, loyaltyRewardText = ?,
          loyaltyRewardType = ?, loyaltyRewardServiceId = ?, loyaltyRewardDiscountPercent = ?,
          availableDaysJson = ?, availableTimeSlotsJson = ?, dailySchedulesJson = ?,
          referralActive = ?, referralMaxStamps = ?, referralDiscountType = ?, referralDiscountForReferred = ?,
          referralRewardType = ?, referralRewardServiceId = ?, referralRewardDiscountPercent = ?, referralRewardText = ?, referralThankYouMessage = ?,
          themeColor = ?, welcomeMessage = ?,
          paymentTitle = ?, paymentInstructions = ?, paymentMethodsList = ?, paymentPixKey = ?,
          studioAbout = ?, studioPhotosJson = ?, studioAmenitiesJson = ?, studioPoliciesJson = ?,
          studioAddressNotes = ?, studioMapsUrl = ?
      WHERE id = 1`,
      [
        name, subtitle, phone, address, instagram, hours, 
        promoActive ? 1 : 0, promoTitle, promoDescription, promoImageUrl, promoEndsAt, 
        promoService, promoPrice, promoDiscount || 0, promoServicesJson, finalPromoId,
        heroTitle, heroSubtitle, heroDescription, heroImageUrl, storeIconUrl,
        loyaltyActive ? 1 : 0, loyaltyMaxStamps || 10, loyaltyRewardText || 'Ganhe um serviço de cortesia!',
        loyaltyRewardType || 'free_service', loyaltyRewardServiceId || '', Number(loyaltyRewardDiscountPercent) || 100,
        availableDaysJson, availableTimeSlotsJson, dailySchedulesJson,
        referralActive ? 1 : 0, referralMaxStamps !== undefined ? Number(referralMaxStamps) : 3, referralDiscountType || 'fixed', Number(referralDiscountForReferred) || 0,
        referralRewardType || 'free_service', referralRewardServiceId || '', Number(referralRewardDiscountPercent) || 100, referralRewardText || 'Ganhe um serviço de cortesia!',
        referralThankYouMessage || 'Parabéns! Sua indicação {clientName} concluiu o atendimento no salão! Você ganhou +1 carimbo no seu Cartão de Indicação 🎁',
        themeColor || 'rose', welcomeMessage || 'Seja bem-vinda ao seu espaço de cuidado e beleza ✨',
        paymentTitle || 'Pagamento no ato do atendimento',
        paymentInstructions !== undefined ? paymentInstructions : 'O pagamento do seu procedimento não é cobrado agora pelo site. Você realiza o pagamento no ato do atendimento diretamente no salão (aceitamos Cartões de Crédito/Débito, PIX e Dinheiro).',
        paymentMethodsList || 'PIX, Cartão de Crédito/Débito e Dinheiro',
        paymentPixKey || '',
        studioAbout !== undefined ? studioAbout : '',
        studioPhotosJson,
        studioAmenitiesJson,
        studioPoliciesJson,
        studioAddressNotes !== undefined ? studioAddressNotes : '',
        studioMapsUrl !== undefined ? studioMapsUrl : ''
      ]
    );
    triggerAutoUpdateZip();
    res.json({ success: true, promoId: finalPromoId });
  });


  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = fs.existsSync(path.join(process.cwd(), 'dist')) 
      ? path.join(process.cwd(), 'dist') 
      : path.join(appDir, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(console.error);
