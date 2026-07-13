import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  ReceiptText, PackageSearch, LayoutDashboard, Plus, Minus, Trash2, AlertTriangle,
  Check, Loader2, Printer, WifiOff
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

const API = "/api";

function fmt(n) {
  return new Intl.NumberFormat("en-RW").format(n) + " RWF";
}
function timeStr(ts) {
  return new Date(ts).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}
function dateStr(ts) {
  return new Date(ts).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}
function dayKey(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function dayLabel(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

// ─── API helpers ──────────────────────────────────────────────────────────────

async function apiGet(path) {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function apiPost(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function apiPatch(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [orders, setOrders] = useState([]);
  const [reconciliations, setReconciliations] = useState([]);
  const [nextOrderNumber, setNextOrderNumber] = useState(1);

  const [loaded, setLoaded] = useState(false);
  const [offline, setOffline] = useState(false);
  const [tab, setTab] = useState("orders");
  const [saving, setSaving] = useState(false);
  const [printTicket, setPrintTicket] = useState(null);

  // ─── Initial load ────────────────────────────────────────────────────────
  useEffect(() => {
    apiGet("/state")
      .then(({ orders, reconciliations, nextOrderNumber }) => {
        setOrders(orders);
        setReconciliations(reconciliations);
        setNextOrderNumber(nextOrderNumber);
        setOffline(false);
      })
      .catch(() => setOffline(true))
      .finally(() => setLoaded(true));
  }, []);

  // ─── Create order ────────────────────────────────────────────────────────
  const createOrder = useCallback(async (orderData) => {
    setSaving(true);
    try {
      const created = await apiPost("/orders", orderData);
      setOrders((prev) => [...prev, { ...created, table: created.table || created.tableRef }]);
      setNextOrderNumber((n) => n + 1);
      return created;
    } finally {
      setSaving(false);
    }
  }, []);

  // ─── Void order ──────────────────────────────────────────────────────────
  const doVoidOrder = useCallback(async (id, reason) => {
    setSaving(true);
    try {
      await apiPatch(`/orders/${id}/void`, { reason });
      setOrders((prev) => prev.map((o) => o.id === id ? { ...o, voided: true, voidReason: reason } : o));
    } finally {
      setSaving(false);
    }
  }, []);

  // ─── Create reconciliation ───────────────────────────────────────────────
  const createReconciliation = useCallback(async (data) => {
    setSaving(true);
    try {
      const created = await apiPost("/reconciliations", data);
      setReconciliations((prev) => [...prev, created]);
    } finally {
      setSaving(false);
    }
  }, []);

  const doPrint = useCallback((order) => {
    setPrintTicket(order);
    setTimeout(() => window.print(), 80);
  }, []);

  if (!loaded) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--m3-bg)" }}>
        <Loader2 size={28} style={{ color: "var(--m3-primary)", animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  return (
    <div className="m3-shell">
      {/* Receipt for printing */}
      <div id="print-area">
        {printTicket && (
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", color: "#000" }}>
            <p style={{ textAlign: "center", fontWeight: 700, letterSpacing: "1px", fontSize: 13 }}>ASLAN CAFÉ LUXE & RESTO</p>
            <p style={{ textAlign: "center", fontSize: 10, marginTop: 2 }}>GIKONDO, KIGALI</p>
            <p style={{ textAlign: "center", fontSize: 10 }}>KITCHEN TICKET</p>
            <p style={{ textAlign: "center", fontSize: 22, margin: "8px 0", fontWeight: 700 }}>#{String(printTicket.orderNumber).padStart(4, "0")}</p>
            <hr style={{ border: "none", borderTop: "1px dashed #000", margin: "6px 0" }} />
            <p style={{ fontSize: 11 }}>Date: {new Date(printTicket.createdAt).toLocaleString("en-GB")}</p>
            <p style={{ fontSize: 11 }}>Table: {printTicket.table || printTicket.tableRef}</p>
            <p style={{ fontSize: 11 }}>Waiter: {printTicket.waiter}</p>
            <hr style={{ border: "none", borderTop: "1px dashed #000", margin: "6px 0" }} />
            {printTicket.items.map((i, idx) => (
              <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, margin: "3px 0" }}>
                <span>{i.qty}x {i.name}</span>
              </div>
            ))}
            <hr style={{ border: "none", borderTop: "1px dashed #000", margin: "6px 0" }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700 }}>
              <span>TOTAL</span><span>{fmt(printTicket.total)}</span>
            </div>
            <p style={{ fontSize: 11, marginTop: 6 }}>Ticket #: {printTicket.orderNumber} &lt;&lt;</p>
            <p style={{ fontSize: 10, marginTop: 2 }}>{new Date(printTicket.createdAt).toLocaleString("en-GB")}</p>
            <hr style={{ border: "none", borderTop: "1px dashed #000", margin: "10px 0 6px" }} />
            <p style={{ fontSize: 10 }}>[ ] Sent to kitchen</p>
            <p style={{ fontSize: 10 }}>[ ] Cooking started</p>
            <p style={{ fontSize: 10 }}>[ ] Ready — sent to Expo</p>
            <p style={{ fontSize: 10 }}>[ ] Verified vs order (Expo sign)</p>
            <p style={{ fontSize: 10 }}>[ ] Served to table</p>
            <p style={{ fontSize: 10, marginTop: 8 }}>Expo sign: ____________</p>
            <p style={{ textAlign: "center", fontSize: 10, marginTop: 12 }}>THANK YOU!</p>
            <p style={{ textAlign: "center", fontSize: 9, marginTop: 4 }}>No ticket, no cooking.</p>
          </div>
        )}
      </div>

      {/* Navigation Rail (Desktop) */}
      <aside className="m3-rail">
        <div className="m3-logo-wrap">
          <div className="m3-logo">A</div>
        </div>
        <div className="m3-rail-menu">
          {[
            { id: "orders", label: "Orders", icon: ReceiptText },
            { id: "reconciliation", label: "Reconciliation", icon: PackageSearch },
            { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
          ].map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)} className={`m3-nav-btn ${active ? "active" : ""}`} aria-label={`Go to ${t.label}`}>
                <div className="m3-icon-wrapper"><Icon size={20} /></div>
                <span className="m3-nav-label">{t.label}</span>
              </button>
            );
          })}
        </div>
      </aside>

      {/* Bottom Nav (Mobile) */}
      <nav className="m3-bottom-nav">
        {[
          { id: "orders", label: "Orders", icon: ReceiptText },
          { id: "reconciliation", label: "Reconciliation", icon: PackageSearch },
          { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
        ].map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} className={`m3-nav-btn ${active ? "active" : ""}`} aria-label={`Go to ${t.label}`}>
              <div className="m3-icon-wrapper"><Icon size={22} /></div>
              <span className="m3-nav-label">{t.label}</span>
            </button>
          );
        })}
      </nav>

      <main className="m3-main">
        <header className="m3-header">
          <div className="m3-header-info">
            <h1>Aslan Café</h1>
            <p>Order Flow &amp; Integrity Log</p>
          </div>
          <div className="m3-sync-indicator" role="status">
            {offline ? (
              <><WifiOff size={14} style={{ color: "var(--m3-error)" }} /><span style={{ color: "var(--m3-error)" }}>Server offline — start backend</span></>
            ) : (
              <><span className={`m3-sync-dot ${saving ? "saving" : ""}`} /><span>{saving ? "Saving to DB..." : "Database Connected"}</span></>
            )}
          </div>
        </header>

        {offline && (
          <div style={{ background: "var(--m3-error-container)", color: "var(--m3-on-error-container)", borderRadius: 16, padding: "14px 20px", marginBottom: 24, fontSize: "0.85rem", display: "flex", alignItems: "center", gap: 12 }}>
            <WifiOff size={18} />
            <div>
              <strong>Backend not running.</strong> Open a terminal and run: <code style={{ background: "rgba(0,0,0,0.2)", padding: "2px 8px", borderRadius: 6 }}>npm run start</code>
            </div>
          </div>
        )}

        {tab === "orders" && (
          <Orders
            orders={orders}
            nextOrderNumber={nextOrderNumber}
            onCreateOrder={createOrder}
            onVoidOrder={doVoidOrder}
            onPrint={doPrint}
          />
        )}
        {tab === "reconciliation" && (
          <Reconciliation
            orders={orders}
            reconciliations={reconciliations}
            onCreateReconciliation={createReconciliation}
          />
        )}
        {tab === "dashboard" && (
          <Dashboard orders={orders} reconciliations={reconciliations} />
        )}
      </main>
    </div>
  );
}

/* ────────────────────────── ORDERS ─────────────────────────────────────────── */
function Orders({ orders, nextOrderNumber, onCreateOrder, onVoidOrder, onPrint }) {
  const [waiter, setWaiter] = useState("");
  const [table, setTable] = useState("");
  const [foodName, setFoodName] = useState("");
  const [foodPrice, setFoodPrice] = useState("");
  const [foodQty, setFoodQty] = useState(1);
  const [cart, setCart] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const addCustomItem = (e) => {
    e.preventDefault();
    if (!foodName.trim() || !foodPrice || Number(foodPrice) <= 0) return;
    const priceNum = Number(foodPrice);
    const qtyNum = Number(foodQty);
    setCart((prev) => {
      const idx = prev.findIndex((i) => i.name.toLowerCase() === foodName.trim().toLowerCase() && i.price === priceNum);
      if (idx > -1) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: next[idx].qty + qtyNum };
        return next;
      }
      return [...prev, { id: `item_${Date.now()}`, name: foodName.trim(), price: priceNum, qty: qtyNum }];
    });
    setFoodName("");
    setFoodPrice("");
    setFoodQty(1);
  };

  const removeCartItem = (id) => setCart((prev) => prev.filter((i) => i.id !== id));
  const updateCartQty = (id, delta) =>
    setCart((prev) =>
      prev.map((i) => i.id === id ? (i.qty + delta > 0 ? { ...i, qty: i.qty + delta } : i) : i)
    );

  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);

  const submitOrder = async () => {
    if (cart.length === 0 || !table.trim() || !waiter.trim() || submitting) return;
    setSubmitting(true);
    try {
      const created = await onCreateOrder({
        id: `o_${Date.now()}`,
        waiter: waiter.trim(),
        table: table.trim(),
        items: cart.map((i) => ({ name: i.name, qty: i.qty, price: i.price })),
        total,
      });
      setCart([]);
      setTable("");
      onPrint(created);
    } finally {
      setSubmitting(false);
    }
  };

  const voidOrder = (id) => {
    const reason = prompt("Reason for voiding this ticket:");
    if (!reason) return;
    onVoidOrder(id, reason);
  };

  const sortedOrders = useMemo(() => [...orders].sort((a, b) => b.orderNumber - a.orderNumber), [orders]);
  const activeCount = orders.filter((o) => !o.voided).length;

  return (
    <div className="m3-grid">
      {/* Add Items Panel */}
      <div className="m3-col-5">
        <h3 className="m3-card-title stagger-in" style={{ marginBottom: "12px", color: "var(--m3-outline)" }}>Add Items</h3>
        <div className="m3-card elevated m3-flex-gap-12 stagger-in" style={{ padding: "28px", animationDelay: "60ms" }}>
          <form onSubmit={addCustomItem} className="m3-flex-gap-12">
            <div className="m3-field">
              <label className="m3-label" htmlFor="food-name-input">Food / Beverage Name</label>
              <input id="food-name-input" type="text" required value={foodName} onChange={(e) => setFoodName(e.target.value)} placeholder="e.g. Steak, Dawa Tea" className="m3-input" />
            </div>
            <div className="m3-field">
              <label className="m3-label" htmlFor="food-price-input">Unit Price (RWF)</label>
              <input id="food-price-input" type="number" required min="0" value={foodPrice} onChange={(e) => setFoodPrice(e.target.value)} placeholder="e.g. 5000" className="m3-input" />
            </div>
            <div className="m3-field">
              <label className="m3-label" htmlFor="food-qty-input">Quantity</label>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <button type="button" onClick={() => setFoodQty((q) => Math.max(1, q - 1))} className="m3-ticket-btn" style={{ height: "48px", width: "48px", borderRadius: "12px" }}><Minus size={16} /></button>
                <input id="food-qty-input" type="number" required min="1" value={foodQty} onChange={(e) => setFoodQty(Math.max(1, Number(e.target.value)))} className="m3-input" style={{ flex: 1, textAlign: "center", fontFamily: "var(--font-mono)" }} />
                <button type="button" onClick={() => setFoodQty((q) => q + 1)} className="m3-ticket-btn" style={{ height: "48px", width: "48px", borderRadius: "12px" }}><Plus size={16} /></button>
              </div>
            </div>
            <button type="submit" className="m3-btn m3-btn-secondary w-full" style={{ marginTop: "8px" }}>
              <Plus size={16} /> Add Item to Ticket
            </button>
          </form>
        </div>
      </div>

      {/* Ticket Builder */}
      <div className="m3-col-3">
        <div style={{ position: "sticky", top: "24px" }}>
          <h3 className="m3-card-title" style={{ marginBottom: "12px" }}>New Ticket</h3>
          <div className="m3-ticket-preview">
            <div className="m3-ticket-body">
              <div className="m3-ticket-header">
                <span className="m3-ticket-title">Aslan Café</span>
                <h2 className="m3-ticket-num">#{String(nextOrderNumber).padStart(4, "0")}</h2>
              </div>
              <div className="m3-flex-gap-12" style={{ marginBottom: "20px" }}>
                <div className="m3-field">
                  <label className="m3-label" htmlFor="waiter-name-input">Worker Name / Waiter</label>
                  <input id="waiter-name-input" type="text" value={waiter} onChange={(e) => setWaiter(e.target.value)} placeholder="e.g. Alice M." className="m3-input" />
                </div>
                <div className="m3-field">
                  <label className="m3-label" htmlFor="table-input">Table / Order Type</label>
                  <input id="table-input" type="text" value={table} onChange={(e) => setTable(e.target.value)} placeholder="e.g. Table 5, Delivery" className="m3-input" />
                </div>
              </div>

              {cart.length === 0 ? (
                <div className="m3-empty-state">Add items from the panel on the left.</div>
              ) : (
                <div className="m3-ticket-items">
                  {cart.map((i) => (
                    <div key={i.id} className="m3-ticket-row">
                      <div style={{ display: "flex", flexDirection: "column", minWidth: 0, paddingRight: "8px" }}>
                        <span className="m3-ticket-name">{i.name}</span>
                        <span style={{ fontSize: "0.72rem", color: "var(--m3-primary)", fontFamily: "var(--font-mono)" }}>{fmt(i.price)}</span>
                      </div>
                      <div className="m3-ticket-controls">
                        <button onClick={() => updateCartQty(i.id, -1)} className="m3-ticket-btn"><Minus size={12} /></button>
                        <span className="m3-ticket-qty">{i.qty}</span>
                        <button onClick={() => updateCartQty(i.id, 1)} className="m3-ticket-btn"><Plus size={12} /></button>
                        <button onClick={() => removeCartItem(i.id)} className="m3-ticket-btn" style={{ color: "var(--m3-error)" }}><Trash2 size={12} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="m3-ticket-total">
                <span>Total Amount</span>
                <span className="m3-ticket-total-val">{fmt(total)}</span>
              </div>
            </div>
            <div className="ticket-edge" />
            <button
              onClick={submitOrder}
              disabled={cart.length === 0 || !table.trim() || !waiter.trim() || submitting}
              className="m3-btn m3-btn-primary w-full"
              style={{ borderRadius: "0 0 24px 24px", height: "48px" }}
            >
              {submitting ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> : <Printer size={16} />}
              {submitting ? "Saving..." : "Generate & Print Ticket"}
            </button>
          </div>
        </div>
      </div>

      {/* Ticket Log */}
      <div className="m3-col-4">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <h3 className="m3-card-title">Ticket Log</h3>
          <span style={{ fontSize: "0.75rem", color: "var(--m3-on-surface-variant)", fontWeight: "700" }}>{activeCount} Active</span>
        </div>
        <div className="m3-log-list">
          {sortedOrders.length === 0 ? (
            <div className="m3-card m3-empty-state">No tickets yet.</div>
          ) : (
            sortedOrders.map((o, idx) => (
              <div key={o.id} className={`m3-log-card stagger-in ${o.voided ? "voided" : ""}`} style={{ animationDelay: `${idx * 40}ms` }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="m3-log-top-row">
                    <span className="m3-log-badge">#{String(o.orderNumber).padStart(4, "0")}</span>
                    {o.voided && <span className="m3-void-label">Voided</span>}
                  </div>
                  <div className="m3-log-details">{o.table || o.tableRef} · {o.waiter}</div>
                  <div className="m3-log-items">{o.items.map((i) => `${i.qty}x ${i.name}`).join(", ")}</div>
                  {o.voided && <div style={{ color: "var(--m3-error)", fontSize: "0.72rem", marginTop: "4px" }}>Reason: {o.voidReason}</div>}
                </div>
                <div className="m3-log-right">
                  <span className="m3-log-price">{fmt(o.total)}</span>
                  <span className="m3-log-time">{timeStr(o.createdAt)}</span>
                  <div className="m3-action-row">
                    <button onClick={() => onPrint(o)} className="m3-action-btn"><Printer size={12} /> Reprint</button>
                    {!o.voided && (
                      <button onClick={() => voidOrder(o.id)} className="m3-action-btn void"><Trash2 size={12} /> Void</button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────── RECONCILIATION ───────────────────────────────────── */
function Reconciliation({ orders, reconciliations, onCreateReconciliation }) {
  const [ticketsCounted, setTicketsCounted] = useState("");
  const [platesOut, setPlatesOut] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const systemTickets = orders.filter((o) => !o.voided).length;

  const saveEntry = async () => {
    if (ticketsCounted === "" || platesOut === "" || submitting) return;
    setSubmitting(true);
    try {
      await onCreateReconciliation({
        ticketsCounted: Number(ticketsCounted),
        platesOut: Number(platesOut),
        systemTickets,
        gap: Number(platesOut) - Number(ticketsCounted),
        note: note.trim(),
      });
      setTicketsCounted("");
      setPlatesOut("");
      setNote("");
    } finally {
      setSubmitting(false);
    }
  };

  const history = useMemo(() => [...reconciliations].sort((a, b) => b.createdAt - a.createdAt), [reconciliations]);
  const latest = history[0];

  return (
    <div className="m3-grid">
      <div className="m3-col-5">
        <h3 className="m3-card-title" style={{ marginBottom: "12px" }}>Daily Physical Count</h3>
        <div className="m3-card elevated m3-flex-gap-12">
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", borderBottom: "1px dashed var(--m3-outline-variant)", paddingBottom: "12px" }}>
            <span style={{ color: "var(--m3-on-surface-variant)" }}>System tickets (unvoided)</span>
            <span style={{ fontFamily: "var(--font-mono)", fontWeight: "600", color: "var(--m3-primary)" }}>{systemTickets}</span>
          </div>
          <div className="m3-field">
            <label className="m3-label" htmlFor="tickets-phys-input">Tickets Counted Physically</label>
            <input id="tickets-phys-input" type="number" value={ticketsCounted} onChange={(e) => setTicketsCounted(e.target.value)} placeholder="e.g. 45" className="m3-input" style={{ fontFamily: "var(--font-mono)" }} />
          </div>
          <div className="m3-field">
            <label className="m3-label" htmlFor="plates-phys-input">Plates Counted Out (Expo)</label>
            <input id="plates-phys-input" type="number" value={platesOut} onChange={(e) => setPlatesOut(e.target.value)} placeholder="e.g. 48" className="m3-input" style={{ fontFamily: "var(--font-mono)" }} />
          </div>
          <div className="m3-field">
            <label className="m3-label" htmlFor="note-input">Note</label>
            <input id="note-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. evening shift, chef Eric + Alice" className="m3-input" />
          </div>
          <button onClick={saveEntry} disabled={ticketsCounted === "" || platesOut === "" || submitting} className="m3-btn m3-btn-primary w-full" style={{ marginTop: "8px" }}>
            {submitting ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> : <Check size={16} />}
            {submitting ? "Saving to DB..." : "Save Entry to Database"}
          </button>
        </div>
      </div>

      <div className="m3-col-7 m3-flex-gap-12">
        {latest && (
          <div className={`reconciliation-status ${latest.gap !== 0 ? "alert" : ""}`} role="alert">
            <div className="reconcile-tag">
              {latest.gap !== 0 ? <AlertTriangle size={12} /> : <Check size={12} />}
              Latest — {dateStr(latest.createdAt)} {timeStr(latest.createdAt)}
            </div>
            <h2 className="reconcile-headline">
              {latest.gap === 0 ? "Balanced — plates match tickets" : latest.gap > 0 ? `${latest.gap} plate(s) out with no matching ticket` : `${Math.abs(latest.gap)} ticket(s) never left the kitchen`}
            </h2>
            <p className="reconcile-desc">
              {latest.gap > 0 ? "Warning: Off-book food was served. Verify staff shifts and order integrity."
                : latest.gap < 0 ? "Discrepancy: Tickets printed but kitchen did not serve the dishes."
                : "Excellent. Physical plate counts align perfectly with registered tickets."}
            </p>
          </div>
        )}
        <div>
          <h3 className="m3-card-title" style={{ marginBottom: "12px" }}>Count History</h3>
          <div className="m3-table-card">
            <div className="m3-table-header">
              <span>Date / Time</span>
              <span className="text-right">Tickets</span>
              <span className="text-right">Plates</span>
              <span className="text-right">Gap</span>
              <span className="text-right">Note</span>
            </div>
            {history.length === 0 ? (
              <div className="m3-empty-state">No reconciliation entries yet.</div>
            ) : (
              history.map((r, idx) => (
                <div key={r.id} className="m3-table-row stagger-in" style={{ animationDelay: `${idx * 40}ms` }}>
                  <span style={{ color: "var(--m3-on-surface-variant)" }}>{dateStr(r.createdAt)} <span style={{ fontSize: "0.75rem", opacity: 0.8 }}>{timeStr(r.createdAt)}</span></span>
                  <span className="text-right" data-mono="true">{r.ticketsCounted}</span>
                  <span className="text-right" data-mono="true">{r.platesOut}</span>
                  <span className="text-right" style={{ fontWeight: "700", color: r.gap === 0 ? "var(--m3-tertiary)" : "var(--m3-error)" }} data-mono="true">{r.gap > 0 ? `+${r.gap}` : r.gap}</span>
                  <span className="text-right" style={{ fontSize: "0.78rem", color: "var(--m3-on-surface-variant)", overflow: "hidden", textOverflow: "ellipsis" }}>{r.note || "—"}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────── DASHBOARD ────────────────────────────────────── */
function Dashboard({ orders, reconciliations }) {
  const enteredByDay = useMemo(() => {
    const map = {};
    orders.filter((o) => !o.voided).forEach((o) => {
      const key = dayKey(o.createdAt);
      const qty = o.items.reduce((s, i) => s + i.qty, 0);
      map[key] = (map[key] || 0) + qty;
    });
    return map;
  }, [orders]);

  const usedByDay = useMemo(() => {
    const map = {};
    reconciliations.forEach((r) => {
      const key = dayKey(r.createdAt);
      map[key] = (map[key] || 0) + r.platesOut;
    });
    return map;
  }, [reconciliations]);

  const allDays = useMemo(() => {
    const keys = new Set([...Object.keys(enteredByDay), ...Object.keys(usedByDay)]);
    return [...keys].sort().slice(-14).map((key) => ({
      day: dayLabel(key),
      "Plates entered": enteredByDay[key] || 0,
      "Plates used out": usedByDay[key] || 0,
    }));
  }, [enteredByDay, usedByDay]);

  const todayKey = dayKey(Date.now());
  const todayEntered = enteredByDay[todayKey] || 0;
  const todayUsed = usedByDay[todayKey] || 0;
  const todayGap = todayUsed - todayEntered;

  return (
    <div className="m3-grid">
      <div className="m3-col-4">
        <div className="stat-card-m3 stagger-in" style={{ animationDelay: "40ms" }}>
          <div className="stat-card-label">Plates Entered Today</div>
          <div className="stat-card-val">{todayEntered}</div>
        </div>
      </div>
      <div className="m3-col-4">
        <div className="stat-card-m3 stagger-in" style={{ animationDelay: "80ms" }}>
          <div className="stat-card-label">Plates Used Out Today</div>
          <div className="stat-card-val">{todayUsed}</div>
        </div>
      </div>
      <div className="m3-col-4">
        <div className={`stat-card-m3 stagger-in ${todayGap !== 0 ? "alert" : ""}`} style={{ animationDelay: "120ms" }}>
          <div className="stat-card-label">Balance Gap</div>
          <div className="stat-card-val">{todayGap > 0 ? `+${todayGap}` : todayGap}</div>
        </div>
      </div>

      <div className="m3-col-12">
        <h3 className="m3-card-title stagger-in" style={{ marginBottom: "12px", animationDelay: "160ms" }}>Plates Entered vs Used Out (Last 14 Days)</h3>
        <div className="m3-card stagger-in" style={{ animationDelay: "200ms" }}>
          {allDays.length === 0 ? (
            <div className="m3-empty-state" style={{ padding: "64px 0" }}>No data yet — generate tickets and log reconciliations.</div>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={allDays} barGap={6}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--m3-outline-variant)" vertical={false} />
                <XAxis dataKey="day" tick={{ fill: "var(--m3-on-surface-variant)", fontSize: 11 }} axisLine={{ stroke: "var(--m3-outline-variant)" }} tickLine={false} />
                <YAxis tick={{ fill: "var(--m3-on-surface-variant)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "var(--m3-surface-container-high)", border: "1px solid var(--m3-outline-variant)", borderRadius: 16, fontSize: 12 }} labelStyle={{ color: "var(--m3-on-surface)", fontWeight: "600" }} />
                <Legend wrapperStyle={{ fontSize: 11, color: "var(--m3-on-surface-variant)", paddingTop: "12px" }} />
                <Bar dataKey="Plates entered" fill="var(--m3-primary)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Plates used out" fill="var(--m3-tertiary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="m3-col-12">
        <h3 className="m3-card-title stagger-in" style={{ marginBottom: "12px", animationDelay: "240ms" }}>Daily Breakdown</h3>
        <div className="m3-table-card stagger-in" style={{ animationDelay: "280ms" }}>
          <div className="m3-table-header" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
            <span>Day</span><span className="text-right">Entered</span><span className="text-right">Used Out</span>
          </div>
          {allDays.length === 0 ? (
            <div className="m3-empty-state">No daily logs yet.</div>
          ) : (
            [...allDays].reverse().map((d, idx) => (
              <div key={idx} className="m3-table-row stagger-in" style={{ gridTemplateColumns: "1fr 1fr 1fr", animationDelay: `${idx * 35}ms` }}>
                <span style={{ color: "var(--m3-on-surface-variant)" }}>{d.day}</span>
                <span className="text-right" style={{ color: "var(--m3-primary)" }} data-mono="true">{d["Plates entered"]}</span>
                <span className="text-right" style={{ color: "var(--m3-tertiary)" }} data-mono="true">{d["Plates used out"]}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
