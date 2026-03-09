import { useState, useEffect, useCallback } from "react";
import { db, ref, onValue, set } from "./firebase";

const UNITS = ["kom", "kg", "l", "m", "kutija", "paleta", "set"];
const DB_PATH = "warehouse_v5";

const ROLES = {
  owner:     { label: "OWNER",     icon: "👑", color: "#ff9500", rank: 4 },
  admin:     { label: "ADMIN",     icon: "🛡️", color: "#FFD700", rank: 3 },
  korisnik:  { label: "KORISNIK",  icon: "👤", color: "#4fc3f7", rank: 2 },
  preglodac: { label: "PREGLEDAČ", icon: "👁️", color: "#90a4ae", rank: 1 },
};

const canManageUser  = (a, t) => { if (a.role === "owner") return t.id !== a.id; if (a.role === "admin") return t.role === "korisnik" || t.role === "preglodac"; return false; };
const canApprove     = (u) => u.role === "owner" || u.role === "admin";
const canEditItems   = (u) => u.role === "owner" || u.role === "admin";
const canEditCats    = (u) => u.role === "owner" || u.role === "admin";
const canViewReports = (u) => u.role === "owner" || u.role === "admin";
const canManageUsers = (u) => u.role === "owner" || u.role === "admin";

const DEFAULT_OWNER = { id: "owner_default", name: "Owner", pin: "0000", role: "owner" };
const CAT_COLORS = ["#FFD700","#4fc3f7","#ce93d8","#ff8a65","#a5d6a7","#f48fb1","#80cbc4","#ffcc02","#90a4ae","#ef9a9a"];
const CAT_ICONS  = ["💡","🔌","🎛️","⚡","🔧","📦","🔦","🖥️","📡","🛠️","🔋","🎯","📌","🗂️","⚙️"];

const ACTION_META = {
  item_add:     { icon: "➕", color: "#00e676", label: "Artikal dodat" },
  item_delete:  { icon: "🗑️", color: "#ff4444", label: "Artikal obrisan" },
  item_edit:    { icon: "✏️", color: "#4fc3f7", label: "Artikal izmenjen" },
  qty_increase: { icon: "⬆️", color: "#00e676", label: "Količina povećana" },
  qty_decrease: { icon: "⬇️", color: "#ffaa00", label: "Količina smanjena" },
  cat_add:      { icon: "🏷️", color: "#ce93d8", label: "Kategorija dodana" },
  cat_delete:   { icon: "🗑️", color: "#ff4444", label: "Kategorija obrisana" },
  cat_edit:     { icon: "✏️", color: "#4fc3f7", label: "Kategorija izmenjena" },
  req_approved: { icon: "✅", color: "#00e676", label: "Zahtev odobren" },
  req_rejected: { icon: "❌", color: "#ff4444", label: "Zahtev odbijen" },
};

function generateId() { return `id_${Date.now()}_${Math.floor(Math.random() * 9999)}`; }
function formatTs(ts) {
  const d = new Date(ts);
  return { date: d.toLocaleDateString("sr-RS", { day: "2-digit", month: "2-digit", year: "numeric" }), time: d.toLocaleTimeString("sr-RS", { hour: "2-digit", minute: "2-digit" }) };
}
function useIsMobile() {
  const [v, setV] = useState(window.innerWidth < 640);
  useEffect(() => { const h = () => setV(window.innerWidth < 640); window.addEventListener("resize", h); return () => window.removeEventListener("resize", h); }, []);
  return v;
}

// ─────────────────────────────────────────────────────────────
// LOGIN
// ─────────────────────────────────────────────────────────────
function LoginScreen({ users, onLogin }) {
  const [pin, setPin] = useState(""); const [error, setError] = useState(""); const [shake, setShake] = useState(false);
  const tryLogin = (p) => { const f = users.find(u => u.pin === p); if (f) { onLogin(f); } else { setError("Pogrešan PIN"); setShake(true); setTimeout(() => { setShake(false); setError(""); setPin(""); }, 900); } };
  const press = (v) => { if (v === "del") { setPin(p => p.slice(0,-1)); return; } const n = pin + v; setPin(n); if (n.length === 4) setTimeout(() => tryLogin(n), 120); };
  return (
    <div style={{ background: "#0a0e1a", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'IBM Plex Mono',monospace", padding: 20 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&family=IBM+Plex+Sans:wght@700&display=swap');*{box-sizing:border-box;margin:0;padding:0}.pin-btn{width:72px;height:72px;border-radius:50%;background:#0d1526;border:1.5px solid #1e3a5f;color:#e0e8f0;font-size:22px;font-weight:600;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;flex-direction:column;transition:all .12s;user-select:none;-webkit-tap-highlight-color:transparent}.pin-btn:active{background:#4fc3f7;color:#0a0e1a;border-color:#4fc3f7;transform:scale(.93)}.pin-btn sub{font-size:8px;letter-spacing:1px;color:#4a6a8a;margin-top:2px}.pin-btn:active sub{color:#0a0e1a}@keyframes shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-8px)}40%,80%{transform:translateX(8px)}}@keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <div style={{ textAlign: "center", animation: "fadeUp 0.4s ease" }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🔐</div>
        <div style={{ fontSize: 10, letterSpacing: 4, color: "#4fc3f7", marginBottom: 6 }}>WAREHOUSE SYSTEM</div>
        <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "'IBM Plex Sans',sans-serif", color: "#e0e8f0", marginBottom: 4 }}>LED team <span style={{ color: "#4fc3f7" }}>(Serbia)</span></div>
        <div style={{ fontSize: 12, color: "#5a7a9a", marginBottom: 40 }}>Unesi PIN kod</div>
        <div style={{ display: "flex", gap: 16, justifyContent: "center", marginBottom: 12, animation: shake ? "shake 0.5s ease" : "none" }}>
          {[0,1,2,3].map(i => <div key={i} style={{ width: 16, height: 16, borderRadius: "50%", border: `2px solid ${i < pin.length ? "#4fc3f7" : "#1e3a5f"}`, background: i < pin.length ? "#4fc3f7" : "transparent", transition: "all .15s", boxShadow: i < pin.length ? "0 0 8px #4fc3f7" : "none" }} />)}
        </div>
        <div style={{ height: 20, marginBottom: 24, fontSize: 12, color: "#ff6666" }}>{error}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,72px)", gap: 14, justifyContent: "center" }}>
          {["1","2","3","4","5","6","7","8","9","","0","del"].map((k,i) => k === "" ? <div key={i}/> : k === "del" ? <button key={i} className="pin-btn" onClick={() => press("del")} style={{ fontSize: 20 }}>⌫</button> : <button key={i} className="pin-btn" onClick={() => press(k)}>{k}<sub>{["","ABC","DEF","GHI","JKL","MNO","PQRS","TUV","WXYZ","","",""][Number(k)]}</sub></button>)}
        </div>
        <div style={{ marginTop: 32, fontSize: 11, color: "#2a4a6a" }}>{users.length} korisnik{users.length !== 1 ? "a" : ""} registrovano</div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────────────────────
export default function WarehouseApp() {
  const isMobile = useIsMobile();
  const [data, setData] = useState({ items: [], categories: [], users: [], history: [], requests: [] });
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab, setActiveTab] = useState("categories"); // main tabs
  const [openCatId, setOpenCatId] = useState(null); // which category is "open" (drill-down)
  const [search, setSearch] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [notification, setNotification] = useState(null);
  const [expandedItem, setExpandedItem] = useState(null);

  // Modals
  const [showItemForm, setShowItemForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [itemForm, setItemForm] = useState({ name: "", quantity: "", unit: "kom", minStock: "", categoryId: "" });
  const [showCatForm, setShowCatForm] = useState(false);
  const [editCat, setEditCat] = useState(null);
  const [catForm, setCatForm] = useState({ name: "", color: CAT_COLORS[0], icon: CAT_ICONS[0] });
  const [showUserForm, setShowUserForm] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [userForm, setUserForm] = useState({ name: "", pin: "", role: "korisnik" });
  const [showReqForm, setShowReqForm] = useState(null);
  const [reqForm, setReqForm] = useState({ type: "increase", amount: "" });
  const [historyFilter, setHistoryFilter] = useState("sve");

  useEffect(() => { const on = () => setOnline(true); const off = () => setOnline(false); window.addEventListener("online", on); window.addEventListener("offline", off); return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); }; }, []);

  useEffect(() => {
    const unsub = onValue(ref(db, DB_PATH), (snap) => {
      const v = snap.val();
      setData(v ? { items: v.items||[], categories: v.categories||[], users: v.users||[DEFAULT_OWNER], history: v.history||[], requests: v.requests||[] } : { items: [], categories: [], users: [DEFAULT_OWNER], history: [], requests: [] });
      setLoaded(true);
    }, () => setLoaded(true));
    return () => unsub();
  }, []);

  const save = useCallback(async (d) => { setSyncing(true); try { await set(ref(db, DB_PATH), d); } catch(e) { console.error(e); } setTimeout(() => setSyncing(false), 600); }, []);
  const notify = (msg, type = "success") => { setNotification({ msg, type }); setTimeout(() => setNotification(null), 2500); };
  const addHistory = (action, detail, updated) => { const e = { id: generateId(), action, detail, user: currentUser?.name||"?", userId: currentUser?.id||"?", timestamp: Date.now() }; return { ...updated, history: [e, ...(updated.history||[])] }; };

  const { items, categories, users, history, requests } = data;
  const getCat = (id) => categories.find(c => c.id === id) || { name: "—", color: "#5a7a9a", icon: "📦" };
  const getStockColor = (item) => item.quantity === 0 ? "#ff4444" : (item.minStock > 0 && item.quantity <= item.minStock ? "#ffaa00" : "#00e676");
  const pendingRequests = (requests||[]).filter(r => r.status === "pending");
  const pendingCount = pendingRequests.length;

  // Currently open category object
  const openCat = categories.find(c => c.id === openCatId);
  // Items in open category
  const catItems = openCatId ? items.filter(i => i.categoryId === openCatId).filter(i => (i.name||"").toLowerCase().includes(search.toLowerCase())) : [];

  // ── Items ──
  const openAddItem = () => { setEditItem(null); setItemForm({ name: "", quantity: "", unit: "kom", minStock: "", categoryId: openCatId || "" }); setShowItemForm(true); };
  const openEditItem = (item) => { setEditItem(item); setItemForm({ name: item.name, quantity: item.quantity, unit: item.unit, minStock: item.minStock, categoryId: item.categoryId||"" }); setShowItemForm(true); };
  const submitItemForm = () => {
    if (!itemForm.name || itemForm.quantity === "") return;
    let updated = { ...data };
    if (editItem) {
      updated.items = items.map(i => i.id === editItem.id ? { ...i, ...itemForm, quantity: Number(itemForm.quantity), minStock: Number(itemForm.minStock) } : i);
      updated = addHistory("item_edit", `"${itemForm.name}" izmenjen`, updated);
      notify("Artikal ažuriran ✓");
    } else {
      updated.items = [...items, { id: generateId(), ...itemForm, quantity: Number(itemForm.quantity), minStock: Number(itemForm.minStock) }];
      updated = addHistory("item_add", `"${itemForm.name}" dodat (${itemForm.quantity} ${itemForm.unit})`, updated);
      notify("Artikal dodat ✓");
    }
    setData(updated); save(updated); setShowItemForm(false);
  };
  const deleteItem = (id) => {
    const item = items.find(i => i.id === id);
    let updated = { ...data, items: items.filter(i => i.id !== id) };
    updated = addHistory("item_delete", `"${item?.name}" obrisan`, updated);
    setData(updated); save(updated); setExpandedItem(null); notify("Artikal obrisan", "error");
  };
  const adjustQty = (id, delta) => {
    const item = items.find(i => i.id === id);
    const newQty = Math.max(0, item.quantity + delta);
    let updated = { ...data, items: items.map(i => i.id === id ? { ...i, quantity: newQty } : i) };
    updated = addHistory(delta > 0 ? "qty_increase" : "qty_decrease", `"${item?.name}" ${delta>0?"+":""}${delta} → ${newQty} ${item?.unit}`, updated);
    setData(updated); save(updated);
  };

  // ── Requests ──
  const submitRequest = () => {
    if (!reqForm.amount || Number(reqForm.amount) <= 0) return;
    const item = items.find(i => i.id === showReqForm);
    const req = { id: generateId(), itemId: item.id, itemName: item.name, itemUnit: item.unit, type: reqForm.type, amount: Number(reqForm.amount), requestedBy: currentUser.name, requestedById: currentUser.id, status: "pending", timestamp: Date.now() };
    const updated = { ...data, requests: [...(requests||[]), req] };
    setData(updated); save(updated); setShowReqForm(null); setReqForm({ type: "increase", amount: "" }); notify("Zahtev poslat ✓");
  };
  const approveRequest = (reqId) => {
    const req = requests.find(r => r.id === reqId); if (!req) return;
    const delta = req.type === "increase" ? req.amount : -req.amount;
    const item = items.find(i => i.id === req.itemId);
    if (!item) { notify("Artikal ne postoji!", "error"); return; }
    const newQty = Math.max(0, item.quantity + delta);
    let updated = { ...data, items: items.map(i => i.id === req.itemId ? { ...i, quantity: newQty } : i), requests: requests.map(r => r.id === reqId ? { ...r, status: "approved", resolvedBy: currentUser.name, resolvedAt: Date.now() } : r) };
    updated = addHistory(delta > 0 ? "qty_increase" : "qty_decrease", `"${item.name}" ${delta>0?"+":""}${delta} → ${newQty} ${item.unit} (odobreno)`, updated);
    setData(updated); save(updated); notify("Zahtev odobren ✓");
  };
  const rejectRequest = (reqId) => {
    const req = requests.find(r => r.id === reqId);
    let updated = { ...data, requests: requests.map(r => r.id === reqId ? { ...r, status: "rejected", resolvedBy: currentUser.name, resolvedAt: Date.now() } : r) };
    updated = addHistory("req_rejected", `Zahtev za "${req?.itemName}" odbijen`, updated);
    setData(updated); save(updated); notify("Zahtev odbijen", "error");
  };

  // ── Categories ──
  const openAddCat = () => { setEditCat(null); setCatForm({ name: "", color: CAT_COLORS[0], icon: CAT_ICONS[0] }); setShowCatForm(true); };
  const openEditCat = (c) => { setEditCat(c); setCatForm({ name: c.name, color: c.color, icon: c.icon }); setShowCatForm(true); };
  const submitCatForm = () => {
    if (!catForm.name) return;
    let updated = { ...data };
    if (editCat) { updated.categories = categories.map(c => c.id === editCat.id ? { ...c, ...catForm } : c); updated = addHistory("cat_edit", `Kategorija "${catForm.name}" izmenjena`, updated); notify("Kategorija ažurirana ✓"); }
    else { updated.categories = [...categories, { id: generateId(), ...catForm }]; updated = addHistory("cat_add", `Kategorija "${catForm.name}" dodana`, updated); notify("Kategorija dodana ✓"); }
    setData(updated); save(updated); setShowCatForm(false);
  };
  const deleteCat = (id) => {
    if (items.some(i => i.categoryId === id)) { notify("Kategorija ima artikle — prvo ih premesti!", "error"); return; }
    const cat = categories.find(c => c.id === id);
    let updated = { ...data, categories: categories.filter(c => c.id !== id) };
    updated = addHistory("cat_delete", `Kategorija "${cat?.name}" obrisana`, updated);
    setData(updated); save(updated); notify("Kategorija obrisana", "error");
  };

  // ── Users ──
  const openAddUser = () => { setEditUser(null); setUserForm({ name: "", pin: "", role: "korisnik" }); setShowUserForm(true); };
  const openEditUser = (u) => { if (!canManageUser(currentUser, u) && u.id !== currentUser.id) { notify("Nemate pristup!", "error"); return; } setEditUser(u); setUserForm({ name: u.name, pin: u.pin, role: u.role }); setShowUserForm(true); };
  const submitUserForm = () => {
    if (!userForm.name || userForm.pin.length < 4) { notify("PIN mora imati 4 cifre!", "error"); return; }
    if (users.some(u => u.pin === userForm.pin && (!editUser || u.id !== editUser.id))) { notify("Taj PIN već postoji!", "error"); return; }
    const safeRole = currentUser.role !== "owner" && (userForm.role === "admin" || userForm.role === "owner") ? "korisnik" : userForm.role;
    let updated = { ...data };
    if (editUser) { updated.users = users.map(u => u.id === editUser.id ? { ...u, name: userForm.name, pin: userForm.pin, role: safeRole } : u); if (currentUser.id === editUser.id) setCurrentUser({ ...currentUser, name: userForm.name, pin: userForm.pin }); notify("Korisnik ažuriran ✓"); }
    else { updated.users = [...users, { id: generateId(), name: userForm.name, pin: userForm.pin, role: safeRole }]; notify("Korisnik dodat ✓"); }
    setData(updated); save(updated); setShowUserForm(false);
  };
  const deleteUser = (id) => {
    const target = users.find(u => u.id === id);
    if (!canManageUser(currentUser, target)) { notify("Nemate pristup!", "error"); return; }
    setData(d => { const nd = { ...d, users: d.users.filter(u => u.id !== id) }; save(nd); return nd; }); notify("Korisnik obrisan", "error");
  };

  // ── Reports ──
  const reportCatStats = categories.map(cat => { const ci = items.filter(i => i.categoryId === cat.id); return { ...cat, itemCount: ci.length, totalQty: ci.reduce((s,i) => s+i.quantity,0), lowStock: ci.filter(i => i.minStock>0 && i.quantity<=i.minStock).length }; });
  const reportLowStock = items.filter(i => i.minStock>0 && i.quantity<=i.minStock).sort((a,b) => (a.quantity/Math.max(1,a.minStock))-(b.quantity/Math.max(1,b.minStock)));
  const userActivityStats = users.map(u => { const uh = history.filter(h => h.userId===u.id); return { ...u, total: uh.length, adds: uh.filter(h=>h.action==="item_add").length, deletes: uh.filter(h=>h.action==="item_delete").length, edits: uh.filter(h=>h.action==="item_edit").length, qtyChanges: uh.filter(h=>h.action==="qty_increase"||h.action==="qty_decrease").length, lastAction: uh[0]?formatTs(uh[0].timestamp):null }; }).sort((a,b)=>b.total-a.total);
  const filteredHistory = historyFilter === "sve" ? history : history.filter(h => h.action === historyFilter);
  const groupedHistory = filteredHistory.reduce((g,e) => { const {date} = formatTs(e.timestamp); if(!g[date]) g[date]=[]; g[date].push(e); return g; }, {});

  const tabs = [
    { id: "categories", icon: "📦", label: "MAGACIN", show: true },
    { id: "requests",   icon: "📬", label: "ZAHTEVI", show: canApprove(currentUser||{}), badge: pendingCount },
    { id: "users",      icon: "👥", label: "KORISNICI", show: canManageUsers(currentUser||{}) },
    { id: "history",    icon: "📋", label: "ISTORIJA", show: canViewReports(currentUser||{}) },
    { id: "reports",    icon: "📊", label: "IZVEŠTAJI", show: canViewReports(currentUser||{}) },
  ].filter(t => t.show);

  if (!loaded) return (
    <div style={{ background: "#0a0e1a", height: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14 }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ width: 44, height: 44, border: "3px solid #1e3a5f", borderTop: "3px solid #4fc3f7", borderRadius: "50%", animation: "spin .9s linear infinite" }} />
      <div style={{ color: "#4fc3f7", fontFamily: "monospace", fontSize: 12, letterSpacing: 3 }}>UČITAVANJE...</div>
    </div>
  );
  if (!currentUser) return <LoginScreen users={users.length>0?users:[DEFAULT_OWNER]} onLogin={setCurrentUser} />;

  const role = ROLES[currentUser.role] || ROLES.korisnik;

  return (
    <div style={{ background: "#0a0e1a", minHeight: "100vh", fontFamily: "'IBM Plex Mono','Courier New',monospace", color: "#e0e8f0", paddingBottom: isMobile ? 84 : 0 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500;600&family=IBM+Plex+Sans:wght@400;600;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
        ::-webkit-scrollbar{width:3px}::-webkit-scrollbar-thumb{background:#1e3a5f}
        input,select,button{outline:none;font-family:inherit}
        .fi{width:100%;background:#0a0e1a;border:1px solid #1e3a5f;color:#e0e8f0;padding:12px 14px;border-radius:8px;font-family:inherit;font-size:14px;transition:border .2s}.fi:focus{border-color:#4fc3f7}
        .fl{display:block;font-size:10px;letter-spacing:2px;color:#4fc3f7;margin-bottom:6px}
        .notif{position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:300;padding:11px 22px;border-radius:24px;font-size:13px;white-space:nowrap;animation:popIn .3s ease;box-shadow:0 8px 32px rgba(0,0,0,.5)}
        @keyframes popIn{from{transform:translateX(-50%) translateY(-16px);opacity:0}to{transform:translateX(-50%) translateY(0);opacity:1}}
        .fab{position:fixed;bottom:90px;right:20px;width:58px;height:58px;border-radius:50%;background:#4fc3f7;border:none;cursor:pointer;font-size:30px;color:#0a0e1a;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 24px rgba(79,195,247,.45);z-index:50;transition:transform .15s}.fab:active{transform:scale(.9)}
        .qc{width:42px;height:42px;border-radius:50%;border:1.5px solid #1e3a5f;background:rgba(79,195,247,.06);color:#4fc3f7;font-size:22px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .15s}.qc:active{background:#4fc3f7;color:#0a0e1a;transform:scale(.9)}
        .mbg{position:fixed;inset:0;background:rgba(0,0,0,.82);z-index:100;backdrop-filter:blur(6px)}
        .modal{background:#0d1526;border-top:1px solid #1e3a5f;border-radius:20px 20px 0 0;padding:12px 20px 32px;width:100%;position:fixed;bottom:0;animation:slideUp .28s cubic-bezier(.32,.72,0,1);max-height:90vh;overflow-y:auto}
        @media(min-width:640px){.modal{border-radius:16px;border:1px solid #1e3a5f;width:460px;top:50%;left:50%;transform:translate(-50%,-50%) !important;bottom:auto;animation:none;max-height:85vh;padding:28px}}
        @keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
        .bnav{position:fixed;bottom:0;left:0;right:0;background:#0d1526;border-top:1px solid #1e3a5f;display:flex;padding:8px 0 12px;z-index:50}
        .nitem{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;padding:4px 0;cursor:pointer;position:relative}
        .ac{flex:1;padding:11px 4px;border-radius:10px;border:1px solid;font-size:11px;cursor:pointer;font-family:inherit;text-align:center}.ac:active{opacity:.6}
        .exps{margin-top:14px;padding-top:14px;border-top:1px solid #1a2f4a;display:flex;gap:8px;animation:fadeIn .2s ease}
        @keyframes fadeIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}
        .sc{background:#0d1526;border:1px solid #1a2f4a;border-radius:10px;padding:10px 14px;flex:1;text-align:center}
        .pulse{animation:pulse 2s infinite}@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
        @keyframes spin{to{transform:rotate(360deg)}}
        .tb{flex:1;padding:9px 4px;border:none;background:transparent;cursor:pointer;font-family:inherit;font-size:9px;letter-spacing:.5px;color:#7a99bb;border-bottom:2px solid transparent;transition:all .2s;white-space:nowrap}
        .tb.active{color:#4fc3f7;border-bottom-color:#4fc3f7}
        .csw{width:28px;height:28px;border-radius:50%;cursor:pointer;border:2px solid transparent;transition:all .15s;flex-shrink:0}.csw.sel{border-color:white;transform:scale(1.2)}
        .ibtn{width:36px;height:36px;border-radius:8px;border:1.5px solid #1e3a5f;background:transparent;cursor:pointer;font-size:18px;display:flex;align-items:center;justify-content:center;transition:all .15s}.ibtn.sel{border-color:#4fc3f7;background:rgba(79,195,247,.15)}
        .rbadge{display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:12px;font-size:10px;letter-spacing:1px;font-weight:600}
        .hf{display:flex;gap:6px;overflow-x:auto;padding-bottom:4px}.hf::-webkit-scrollbar{height:2px}
        .hc{padding:5px 12px;border-radius:16px;border:1px solid;font-size:10px;cursor:pointer;white-space:nowrap;font-family:inherit;transition:all .15s}
        .he{background:#0d1526;border-radius:12px;padding:12px 14px;border:1px solid #1a2f4a;display:flex;gap:12px;align-items:flex-start}
        .dd{font-size:10px;color:#3a5a7a;letter-spacing:2px;padding:16px 0 8px;display:flex;align-items:center;gap:10px}.dd::after{content:'';flex:1;height:1px;background:#1a2f4a}
        .badge{position:absolute;top:0;right:6px;background:#ff4444;color:white;border-radius:50%;width:16px;height:16px;font-size:9px;display:flex;align-items:center;justify-content:center;font-weight:700}
        .cat-card{background:#0d1526;border-radius:16px;padding:0;border:1px solid #1a2f4a;cursor:pointer;user-select:none;transition:transform .15s,border-color .15s;overflow:hidden}.cat-card:active{transform:scale(.98)}
        .item-card{background:#0a0e1a;border-radius:12px;padding:14px;border:1px solid #1a2f4a;cursor:pointer;user-select:none;transition:transform .15s}.item-card:active{transform:scale(.985)}
        .back-btn{display:flex;align-items:center;gap:8px;background:transparent;border:none;color:#4fc3f7;font-family:inherit;font-size:12px;cursor:pointer;padding:0;letter-spacing:1px}.back-btn:active{opacity:.6}
      `}</style>

      {notification && <div className="notif" style={{ background: notification.type==="error"?"#1f0a0a":"#0a1f10", border:`1px solid ${notification.type==="error"?"#ff4444":"#00e676"}`, color:notification.type==="error"?"#ff6666":"#66ff99" }}>{notification.msg}</div>}

      {/* ── HEADER ── */}
      <div style={{ background: "#0d1526", borderBottom: "1px solid #1e3a5f", padding: isMobile ? "12px 16px 0" : "14px 28px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
          <div>
            {openCatId && activeTab === "categories" ? (
              // Back button when inside a category
              <button className="back-btn" onClick={() => { setOpenCatId(null); setSearch(""); }}>
                ← <span style={{ color: "#7a99bb" }}>MAGACIN</span>
              </button>
            ) : (
              <div style={{ fontSize: 9, letterSpacing: 3, color: "#4fc3f7" }}>WAREHOUSE SYSTEM</div>
            )}
            <div style={{ fontSize: isMobile ? 16 : 20, fontWeight: 700, fontFamily: "'IBM Plex Sans',sans-serif", marginTop: 3 }}>
              {openCatId && activeTab === "categories" ? (
                <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 24 }}>{openCat?.icon}</span>
                  <span style={{ color: openCat?.color }}>{openCat?.name}</span>
                </span>
              ) : (
                <>▣ LED team <span style={{ color: "#4fc3f7" }}>(Serbia)</span></>
              )}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 12, color: "#c8ddf0" }}>{currentUser.name}</div>
                <span className="rbadge" style={{ background:`${role.color}18`, color:role.color, border:`1px solid ${role.color}33` }}>{role.icon} {role.label}</span>
              </div>
              <button onClick={() => setCurrentUser(null)} style={{ width:32,height:32,border:"1px solid #1e3a5f",borderRadius:8,background:"transparent",color:"#5a7a9a",cursor:"pointer",fontSize:15 }}>⏏</button>
            </div>
            <div style={{ display:"flex",alignItems:"center",gap:6,background:"#0a0e1a",border:"1px solid #1e3a5f",borderRadius:20,padding:"3px 10px" }}>
              {syncing ? <><div style={{ width:7,height:7,border:"1.5px solid #4fc3f7",borderTop:"1.5px solid transparent",borderRadius:"50%",animation:"spin .7s linear infinite" }}/><span style={{ fontSize:9,color:"#4fc3f7" }}>SYNC</span></> : <><div style={{ width:7,height:7,borderRadius:"50%",background:online?"#00e676":"#ff4444",boxShadow:`0 0 5px ${online?"#00e676":"#ff4444"}` }} className="pulse"/><span style={{ fontSize:9,color:online?"#00e676":"#ff4444" }}>{online?"ONLINE":"OFFLINE"}</span></>}
            </div>
          </div>
        </div>

        {/* Stats row — show when on categories main view */}
        {!(openCatId && activeTab === "categories") && (
          <div style={{ display:"flex",gap:8,marginBottom:12 }}>
            <div className="sc"><div style={{ fontSize:9,color:"#7a99bb",letterSpacing:2 }}>KATEGORIJA</div><div style={{ fontSize:20,fontWeight:700,color:"#4fc3f7",marginTop:2 }}>{categories.length}</div></div>
            <div className="sc"><div style={{ fontSize:9,color:"#7a99bb",letterSpacing:2 }}>ARTIKALA</div><div style={{ fontSize:20,fontWeight:700,color:"#e0e8f0",marginTop:2 }}>{items.length}</div></div>
            {canApprove(currentUser) && <div className="sc"><div style={{ fontSize:9,color:"#7a99bb",letterSpacing:2 }}>ZAHTEVI</div><div style={{ fontSize:20,fontWeight:700,color:pendingCount>0?"#ff8a65":"#00e676",marginTop:2 }}>{pendingCount}</div></div>}
          </div>
        )}

        {/* Stats inside category */}
        {openCatId && activeTab === "categories" && (
          <div style={{ display:"flex",gap:8,marginBottom:12 }}>
            <div className="sc"><div style={{ fontSize:9,color:"#7a99bb",letterSpacing:2 }}>ARTIKALA</div><div style={{ fontSize:20,fontWeight:700,color:openCat?.color,marginTop:2 }}>{items.filter(i=>i.categoryId===openCatId).length}</div></div>
            <div className="sc"><div style={{ fontSize:9,color:"#7a99bb",letterSpacing:2 }}>NIZAK ST.</div><div style={{ fontSize:20,fontWeight:700,color:items.filter(i=>i.categoryId===openCatId&&i.minStock>0&&i.quantity<=i.minStock).length>0?"#ffaa00":"#00e676",marginTop:2 }}>{items.filter(i=>i.categoryId===openCatId&&i.minStock>0&&i.quantity<=i.minStock).length}</div></div>
            <div className="sc"><div style={{ fontSize:9,color:"#7a99bb",letterSpacing:2 }}>UKUPNO KOL.</div><div style={{ fontSize:20,fontWeight:700,color:"#e0e8f0",marginTop:2 }}>{items.filter(i=>i.categoryId===openCatId).reduce((s,i)=>s+i.quantity,0)}</div></div>
          </div>
        )}

        {/* Tabs */}
        <div style={{ display:"flex" }}>
          {tabs.map(t => <button key={t.id} className={`tb ${activeTab===t.id?"active":""}`} onClick={() => { setActiveTab(t.id); if(t.id!=="categories") setOpenCatId(null); }} style={{ position:"relative" }}>{t.icon} {!isMobile&&t.label}{t.badge>0&&<span className="badge">{t.badge}</span>}</button>)}
        </div>
        <div style={{ height:1,background:"#1e3a5f" }} />
      </div>

      {/* ══════════════════════════════════════════════════════ */}
      {/* CATEGORIES TAB — main list OR open category */}
      {/* ══════════════════════════════════════════════════════ */}
      {activeTab === "categories" && !openCatId && (
        <div style={{ padding: isMobile ? "16px" : "20px 28px" }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
            <div style={{ fontSize:10,color:"#7a99bb",letterSpacing:2 }}>{categories.length} KATEGORIJA</div>
            {canEditCats(currentUser) && <button onClick={openAddCat} style={{ background:"#4fc3f7",color:"#0a0e1a",border:"none",padding:"8px 16px",borderRadius:8,fontWeight:700,fontSize:11,cursor:"pointer" }}>+ NOVA KATEGORIJA</button>}
          </div>

          {categories.length === 0 ? (
            <div style={{ textAlign:"center",padding:"60px 20px",border:"1px dashed #1e3a5f",borderRadius:16 }}>
              <div style={{ fontSize:48,marginBottom:12 }}>📦</div>
              <div style={{ fontSize:11,color:"#3a5a7a",letterSpacing:2,marginBottom:8 }}>NEMA KATEGORIJA</div>
              {canEditCats(currentUser) && <div style={{ fontSize:11,color:"#2a4a6a" }}>Klikni + NOVA KATEGORIJA da počneš</div>}
            </div>
          ) : (
            <div style={{ display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(3,1fr)",gap:12 }}>
              {categories.map(cat => {
                const ci = items.filter(i => i.categoryId === cat.id);
                const low = ci.filter(i => i.minStock>0 && i.quantity<=i.minStock).length;
                const totalQty = ci.reduce((s,i)=>s+i.quantity,0);
                return (
                  <div key={cat.id} className="cat-card" style={{ borderColor: low > 0 ? "rgba(255,170,0,.3)" : "#1a2f4a" }} onClick={() => { setOpenCatId(cat.id); setSearch(""); setExpandedItem(null); }}>
                    {/* Color bar top */}
                    <div style={{ height:4,background:cat.color,borderRadius:"16px 16px 0 0" }} />
                    <div style={{ padding:"16px 14px 14px" }}>
                      {/* Icon + edit/delete */}
                      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10 }}>
                        <div style={{ width:48,height:48,borderRadius:12,background:`${cat.color}22`,border:`2px solid ${cat.color}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24 }}>{cat.icon}</div>
                        {canEditCats(currentUser) && (
                          <div style={{ display:"flex",gap:6 }} onClick={e => e.stopPropagation()}>
                            <button onClick={() => openEditCat(cat)} style={{ width:30,height:30,background:"rgba(79,195,247,.08)",border:"1px solid rgba(79,195,247,.2)",color:"#4fc3f7",borderRadius:8,cursor:"pointer",fontSize:13 }}>✏</button>
                            <button onClick={() => deleteCat(cat.id)} style={{ width:30,height:30,background:"rgba(255,68,68,.08)",border:"1px solid rgba(255,68,68,.2)",color:"#ff6666",borderRadius:8,cursor:"pointer",fontSize:13 }}>✕</button>
                          </div>
                        )}
                      </div>
                      <div style={{ fontWeight:700,color:cat.color,fontSize:15,marginBottom:4,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>{cat.name}</div>
                      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                        <div style={{ fontSize:12,color:"#7a99bb" }}>{ci.length} artikala</div>
                        <div style={{ fontSize:12,color:"#5a7a9a" }}>kol: {totalQty}</div>
                      </div>
                      {low > 0 && (
                        <div style={{ marginTop:8,background:"rgba(255,170,0,.1)",border:"1px solid rgba(255,170,0,.2)",borderRadius:6,padding:"4px 8px",fontSize:10,color:"#ffaa00" }}>⚠️ {low} nizak stock</div>
                      )}
                      {/* Arrow */}
                      <div style={{ marginTop:10,textAlign:"right",color:"#3a5a7a",fontSize:12 }}>otvori →</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════ */}
      {/* INSIDE CATEGORY — articles list */}
      {/* ══════════════════════════════════════════════════════ */}
      {activeTab === "categories" && openCatId && (
        <>
          {/* Search */}
          <div style={{ padding: isMobile?"10px 16px":"12px 28px" }}>
            <div style={{ position:"relative" }}>
              <span style={{ position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",color:"#4fc3f7",fontSize:16 }}>⌕</span>
              <input className="fi" style={{ paddingLeft:38,borderRadius:24 }} placeholder="Pretraži artikle..." value={search} onChange={e=>setSearch(e.target.value)} />
            </div>
          </div>

          <div style={{ padding: isMobile?"0 16px 16px":"0 28px 28px" }}>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12 }}>
              <div style={{ fontSize:10,color:"#7a99bb",letterSpacing:2 }}>{catItems.length} ARTIKALA</div>
              {canEditItems(currentUser) && !isMobile && <button onClick={openAddItem} style={{ background:"#4fc3f7",color:"#0a0e1a",border:"none",padding:"8px 16px",borderRadius:8,fontWeight:700,fontSize:11,cursor:"pointer" }}>+ DODAJ ARTIKAL</button>}
            </div>

            {catItems.length === 0 ? (
              <div style={{ textAlign:"center",padding:"50px 20px",border:"1px dashed #1e3a5f",borderRadius:16 }}>
                <div style={{ fontSize:40,marginBottom:10 }}>{openCat?.icon}</div>
                <div style={{ fontSize:11,color:"#3a5a7a",letterSpacing:2,marginBottom:8 }}>NEMA ARTIKALA</div>
                {canEditItems(currentUser) && <div style={{ fontSize:11,color:"#2a4a6a" }}>{isMobile?"Tapni + da dodaš":"Klikni + DODAJ ARTIKAL"}</div>}
              </div>
            ) : (
              <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
                {catItems.map(item => {
                  const sc = getStockColor(item); const isExp = expandedItem === item.id;
                  return (
                    <div key={item.id} className="item-card" style={{ borderColor: item.minStock>0&&item.quantity<=item.minStock?"rgba(255,170,0,.3)":"#1a2f4a" }} onClick={() => setExpandedItem(isExp?null:item.id)}>
                      {/* Left color accent */}
                      <div style={{ display:"flex",alignItems:"center",gap:12 }}>
                        <div style={{ width:4,height:48,borderRadius:2,background:openCat?.color,flexShrink:0 }} />
                        <div style={{ flex:1,minWidth:0 }}>
                          <div style={{ fontWeight:600,color:"#c8ddf0",fontSize:14,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>{item.name}</div>
                          {item.minStock > 0 && <div style={{ fontSize:10,color:"#5a7a9a",marginTop:2 }}>Min: {item.minStock} {item.unit}</div>}
                        </div>
                        <div style={{ display:"flex",alignItems:"center",gap:8,flexShrink:0 }} onClick={e=>e.stopPropagation()}>
                          {canEditItems(currentUser) && <button className="qc" onClick={()=>adjustQty(item.id,-1)}>−</button>}
                          <div style={{ textAlign:"center",minWidth:46 }}>
                            <div style={{ fontSize:24,fontWeight:700,color:sc,lineHeight:1 }}>{item.quantity}</div>
                            <div style={{ fontSize:10,color:"#7a99bb" }}>{item.unit}</div>
                          </div>
                          {canEditItems(currentUser) && <button className="qc" onClick={()=>adjustQty(item.id,1)}>+</button>}
                        </div>
                        <div style={{ color:"#3a5a7a",fontSize:11,transition:"transform .2s",transform:isExp?"rotate(180deg)":"none",flexShrink:0 }}>▼</div>
                      </div>

                      {item.minStock > 0 && (
                        <div style={{ marginTop:10,paddingLeft:16 }}>
                          <div style={{ background:"#0a0e1a",borderRadius:4,height:3 }}><div style={{ height:"100%",borderRadius:4,background:sc,width:`${Math.min(100,(item.quantity/Math.max(1,item.minStock*2))*100)}%`,transition:"width .4s" }}/></div>
                        </div>
                      )}

                      {isExp && (
                        <div className="exps" onClick={e=>e.stopPropagation()}>
                          {canEditItems(currentUser) && <button className="ac" style={{ background:"rgba(79,195,247,.08)",borderColor:"rgba(79,195,247,.25)",color:"#4fc3f7" }} onClick={()=>{openEditItem(item);setExpandedItem(null);}}>✏ UREDI</button>}
                          {canEditItems(currentUser) && <button className="ac" style={{ background:"rgba(255,68,68,.08)",borderColor:"rgba(255,68,68,.25)",color:"#ff6666" }} onClick={()=>deleteItem(item.id)}>✕ OBRIŠI</button>}
                          {currentUser.role==="korisnik" && <button className="ac" style={{ background:"rgba(255,138,101,.08)",borderColor:"rgba(255,138,101,.25)",color:"#ff8a65" }} onClick={()=>{setShowReqForm(item.id);setReqForm({type:"increase",amount:""});setExpandedItem(null);}}>📬 ZAHTEV</button>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          {canEditItems(currentUser) && isMobile && <button className="fab" onClick={openAddItem}>+</button>}
        </>
      )}

      {/* ══════════════════════════════════════════════════════ */}
      {/* REQUESTS TAB */}
      {/* ══════════════════════════════════════════════════════ */}
      {activeTab === "requests" && canApprove(currentUser) && (
        <div style={{ padding: isMobile?"16px":"20px 28px" }}>
          <div style={{ fontSize:10,color:pendingCount>0?"#ff8a65":"#7a99bb",letterSpacing:2,marginBottom:14 }}>{pendingCount>0?`⏳ ${pendingCount} ZAHTEVA ČEKA`:"✓ NEMA NOVIH ZAHTEVA"}</div>
          {pendingRequests.map(req => {
            const item = items.find(i=>i.id===req.itemId);
            const newQty = item ? Math.max(0,item.quantity+(req.type==="increase"?req.amount:-req.amount)) : "?";
            return (
              <div key={req.id} style={{ background:"#0d1526",border:"1px solid rgba(255,138,101,.3)",borderRadius:14,padding:16,marginBottom:10 }}>
                <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10 }}>
                  <div>
                    <div style={{ fontWeight:600,color:"#c8ddf0",fontSize:14 }}>{req.itemName}</div>
                    <div style={{ fontSize:12,color:"#7a99bb",marginTop:3 }}>Zahtev: <span style={{ color:req.type==="increase"?"#00e676":"#ffaa00",fontWeight:700 }}>{req.type==="increase"?"+":"-"}{req.amount} {req.itemUnit}</span>{item&&<span style={{ color:"#5a7a9a" }}> ({item.quantity} → {newQty})</span>}</div>
                    <div style={{ fontSize:11,color:"#5a7a9a",marginTop:4 }}>👤 {req.requestedBy} · 🕐 {formatTs(req.timestamp).date} {formatTs(req.timestamp).time}</div>
                  </div>
                  <div style={{ display:"flex",gap:8,flexShrink:0 }}>
                    <button onClick={()=>approveRequest(req.id)} style={{ background:"rgba(0,230,118,.1)",border:"1px solid rgba(0,230,118,.3)",color:"#00e676",padding:"8px 14px",borderRadius:8,cursor:"pointer",fontFamily:"inherit",fontSize:12,fontWeight:700 }}>✓</button>
                    <button onClick={()=>rejectRequest(req.id)} style={{ background:"rgba(255,68,68,.08)",border:"1px solid rgba(255,68,68,.2)",color:"#ff6666",padding:"8px 14px",borderRadius:8,cursor:"pointer",fontFamily:"inherit",fontSize:12,fontWeight:700 }}>✕</button>
                  </div>
                </div>
              </div>
            );
          })}
          {requests.filter(r=>r.status!=="pending").length>0&&<>
            <div style={{ fontSize:10,color:"#7a99bb",letterSpacing:2,margin:"16px 0 10px" }}>REŠENI ZAHTEVI</div>
            {[...requests].filter(r=>r.status!=="pending").sort((a,b)=>(b.resolvedAt||0)-(a.resolvedAt||0)).slice(0,20).map(req=>(
              <div key={req.id} style={{ background:"#0d1526",border:`1px solid ${req.status==="approved"?"rgba(0,230,118,.15)":"rgba(255,68,68,.15)"}`,borderRadius:12,padding:"12px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8 }}>
                <div><div style={{ fontSize:13,color:"#c8ddf0" }}>{req.itemName} <span style={{ color:req.type==="increase"?"#00e676":"#ffaa00" }}>{req.type==="increase"?"+":"-"}{req.amount} {req.itemUnit}</span></div><div style={{ fontSize:10,color:"#5a7a9a",marginTop:3 }}>👤 {req.requestedBy} · {formatTs(req.timestamp).date}</div></div>
                <span style={{ fontSize:12,fontWeight:700,color:req.status==="approved"?"#00e676":"#ff6666" }}>{req.status==="approved"?"✓":"✕"}</span>
              </div>
            ))}
          </>}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════ */}
      {/* USERS TAB */}
      {/* ══════════════════════════════════════════════════════ */}
      {activeTab === "users" && canManageUsers(currentUser) && (
        <div style={{ padding: isMobile?"16px":"20px 28px" }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
            <div style={{ fontSize:10,color:"#7a99bb",letterSpacing:2 }}>{users.length} KORISNIKA</div>
            <button onClick={openAddUser} style={{ background:"#FFD700",color:"#0a0e1a",border:"none",padding:"8px 16px",borderRadius:8,fontWeight:700,fontSize:11,cursor:"pointer" }}>+ NOVI</button>
          </div>
          <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
            {[...users].sort((a,b)=>(ROLES[b.role]?.rank||0)-(ROLES[a.role]?.rank||0)).map(u => {
              const ur = ROLES[u.role]||ROLES.korisnik;
              const canEdit = canManageUser(currentUser,u)||u.id===currentUser.id;
              const canDel = canManageUser(currentUser,u)&&u.id!==currentUser.id;
              return (
                <div key={u.id} style={{ background:"#0d1526",border:`1px solid ${u.id===currentUser.id?`${ur.color}44`:"#1a2f4a"}`,borderRadius:14,padding:"14px 16px",display:"flex",alignItems:"center",gap:14 }}>
                  <div style={{ width:46,height:46,borderRadius:12,background:`${ur.color}18`,border:`2px solid ${ur.color}33`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0 }}>{ur.icon}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:600,color:"#c8ddf0",fontSize:14,display:"flex",alignItems:"center",gap:8 }}>{u.name}{u.id===currentUser.id&&<span style={{ fontSize:9,color:"#4fc3f7",border:"1px solid rgba(79,195,247,.3)",borderRadius:10,padding:"1px 7px" }}>TI</span>}</div>
                    <div style={{ display:"flex",alignItems:"center",gap:10,marginTop:4 }}>
                      <span className="rbadge" style={{ background:`${ur.color}18`,color:ur.color,border:`1px solid ${ur.color}33` }}>{ur.label}</span>
                      <span style={{ fontSize:11,color:"#5a7a9a" }}>PIN: {"●".repeat(u.pin?.length||4)}</span>
                    </div>
                  </div>
                  <div style={{ display:"flex",gap:8 }}>
                    {canEdit&&<button onClick={()=>openEditUser(u)} style={{ background:"rgba(79,195,247,.08)",border:"1px solid rgba(79,195,247,.2)",color:"#4fc3f7",padding:"7px 12px",borderRadius:8,cursor:"pointer" }}>✏</button>}
                    {canDel&&<button onClick={()=>deleteUser(u.id)} style={{ background:"rgba(255,68,68,.08)",border:"1px solid rgba(255,68,68,.2)",color:"#ff6666",padding:"7px 12px",borderRadius:8,cursor:"pointer" }}>✕</button>}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop:16,background:"#0d1526",border:"1px solid #1a2f4a",borderRadius:10,padding:"12px 14px" }}>
            {Object.entries(ROLES).reverse().map(([key,r]) => <div key={key} style={{ display:"flex",alignItems:"center",gap:8,marginBottom:6,fontSize:11 }}><span>{r.icon}</span><span style={{ color:r.color,fontWeight:600,minWidth:80 }}>{r.label}</span><span style={{ color:"#5a7a9a" }}>{key==="owner"?"Sve, upravlja adminima":key==="admin"?"Artikli, kat., odobrava zahteve":key==="korisnik"?"Šalje zahteve za promenu":"Samo pregled"}</span></div>)}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════ */}
      {/* HISTORY TAB */}
      {/* ══════════════════════════════════════════════════════ */}
      {activeTab === "history" && canViewReports(currentUser) && (
        <div style={{ padding: isMobile?"16px":"20px 28px" }}>
          <div className="hf" style={{ marginBottom:16 }}>
            {[{key:"sve",label:"Sve",color:"#7a99bb"},{key:"item_add",label:"➕ Dodano",color:"#00e676"},{key:"item_delete",label:"🗑️ Obrisano",color:"#ff4444"},{key:"item_edit",label:"✏️ Izmenjeno",color:"#4fc3f7"},{key:"qty_increase",label:"⬆️ Povećano",color:"#00e676"},{key:"qty_decrease",label:"⬇️ Smanjeno",color:"#ffaa00"},{key:"req_approved",label:"✅ Odobreno",color:"#00e676"},{key:"req_rejected",label:"❌ Odbijeno",color:"#ff4444"}].map(f=>(
              <button key={f.key} className="hc" onClick={()=>setHistoryFilter(f.key)} style={{ borderColor:historyFilter===f.key?f.color:"#1e3a5f",background:historyFilter===f.key?`${f.color}18`:"transparent",color:historyFilter===f.key?f.color:"#7a99bb" }}>{f.label}</button>
            ))}
          </div>
          <div style={{ fontSize:10,color:"#7a99bb",letterSpacing:2,marginBottom:4 }}>{filteredHistory.length} PROMENA</div>
          {filteredHistory.length===0?<div style={{ textAlign:"center",padding:"60px 20px",border:"1px dashed #1e3a5f",borderRadius:16,marginTop:12 }}><div style={{ fontSize:44,marginBottom:12 }}>📋</div><div style={{ fontSize:11,color:"#3a5a7a",letterSpacing:2 }}>NEMA PROMENA</div></div>:Object.entries(groupedHistory).map(([date,entries])=>(
            <div key={date}><div className="dd">{date}</div>
              <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
                {entries.map(entry=>{const meta=ACTION_META[entry.action]||{icon:"•",color:"#7a99bb",label:entry.action};const{time}=formatTs(entry.timestamp);return(<div key={entry.id} className="he"><div style={{ width:36,height:36,borderRadius:10,background:`${meta.color}18`,border:`1px solid ${meta.color}33`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0 }}>{meta.icon}</div><div style={{ flex:1,minWidth:0 }}><div style={{ fontSize:11,color:meta.color,marginBottom:3 }}>{meta.label}</div><div style={{ fontSize:13,color:"#c8ddf0",fontWeight:500,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>{entry.detail}</div><div style={{ display:"flex",gap:10,marginTop:5,fontSize:10,color:"#5a7a9a" }}><span>👤 {entry.user}</span><span>🕐 {time}</span></div></div></div>);})}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════ */}
      {/* REPORTS TAB */}
      {/* ══════════════════════════════════════════════════════ */}
      {activeTab === "reports" && canViewReports(currentUser) && (
        <div style={{ padding: isMobile?"16px":"20px 28px" }}>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:24 }}>
            {[{label:"ARTIKALA",value:items.length,color:"#4fc3f7"},{label:"NIZAK STOCK",value:reportLowStock.length,color:reportLowStock.length>0?"#ffaa00":"#00e676"},{label:"KATEGORIJA",value:categories.length,color:"#ce93d8"}].map((s,i)=>(
              <div key={i} style={{ background:"#0d1526",border:"1px solid #1a2f4a",borderRadius:10,padding:"10px 8px",textAlign:"center" }}><div style={{ fontSize:8,color:"#7a99bb",letterSpacing:1,marginBottom:4 }}>{s.label}</div><div style={{ fontSize:22,fontWeight:700,color:s.color }}>{s.value}</div></div>
            ))}
          </div>

          <div style={{ marginBottom:28 }}>
            <div style={{ fontSize:10,color:"#ffaa00",letterSpacing:2,marginBottom:12 }}>🏷️ ZALIHE PO KATEGORIJI</div>
            <div style={{ background:"#0d1526",border:"1px solid #1a2f4a",borderRadius:12,overflow:"hidden" }}>
              <div style={{ display:"grid",gridTemplateColumns:"1fr 60px 70px 70px",padding:"10px 14px",borderBottom:"1px solid #1a2f4a",fontSize:9,color:"#5a7a9a",letterSpacing:1 }}><div>KATEGORIJA</div><div style={{ textAlign:"right" }}>ART.</div><div style={{ textAlign:"right" }}>KOL.</div><div style={{ textAlign:"right" }}>NIZ. ST.</div></div>
              {reportCatStats.map((cat,idx)=>(
                <div key={cat.id} style={{ display:"grid",gridTemplateColumns:"1fr 60px 70px 70px",padding:"12px 14px",borderBottom:idx<reportCatStats.length-1?"1px solid #0f1e32":"none",alignItems:"center" }}>
                  <div style={{ display:"flex",alignItems:"center",gap:8 }}><div style={{ width:8,height:8,borderRadius:"50%",background:cat.color,boxShadow:`0 0 5px ${cat.color}`,flexShrink:0 }}/><span style={{ fontSize:13,color:cat.color,fontWeight:500 }}>{cat.icon} {cat.name}</span></div>
                  <div style={{ textAlign:"right",fontSize:14,color:"#c8ddf0",fontWeight:600 }}>{cat.itemCount}</div>
                  <div style={{ textAlign:"right",fontSize:14,color:"#4fc3f7",fontWeight:600 }}>{cat.totalQty}</div>
                  <div style={{ textAlign:"right",fontSize:13,fontWeight:600,color:cat.lowStock>0?"#ffaa00":"#00e676" }}>{cat.lowStock}</div>
                </div>
              ))}
              <div style={{ display:"grid",gridTemplateColumns:"1fr 60px 70px 70px",padding:"11px 14px",background:"rgba(79,195,247,.05)",borderTop:"1px solid #1e3a5f",fontSize:12,fontWeight:700 }}>
                <div style={{ color:"#7a99bb",letterSpacing:1 }}>UKUPNO</div>
                <div style={{ textAlign:"right",color:"#c8ddf0" }}>{items.length}</div>
                <div style={{ textAlign:"right",color:"#4fc3f7" }}>{items.reduce((s,i)=>s+i.quantity,0)}</div>
                <div style={{ textAlign:"right",color:reportLowStock.length>0?"#ffaa00":"#00e676" }}>{reportLowStock.length}</div>
              </div>
            </div>
          </div>

          <div style={{ marginBottom:28 }}>
            <div style={{ fontSize:10,color:"#ffaa00",letterSpacing:2,marginBottom:12 }}>⚠️ NIZAK STOCK ({reportLowStock.length})</div>
            {reportLowStock.length===0?<div style={{ fontSize:12,color:"#00e676",padding:"16px",textAlign:"center",border:"1px solid rgba(0,230,118,.2)",borderRadius:10,background:"rgba(0,230,118,.05)" }}>✓ Sve zalihe su uredne!</div>:(
              <div style={{ background:"#0d1526",border:"1px solid rgba(255,170,0,.2)",borderRadius:12,overflow:"hidden" }}>
                <div style={{ display:"grid",gridTemplateColumns:"1fr 60px 60px 60px",padding:"10px 14px",borderBottom:"1px solid #1a2f4a",fontSize:9,color:"#5a7a9a",letterSpacing:1 }}><div>ARTIKAL</div><div style={{ textAlign:"right" }}>IMA</div><div style={{ textAlign:"right" }}>MIN</div><div style={{ textAlign:"right" }}>DEF.</div></div>
                {reportLowStock.map((item,idx)=>{const cat=getCat(item.categoryId);return(<div key={item.id} style={{ padding:"12px 14px",borderBottom:idx<reportLowStock.length-1?"1px solid #0f1e32":"none" }}><div style={{ display:"grid",gridTemplateColumns:"1fr 60px 60px 60px",alignItems:"center",marginBottom:6 }}><div><div style={{ fontSize:13,color:"#c8ddf0",fontWeight:500 }}>{item.name}</div><div style={{ fontSize:10,color:cat.color }}>{cat.icon} {cat.name}</div></div><div style={{ textAlign:"right",fontSize:14,fontWeight:700,color:item.quantity===0?"#ff4444":"#ffaa00" }}>{item.quantity}</div><div style={{ textAlign:"right",fontSize:14,color:"#7a99bb" }}>{item.minStock}</div><div style={{ textAlign:"right",fontSize:14,fontWeight:700,color:"#ff6666" }}>-{item.minStock-item.quantity}</div></div><div style={{ background:"#0a0e1a",borderRadius:4,height:4 }}><div style={{ height:"100%",borderRadius:4,background:item.quantity===0?"#ff4444":"#ffaa00",width:`${Math.min(100,Math.round((item.quantity/item.minStock)*100))}%` }}/></div></div>);})}
              </div>
            )}
          </div>

          <div>
            <div style={{ fontSize:10,color:"#ffaa00",letterSpacing:2,marginBottom:12 }}>👥 AKTIVNOST KORISNIKA</div>
            <div style={{ background:"#0d1526",border:"1px solid #1a2f4a",borderRadius:12,overflow:"hidden" }}>
              <div style={{ display:"grid",gridTemplateColumns:"1fr 44px 44px 44px 44px 50px",padding:"10px 14px",borderBottom:"1px solid #1a2f4a",fontSize:9,color:"#5a7a9a",letterSpacing:1 }}><div>KORISNIK</div><div style={{ textAlign:"center" }}>➕</div><div style={{ textAlign:"center" }}>🗑️</div><div style={{ textAlign:"center" }}>✏️</div><div style={{ textAlign:"center" }}>⬆⬇</div><div style={{ textAlign:"right" }}>UKP.</div></div>
              {userActivityStats.map((u,idx)=>{const ur=ROLES[u.role]||ROLES.korisnik;return(<div key={u.id} style={{ padding:"12px 14px",borderBottom:idx<userActivityStats.length-1?"1px solid #0f1e32":"none" }}><div style={{ display:"grid",gridTemplateColumns:"1fr 44px 44px 44px 44px 50px",alignItems:"center",marginBottom:3 }}><div style={{ display:"flex",alignItems:"center",gap:8 }}><span style={{ fontSize:15 }}>{ur.icon}</span><div><div style={{ fontSize:13,color:"#c8ddf0",fontWeight:500 }}>{u.name}</div><span style={{ fontSize:9,color:ur.color }}>{ur.label}</span></div></div><div style={{ textAlign:"center",fontSize:13,color:u.adds>0?"#00e676":"#3a5a7a",fontWeight:u.adds>0?700:400 }}>{u.adds}</div><div style={{ textAlign:"center",fontSize:13,color:u.deletes>0?"#ff6666":"#3a5a7a",fontWeight:u.deletes>0?700:400 }}>{u.deletes}</div><div style={{ textAlign:"center",fontSize:13,color:u.edits>0?"#4fc3f7":"#3a5a7a",fontWeight:u.edits>0?700:400 }}>{u.edits}</div><div style={{ textAlign:"center",fontSize:13,color:u.qtyChanges>0?"#ffaa00":"#3a5a7a",fontWeight:u.qtyChanges>0?700:400 }}>{u.qtyChanges}</div><div style={{ textAlign:"right",fontSize:15,fontWeight:700,color:u.total>0?"#e0e8f0":"#3a5a7a" }}>{u.total}</div></div>{u.lastAction&&<div style={{ fontSize:10,color:"#3a5a7a",paddingLeft:26 }}>Poslednja: {u.lastAction.date} {u.lastAction.time}</div>}</div>);})}
            </div>
          </div>
        </div>
      )}

      {/* Bottom Nav */}
      {isMobile && (
        <div className="bnav">
          {tabs.map(t=><div key={t.id} className="nitem" onClick={()=>{setActiveTab(t.id);if(t.id!=="categories")setOpenCatId(null);}}><span style={{ fontSize:18 }}>{t.icon}</span><span style={{ fontSize:8,color:activeTab===t.id?"#4fc3f7":"#7a99bb" }}>{t.label}</span>{t.badge>0&&<span className="badge">{t.badge}</span>}</div>)}
          <div className="nitem" onClick={()=>setCurrentUser(null)}><span style={{ fontSize:18 }}>⏏</span><span style={{ fontSize:8,color:"#7a99bb" }}>ODJAVA</span></div>
        </div>
      )}

      {/* ══════ MODALS ══════ */}

      {showItemForm && (
        <div className="mbg" onClick={()=>setShowItemForm(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div style={{ width:36,height:4,background:"#2a4a6a",borderRadius:2,margin:"0 auto 18px",display:isMobile?"block":"none" }}/>
            <div style={{ fontSize:10,letterSpacing:3,color:"#4fc3f7",marginBottom:5 }}>{editItem?"UREDI ARTIKAL":"NOVI ARTIKAL"}</div>
            <div style={{ height:1,background:"#1e3a5f",marginBottom:18 }}/>
            {openCat && <div style={{ display:"flex",alignItems:"center",gap:10,background:"#0a0e1a",borderRadius:10,padding:"10px 14px",marginBottom:16,border:`1px solid ${openCat.color}33` }}><span style={{ fontSize:20 }}>{openCat.icon}</span><span style={{ color:openCat.color,fontWeight:600 }}>{openCat.name}</span></div>}
            <div style={{ marginBottom:14 }}><label className="fl">NAZIV *</label><input className="fi" value={itemForm.name} onChange={e=>setItemForm({...itemForm,name:e.target.value})} placeholder="npr. LED traka 5m"/></div>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14 }}>
              <div><label className="fl">KOLIČINA *</label><input className="fi" type="number" min="0" inputMode="numeric" value={itemForm.quantity} onChange={e=>setItemForm({...itemForm,quantity:e.target.value})} placeholder="0"/></div>
              <div><label className="fl">JEDINICA</label><select className="fi" value={itemForm.unit} onChange={e=>setItemForm({...itemForm,unit:e.target.value})}>{UNITS.map(u=><option key={u} value={u}>{u}</option>)}</select></div>
            </div>
            <div style={{ marginBottom:22 }}><label className="fl">MIN. ZALIHA</label><input className="fi" type="number" min="0" inputMode="numeric" value={itemForm.minStock} onChange={e=>setItemForm({...itemForm,minStock:e.target.value})} placeholder="0"/></div>
            <div style={{ display:"flex",gap:10 }}>
              <button onClick={submitItemForm} style={{ flex:1,background:"#4fc3f7",color:"#0a0e1a",border:"none",padding:"14px",borderRadius:10,fontWeight:700,fontSize:14,cursor:"pointer" }}>{editItem?"✓ SAČUVAJ":"+ DODAJ"}</button>
              <button onClick={()=>setShowItemForm(false)} style={{ background:"rgba(255,68,68,.1)",border:"1px solid rgba(255,68,68,.25)",color:"#ff6666",padding:"14px 18px",borderRadius:10,cursor:"pointer",fontSize:16 }}>✕</button>
            </div>
          </div>
        </div>
      )}

      {showReqForm && (
        <div className="mbg" onClick={()=>setShowReqForm(null)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div style={{ width:36,height:4,background:"#2a4a6a",borderRadius:2,margin:"0 auto 18px",display:isMobile?"block":"none" }}/>
            <div style={{ fontSize:10,letterSpacing:3,color:"#ff8a65",marginBottom:5 }}>POŠALJI ZAHTEV</div>
            <div style={{ height:1,background:"#1e3a5f",marginBottom:18 }}/>
            {(()=>{const item=items.find(i=>i.id===showReqForm);return item?(<>
              <div style={{ background:"#0a0e1a",borderRadius:10,padding:"12px 14px",marginBottom:18 }}><div style={{ fontSize:13,color:"#c8ddf0",fontWeight:600 }}>{item.name}</div><div style={{ fontSize:12,color:"#7a99bb",marginTop:4 }}>Na stanju: <span style={{ color:getStockColor(item),fontWeight:700 }}>{item.quantity} {item.unit}</span></div></div>
              <div style={{ marginBottom:14 }}><label className="fl">TIP</label><div style={{ display:"flex",gap:10 }}>{["increase","decrease"].map(t=>(<button key={t} onClick={()=>setReqForm({...reqForm,type:t})} style={{ flex:1,padding:"11px",borderRadius:10,border:`1.5px solid ${reqForm.type===t?(t==="increase"?"#00e676":"#ffaa00"):"#1e3a5f"}`,background:reqForm.type===t?(t==="increase"?"rgba(0,230,118,.1)":"rgba(255,170,0,.1)"):"transparent",color:reqForm.type===t?(t==="increase"?"#00e676":"#ffaa00"):"#7a99bb",cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:600 }}>{t==="increase"?"⬆️ Povećaj":"⬇️ Smanji"}</button>))}</div></div>
              <div style={{ marginBottom:22 }}><label className="fl">KOLIČINA *</label><input className="fi" type="number" min="1" inputMode="numeric" value={reqForm.amount} onChange={e=>setReqForm({...reqForm,amount:e.target.value})} placeholder={`npr. 5 ${item.unit}`}/></div>
              <div style={{ display:"flex",gap:10 }}><button onClick={submitRequest} style={{ flex:1,background:"#ff8a65",color:"#0a0e1a",border:"none",padding:"14px",borderRadius:10,fontWeight:700,fontSize:14,cursor:"pointer" }}>📬 POŠALJI</button><button onClick={()=>setShowReqForm(null)} style={{ background:"rgba(255,68,68,.1)",border:"1px solid rgba(255,68,68,.25)",color:"#ff6666",padding:"14px 18px",borderRadius:10,cursor:"pointer",fontSize:16 }}>✕</button></div>
            </>):null;})()}
          </div>
        </div>
      )}

      {showCatForm && (
        <div className="mbg" onClick={()=>setShowCatForm(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div style={{ width:36,height:4,background:"#2a4a6a",borderRadius:2,margin:"0 auto 18px",display:isMobile?"block":"none" }}/>
            <div style={{ fontSize:10,letterSpacing:3,color:"#4fc3f7",marginBottom:5 }}>{editCat?"UREDI KATEGORIJU":"NOVA KATEGORIJA"}</div>
            <div style={{ height:1,background:"#1e3a5f",marginBottom:18 }}/>
            <div style={{ display:"flex",alignItems:"center",gap:12,background:"#0a0e1a",borderRadius:12,padding:"12px 16px",marginBottom:18,border:`1px solid ${catForm.color}44` }}><div style={{ width:44,height:44,borderRadius:12,background:`${catForm.color}22`,border:`2px solid ${catForm.color}55`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22 }}>{catForm.icon}</div><div style={{ fontWeight:600,color:catForm.color,fontSize:14 }}>{catForm.name||"Naziv kategorije"}</div></div>
            <div style={{ marginBottom:14 }}><label className="fl">NAZIV *</label><input className="fi" value={catForm.name} onChange={e=>setCatForm({...catForm,name:e.target.value})} placeholder="npr. Rezervni delovi"/></div>
            <div style={{ marginBottom:14 }}><label className="fl">BOJA</label><div style={{ display:"flex",gap:8,flexWrap:"wrap" }}>{CAT_COLORS.map(c=><div key={c} className={`csw ${catForm.color===c?"sel":""}`} style={{ background:c }} onClick={()=>setCatForm({...catForm,color:c})}/>)}</div></div>
            <div style={{ marginBottom:22 }}><label className="fl">IKONICA</label><div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>{CAT_ICONS.map(ic=><button key={ic} className={`ibtn ${catForm.icon===ic?"sel":""}`} onClick={()=>setCatForm({...catForm,icon:ic})}>{ic}</button>)}</div></div>
            <div style={{ display:"flex",gap:10 }}><button onClick={submitCatForm} style={{ flex:1,background:"#4fc3f7",color:"#0a0e1a",border:"none",padding:"14px",borderRadius:10,fontWeight:700,fontSize:14,cursor:"pointer" }}>{editCat?"✓ SAČUVAJ":"+ DODAJ"}</button><button onClick={()=>setShowCatForm(false)} style={{ background:"rgba(255,68,68,.1)",border:"1px solid rgba(255,68,68,.25)",color:"#ff6666",padding:"14px 18px",borderRadius:10,cursor:"pointer",fontSize:16 }}>✕</button></div>
          </div>
        </div>
      )}

      {showUserForm && (
        <div className="mbg" onClick={()=>setShowUserForm(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div style={{ width:36,height:4,background:"#2a4a6a",borderRadius:2,margin:"0 auto 18px",display:isMobile?"block":"none" }}/>
            <div style={{ fontSize:10,letterSpacing:3,color:"#FFD700",marginBottom:5 }}>{editUser?"UREDI KORISNIKA":"NOVI KORISNIK"}</div>
            <div style={{ height:1,background:"#1e3a5f",marginBottom:18 }}/>
            <div style={{ marginBottom:14 }}><label className="fl">IME *</label><input className="fi" value={userForm.name} onChange={e=>setUserForm({...userForm,name:e.target.value})} placeholder="npr. Marko"/></div>
            <div style={{ marginBottom:14 }}><label className="fl">PIN (4 cifre) *</label><input className="fi" type="password" inputMode="numeric" maxLength={4} value={userForm.pin} onChange={e=>setUserForm({...userForm,pin:e.target.value.replace(/\D/g,"").slice(0,4)})} placeholder="••••" style={{ letterSpacing:8,fontSize:20,textAlign:"center" }}/></div>
            <div style={{ marginBottom:22 }}>
              <label className="fl">ULOGA</label>
              <div style={{ display:"flex",gap:8,flexWrap:"wrap" }}>
                {Object.entries(ROLES).filter(([key])=>currentUser.role==="owner"?key!=="owner":key==="korisnik"||key==="preglodac").map(([key,r])=>(
                  <button key={key} onClick={()=>setUserForm({...userForm,role:key})} style={{ flex:1,minWidth:80,padding:"10px 8px",borderRadius:10,border:`1.5px solid ${userForm.role===key?r.color:"#1e3a5f"}`,background:userForm.role===key?`${r.color}18`:"transparent",color:userForm.role===key?r.color:"#7a99bb",cursor:"pointer",fontFamily:"inherit",fontSize:12,fontWeight:600 }}>{r.icon} {r.label}</button>
                ))}
              </div>
            </div>
            <div style={{ display:"flex",gap:10 }}><button onClick={submitUserForm} style={{ flex:1,background:"#FFD700",color:"#0a0e1a",border:"none",padding:"14px",borderRadius:10,fontWeight:700,fontSize:14,cursor:"pointer" }}>{editUser?"✓ SAČUVAJ":"+ DODAJ"}</button><button onClick={()=>setShowUserForm(false)} style={{ background:"rgba(255,68,68,.1)",border:"1px solid rgba(255,68,68,.25)",color:"#ff6666",padding:"14px 18px",borderRadius:10,cursor:"pointer",fontSize:16 }}>✕</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
