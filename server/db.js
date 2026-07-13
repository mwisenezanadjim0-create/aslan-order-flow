import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Initialize connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Self-initializing schema check helper (returns a promise)
const initPromise = (async () => {
  try {
    const query = `
      CREATE TABLE IF NOT EXISTS orders (
        id VARCHAR(255) PRIMARY KEY,
        order_number INTEGER NOT NULL,
        waiter VARCHAR(255) NOT NULL,
        table_ref VARCHAR(255) NOT NULL,
        items TEXT NOT NULL,
        total INTEGER NOT NULL,
        created_at BIGINT NOT NULL,
        voided BOOLEAN NOT NULL DEFAULT false,
        void_reason TEXT
      );

      CREATE TABLE IF NOT EXISTS reconciliations (
        id VARCHAR(255) PRIMARY KEY,
        created_at BIGINT NOT NULL,
        tickets_counted INTEGER NOT NULL,
        plates_out INTEGER NOT NULL,
        system_tickets INTEGER NOT NULL,
        gap INTEGER NOT NULL,
        note TEXT
      );

      CREATE TABLE IF NOT EXISTS settings (
        key VARCHAR(255) PRIMARY KEY,
        value VARCHAR(255) NOT NULL
      );

      INSERT INTO settings (key, value) 
      VALUES ('nextOrderNumber', '1') 
      ON CONFLICT (key) DO NOTHING;
    `;
    await pool.query(query);
    console.log("✅ Neon PostgreSQL schema verified and active.");
  } catch (err) {
    console.error("❌ Failed to connect/initialize Neon database:", err);
  }
})();

export async function ensureDbReady() {
  await initPromise;
}

// ─── Query Helpers ────────────────────────────────────────────────────────────

export async function getNextOrderNumber() {
  await ensureDbReady();
  const res = await pool.query(`SELECT value FROM settings WHERE key = $1`, ['nextOrderNumber']);
  if (res.rows.length === 0) return 1;
  return parseInt(res.rows[0].value, 10);
}

export async function incrementOrderNumber() {
  await ensureDbReady();
  await pool.query(`
    UPDATE settings 
    SET value = CAST(CAST(value AS INTEGER) + 1 AS VARCHAR) 
    WHERE key = $1
  `, ['nextOrderNumber']);
}

export async function getAllOrders() {
  await ensureDbReady();
  const res = await pool.query(`SELECT * FROM orders ORDER BY order_number ASC`);
  return res.rows.map(o => ({
    id: o.id,
    orderNumber: o.order_number,
    waiter: o.waiter,
    table: o.table_ref,
    tableRef: o.table_ref,
    items: JSON.parse(o.items),
    total: o.total,
    createdAt: parseInt(o.created_at, 10),
    voided: o.voided,
    voidReason: o.void_reason
  }));
}

export async function insertOrder(order) {
  await ensureDbReady();
  const query = `
    INSERT INTO orders (id, order_number, waiter, table_ref, items, total, created_at, voided, void_reason)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
  `;
  await pool.query(query, [
    order.id,
    order.orderNumber,
    order.waiter,
    order.table || order.tableRef,
    JSON.stringify(order.items),
    order.total,
    order.createdAt,
    order.voided || false,
    order.voidReason || null
  ]);
}

export async function voidOrder(id, reason) {
  await ensureDbReady();
  await pool.query(`UPDATE orders SET voided = true, void_reason = $1 WHERE id = $2`, [reason, id]);
}

export async function getAllReconciliations() {
  await ensureDbReady();
  const res = await pool.query(`SELECT * FROM reconciliations ORDER BY created_at ASC`);
  return res.rows.map(r => ({
    id: r.id,
    createdAt: parseInt(r.created_at, 10),
    ticketsCounted: r.tickets_counted,
    platesOut: r.plates_out,
    systemTickets: r.system_tickets,
    gap: r.gap,
    note: r.note
  }));
}

export async function insertReconciliation(entry) {
  await ensureDbReady();
  const query = `
    INSERT INTO reconciliations (id, created_at, tickets_counted, plates_out, system_tickets, gap, note)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
  `;
  await pool.query(query, [
    entry.id,
    entry.createdAt,
    entry.ticketsCounted,
    entry.platesOut,
    entry.systemTickets,
    entry.gap,
    entry.note
  ]);
}

export default {
  ensureDbReady,
  getNextOrderNumber,
  incrementOrderNumber,
  getAllOrders,
  insertOrder,
  voidOrder,
  getAllReconciliations,
  insertReconciliation
};
