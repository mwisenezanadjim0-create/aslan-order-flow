import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_FILE = process.env.DATABASE_PATH || join(__dirname, 'aslan-orders.json');

// Helper to initialize DB if it doesn't exist
function initDb() {
  const dir = dirname(DB_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    const initialData = {
      orders: [],
      reconciliations: [],
      nextOrderNumber: 1
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2), 'utf-8');
  }
}

// Helper to read DB state atomically
function readDb() {
  initDb();
  try {
    const content = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    console.error("DB read error, returning empty state:", err);
    return { orders: [], reconciliations: [], nextOrderNumber: 1 };
  }
}

// Helper to write DB state atomically
function writeDb(data) {
  try {
    // Generate temp file first for atomic write (prevent corruption on crash)
    const tempFile = `${DB_FILE}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempFile, DB_FILE);
  } catch (err) {
    console.error("DB write error:", err);
  }
}

// ─── Query Helpers ────────────────────────────────────────────────────────────

export function getNextOrderNumber() {
  const db = readDb();
  return db.nextOrderNumber || 1;
}

export function incrementOrderNumber() {
  const db = readDb();
  db.nextOrderNumber = (db.nextOrderNumber || 1) + 1;
  writeDb(db);
}

export function getAllOrders() {
  const db = readDb();
  return db.orders || [];
}

export function insertOrder(order) {
  const db = readDb();
  db.orders.push({
    ...order,
    voided: false,
    voidReason: null
  });
  writeDb(db);
}

export function voidOrder(id, reason) {
  const db = readDb();
  db.orders = db.orders.map(o => o.id === id ? { ...o, voided: true, voidReason: reason } : o);
  writeDb(db);
}

export function getAllReconciliations() {
  const db = readDb();
  return db.reconciliations || [];
}

export function insertReconciliation(entry) {
  const db = readDb();
  db.reconciliations.push(entry);
  writeDb(db);
}

export default {
  getNextOrderNumber,
  incrementOrderNumber,
  getAllOrders,
  insertOrder,
  voidOrder,
  getAllReconciliations,
  insertReconciliation
};
