(() => {
const explorer = document.querySelector("[data-scene-explorer]");

if (explorer) {
  const select = explorer.querySelector("#scene-select");
  const viewport = explorer.querySelector(".scene-viewport");
  const loading = explorer.querySelector(".scene-loading");
  const status = explorer.querySelector("[data-scene-status]");
  const retry = explorer.querySelector("[data-scene-retry]");
  const summary = explorer.querySelector("#scene-summary");
  const scroll = explorer.querySelector(".inventory-scroll");
  const list = explorer.querySelector("[data-inventory-list]");
  const json = explorer.querySelector("[data-inventory-json]");
  const search = explorer.querySelector("#inventory-search");
  const count = explorer.querySelector(".inventory-count");
  const appearance = explorer.querySelector("#scene-appearance");
  const cutaway = explorer.querySelector("#scene-cutaway");
  const top = explorer.querySelector("[data-scene-top]");
  const reset = explorer.querySelector("[data-scene-reset]");
  const modelControls = [appearance, cutaway, top, reset];
  if (window.location.protocol === "file:") {
    viewport.setAttribute("aria-busy", "false");
    scroll.setAttribute("aria-busy", "false");
    status.textContent = "To load this scene, double-click preview.cmd in the website folder. It opens the site through a local web server.";
    summary.textContent = "Local preview setup required";
    count.textContent = "The model and inventory load when the site is opened through HTTP.";
    const message = document.createElement("p");
    message.className = "inventory-empty";
    message.textContent = "Direct file opening blocks browser access to the scene data. Use preview.cmd, or run python -m http.server 8000 and open http://localhost:8000.";
    list.append(message);
    return;
  }
  let inventory = null;
  let controller;
  let revision = 0;
  let viewer;
  let visible = false;
  let started = false;
  let display = "instances";

  const format = (value) => {
    if (value == null) return "—";
    if (Array.isArray(value)) return value.map((n) => Number(n).toFixed(2)).join(", ");
    if (typeof value === "boolean") return value ? "Yes" : "No";
    return String(value);
  };

  const renderInventory = () => {
    list.replaceChildren();
    if (!inventory) return;
    const query = search.value.trim().toLowerCase();
    const instances = inventory.instances.filter((item) =>
      !query || String(item.category).toLowerCase().includes(query) || String(item.instance_id).includes(query));
    const fragment = document.createDocumentFragment();
    instances.forEach((item) => {
      const details = document.createElement("details");
      details.className = "inventory-instance";
      const title = document.createElement("summary");
      const swatch = document.createElement("span");
      swatch.className = "inventory-swatch";
      swatch.setAttribute("aria-hidden", "true");
      if (/^[0-9a-f]{6}$/i.test(item.color_hex)) swatch.style.backgroundColor = "#" + item.color_hex;
      const id = document.createElement("span");
      id.className = "inventory-instance-id";
      id.textContent = "#" + item.instance_id;
      title.append(swatch, document.createTextNode(item.category), id);
      const fields = document.createElement("dl");
      const properties = [
        ["Floor / region", format(item.floor_id) + " / " + format(item.region_id)],
        ["Structural", item.structural],
        ["Navigation goal", item.is_goal],
        ["Flammability", item.flammability],
        ["Smoke yield", item.smoke_yield],
        ["Centroid (m)", item.centroid],
        ["Bounds min (m)", item.aabb_min],
        ["Bounds max (m)", item.aabb_max],
        ["Faces", item.n_faces],
      ];
      properties.forEach(([label, value]) => {
        const dt = document.createElement("dt");
        const dd = document.createElement("dd");
        dt.textContent = label;
        dd.textContent = format(value);
        fields.append(dt, dd);
      });
      details.append(title, fields);
      fragment.append(details);
    });
    if (!instances.length) {
      const empty = document.createElement("p");
      empty.className = "inventory-empty";
      empty.textContent = "No instances match your search.";
      fragment.append(empty);
    }
    list.append(fragment);
    count.textContent = display === "json"
      ? "Complete inventory, including scene metadata and semantic summaries."
      : instances.length + " of " + inventory.instances.length + " instances · Expand for details";
  };

  search.addEventListener("input", () => {
    renderInventory();
    scroll.scrollTop = 0;
  });

  explorer.querySelectorAll("[data-inventory-view]").forEach((button) => {
    button.addEventListener("click", () => {
      display = button.dataset.inventoryView;
      explorer.querySelectorAll("[data-inventory-view]").forEach((item) =>
        item.setAttribute("aria-pressed", String(item === button)));
      list.hidden = display !== "instances";
      json.hidden = display !== "json";
      search.disabled = display === "json" || !inventory;
      scroll.scrollTop = 0;
      renderInventory();
    });
  });

  // Keep the rendering library local, and load it only when the explorer is used.
  const createViewer = async () => {
    const [THREE, { GLTFLoader }, { OrbitControls }] = await Promise.all([
      import("./vendor/three/three.module.js"),
      import("./vendor/three/GLTFLoader.js"),
      import("./vendor/three/OrbitControls.js"),
    ]);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setClearColor(0xe8e1d4);
    renderer.localClippingEnabled = true;
    renderer.domElement.setAttribute("aria-label", "Interactive 3D scene. Drag to rotate, scroll to zoom, or use the view buttons.");
    renderer.domElement.setAttribute("role", "img");
    viewport.prepend(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 1000);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.screenSpacePanning = true;
    const clipping = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
    const loader = new GLTFLoader();
    let model;
    let bounds;
    let materials = [];

    const render = () => {
      if (visible && model && !document.hidden) renderer.render(scene, camera);
    };
    controls.addEventListener("change", render);
    const resize = () => {
      const { width, height } = viewport.getBoundingClientRect();
      if (!width || !height) return;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
      render();
    };
    new ResizeObserver(resize).observe(viewport);
    document.addEventListener("visibilitychange", render);

    const dispose = (root) => {
      const geometries = new Set();
      const ownedMaterials = new Set();
      const textures = new Set();
      root?.traverse((object) => {
        if (object.geometry) geometries.add(object.geometry);
        if (object.material) {
          (Array.isArray(object.material) ? object.material : [object.material]).forEach((material) => {
            ownedMaterials.add(material);
            Object.values(material).forEach((value) => {
              if (value?.isTexture) textures.add(value);
            });
            if (material.userData.texture) textures.add(material.userData.texture);
          });
        }
      });
      const images = new Set();
      textures.forEach((texture) => { images.add(texture.source?.data); texture.dispose(); });
      images.forEach((image) => image?.close?.());
      ownedMaterials.forEach((material) => material.dispose());
      geometries.forEach((geometry) => geometry.dispose());
    };

    const clear = () => {
      if (model) { scene.remove(model); dispose(model); }
      model = null;
      materials = [];
      renderer.renderLists.dispose();
      renderer.clear();
    };

    const updateAppearance = () => {
      const semantic = appearance.value === "semantic";
      materials.forEach((material) => {
        material.map = semantic ? null : material.userData.texture;
        material.vertexColors = semantic && material.userData.hasColors;
        material.needsUpdate = true;
      });
      render();
    };

    const updateCutaway = () => {
      if (!bounds) return;
      const fraction = Number(cutaway.value) / 100;
      clipping.constant = THREE.MathUtils.lerp(bounds.min.y, bounds.max.y, fraction);
      materials.forEach((material) => {
        material.clippingPlanes = fraction < 1 ? [clipping] : [];
      });
      render();
    };

    const frame = (overhead = false) => {
      if (!bounds) return;
      resize();
      const center = bounds.getCenter(new THREE.Vector3());
      const size = bounds.getSize(new THREE.Vector3());
      const radius = size.length() * 0.5;
      const direction = (overhead ? new THREE.Vector3(0, 1, 0.001) : new THREE.Vector3(0.45, 1.25, 1)).normalize();
      const right = new THREE.Vector3().crossVectors(camera.up, direction).normalize();
      const up = new THREE.Vector3().crossVectors(direction, right);
      const tanVertical = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      const tanHorizontal = tanVertical * camera.aspect;
      let distance = 0;
      // Fit the projected box rather than a sphere, so wide floor plans fill the panel.
      for (const x of [bounds.min.x, bounds.max.x]) {
        for (const y of [bounds.min.y, bounds.max.y]) {
          for (const z of [bounds.min.z, bounds.max.z]) {
            const corner = new THREE.Vector3(x, y, z).sub(center);
            const depth = corner.dot(direction);
            distance = Math.max(distance,
              Math.abs(corner.dot(right)) / tanHorizontal + depth,
              Math.abs(corner.dot(up)) / tanVertical + depth);
          }
        }
      }
      distance *= 1.1;
      camera.near = Math.max(0.01, radius / 1000);
      camera.far = distance * 20;
      camera.updateProjectionMatrix();
      camera.position.copy(center).addScaledVector(direction, distance);
      controls.target.copy(center);
      controls.minDistance = radius * 0.08;
      controls.maxDistance = distance * 4;
      controls.update();
      render();
    };

    return {
      clear, render, frame, updateAppearance, updateCutaway,
      async load(buffer, isCurrent) {
        const gltf = await loader.parseAsync(buffer, "");
        if (!isCurrent()) { dispose(gltf.scene); return false; }
        model = gltf.scene;
        // These HM3D files use Z-up; inventories use Habitat's Y-up coordinates.
        model.rotation.x = -Math.PI / 2;
        const oldMaterials = new Set();
        model.traverse((object) => {
          if (!object.isMesh) return;
          const convert = (original) => {
            oldMaterials.add(original);
            const material = new THREE.MeshBasicMaterial({
              map: original.map,
              side: THREE.DoubleSide,
              toneMapped: false,
            });
            material.userData.texture = original.map;
            material.userData.hasColors = Boolean(object.geometry.attributes.color);
            materials.push(material);
            return material;
          };
          object.material = Array.isArray(object.material) ? object.material.map(convert) : convert(object.material);
        });
        oldMaterials.forEach((material) => material.dispose());
        scene.add(model);
        model.updateMatrixWorld(true);
        bounds = new THREE.Box3().setFromObject(model);
        updateAppearance();
        updateCutaway();
        frame();
        return true;
      },
    };
  };

  const readModel = async (url, signal, isCurrent) => {
    const response = await fetch(url, { signal });
    if (!response.ok) throw new Error("Model HTTP " + response.status);
    const total = Number(response.headers.get("content-length"));
    if (!response.body) return response.arrayBuffer();
    const reader = response.body.getReader();
    const chunks = [];
    let received = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.byteLength;
      if (isCurrent()) status.textContent = total
        ? "Loading 3D scene… " + Math.round(received / total * 100) + "%"
        : "Loading 3D scene… " + (received / 1048576).toFixed(1) + " MB";
    }
    const buffer = new Uint8Array(received);
    let offset = 0;
    chunks.forEach((chunk) => { buffer.set(chunk, offset); offset += chunk.length; });
    return buffer.buffer;
  };

  const loadScene = async () => {
    started = true;
    const version = ++revision;
    controller?.abort();
    controller = new AbortController();
    const { signal } = controller;
    const isCurrent = () => version === revision;
    const sceneId = select.value;
    const base = "scens/" + sceneId + "/";
    viewer?.clear();
    inventory = null;
    list.replaceChildren();
    json.textContent = "";
    search.value = "";
    search.disabled = true;
    scroll.scrollTop = 0;
    modelControls.forEach((control) => { control.disabled = true; });
    viewport.setAttribute("aria-busy", "true");
    scroll.setAttribute("aria-busy", "true");
    loading.hidden = false;
    retry.hidden = true;
    status.textContent = "Loading 3D scene…";
    summary.textContent = "Scene " + sceneId;
    count.textContent = "Loading inventory…";
    explorer.querySelector("[data-inventory-download]").href = base + "inventory.json";

    const inventoryTask = (async () => {
      try {
        const response = await fetch(base + "inventory.json", { signal });
        if (!response.ok) throw new Error("Inventory HTTP " + response.status);
        const data = await response.json();
        if (!Array.isArray(data.instances) || data.scene_id !== sceneId) throw new Error("Mismatched inventory");
        if (!isCurrent()) return;
        inventory = data;
        json.textContent = JSON.stringify(data, null, 2);
        const categories = new Set(data.instances.map((item) => item.category)).size;
        summary.textContent = data.instances.length + " instances · " + categories + " categories · " + data.floors.length + (data.floors.length === 1 ? " floor" : " floors");
        search.disabled = display === "json";
        renderInventory();
      } catch (error) {
        if (!isCurrent() || error.name === "AbortError") return;
        count.textContent = "Inventory could not be loaded. Use Retry loading to try again.";
        retry.hidden = false;
        loading.hidden = false;
        console.error("Scene inventory:", error);
      } finally {
        if (isCurrent()) scroll.setAttribute("aria-busy", "false");
      }
    })();

    const modelTask = (async () => {
      try {
        // Share initialization if a user switches scenes while modules load.
        viewer = await (viewerPromise ||= createViewer().catch((error) => { viewerPromise = null; throw error; }));
        if (!isCurrent()) return;
        const buffer = await readModel(base + sceneId + ".semantic.glb", signal, isCurrent);
        if (!isCurrent()) return;
        status.textContent = "Preparing scene for exploration…";
        const loaded = await viewer.load(buffer, isCurrent);
        if (!loaded) return;
        modelControls.forEach((control) => { control.disabled = false; });
        viewport.setAttribute("aria-busy", "false");
        status.textContent = "3D scene ready.";
        loading.hidden = retry.hidden;
      } catch (error) {
        if (!isCurrent() || error.name === "AbortError") return;
        viewport.setAttribute("aria-busy", "false");
        status.textContent = "The 3D scene could not be displayed. Retry or use a browser with WebGL enabled.";
        retry.hidden = false;
        console.error("Scene model:", error);
      }
    })();
    await Promise.allSettled([inventoryTask, modelTask]);
    if (isCurrent() && !inventory && !reset.disabled) {
      status.textContent = "The scene is ready, but its inventory could not be loaded. Please retry.";
    }
  };

  let viewerPromise;
  select.addEventListener("change", loadScene);
  retry.addEventListener("click", loadScene);
  appearance.addEventListener("change", () => viewer?.updateAppearance());
  cutaway.addEventListener("input", () => {
    explorer.querySelector("#scene-cutaway-value").textContent = cutaway.value + "%";
    viewer?.updateCutaway();
  });
  top.addEventListener("click", () => viewer?.frame(true));
  reset.addEventListener("click", () => viewer?.frame());
  if ("IntersectionObserver" in window) {
    new IntersectionObserver((entries) => {
      // Scrolling and resizing can queue more than one visibility change.
      const entry = entries[entries.length - 1];
      visible = entry.isIntersecting;
      if (visible && !started) loadScene();
      else if (visible) viewer?.render();
    }, { rootMargin: "100px" }).observe(explorer);
  } else {
    visible = true;
    loadScene();
  }
}
})();
