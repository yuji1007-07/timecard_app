// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  ボナペティ POS 共通設定
//  ※ ここのFirebase設定は「公開されて問題ない」情報です。
//    実際の保護は Firebase側のセキュリティルールで行います。
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const SHOP_NAME = 'ボナペティ';

export const firebaseConfig = {
  apiKey: "AIzaSyApujQFMZPeTiniL0X1-6iHUZp6cfGG3y0",
  authDomain: "kitchencar-pos.firebaseapp.com",
  databaseURL: "https://kitchencar-pos-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "kitchencar-pos",
  storageBucket: "kitchencar-pos.firebasestorage.app",
  messagingSenderId: "430159368598",
  appId: "1:430159368598:web:abf8884b649fb8b96b0db7"
};

// スタッフ用アカウント（Firebase Authenticationに登録するメールアドレス）
// 暗証番号は Firebase のパスワードそのものになります。
// パスワードは  bp_ + 暗証番号   で登録してください。（例: 暗証番号 4823 → bp_4823）
export const STAFF_EMAIL = 'staff@bonappetit-pos.local';
export const pinToPassword = (pin) => 'bp_' + pin;

// 表示ユーティリティ
export const yen = (n) => '¥' + Number(n || 0).toLocaleString('ja-JP');

export const todayKey = (d = new Date()) => {
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export const hhmm = (d = new Date()) => {
  const p = (x) => String(x).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
};

// HTMLエスケープ（商品名などにタグを入れられても壊れないように）
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

export const DEFAULT_MENU = [
  { id: 'm1', name: 'クレープ',       price: 500, emoji: '🥐', sort: 1, active: true },
  { id: 'm2', name: 'フライドポテト', price: 400, emoji: '🍟', sort: 2, active: true },
  { id: 'm3', name: 'ホットドッグ',   price: 600, emoji: '🌭', sort: 3, active: true },
  { id: 'm4', name: 'ドリンク',       price: 300, emoji: '🥤', sort: 4, active: true },
];
