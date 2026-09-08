(() => {
  "use strict";

  const body = document.body;
  const header = document.querySelector("[data-header]");
  const nav = document.querySelector("[data-nav]");
  const navToggle = document.querySelector("[data-nav-toggle]");
  const toast = document.querySelector("[data-toast]");
  let toastTimer;

  // Empty slots remain readable placeholders and never request nonexistent files.
  document.querySelectorAll("[data-demo]").forEach((stage) => {
    const media = window.fireNavDemoMedia?.[stage.dataset.demo];
    if (!media?.src || !["image", "video"].includes(media.type)) return;
    const label = stage.getAttribute("aria-label");
    const placeholder = stage.querySelector(".demo-placeholder");
    const showMediaError = () => {
      const message = placeholder?.querySelector("span:last-child");
      if (message) message.textContent = "Media unavailable. Please try again later.";
      if (placeholder) stage.replaceChildren(placeholder);
    };

    if (media.type === "image") {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "zoom-trigger";
      button.dataset.lightbox = media.src;
      button.dataset.alt = media.alt || label;
      button.setAttribute("aria-label", `Enlarge ${label}`);
      const img = document.createElement("img");
      img.alt = media.alt || label;
      img.loading = "lazy";
      img.addEventListener("error", showMediaError, { once: true });
      img.src = media.src;
      button.append(img);
      stage.replaceChildren(button);
      return;
    }

    const video = document.createElement("video");
    video.controls = true;
    video.playsInline = true;
    video.preload = "none";
    video.setAttribute("aria-label", label);
    if (media.poster) video.poster = media.poster;
    if (media.captions) {
      const track = document.createElement("track");
      track.kind = "captions";
      track.src = media.captions;
      track.srclang = media.captionLanguage || "en";
      track.label = media.captionLabel || "English";
      video.append(track);
    }
    video.addEventListener("error", showMediaError);
    video.src = media.src;
    video.append("Your browser does not support HTML video.");
    stage.replaceChildren(video);

    const categorySelect = stage.closest("#navigation-demos")?.querySelector("[data-navigation-category]");
    const updateCategory = () => {
      const selected = media.categories?.[categorySelect.value];
      if (!selected?.src) return;
      video.pause();
      video.poster = selected.poster || "";
      video.src = selected.src;
      const method = stage.closest("[data-navigation-method]").dataset.navigationMethod;
      const categoryLabel = categorySelect.selectedOptions[0].textContent;
      const videoLabel = `${categoryLabel}: ${method}, ${stage.dataset.navigationView}`;
      stage.setAttribute("aria-label", videoLabel);
      video.setAttribute("aria-label", videoLabel);
      stage.replaceChildren(video);
      video.load();
    };
    categorySelect?.addEventListener("change", updateCategory);
    if (categorySelect && categorySelect.value !== "person") updateCategory();
  });

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
