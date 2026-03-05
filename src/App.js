import { useState, useEffect, useCallback } from "react";
import { db, ref, onValue, set } from "./firebase";

const UNITS = ["kom", "kg", "l", "m", "kutija", "paleta", "set"];
const INITIAL_DATA = { items: [], categories: [] };
const DB_PATH = "warehouse_v2";

const DEFAULT_CATEGORIES = [];

const CAT_COLORS = ["#FFD700","#4fc3f7","#ce93d8","#ff8a65","#a5d6a7","#f48fb1","#80cbc4","#ffcc02","#90a4ae","#ef9a9a"];
const CAT_ICONS = ["💡","🔌","🎛️","⚡","🔧","📦","🔦","🖥️","📡","🛠️","🔋","🎯","📌","🗂️","⚙️"];

function generateId() { return `id_${Date.now()}_${Math.floor(Math.random() * 9999)}`; }

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
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("sve"); // "sve" or category id
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ name: "", quantity: "", unit: "kom", minStock: "", categoryId: "" });
  const [notification, setNotification] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [expandedItem, setExpandedItem] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [activeTab, setActiveTab] = useState("items"); // "items" or "categories"
  const [showCatForm, setShowCatForm] = useState(false);
  const [editCat, setEditCat] = useState(null);
  const [catForm, setCatForm] = useState({ name: "", color: CAT_COLORS[0], icon: CAT_ICONS[0] });

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  useEffect(() => {
    const dbRef = ref(db, DB_PATH);
    const unsub = onValue(dbRef, (snapshot) => {
      const val = snapshot.val();
      if (val) {
        setData({
          items: val.items || [],
          categories: val.categories || DEFAULT_CATEGORIES,
        });
      } else {
        setData({ items: [], categories: DEFAULT_CATEGORIES });
      }
      setLoaded(true);
    }, () => setLoaded(true));
    return () => unsub();
  }, []);

  const save = useCallback(async (newData) => {
    setSyncing(true);
    try { await set(ref(db, DB_PATH), newData); } catch (e) { console.error(e); }
    setTimeout(() => setSyncing(false), 600);
  }, []);

  const notify = (msg, type = "success") => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 2500);
  };

  const categories = data.categories || DEFAULT_CATEGORIES;
  const items = Array.isArray(data.items) ? data.items : [];

  const getCat = (id) => categories.find(c => c.id === id) || { name: "Ostalo", color: "#90a4ae", icon: "📦" };

  const currentItems = items.filter(i => {
    const matchSearch = i.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = activeCategory === "sve" || i.categoryId === activeCategory;
    return matchSearch && matchCat;
  });

  const totalItems = items.length;
  const lowStockItems = items.filter(i => i.minStock > 0 && i.quantity <= i.minStock).length;

  // Item CRUD
  const openAdd = () => {
    setEditItem(null);
    setForm({ name: "", quantity: "", unit: "kom", minStock: "", categoryId: categories[0]?.id || "" });
    setShowForm(true);
  };
  const openEdit = (item) => {
    setEditItem(item);
    setForm({ name: item.name, quantity: item.quantity, unit: item.unit, minStock: item.minStock, categoryId: item.categoryId || "" });
    setShowForm(true);
  };
  const submitForm = () => {
    if (!form.name || form.quantity === "") return;
    const updated = { ...data };
    if (editItem) {
      updated.items = items.map(i => i.id === editItem.id ? { ...i, ...form, quantity: Number(form.quantity), minStock: Number(form.minStock) } : i);
      notify("Artikal ažuriran ✓");
    } else {
      updated.items = [...items, { id: generateId(), ...form, quantity: Number(form.quantity), minStock: Number(form.minStock) }];
      notify("Artikal dodat ✓");
    }
    setData(updated); save(updated); setShowForm(false);
  };
  const deleteItem = (id) => {
    const updated = { ...data, items: items.filter(i => i.id !== id) };
    setData(updated); save(updated); setExpandedItem(null); notify("Artikal obrisan", "error");
  };
  const adjustQty = (id, delta) => {
    const updated = { ...data, items: items.map(i => i.id === id ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i) };
    setData(updated); save(updated);
  };

  // Category CRUD
  const openAddCat = () => {
    setEditCat(null);
    setCatForm({ name: "", color: CAT_COLORS[0], icon: CAT_ICONS[0] });
    setShowCatForm(true);
  };
  const openEditCat = (cat) => {
    setEditCat(cat);
    setCatForm({ name: cat.name, color: cat.color, icon: cat.icon });
    setShowCatForm(true);
  };
  const submitCatForm = () => {
    if (!catForm.name) return;
    const updated = { ...data };
    if (editCat) {
      updated.categories = categories.map(c => c.id === editCat.id ? { ...c, ...catForm } : c);
      notify("Kategorija ažurirana ✓");
    } else {
      updated.categories = [...categories, { id: generateId(), ...catForm }];
      notify("Kategorija dodana ✓");
    }
    setData(updated); save(updated); setShowCatForm(false);
  };
  const deleteCat = (id) => {
    const inUse = items.some(i => i.categoryId === id);
    if (inUse) { notify("Kategorija se koristi, ne može se obrisati", "error"); return; }
    const updated = { ...data, categories: categories.filter(c => c.id !== id) };
    setData(updated); save(updated); notify("Kategorija obrisana", "error");
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
        @media (min-width: 640px) { .modal { border-radius: 16px; border: 1px solid #1e3a5f; width: 460px; top: 50%; left: 50%; transform: translate(-50%,-50%) !important; bottom: auto; position: fixed; animation: none; max-height: 85vh; padding: 28px; } }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        .bottom-nav { position: fixed; bottom: 0; left: 0; right: 0; background: #0d1526; border-top: 1px solid #1e3a5f; display: flex; padding: 8px 0 12px; z-index: 50; }
        .nav-item { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 4px 0; cursor: pointer; }
        .action-chip { flex: 1; padding: 11px 4px; border-radius: 10px; border: 1px solid; font-size: 11px; cursor: pointer; font-family: inherit; text-align: center; }
        .action-chip:active { opacity: 0.6; }
        .expanded-section { margin-top: 14px; padding-top: 14px; border-top: 1px solid #1a2f4a; display: flex; gap: 8px; animation: fadeIn 0.2s ease; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
        .stat-card { background: #0d1526; border: 1px solid #1a2f4a; border-radius: 10px; padding: 10px 14px; flex: 1; text-align: center; }
        .pulse { animation: pulse 2s infinite; }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes spin { to { transform: rotate(360deg); } }
        .cat-filter { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px; }
        .cat-filter::-webkit-scrollbar { height: 2px; }
        .cat-chip { padding: 6px 14px; border-radius: 20px; border: 1.5px solid; font-size: 11px; cursor: pointer; white-space: nowrap; transition: all 0.15s; font-family: inherit; letter-spacing: 0.5px; }
        .cat-chip:active { transform: scale(0.95); }
        .color-swatch { width: 28px; height: 28px; border-radius: 50%; cursor: pointer; border: 2px solid transparent; transition: all 0.15s; flex-shrink: 0; }
        .color-swatch:hover { transform: scale(1.15); }
        .color-swatch.selected { border-color: white; transform: scale(1.2); }
        .icon-btn { width: 36px; height: 36px; border-radius: 8px; border: 1.5px solid #1e3a5f; background: transparent; cursor: pointer; font-size: 18px; display: flex; align-items: center; justify-content: center; transition: all 0.15s; }
        .icon-btn:hover { border-color: #4fc3f7; background: rgba(79,195,247,0.08); }
        .icon-btn.selected { border-color: #4fc3f7; background: rgba(79,195,247,0.15); }
        .tab-btn { flex: 1; padding: 10px; border: none; background: transparent; cursor: pointer; font-family: inherit; font-size: 11px; letter-spacing: 1.5px; color: #7a99bb; border-bottom: 2px solid transparent; transition: all 0.2s; }
        .tab-btn.active { color: #4fc3f7; border-bottom-color: #4fc3f7; }
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
                <><div style={{ width: 8, height: 8, border: "1.5px solid #4fc3f7", borderTop: "1.5px solid transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} /><span style={{ fontSize: 10, color: "#4fc3f7", letterSpacing: 1 }}>SYNC...</span></>
              ) : (
                <><div style={{ width: 8, height: 8, borderRadius: "50%", background: online ? "#00e676" : "#ff4444", boxShadow: `0 0 6px ${online ? "#00e676" : "#ff4444"}` }} className="pulse" /><span style={{ fontSize: 10, color: online ? "#00e676" : "#ff4444", letterSpacing: 1 }}>{online ? "ONLINE" : "OFFLINE"}</span></>
              )}
            </div>
            {!isMobile && activeTab === "items" && (
              <button onClick={openAdd} style={{ background: "#4fc3f7", color: "#0a0e1a", border: "none", padding: "9px 18px", borderRadius: 8, fontWeight: 700, fontSize: 11, cursor: "pointer", letterSpacing: 1 }}>+ DODAJ ARTIKAL</button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <div className="stat-card">
            <div style={{ fontSize: 9, color: "#7a99bb", letterSpacing: 2 }}>ARTIKALA</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#4fc3f7", marginTop: 2 }}>{totalItems}</div>
          </div>
          <div className="stat-card">
            <div style={{ fontSize: 9, color: "#7a99bb", letterSpacing: 2 }}>NIZAK STOCK</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: lowStockItems > 0 ? "#ffaa00" : "#00e676", marginTop: 2 }}>{lowStockItems}</div>
          </div>
          <div className="stat-card">
            <div style={{ fontSize: 9, color: "#7a99bb", letterSpacing: 2 }}>KATEGORIJA</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#e0e8f0", marginTop: 2 }}>{categories.length}</div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid #1e3a5f" }}>
          <button className={`tab-btn ${activeTab === "items" ? "active" : ""}`} onClick={() => setActiveTab("items")}>📦 ARTIKLI</button>
          <button className={`tab-btn ${activeTab === "categories" ? "active" : ""}`} onClick={() => setActiveTab("categories")}>🏷️ KATEGORIJE</button>
        </div>
      </div>

      {/* ITEMS TAB */}
      {activeTab === "items" && (
        <>
          {/* Category filter */}
          <div style={{ padding: isMobile ? "12px 16px 0" : "14px 28px 0" }}>
            <div className="cat-filter">
              <button className="cat-chip" onClick={() => setActiveCategory("sve")}
                style={{ borderColor: activeCategory === "sve" ? "#4fc3f7" : "#1e3a5f", background: activeCategory === "sve" ? "rgba(79,195,247,0.15)" : "transparent", color: activeCategory === "sve" ? "#4fc3f7" : "#7a99bb" }}>
                SVE ({items.length})
              </button>
              {categories.map(cat => {
                const count = items.filter(i => i.categoryId === cat.id).length;
                const isActive = activeCategory === cat.id;
                return (
                  <button key={cat.id} className="cat-chip" onClick={() => setActiveCategory(isActive ? "sve" : cat.id)}
                    style={{ borderColor: isActive ? cat.color : "#1e3a5f", background: isActive ? `${cat.color}22` : "transparent", color: isActive ? cat.color : "#7a99bb" }}>
                    {cat.icon} {cat.name} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          {/* Search */}
          <div style={{ padding: isMobile ? "10px 16px" : "12px 28px" }}>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#4fc3f7", fontSize: 16 }}>⌕</span>
              <input className="form-input" style={{ paddingLeft: 38, borderRadius: 24 }} placeholder="Pretraži artikle..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>

          {/* Items list */}
          <div style={{ padding: isMobile ? "0 16px 16px" : "0 28px 28px" }}>
            <div style={{ fontSize: 10, color: "#7a99bb", letterSpacing: 2, marginBottom: 10 }}>{currentItems.length} ARTIKALA</div>

            {currentItems.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 20px", border: "1px dashed #1e3a5f", borderRadius: 16 }}>
                <div style={{ fontSize: 44, marginBottom: 12 }}>📦</div>
                <div style={{ fontSize: 11, color: "#3a5a7a", letterSpacing: 2 }}>NEMA ARTIKALA</div>
                <div style={{ fontSize: 11, color: "#2a4a6a", marginTop: 8 }}>{isMobile ? "Tapni + da dodaš artikal" : "Klikni + DODAJ ARTIKAL"}</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {currentItems.map(item => {
                  const sc = getStockColor(item);
                  const isExp = expandedItem === item.id;
                  const cat = getCat(item.categoryId);
                  return (
                    <div key={item.id} className="card" style={{ borderColor: item.minStock > 0 && item.quantity <= item.minStock ? "rgba(255,170,0,0.3)" : "#1a2f4a" }}
                      onClick={() => setExpandedItem(isExp ? null : item.id)}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        {/* Category color bar */}
                        <div style={{ width: 4, height: 44, borderRadius: 2, background: cat.color, flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, color: "#c8ddf0", fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.name}</div>
                          <div style={{ fontSize: 11, color: cat.color, marginTop: 3, display: "flex", alignItems: "center", gap: 4 }}>
                            <span>{cat.icon}</span><span>{cat.name}</span>
                          </div>
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
        </>
      )}

      {/* CATEGORIES TAB */}
      {activeTab === "categories" && (
        <div style={{ padding: isMobile ? "16px" : "20px 28px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={{ fontSize: 10, color: "#7a99bb", letterSpacing: 2 }}>{categories.length} KATEGORIJA</div>
            <button onClick={openAddCat} style={{ background: "#4fc3f7", color: "#0a0e1a", border: "none", padding: "8px 16px", borderRadius: 8, fontWeight: 700, fontSize: 11, cursor: "pointer", letterSpacing: 1 }}>+ NOVA KATEGORIJA</button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {categories.map(cat => {
              const count = items.filter(i => i.categoryId === cat.id).length;
              return (
                <div key={cat.id} style={{ background: "#0d1526", border: "1px solid #1a2f4a", borderRadius: 14, padding: "14px 16px", display: "flex", alignItems: "center", gap: 14 }}>
                  {/* Icon & color */}
                  <div style={{ width: 46, height: 46, borderRadius: 12, background: `${cat.color}22`, border: `2px solid ${cat.color}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>
                    {cat.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, color: cat.color, fontSize: 15 }}>{cat.name}</div>
                    <div style={{ fontSize: 11, color: "#5a7a9a", marginTop: 2 }}>{count} artikala</div>
                  </div>
                  {/* Color dot */}
                  <div style={{ width: 12, height: 12, borderRadius: "50%", background: cat.color, boxShadow: `0 0 8px ${cat.color}` }} />
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => openEditCat(cat)} style={{ background: "rgba(79,195,247,0.08)", border: "1px solid rgba(79,195,247,0.2)", color: "#4fc3f7", padding: "7px 12px", borderRadius: 8, cursor: "pointer", fontSize: 12 }}>✏</button>
                    <button onClick={() => deleteCat(cat.id)} style={{ background: "rgba(255,68,68,0.08)", border: "1px solid rgba(255,68,68,0.2)", color: "#ff6666", padding: "7px 12px", borderRadius: 8, cursor: "pointer", fontSize: 12 }}>✕</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Bottom Nav */}
      {isMobile && (
        <div className="bottom-nav">
          <div className="nav-item" onClick={() => setActiveTab("items")}>
            <span style={{ fontSize: 20 }}>📦</span>
            <span style={{ fontSize: 9, color: activeTab === "items" ? "#4fc3f7" : "#7a99bb", letterSpacing: 1 }}>ARTIKLI</span>
          </div>
          <div className="nav-item" onClick={() => setActiveTab("categories")}>
            <span style={{ fontSize: 20 }}>🏷️</span>
            <span style={{ fontSize: 9, color: activeTab === "categories" ? "#4fc3f7" : "#7a99bb", letterSpacing: 1 }}>KATEGORIJE</span>
          </div>
          <div className="nav-item" style={{ opacity: 0.35 }}>
            <span style={{ fontSize: 20 }}>⚙️</span>
            <span style={{ fontSize: 9, color: "#7a99bb", letterSpacing: 1 }}>PODEŠAVANJA</span>
          </div>
        </div>
      )}

      {/* Add/Edit Item Modal */}
      {showForm && (
        <div className="modal-bg" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ width: 36, height: 4, background: "#2a4a6a", borderRadius: 2, margin: "0 auto 18px", display: isMobile ? "block" : "none" }} />
            <div style={{ fontSize: 10, letterSpacing: 3, color: "#4fc3f7", marginBottom: 5 }}>{editItem ? "UREDI ARTIKAL" : "NOVI ARTIKAL"}</div>
            <div style={{ height: 1, background: "#1e3a5f", marginBottom: 18 }} />

            <div style={{ marginBottom: 14 }}><label className="form-label">NAZIV ARTIKLA *</label><input className="form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="npr. LED traka 5m" /></div>

            {/* Category selector */}
            <div style={{ marginBottom: 14 }}>
              <label className="form-label">KATEGORIJA</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {categories.map(cat => (
                  <button key={cat.id} onClick={() => setForm({ ...form, categoryId: cat.id })}
                    style={{ padding: "7px 12px", borderRadius: 20, border: `1.5px solid ${form.categoryId === cat.id ? cat.color : "#1e3a5f"}`, background: form.categoryId === cat.id ? `${cat.color}22` : "transparent", color: form.categoryId === cat.id ? cat.color : "#7a99bb", cursor: "pointer", fontSize: 12, fontFamily: "inherit", transition: "all 0.15s" }}>
                    {cat.icon} {cat.name}
                  </button>
                ))}
              </div>
            </div>

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

      {/* Add/Edit Category Modal */}
      {showCatForm && (
        <div className="modal-bg" onClick={() => setShowCatForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ width: 36, height: 4, background: "#2a4a6a", borderRadius: 2, margin: "0 auto 18px", display: isMobile ? "block" : "none" }} />
            <div style={{ fontSize: 10, letterSpacing: 3, color: "#4fc3f7", marginBottom: 5 }}>{editCat ? "UREDI KATEGORIJU" : "NOVA KATEGORIJA"}</div>
            <div style={{ height: 1, background: "#1e3a5f", marginBottom: 18 }} />

            {/* Preview */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, background: "#0a0e1a", borderRadius: 12, padding: "12px 16px", marginBottom: 20, border: `1px solid ${catForm.color}44` }}>
              <div style={{ width: 46, height: 46, borderRadius: 12, background: `${catForm.color}22`, border: `2px solid ${catForm.color}55`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>{catForm.icon}</div>
              <div>
                <div style={{ fontWeight: 600, color: catForm.color, fontSize: 15 }}>{catForm.name || "Naziv kategorije"}</div>
                <div style={{ fontSize: 11, color: "#5a7a9a", marginTop: 2 }}>Pregled izgleda</div>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}><label className="form-label">NAZIV KATEGORIJE *</label><input className="form-input" value={catForm.name} onChange={e => setCatForm({ ...catForm, name: e.target.value })} placeholder="npr. Rezervni delovi" /></div>

            {/* Color picker */}
            <div style={{ marginBottom: 16 }}>
              <label className="form-label">BOJA</label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {CAT_COLORS.map(color => (
                  <div key={color} className={`color-swatch ${catForm.color === color ? "selected" : ""}`} style={{ background: color }} onClick={() => setCatForm({ ...catForm, color })} />
                ))}
              </div>
            </div>

            {/* Icon picker */}
            <div style={{ marginBottom: 22 }}>
              <label className="form-label">IKONICA</label>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {CAT_ICONS.map(icon => (
                  <button key={icon} className={`icon-btn ${catForm.icon === icon ? "selected" : ""}`} onClick={() => setCatForm({ ...catForm, icon })}>{icon}</button>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={submitCatForm} style={{ flex: 1, background: "#4fc3f7", color: "#0a0e1a", border: "none", padding: "14px", borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>{editCat ? "✓ SAČUVAJ" : "+ DODAJ"}</button>
              <button onClick={() => setShowCatForm(false)} style={{ background: "rgba(255,68,68,0.1)", border: "1px solid rgba(255,68,68,0.25)", color: "#ff6666", padding: "14px 18px", borderRadius: 10, cursor: "pointer", fontSize: 16 }}>✕</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
