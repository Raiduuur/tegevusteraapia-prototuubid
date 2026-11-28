/* Tegevusteraapia Keskus — v8. Menu, "Millega sa abi vajad?" guidance and preview forms.
   Forms never send anything. */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var behavior = reduceMotion ? "auto" : "smooth";
  function scrollToEl(el, block) { if (el) el.scrollIntoView({ behavior: behavior, block: block || "start" }); }
  function focusNoScroll(el) {
    if (!el) return;
    if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1");
    try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); }
  }

  /* ---------- Mobile menu ---------- */
  var menuBtn = document.getElementById("menu-button");
  var menu = document.getElementById("mobile-menu");
  function setMenu(open, returnFocus) {
    menu.hidden = !open;
    menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) { var first = menu.querySelector("a"); if (first) first.focus(); }
    else if (returnFocus) menuBtn.focus();
  }
  if (menuBtn && menu) {
    menuBtn.addEventListener("click", function () { setMenu(menu.hidden); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !menu.hidden) setMenu(false, true); });
    document.addEventListener("click", function (e) {
      if (!menu.hidden && !menu.contains(e.target) && !menuBtn.contains(e.target)) setMenu(false);
    });
    window.addEventListener("resize", function () {
      if (!menu.hidden && getComputedStyle(menuBtn).display === "none") setMenu(false);
    });
  }

  /* ---------- In-page links: scroll and move focus ---------- */
  function goToHash(id, smooth) {
    var target = document.getElementById(id);
    if (!target) return false;
    var focusEl = target.tagName === "SECTION" ? (target.querySelector("h1, h2") || target) : target;
    target.scrollIntoView({ behavior: smooth ? behavior : "auto", block: "start" });
    focusNoScroll(focusEl);
    return true;
  }
  document.addEventListener("click", function (e) {
    var link = e.target.closest && e.target.closest("a[href]");
    if (!link) return;
    var href = link.getAttribute("href");
    var hashIdx = href.indexOf("#");
    if (hashIdx === -1) return;
    var path = href.slice(0, hashIdx);
    var here = location.pathname.split("/").pop() || "index.html";
    if (path && path !== here) return;
    var id = href.slice(hashIdx + 1);
    if (id === "sisu") return; // skip link: native behaviour
    if (!document.getElementById(id)) return;
    e.preventDefault();
    if (menu && !menu.hidden) setMenu(false);
    goToHash(id, true);
    history.replaceState(null, "", "#" + id);
  });

  /* ---------- "Millega sa abi vajad?" ----------
     Sisu põhineb Eesti Tegevusterapeutide Liidu rakendusjuhendil (2025): teraapia kolm suunda on
     harjutamine, kohandamine (tegevus, keskkond, abivahendid) ja nõustamine (sh lähedased). */
  var needs = {
    soomine: { label: "Söömine", tags: ["Harjutamine", "Tegevuse kohandamine", "Abivahendid"], text: "Kui söömine või toidu tegemine on muutunud raskeks, harjutatakse koos ja otsitakse viisi, kuidas tegevust sinu jaoks lihtsamaks teha. Vajadusel katsetatakse abivahendeid, näiteks jämedamat käepidet. Lapse söömisraskuste puhul vali „Lapse areng”." },
    riietumine: { label: "Riietumine", tags: ["Harjutamine", "Abivahendid", "Tegevuse kohandamine"], text: "Kui nööbid, lukk, sokid või riidesse panek võtavad palju aega ja jõudu, harjutatakse väikeste sammude kaupa ja õpetatakse lihtsamaid võtteid. Abiks võivad olla näiteks soki jalga tõmbamise abivahend või nööbikinnitaja." },
    kirjutamine: { label: "Kirjutamine ja käelised tegevused", tags: ["Käte harjutused", "Abivahendid", "Ergonoomika"], text: "Kui pliiatsit on raske hoida, käsi väsib kiiresti või peened liigutused ei õnnestu, vaadatakse, kuidas käsi töötab. Harjutatakse käelisi tegevusi ja vajadusel soovitatakse abivahendit või teistsugust töövõtet. Lapsel käib see mängu ja harjutuste kaudu." },
    kodu: { label: "Kodus toimetulek", tags: ["Kodu kohandamine", "Abivahendid", "Lähedaste nõustamine"], text: "Kui pesemine, köögitööd või kodus liikumine on muutunud keeruliseks, vaadatakse koos üle, mida kodus muuta, ja õpetatakse abivahendite kasutamist. Nõu saavad ka lähedased." },
    laps: { label: "Lapse areng", tags: ["Harjutamine mängu kaudu", "Lapsevanema nõustamine", "Kooli ja lasteaia päev"], text: "Kui lapsel on raske mängida, süüa, riietuda, kirjutada või kooli- ja lasteaiapäevaga toime tulla, vaadatakse koos, mis takistab ja kuidas oskusi arendada. Teraapia käib mängu ja praktiliste tegevuste kaudu ning vanem saab nõu, kuidas kodus jätkata." },
    kasi: { label: "Käsi ja sõrmed", tags: ["Käte harjutused", "Liigesekaitse", "Abivahendid"], text: "Pärast käevigastust, operatsiooni või liigesehaiguse puhul (näiteks reuma, artroos, karpaalkanal) aitab käeteraapiaga tegelev terapeut: harjutused, vajadusel individuaalne ortoos, liigesekaitse ja käele säästlikumad töövõtted." },
    insult: { label: "Pärast insulti või ajukahjustust", tags: ["Igapäevategevuste harjutamine", "Kodu kohandamine", "Lähedaste nõustamine"], text: "Pärast insulti, ajukahjustust või näiteks Parkinsoni tõve ja sclerosis multiplex'i puhul harjutatakse igapäevatoiminguid: pesemist, riietumist, söömist, toidu tegemist. Vaadatakse üle ka kodu ja nõustatakse lähedasi." },
    kukkumine: { label: "Kukkumisoht ja turvalisus kodus", tags: ["Kodu turvalisus", "Abivahendid", "Lähedaste nõustamine"], text: "Kui kodus on kukkumise oht, tasakaal vääratab või turvaline liikumine on raske, vaadatakse koos kodu üle, soovitatakse muudatusi ja abivahendeid ning õpetatakse nende kasutamist. Nõu saavad ka lähedased." },
    too: { label: "Töö ja ergonoomika", tags: ["Ergonoomika", "Töökoha kohandamine", "Energia säästmine"], text: "Kui töö kurnab käsi või keha või on pärast haigust või vigastust raske tööle naasta, vaadatakse koos, mida töö nõuab. Õpetatakse säästvaid töövõtteid ja soovitatakse, mida töökohal või tööülesannetes muuta." },
    abivahend: { label: "Abivahend, ei tea, mis sobib", tags: ["Abivahendite tutvustamine", "Kasutamise õppimine"], link: true, text: "Tegevusterapeut aitab valida abivahendi, mis sinu olukorda päriselt sobib, ja õpetab seda kasutama. Vaata, milliseid vahendeid on näidispoes, või küsi Kristelilt ja Terjelt nõu." },
    muu: { label: "Ei oska veel öelda", tags: [], title: "Leiame koos", text: "Pole hullu, kui sa ei oska veel öelda. Jäta kontakt ja kirjuta paari sõnaga, mis on raske. Räägime läbi, milline abi sulle sobiks." }
  };
  var needButtons = document.querySelectorAll("[data-need]");
  var guide = document.getElementById("juhis");
  if (guide) {
    var gTitle = document.getElementById("guide-title");
    var gChoice = document.getElementById("guide-choice");
    var gSpecs = document.getElementById("guide-specs");
    var gText = document.getElementById("guide-text");
    var gLink = document.getElementById("guide-link");
    var needSelect = document.getElementById("abi-vajadus");
    needButtons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var key = btn.getAttribute("data-need");
        var need = needs[key];
        if (!need) return;
        needButtons.forEach(function (o) { o.setAttribute("aria-pressed", o === btn ? "true" : "false"); });
        var wasHidden = guide.hidden;
        gChoice.textContent = need.label;
        gTitle.textContent = need.title || "Sellega aitab tegevusterapeut";
        gSpecs.innerHTML = "";
        need.tags.forEach(function (t) { var li = document.createElement("li"); li.textContent = t; gSpecs.appendChild(li); });
        gSpecs.hidden = need.tags.length === 0;
        gText.textContent = need.text;
        if (gLink) gLink.hidden = !need.link;
        if (needSelect) needSelect.value = key;
        guide.hidden = false;
        if (!reduceMotion) { guide.classList.remove("is-updated"); void guide.offsetWidth; guide.classList.add("is-updated"); }
        var r = guide.getBoundingClientRect();
        var vh = window.innerHeight || 800;
        if (wasHidden || r.top < 80 || r.bottom > vh) scrollToEl(guide, r.height > vh * 0.7 ? "start" : "center");
      });
    });
  }

  /* ---------- Reveal fields ---------- */
  function syncToggle(cb) {
    var f = document.getElementById(cb.getAttribute("data-toggles"));
    if (!f) return;
    f.hidden = !cb.checked;
    var input = f.querySelector("input");
    input.required = cb.checked;
    if (!cb.checked) clearError(input);
  }
  document.querySelectorAll("[data-toggles]").forEach(function (cb) { cb.addEventListener("change", function () { syncToggle(cb); }); });

  var parentField = document.getElementById("peakeskus-field");
  var parentInput = document.getElementById("peakeskus");
  function syncBranch() {
    if (!parentField) return;
    var checked = document.querySelector('input[name="tyyp"]:checked');
    var isBranch = !!checked && checked.value === "filiaal";
    parentField.hidden = !isBranch;
    parentInput.required = isBranch;
    if (!isBranch) clearError(parentInput);
  }
  document.querySelectorAll('input[name="tyyp"]').forEach(function (r) { r.addEventListener("change", syncBranch); });

  /* ---------- Validation ---------- */
  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  function isPhone(v) { return /^\+?\d{7,15}$/.test(v.replace(/[\s()-]/g, "")); }
  var errCount = 0;

  function errorHost(field) {
    if (field.matches("fieldset")) return field;
    return field.closest(".field") || field.closest("label") || field.parentNode;
  }
  function showError(field, msg) {
    var err = field._err;
    if (!err) {
      err = document.createElement("p");
      err.className = "field-error";
      err.id = "viga-" + (++errCount);
      field._err = err;
      if (field.type === "checkbox" && !field.closest("fieldset")) field.closest("label").insertAdjacentElement("afterend", err);
      else errorHost(field).appendChild(err);
    }
    err.textContent = msg;
    err.hidden = false;
    var targets = field.matches("fieldset") ? field.querySelectorAll("input") : [field];
    targets.forEach(function (t) {
      t.setAttribute("aria-invalid", "true");
      var d = (t.getAttribute("aria-describedby") || "").split(" ").filter(function (x) { return x && x !== err.id; });
      d.push(err.id);
      t.setAttribute("aria-describedby", d.join(" "));
    });
  }
  function clearError(field) {
    if (!field) return;
    var err = field._err;
    var targets = field.matches("fieldset") ? field.querySelectorAll("input") : [field];
    targets.forEach(function (t) {
      t.removeAttribute("aria-invalid");
      if (err) {
        var d = (t.getAttribute("aria-describedby") || "").split(" ").filter(function (x) { return x && x !== err.id; });
        if (d.length) t.setAttribute("aria-describedby", d.join(" ")); else t.removeAttribute("aria-describedby");
      }
    });
    if (err) err.hidden = true;
  }
  var MSG_EMAIL = "Kontrolli e-posti aadressi. See peaks olema kujul nimi@näide.ee.";
  var MSG_PHONE = "Kontrolli numbrit. Telefoninumbris peaks olema vähemalt 7 numbrit.";
  function checkField(field) {
    if (field.closest("[hidden]")) { clearError(field); return true; }
    if (field.matches("fieldset")) {
      var ok = !!field.querySelector("input:checked");
      if (ok) clearError(field); else showError(field, field.getAttribute("data-msg") || "Vali vähemalt üks.");
      return ok;
    }
    var v = (field.value || "").trim();
    var msg = null;
    if (field.type === "checkbox") { if (field.required && !field.checked) msg = field.getAttribute("data-msg") || "See on vajalik."; }
    else if (!v) { if (field.required) msg = field.getAttribute("data-msg") || "See väli on vajalik."; }
    else if (field.type === "email" && !EMAIL.test(v)) msg = MSG_EMAIL;
    else if (field.getAttribute("data-type") === "contact" && !EMAIL.test(v) && !isPhone(v)) msg = v.indexOf("@") !== -1 || /[a-z]/i.test(v) ? MSG_EMAIL : MSG_PHONE;
    else if (field.getAttribute("data-type") === "phone" && !isPhone(v)) msg = MSG_PHONE;
    if (msg) showError(field, msg); else clearError(field);
    return !msg;
  }
  function fieldsOf(form) {
    var out = [];
    form.querySelectorAll("input, select, textarea, fieldset[data-required-group]").forEach(function (el) {
      if (el.type === "hidden" || el.type === "radio" || el.disabled) return;
      if (el.type === "checkbox" && el.closest("fieldset[data-required-group]")) return;
      out.push(el);
    });
    return out;
  }
  function validate(form) {
    var firstBad = null;
    fieldsOf(form).forEach(function (f) { if (!checkField(f) && !firstBad) firstBad = f; });
    if (firstBad) {
      var target = firstBad.matches("fieldset") ? firstBad.querySelector("input") : firstBad;
      scrollToEl(firstBad.closest(".field") || firstBad.closest("label") || firstBad, "center");
      focusNoScroll(target);
    }
    return !firstBad;
  }

  document.querySelectorAll(".js-preview-form").forEach(function (form) {
    function recheck(e, always) {
      if (!form.classList.contains("was-checked")) return;
      var f = e.target.closest("fieldset[data-required-group]") || e.target;
      if (always || (f._err && !f._err.hidden)) checkField(f);
    }
    form.addEventListener("input", function (e) { recheck(e, false); });
    form.addEventListener("change", function (e) { recheck(e, true); });
    form.addEventListener("focusout", function (e) {
      if (e.target.matches("input:not([type=radio]):not([type=checkbox]), select, textarea")) recheck(e, true);
    });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      form.classList.add("was-checked");
      if (validate(form)) showSuccess(form);
    });
  });

  function showSuccess(form) {
    var box = form.querySelector(".form-success");
    if (!box) {
      box = document.createElement("div");
      box.className = "form-success";
      box.setAttribute("role", "status");
      box.innerHTML =
        '<div class="success-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M6 12.5l4 4 8-9"/></svg></div>' +
        '<p class="success-title" tabindex="-1"></p>' +
        '<p class="success-text"></p>' +
        '<p class="success-preview">See on eelvaade. Tegelikult ei saadetud midagi ja andmeid ei salvestatud.</p>' +
        '<button type="button" class="button secondary again"></button>';
      form.appendChild(box);
      box.querySelector(".again").addEventListener("click", function () {
        form.reset();
        form.classList.remove("was-checked", "is-done");
        fieldsOf(form).forEach(clearError);
        form.querySelectorAll("[data-toggles]").forEach(syncToggle);
        if (form.contains(parentField)) syncBranch();
        box.hidden = true;
        var first = form.querySelector("input:not([type=hidden]):not([disabled]):not([type=radio]), select, textarea");
        scrollToEl(form, "start");
        focusNoScroll(first);
      });
    }
    var nameField = form.querySelector('[name="nimi"]');
    var first = nameField && nameField.value.trim().split(/\s+/)[0];
    box.querySelector(".success-title").textContent = first ? "Aitäh, " + first + "!" : "Aitäh!";
    box.querySelector(".success-text").textContent = form.getAttribute("data-note") || "";
    box.querySelector(".again").textContent = form.getAttribute("data-again") || "Täida uuesti";
    box.hidden = false;
    form.classList.add("is-done");
    var host = form.closest(".panel") || form;
    var r = host.getBoundingClientRect();
    if (r.top < 70 || r.top > (window.innerHeight || 800) * 0.6) scrollToEl(host, "start");
    focusNoScroll(box.querySelector(".success-title"));
  }

  /* Arriving with a hash from another page: focus the target too. */
  if (location.hash.length > 1) {
    var id = decodeURIComponent(location.hash.slice(1));
    window.addEventListener("load", function () { var t = document.getElementById(id); if (t) focusNoScroll(t.tagName === "SECTION" ? (t.querySelector("h1, h2") || t) : t); });
  }
})();
