import { useState, useEffect, useCallback } from "react";
import { db, ref, onValue, set } from "./firebase";

const UNITS = ["kom", "kg", "l", "m", "kutija", "paleta", "set"];
const INITIAL_DATA = { items: [], categories: [], users: [], history: [] };
const DB_PATH = "warehouse_v4";

const DEFAULT_ADMIN = { id: "admin_default", name: "Admin", pin: "1234", role: "admin" };
const CAT_COLORS = ["#FFD700","#4fc3f7","#ce93d8","#ff8a65","#a5d6a7","#f48fb1","#80cbc4","#ffcc02","#90a4ae","#ef9a9a"];
const CAT_ICONS = ["💡","🔌","🎛️","⚡","🔧","📦","🔦","🖥️","📡","🛠️","🔋","🎯","📌","🗂️","⚙️"];

const ACTION_META = {
  "item_add":     { icon: "➕", color: "#00e676", label: "Artikal dodat" },
  "item_delete":  { icon: "🗑️", color: "#ff4444", label: "Artikal obrisan" },
  "item_edit":    { icon: "✏️", color: "#4fc3f7", label: "Artikal izmenjen" },
  "qty_increase": { icon: "⬆️", color: "#00e676", label: "Količina povećana" },
  "qty_decrease": { icon: "⬇️", color: "#ffaa00", label: "Količina smanjena" },
  "cat_add":      { icon: "🏷️", color: "#ce93d8", label: "Kategorija dodana" },
  "cat_delete":   { icon: "🗑️", color: "#ff4444", label: "Kategorija obrisana" },
  "cat_edit":     { icon: "✏️", color: "#4fc3f7", label: "Kategorija izmenjena" },
};

function generateId() { return `id_${Date.now()}_${Math.floor(Math.random() * 9999)}`; }

function formatTs(ts) {
  const d = new Date(ts);
  const date = d.toLocaleDateString("sr-RS", { day: "2-digit", month: "2-digit", year: "numeric" });
  const time = d.toLocaleTimeString("sr-RS", { hour: "2-digit", minute: "2-digit" });
  return { date, time };
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);
  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return isMobile;
}

// ── Login Screen ──────────────────────────────
function LoginScreen({ users, onLogin }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);
  const allUsers = users.length > 0 ? users : [DEFAULT_ADMIN];

  const tryLogin = (p) => {
    const found = allUsers.find(u => u.pin === p);
    if (found) { onLogin(found); }
    else {
      setError("Pogrešan PIN"); setShake(true);
      setTimeout(() => { setShake(false); setError(""); setPin(""); }, 900);
    }
  };

  const press = (val) => {
    if (val === "del") { setPin(p => p.slice(0, -1)); return; }
    const next = pin + val;
    setPin(next);
    if (next.length === 4) setTimeout(() => tryLogin(next), 120);
  };

  return (
    <div style={{ background: "#0a0e1a", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'IBM Plex Mono','Courier New',monospace", padding: 20 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .pin-btn { width: 72px; height: 72px; border-radius: 50%; background: #0d1526; border: 1.5px solid #1e3a5f; color: #e0e8f0; font-size: 22px; font-weight: 600; cursor: pointer; font-family: inherit; display: flex; align-items: center; justify-content: center; flex-direction: column; transition: all 0.12s; user-select: none; -webkit-tap-highlight-color: transparent; }
        .pin-btn:active { background: #4fc3f7; color: #0a0e1a; border-color: #4fc3f7; transform: scale(0.93); }
        .pin-btn sub { font-size: 8px; letter-spacing: 1px; color: #4a6a8a; margin-top: 2px; }
        .pin-btn:active sub { color: #0a0e1a; }
        @keyframes shake { 0%,100%{transform:translateX(0)} 20%,60%{transform:translateX(-8px)} 40%,80%{transform:translateX(8px)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
      `}</style>
      <div style={{ textAlign: "center", animation: "fadeUp 0.4s ease" }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🔐</div>
        <div style={{ fontSize: 10, letterSpacing: 4, color: "#4fc3f7", marginBottom: 6 }}>WAREHOUSE SYSTEM</div>
        <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "'IBM Plex Sans',sans-serif", color: "#e0e8f0", marginBottom: 4 }}>LED team <span style={{ color: "#4fc3f7" }}>(Serbia)</span></div>
        <div style={{ fontSize: 12, color: "#5a7a9a", marginBottom: 40 }}>Unesi PIN kod</div>
        <div style={{ display: "flex", gap: 16, justifyContent: "center", marginBottom: 12, animation: shake ? "shake 0.5s ease" : "none" }}>
          {[0,1,2,3].map(i => (
            <div key={i} style={{ width: 16, height: 16, borderRadius: "50%", border: `2px solid ${i < pin.length ? "#4fc3f7" : "#1e3a5f"}`, background: i < pin.length ? "#4fc3f7" : "transparent", transition: "all 0.15s", boxShadow: i < pin.length ? "0 0 8px #4fc3f7" : "none" }} />
          ))}
        </div>
        <div style={{ height: 20, marginBottom: 24, fontSize: 12, color: "#ff6666" }}>{error}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 72px)", gap: 14, justifyContent: "center" }}>
          {["1","2","3","4","5","6","7","8","9","","0","del"].map((k, i) => (
            k === "" ? <div key={i} /> :
            k === "del" ? <button key={i} className="pin-btn" onClick={() => press("del")} style={{ fontSize: 20 }}>⌫</button> :
            <button key={i} className="pin-btn" onClick={() => press(k)}>{k}<sub>{["","ABC","DEF","GHI","JKL","MNO","PQRS","TUV","WXYZ","","",""][Number(k)]}</sub></button>
          ))}
        </div>
        <div style={{ marginTop: 32, fontSize: 11, color: "#2a4a6a" }}>{allUsers.length} korisnik{allUsers.length !== 1 ? "a" : ""} registrovano</div>
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────
export default function WarehouseApp() {
  const isMobile = useIsMobile();
  const [data, setData] = useState(INITIAL_DATA);
  const [currentUser, setCurrentUser] = useState(null);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("sve");
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ name: "", quantity: "", unit: "kom", minStock: "", categoryId: "" });
  const [notification, setNotification] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [expandedItem, setExpandedItem] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [activeTab, setActiveTab] = useState("items");
  const [showCatForm, setShowCatForm] = useState(false);
  const [editCat, setEditCat] = useState(null);
  const [catForm, setCatForm] = useState({ name: "", color: CAT_COLORS[0], icon: CAT_ICONS[0] });
  const [showUserForm, setShowUserForm] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [userForm, setUserForm] = useState({ name: "", pin: "", role: "user" });
  const [historyFilter, setHistoryFilter] = useState("sve");

  const isAdmin = currentUser?.role === "admin";

  useEffect(() => {
    const on = () => setOnline(true); const off = () => setOnline(false);
    window.addEventListener("online", on); window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  useEffect(() => {
    const dbRef = ref(db, DB_PATH);
    const unsub = onValue(dbRef, (snapshot) => {
      const val = snapshot.val();
      if (val) {
        setData({ items: val.items || [], categories: val.categories || [], users: val.users || [DEFAULT_ADMIN], history: val.history || [] });
      } else {
        setData({ items: [], categories: [], users: [DEFAULT_ADMIN], history: [] });
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

  // ── History helper ──
  const addHistory = (action, detail, updated) => {
    const entry = {
      id: generateId(),
      action,
      detail,
      user: currentUser?.name || "?",
      userId: currentUser?.id || "?",
      timestamp: Date.now(),
    };
    return { ...updated, history: [entry, ...(updated.history || [])] };
  };

  const categories = data.categories || [];
  const items = Array.isArray(data.items) ? data.items : [];
  const users = data.users || [DEFAULT_ADMIN];
  const history = data.history || [];

  const getCat = (id) => categories.find(c => c.id === id) || { name: "—", color: "#5a7a9a", icon: "📦" };

  const currentItems = items.filter(i => {
    const matchSearch = i.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = activeCategory === "sve" || i.categoryId === activeCategory;
    return matchSearch && matchCat;
  });

  const totalItems = items.length;
  const lowStockItems = items.filter(i => i.minStock > 0 && i.quantity <= i.minStock).length;

  // ── Item CRUD ──
  const openAdd = () => { setEditItem(null); setForm({ name: "", quantity: "", unit: "kom", minStock: "", categoryId: categories[0]?.id || "" }); setShowForm(true); };
  const openEdit = (item) => { setEditItem(item); setForm({ name: item.name, quantity: item.quantity, unit: item.unit, minStock: item.minStock, categoryId: item.categoryId || "" }); setShowForm(true); };

  const submitForm = () => {
    if (!form.name || form.quantity === "") return;
    let updated = { ...data };
    if (editItem) {
      updated.items = items.map(i => i.id === editItem.id ? { ...i, ...form, quantity: Number(form.quantity), minStock: Number(form.minStock) } : i);
      updated = addHistory("item_edit", `"${form.name}" — izmenjen`, updated);
      notify("Artikal ažuriran ✓");
    } else {
      const newItem = { id: generateId(), ...form, quantity: Number(form.quantity), minStock: Number(form.minStock) };
      updated.items = [...items, newItem];
      updated = addHistory("item_add", `"${form.name}" — dodat (${form.quantity} ${form.unit})`, updated);
      notify("Artikal dodat ✓");
    }
    setData(updated); save(updated); setShowForm(false);
  };

  const deleteItem = (id) => {
    const item = items.find(i => i.id === id);
    let updated = { ...data, items: items.filter(i => i.id !== id) };
    updated = addHistory("item_delete", `"${item?.name}" — obrisan`, updated);
    setData(updated); save(updated); setExpandedItem(null); notify("Artikal obrisan", "error");
  };

  const adjustQty = (id, delta) => {
    const item = items.find(i => i.id === id);
    const newQty = Math.max(0, item.quantity + delta);
    let updated = { ...data, items: items.map(i => i.id === id ? { ...i, quantity: newQty } : i) };
    const action = delta > 0 ? "qty_increase" : "qty_decrease";
    const sign = delta > 0 ? "+" : "";
    updated = addHistory(action, `"${item?.name}" ${sign}${delta} → ${newQty} ${item?.unit}`, updated);
    setData(updated); save(updated);
  };

  // ── Category CRUD ──
  const openAddCat = () => { setEditCat(null); setCatForm({ name: "", color: CAT_COLORS[0], icon: CAT_ICONS[0] }); setShowCatForm(true); };
  const openEditCat = (cat) => { setEditCat(cat); setCatForm({ name: cat.name, color: cat.color, icon: cat.icon }); setShowCatForm(true); };

  const submitCatForm = () => {
    if (!catForm.name) return;
    let updated = { ...data };
    if (editCat) {
      updated.categories = categories.map(c => c.id === editCat.id ? { ...c, ...catForm } : c);
      updated = addHistory("cat_edit", `Kategorija "${catForm.name}" izmenjena`, updated);
      notify("Kategorija ažurirana ✓");
    } else {
      updated.categories = [...categories, { id: generateId(), ...catForm }];
      updated = addHistory("cat_add", `Kategorija "${catForm.name}" dodana`, updated);
      notify("Kategorija dodana ✓");
    }
    setData(updated); save(updated); setShowCatForm(false);
  };

  const deleteCat = (id) => {
    if (items.some(i => i.categoryId === id)) { notify("Kategorija se koristi!", "error"); return; }
    const cat = categories.find(c => c.id === id);
    let updated = { ...data, categories: categories.filter(c => c.id !== id) };
    updated = addHistory("cat_delete", `Kategorija "${cat?.name}" obrisana`, updated);
    setData(updated); save(updated); notify("Kategorija obrisana", "error");
  };

  // ── User CRUD ──
  const openAddUser = () => { setEditUser(null); setUserForm({ name: "", pin: "", role: "user" }); setShowUserForm(true); };
  const openEditUser = (u) => { setEditUser(u); setUserForm({ name: u.name, pin: u.pin, role: u.role }); setShowUserForm(true); };
  const submitUserForm = () => {
    if (!userForm.name || userForm.pin.length < 4) { notify("PIN mora imati 4 cifre!", "error"); return; }
    if (users.some(u => u.pin === userForm.pin && (!editUser || u.id !== editUser.id))) { notify("Taj PIN već postoji!", "error"); return; }
    const updated = { ...data };
    if (editUser) {
      updated.users = users.map(u => u.id === editUser.id ? { ...u, ...userForm } : u);
      if (currentUser.id === editUser.id) setCurrentUser({ ...currentUser, ...userForm });
      notify("Korisnik ažuriran ✓");
    } else {
      updated.users = [...users, { id: generateId(), ...userForm }];
      notify("Korisnik dodat ✓");
    }
    setData(updated); save(updated); setShowUserForm(false);
  };
  const deleteUser = (id) => {
    if (id === currentUser.id) { notify("Ne možeš obrisati sebe!", "error"); return; }
    if (users.filter(u => u.role === "admin").length === 1 && users.find(u => u.id === id)?.role === "admin") { notify("Mora biti bar 1 admin!", "error"); return; }
    const updated = { ...data, users: users.filter(u => u.id !== id) };
    setData(updated); save(updated); notify("Korisnik obrisan", "error");
  };

  const getStockColor = (item) => {
    if (item.quantity === 0) return "#ff4444";
    if (item.minStock > 0 && item.quantity <= item.minStock) return "#ffaa00";
    return "#00e676";
  };

  // ── History filter ──
  const historyTypes = ["sve", "item_add", "item_delete", "item_edit", "qty_increase", "qty_decrease", "cat_add", "cat_delete", "cat_edit"];
  const filteredHistory = historyFilter === "sve" ? history : history.filter(h => h.action === historyFilter);

  // Group history by date
  const groupedHistory = filteredHistory.reduce((groups, entry) => {
    const { date } = formatTs(entry.timestamp);
    if (!groups[date]) groups[date] = [];
    groups[date].push(entry);
    return groups;
  }, {});

  // ── Reports data ──
  const reportCategoryStats = categories.map(cat => {
    const catItems = items.filter(i => i.categoryId === cat.id);
    const totalQty = catItems.reduce((s, i) => s + i.quantity, 0);
    const lowStock = catItems.filter(i => i.minStock > 0 && i.quantity <= i.minStock).length;
    return { ...cat, itemCount: catItems.length, totalQty, lowStock };
  });
  const uncategorized = items.filter(i => !i.categoryId || !categories.find(c => c.id === i.categoryId));
  if (uncategorized.length > 0) {
    reportCategoryStats.push({ id: "__none", name: "Bez kategorije", icon: "📦", color: "#5a7a9a", itemCount: uncategorized.length, totalQty: uncategorized.reduce((s, i) => s + i.quantity, 0), lowStock: uncategorized.filter(i => i.minStock > 0 && i.quantity <= i.minStock).length });
  }
  const reportLowStock = items.filter(i => i.minStock > 0 && i.quantity <= i.minStock).sort((a, b) => (a.quantity / Math.max(1, a.minStock)) - (b.quantity / Math.max(1, b.minStock)));
  const userActivityStats = users.map(u => {
    const uh = history.filter(h => h.userId === u.id);
    return { ...u, total: uh.length, adds: uh.filter(h => h.action === "item_add").length, deletes: uh.filter(h => h.action === "item_delete").length, edits: uh.filter(h => h.action === "item_edit").length, qtyChanges: uh.filter(h => h.action === "qty_increase" || h.action === "qty_decrease").length, catChanges: uh.filter(h => h.action.startsWith("cat_")).length, lastAction: uh[0] ? formatTs(uh[0].timestamp) : null };
  }).sort((a, b) => b.total - a.total);

  if (!loaded) return (
    <div style={{ background: "#0a0e1a", height: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14 }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ width: 44, height: 44, border: "3px solid #1e3a5f", borderTop: "3px solid #4fc3f7", borderRadius: "50%", animation: "spin 0.9s linear infinite" }} />
      <div style={{ color: "#4fc3f7", fontFamily: "monospace", fontSize: 12, letterSpacing: 3 }}>UČITAVANJE...</div>
    </div>
  );

  if (!currentUser) return <LoginScreen users={users} onLogin={setCurrentUser} />;

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
        @keyframes popIn { from{transform:translateX(-50%) translateY(-16px);opacity:0} to{transform:translateX(-50%) translateY(0);opacity:1} }
        .card { background: #0d1526; border-radius: 14px; padding: 16px; transition: transform 0.15s; border: 1px solid #1a2f4a; cursor: pointer; user-select: none; }
        .card:active { transform: scale(0.985); }
        .fab { position: fixed; bottom: 86px; right: 20px; width: 58px; height: 58px; border-radius: 50%; background: #4fc3f7; border: none; cursor: pointer; font-size: 30px; color: #0a0e1a; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 24px rgba(79,195,247,0.45); z-index: 50; transition: transform 0.15s; }
        .fab:active { transform: scale(0.9); }
        .qty-circle { width: 42px; height: 42px; border-radius: 50%; border: 1.5px solid #1e3a5f; background: rgba(79,195,247,0.06); color: #4fc3f7; font-size: 22px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s; }
        .qty-circle:active { background: #4fc3f7; color: #0a0e1a; transform: scale(0.9); }
        .modal-bg { position: fixed; inset: 0; background: rgba(0,0,0,0.82); z-index: 100; backdrop-filter: blur(6px); }
        .modal { background: #0d1526; border-top: 1px solid #1e3a5f; border-radius: 20px 20px 0 0; padding: 12px 20px 32px; width: 100%; position: fixed; bottom: 0; animation: slideUp 0.28s cubic-bezier(0.32,0.72,0,1); max-height: 90vh; overflow-y: auto; }
        @media (min-width: 640px) { .modal { border-radius: 16px; border: 1px solid #1e3a5f; width: 460px; top: 50%; left: 50%; transform: translate(-50%,-50%) !important; bottom: auto; position: fixed; animation: none; max-height: 85vh; padding: 28px; } }
        @keyframes slideUp { from{transform:translateY(100%)} to{transform:translateY(0)} }
        .bottom-nav { position: fixed; bottom: 0; left: 0; right: 0; background: #0d1526; border-top: 1px solid #1e3a5f; display: flex; padding: 8px 0 12px; z-index: 50; }
        .nav-item { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 4px 0; cursor: pointer; }
        .action-chip { flex: 1; padding: 11px 4px; border-radius: 10px; border: 1px solid; font-size: 11px; cursor: pointer; font-family: inherit; text-align: center; }
        .action-chip:active { opacity: 0.6; }
        .expanded-section { margin-top: 14px; padding-top: 14px; border-top: 1px solid #1a2f4a; display: flex; gap: 8px; animation: fadeIn 0.2s ease; }
        @keyframes fadeIn { from{opacity:0;transform:translateY(-4px)} to{opacity:1;transform:translateY(0)} }
        .stat-card { background: #0d1526; border: 1px solid #1a2f4a; border-radius: 10px; padding: 10px 14px; flex: 1; text-align: center; }
        .pulse { animation: pulse 2s infinite; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes spin { to { transform: rotate(360deg); } }
        .cat-filter { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px; }
        .cat-filter::-webkit-scrollbar { height: 2px; }
        .cat-chip { padding: 6px 14px; border-radius: 20px; border: 1.5px solid; font-size: 11px; cursor: pointer; white-space: nowrap; transition: all 0.15s; font-family: inherit; }
        .tab-btn { flex: 1; padding: 10px 4px; border: none; background: transparent; cursor: pointer; font-family: inherit; font-size: 10px; letter-spacing: 0.5px; color: #7a99bb; border-bottom: 2px solid transparent; transition: all 0.2s; white-space: nowrap; }
        .tab-btn.active { color: #4fc3f7; border-bottom-color: #4fc3f7; }
        .color-swatch { width: 28px; height: 28px; border-radius: 50%; cursor: pointer; border: 2px solid transparent; transition: all 0.15s; flex-shrink: 0; }
        .color-swatch.selected { border-color: white; transform: scale(1.2); }
        .icon-btn { width: 36px; height: 36px; border-radius: 8px; border: 1.5px solid #1e3a5f; background: transparent; cursor: pointer; font-size: 18px; display: flex; align-items: center; justify-content: center; transition: all 0.15s; }
        .icon-btn.selected { border-color: #4fc3f7; background: rgba(79,195,247,0.15); }
        .role-badge { display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; border-radius: 12px; font-size: 10px; letter-spacing: 1px; font-weight: 600; }
        .hist-filter { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 4px; }
        .hist-filter::-webkit-scrollbar { height: 2px; }
        .hist-chip { padding: 5px 12px; border-radius: 16px; border: 1px solid; font-size: 10px; cursor: pointer; white-space: nowrap; font-family: inherit; transition: all 0.15s; }
        .hist-entry { background: #0d1526; border-radius: 12px; padding: 12px 14px; border: 1px solid #1a2f4a; display: flex; gap: 12px; align-items: flex-start; }
        .date-divider { font-size: 10px; color: #3a5a7a; letter-spacing: 2px; padding: 16px 0 8px; display: flex; align-items: center; gap: 10px; }
        .date-divider::after { content: ''; flex: 1; height: 1px; background: #1a2f4a; }
      `}</style>

      {notification && (
        <div className="notification" style={{ background: notification.type === "error" ? "#1f0a0a" : "#0a1f10", border: `1px solid ${notification.type === "error" ? "#ff4444" : "#00e676"}`, color: notification.type === "error" ? "#ff6666" : "#66ff99" }}>
          {notification.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ background: "#0d1526", borderBottom: "1px solid #1e3a5f", padding: isMobile ? "14px 16px 0" : "16px 28px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 9, letterSpacing: 3, color: "#4fc3f7", marginBottom: 4 }}>WAREHOUSE SYSTEM</div>
            <div style={{ fontSize: isMobile ? 17 : 21, fontWeight: 700, fontFamily: "'IBM Plex Sans',sans-serif" }}>▣ LED team <span style={{ color: "#4fc3f7" }}>(Serbia)</span></div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div>
                <div style={{ fontSize: 12, color: "#c8ddf0", textAlign: "right" }}>{currentUser.name}</div>
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 2 }}>
                  <span className="role-badge" style={{ background: isAdmin ? "rgba(255,215,0,0.12)" : "rgba(79,195,247,0.1)", color: isAdmin ? "#FFD700" : "#4fc3f7", border: `1px solid ${isAdmin ? "rgba(255,215,0,0.3)" : "rgba(79,195,247,0.2)"}` }}>
                    {isAdmin ? "👑 ADMIN" : "👤 KORISNIK"}
                  </span>
                </div>
              </div>
              <button onClick={() => setCurrentUser(null)} style={{ width: 34, height: 34, border: "1px solid #1e3a5f", borderRadius: 8, background: "transparent", color: "#5a7a9a", cursor: "pointer", fontSize: 16 }}>⏏</button>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#0a0e1a", border: "1px solid #1e3a5f", borderRadius: 20, padding: "4px 10px" }}>
              {syncing ? (
                <><div style={{ width: 7, height: 7, border: "1.5px solid #4fc3f7", borderTop: "1.5px solid transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} /><span style={{ fontSize: 9, color: "#4fc3f7", letterSpacing: 1 }}>SYNC</span></>
              ) : (
                <><div style={{ width: 7, height: 7, borderRadius: "50%", background: online ? "#00e676" : "#ff4444", boxShadow: `0 0 5px ${online ? "#00e676" : "#ff4444"}` }} className="pulse" /><span style={{ fontSize: 9, color: online ? "#00e676" : "#ff4444", letterSpacing: 1 }}>{online ? "ONLINE" : "OFFLINE"}</span></>
              )}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <div className="stat-card">
            <div style={{ fontSize: 9, color: "#7a99bb", letterSpacing: 2 }}>ARTIKALA</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#4fc3f7", marginTop: 2 }}>{totalItems}</div>
          </div>
          <div className="stat-card">
            <div style={{ fontSize: 9, color: "#7a99bb", letterSpacing: 2 }}>NIZAK STOCK</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: lowStockItems > 0 ? "#ffaa00" : "#00e676", marginTop: 2 }}>{lowStockItems}</div>
          </div>
          {isAdmin && (
            <div className="stat-card">
              <div style={{ fontSize: 9, color: "#7a99bb", letterSpacing: 2 }}>PROMENA</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#ce93d8", marginTop: 2 }}>{history.length}</div>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div style={{ display: "flex" }}>
          <button className={`tab-btn ${activeTab === "items" ? "active" : ""}`} onClick={() => setActiveTab("items")}>📦 ARTIKLI</button>
          {isAdmin && <button className={`tab-btn ${activeTab === "categories" ? "active" : ""}`} onClick={() => setActiveTab("categories")}>🏷️ KATEGORIJE</button>}
          {isAdmin && <button className={`tab-btn ${activeTab === "users" ? "active" : ""}`} onClick={() => setActiveTab("users")}>👥 KORISNICI</button>}
          {isAdmin && <button className={`tab-btn ${activeTab === "history" ? "active" : ""}`} onClick={() => setActiveTab("history")} style={{ color: activeTab === "history" ? "#ce93d8" : "#7a99bb", borderBottomColor: activeTab === "history" ? "#ce93d8" : "transparent" }}>📋 ISTORIJA</button>}
          {isAdmin && <button className={`tab-btn ${activeTab === "reports" ? "active" : ""}`} onClick={() => setActiveTab("reports")} style={{ color: activeTab === "reports" ? "#ffaa00" : "#7a99bb", borderBottomColor: activeTab === "reports" ? "#ffaa00" : "transparent" }}>📊 IZVEŠTAJI</button>}
        </div>
        <div style={{ height: 1, background: "#1e3a5f" }} />
      </div>

      {/* ── ITEMS TAB ── */}
      {activeTab === "items" && (
        <>
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
          <div style={{ padding: isMobile ? "10px 16px" : "12px 28px" }}>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#4fc3f7", fontSize: 16 }}>⌕</span>
              <input className="form-input" style={{ paddingLeft: 38, borderRadius: 24 }} placeholder="Pretraži artikle..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
          <div style={{ padding: isMobile ? "0 16px 16px" : "0 28px 28px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ fontSize: 10, color: "#7a99bb", letterSpacing: 2 }}>{currentItems.length} ARTIKALA</div>
              {isAdmin && !isMobile && <button onClick={openAdd} style={{ background: "#4fc3f7", color: "#0a0e1a", border: "none", padding: "8px 16px", borderRadius: 8, fontWeight: 700, fontSize: 11, cursor: "pointer" }}>+ DODAJ ARTIKAL</button>}
            </div>
            {currentItems.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 20px", border: "1px dashed #1e3a5f", borderRadius: 16 }}>
                <div style={{ fontSize: 44, marginBottom: 12 }}>📦</div>
                <div style={{ fontSize: 11, color: "#3a5a7a", letterSpacing: 2 }}>NEMA ARTIKALA</div>
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
                        <div style={{ width: 4, height: 44, borderRadius: 2, background: cat.color, flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, color: "#c8ddf0", fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.name}</div>
                          <div style={{ fontSize: 11, color: cat.color, marginTop: 3 }}>{cat.icon} {cat.name}</div>
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
                      {isExp && isAdmin && (
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
          {isMobile && isAdmin && <button className="fab" onClick={openAdd}>+</button>}
        </>
      )}

      {/* ── HISTORY TAB ── */}
      {activeTab === "history" && isAdmin && (
        <div style={{ padding: isMobile ? "16px" : "20px 28px" }}>
          {/* Filter chips */}
          <div className="hist-filter" style={{ marginBottom: 16 }}>
            {[
              { key: "sve", label: "Sve", color: "#7a99bb" },
              { key: "item_add", label: "➕ Dodano", color: "#00e676" },
              { key: "item_delete", label: "🗑️ Obrisano", color: "#ff4444" },
              { key: "item_edit", label: "✏️ Izmenjeno", color: "#4fc3f7" },
              { key: "qty_increase", label: "⬆️ Povećano", color: "#00e676" },
              { key: "qty_decrease", label: "⬇️ Smanjeno", color: "#ffaa00" },
              { key: "cat_add", label: "🏷️ Kategorija +", color: "#ce93d8" },
              { key: "cat_delete", label: "🏷️ Kategorija -", color: "#ff4444" },
            ].map(f => (
              <button key={f.key} className="hist-chip" onClick={() => setHistoryFilter(f.key)}
                style={{ borderColor: historyFilter === f.key ? f.color : "#1e3a5f", background: historyFilter === f.key ? `${f.color}18` : "transparent", color: historyFilter === f.key ? f.color : "#7a99bb" }}>
                {f.label}
              </button>
            ))}
          </div>

          {/* Count */}
          <div style={{ fontSize: 10, color: "#7a99bb", letterSpacing: 2, marginBottom: 4 }}>
            {filteredHistory.length} PROMENA UKUPNO
          </div>

          {filteredHistory.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 20px", border: "1px dashed #1e3a5f", borderRadius: 16, marginTop: 12 }}>
              <div style={{ fontSize: 44, marginBottom: 12 }}>📋</div>
              <div style={{ fontSize: 11, color: "#3a5a7a", letterSpacing: 2 }}>NEMA PROMENA</div>
            </div>
          ) : (
            Object.entries(groupedHistory).map(([date, entries]) => (
              <div key={date}>
                <div className="date-divider">{date}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {entries.map(entry => {
                    const meta = ACTION_META[entry.action] || { icon: "•", color: "#7a99bb", label: entry.action };
                    const { time } = formatTs(entry.timestamp);
                    return (
                      <div key={entry.id} className="hist-entry">
                        {/* Icon */}
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: `${meta.color}18`, border: `1px solid ${meta.color}33`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
                          {meta.icon}
                        </div>
                        {/* Content */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 11, color: meta.color, letterSpacing: 0.5, marginBottom: 3 }}>{meta.label}</div>
                          <div style={{ fontSize: 13, color: "#c8ddf0", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{entry.detail}</div>
                          <div style={{ display: "flex", gap: 10, marginTop: 5, fontSize: 10, color: "#5a7a9a" }}>
                            <span>👤 {entry.user}</span>
                            <span>🕐 {time}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── CATEGORIES TAB ── */}
      {activeTab === "categories" && isAdmin && (
        <div style={{ padding: isMobile ? "16px" : "20px 28px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={{ fontSize: 10, color: "#7a99bb", letterSpacing: 2 }}>{categories.length} KATEGORIJA</div>
            <button onClick={openAddCat} style={{ background: "#4fc3f7", color: "#0a0e1a", border: "none", padding: "8px 16px", borderRadius: 8, fontWeight: 700, fontSize: 11, cursor: "pointer" }}>+ NOVA</button>
          </div>
          {categories.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 20px", border: "1px dashed #1e3a5f", borderRadius: 16 }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>🏷️</div>
              <div style={{ fontSize: 11, color: "#3a5a7a" }}>Nema kategorija</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {categories.map(cat => {
                const count = items.filter(i => i.categoryId === cat.id).length;
                return (
                  <div key={cat.id} style={{ background: "#0d1526", border: "1px solid #1a2f4a", borderRadius: 14, padding: "14px 16px", display: "flex", alignItems: "center", gap: 14 }}>
                    <div style={{ width: 46, height: 46, borderRadius: 12, background: `${cat.color}22`, border: `2px solid ${cat.color}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>{cat.icon}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, color: cat.color, fontSize: 15 }}>{cat.name}</div>
                      <div style={{ fontSize: 11, color: "#5a7a9a", marginTop: 2 }}>{count} artikala</div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => openEditCat(cat)} style={{ background: "rgba(79,195,247,0.08)", border: "1px solid rgba(79,195,247,0.2)", color: "#4fc3f7", padding: "7px 12px", borderRadius: 8, cursor: "pointer" }}>✏</button>
                      <button onClick={() => deleteCat(cat.id)} style={{ background: "rgba(255,68,68,0.08)", border: "1px solid rgba(255,68,68,0.2)", color: "#ff6666", padding: "7px 12px", borderRadius: 8, cursor: "pointer" }}>✕</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── USERS TAB ── */}
      {activeTab === "users" && isAdmin && (
        <div style={{ padding: isMobile ? "16px" : "20px 28px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={{ fontSize: 10, color: "#7a99bb", letterSpacing: 2 }}>{users.length} KORISNIKA</div>
            <button onClick={openAddUser} style={{ background: "#FFD700", color: "#0a0e1a", border: "none", padding: "8px 16px", borderRadius: 8, fontWeight: 700, fontSize: 11, cursor: "pointer" }}>+ NOVI KORISNIK</button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {users.map(u => (
              <div key={u.id} style={{ background: "#0d1526", border: `1px solid ${u.id === currentUser.id ? "rgba(255,215,0,0.3)" : "#1a2f4a"}`, borderRadius: 14, padding: "14px 16px", display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 46, height: 46, borderRadius: 12, background: u.role === "admin" ? "rgba(255,215,0,0.1)" : "rgba(79,195,247,0.1)", border: `2px solid ${u.role === "admin" ? "rgba(255,215,0,0.3)" : "rgba(79,195,247,0.2)"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>
                  {u.role === "admin" ? "👑" : "👤"}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, color: "#c8ddf0", fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
                    {u.name}
                    {u.id === currentUser.id && <span style={{ fontSize: 9, color: "#4fc3f7", border: "1px solid rgba(79,195,247,0.3)", borderRadius: 10, padding: "1px 7px" }}>TI</span>}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
                    <span className="role-badge" style={{ background: u.role === "admin" ? "rgba(255,215,0,0.1)" : "rgba(79,195,247,0.08)", color: u.role === "admin" ? "#FFD700" : "#4fc3f7", border: `1px solid ${u.role === "admin" ? "rgba(255,215,0,0.25)" : "rgba(79,195,247,0.2)"}` }}>
                      {u.role === "admin" ? "ADMIN" : "KORISNIK"}
                    </span>
                    <span style={{ fontSize: 11, color: "#5a7a9a" }}>PIN: {"●".repeat(u.pin.length)}</span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => openEditUser(u)} style={{ background: "rgba(79,195,247,0.08)", border: "1px solid rgba(79,195,247,0.2)", color: "#4fc3f7", padding: "7px 12px", borderRadius: 8, cursor: "pointer" }}>✏</button>
                  {u.id !== currentUser.id && <button onClick={() => deleteUser(u.id)} style={{ background: "rgba(255,68,68,0.08)", border: "1px solid rgba(255,68,68,0.2)", color: "#ff6666", padding: "7px 12px", borderRadius: 8, cursor: "pointer" }}>✕</button>}
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16, background: "rgba(255,215,0,0.05)", border: "1px solid rgba(255,215,0,0.15)", borderRadius: 10, padding: "12px 14px", fontSize: 12, color: "#a08020" }}>
            👑 <strong>Admin</strong> — pun pristup<br/>
            <span style={{ marginTop: 4, display: "block" }}>👤 <strong>Korisnik</strong> — pregled + menjanje količina</span>
          </div>
        </div>
      )}

      {/* Bottom Nav */}
      {isMobile && (
        <div className="bottom-nav">
          <div className="nav-item" onClick={() => setActiveTab("items")}><span style={{ fontSize: 18 }}>📦</span><span style={{ fontSize: 8, color: activeTab === "items" ? "#4fc3f7" : "#7a99bb" }}>ARTIKLI</span></div>
          {isAdmin && <div className="nav-item" onClick={() => setActiveTab("categories")}><span style={{ fontSize: 18 }}>🏷️</span><span style={{ fontSize: 8, color: activeTab === "categories" ? "#4fc3f7" : "#7a99bb" }}>KAT.</span></div>}
          {isAdmin && <div className="nav-item" onClick={() => setActiveTab("users")}><span style={{ fontSize: 18 }}>👥</span><span style={{ fontSize: 8, color: activeTab === "users" ? "#FFD700" : "#7a99bb" }}>KORISNICI</span></div>}
          {isAdmin && <div className="nav-item" onClick={() => setActiveTab("history")}><span style={{ fontSize: 18 }}>📋</span><span style={{ fontSize: 8, color: activeTab === "history" ? "#ce93d8" : "#7a99bb" }}>ISTORIJA</span></div>}
          {isAdmin && <div className="nav-item" onClick={() => setActiveTab("reports")}><span style={{ fontSize: 18 }}>📊</span><span style={{ fontSize: 8, color: activeTab === "reports" ? "#ffaa00" : "#7a99bb" }}>IZVEŠTAJI</span></div>}
          <div className="nav-item" onClick={() => setCurrentUser(null)}><span style={{ fontSize: 18 }}>⏏</span><span style={{ fontSize: 8, color: "#7a99bb" }}>ODJAVA</span></div>
        </div>
      )}

      {/* ── REPORTS TAB ── */}
      {activeTab === "reports" && isAdmin && (
        <div style={{ padding: isMobile ? "16px" : "20px 28px" }}>

          {/* Summary cards */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 24 }}>
            {[
              { label: "UKUPNO ARTIKALA", value: items.length, color: "#4fc3f7" },
              { label: "NIZAK STOCK", value: reportLowStock.length, color: reportLowStock.length > 0 ? "#ffaa00" : "#00e676" },
              { label: "KATEGORIJA", value: categories.length, color: "#ce93d8" },
            ].map((s, i) => (
              <div key={i} style={{ background: "#0d1526", border: "1px solid #1a2f4a", borderRadius: 10, padding: "10px 8px", textAlign: "center" }}>
                <div style={{ fontSize: 8, color: "#7a99bb", letterSpacing: 1, marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* ── 1. Zalihe po kategoriji ── */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 10, color: "#ffaa00", letterSpacing: 2, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
              🏷️ ZALIHE PO KATEGORIJI
            </div>
            {reportCategoryStats.length === 0 ? (
              <div style={{ fontSize: 12, color: "#3a5a7a", padding: "16px", textAlign: "center", border: "1px dashed #1e3a5f", borderRadius: 10 }}>Nema kategorija</div>
            ) : (
              <div style={{ background: "#0d1526", border: "1px solid #1a2f4a", borderRadius: 12, overflow: "hidden" }}>
                {/* Header */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 60px 70px 70px", padding: "10px 14px", borderBottom: "1px solid #1a2f4a", fontSize: 9, color: "#5a7a9a", letterSpacing: 1 }}>
                  <div>KATEGORIJA</div><div style={{ textAlign: "right" }}>ARTIK.</div><div style={{ textAlign: "right" }}>UK. KOL.</div><div style={{ textAlign: "right" }}>NIZ. ST.</div>
                </div>
                {reportCategoryStats.map((cat, idx) => (
                  <div key={cat.id} style={{ display: "grid", gridTemplateColumns: "1fr 60px 70px 70px", padding: "12px 14px", borderBottom: idx < reportCategoryStats.length - 1 ? "1px solid #0f1e32" : "none", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: cat.color, boxShadow: `0 0 5px ${cat.color}`, flexShrink: 0 }} />
                      <span style={{ fontSize: 13, color: cat.color, fontWeight: 500 }}>{cat.icon} {cat.name}</span>
                    </div>
                    <div style={{ textAlign: "right", fontSize: 14, color: "#c8ddf0", fontWeight: 600 }}>{cat.itemCount}</div>
                    <div style={{ textAlign: "right", fontSize: 14, color: "#4fc3f7", fontWeight: 600 }}>{cat.totalQty}</div>
                    <div style={{ textAlign: "right" }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: cat.lowStock > 0 ? "#ffaa00" : "#00e676" }}>{cat.lowStock}</span>
                    </div>
                  </div>
                ))}
                {/* Total row */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 60px 70px 70px", padding: "11px 14px", background: "rgba(79,195,247,0.05)", borderTop: "1px solid #1e3a5f", fontSize: 12, fontWeight: 700 }}>
                  <div style={{ color: "#7a99bb", letterSpacing: 1 }}>UKUPNO</div>
                  <div style={{ textAlign: "right", color: "#c8ddf0" }}>{items.length}</div>
                  <div style={{ textAlign: "right", color: "#4fc3f7" }}>{items.reduce((s, i) => s + i.quantity, 0)}</div>
                  <div style={{ textAlign: "right", color: reportLowStock.length > 0 ? "#ffaa00" : "#00e676" }}>{reportLowStock.length}</div>
                </div>
              </div>
            )}
          </div>

          {/* ── 2. Artikli sa niskim stockom ── */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 10, color: "#ffaa00", letterSpacing: 2, marginBottom: 12 }}>
              ⚠️ ARTIKLI SA NISKIM STOCKOM ({reportLowStock.length})
            </div>
            {reportLowStock.length === 0 ? (
              <div style={{ fontSize: 12, color: "#00e676", padding: "16px", textAlign: "center", border: "1px solid rgba(0,230,118,0.2)", borderRadius: 10, background: "rgba(0,230,118,0.05)" }}>
                ✓ Sve zalihe su uredne!
              </div>
            ) : (
              <div style={{ background: "#0d1526", border: "1px solid rgba(255,170,0,0.2)", borderRadius: 12, overflow: "hidden" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 60px 60px 60px", padding: "10px 14px", borderBottom: "1px solid #1a2f4a", fontSize: 9, color: "#5a7a9a", letterSpacing: 1 }}>
                  <div>ARTIKAL</div><div style={{ textAlign: "right" }}>IMA</div><div style={{ textAlign: "right" }}>MIN</div><div style={{ textAlign: "right" }}>DEFICIT</div>
                </div>
                {reportLowStock.map((item, idx) => {
                  const cat = getCat(item.categoryId);
                  const deficit = item.minStock - item.quantity;
                  const pct = Math.round((item.quantity / item.minStock) * 100);
                  return (
                    <div key={item.id} style={{ padding: "12px 14px", borderBottom: idx < reportLowStock.length - 1 ? "1px solid #0f1e32" : "none" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 60px 60px 60px", alignItems: "center", marginBottom: 6 }}>
                        <div>
                          <div style={{ fontSize: 13, color: "#c8ddf0", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.name}</div>
                          <div style={{ fontSize: 10, color: cat.color, marginTop: 2 }}>{cat.icon} {cat.name}</div>
                        </div>
                        <div style={{ textAlign: "right", fontSize: 14, fontWeight: 700, color: item.quantity === 0 ? "#ff4444" : "#ffaa00" }}>{item.quantity}</div>
                        <div style={{ textAlign: "right", fontSize: 14, color: "#7a99bb" }}>{item.minStock}</div>
                        <div style={{ textAlign: "right", fontSize: 14, fontWeight: 700, color: "#ff6666" }}>-{deficit}</div>
                      </div>
                      {/* Progress bar */}
                      <div style={{ background: "#0a0e1a", borderRadius: 4, height: 4 }}>
                        <div style={{ height: "100%", borderRadius: 4, background: item.quantity === 0 ? "#ff4444" : "#ffaa00", width: `${Math.min(100, pct)}%` }} />
                      </div>
                      <div style={{ fontSize: 9, color: "#5a7a9a", marginTop: 3, textAlign: "right" }}>{pct}% od minimuma</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── 3. Aktivnost korisnika ── */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, color: "#ffaa00", letterSpacing: 2, marginBottom: 12 }}>
              👥 AKTIVNOST KORISNIKA
            </div>
            {userActivityStats.length === 0 ? (
              <div style={{ fontSize: 12, color: "#3a5a7a", padding: "16px", textAlign: "center", border: "1px dashed #1e3a5f", borderRadius: 10 }}>Nema podataka</div>
            ) : (
              <div style={{ background: "#0d1526", border: "1px solid #1a2f4a", borderRadius: 12, overflow: "hidden" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 44px 44px 44px 44px 50px", padding: "10px 14px", borderBottom: "1px solid #1a2f4a", fontSize: 9, color: "#5a7a9a", letterSpacing: 1 }}>
                  <div>KORISNIK</div>
                  <div style={{ textAlign: "center" }} title="Dodano">➕</div>
                  <div style={{ textAlign: "center" }} title="Obrisano">🗑️</div>
                  <div style={{ textAlign: "center" }} title="Izmenjeno">✏️</div>
                  <div style={{ textAlign: "center" }} title="Kol. promena">⬆⬇</div>
                  <div style={{ textAlign: "right" }}>UKUPNO</div>
                </div>
                {userActivityStats.map((u, idx) => (
                  <div key={u.id} style={{ padding: "12px 14px", borderBottom: idx < userActivityStats.length - 1 ? "1px solid #0f1e32" : "none" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 44px 44px 44px 44px 50px", alignItems: "center", marginBottom: u.lastAction ? 4 : 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 16 }}>{u.role === "admin" ? "👑" : "👤"}</span>
                        <div>
                          <div style={{ fontSize: 13, color: "#c8ddf0", fontWeight: 500 }}>{u.name}</div>
                          <span style={{ fontSize: 9, color: u.role === "admin" ? "#FFD700" : "#4fc3f7", letterSpacing: 1 }}>{u.role === "admin" ? "ADMIN" : "KORISNIK"}</span>
                        </div>
                      </div>
                      <div style={{ textAlign: "center", fontSize: 13, color: u.adds > 0 ? "#00e676" : "#3a5a7a", fontWeight: u.adds > 0 ? 700 : 400 }}>{u.adds}</div>
                      <div style={{ textAlign: "center", fontSize: 13, color: u.deletes > 0 ? "#ff6666" : "#3a5a7a", fontWeight: u.deletes > 0 ? 700 : 400 }}>{u.deletes}</div>
                      <div style={{ textAlign: "center", fontSize: 13, color: u.edits > 0 ? "#4fc3f7" : "#3a5a7a", fontWeight: u.edits > 0 ? 700 : 400 }}>{u.edits}</div>
                      <div style={{ textAlign: "center", fontSize: 13, color: u.qtyChanges > 0 ? "#ffaa00" : "#3a5a7a", fontWeight: u.qtyChanges > 0 ? 700 : 400 }}>{u.qtyChanges}</div>
                      <div style={{ textAlign: "right", fontSize: 15, fontWeight: 700, color: u.total > 0 ? "#e0e8f0" : "#3a5a7a" }}>{u.total}</div>
                    </div>
                    {u.lastAction && (
                      <div style={{ fontSize: 10, color: "#3a5a7a", paddingLeft: 28 }}>Poslednja aktivnost: {u.lastAction.date} {u.lastAction.time}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
            {/* Legend */}
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 10, fontSize: 10, color: "#5a7a9a" }}>
              <span>➕ Dodano</span><span>🗑️ Obrisano</span><span>✏️ Izmenjeno</span><span>⬆⬇ Kol. promena</span>
            </div>
          </div>

        </div>
      )}

      {/* ── Modals ── */}
      {showForm && (
        <div className="modal-bg" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ width: 36, height: 4, background: "#2a4a6a", borderRadius: 2, margin: "0 auto 18px", display: isMobile ? "block" : "none" }} />
            <div style={{ fontSize: 10, letterSpacing: 3, color: "#4fc3f7", marginBottom: 5 }}>{editItem ? "UREDI ARTIKAL" : "NOVI ARTIKAL"}</div>
            <div style={{ height: 1, background: "#1e3a5f", marginBottom: 18 }} />
            <div style={{ marginBottom: 14 }}><label className="form-label">NAZIV *</label><input className="form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="npr. LED traka 5m" /></div>
            <div style={{ marginBottom: 14 }}>
              <label className="form-label">KATEGORIJA</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {categories.map(cat => (
                  <button key={cat.id} onClick={() => setForm({ ...form, categoryId: cat.id })}
                    style={{ padding: "7px 12px", borderRadius: 20, border: `1.5px solid ${form.categoryId === cat.id ? cat.color : "#1e3a5f"}`, background: form.categoryId === cat.id ? `${cat.color}22` : "transparent", color: form.categoryId === cat.id ? cat.color : "#7a99bb", cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>
                    {cat.icon} {cat.name}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
              <div><label className="form-label">KOLIČINA *</label><input className="form-input" type="number" min="0" inputMode="numeric" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} placeholder="0" /></div>
              <div><label className="form-label">JEDINICA</label><select className="form-input" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })}>{UNITS.map(u => <option key={u} value={u}>{u}</option>)}</select></div>
            </div>
            <div style={{ marginBottom: 22 }}><label className="form-label">MIN. ZALIHA</label><input className="form-input" type="number" min="0" inputMode="numeric" value={form.minStock} onChange={e => setForm({ ...form, minStock: e.target.value })} placeholder="0" /></div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={submitForm} style={{ flex: 1, background: "#4fc3f7", color: "#0a0e1a", border: "none", padding: "14px", borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>{editItem ? "✓ SAČUVAJ" : "+ DODAJ"}</button>
              <button onClick={() => setShowForm(false)} style={{ background: "rgba(255,68,68,0.1)", border: "1px solid rgba(255,68,68,0.25)", color: "#ff6666", padding: "14px 18px", borderRadius: 10, cursor: "pointer", fontSize: 16 }}>✕</button>
            </div>
          </div>
        </div>
      )}

      {showCatForm && (
        <div className="modal-bg" onClick={() => setShowCatForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ width: 36, height: 4, background: "#2a4a6a", borderRadius: 2, margin: "0 auto 18px", display: isMobile ? "block" : "none" }} />
            <div style={{ fontSize: 10, letterSpacing: 3, color: "#4fc3f7", marginBottom: 5 }}>{editCat ? "UREDI KATEGORIJU" : "NOVA KATEGORIJA"}</div>
            <div style={{ height: 1, background: "#1e3a5f", marginBottom: 18 }} />
            <div style={{ display: "flex", alignItems: "center", gap: 12, background: "#0a0e1a", borderRadius: 12, padding: "12px 16px", marginBottom: 18, border: `1px solid ${catForm.color}44` }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: `${catForm.color}22`, border: `2px solid ${catForm.color}55`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>{catForm.icon}</div>
              <div style={{ fontWeight: 600, color: catForm.color, fontSize: 14 }}>{catForm.name || "Naziv kategorije"}</div>
            </div>
            <div style={{ marginBottom: 14 }}><label className="form-label">NAZIV *</label><input className="form-input" value={catForm.name} onChange={e => setCatForm({ ...catForm, name: e.target.value })} placeholder="npr. Rezervni delovi" /></div>
            <div style={{ marginBottom: 14 }}>
              <label className="form-label">BOJA</label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{CAT_COLORS.map(c => <div key={c} className={`color-swatch ${catForm.color === c ? "selected" : ""}`} style={{ background: c }} onClick={() => setCatForm({ ...catForm, color: c })} />)}</div>
            </div>
            <div style={{ marginBottom: 22 }}>
              <label className="form-label">IKONICA</label>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{CAT_ICONS.map(ic => <button key={ic} className={`icon-btn ${catForm.icon === ic ? "selected" : ""}`} onClick={() => setCatForm({ ...catForm, icon: ic })}>{ic}</button>)}</div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={submitCatForm} style={{ flex: 1, background: "#4fc3f7", color: "#0a0e1a", border: "none", padding: "14px", borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>{editCat ? "✓ SAČUVAJ" : "+ DODAJ"}</button>
              <button onClick={() => setShowCatForm(false)} style={{ background: "rgba(255,68,68,0.1)", border: "1px solid rgba(255,68,68,0.25)", color: "#ff6666", padding: "14px 18px", borderRadius: 10, cursor: "pointer", fontSize: 16 }}>✕</button>
            </div>
          </div>
        </div>
      )}

      {showUserForm && (
        <div className="modal-bg" onClick={() => setShowUserForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ width: 36, height: 4, background: "#2a4a6a", borderRadius: 2, margin: "0 auto 18px", display: isMobile ? "block" : "none" }} />
            <div style={{ fontSize: 10, letterSpacing: 3, color: "#FFD700", marginBottom: 5 }}>{editUser ? "UREDI KORISNIKA" : "NOVI KORISNIK"}</div>
            <div style={{ height: 1, background: "#1e3a5f", marginBottom: 18 }} />
            <div style={{ marginBottom: 14 }}><label className="form-label">IME *</label><input className="form-input" value={userForm.name} onChange={e => setUserForm({ ...userForm, name: e.target.value })} placeholder="npr. Marko" /></div>
            <div style={{ marginBottom: 14 }}>
              <label className="form-label">PIN KOD (4 cifre) *</label>
              <input className="form-input" type="password" inputMode="numeric" maxLength={4} value={userForm.pin} onChange={e => setUserForm({ ...userForm, pin: e.target.value.replace(/\D/g, "").slice(0, 4) })} placeholder="••••" style={{ letterSpacing: 8, fontSize: 20, textAlign: "center" }} />
            </div>
            <div style={{ marginBottom: 22 }}>
              <label className="form-label">ULOGA</label>
              <div style={{ display: "flex", gap: 10 }}>
                {["user","admin"].map(role => (
                  <button key={role} onClick={() => setUserForm({ ...userForm, role })}
                    style={{ flex: 1, padding: "12px", borderRadius: 10, border: `1.5px solid ${userForm.role === role ? (role === "admin" ? "#FFD700" : "#4fc3f7") : "#1e3a5f"}`, background: userForm.role === role ? (role === "admin" ? "rgba(255,215,0,0.1)" : "rgba(79,195,247,0.1)") : "transparent", color: userForm.role === role ? (role === "admin" ? "#FFD700" : "#4fc3f7") : "#7a99bb", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 600 }}>
                    {role === "admin" ? "👑 Admin" : "👤 Korisnik"}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={submitUserForm} style={{ flex: 1, background: "#FFD700", color: "#0a0e1a", border: "none", padding: "14px", borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>{editUser ? "✓ SAČUVAJ" : "+ DODAJ"}</button>
              <button onClick={() => setShowUserForm(false)} style={{ background: "rgba(255,68,68,0.1)", border: "1px solid rgba(255,68,68,0.25)", color: "#ff6666", padding: "14px 18px", borderRadius: 10, cursor: "pointer", fontSize: 16 }}>✕</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
