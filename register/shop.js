/* Tegevusteraapia Keskus — näidispood: ostukorv (localStorage), tootekaart, filtrid, näidistellimus.
   Midagi ei saadeta ega salvestata serverisse. */
(function () {
  "use strict";
  var PRODUCTS = window.TTK_PRODUCTS || [];
  var byId = {};
  PRODUCTS.forEach(function (p) { byId[p.id] = p; });
  var KEY = "ttk-pood-ostukorv-v1";
  var MAX_QTY = 20;
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var root = document.documentElement;

  /* ---------- Cart state ---------- */
  function load() {
    var out = {};
    try {
      var raw = window.localStorage.getItem(KEY);
      var o = raw ? JSON.parse(raw) : {};
      Object.keys(o || {}).forEach(function (id) {
        var q = parseInt(o[id], 10);
        if (byId[id] && q > 0) out[id] = Math.min(q, MAX_QTY);
      });
    } catch (e) { /* storage unavailable: keep an in-memory cart */ }
    return out;
  }
  var cart = load();
  function save() { try { window.localStorage.setItem(KEY, JSON.stringify(cart)); } catch (e) {} }
  function eur(cents) { return (cents / 100).toFixed(2).replace(".", ",") + "\u00a0€"; }
  function count() { return Object.keys(cart).reduce(function (n, id) { return n + cart[id]; }, 0); }
  function total() { return Object.keys(cart).reduce(function (s, id) { return s + cart[id] * byId[id].hind; }, 0); }
  function plural(n) { return n === 1 ? "toode" : "toodet"; }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function icon(path, cls) {
    var wrap = el("span", cls || "icon");
    wrap.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + path + "</svg>";
    return wrap;
  }
  var X = '<path d="M6 6l12 12M18 6L6 18"/>';
  var CHECK = '<path d="M6 12.5l4 4 8-9"/>';

  /* ---------- Header badge, live region, toast ---------- */
  var live = el("div", "visually-hidden");
  live.setAttribute("role", "status");
  live.setAttribute("aria-live", "polite");
  var toast = el("div", "toast");
  toast.setAttribute("role", "status");
  toast.hidden = true;
  var toastTimer = null;
  function say(msg) { live.textContent = ""; window.setTimeout(function () { live.textContent = msg; }, 30); }
  function showToast(msg) {
    toast.innerHTML = "";
    toast.appendChild(el("span", "toast-text", msg));
    var b = el("button", "toast-btn", "Vaata ostukorvi");
    b.type = "button";
    b.addEventListener("click", function () { hideToast(); openCart(b); });
    toast.appendChild(b);
    toast.hidden = false;
    toast.classList.remove("is-in"); void toast.offsetWidth; toast.classList.add("is-in");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(hideToast, 3800);
  }
  function hideToast() { toast.hidden = true; }

  function updateBadge(pop) {
    var n = count();
    document.querySelectorAll("[data-cart-count]").forEach(function (b) {
      b.textContent = n;
      b.classList.toggle("has-items", n > 0);
      if (pop && !reduceMotion) { b.classList.remove("pop"); void b.offsetWidth; b.classList.add("pop"); }
    });
    document.querySelectorAll("[data-cart-open]").forEach(function (b) {
      b.setAttribute("aria-label", "Ostukorv, " + (n ? n + " " + plural(n) : "tooteid: 0"));
    });
  }

  function setQty(id, qty) {
    qty = Math.max(0, Math.min(MAX_QTY, qty));
    if (qty === 0) delete cart[id]; else cart[id] = qty;
    save(); updateBadge(false);
  }
  function addToCart(id, qty) {
    var p = byId[id]; if (!p) return;
    var next = Math.min(MAX_QTY, (cart[id] || 0) + (qty || 1));
    cart[id] = next; save(); updateBadge(true);
    say("Lisatud ostukorvi: " + p.nimi + ". Ostukorvis on kokku " + count() + " " + plural(count()) + ".");
    showToast("Lisatud: " + p.nimi);
    if (cartDialog && cartDialog.open) renderCart();
  }

  window.addEventListener("storage", function (e) {
    if (e.key !== KEY) return;
    cart = load(); updateBadge(false);
    if (cartDialog && cartDialog.open && view === "cart") renderCart();
  });

  /* ---------- Dialog helpers ---------- */
  var lastOpener = null;
  function openDialog(d, opener) {
    lastOpener = opener || document.activeElement;
    if (typeof d.showModal === "function") d.showModal(); else d.setAttribute("open", "");
    root.classList.add("dlg-open");
  }
  function wireDialog(d) {
    d.addEventListener("click", function (e) {
      if (e.target === d) d.close();
      var closer = e.target.closest && e.target.closest("[data-close]");
      if (closer && d.contains(closer)) d.close();
    });
    d.addEventListener("close", function () {
      if (!document.querySelector("dialog[open]")) root.classList.remove("dlg-open");
      if (lastOpener && document.contains(lastOpener)) { try { lastOpener.focus(); } catch (e) {} }
    });
  }
  function closeBtn(label) {
    var b = el("button", "dlg-close");
    b.type = "button"; b.setAttribute("data-close", ""); b.setAttribute("aria-label", label);
    b.appendChild(icon(X));
    return b;
  }
  function qtyStepper(id, qty, onChange, name) {
    var wrap = el("div", "qty");
    wrap.setAttribute("role", "group");
    wrap.setAttribute("aria-label", "Kogus: " + name);
    var minus = el("button", "qty-btn", "\u2212"); minus.type = "button"; minus.setAttribute("aria-label", "Vähenda kogust: " + name);
    var num = el("span", "qty-num", String(qty));
    var plus = el("button", "qty-btn", "+"); plus.type = "button"; plus.setAttribute("aria-label", "Suurenda kogust: " + name);
    minus.disabled = qty <= 1; plus.disabled = qty >= MAX_QTY;
    minus.addEventListener("click", function () { onChange(qty - 1, "minus"); });
    plus.addEventListener("click", function () { onChange(qty + 1, "plus"); });
    wrap.appendChild(minus); wrap.appendChild(num); wrap.appendChild(plus);
    return wrap;
  }

  /* ---------- Cart dialog ---------- */
  var cartDialog = null, cartBody = null, view = "cart";
  function buildCart() {
    cartDialog = el("dialog", "dlg dlg-drawer");
    cartDialog.id = "cart-dialog";
    cartDialog.setAttribute("aria-labelledby", "cart-title");
    var head = el("div", "dlg-head");
    var h = el("h2", "dlg-title", "Ostukorv"); h.id = "cart-title"; h.tabIndex = -1;
    head.appendChild(h); head.appendChild(closeBtn("Sulge ostukorv"));
    var demo = el("p", "dlg-demo");
    demo.innerHTML = "<strong>Näidispood.</strong> Tooted ja hinnad on näitlikud, tellimust ei saadeta.";
    cartBody = el("div", "dlg-body");
    cartDialog.appendChild(head); cartDialog.appendChild(demo); cartBody.id = "cart-body"; cartDialog.appendChild(cartBody);
    document.body.appendChild(cartDialog);
    wireDialog(cartDialog);
  }
  function thumb(p) {
    var t = el("span", "thumb");
    if (p.pilt) { var i = document.createElement("img"); i.src = p.pilt; i.alt = ""; i.width = 64; i.height = 64; t.appendChild(i); }
    else if (p.ikoon) { t.classList.add("thumb-ph"); t.innerHTML = p.ikoon; }
    return t;
  }
  function focusAfter(sel) {
    var n = cartBody.querySelector(sel);
    if (n) { try { n.focus(); } catch (e) {} }
  }
  function renderCart(focusSel) {
    view = "cart";
    cartBody.innerHTML = "";
    var ids = Object.keys(cart);
    if (!ids.length) {
      var empty = el("div", "cart-empty");
      empty.appendChild(el("p", "cart-empty-title", "Ostukorv on tühi."));
      empty.appendChild(el("p", "", "Lisa tooteid, et näha, kuidas ostukorv töötab."));
      var go = el("a", "button secondary", "Vaata abivahendeid"); go.href = "abivahendid.html#tooted";
      go.setAttribute("data-close", "");
      empty.appendChild(go);
      cartBody.appendChild(empty);
      return;
    }
    var list = el("ul", "cart-list");
    ids.forEach(function (id) {
      var p = byId[id], q = cart[id];
      var li = el("li", "cart-row");
      li.appendChild(thumb(p));
      var info = el("div", "cart-info");
      info.appendChild(el("p", "cart-name", p.nimi));
      var unit = el("p", "cart-unit");
      unit.appendChild(document.createTextNode(eur(p.hind) + " "));
      unit.appendChild(el("span", "price-tag", "näidishind"));
      info.appendChild(unit);
      var ctrl = el("div", "cart-ctrl");
      ctrl.appendChild(qtyStepper(id, q, function (nq, which) {
        setQty(id, nq); renderCart();
        var btns = cartBody.querySelectorAll('.cart-row[data-id="' + id + '"] .qty-btn');
        var want = btns[which === "plus" ? 1 : 0];
        if (want && want.disabled) want = btns[which === "plus" ? 0 : 1];
        if (want) want.focus();
      }, p.nimi));
      var rm = el("button", "link-btn", "Eemalda"); rm.type = "button";
      rm.setAttribute("aria-label", "Eemalda ostukorvist: " + p.nimi);
      rm.addEventListener("click", function () {
        setQty(id, 0); say("Eemaldatud: " + p.nimi);
        renderCart();
        var f = cartBody.querySelector(".cart-row .qty-btn:not(:disabled), .cart-empty a");
        (f || cartDialog.querySelector(".dlg-close")).focus();
      });
      ctrl.appendChild(rm);
      info.appendChild(ctrl);
      li.setAttribute("data-id", id);
      li.appendChild(info);
      li.appendChild(el("p", "cart-line", eur(p.hind * q)));
      list.appendChild(li);
    });
    cartBody.appendChild(list);
    var sum = el("div", "cart-sum");
    var line = el("p", "cart-total");
    line.appendChild(el("span", "", "Näidissumma"));
    var tot = el("strong", "", eur(total())); tot.id = "cart-total"; line.appendChild(tot);
    sum.appendChild(line);
    sum.appendChild(el("p", "cart-note", "Käibemaksu ja tarne kohta andmeid veel ei ole. Soodustusi ei arvestata."));
    cartBody.appendChild(sum);
    var actions = el("div", "cart-actions");
    var go2 = el("button", "button primary", "Vormista tellimus"); go2.type = "button"; go2.id = "checkout-start";
    go2.addEventListener("click", renderCheckout);
    var more = el("button", "button secondary", "Jätka vaatamist"); more.type = "button"; more.setAttribute("data-close", "");
    var clear = el("button", "link-btn", "Tühjenda ostukorv"); clear.type = "button"; clear.id = "cart-clear";
    clear.addEventListener("click", function () { cart = {}; save(); updateBadge(false); say("Ostukorv on tühjendatud."); renderCart(); cartDialog.querySelector(".cart-empty a").focus(); });
    actions.appendChild(go2); actions.appendChild(more); actions.appendChild(clear);
    cartBody.appendChild(actions);
    if (focusSel) focusAfter(focusSel);
  }

  /* ---------- Checkout (never submits) ---------- */
  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  function field(id, label, attrs, optional) {
    var wrap = el("div", "field");
    var l = el("label"); l.setAttribute("for", id);
    l.appendChild(document.createTextNode(label));
    if (optional) { l.appendChild(document.createTextNode(" ")); l.appendChild(el("span", "optional", "(võib jätta)")); }
    var input = attrs.tag === "textarea" ? document.createElement("textarea") : document.createElement("input");
    input.id = id; input.name = attrs.name;
    Object.keys(attrs).forEach(function (k) { if (k !== "tag") input.setAttribute(k, attrs[k]); });
    wrap.appendChild(l); wrap.appendChild(input);
    return { wrap: wrap, input: input };
  }
  function setErr(f, msg) {
    var e = f.wrap.querySelector(".field-error");
    if (!msg) { if (e) e.remove(); f.input.removeAttribute("aria-invalid"); f.input.removeAttribute("aria-describedby"); return; }
    if (!e) { e = el("p", "field-error"); e.id = f.input.id + "-viga"; f.wrap.appendChild(e); }
    e.textContent = msg; f.input.setAttribute("aria-invalid", "true"); f.input.setAttribute("aria-describedby", e.id);
  }
  function renderCheckout() {
    view = "checkout";
    cartBody.innerHTML = "";
    var back = el("button", "link-btn back", "\u2190 Tagasi ostukorvi"); back.type = "button";
    back.addEventListener("click", function () { renderCart("#checkout-start"); });
    cartBody.appendChild(back);
    var h = el("h3", "co-title", "Näidistellimus"); h.tabIndex = -1; h.id = "co-title"; cartBody.appendChild(h);
    var items = el("p", "co-summary");
    items.innerHTML = count() + " " + plural(count()) + ", näidissumma <strong>" + eur(total()) + "</strong>";
    cartBody.appendChild(items);
    var form = el("form", "co-form"); form.noValidate = true;
    var fName = field("co-nimi", "Nimi", { name: "nimi", type: "text", autocomplete: "name" });
    var fMail = field("co-email", "E-post", { name: "email", type: "email", autocomplete: "email", inputmode: "email", autocapitalize: "off", spellcheck: "false" });
    var fTel = field("co-tel", "Telefon", { name: "telefon", type: "tel", autocomplete: "tel", inputmode: "tel" }, true);
    var fNote = field("co-markus", "Märkus", { name: "markus", tag: "textarea", rows: "2" }, true);
    [fName, fMail, fTel, fNote].forEach(function (f) { form.appendChild(f.wrap); });
    var fine = el("p", "cart-note", "Näidispoes ei küsita makset ega aadressi. Midagi ei saadeta.");
    form.appendChild(fine);
    var submit = el("button", "button primary", "Esita tellimus"); submit.type = "submit";
    form.appendChild(submit);
    function check() {
      var bad = null;
      function test(f, ok, msg) { setErr(f, ok ? null : msg); if (!ok && !bad) bad = f.input; }
      test(fName, fName.input.value.trim().length > 0, "Kirjuta oma nimi.");
      var m = fMail.input.value.trim();
      test(fMail, m.length > 0 && EMAIL.test(m), m ? "Kontrolli e-posti aadressi. See peaks olema kujul nimi@näide.ee." : "Kirjuta e-posti aadress.");
      var t = fTel.input.value.trim();
      test(fTel, !t || /^\+?\d{7,15}$/.test(t.replace(/[\s()-]/g, "")), "Kontrolli numbrit. Telefoninumbris peaks olema vähemalt 7 numbrit.");
      return bad;
    }
    form.addEventListener("input", function () { if (form.classList.contains("was-checked")) check(); });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      form.classList.add("was-checked");
      var bad = check();
      if (bad) { bad.focus(); return; }
      renderDone();
    });
    cartBody.appendChild(form);
    h.focus();
  }
  function renderDone() {
    view = "done";
    cartBody.innerHTML = "";
    var box = el("div", "co-done");
    box.appendChild(icon(CHECK, "success-icon"));
    var h = el("h3", "co-done-title", "See on näidispood, tellimust ei saadeta."); h.tabIndex = -1; h.id = "co-done-title";
    box.appendChild(h);
    box.appendChild(el("p", "", "Midagi ei saadetud ja andmeid ei salvestatud. Ostukorv jäi alles, et saaksid veel vaadata."));
    var ask = el("p", "co-ask");
    ask.innerHTML = 'Aitäh, et vaatasid! Aita meil poodi paremaks teha: <a href="koolitused.html#tagasiside">ütle, mida sa siit puudu tundsid</a>.';
    box.appendChild(ask);
    var actions = el("div", "cart-actions");
    var back = el("button", "button secondary", "Tagasi ostukorvi"); back.type = "button";
    back.addEventListener("click", function () { renderCart("#checkout-start"); });
    var clear = el("button", "button primary", "Tühjenda ostukorv ja sulge"); clear.type = "button"; clear.id = "co-clear";
    clear.addEventListener("click", function () { cart = {}; save(); updateBadge(false); cartDialog.close(); });
    actions.appendChild(clear); actions.appendChild(back);
    box.appendChild(actions);
    cartBody.appendChild(box);
    h.focus();
    say("See on näidispood, tellimust ei saadeta.");
  }

  function openCart(opener) {
    if (!cartDialog) buildCart();
    renderCart();
    openDialog(cartDialog, opener);
  }

  /* ---------- Product dialog ---------- */
  var pd = null, pdQty = 1, pdCurrent = null;
  function buildProduct() {
    pd = el("dialog", "dlg dlg-product");
    pd.id = "product-dialog";
    pd.setAttribute("aria-labelledby", "pd-title");
    pd.appendChild(closeBtn("Sulge tootekaart"));
    var grid = el("div", "pd-grid"); grid.id = "pd-grid";
    pd.appendChild(grid);
    document.body.appendChild(pd);
    wireDialog(pd);
    pd.addEventListener("click", function (e) {
      var a = e.target.closest && e.target.closest("a[href^='abivahendid.html#']");
      if (a) { pd.close(); }
    });
  }
  function renderProduct() {
    var p = pdCurrent, grid = document.getElementById("pd-grid");
    grid.innerHTML = "";
    var media = el("div", "pd-media");
    if (p.pilt) { var im = document.createElement("img"); im.src = p.pilt; im.alt = p.alt || ""; im.width = 900; im.height = 900; media.appendChild(im); }
    else { media.classList.add("pd-ph"); media.innerHTML = p.ikoon + '<span class="ph-text">Foto lisamisel</span>'; }
    var info = el("div", "pd-info");
    info.appendChild(el("p", "pd-cat", p.kategooriad.join(" · ")));
    var h = el("h2", "pd-title", p.nimi); h.id = "pd-title"; info.appendChild(h);
    var price = el("p", "pd-price");
    price.appendChild(el("span", "price-num", eur(p.hind))); price.appendChild(document.createTextNode(" ")); price.appendChild(el("span", "price-tag", "näidishind"));
    info.appendChild(price);
    info.appendChild(el("p", "pd-long", p.pikk));
    info.appendChild(el("p", "pd-fits", p.sobib));
    var buy = el("div", "pd-buy");
    buy.appendChild(qtyStepper(p.id, pdQty, function (n) { pdQty = Math.max(1, Math.min(MAX_QTY, n)); renderProduct(); var b = grid.querySelectorAll(".qty-btn:not(:disabled)"); if (b.length) b[b.length > 1 ? 1 : 0].focus(); }, p.nimi));
    var add = el("button", "button primary", "Lisa korvi"); add.type = "button"; add.id = "pd-add";
    add.addEventListener("click", function () { addToCart(p.id, pdQty); pd.close(); });
    buy.appendChild(add);
    info.appendChild(buy);
    var demo = el("p", "pd-demo"); demo.innerHTML = "<strong>Näidispood.</strong> Toode ja hind on näitlikud."; info.appendChild(demo);
    var adv = el("p", "pd-advice"); adv.innerHTML = 'Pole kindel, kas see sobib? <a href="abivahendid.html#nou">Küsi nõu</a>.'; info.appendChild(adv);
    if (p.credit) {
      var c = el("p", "pd-credit");
      c.appendChild(document.createTextNode("Foto: " + p.credit.autor + ", "));
      var l = document.createElement("a"); l.href = p.credit.licurl || p.credit.leht; l.textContent = p.credit.lic; c.appendChild(l);
      c.appendChild(document.createTextNode(", "));
      var s = document.createElement("a"); s.href = p.credit.leht; s.textContent = "Wikimedia Commons"; c.appendChild(s);
      info.appendChild(c);
    }
    grid.appendChild(media); grid.appendChild(info);
  }
  function openProduct(id, opener) {
    var p = byId[id]; if (!p) return;
    if (!pd) buildProduct();
    pdCurrent = p; pdQty = 1;
    renderProduct();
    pd.scrollTop = 0;
    openDialog(pd, opener);
  }

  /* ---------- Filters (shop page) ---------- */
  var grid = document.getElementById("product-grid");
  if (grid) {
    var filters = document.querySelectorAll("[data-filter]");
    var items = grid.querySelectorAll(".product");
    var counter = document.getElementById("result-count");
    var empty = document.getElementById("empty");
    function applyFilter(key, btn) {
      var n = 0;
      items.forEach(function (li) {
        var show = key === "kõik" || li.getAttribute("data-cats").split(" ").indexOf(key) !== -1;
        li.hidden = !show; if (show) n++;
      });
      filters.forEach(function (b) { b.setAttribute("aria-pressed", b === btn ? "true" : "false"); });
      var name = btn.firstChild.textContent.trim();
      counter.textContent = key === "kõik" ? "Näitan " + n + " " + plural(n) : "Näitan " + n + " " + plural(n) + ": " + name;
      if (empty) empty.hidden = n !== 0;
    }
    filters.forEach(function (b) { b.addEventListener("click", function () { applyFilter(b.getAttribute("data-filter"), b); }); });
    grid.addEventListener("click", function (e) {
      var open = e.target.closest("[data-product-open]");
      if (open) { openProduct(open.getAttribute("data-product-open"), open); return; }
      var add = e.target.closest("[data-add]");
      if (add) {
        addToCart(add.getAttribute("data-add"), 1);
        var old = add.textContent; add.textContent = "Lisatud"; add.classList.add("is-added");
        window.setTimeout(function () { add.textContent = old; add.classList.remove("is-added"); }, 1400);
      }
    });
  }

  /* ---------- Init ---------- */
  document.querySelectorAll("[data-cart-open]").forEach(function (b) { b.addEventListener("click", function () { openCart(b); }); });
  document.body.appendChild(live);
  document.body.appendChild(toast);
  updateBadge(false);
  if (location.hash === "#ostukorv") openCart(null);
})();
