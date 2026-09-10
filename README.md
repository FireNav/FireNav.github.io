# FireNav project page

Static project website for **FireNav: A Physics-Grounded Benchmark for Cooperative Multi-Agent Navigation in Dynamic Indoor Fire Environments**.

## Preview locally

On Windows, double-click `preview.cmd`. It starts a hidden Python server bound
to localhost and opens the scene inventory in your browser. Running it again
reuses the same site if it is already served on ports 8000–8009.
Python must be installed. Use `powershell -File .\preview.ps1 -NoBrowser`
to start the server and print the URL without opening a browser.

Do not double-click `index.html` to preview the 3D explorer: browsers block
module and JSON/model loading through `file://`. The page now explains this
instead of leaving the scene and inventory blank.

Run any static file server from this directory, for example:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

## Publish

The site has no build step and can be served directly by GitHub Pages. Point the Pages deployment at this directory (or publish its contents at the repository root).

## Demo media

The page has an interactive scene explorer and 22 media slots, including nine fire-impact comparison players, six risk-awareness comparison players, and two physical experiment players. Configure their paths in [`static/js/demo-media.js`](static/js/demo-media.js). Empty `src` values display a clearly labeled placeholder without loading a missing file. The existing template videos are not assigned to research demos.

| Slot | Content | Suggested file path |
| --- | --- | --- |
| `fire-kitchen` | Kitchen Grease Fire evolution | `static/videos/fire-kitchen.mp4` |
| `fire-bedroom` | Bedroom Textile Fire evolution | `static/videos/fire-bedroom.mp4` |
| `fire-living-room` | Living-room Electrical Fire evolution | `static/videos/fire-living-room.mp4` |
| `fire-multi-origin` | Multi-origin Fire evolution | `static/videos/fire-multi-origin.mp4` |
| `sensor-observations` | Sensor observation demo | `static/videos/sensor-observations.mp4` |
| `normal-person-agent-0`, `normal-person-agent-1`, `normal-person-merged` | Conventional navigation without fire: success | `static/videos/normal_person_videos/{agent_0,agent_1,merged}.mp4` |
| `conventional-fire-person-agent-0`, `conventional-fire-person-agent-1`, `conventional-fire-person-merged` | Conventional navigation in fire: failure | `static/videos/fire_conventional_person/{agent_0,agent_1,merged}.mp4` |
| `firenav-person-agent-0`, `firenav-person-agent-1`, `firenav-person-merged` | FireNav in fire: success | `static/videos/fire_person_videos/oracle_{agent_0,agent_1,merged}.mp4` |
| `risk-blind-agent-0`, `risk-blind-agent-1`, `risk-blind-merged` | Risk-blind row: Robot 1, Robot 2, combined view | `static/videos/fire_{person,bed}_videos/risk_none_{agent_0,agent_1,merged}.mp4` |
| `risk-aware-agent-0`, `risk-aware-agent-1`, `risk-aware-merged` | Risk-aware row: Robot 1, Robot 2, combined view | `static/videos/fire_{person,bed}_videos/oracle_{agent_0,agent_1,merged}.mp4` |
| `physical-person` | Physical person-search experiment | `static/videos/physical_experiments/physical_experiments_person.mp4` |
| `physical-bed` | Physical bed-search experiment | `static/videos/physical_experiments/physical_experimens_bed.mp4` |

Copy each asset into the site directory, then set its `src` to a path relative to `index.html`. For example:

```js
"fire-kitchen": { type: "video", src: "static/videos/fire-kitchen.mp4" },
```

The scanned inventory section uses `static/js/scene-explorer.js` and `static/css/scene-explorer.css`. A scene selector switches between `Nfvxx8J5NCo` and `TEEsavR23oF`, loading the matching `.semantic.glb` and `_inventory.json` from `static/Scenes/`. Desktop shows the interactive model on the left and a fixed-height, independently scrollable inventory on the right; mobile stacks these panels. Inventory includes searchable, expandable instances and the complete JSON, with a download link. Counts use the recovered `instances` array rather than the larger source annotation totals.

Models load when the section enters view. The viewer supports orbit, zoom, pan, top/reset views, textured/semantic display, and a height cutaway to reveal interiors. These supplied GLBs are rotated from Z-up into the inventory's Y-up coordinates. Local Three.js 0.180.0 modules and their MIT license live in `static/js/vendor/three/`; no CDN is needed at runtime. Scene switching cancels pending downloads and disposes old model resources. Preview through an HTTP server (as above), since browser module/model loading requires HTTP rather than opening `index.html` directly.

Video players provide native playback, seeking, volume, and fullscreen controls. They use `playsinline` and initially use `preload="none"`. Each navigation comparison loads and autoplays muted when its section becomes visible; physical experiment players remain manual. Optional `poster` and `captions` fields accept an image path and a WebVTT path; captions default to English, configurable with `captionLanguage` and `captionLabel`. Prefer browser-compatible MP4 (H.264) and include captions when a recording contains speech. Keep labels, timestamps, and sensor panels legible in the full-width player.

The fire-impact section precedes the risk-awareness comparison and shows person search in three rows of three views: conventional navigation without fire (success), conventional navigation in fire (failure), and FireNav in fire (success). Columns show Robot 1, Robot 2, and the combined view. All nine players synchronize playback, pause, seeking, and speed within their own section using `data-synchronized-videos`; controls do not affect the separate risk-awareness comparison. Recordings share elapsed playback time at their original speed. Shorter recordings hold their final frame until the longest finishes, then the group restarts together.

The navigation section compares two methods in two rows of three players on desktop: risk-blind above risk-aware (ours), each with Robot 1, Robot 2, and combined views. A single Category selector at the upper right switches all six players between person and bed search. The risk-blind row uses `risk_none` recordings, and the risk-aware row uses the existing `oracle` recordings. Each slot maps `categories.person` and `categories.bed` to a video source and its matching poster; `src` and `poster` provide the default person-search view. Switching categories resets all six players and starts the new comparison together. `static/js/navigation-playback.js` synchronizes playback, pause, seeking, and playback speed across all six players. Shorter recordings hold their final frame until the longest finishes, then all six restart together. The compact comparison uses each video's native controls to pause, play, or seek all six videos together; there is no separate playback toolbar. Leaving the section or hiding the browser tab pauses playback; returning resumes unless the user manually paused. When the browser blocks autoplay, pressing play on any video starts the comparison with a user gesture. Smaller screens stack the players vertically.

Physical deployment and experiments share one section, with the two-robot hardware photo in `static/images/robots.png` and only the two recordings from `physical_experiments/`. The original spelling `physical_experimens_bed.mp4` is preserved in its path.

## Code and fire plans

Source code and repository documentation are available in the [anonymous FireNav repository](https://anonymous.4open.science/r/FireNav/README.md).

Fire plans are available in the repository at `scenes/<scene_id>/plans`, where `<scene_id>` is the scene identifier. Each plan is stored as a JSON file.

For example, browse the [plans for scene `4ok3usBNeis`](https://anonymous.4open.science/r/FireNav/scenes/4ok3usBNeis/plans/) or open this [multi-origin, medium-severity fire plan](https://anonymous.4open.science/r/FireNav/scenes/4ok3usBNeis/plans/4ok3usBNeis_multi_origin_medium_0e3c1811e576.json):

```text
scenes/4ok3usBNeis/plans/4ok3usBNeis_multi_origin_medium_0e3c1811e576.json
```

## Data release

Dataset, model weights, and embodied assets are available on [Google Drive](https://drive.google.com/drive/folders/1CXMR67kMRdj6dJoohCUBJ_WgjwU3BPbQ?usp=drive_lin).

## Before public release

Author metadata and BibTeX are intentionally anonymous for double-blind review and should be updated after acceptance.

## Credits

Built from the [Academic Project Page Template](https://github.com/eliahuhorwitz/Academic-project-page-template), which was adapted from the Nerfies project page.
