# Fire template and sensor galleries

This gallery contains the original template images and matching FireSensor boards
for all 36 scenes and 144 template views from `medium_36_stronger_20260912`.

Each scene is organized alongside its existing model and inventory:

```text
scens/<scene_id>/
  <scene_id>.semantic.glb
  inventory.json
  fire/
    manifest.json
    plan.json
    01_kitchen_grease_fire/
      template_scene.png
      sensor_dashboard.png
    02_bedroom_textile/
      template_scene.png
      sensor_dashboard.png
    03_living_room_electric/
      template_scene.png
      sensor_dashboard.png
    04_multi_origin/
      template_scene.png
      sensor_dashboard.png
```

`fire-gallery.json` indexes every scene and both images for every view. The website
uses this manifest for the linked scene selectors in **Four semantic templates**
and **Hazard-coupled perception**. Selecting a template changes the sensor board;
each image opens at its original resolution.

The PNG files were transferred without image processing and verified with SHA-256
before their source copies were removed.
The per-scene `plan.json` is preserved from the source export. View metadata records
the capture time, source object, and any semantic fallback. All four views within a
scene share the export's medium multi-origin plan; these are captured views, not
four independently simulated timelines. The original raw sensor arrays, component
images, and rendering logs are outside the scope of this website image gallery.
