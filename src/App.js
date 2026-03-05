import { useState, useEffect, useCallback } from "react";
import { db, ref, onValue, set } from "./firebase";

const DEPARTMENTS = ["LED team (Serbia)"];
const UNITS = ["kom", "kg", "l", "m", "kutija", "paleta", "set"];
const INITIAL_DATA = { "LED_team_Serbia": [] };
const DB_PATH = "warehouse";

function generateId() { return `id_${Date.now()}_${Math.floor(Math.random() * 9999)}`; }

// Firebase ne dozvoljava . / # $ [ ] u ključevima — koristimo underscore verziju
function deptKey(name) { return name.replace(/[./#$[\]\s()]/g, "_"); }
function deptName(key) { return key.replace(/_/g, " ").replace("  ", " (").replace(/(\w)(\s)(\w)$/, "$1)"); }

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);
  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return isMobile;
}

export default function WarehouseApp() {
  const isMobile = useIsMobile();
  const [data, setData] = useState(INITIAL_DATA);
  const [activeDept] = useState("LED_team_Serbia");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ name: "", quantity: "", unit: "kom", minStock: "", category: "" });
  const [notification, setNotification] = useState(null);
  const [showTransfer, setShowTransfer] = useState(null);
  const [transferDept, setTransferDept] = useState("");
  const [transferQty, setTransferQty] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [expandedItem, setExpandedItem] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);

  // Online/offline detection
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  // Firebase real-time listener
  useEffect(() => {
    const dbRef = ref(db, DB_PATH);
    const unsub = onValue(dbRef, (snapshot) => {
      const val = snapshot.val();
      if (val) setData(val);
      else setData(INITIAL_DATA);
      setLoaded(true);
    }, () => setLoaded(true));
    return () => unsub();
  }, []);

  const save = useCallback(async (newData) => {
    setSyncing(true);
    try {
      await set(ref(db, DB_PATH), newData);
    } catch (e) {
      console.error("Firebase write error:", e);
    }
    setTimeout(() => setSyncing(false), 600);
  }, []);

  const notify = (msg, type = "success") => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 2500);
  };

  const currentItems = (data[activeDept] || []).filter(i =>
    i.name.toLowerCase().includes(search.toLowerCase()) ||
    (i.category || "").toLowerCase().includes(search.toLowerCase())
  );

  const totalItems = Object.values(data).reduce((a, arr) => a + (Array.isArray(arr) ? arr.length : 0), 0);
  const lowStockItems = Object.values(data).flat().filter(i => i && i.minStock > 0 && i.quantity <= i.minStock).length;

  const openAdd = () => { setEditItem(null); setForm({ name: "", quantity: "", unit: "kom", minStock: "", category: "" }); setShowForm(true); };
  const openEdit = (item) => { setEditItem(item); setForm({ name: item.name, quantity: item.quantity, unit: item.unit, minStock: item.minStock, category: item.category || "" }); setShowForm(true); };

  const submitForm = () => {
    if (!form.name || form.quantity === "") return;
    const updated = { ...data };
    if (!Array.isArray(updated[activeDept])) updated[activeDept] = [];
    if (editItem) {
      updated[activeDept] = updated[activeDept].map(i => i.id === editItem.id ? { ...i, ...form, quantity: Number(form.quantity), minStock: Number(form.minStock) } : i);
      notify("Artikal ažuriran ✓");
    } else {
      updated[activeDept] = [...updated[activeDept], { id: generateId(), ...form, quantity: Number(form.quantity), minStock: Number(form.minStock) }];
      notify("Artikal dodat ✓");
    }
    setData(updated); save(updated); setShowForm(false);
  };

  const deleteItem = (id) => {
    const updated = { ...data };
    updated[activeDept] = updated[activeDept].filter(i => i.id !== id);
    setData(updated); save(updated); setExpandedItem(null); notify("Artikal obrisan", "error");
  };

  const adjustQty = (id, delta) => {
    const updated = { ...data };
    updated[activeDept] = updated[activeDept].map(i => i.id === id ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i);
    setData(updated); save(updated);
  };

  const doTransfer = () => {
    if (!transferDept || !transferQty || transferDept === activeDept) return;
    const qty = Number(transferQty);
    const item = data[activeDept].find(i => i.id === showTransfer);
    if (!item || item.quantity < qty) { notify("Nedovoljno na stanju", "error"); return; }
    const updated = { ...data };
    updated[activeDept] = updated[activeDept].map(i => i.id === showTransfer ? { ...i, quantity: i.quantity - qty } : i);
    if (!Array.isArray(updated[transferDept])) updated[transferDept] = [];
    const existing = updated[transferDept].find(i => i.name === item.name);
    if (existing) {
      updated[transferDept] = updated[transferDept].map(i => i.name === item.name ? { ...i, quantity: i.quantity + qty } : i);
    } else {
      updated[transferDept] = [...updated[transferDept], { ...item, id: generateId(), quantity: qty }];
    }
    setData(updated); save(updated); setShowTransfer(null); setTransferDept(""); setTransferQty("");
    notify(`Preneto ${qty} × ${item.name} ✓`);
  };

  const getStockColor = (item) => {
    if (item.quantity === 0) return "#ff4444";
    if (item.minStock > 0 && item.quantity <= item.minStock) return "#ffaa00";
    return "#00e676";
  };

  if (!loaded) return (
    <div style={{ background: "#0a0e1a", height: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14 }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400&display=swap');`}</style>
      <div style={{ width: 44, height: 44, border: "3px solid #1e3a5f", borderTop: "3px solid #4fc3f7", borderRadius: "50%", animation: "spin 0.9s linear infinite" }} />
      <div style={{ color: "#4fc3f7", fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, letterSpacing: 3 }}>POVEZIVANJE SA BAZOM...</div>
    </div>
  );

  return (
    <div style={{ background: "#0a0e1a", minHeight: "100vh", fontFamily: "'IBM Plex Mono','Courier New',monospace", color: "#e0e8f0", paddingBottom: isMobile ? 80 : 0 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500;600&family=IBM+Plex+Sans:wght@400;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
        ::-webkit-scrollbar { width: 3px; } ::-webkit-scrollbar-thumb { background: #1e3a5f; }
        input, select, button { outline: none; font-family: inherit; }
        .form-input { width: 100%; background: #0a0e1a; border: 1px solid #1e3a5f; color: #e0e8f0; padding: 12px 14px; border-radius: 8px; font-family: inherit; font-size: 14px; transition: border 0.2s; }
        .form-input:focus { border-color: #4fc3f7; }
        .form-label { display: block; font-size: 10px; letter-spacing: 2px; color: #4fc3f7; margin-bottom: 6px; }
        .notification { position: fixed; top: 16px; left: 50%; transform: translateX(-50%); z-index: 300; padding: 11px 22px; border-radius: 24px; font-size: 13px; white-space: nowrap; animation: popIn 0.3s ease; box-shadow: 0 8px 32px rgba(0,0,0,0.5); }
        @keyframes popIn { from { transform: translateX(-50%) translateY(-16px); opacity: 0; } to { transform: translateX(-50%) translateY(0); opacity: 1; } }
        .card { background: #0d1526; border-radius: 14px; padding: 16px; transition: transform 0.15s; border: 1px solid #1a2f4a; cursor: pointer; user-select: none; }
        .card:active { transform: scale(0.985); }
        .fab { position: fixed; bottom: 86px; right: 20px; width: 58px; height: 58px; border-radius: 50%; background: #4fc3f7; border: none; cursor: pointer; font-size: 30px; color: #0a0e1a; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 24px rgba(79,195,247,0.45); z-index: 50; transition: transform 0.15s; }
        .fab:active { transform: scale(0.9); }
        .qty-circle { width: 42px; height: 42px; border-radius: 50%; border: 1.5px solid #1e3a5f; background: rgba(79,195,247,0.06); color: #4fc3f7; font-size: 22px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s; }
        .qty-circle:active { background: #4fc3f7; color: #0a0e1a; transform: scale(0.9); }
        .modal-bg { position: fixed; inset: 0; background: rgba(0,0,0,0.82); z-index: 100; backdrop-filter: blur(6px); }
        .modal { background: #0d1526; border-top: 1px solid #1e3a5f; border-radius: 20px 20px 0 0; padding: 12px 20px 32px; width: 100%; position: fixed; bottom: 0; animation: slideUp 0.28s cubic-bezier(0.32,0.72,0,1); max-height: 90vh; overflow-y: auto; }
        @media (min-width: 640px) { .modal { border-radius: 16px; border: 1px solid #1e3a5f; width: 440px; top: 50%; left: 50%; transform: translate(-50%,-50%) !important; bottom: auto; position: fixed; animation: none; max-height: 85vh; padding: 28px; } }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        .bottom-nav { position: fixed; bottom: 0; left: 0; right: 0; background: #0d1526; border-top: 1px solid #1e3a5f; display: flex; padding: 8px 0 12px; z-index: 50; }
        .nav-item { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 4px 0; }
        .action-chip { flex: 1; padding: 11px 4px; border-radius: 10px; border: 1px solid; font-size: 11px; cursor: pointer; font-family: inherit; text-align: center; }
        .action-chip:active { opacity: 0.6; }
        .expanded-section { margin-top: 14px; padding-top: 14px; border-top: 1px solid #1a2f4a; display: flex; gap: 8px; animation: fadeIn 0.2s ease; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
        .stat-card { background: #0d1526; border: 1px solid #1a2f4a; border-radius: 10px; padding: 10px 14px; flex: 1; text-align: center; }
        .pulse { animation: pulse 2s infinite; }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      {notification && (
        <div className="notification" style={{ background: notification.type === "error" ? "#1f0a0a" : "#0a1f10", border: `1px solid ${notification.type === "error" ? "#ff4444" : "#00e676"}`, color: notification.type === "error" ? "#ff6666" : "#66ff99" }}>
          {notification.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ background: "#0d1526", borderBottom: "1px solid #1e3a5f", padding: isMobile ? "14px 16px 16px" : "16px 28px 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 9, letterSpacing: 3, color: "#4fc3f7", marginBottom: 4 }}>WAREHOUSE SYSTEM</div>
            <div style={{ fontSize: isMobile ? 18 : 22, fontWeight: 700, fontFamily: "'IBM Plex Sans',sans-serif" }}>
              ▣ LED team <span style={{ color: "#4fc3f7" }}>(Serbia)</span>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#0a0e1a", border: "1px solid #1e3a5f", borderRadius: 20, padding: "5px 12px" }}>
              {syncing ? (
                <>
                  <div style={{ width: 8, height: 8, border: "1.5px solid #4fc3f7", borderTop: "1.5px solid transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
                  <span style={{ fontSize: 10, color: "#4fc3f7", letterSpacing: 1 }}>SYNC...</span>
                </>
              ) : (
                <>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: online ? "#00e676" : "#ff4444", boxShadow: `0 0 6px ${online ? "#00e676" : "#ff4444"}` }} className="pulse" />
                  <span style={{ fontSize: 10, color: online ? "#00e676" : "#ff4444", letterSpacing: 1 }}>{online ? "ONLINE" : "OFFLINE"}</span>
                </>
              )}
            </div>
            {!isMobile && (
              <button onClick={openAdd} style={{ background: "#4fc3f7", color: "#0a0e1a", border: "none", padding: "9px 18px", borderRadius: 8, fontWeight: 700, fontSize: 11, cursor: "pointer", letterSpacing: 1 }}>
                + DODAJ ARTIKAL
              </button>
            )}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <div className="stat-card">
            <div style={{ fontSize: 9, color: "#7a99bb", letterSpacing: 2 }}>ARTIKALA</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#4fc3f7", marginTop: 2 }}>{totalItems}</div>
          </div>
          <div className="stat-card">
            <div style={{ fontSize: 9, color: "#7a99bb", letterSpacing: 2 }}>NIZAK STOCK</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: lowStockItems > 0 ? "#ffaa00" : "#00e676", marginTop: 2 }}>{lowStockItems}</div>
          </div>
          <div className="stat-card">
            <div style={{ fontSize: 9, color: "#7a99bb", letterSpacing: 2 }}>REAL-TIME</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#e0e8f0", marginTop: 4 }}>FIREBASE</div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div style={{ padding: isMobile ? "12px 16px" : "14px 28px" }}>
        <div style={{ position: "relative" }}>
          <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#4fc3f7", fontSize: 16 }}>⌕</span>
          <input className="form-input" style={{ paddingLeft: 38, borderRadius: 24 }} placeholder="Pretraži artikle..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {/* Items */}
      <div style={{ padding: isMobile ? "0 16px 16px" : "0 28px 28px" }}>
        <div style={{ fontSize: 10, color: "#7a99bb", letterSpacing: 2, marginBottom: 10 }}>{currentItems.length} ARTIKALA</div>

        {currentItems.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px", border: "1px dashed #1e3a5f", borderRadius: 16 }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>📦</div>
            <div style={{ fontSize: 11, color: "#3a5a7a", letterSpacing: 2 }}>NEMA ARTIKALA</div>
            <div style={{ fontSize: 11, color: "#2a4a6a", marginTop: 8 }}>{isMobile ? "Tapni + da dodaš prvi artikal" : "Klikni + DODAJ ARTIKAL"}</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {currentItems.map(item => {
              const sc = getStockColor(item);
              const isExp = expandedItem === item.id;
              return (
                <div key={item.id} className="card" style={{ borderColor: item.minStock > 0 && item.quantity <= item.minStock ? "rgba(255,170,0,0.3)" : "#1a2f4a" }}
                  onClick={() => setExpandedItem(isExp ? null : item.id)}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: sc, boxShadow: `0 0 8px ${sc}`, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, color: "#c8ddf0", fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.name}</div>
                      {item.category && <div style={{ fontSize: 10, color: "#4fc3f7", letterSpacing: 1, marginTop: 2 }}>{item.category}</div>}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                      <button className="qty-circle" onClick={() => adjustQty(item.id, -1)}>−</button>
                      <div style={{ textAlign: "center", minWidth: 46 }}>
                        <div style={{ fontSize: 24, fontWeight: 700, color: sc, lineHeight: 1 }}>{item.quantity}</div>
                        <div style={{ fontSize: 10, color: "#7a99bb" }}>{item.unit}</div>
                      </div>
                      <button className="qty-circle" onClick={() => adjustQty(item.id, 1)}>+</button>
                    </div>
                    <div style={{ color: "#3a5a7a", fontSize: 11, transition: "transform 0.2s", transform: isExp ? "rotate(180deg)" : "none", flexShrink: 0 }}>▼</div>
                  </div>

                  {item.minStock > 0 && (
                    <div style={{ marginTop: 10 }}>
                      <div style={{ background: "#0a0e1a", borderRadius: 4, height: 3 }}>
                        <div style={{ height: "100%", borderRadius: 4, background: sc, width: `${Math.min(100, (item.quantity / Math.max(1, item.minStock * 2)) * 100)}%`, transition: "width 0.4s" }} />
                      </div>
                      <div style={{ fontSize: 10, color: "#5a7a9a", marginTop: 3 }}>Min: {item.minStock} {item.unit}</div>
                    </div>
                  )}

                  {isExp && (
                    <div className="expanded-section" onClick={e => e.stopPropagation()}>
                      <button className="action-chip" style={{ background: "rgba(79,195,247,0.08)", borderColor: "rgba(79,195,247,0.25)", color: "#4fc3f7" }} onClick={() => { openEdit(item); setExpandedItem(null); }}>✏ UREDI</button>
                      <button className="action-chip" style={{ background: "rgba(255,170,0,0.08)", borderColor: "rgba(255,170,0,0.25)", color: "#ffaa00" }} onClick={() => { setShowTransfer(item.id); setTransferDept(""); setTransferQty(""); setExpandedItem(null); }}>⇄ PRENESI</button>
                      <button className="action-chip" style={{ background: "rgba(255,68,68,0.08)", borderColor: "rgba(255,68,68,0.25)", color: "#ff6666" }} onClick={() => deleteItem(item.id)}>✕ OBRIŠI</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {isMobile && <button className="fab" onClick={openAdd}>+</button>}

      {isMobile && (
        <div className="bottom-nav">
          <div className="nav-item"><span style={{ fontSize: 20 }}>📦</span><span style={{ fontSize: 9, color: "#4fc3f7", letterSpacing: 1 }}>MAGACIN</span></div>
          <div className="nav-item" style={{ opacity: 0.35 }}><span style={{ fontSize: 20 }}>📊</span><span style={{ fontSize: 9, color: "#7a99bb", letterSpacing: 1 }}>STATISTIKE</span></div>
          <div className="nav-item" style={{ opacity: 0.35 }}><span style={{ fontSize: 20 }}>⚙️</span><span style={{ fontSize: 9, color: "#7a99bb", letterSpacing: 1 }}>PODEŠAVANJA</span></div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="modal-bg" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ width: 36, height: 4, background: "#2a4a6a", borderRadius: 2, margin: "0 auto 18px", display: isMobile ? "block" : "none" }} />
            <div style={{ fontSize: 10, letterSpacing: 3, color: "#4fc3f7", marginBottom: 5 }}>{editItem ? "UREDI ARTIKAL" : "NOVI ARTIKAL"}</div>
            <div style={{ height: 1, background: "#1e3a5f", marginBottom: 18 }} />
            <div style={{ marginBottom: 14 }}><label className="form-label">NAZIV ARTIKLA *</label><input className="form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="npr. LED traka 5m" /></div>
            <div style={{ marginBottom: 14 }}><label className="form-label">KATEGORIJA</label><input className="form-input" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="npr. Svetla, Kablovi..." /></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
              <div><label className="form-label">KOLIČINA *</label><input className="form-input" type="number" min="0" inputMode="numeric" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} placeholder="0" /></div>
              <div><label className="form-label">JEDINICA</label><select className="form-input" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })}>{UNITS.map(u => <option key={u} value={u}>{u}</option>)}</select></div>
            </div>
            <div style={{ marginBottom: 22 }}><label className="form-label">MIN. ZALIHA (upozorenje)</label><input className="form-input" type="number" min="0" inputMode="numeric" value={form.minStock} onChange={e => setForm({ ...form, minStock: e.target.value })} placeholder="0" /></div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={submitForm} style={{ flex: 1, background: "#4fc3f7", color: "#0a0e1a", border: "none", padding: "14px", borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>{editItem ? "✓ SAČUVAJ" : "+ DODAJ"}</button>
              <button onClick={() => setShowForm(false)} style={{ background: "rgba(255,68,68,0.1)", border: "1px solid rgba(255,68,68,0.25)", color: "#ff6666", padding: "14px 18px", borderRadius: 10, cursor: "pointer", fontSize: 16 }}>✕</button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Modal */}
      {showTransfer && (
        <div className="modal-bg" onClick={() => setShowTransfer(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ width: 36, height: 4, background: "#2a4a6a", borderRadius: 2, margin: "0 auto 18px", display: isMobile ? "block" : "none" }} />
            <div style={{ fontSize: 10, letterSpacing: 3, color: "#ffaa00", marginBottom: 5 }}>PRENOS IZMEĐU SEKTORA</div>
            <div style={{ height: 1, background: "#1e3a5f", marginBottom: 18 }} />
            <div style={{ background: "#0a0e1a", borderRadius: 10, padding: 14, marginBottom: 18, fontSize: 13 }}>
              <div style={{ color: "#7a99bb" }}>Artikal: <span style={{ color: "#c8ddf0", fontWeight: 600 }}>{data[activeDept]?.find(i => i.id === showTransfer)?.name}</span></div>
              <div style={{ color: "#7a99bb", marginTop: 4 }}>Dostupno: <span style={{ color: "#00e676", fontWeight: 600 }}>{data[activeDept]?.find(i => i.id === showTransfer)?.quantity} {data[activeDept]?.find(i => i.id === showTransfer)?.unit}</span></div>
            </div>
            <div style={{ marginBottom: 14 }}><label className="form-label">ODREDIŠNI SEKTOR</label>
              <select className="form-input" value={transferDept} onChange={e => setTransferDept(e.target.value)}>
                <option value="">-- Izaberi sektor --</option>
                {DEPARTMENTS.map(d => <option key={deptKey(d)} value={deptKey(d)}>{d}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 22 }}><label className="form-label">KOLIČINA ZA PRENOS</label><input className="form-input" type="number" min="1" inputMode="numeric" value={transferQty} onChange={e => setTransferQty(e.target.value)} placeholder="0" /></div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={doTransfer} style={{ flex: 1, background: "rgba(255,170,0,0.15)", border: "1px solid rgba(255,170,0,0.4)", color: "#ffaa00", padding: "14px", borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>→ PRENESI</button>
              <button onClick={() => setShowTransfer(null)} style={{ background: "rgba(255,68,68,0.1)", border: "1px solid rgba(255,68,68,0.25)", color: "#ff6666", padding: "14px 18px", borderRadius: 10, cursor: "pointer", fontSize: 16 }}>✕</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
