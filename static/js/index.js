(() => {
  "use strict";

  const body = document.body;
  const header = document.querySelector("[data-header]");
  const nav = document.querySelector("[data-nav]");
  const navToggle = document.querySelector("[data-nav-toggle]");
  const toast = document.querySelector("[data-toast]");
  let toastTimer;

  const updateHeader = () => {
    header?.classList.toggle("is-scrolled", window.scrollY > 18);
  };

  const closeNav = () => {
    if (!nav || !navToggle) return;
    nav.classList.remove("is-open");
    navToggle.setAttribute("aria-expanded", "false");
    body.classList.remove("nav-open");
  };

  navToggle?.addEventListener("click", () => {
    const willOpen = navToggle.getAttribute("aria-expanded") !== "true";
    navToggle.setAttribute("aria-expanded", String(willOpen));
    nav?.classList.toggle("is-open", willOpen);
    body.classList.toggle("nav-open", willOpen);
  });

  nav?.querySelectorAll("a").forEach((link) => link.addEventListener("click", closeNav));

  window.addEventListener("scroll", updateHeader, { passive: true });
  window.addEventListener("resize", () => {
    if (window.innerWidth > 780) closeNav();
  });
  updateHeader();

  document.querySelectorAll("[data-tabs]").forEach((tabGroup) => {
    const tabs = [...tabGroup.querySelectorAll("[role='tab']")];
    const panels = [...tabGroup.querySelectorAll("[role='tabpanel']")];

    const selectTab = (tab, focus = false) => {
      tabs.forEach((item) => {
        const selected = item === tab;
        item.setAttribute("aria-selected", String(selected));
        item.tabIndex = selected ? 0 : -1;
      });
      panels.forEach((panel) => {
        panel.hidden = panel.dataset.panel !== tab.dataset.tab;
      });
      if (focus) tab.focus();
    };

    tabs.forEach((tab, index) => {
      tab.addEventListener("click", () => selectTab(tab));
      tab.addEventListener("keydown", (event) => {
        if (!["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        let targetIndex = index;
        if (["ArrowRight", "ArrowDown"].includes(event.key)) targetIndex = (index + 1) % tabs.length;
        if (["ArrowLeft", "ArrowUp"].includes(event.key)) targetIndex = (index - 1 + tabs.length) % tabs.length;
        if (event.key === "Home") targetIndex = 0;
        if (event.key === "End") targetIndex = tabs.length - 1;
        selectTab(tabs[targetIndex], true);
      });
    });
  });

  const showToast = (message) => {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("is-visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 2200);
  };

  const copyText = async (text) => {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return;
    }
    const field = document.createElement("textarea");
    field.value = text;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.opacity = "0";
    document.body.appendChild(field);
    field.select();
    document.execCommand("copy");
    field.remove();
  };

  document.querySelectorAll("[data-copy]").forEach((button) => {
    button.addEventListener("click", async () => {
      const source = document.querySelector(button.dataset.copy);
      if (!source) return;
      try {
        await copyText(source.textContent.trim());
        showToast("Copied to clipboard");
      } catch {
        showToast("Copy failed — select the text manually");
      }
    });
  });

  const dialog = document.querySelector("[data-lightbox-dialog]");
  const dialogImage = dialog?.querySelector("img");
  const closeDialog = () => {
    if (!dialog?.open) return;
    dialog.close();
  };

  document.querySelectorAll("[data-lightbox]").forEach((trigger) => {
    trigger.addEventListener("click", () => {
      if (!dialog || !dialogImage) return;
      dialogImage.src = trigger.dataset.lightbox;
      dialogImage.alt = trigger.dataset.alt || "Expanded research figure";
      body.classList.add("lightbox-open");
      dialog.showModal();
    });
  });

  dialog?.querySelector("[data-lightbox-close]")?.addEventListener("click", closeDialog);
  dialog?.addEventListener("click", (event) => {
    if (event.target === dialog) closeDialog();
  });
  dialog?.addEventListener("close", () => {
    body.classList.remove("lightbox-open");
    if (dialogImage) dialogImage.src = "";
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeNav();
  });

  const revealItems = document.querySelectorAll("[data-reveal]");
  if (!("IntersectionObserver" in window) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    revealItems.forEach((item) => item.classList.add("is-visible"));
    return;
  }

  document.documentElement.classList.add("reveal-ready");
  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      observer.unobserve(entry.target);
    });
  }, { rootMargin: "0px 0px -8%", threshold: 0.08 });

  revealItems.forEach((item) => revealObserver.observe(item));
})();
