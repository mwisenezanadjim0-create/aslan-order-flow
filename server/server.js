import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import {
  initDb,
  getNextOrderNumber,
  incrementOrderNumber,
  getAllOrders,
  insertOrder,
  voidOrder,
  getAllReconciliations,
  insertReconciliation,
} from './db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Serve static compiled UI files in production (Railway / Render)
const distPath = join(__dirname, '../dist');
app.use(express.static(distPath));

// ─── Routes ──────────────────────────────────────────────────────────────────

// GET /api/state  — full snapshot for app init
app.get('/api/state', async (req, res) => {
  try {
    const orders = await getAllOrders();
    const reconciliations = await getAllReconciliations();
    const nextOrderNumber = await getNextOrderNumber();
    res.json({ orders, reconciliations, nextOrderNumber });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load state from PostgreSQL' });
  }
});

// POST /api/orders — create new order
app.post('/api/orders', async (req, res) => {
  try {
    const order = req.body;
    const orderNumber = await getNextOrderNumber();
    const newOrder = {
      ...order,
      orderNumber,
      createdAt: Date.now(),
      voided: false,
      voidReason: null,
    };
    await insertOrder(newOrder);
    await incrementOrderNumber();
    res.status(201).json({ ...newOrder, table: newOrder.tableRef || newOrder.table });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create order in PostgreSQL' });
  }
});

// PATCH /api/orders/:id/void — void an order
app.patch('/api/orders/:id/void', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ error: 'Reason required' });
    await voidOrder(id, reason);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to void order in PostgreSQL' });
  }
});

// POST /api/reconciliations — log a physical count entry
app.post('/api/reconciliations', async (req, res) => {
  try {
    const entry = {
      id: `r_${Date.now()}`,
      createdAt: Date.now(),
      ...req.body,
    };
    await insertReconciliation(entry);
    res.status(201).json(entry);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save reconciliation' });
  }
});

// Fallback all non-API GET requests to index.html for React SPA routing
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(join(distPath, 'index.html'));
});

// ─── Start ───────────────────────────────────────────────────────────────────

initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`\n🚀  Aslan Order Flow Server running on http://localhost:${PORT}`);
      console.log(`💾  Database Destination: Neon PostgreSQL Cloud\n`);
    });
  })
  .catch(err => {
    console.error("❌ Failed to connect to Neon PostgreSQL database:", err);
    process.exit(1);
  });
