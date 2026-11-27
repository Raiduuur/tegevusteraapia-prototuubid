(function () {
  "use strict";

  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var scrollBehavior = reduceMotion ? "auto" : "smooth";

  function scrollToEl(el, block) {
    if (!el) return;
    el.scrollIntoView({ behavior: scrollBehavior, block: block || "start" });
  }
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
    document.documentElement.classList.toggle("menu-is-open", open);
    if (!open && returnFocus) menuBtn.focus();
    if (open) {
      var first = menu.querySelector("a");
      if (first) first.focus();
    }
  }
  if (menuBtn && menu) {
    menuBtn.addEventListener("click", function () { setMenu(menu.hidden); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !menu.hidden) setMenu(false, true);
    });
    document.addEventListener("click", function (e) {
      if (!menu.hidden && !menu.contains(e.target) && !menuBtn.contains(e.target)) setMenu(false);
    });
    window.addEventListener("resize", function () {
      if (!menu.hidden && window.getComputedStyle(menuBtn).display === "none") setMenu(false);
    });
  }

  /* ---------- In-page links: smooth scroll + move focus to target ---------- */
  document.addEventListener("click", function (e) {
    var link = e.target.closest && e.target.closest('a[href^="#"]');
    if (!link) return;
    var id = link.getAttribute("href").slice(1);
    var target = id ? document.getElementById(id) : document.body;
    if (!target) return;
    e.preventDefault();
    if (menu && !menu.hidden) setMenu(false);
    if (!id) { window.scrollTo({ top: 0, behavior: scrollBehavior }); history.replaceState(null, "", location.pathname); return; }
    // focus the section heading if a section is the target
    var focusEl = target.tagName === "SECTION" ? (target.querySelector("h1, h2") || target) : target;
    scrollToEl(target, "start");
    focusNoScroll(focusEl);
    if (target.classList.contains("spec")) flash(target);
    history.replaceState(null, "", "#" + id);
  });

  function flash(el) {
    el.classList.remove("is-flash");
    void el.offsetWidth;
    el.classList.add("is-flash");
    window.setTimeout(function () { el.classList.remove("is-flash"); }, 1600);
  }

  /* ---------- "Millega sa abi vajad?" guidance ---------- */
  var specNames = {
    lapsed: "Lapsed ja areng",
    taastusravi: "Taastusravi pärast insulti või traumat",
    eakad: "Eakad ja kodus toimetulek",
    kasi: "Käeteraapia",
    abivahendid: "Abivahendid ja kodu kohandamine",
    too: "Töövõime ja tööle naasmine",
    trauma: "Trauma-teadlik tegevusteraapia"
  };
  var needs = {
    soomine: { specs: ["taastusravi", "eakad"], text: "Kui söömine või süüa tegemine on muutunud raskeks, proovib terapeut sinuga eri võtteid ja vahendeid, näiteks jämedama varrega lusikat või kõrgema servaga taldrikut. Lapse puhul vaata eriala „Lapsed ja areng”." },
    riietumine: { specs: ["taastusravi", "eakad"], text: "Kui nööbid, lukk, paelad või riidesse panek võtavad palju aega, harjutab terapeut sinuga väikeste sammude kaupa ja näitab lihtsamaid võtteid." },
    kirjutamine: { specs: ["kasi", "lapsed"], text: "Kui pliiatsit on raske hoida või käsi väsib kiiresti, sobib käeteraapiaga tegelev terapeut. Kooliealise lapse puhul lastega töötav terapeut." },
    kodu: { specs: ["eakad", "abivahendid"], text: "Kui kodus liikumine, pesemine või süüa tegemine on muutunud keeruliseks, vaatab terapeut koos sinuga, mida kodus muuta ja millised abivahendid aitaksid." },
    laps: { specs: ["lapsed"], text: "Kui lapsel on raske mängida, süüa, riietuda, kirjutada või päeva rütmiga kaasa tulla, sobib lastega töötav tegevusterapeut. Ka vanem saab nõu, kuidas kodus harjutada." },
    kasi: { specs: ["kasi"], text: "Kui käsi või sõrmed ei tööta nagu varem, näiteks pärast vigastust või operatsiooni, sobib käeteraapiaga tegelev tegevusterapeut." },
    insult: { specs: ["taastusravi"], text: "Pärast insulti, traumat või operatsiooni aitab terapeut uuesti õppida igapäevaseid toiminguid: pesemist, riietumist, süüa tegemist." },
    too: { specs: ["too"], text: "Kui pärast haigust või vigastust on raske tööle naasta, vaatate terapeudiga koos, mida töö nõuab ja mida saab töökohal muuta." },
    muu: { specs: [], title: "Aitame valida koos", text: "Pole hullu, kui sa ei oska veel öelda. Kirjuta paari sõnaga, mis on raske, ja aitame leida sobiva tegevusterapeudi." }
  };

  var needButtons = document.querySelectorAll("[data-need]");
  var panel = document.getElementById("choice-result");
  var title = document.getElementById("result-title");
  var list = document.getElementById("result-specs");
  var text = document.getElementById("result-text");
  var needInput = document.getElementById("abi-vajadus");
  var specCards = document.querySelectorAll(".spec[data-spec]");

  needButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      var key = btn.getAttribute("data-need");
      var need = needs[key];
      if (!need) return;
      needButtons.forEach(function (other) {
        other.setAttribute("aria-pressed", other === btn ? "true" : "false");
      });
      var wasHidden = panel.hidden;
      list.innerHTML = "";
      need.specs.forEach(function (id) {
        var li = document.createElement("li");
        var tag = document.createElement("span");
        tag.textContent = specNames[id];
        li.appendChild(tag);
        list.appendChild(li);
      });
      list.hidden = need.specs.length === 0;
      text.textContent = need.text;
      title.textContent = need.title || "Sulle võiks sobida";
      needInput.value = key;
      specCards.forEach(function (card) {
        card.classList.toggle("is-match", need.specs.indexOf(card.getAttribute("data-spec")) !== -1);
      });
      panel.hidden = false;
      if (!reduceMotion) {
        panel.classList.remove("is-updated");
        void panel.offsetWidth;
        panel.classList.add("is-updated");
      }
      // Bring the guidance into view only if it is not already comfortably visible
      var r = panel.getBoundingClientRect();
      var vh = window.innerHeight || document.documentElement.clientHeight;
      if (wasHidden || r.top < 70 || r.top > vh * 0.6) scrollToEl(panel, "start");
    });
  });

  /* ---------- Filiaal needs a parent centre ---------- */
  var parentField = document.getElementById("peakeskus-field");
  var parentInput = document.getElementById("peakeskus");
  document.querySelectorAll('input[name="tyyp"]').forEach(function (radio) {
    radio.addEventListener("change", function () {
      if (!radio.checked) return;
      var isBranch = radio.value === "filiaal";
      parentField.hidden = !isBranch;
      parentInput.required = isBranch;
      if (!isBranch) clearError(parentInput);
    });
  });

  /* ---------- Validation ---------- */
  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  function isPhone(v) { var d = v.replace(/[\s()+-]/g, ""); return /^\d{7,15}$/.test(d); }

  var errorCount = 0;
  function errorHost(field) {
    if (field.matches("fieldset")) return field;
    var label = field.closest("label");
    if (label && label.classList.contains("check-line")) return label.parentNode; // consent line: after label
    return label || field.parentNode;
  }
  function showError(field, msg) {
    var host = errorHost(field);
    var err = field._err;
    if (!err) {
      err = document.createElement("span");
      err.className = "field-error";
      err.id = "err-" + (++errorCount);
      field._err = err;
      if (field.matches('input[type="checkbox"]') && !field.closest("fieldset")) {
        field.closest("label").insertAdjacentElement("afterend", err);
      } else {
        host.appendChild(err);
      }
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
    field.classList.add("has-error");
  }
  function clearError(field) {
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
    field.classList.remove("has-error");
  }

  function checkField(field) {
    if (field.closest("[hidden]")) { clearError(field); return true; }
    if (field.matches("fieldset")) {
      var ok = field.querySelector("input:checked") !== null;
      if (ok) clearError(field); else showError(field, field.getAttribute("data-msg") || "Vali vähemalt üks.");
      return ok;
    }
    var v = (field.value || "").trim();
    var msg = null;
    if (field.type === "checkbox") {
      if (field.required && !field.checked) msg = field.getAttribute("data-msg") || "See on vajalik.";
    } else if (!v) {
      if (field.required) msg = field.getAttribute("data-msg") || "See väli on vajalik.";
    } else if (field.type === "email" && !EMAIL.test(v)) {
      msg = "Kontrolli e-posti aadressi. See peaks olema kujul nimi@näide.ee.";
    } else if (field.getAttribute("data-type") === "contact" && !EMAIL.test(v) && !isPhone(v)) {
      msg = v.indexOf("@") !== -1 ? "Kontrolli e-posti aadressi. See peaks olema kujul nimi@näide.ee." : "Kontrolli numbrit. Telefoninumbris peaks olema vähemalt 7 numbrit.";
    } else if (field.getAttribute("data-type") === "phone" && !isPhone(v)) {
      msg = "Kontrolli numbrit. Telefoninumbris peaks olema vähemalt 7 numbrit.";
    }
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
    fieldsOf(form).forEach(function (f) {
      if (!checkField(f) && !firstBad) firstBad = f;
    });
    if (firstBad) {
      var focusTarget = firstBad.matches("fieldset") ? firstBad.querySelector("input") : firstBad;
      var anchor = firstBad.closest("label") || firstBad;
      scrollToEl(anchor, "center");
      try { focusTarget.focus({ preventScroll: true }); } catch (e) { focusTarget.focus(); }
    }
    return !firstBad;
  }
  function liveRevalidate(form) {
    form.addEventListener("input", function (e) {
      if (!form.classList.contains("was-checked")) return;
      var f = e.target.closest("fieldset[data-required-group]") || e.target;
      if (f._err && !f._err.hidden) checkField(f);
    });
    form.addEventListener("change", function (e) {
      if (!form.classList.contains("was-checked")) return;
      var f = e.target.closest("fieldset[data-required-group]") || e.target;
      checkField(f);
    });
    form.addEventListener("focusout", function (e) {
      if (!form.classList.contains("was-checked")) return;
      var t = e.target;
      if (t.matches("input:not([type=radio]):not([type=checkbox]), select, textarea")) checkField(t);
    });
  }

  /* ---------- Preview forms: validate, then show a success state. Nothing is sent. ---------- */
  document.querySelectorAll(".js-preview-form").forEach(function (form) {
    if (form.classList.contains("search-form")) return;
    liveRevalidate(form);
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      form.classList.add("was-checked");
      if (!validate(form)) return;
      showSuccess(form);
    });
  });

  function showSuccess(form) {
    var box = form.querySelector(".form-success");
    if (!box) {
      box = document.createElement("div");
      box.className = "form-success";
      box.setAttribute("role", "status");
      box.innerHTML =
        '<p class="success-title" tabindex="-1">Aitäh!</p>' +
        '<p class="success-text"></p>' +
        '<p class="success-preview">See on eelvaade. Tegelikult ei saadetud midagi ja andmeid ei salvestatud.</p>' +
        '<button type="button" class="button secondary again"></button>';
      form.appendChild(box);
      box.querySelector(".again").addEventListener("click", function () {
        form.reset();
        form.classList.remove("was-checked", "is-done");
        fieldsOf(form).forEach(clearError);
        if (parentField && form.contains(parentField)) { parentField.hidden = true; parentInput.required = false; }
        box.hidden = true;
        var first = form.querySelector("input:not([type=hidden]):not([disabled]), select, textarea");
        scrollToEl(form, "start");
        if (first) { try { first.focus({ preventScroll: true }); } catch (e) { first.focus(); } }
      });
    }
    box.querySelector(".success-text").textContent = form.getAttribute("data-note") || "";
    box.querySelector(".again").textContent = form.getAttribute("data-again") || "Täida uuesti";
    box.hidden = false;
    form.classList.add("is-done");
    var rect = form.getBoundingClientRect();
    if (rect.top < 70 || rect.top > (window.innerHeight || 800) * 0.5) scrollToEl(form, "start");
    focusNoScroll(box.querySelector(".success-title"));
  }

  /* ---------- Piirkonna otsing ---------- */
  var search = document.getElementById("otsi-vorm");
  if (search) {
    var result = document.getElementById("search-result");
    var county = search.querySelector('[name="maakond"]');
    var town = search.querySelector('[name="linn"]');
    search.addEventListener("submit", function (e) {
      e.preventDefault();
      result.className = "search-result";
      if (!county.value) {
        county.setAttribute("aria-invalid", "true");
        county.setAttribute("aria-describedby", "search-result");
        result.classList.add("is-error");
        result.textContent = "Vali enne otsimist maakond.";
        county.focus();
        return;
      }
      county.removeAttribute("aria-invalid");
      county.removeAttribute("aria-describedby");
      var place = county.value.replace(/maa$/, "maal");
      var t = town.value.trim();
      result.classList.add("is-shown");
      result.innerHTML = "";
      var p1 = document.createElement("p");
      p1.className = "search-result-title";
      p1.textContent = place + " ei ole veel ühtegi tegevusterapeuti ega keskust.";
      var p2 = document.createElement("p");
      p2.textContent = (t ? "Otsisid: " + t + ", " + county.value + ". " : "") + "Terapeudid ja keskused ilmuvad siia, kui nad liituvad. Kui vajad abi juba praegu, jäta kontakt ja võtame sinuga ühendust.";
      var a = document.createElement("a");
      a.href = "#page-title";
      a.className = "text-link";
      a.textContent = "Vali, mis on raske, ja jäta kontakt";
      result.appendChild(p1); result.appendChild(p2); result.appendChild(a);
    });
    county.addEventListener("change", function () {
      if (county.value && result.classList.contains("is-error")) { result.className = "search-result"; result.textContent = ""; county.removeAttribute("aria-invalid"); }
    });
  }
})();
