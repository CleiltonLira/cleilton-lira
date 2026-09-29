import QRCode from 'qrcode';

/**
 * Utilitário para geração de Chave PIX, código Copia e Cola e QR Code automático
 */

// Gera CRC16 para padrão EMVCo do Pix
function crc16(str: string): string {
  let crc = 0xffff;
  for (let c = 0; c < str.length; c++) {
    crc ^= str.charCodeAt(c) << 8;
    for (let i = 0; i < 8; i++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  const hex = crc.toString(16).toUpperCase();
  return ('0000' + hex).slice(-4);
}

function formatField(id: string, value: string): string {
  const len = ('00' + value.length).slice(-2);
  return `${id}${len}${value}`;
}

/**
 * Gera a string do Pix Copia e Cola no padrão oficial Banco Central / EMVCo
 */
export function generatePixPayload(params: {
  pixKey: string;
  merchantName?: string;
  merchantCity?: string;
  amount?: number;
  txId?: string;
}): string {
  const key = (params.pixKey || '').trim();
  if (!key) return '';

  const cleanName = (params.merchantName || 'BELLA BEAUTY')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .slice(0, 25);

  const cleanCity = (params.merchantCity || 'BRASIL')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .slice(0, 15);

  const merchantAccountInfo =
    formatField('00', 'BR.GOV.BCB.PIX') +
    formatField('01', key);

  let payload =
    formatField('00', '01') + // Payload Format Indicator
    formatField('26', merchantAccountInfo) +
    formatField('52', '0000') + // Merchant Category Code
    formatField('53', '986') + // Transaction Currency (BRL)
    (params.amount && params.amount > 0 ? formatField('54', params.amount.toFixed(2)) : '') +
    formatField('58', 'BR') + // Country Code
    formatField('59', cleanName) + // Merchant Name
    formatField('60', cleanCity) + // Merchant City
    formatField('62', formatField('05', params.txId || '***')); // Additional Data Field (TxID)

  payload += '6304';
  const checksum = crc16(payload);
  return payload + checksum;
}

/**
 * Gera Data URL em imagem PNG para o QR Code Pix com alta resolução
 */
export async function generatePixQrCodeDataUrl(
  pixKey: string,
  options?: {
    amount?: number;
    merchantName?: string;
    merchantCity?: string;
    width?: number;
  }
): Promise<{ dataUrl: string; payload: string }> {
  if (!pixKey || !pixKey.trim()) {
    return { dataUrl: '', payload: '' };
  }

  const payload = generatePixPayload({
    pixKey: pixKey.trim(),
    amount: options?.amount,
    merchantName: options?.merchantName,
    merchantCity: options?.merchantCity
  });

  try {
    const dataUrl = await QRCode.toDataURL(payload, {
      width: options?.width || 280,
      margin: 1.5,
      color: {
        dark: '#1c1917',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    });
    return { dataUrl, payload };
  } catch (err) {
    console.error('Erro ao gerar QR Code Pix:', err);
    // Fallback: codifica a chave crua se falhar
    const fallbackUrl = await QRCode.toDataURL(pixKey.trim(), {
      width: options?.width || 280,
      margin: 1.5,
    });
    return { dataUrl: fallbackUrl, payload: pixKey.trim() };
  }
}
