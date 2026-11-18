/**
 * Club Tracker – ระบบบัญชีผู้ใช้ (Log in with Google)
 * วางโค้ดนี้ใน Apps Script ที่ผูกกับชีตบัญชีผู้ใช้ (Extensions > Apps Script)
 *
 * แท็บ "accounts" แถวแรกเป็นหัวตาราง:
 *   memberId | email | firstName | lastName | position | active
 * จำเป็นต้องมี: email (Gmail หรืออีเมลบัญชี Google ของสมาชิก), memberId
 * active: เว้นว่าง หรือ TRUE = ใช้งานได้, FALSE / no / 0 = ระงับบัญชี
 *
 * สร้างบัญชีจากหน้าเว็บ: กรอกชื่อ นามสกุล ตำแหน่ง อีเมล
 * ระบบออก memberId ถัดไปอัตโนมัติ (เช่น M030 -> M031) แล้วเพิ่มแถวลง
 *   - แท็บ members ของชีตข้อมูลชมรม (memberId, firstName, lastName, position, email)
 *   - แท็บ accounts ของชีตนี้ (memberId, email, ...) เพื่อให้ล็อกอินด้วย Google ได้
 * ถ้าอีเมลซ้ำกับที่มีอยู่แล้ว จะตอบกลับ email_exists
 */
const SHEET_NAME = 'accounts';
// OAuth Client ID เดียวกับ GOOGLE_CLIENT_ID ใน app.js
const CLIENT_ID = '';
// ID ของชีตข้อมูลชมรม (ที่มีแท็บ members)
const DATA_SHEET_ID = '1mxOoO9sLWwy8jxYUjvLtij7aJf27DErH7SQE1CuF5jk';

function doPost(e) {
  let req;
  try {
    req = JSON.parse(e.postData.contents);
  } catch (err) {
    return out({ ok: false, error: 'bad_request' });
  }
  if (req.action === 'google') return out(googleLogin(req.credential));
  if (req.action === 'register') return out(register(req));
  return out({ ok: false, error: 'unknown_action' });
}

// เปิด URL ของ Web App ในเบราว์เซอร์เพื่อเช็กว่า deploy สำเร็จ
function doGet() {
  return out({ ok: true, service: 'club-tracker-accounts' });
}

// ตรวจ ID token กับ Google ว่าเป็นของจริง ออกให้แอปนี้ และยังไม่หมดอายุ
function verifyToken(token) {
  if (!token) return null;
  const res = UrlFetchApp.fetch(
    'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(token),
    { muteHttpExceptions: true }
  );
  if (res.getResponseCode() !== 200) return null;
  const p = JSON.parse(res.getContentText());
  const issOk = p.iss === 'accounts.google.com' || p.iss === 'https://accounts.google.com';
  const fresh = Number(p.exp) * 1000 > Date.now();
  const verified = p.email_verified === true || p.email_verified === 'true';
  if (p.aud !== CLIENT_ID || !issOk || !fresh || !verified || !p.email) return null;
  return p;
}

function googleLogin(credential) {
  if (!CLIENT_ID) return { ok: false, error: 'no_client_id' };
  const p = verifyToken(credential);
  if (!p) return { ok: false, error: 'invalid_token' };
  const email = String(p.email).trim().toLowerCase();

  const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
  if (!sheet) return { ok: false, error: 'no_sheet' };

  const rows = sheet.getDataRange().getDisplayValues();
  const head = rows[0].map(h => String(h).toLowerCase().replace(/[\s_\-]/g, ''));
  const col = name => head.indexOf(name);
  if (col('email') < 0 || col('memberid') < 0) return { ok: false, error: 'bad_headers' };

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const get = name => (col(name) < 0 ? '' : String(row[col(name)]).trim());
    if (get('email').toLowerCase() !== email) continue;
    if (/^(false|no|0|ไม่|ระงับ)$/i.test(get('active'))) return { ok: false, error: 'inactive' };
    const memberId = get('memberid').toUpperCase();
    if (!memberId) return { ok: false, error: 'bad_headers' };
    return {
      ok: true,
      user: {
        memberId: memberId,
        firstName: get('firstname') || p.given_name || '',
        lastName: get('lastname') || p.family_name || '',
        position: get('position') || 'Member',
        email: email
      }
    };
  }
  return { ok: false, error: 'not_registered', email: email };
}

// อ่านชีตเป็นแถว พร้อมฟังก์ชันหาตำแหน่งคอลัมน์จากชื่อหัวตาราง (ไม่สนตัวพิมพ์/ช่องว่าง/ขีด)
function table(sheet) {
  const rows = sheet.getDataRange().getDisplayValues();
  const head = rows[0].map(h => String(h).toLowerCase().replace(/[\s_\-]/g, ''));
  return { rows: rows, head: head, col: name => head.indexOf(name) };
}

const POSITIONS = ['Member', 'President', 'Vice President', 'Secretary', 'Treasurer', 'Operations Head'];

// หา memberId ถัดไป จากรหัสที่มีอยู่ เช่น M001..M030 -> M031 (คงตัวอักษรนำหน้าและจำนวนหลักเดิม)
function nextMemberId(ids) {
  let prefix = 'M', width = 3, max = 0;
  ids.forEach(id => {
    const m = String(id).trim().toUpperCase().match(/^([A-Z]*)(\d+)$/);
    if (m && Number(m[2]) >= max) { max = Number(m[2]); prefix = m[1]; width = Math.max(width, m[2].length); }
  });
  return prefix + String(max + 1).padStart(width, '0');
}

// เพิ่มแถวใหม่ท้ายแท็บ โดยเรียงค่าตามหัวตารางของแท็บนั้น
function appendByHeader(sheet, t, values) {
  const row = t.head.map(h => (h in values ? values[h] : ''));
  const range = sheet.getRange(sheet.getLastRow() + 1, 1, 1, row.length);
  range.setNumberFormat('@');
  range.setValues([row]);
}

function register(req) {
  const firstName = String(req.firstName || '').trim();
  const lastName = String(req.lastName || '').trim();
  const email = String(req.email || '').trim().toLowerCase();
  const position = POSITIONS.indexOf(req.position) >= 0 ? req.position : 'Member';
  if (!firstName || !lastName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      firstName.length > 100 || lastName.length > 100 || email.length > 200)
    return { ok: false, error: 'invalid' };

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return { ok: false, error: 'busy' };
  try {
    const accSheet = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
    if (!accSheet) return { ok: false, error: 'no_sheet' };
    const a = table(accSheet);
    if (a.col('email') < 0 || a.col('memberid') < 0) return { ok: false, error: 'bad_headers' };

    let memSheet;
    try { memSheet = SpreadsheetApp.openById(DATA_SHEET_ID).getSheetByName('members'); }
    catch (err) { return { ok: false, error: 'no_data_sheet' }; }
    if (!memSheet) return { ok: false, error: 'no_data_sheet' };
    const m = table(memSheet);
    if (m.col('memberid') < 0) return { ok: false, error: 'no_data_sheet' };

    // อีเมลซ้ำ: เช็กทั้งชีตบัญชีและแท็บ members
    const sameEmail = (t) => t.col('email') >= 0 &&
      t.rows.slice(1).some(r => String(r[t.col('email')]).trim().toLowerCase() === email);
    if (sameEmail(a) || sameEmail(m)) return { ok: false, error: 'email_exists' };

    // memberId ถัดไป (ดูจากทั้งสองชีต กันรหัสชนกัน)
    const ids = m.rows.slice(1).map(r => r[m.col('memberid')])
      .concat(a.rows.slice(1).map(r => r[a.col('memberid')]));
    const memberId = nextMemberId(ids);

    const values = { memberid: memberId, firstname: firstName, lastname: lastName,
                     position: position, email: email, active: '' };
    appendByHeader(memSheet, m, values);
    appendByHeader(accSheet, a, values);
    SpreadsheetApp.flush();
    return { ok: true, memberId: memberId };
  } finally {
    lock.releaseLock();
  }
}

function out(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
