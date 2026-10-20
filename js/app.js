// =====================================================================
//  một lời chúc — app
//  Không có bước build. Cấu hình nằm ở js/config.js.
//  Chạy DEMO khi supabaseUrl còn là "YOUR_..." (dữ liệu lưu trong trình duyệt, OTP = 123456).
// =====================================================================
(() => {
  "use strict";

  const C = window.APP_CONFIG;
  const DEMO = !C.supabaseUrl || C.supabaseUrl.startsWith("YOUR_");
  const ADMIN_ID = "__admin";
  const ADMIN_LABEL = C.adminLabel || "Admin";
  const MSG_MAX = 1000;
  const NAME_MAX = 60;
  const SEND_COOLDOWN_MS = 15_000;
  const RESEND_SECONDS = 60;
  const DEMO_OTP = "123456";
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const hasGsap = !!(window.gsap && window.ScrollTrigger);

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const pad = (n) => String(n).padStart(2, "0");
  const fmtShort = (iso) => { const d = new Date(iso); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}, ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const fmtFull = (iso) => { const d = new Date(iso); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* bỏ qua */ } },
    del(k) { try { localStorage.removeItem(k); } catch { /* bỏ qua */ } },
  };

  const TINTS = ["var(--tint-1)", "var(--tint-3)", "var(--tint-4)", "var(--tint-2)"];
  const members = C.members.map((m, i) => ({ ...m, tint: TINTS[i % TINTS.length] }));
  const byId = Object.fromEntries(members.map((m) => [m.id, m]));
  const shown = members.filter((m) => !m.hidden); // người ẩn (Tester) chỉ có trong dropdown gửi lời chúc
  const hiddenLabel = (m) => esc(m.name) + (m.hidden ? " (ẩn)" : "");

  // =================================================================
  //  API — 2 chế độ: DEMO (localStorage) và Supabase
  // =================================================================
  function createDemoApi() {
    const K = { wishes: "mlc-demo-wishes", session: "mlc-demo-session", pending: "mlc-demo-pending" };
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const all = () => store.get(K.wishes, []);
    return {
      async counts() {
        await wait(120);
        const c = {};
        for (const w of all()) c[w.recipient_id] = (c[w.recipient_id] || 0) + 1;
        return c;
      },
      async sendWishes(rows) {
        await wait(350);
        if (rows.some((r) => !byId[r.recipient_id])) throw new Error("new row violates row-level security policy");
        const now = new Date().toISOString();
        const uid = () => (crypto.randomUUID && crypto.randomUUID()) || String(Date.now() + Math.random());
        store.set(K.wishes, [...all(), ...rows.map((r) => ({ id: uid(), ...r, created_at: now }))]);
      },
      async requestOtp(email, pickId) {
        await wait(450);
        store.set(K.pending, { email, pickId });
      },
      async verifyOtp(email, token) {
        await wait(350);
        if (token !== DEMO_OTP) throw new Error("Token has expired or is invalid");
        const p = store.get(K.pending, {});
        const adminTile = p.pickId === ADMIN_ID;
        // Giống bản thật: email của người ẩn đăng nhập qua ô admin nhưng vào hộp thư của người đó
        const hiddenMember = adminTile ? members.find((m) => m.hidden && matchesHint(email, m.emailHint)) : null;
        const s = hiddenMember
          ? { email, memberId: hiddenMember.id, isAdmin: false }
          : { email, memberId: adminTile ? null : p.pickId || null, isAdmin: adminTile };
        store.set(K.session, s);
        return s;
      },
      async getSession() { return store.get(K.session, null); },
      async listWishes(s) {
        await wait(200);
        const list = s.isAdmin ? all() : all().filter((w) => w.recipient_id === s.memberId);
        return list.sort((a, b) => b.created_at.localeCompare(a.created_at));
      },
      async signOut() { store.del(K.session); },
    };
  }

  function createSupabaseApi() {
    const sb = window.supabase.createClient(C.supabaseUrl, C.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    });
    // Người đăng nhập là ai: lấy từ DB (RLS), không tin vào ô đã chọn trên giao diện
    async function identity(email) {
      const [mid, adm] = await Promise.all([sb.rpc("my_member_id"), sb.rpc("is_admin")]);
      if (mid.error) throw mid.error;
      if (adm.error) throw adm.error;
      return { email, memberId: mid.data || null, isAdmin: !!adm.data };
    }
    return {
      async counts() {
        const { data, error } = await sb.rpc("wish_counts");
        if (error) throw error;
        const c = {};
        for (const r of data || []) c[r.recipient_id] = Number(r.total) || 0;
        return c;
      },
      async sendWishes(rows) {
        // Một câu insert cho cả mảng: lỗi 1 dòng thì không dòng nào được ghi.
        // Không .select() sau insert: anon không có quyền đọc bảng wishes
        const { error } = await sb.from("wishes").insert(rows);
        if (error) throw error;
      },
      async requestOtp(email) {
        const { error } = await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
        if (error) throw error;
      },
      async verifyOtp(email, token) {
        const { data, error } = await sb.auth.verifyOtp({ email, token, type: "email" });
        if (error) throw error;
        return identity(data.user?.email || email);
      },
      async getSession() {
        const { data } = await sb.auth.getSession();
        const email = data.session?.user?.email;
        return email ? identity(email) : null;
      },
      async listWishes() {
        const { data, error } = await sb.from("wishes")
          .select("id, recipient_id, sender_name, message, created_at")
          .order("created_at", { ascending: false });
        if (error) throw error;
        return data || [];
      },
      async signOut() { await sb.auth.signOut(); },
    };
  }

  let api = null;
  try {
    api = DEMO ? createDemoApi() : createSupabaseApi();
  } catch (e) {
    console.error("Không khởi tạo được Supabase:", e);
  }

  // Việt hoá lỗi Supabase / mạng
  function viError(e) {
    const m = String(e?.message || e || "").toLowerCase();
    const status = e?.status;
    if (m.includes("signups not allowed") || m.includes("signup is disabled") || m.includes("user not found"))
      return "Email này chưa có trong danh sách chị em. Kiểm tra lại theo gợi ý nhé.";
    if (status === 429 || m.includes("rate limit") || m.includes("security purposes") || m.includes("too many"))
      return "Bạn thao tác hơi nhanh. Đợi khoảng một phút rồi thử lại nhé.";
    if (m.includes("expired") || m.includes("invalid") || m.includes("token"))
      return "Mã không đúng hoặc đã hết hạn. Hãy dùng mã trong email mới nhất.";
    if (m.includes("row-level security") || m.includes("violates"))
      return "Không gửi được: người nhận không hợp lệ.";
    if (m.includes("failed to fetch") || m.includes("network") || m.includes("load failed"))
      return "Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.";
    return "Có lỗi xảy ra. Thử lại sau ít phút nhé.";
  }

  // =================================================================
  //  Tiện ích giao diện
  // =================================================================
  function avatar(m, { badge = true } = {}) {
    const src = m.photo || `assets/avatars/${m.id}.svg`;
    return `<span class="av" style="--tint:${m.tint}" data-initial="${esc(m.name.trim().split(/\s+/).pop()[0] || "?")}">` +
      `<img src="${esc(src)}" alt="" loading="lazy" decoding="async">` +
      (badge && m.badge ? `<span class="badge" aria-hidden="true">${esc(m.badge)}</span>` : "") +
      `</span>`;
  }
  // Ảnh lỗi → chữ cái đầu
  document.addEventListener("error", (e) => {
    const img = e.target;
    if (!(img instanceof HTMLImageElement) || !img.parentElement?.classList.contains("av")) return;
    const av = img.parentElement;
    av.classList.add("av-initial");
    img.replaceWith(document.createTextNode(av.dataset.initial || "?"));
  }, true);

  const flowerSvg = (size = 24) => `<svg aria-hidden="true" style="width:${size}px;height:${size}px"><use href="#flower"/></svg>`;

  let toastTimer;
  function toast(msg, type = "ok") {
    const t = $("#toast");
    t.className = "toast" + (type === "error" ? " error" : "");
    t.innerHTML = `<i aria-hidden="true">${type === "error" ? "!" : "✓"}</i><span>${esc(msg)}</span>`;
    t.hidden = false;
    if (hasGsap && !reduceMotion) gsap.fromTo(t, { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: .35, ease: "power3.out" });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 3600);
  }

  function showErr(el, msg) { el.textContent = msg || ""; el.hidden = !msg; }

  function setBusy(btn, busy, label) {
    if (busy) { btn.dataset.label = btn.textContent; btn.textContent = label; btn.disabled = true; }
    else { btn.textContent = btn.dataset.label || btn.textContent; btn.disabled = false; }
  }

  function celebrate() {
    if (typeof window.confetti !== "function" || reduceMotion) return;
    const colors = ["#756AB6", "#AC87C5", "#E0AED0", "#FFE5E5", "#17131f"];
    const base = { colors, disableForReducedMotion: true, zIndex: 90, ticks: 220 };
    confetti({ ...base, particleCount: 110, spread: 80, startVelocity: 42, origin: { y: .72 } });
    setTimeout(() => {
      confetti({ ...base, particleCount: 50, angle: 60, spread: 60, origin: { x: 0, y: .8 } });
      confetti({ ...base, particleCount: 50, angle: 120, spread: 60, origin: { x: 1, y: .8 } });
    }, 180);
  }

  // Pháo hoa: nổ tròn chậm rãi, xen kẽ hai bên màn hình, thưa dần trong `ms`.
  // Trả về hàm dừng bắn.
  function fireworks(ms = 5000) {
    if (typeof window.confetti !== "function" || reduceMotion) return () => {};
    const colors = ["#E0AED0", "#AC87C5", "#FFE5E5", "#ffffff", "#f6c1d9", "#c9b8ff"];
    const rand = (a, b) => a + Math.random() * (b - a);
    const end = Date.now() + ms;
    const burst = (x) => confetti({
      particleCount: Math.round(45 + 40 * Math.max(0, end - Date.now()) / ms),
      startVelocity: rand(16, 24), spread: 360, ticks: 170, gravity: .5, decay: .935,
      scalar: rand(.9, 1.3), shapes: ["circle", "star"], colors, zIndex: 90,
      origin: { x, y: rand(.12, .42) },
      disableForReducedMotion: true,
    });
    let side = 0;
    const tick = () => {
      if (Date.now() >= end) { clearInterval(timer); return; }
      side = 1 - side;
      burst(side ? rand(.1, .35) : rand(.65, .9));
      if (Math.random() < .3) setTimeout(() => burst(rand(.4, .6)), 260);
    };
    const timer = setInterval(tick, 620);
    tick();
    return () => clearInterval(timer);
  }

  // Màn hình tối dần → chữ chúc mừng + pháo hoa → hỏi "Thêm 1 lần nữa" → lặp lại.
  // Chỉ thoát bằng nút ✕ hoặc phím Esc.
  function nightFireworks(ms = 5000) {
    const FADE = 1600;    // khớp transition của .night trong CSS
    const SETTLE = 1800;  // chờ hạt cuối rơi hết rồi mới hỏi
    const night = document.createElement("div");
    night.className = "night";
    night.innerHTML =
      `<div class="night-stage" aria-live="polite">` +
      `<div class="night-msg" data-scene="greet"><span>Chúc mừng ngày phụ nữ Việt Nam</span><b>20/10</b></div>` +
      `<div class="night-msg night-ask" data-scene="ask" inert><span>Đã đủ vui chưa?</span>` +
      `<small>Chưa đủ vui à?</small><button class="night-again" type="button">Thêm 1 lần nữa</button></div>` +
      `</div>` +
      `<button class="night-x" type="button" aria-label="Tắt pháo hoa">×</button>`;
    document.body.appendChild(night);

    let stop = () => {};
    let closed = false;
    let timers = [];
    const later = (fn, t) => timers.push(setTimeout(fn, t));
    const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };

    function scene(name) {
      night.dataset.scene = name || "";
      $$(".night-msg", night).forEach((el) => { el.inert = el.dataset.scene !== name; });
    }
    function round() {
      clearTimers();
      stop();
      scene("greet");
      stop = fireworks(ms);
      later(() => {
        scene("ask");
        setTimeout(() => night.querySelector(".night-again").focus({ preventScroll: true }), 500);
      }, ms + SETTLE);
    }

    const onKey = (e) => { if (e.key === "Escape" && $("#send-modal").hidden) close(); };
    function close() {
      if (closed) return;
      closed = true;
      clearTimers();
      stop();
      if (typeof window.confetti?.reset === "function") confetti.reset();
      document.removeEventListener("keydown", onKey);
      night.classList.add("leaving");
      night.classList.remove("on");
      setTimeout(() => night.remove(), 700);
    }
    night.querySelector(".night-x").addEventListener("click", close);
    night.querySelector(".night-again").addEventListener("click", round);
    document.addEventListener("keydown", onKey);

    scene("");
    requestAnimationFrame(() => requestAnimationFrame(() => night.classList.add("on")));
    later(round, FADE * .8);
  }

  // Chạm đáy trang lần đầu (mỗi lần tải trang) → bắn pháo hoa
  function setupFooterFireworks() {
    if (!("IntersectionObserver" in window) || reduceMotion) return;
    const end = document.createElement("div");
    end.setAttribute("aria-hidden", "true");
    end.style.height = "1px";
    $(".ftr").appendChild(end);
    const io = new IntersectionObserver(([en]) => {
      if (!en.isIntersecting) return;
      io.disconnect();
      nightFireworks(5000);
    });
    io.observe(end);
  }

  // =================================================================
  //  Render nội dung tĩnh
  // =================================================================
  const ORBIT = [ // [left %, top %, kích thước px] theo thứ tự members
    [50, 9, 104], [88, 30, 92], [90, 72, 96], [60, 92, 100], [20, 85, 88], [9, 45, 98], [26, 14, 84],
  ];

  function renderStatic() {
    $$("[data-site-name]").forEach((el) => { el.textContent = C.siteName; });
    $$("[data-occasion]").forEach((el) => { el.textContent = C.occasion; });

    $("#hero-stack").innerHTML = shown.slice(0, 5).map((m) => avatar(m, { badge: false })).join("");
    $("#orbit").insertAdjacentHTML("beforeend", shown.map((m, i) => {
      const [x, y, s] = ORBIT[i % ORBIT.length];
      return `<div class="o" style="left:${x}%;top:${y}%;--os:${s}px">` +
        `<button class="o-in" type="button" data-send="${esc(m.id)}" aria-label="Gửi lời chúc tới ${esc(m.name)}">` +
        `${avatar(m)}<span class="nm">${esc(m.name)}</span></button></div>`;
    }).join(""));

    $("#main-title").textContent = C.mainWish.title;
    $("#main-body").innerHTML = C.mainWish.body.split(/\s+/).map((w) => `<span class="w">${esc(w)}</span>`).join(" ");
    $("#main-sig").textContent = C.mainWish.signature;

    $("#subs").innerHTML = C.subWishes.map((s, i) =>
      `<article class="sub glass" style="--tint:${TINTS[i % TINTS.length]}">` +
      `<span class="ic" aria-hidden="true">${esc(s.icon)}</span><h3>${esc(s.title)}</h3><p>${esc(s.text)}</p></article>`).join("");

    $("#members").innerHTML = shown.map((m) =>
      `<article class="mem glass">${avatar(m)}<h3>${esc(m.name)}</h3>` +
      `<div class="nick">${m.nickname ? "“" + esc(m.nickname) + "”" : ""}</div>` +
      `<div class="count"><b data-count="${esc(m.id)}">–</b> lời chúc</div>` +
      `<button class="btn btn-dark btn-sm" type="button" data-send="${esc(m.id)}">Gửi lời chúc</button></article>`).join("") +
      `<article class="mem glass more">${flowerSvg(40)}<b>Bạn là một trong 7 chị em?</b>` +
      `<p>Mở hộp thư để đọc lời chúc gửi mình.</p><a class="btn btn-ghost btn-sm" href="#hop-thu">Mở hộp thư</a></article>`;

    $("#pick").innerHTML = shown.map((m) =>
      `<button type="button" role="radio" aria-checked="false" data-pick="${esc(m.id)}">${avatar(m, { badge: false })}${esc(m.name)}</button>`).join("") +
      `<button type="button" role="radio" aria-checked="false" data-pick="${ADMIN_ID}"><span class="admin-ic" aria-hidden="true">★</span>${esc(ADMIN_LABEL)}</button>`;

    $("#send-to").innerHTML = members.map((m) =>
      `<label class="to-opt"><input type="checkbox" value="${esc(m.id)}">${avatar(m, { badge: false })}` +
      `<span class="nm">${esc(m.name)}</span><span class="tick" aria-hidden="true">✓</span></label>`).join("");

    if (DEMO) $("#demo-pill").hidden = false;
  }

  // =================================================================
  //  Số lời chúc
  // =================================================================
  let counts = {};
  function renderCounts() {
    let total = 0;
    for (const m of members) {
      const n = counts[m.id] || 0;
      if (!m.hidden) total += n; // lời chúc gửi người ẩn không tính vào tổng công khai
      $$(`[data-count="${m.id}"]`).forEach((el) => { el.textContent = n; });
    }
    $("#hero-total").innerHTML = total
      ? `<b>${total} lời chúc</b> đã được gửi`
      : "Chưa có lời chúc nào. Bạn gửi lời đầu tiên nhé.";
  }
  async function refreshCounts() {
    if (!api) return;
    try { counts = await api.counts(); renderCounts(); }
    catch (e) { console.warn("wish_counts:", e); $("#hero-total").textContent = "Cả phòng đang gửi lời chúc"; }
  }

  // =================================================================
  //  Modal gửi lời chúc
  // =================================================================
  const LAST_SEND_KEY = "mlc-last-send";
  let lastFocus = null;
  let cooldownTimer = null;

  const toBoxes = () => $$("#send-to input");
  const selectedTo = () => toBoxes().filter((i) => i.checked && byId[i.value]).map((i) => i.value);
  // "Gửi tất cả" = 7 chị em đang hiển thị (không gồm người ẩn)
  const isAllShown = (ids) => shown.every((m) => ids.includes(m.id));
  function joinNames(names) {
    return names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} và ${names[names.length - 1]}`;
  }
  function recipientsLabel(ids) {
    if (ids.length === shown.length && isAllShown(ids)) return `cả ${shown.length} chị em`;
    return ids.length <= 3 ? joinNames(ids.map((id) => byId[id].name)) : `${ids.length} người`;
  }

  function updateSendHeader() {
    const ids = selectedTo();
    const all = $("#send-all");
    const shownPicked = shown.filter((m) => ids.includes(m.id)).length;
    all.checked = shownPicked === shown.length;
    all.indeterminate = shownPicked > 0 && shownPicked < shown.length;
    $("#send-to-n").textContent = ids.length ? `· đã chọn ${ids.length}` : "· chọn một hoặc nhiều người";

    const m = ids.length === 1 ? byId[ids[0]] : null;
    $("#send-av").innerHTML = m ? avatar(m, { badge: false })
      : ids.length ? `<span class="stack">${ids.slice(0, 3).map((id) => avatar(byId[id], { badge: false })).join("")}</span>`
      : `<span class="av" style="--tint:var(--tint-2);display:grid;place-items:center">${flowerSvg(28)}</span>`;
    const label = recipientsLabel(ids);
    $("#send-title").textContent = ids.length ? label.charAt(0).toUpperCase() + label.slice(1) : "Chọn người nhận";
    $("#send-note").textContent = m ? `Chỉ ${m.name} đọc được lời chúc này.`
      : ids.length ? "Mỗi người nhận một bản, chỉ đọc được bản gửi mình." : "Chỉ người nhận đọc được lời chúc.";
  }
  function updateSendCount() {
    const n = $("#send-msg").value.length;
    $("#send-count").textContent = `${n} / ${MSG_MAX}`;
  }
  function cooldownLeft() { return Math.max(0, store.get(LAST_SEND_KEY, 0) + SEND_COOLDOWN_MS - Date.now()); }
  function tickCooldown() {
    const btn = $("#send-btn");
    const left = cooldownLeft();
    if (btn.dataset.busy) return;
    if (left > 0) { btn.disabled = true; btn.textContent = `Chờ ${Math.ceil(left / 1000)} giây`; }
    else { btn.disabled = false; btn.textContent = "Gửi lời chúc"; clearInterval(cooldownTimer); cooldownTimer = null; }
  }
  function startCooldownTicker() {
    tickCooldown();
    if (!cooldownTimer && cooldownLeft() > 0) cooldownTimer = setInterval(tickCooldown, 250);
  }

  function openSend(id) {
    lastFocus = document.activeElement;
    if (id && byId[id]) toBoxes().forEach((i) => { i.checked = i.value === id; });
    updateSendHeader();
    updateSendCount();
    showErr($("#send-err"), "");
    $("#send-to").removeAttribute("aria-invalid");
    $("#send-modal").hidden = false;
    document.body.classList.add("modal-open");
    startCooldownTicker();
    if (hasGsap && !reduceMotion) {
      gsap.fromTo("#send-modal", { opacity: 0 }, { opacity: 1, duration: .25 });
      gsap.fromTo("#send-form", { y: 30, scale: .98 }, { y: 0, scale: 1, duration: .45, ease: "power3.out" });
    }
    setTimeout(() => (selectedTo().length ? $("#send-msg") : toBoxes()[0]).focus(), 60);
  }
  function closeSend() {
    $("#send-modal").hidden = true;
    document.body.classList.remove("modal-open");
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
  }

  function setupSend() {
    document.addEventListener("click", (e) => {
      const t = e.target.closest("[data-send]");
      if (t) { openSend(t.dataset.send); return; }
      if (e.target.closest("[data-open-send]")) { openSend(null); return; }
      if (e.target.closest("[data-close]")) closeSend();
    });
    $("#send-modal").addEventListener("click", (e) => { if (e.target.id === "send-modal") closeSend(); });
    document.addEventListener("keydown", (e) => {
      if ($("#send-modal").hidden) return;
      if (e.key === "Escape") { closeSend(); return; }
      if (e.key === "Tab") { // giữ focus trong modal
        const f = $$('button:not([disabled]), input, select, textarea', $("#send-form"));
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
    $("#send-to").addEventListener("change", () => { updateSendHeader(); $("#send-to").removeAttribute("aria-invalid"); });
    $("#send-all").addEventListener("change", (e) => {
      const on = e.target.checked;
      toBoxes().forEach((i) => { if (!byId[i.value].hidden) i.checked = on; });
      updateSendHeader();
      $("#send-to").removeAttribute("aria-invalid");
    });
    $("#send-msg").addEventListener("input", () => { updateSendCount(); $("#send-msg").removeAttribute("aria-invalid"); });

    $("#send-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const err = $("#send-err");
      const to = selectedTo();
      const name = $("#send-name").value.trim().slice(0, NAME_MAX);
      const msg = $("#send-msg").value.trim();
      if (!to.length) { $("#send-to").setAttribute("aria-invalid", "true"); showErr(err, "Chọn ít nhất một người nhận nhé."); toBoxes()[0].focus(); return; }
      if (!msg) { $("#send-msg").setAttribute("aria-invalid", "true"); showErr(err, "Hãy viết vài dòng trước khi gửi."); $("#send-msg").focus(); return; }
      if (msg.length > MSG_MAX) { showErr(err, `Lời chúc dài tối đa ${MSG_MAX} ký tự.`); return; }
      if (cooldownLeft() > 0) { showErr(err, "Đợi vài giây rồi gửi tiếp nhé."); return; }
      if (!api) { showErr(err, "Trang chưa kết nối được máy chủ. Tải lại trang rồi thử lại."); return; }

      const btn = $("#send-btn");
      showErr(err, "");
      btn.dataset.busy = "1";
      setBusy(btn, true, "Đang gửi…");
      try {
        await api.sendWishes(to.map((id) => ({ recipient_id: id, sender_name: name || null, message: msg })));
        for (const id of to) counts[id] = (counts[id] || 0) + 1;
        renderCounts();
        store.set(LAST_SEND_KEY, Date.now());
        $("#send-msg").value = "";
        closeSend();
        celebrate();
        toast(`Đã gửi lời chúc tới ${recipientsLabel(to)}`);
      } catch (ex) {
        console.error(ex);
        showErr(err, viError(ex));
      } finally {
        delete btn.dataset.busy;
        setBusy(btn, false);
        startCooldownTicker();
      }
    });
  }

  // =================================================================
  //  Hộp thư: đăng nhập OTP
  // =================================================================
  let picked = null;
  let loginEmail = "";
  let resendTimer = null;

  const hintFor = (id) => (id === ADMIN_ID ? C.adminEmailHint : byId[id]?.emailHint) || "";
  const hintParts = (hint) => hint.split(/\s+hoặc\s+|\s*,\s*/).map((h) => h.trim()).filter(Boolean);
  const nameFor = (id) => (id === ADMIN_ID ? ADMIN_LABEL : byId[id]?.name || "");

  // Gợi ý dạng "ha***@dsc.com.vn": khớp phần đầu + tên miền
  function matchesHint(email, hint) {
    const parts = hintParts(hint);
    if (!parts.length) return true;
    return parts.some((h) => {
      const [local, domain] = h.toLowerCase().split("@");
      const prefix = (local || "").replace(/\*+$/, "");
      return email.startsWith(prefix) && email.endsWith("@" + domain);
    });
  }

  function setPick(id) {
    picked = id;
    $$("#pick [data-pick]").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.pick === id)));
    const parts = hintParts(hintFor(id));
    $("#login-hint").innerHTML = parts.length
      ? "Gợi ý: " + parts.map((h) => `<code>${esc(h)}</code>`).join(" hoặc ")
      : "Dùng email bạn đã đăng ký với phòng.";
    $("#login-email").placeholder = parts[0] || "ten@congty.com";
    showErr($("#login-err"), "");
  }

  function showStep(step) {
    $("#step-login").hidden = step !== "login";
    $("#step-otp").hidden = step !== "otp";
  }

  function otpInputs() { return $$("#otp input"); }
  function otpValue() { return otpInputs().map((i) => i.value).join(""); }
  function clearOtp() { otpInputs().forEach((i) => { i.value = ""; }); $("#otp-btn").disabled = true; }

  function startResendCountdown() {
    const btn = $("#otp-resend");
    let left = RESEND_SECONDS;
    clearInterval(resendTimer);
    const tick = () => {
      if (left <= 0) { clearInterval(resendTimer); btn.disabled = false; btn.textContent = "Gửi lại mã"; return; }
      btn.disabled = true;
      btn.textContent = `Gửi lại mã sau ${Math.floor(left / 60)}:${pad(left % 60)}`;
      left -= 1;
    };
    tick();
    resendTimer = setInterval(tick, 1000);
  }

  async function sendCode(isResend) {
    await api.requestOtp(loginEmail, picked);
    $("#otp-to").innerHTML = `Mã đã gửi tới <b>${esc(loginEmail)}</b>. Kiểm tra cả mục Spam nếu chưa thấy.` +
      (DEMO ? ` <b>Chế độ demo: mã là ${DEMO_OTP}.</b>` : "");
    startResendCountdown();
    if (isResend) toast("Đã gửi mã mới");
  }

  async function verify() {
    const code = otpValue();
    if (code.length !== 6) return;
    const btn = $("#otp-btn");
    const err = $("#otp-err");
    showErr(err, "");
    setBusy(btn, true, "Đang kiểm tra…");
    try {
      const s = await api.verifyOtp(loginEmail, code);
      await showView(s);
    } catch (ex) {
      console.error(ex);
      showErr(err, viError(ex));
      clearOtp();
      otpInputs()[0].focus();
    } finally {
      setBusy(btn, false);
      btn.disabled = otpValue().length !== 6;
    }
  }

  function setupLogin() {
    $("#otp").innerHTML = Array.from({ length: 6 }, (_, i) =>
      `<input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="6" aria-label="Số thứ ${i + 1}"${i === 0 ? ' autocomplete="one-time-code"' : ' autocomplete="off"'}>`).join("");

    $("#pick").addEventListener("click", (e) => {
      const b = e.target.closest("[data-pick]");
      if (!b) return;
      setPick(b.dataset.pick);
      $("#login-email").focus();
    });
    $("#pick").addEventListener("keydown", (e) => { // phím mũi tên trong radiogroup
      if (!["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp"].includes(e.key)) return;
      const btns = $$("#pick [data-pick]");
      const i = btns.indexOf(document.activeElement);
      if (i < 0) return;
      e.preventDefault();
      const next = btns[(i + (e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : btns.length - 1)) % btns.length];
      next.focus();
      setPick(next.dataset.pick);
    });

    $("#step-login").addEventListener("submit", async (e) => {
      e.preventDefault();
      const err = $("#login-err");
      const email = $("#login-email").value.trim().toLowerCase();
      if (!picked) { showErr(err, "Chọn tên của bạn trước nhé."); return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showErr(err, "Email chưa đúng định dạng."); $("#login-email").focus(); return; }
      // Ô admin cũng nhận email của người ẩn (Tester); gợi ý này không hiện ra
      const accepted = [hintFor(picked), ...(picked === ADMIN_ID ? members.filter((m) => m.hidden).map((m) => m.emailHint) : [])]
        .filter(Boolean).join(" hoặc ");
      if (!matchesHint(email, accepted)) {
        showErr(err, `Email chưa khớp với gợi ý của ${nameFor(picked)} (${hintParts(hintFor(picked)).join(" hoặc ")}). Kiểm tra lại nhé.`);
        $("#login-email").focus();
        return;
      }
      if (!api) { showErr(err, "Trang chưa kết nối được máy chủ. Tải lại trang rồi thử lại."); return; }
      const btn = $("#login-btn");
      showErr(err, "");
      setBusy(btn, true, "Đang gửi mã…");
      loginEmail = email;
      try {
        await sendCode(false);
        clearOtp();
        showErr($("#otp-err"), "");
        showStep("otp");
        otpInputs()[0].focus();
      } catch (ex) {
        console.error(ex);
        showErr(err, viError(ex));
      } finally {
        setBusy(btn, false);
      }
    });

    // Ô OTP: tự nhảy ô, dán cả chuỗi, xoá lùi
    $("#otp").addEventListener("input", (e) => {
      const inputs = otpInputs();
      const i = inputs.indexOf(e.target);
      const digits = e.target.value.replace(/\D/g, "");
      if (digits.length > 1) {
        digits.slice(0, 6 - i).split("").forEach((d, k) => { inputs[i + k].value = d; });
        inputs[Math.min(i + digits.length, 5)].focus();
      } else {
        e.target.value = digits;
        if (digits && i < 5) inputs[i + 1].focus();
      }
      showErr($("#otp-err"), "");
      const full = otpValue().length === 6;
      $("#otp-btn").disabled = !full;
      if (full) verify();
    });
    $("#otp").addEventListener("keydown", (e) => {
      const inputs = otpInputs();
      const i = inputs.indexOf(e.target);
      if (e.key === "Backspace" && !e.target.value && i > 0) { inputs[i - 1].focus(); inputs[i - 1].value = ""; e.preventDefault(); }
      if (e.key === "ArrowLeft" && i > 0) inputs[i - 1].focus();
      if (e.key === "ArrowRight" && i < 5) inputs[i + 1].focus();
    });
    $("#otp").addEventListener("focusin", (e) => { if (e.target.select) e.target.select(); });

    $("#step-otp").addEventListener("submit", (e) => { e.preventDefault(); verify(); });
    $("#otp-resend").addEventListener("click", async () => {
      const btn = $("#otp-resend");
      btn.disabled = true;
      try { await sendCode(true); }
      catch (ex) { console.error(ex); showErr($("#otp-err"), viError(ex)); btn.disabled = false; }
    });
    $("#otp-back").addEventListener("click", () => {
      clearInterval(resendTimer);
      showStep("login");
      $("#login-email").focus();
    });
  }

  // =================================================================
  //  Hộp thư: xem (chị em) và admin
  // =================================================================
  let session = null;
  let wishes = [];
  let adminFilter = "all";

  async function showView(s, { scroll = true } = {}) {
    if (!s.isAdmin && !s.memberId) {
      await api.signOut();
      showStep("login");
      showErr($("#login-err"), "Email này đăng nhập được nhưng chưa được gán cho chị em nào. Báo admin kiểm tra nhé.");
      return;
    }
    session = s;
    clearInterval(resendTimer);
    $("#inbox-auth").hidden = true;
    const view = $("#inbox-view");
    view.hidden = false;
    view.innerHTML = `<p class="muted">Đang mở hộp thư…</p>`;
    if (scroll) $("#hop-thu").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    try {
      wishes = await api.listWishes(s);
    } catch (ex) {
      console.error(ex);
      view.innerHTML = `<div class="err">${esc(viError(ex))}</div>`;
      return;
    }
    if (s.isAdmin) renderAdmin(); else renderMemberInbox();
    if (hasGsap && !reduceMotion) gsap.from(view.children, { y: 24, opacity: 0, stagger: .06, duration: .6, ease: "power3.out" });
  }

  function renderMemberInbox() {
    const m = byId[session.memberId];
    const view = $("#inbox-view");
    const cards = wishes.map((w) => {
      const who = w.sender_name ? esc(w.sender_name) : "Ẩn danh";
      return `<div class="flip" tabindex="0" role="button" aria-pressed="false" aria-label="Thiệp từ ${who}, bấm để lật">` +
        `<div class="flip-in">` +
        `<div class="face-f glass"><span class="stripe"></span><span class="seal">${flowerSvg(26)}</span>` +
        `<div class="from">Từ<b>${who}</b></div><span class="tap">Bấm để mở</span></div>` +
        `<div class="face-b"><p>${esc(w.message)}</p><div class="meta"><span>Từ <b>${who}</b></span><span>${fmtShort(w.created_at)}</span></div></div>` +
        `</div></div>`;
    }).join("");
    view.innerHTML =
      `<div class="mail-top">${m ? avatar(m) : ""}<div><h2>Hộp thư của ${esc(m?.name || "bạn")}</h2>` +
      `<div class="muted">${wishes.length} lời chúc · đăng nhập bằng ${esc(session.email)}</div></div>` +
      `<div class="actions">${wishes.length ? `<button class="btn btn-ghost btn-sm" type="button" data-act="openall">Mở tất cả</button>` : ""}` +
      `<button class="btn btn-ghost btn-sm" type="button" data-act="refresh">Tải lại</button>` +
      `<button class="btn btn-ghost btn-sm" type="button" data-act="logout">Đăng xuất</button></div></div>` +
      (wishes.length ? `<div class="cards">${cards}</div>`
        : `<div class="empty glass">${flowerSvg(44)}<b>Chưa có lời chúc nào</b><p>Lời chúc sẽ xuất hiện ở đây khi mọi người gửi. Quay lại sau một chút nhé.</p></div>`);
  }

  function renderAdmin() {
    const view = $("#inbox-view");
    const per = {};
    for (const w of wishes) per[w.recipient_id] = (per[w.recipient_id] || 0) + 1;
    const shown = adminFilter === "all" ? members : members.filter((m) => m.id === adminFilter);
    const filtered = filteredWishes();
    view.innerHTML =
      `<div class="mail-top"><div><span class="eyebrow">${esc(ADMIN_LABEL)} · ${esc(session.email)}</span><h2>Tất cả lời chúc</h2></div>` +
      `<div class="actions"><button class="btn btn-dark btn-sm" type="button" data-act="csv"${filtered.length ? "" : " disabled"}>Xuất CSV (${filtered.length})</button>` +
      `<button class="btn btn-ghost btn-sm" type="button" data-act="refresh">Tải lại</button>` +
      `<button class="btn btn-ghost btn-sm" type="button" data-act="logout">Đăng xuất</button></div></div>` +
      `<div class="chips" role="group" aria-label="Lọc theo người nhận">` +
      `<button class="chip all" type="button" data-filter="all" aria-pressed="${adminFilter === "all"}">Tất cả <em>${wishes.length}</em></button>` +
      members.map((m) => `<button class="chip" type="button" data-filter="${esc(m.id)}" aria-pressed="${adminFilter === m.id}">${avatar(m, { badge: false })}${hiddenLabel(m)} <em>${per[m.id] || 0}</em></button>`).join("") +
      `</div><div class="groups">` +
      shown.map((m) => {
        const rows = wishes.filter((w) => w.recipient_id === m.id);
        return `<div class="group glass"><div class="group-h">${avatar(m, { badge: false })}<b>${hiddenLabel(m)}</b><span>${rows.length} lời chúc</span></div>` +
          (rows.length
            ? `<div class="tbl-wrap"><table><thead><tr><th scope="col">Người gửi</th><th scope="col">Lời chúc</th><th scope="col">Thời gian</th></tr></thead><tbody>` +
              rows.map((w) => `<tr><td class="who${w.sender_name ? "" : " anon"}">${w.sender_name ? esc(w.sender_name) : "Ẩn danh"}</td>` +
                `<td class="msg">${esc(w.message)}</td><td class="when">${fmtShort(w.created_at)}</td></tr>`).join("") +
              `</tbody></table></div>`
            : `<p class="none">Chưa có lời chúc nào.</p>`) +
          `</div>`;
      }).join("") + `</div>`;
  }

  function filteredWishes() {
    return adminFilter === "all" ? wishes : wishes.filter((w) => w.recipient_id === adminFilter);
  }

  function exportCsv() {
    // Chặn công thức Excel trong nội dung người dùng nhập (CSV injection)
    const cell = (v) => {
      let s = String(v ?? "");
      if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
      return `"${s.replace(/"/g, '""')}"`;
    };
    const rows = [["Người nhận", "Người gửi", "Lời chúc", "Thời gian"]].concat(
      filteredWishes().map((w) => [byId[w.recipient_id]?.name || w.recipient_id, w.sender_name || "Ẩn danh", w.message, fmtFull(w.created_at)]));
    const csv = rows.map((r) => r.map(cell).join(",")).join("\r\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `loi-chuc-20-10-${adminFilter === "all" ? "tat-ca" : adminFilter}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function logout() {
    try { await api.signOut(); } catch (e) { console.warn(e); }
    session = null;
    wishes = [];
    adminFilter = "all";
    $("#inbox-view").hidden = true;
    $("#inbox-view").innerHTML = "";
    $("#inbox-auth").hidden = false;
    clearOtp();
    showStep("login");
    toast("Đã đăng xuất");
  }

  function setupInboxView() {
    const view = $("#inbox-view");
    view.addEventListener("click", (e) => {
      const flip = e.target.closest(".flip");
      if (flip) { flip.classList.toggle("open"); flip.setAttribute("aria-pressed", flip.classList.contains("open")); return; }
      const act = e.target.closest("[data-act]")?.dataset.act;
      if (act === "openall") $$(".flip", view).forEach((f) => { f.classList.add("open"); f.setAttribute("aria-pressed", "true"); });
      if (act === "logout") logout();
      if (act === "refresh") { showView(session, { scroll: false }); refreshCounts(); }
      if (act === "csv") exportCsv();
      const chip = e.target.closest("[data-filter]");
      if (chip) { adminFilter = chip.dataset.filter; renderAdmin(); }
    });
    view.addEventListener("keydown", (e) => {
      const flip = e.target.closest?.(".flip");
      if (flip && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); flip.click(); }
    });
  }

  // =================================================================
  //  Hiệu ứng
  // =================================================================
  function setupChrome() {
    const hdr = $(".hdr");
    const onScroll = () => hdr.classList.toggle("scrolled", window.scrollY > 12);
    addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    // Nút nổi trên mobile: hiện khi nút ở hero đã cuộn khỏi màn hình
    const fab = $("#fab");
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(([en]) => fab.classList.toggle("show", !en.isIntersecting)).observe($("#hero-ctas"));
    } else {
      fab.classList.add("show");
    }

    // Liquid glass bằng SVG displacement: chỉ Chromium hỗ trợ backdrop-filter: url()
    const isChromium = !!navigator.userAgentData?.brands?.some((b) => /Chromium/i.test(b.brand));
    if (isChromium && !reduceMotion) document.documentElement.classList.add("lg-svg");
  }

  function setupMotion() {
    if (!hasGsap || reduceMotion) return;
    gsap.registerPlugin(ScrollTrigger);
    document.documentElement.classList.add("js-motion");

    // Hero
    const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
    tl.from(".hero-in", { y: 28, opacity: 0, duration: .8, stagger: .08 })
      .from("#orbit .ring", { scale: .85, opacity: 0, duration: .9 }, "<.1")
      .from("#orbit .o", { scale: .4, opacity: 0, duration: .7, stagger: .07, ease: "back.out(1.7)" }, "<.2");
    gsap.to("#orbit .o-in", { y: -6, duration: 2.4, ease: "sine.inOut", yoyo: true, repeat: -1, stagger: { each: .3, from: "random" } });

    // Hiện dần khi cuộn tới
    const items = $$(".reveal, .sub, .mem");
    gsap.set(items, { opacity: 0, y: 32 });
    ScrollTrigger.batch(items, {
      start: "top 90%",
      once: true,
      onEnter: (batch) => gsap.to(batch, { opacity: 1, y: 0, duration: .75, stagger: .08, ease: "power3.out", overwrite: true }),
    });

    // Lời chúc chung: chữ đậm dần theo từng từ
    gsap.to("#main-body .w", {
      color: "#17131f",
      ease: "none",
      stagger: .1,
      scrollTrigger: { trigger: ".main-wish", start: "top 72%", end: "bottom 62%", scrub: .6 },
    });

    // Thẻ chị em nghiêng theo chuột
    if (matchMedia("(hover: hover) and (pointer: fine)").matches) {
      $$(".mem").forEach((card) => {
        card.addEventListener("pointermove", (e) => {
          const r = card.getBoundingClientRect();
          const x = (e.clientX - r.left) / r.width - .5;
          const y = (e.clientY - r.top) / r.height - .5;
          gsap.to(card, { rotateY: x * 10, rotateX: y * -8, y: -4, duration: .4, ease: "power2.out" });
        });
        card.addEventListener("pointerleave", () => gsap.to(card, { rotateY: 0, rotateX: 0, y: 0, duration: .6, ease: "power3.out" }));
      });
    }
  }

  function startPetals() {
    if (reduceMotion) return;
    const cv = $("#petals");
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const palette = [["#E0AED0", "#AC87C5"], ["#FFE5E5", "#E0AED0"], ["#AC87C5", "#756AB6"], ["#F5DCEB", "#E0AED0"]];
    let W = 0, H = 0, raf = 0;
    const petals = [];

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = innerWidth; H = innerHeight;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const want = W < 760 ? 14 : 26;
      while (petals.length < want) petals.push(spawn({}, true));
      petals.length = want;
    }
    function spawn(p, anywhere) {
      p.x = Math.random() * W;
      p.y = anywhere ? Math.random() * H : -24;
      p.s = 6 + Math.random() * 9;
      p.vy = .35 + Math.random() * .75;
      p.vx = -.25 + Math.random() * .5;
      p.rot = Math.random() * Math.PI * 2;
      p.vr = (Math.random() - .5) * .03;
      p.sway = Math.random() * Math.PI * 2;
      p.flip = Math.random() * Math.PI * 2;
      p.c = palette[(Math.random() * palette.length) | 0];
      p.a = .45 + Math.random() * .4;
      return p;
    }
    function draw(p) {
      const s = p.s;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.scale(1, .35 + Math.abs(Math.cos(p.flip)) * .65);
      const g = ctx.createLinearGradient(-s, -s, s, s);
      g.addColorStop(0, p.c[0]); g.addColorStop(1, p.c[1]);
      ctx.globalAlpha = p.a;
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(0, -s);
      ctx.bezierCurveTo(s * .95, -s * .35, s * .6, s * .75, 0, s);
      ctx.bezierCurveTo(-s * .6, s * .75, -s * .95, -s * .35, 0, -s);
      ctx.fill();
      ctx.restore();
    }
    function frame() {
      ctx.clearRect(0, 0, W, H);
      for (const p of petals) {
        p.sway += .012; p.flip += .02; p.rot += p.vr;
        p.x += p.vx + Math.sin(p.sway) * .45;
        p.y += p.vy;
        if (p.y > H + 24 || p.x < -40 || p.x > W + 40) spawn(p, false);
        draw(p);
      }
      raf = requestAnimationFrame(frame);
    }
    resize();
    addEventListener("resize", resize);
    document.addEventListener("visibilitychange", () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) raf = requestAnimationFrame(frame);
    });
    raf = requestAnimationFrame(frame);
  }

  // =================================================================
  //  Khởi động
  // =================================================================
  async function init() {
    renderStatic();
    setupChrome();
    setupSend();
    setupLogin();
    setupInboxView();
    setupMotion();
    startPetals();
    setupFooterFireworks();
    if (DEMO) console.info("[một lời chúc] Chế độ DEMO: dữ liệu lưu trong trình duyệt, mã OTP là " + DEMO_OTP);
    if (!api) { toast("Không kết nối được máy chủ. Tải lại trang thử nhé.", "error"); return; }
    refreshCounts();
    try {
      const s = await api.getSession();
      if (s) await showView(s, { scroll: false });
    } catch (e) {
      console.warn("Khôi phục phiên đăng nhập:", e);
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
