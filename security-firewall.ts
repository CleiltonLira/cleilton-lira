import { Request, Response, NextFunction } from "express";

// Tipos para registro de segurança
interface IPAccessRecord {
  failedLoginAttempts: number;
  lastFailedLoginAt: number;
  lockoutUntil: number;
  registrationsThisHour: number[];
  requestsThisMinute: number[];
}

interface SecurityStats {
  blockedBots: number;
  blockedIPs: number;
  rateLimitHits: number;
  honeypotTriggers: number;
  activeLockouts: number;
}

// Armazenamento em memória para controle de acessos por IP
const ipRecords = new Map<string, IPAccessRecord>();
const securityStats: SecurityStats = {
  blockedBots: 0,
  blockedIPs: 0,
  rateLimitHits: 0,
  honeypotTriggers: 0,
  activeLockouts: 0,
};

// Histórico recente de ameaças bloqueadas (para visualização segura no painel)
interface BlockedEvent {
  id: string;
  ip: string;
  reason: string;
  timestamp: string;
}
const recentThreats: BlockedEvent[] = [];

// Função auxiliar para extrair o IP real da requisição
export function extractClientIP(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0].trim();
  }
  const realIp = req.headers["x-real-ip"];
  if (typeof realIp === "string") {
    return realIp.trim();
  }
  return req.socket.remoteAddress || req.ip || "127.0.0.1";
}

// Obter ou criar registro do IP
function getOrCreateRecord(ip: string): IPAccessRecord {
  let record = ipRecords.get(ip);
  if (!record) {
    record = {
      failedLoginAttempts: 0,
      lastFailedLoginAt: 0,
      lockoutUntil: 0,
      registrationsThisHour: [],
      requestsThisMinute: [],
    };
    ipRecords.set(ip, record);
  }
  return record;
}

// Registrar evento de ameaça bloqueada
function recordThreat(ip: string, reason: string) {
  const maskedIP = ip.length > 7 ? ip.replace(/(\d+)\.(\d+)\.(\d+)\.(\d+)/, '$1.$2.***.***') : ip;
  recentThreats.unshift({
    id: Math.random().toString(36).substring(7),
    ip: maskedIP,
    reason,
    timestamp: new Date().toISOString(),
  });
  if (recentThreats.length > 20) {
    recentThreats.pop();
  }
}

// Middleware de cabeçalhos de segurança (Security Headers)
export function securityHeadersMiddleware(req: Request, res: Response, next: NextFunction) {
  // Prevenir clickjacking
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  // Prevenir MIME type sniffing
  res.setHeader("X-Content-Type-Options", "nosniff");
  // Proteção contra ataques XSS
  res.setHeader("X-XSS-Protection", "1; mode=block");
  // Controle de referrer para privacidade
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  // Desabilitar acesso indesejado a recursos de hardware
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  // Cache-Control para requisições da API
  if (req.path.startsWith("/api/")) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
  }
  next();
}

// Middleware de Taxa de Requisições Geral (Anti-Spam / Anti-DDoS leve por IP)
export function apiRateLimiterMiddleware(req: Request, res: Response, next: NextFunction) {
  // Somente aplica nas rotas de API
  if (!req.path.startsWith("/api/")) {
    return next();
  }

  const ip = extractClientIP(req);
  const now = Date.now();
  const record = getOrCreateRecord(ip);

  // Limpar requisições com mais de 60 segundos
  record.requestsThisMinute = record.requestsThisMinute.filter(t => now - t < 60000);
  record.requestsThisMinute.push(now);

  // Limite: máximo 120 requisições por minuto por IP
  if (record.requestsThisMinute.length > 120) {
    securityStats.rateLimitHits++;
    recordThreat(ip, "Limite de requisições excedido (Anti-Spam)");
    return res.status(429).json({
      error: "Muitas requisições deste endereço IP. Aguarde um momento antes de continuar.",
      retryAfterSeconds: 30
    });
  }

  next();
}

// Verificação de Honeypot e Velocity (Barreira Anti-Robô)
export function checkHoneypotAndBot(req: Request, res: Response): boolean {
  const body = req.body || {};
  const ip = extractClientIP(req);

  // 1. Campo Honeypot Oculto (robôs e scripts preenchem automaticamente)
  const honeypotValues = [
    body._hp_trap,
    body._hp_website,
    body.website_url,
    body.bot_check,
    body.security_token_fake
  ];

  for (const hp of honeypotValues) {
    if (hp !== undefined && hp !== null && String(hp).trim().length > 0) {
      securityStats.honeypotTriggers++;
      securityStats.blockedBots++;
      recordThreat(ip, "Robô detectado em armadilha Honeypot");
      console.warn(`[Anti-Bot Firewall] Honeypot ativado pelo IP ${ip}. Ação bloqueada.`);
      // Tarpit simulado de 1s para consumir recursos do bot
      setTimeout(() => {
        res.status(403).json({ error: "Acesso bloqueado pelo sistema de proteção anti-robô." });
      }, 1000);
      return false;
    }
  }

  // 2. Verificação de velocidade desumana (Velocity check)
  // Se o formulário foi preenchido e enviado em menos de 500ms por script
  if (body._form_loaded_at && typeof body._form_loaded_at === 'number') {
    const elapsed = Date.now() - body._form_loaded_at;
    if (elapsed < 500 && elapsed > 0) {
      securityStats.blockedBots++;
      recordThreat(ip, `Submissão ultra-rápida automatizada (${elapsed}ms)`);
      console.warn(`[Anti-Bot Firewall] Submissão automatizada de alta velocidade (${elapsed}ms) pelo IP ${ip}.`);
      res.status(403).json({ error: "Envio automatizado detectado. Por favor, tente novamente com tranquilidade." });
      return false;
    }
  }

  return true;
}

// Controle de Tentativas de Login por IP (Anti-Força Bruta / Anti-Várias Tentativas)
export function checkLoginRateLimit(ip: string): { allowed: boolean; waitMinutes?: number } {
  const now = Date.now();
  const record = getOrCreateRecord(ip);

  // Verificar se o IP está em período de bloqueio (lockout)
  if (record.lockoutUntil > now) {
    const remainingMs = record.lockoutUntil - now;
    const remainingMin = Math.ceil(remainingMs / 60000);
    return { allowed: false, waitMinutes: remainingMin };
  }

  // Se passou mais de 15 minutos desde a última tentativa falha, reinicia contador
  if (now - record.lastFailedLoginAt > 15 * 60 * 1000) {
    record.failedLoginAttempts = 0;
  }

  // Se excedeu 5 tentativas consecutivas: bloqueia por 15 minutos!
  if (record.failedLoginAttempts >= 5) {
    record.lockoutUntil = now + 15 * 60 * 1000;
    securityStats.blockedIPs++;
    securityStats.activeLockouts++;
    recordThreat(ip, "Bloqueio temporário: 5 tentativas consecutivas de acesso");
    return { allowed: false, waitMinutes: 15 };
  }

  return { allowed: true };
}

// Registrar tentativa de login falha para o IP
export function registerFailedLogin(ip: string) {
  const record = getOrCreateRecord(ip);
  record.failedLoginAttempts++;
  record.lastFailedLoginAt = Date.now();
  
  if (record.failedLoginAttempts >= 5) {
    record.lockoutUntil = Date.now() + 15 * 60 * 1000;
    securityStats.blockedIPs++;
    securityStats.activeLockouts++;
    recordThreat(ip, "IP bloqueado por 15 minutos (5 tentativas incorretas)");
  }
}

// Registrar login bem-sucedido (zera falhas para este IP)
export function registerSuccessfulLogin(ip: string) {
  const record = getOrCreateRecord(ip);
  record.failedLoginAttempts = 0;
  record.lockoutUntil = 0;
}

// Limite de cadastros por IP (Anti-Spam de Cadastros Falsos)
export function checkRegistrationLimit(ip: string): boolean {
  const now = Date.now();
  const record = getOrCreateRecord(ip);

  // Limpa cadastros realizados há mais de 1 hora
  record.registrationsThisHour = record.registrationsThisHour.filter(t => now - t < 3600000);

  // Limite de 6 cadastros por hora pelo mesmo IP
  if (record.registrationsThisHour.length >= 6) {
    securityStats.rateLimitHits++;
    recordThreat(ip, "Tentativas excessivas de criação de cadastro pelo mesmo IP");
    return false;
  }

  record.registrationsThisHour.push(now);
  return true;
}

// Obter métricas de segurança para exibição na central do administrador
export function getSecurityMetrics() {
  const now = Date.now();
  let currentLockouts = 0;
  ipRecords.forEach(rec => {
    if (rec.lockoutUntil > now) currentLockouts++;
  });

  return {
    active: true,
    firewall: {
      antiBotActive: true,
      honeypotActive: true,
      ipRateLimiterActive: true,
      maxFailedAttempts: 5,
      lockoutDurationMinutes: 15,
      maxRegistrationsPerHour: 6,
    },
    stats: {
      blockedBots: securityStats.blockedBots,
      blockedIPs: securityStats.blockedIPs,
      rateLimitHits: securityStats.rateLimitHits,
      activeLockouts: currentLockouts,
      trackedIPsCount: ipRecords.size,
    },
    recentThreats,
  };
}
