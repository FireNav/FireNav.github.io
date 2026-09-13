(() => {
  "use strict";

  const sceneSelectors = [...document.querySelectorAll("[data-gallery-scene]")];
  const templateImages = [...document.querySelectorAll("[data-gallery-template]")];
  const templateButtons = [...document.querySelectorAll("[data-gallery-sensor-template]")];
  const board = document.querySelector("[data-gallery-board]");
  if (!sceneSelectors.length || !board) return;

  const statuses = [...document.querySelectorAll("[data-gallery-status]")];
  const images = [...templateImages, board].map((trigger) => trigger.querySelector("img"));
  let scenes = [];
  let activeScene;
  let activeTemplate = "kitchen_grease_fire";

  const updateStatus = () => {
    if (!activeScene) return;
    const position = scenes.indexOf(activeScene) + 1;
    statuses.forEach((status) => {
      const section = status.closest("section");
      const failed = images.some((image) => section.contains(image) && image.dataset.failed === "true");
      status.textContent = failed
        ? "An image could not load. Select the scene again to retry."
        : `Scene ${position} of ${scenes.length} · 4 template views · Medium fire`;
    });
  };

  images.forEach((image) => {
    image.addEventListener("error", () => {
      image.dataset.failed = "true";
      updateStatus();
    });
    image.addEventListener("load", () => {
      delete image.dataset.failed;
      updateStatus();
    });
  });

  const describe = (view) => {
    const source = view.semanticFallback ? "Alternate source" : "Source";
    return `${source}: ${view.sourceCategory} · t = ${view.timeSeconds} s`;
  };

  const updateImage = (trigger, path, description) => {
    const image = trigger.querySelector("img");
    trigger.dataset.lightbox = path;
    trigger.dataset.alt = description;
    trigger.setAttribute("aria-label", `Enlarge ${description}`);
    image.alt = description;
    if (image.getAttribute("src") !== path || image.dataset.failed === "true") {
      delete image.dataset.failed;
      image.src = path;
    }
  };

  const renderSensor = () => {
    const view = activeScene.views.find((item) => item.id === activeTemplate);
    if (!view) return;
    templateButtons.forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.gallerySensorTemplate === view.id));
    });
    updateImage(board, view.sensorImage, `${view.label} sensor board in scene ${activeScene.id}: clean and smoke-affected RGB and depth, thermal IR, LiDAR, and radar`);
    document.querySelector("[data-gallery-sensor-title]").textContent = view.label;
    document.querySelector("[data-gallery-sensor-caption]").textContent = `Scene ${activeScene.id} · ${describe(view)}`;
    updateStatus();
  };

  const renderScene = (id) => {
    const scene = scenes.find((item) => item.id === id);
    if (!scene) return;
    activeScene = scene;
    sceneSelectors.forEach((select) => { select.value = id; });
    templateImages.forEach((trigger) => {
      const view = scene.views.find((item) => item.id === trigger.dataset.galleryTemplate);
      updateImage(trigger, view.image, `${view.label} in scene ${id}. ${describe(view)}`);
      document.querySelector(`[data-gallery-caption="${view.id}"]`).textContent = describe(view);
    });
    renderSensor();
  };

  sceneSelectors.forEach((select) => select.addEventListener("change", () => renderScene(select.value)));
  templateButtons.forEach((button) => button.addEventListener("click", () => {
    if (!activeScene) return;
    activeTemplate = button.dataset.gallerySensorTemplate;
    renderSensor();
  }));
  document.querySelectorAll("[data-gallery-show-sensor]").forEach((link) => {
    link.addEventListener("click", () => {
      if (!activeScene) return;
      activeTemplate = link.dataset.galleryShowSensor;
      renderSensor();
    });
  });

  const loadGallery = async () => {
    try {
      const response = await fetch("scens/fire-gallery.json");
      if (!response.ok) throw new Error(`Gallery manifest: HTTP ${response.status}`);
      const data = await response.json();
      const requiredTemplates = templateImages.map((item) => item.dataset.galleryTemplate);
      if (!Array.isArray(data.scenes) || !data.scenes.length || !data.scenes.every((scene) =>
        typeof scene.id === "string" && Array.isArray(scene.views) && requiredTemplates.every((id) =>
          scene.views.some((view) => view.id === id && view.image && view.sensorImage)))) {
        throw new Error("Incomplete scene gallery manifest");
      }
      scenes = data.scenes;
      sceneSelectors.forEach((select) => {
        select.replaceChildren(...scenes.map((scene) => new Option(scene.id, scene.id)));
        select.disabled = false;
      });
      templateButtons.forEach((button) => { button.disabled = false; });
      const defaultScene = scenes.some((scene) => scene.id === data.defaultScene) ? data.defaultScene : scenes[0].id;
      renderScene(defaultScene);
    } catch {
      statuses.forEach((status) => {
        status.textContent = window.location.protocol === "file:"
          ? "Open preview.cmd to browse all 36 scenes. The default scene is shown below."
          : "The scene list could not load. Reload to retry; the default scene is shown below.";
      });
    }
  };

  loadGallery();
})();
