export type Role = 'admin' | 'staff' | 'client';

export type AdminAreaPermission =
  | 'bookings'
  | 'financial'
  | 'services'
  | 'professionals'
  | 'studio'
  | 'clients'
  | 'loyalty'
  | 'referral'
  | 'personalization'
  | 'promo'
  | 'schedule'
  | 'settings'
  | 'audit';

export interface User {
  id: string;
  name: string;
  phone: string;
  cpf?: string;
  email?: string;
  avatarUrl?: string;
  googleId?: string;
  authProvider?: 'local' | 'google';
  role: Role;
  username?: string;
  isTechnician?: boolean;
  permissions?: AdminAreaPermission[];
  professionalId?: string;
  loyaltyStamps?: number;
  referralCode?: string;
  referredBy?: string;
  referralStamps?: number;
  firstBookingDone?: boolean;
  createdAt?: string;
  notes?: string;
}

export interface Expense {
  id: string;
  description: string;
  category: string;
  amount: number;
  date: string;
  createdAt?: string;
}

export interface Category {
  id: string;
  name: string;
}

export interface Service {
  id: string;
  name: string;
  category: string;
  duration: number;
  price: number;
}

export interface Professional {
  id: string;
  name: string;
  phone: string;
  bio?: string;
  avatarUrl?: string;
  username?: string;
  password?: string;
  permissions?: AdminAreaPermission[];
}

export interface Feedback {
  id: string;
  bookingId: string;
  userId: string;
  userName?: string;
  rating: number;
  comment: string;
  photoUrl?: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  message: string;
  type: string;
  read: boolean;
  createdAt: string;
}

export interface Booking {
  id: string;
  serviceId: string;
  serviceIds?: string[];
  paymentMethod?: string;
  professionalId?: string;
  userId: string;
  clientName?: string;
  clientPhone?: string;
  clientCpf?: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  notes?: string;
  status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
  originalPrice?: number;
  finalPrice?: number;
  discountAmount?: number;
  discountPercent?: number;
  isPromo?: boolean;
  promoId?: string;
  startedAt?: string;
  estimatedEndTime?: string;
  paymentStatus?: string;
  clientArrived?: boolean;
  clientArrivedAt?: string;
  presenceConfirmed?: boolean;
  presenceConfirmedAt?: string;
  presenceConfirmedBy?: string;
}

export interface PromoServiceItem {
  serviceName: string;
  discount: number;
  finalPrice: string;
  serviceId?: string;
  discountPercent?: number;
}

export interface DaySchedule {
  enabled: boolean;
  slots: string[];
}

export interface DayScheduleMap {
  [dayOfWeek: number]: DaySchedule; // 0=Domingo, 1=Segunda, 2=Terça, 3=Quarta, 4=Quinta, 5=Sexta, 6=Sábado
}

export interface StudioPhoto {
  id: string;
  url: string;
  title: string;
  tag?: string; // 'Recepção' | 'Bancadas' | 'Espaço' | 'Cantinho do Café' | 'Procedimentos' | 'Fachada' | 'Outro'
  caption?: string;
  isCover?: boolean;
}

export interface StudioPolicy {
  id: string;
  title: string;
  description: string;
  icon?: string;
}

export interface Settings {
  name: string;
  subtitle: string;
  phone: string;
  address: string;
  instagram: string;
  hours: string;
  promoActive: boolean;
  promoTitle: string;
  promoDescription: string;
  promoImageUrl: string;
  promoEndsAt: string;
  promoService: string;
  promoPrice: string;
  promoDiscount: number;
  promoDurationMode?: 'days' | 'timer' | 'custom_date';
  promoDurationDays?: number;
  promoTimerHours?: number;
  promoServices?: { serviceId: string; discountPercent: number; durationHours?: number }[];
  heroTitle?: string;
  heroSubtitle?: string;
  heroDescription?: string;
  heroImageUrl?: string;
  storeIconUrl?: string;
  loyaltyActive?: boolean;
  loyaltyMaxStamps?: number;
  loyaltyRewardText?: string;
  loyaltyRewardType?: 'free_service' | 'discount_percent';
  loyaltyRewardServiceId?: string;
  loyaltyRewardDiscountPercent?: number;
  availableDays?: number[]; // [0=Dom, 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sab]
  availableTimeSlots?: string[]; // ['08:00', '09:00', ...]
  dailySchedules?: DayScheduleMap; // Horários personalizados para cada dia da semana (Seg a Dom)
  // Referral Program (Bônus por Indicação)
  referralActive?: boolean;
  referralMaxStamps?: number; // 0 to 10
  referralDiscountType?: 'fixed' | 'percent'; // 'fixed' = R$, 'percent' = %
  referralDiscountForReferred?: number; // Desconto em R$ ou % no 1º serviço da cliente indicada
  referralRewardType?: 'free_service' | 'discount_percent';
  referralRewardServiceId?: string;
  referralRewardDiscountPercent?: number;
  referralRewardText?: string;
  referralThankYouMessage?: string;
  // Personalização da Aparência do Site
  themeColor?: 'rose' | 'blush' | 'wine' | 'lavender' | 'champagne';
  welcomeMessage?: string;
  promoId?: string;
  // Mensagem e Regras de Pagamento Editáveis
  paymentTitle?: string;
  paymentInstructions?: string;
  paymentMethodsList?: string;
  paymentPixKey?: string;
  // Studio & Fotos e Informações para as Clientes
  studioAbout?: string;
  studioPhotos?: StudioPhoto[];
  studioAmenities?: string[];
  studioPolicies?: StudioPolicy[];
  studioAddressNotes?: string;
  studioMapsUrl?: string;
}

export type View = 'home' | 'booking' | 'login' | 'register' | 'client' | 'admin' | 'profile';

export interface ToastData {
  message: string;
  type: 'success' | 'error';
}
