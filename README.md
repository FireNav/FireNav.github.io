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

For a command-line preview with video seeking support, run:

```bash
python preview_server.py 8000
```

Then open `http://localhost:8000`.

The included server supports HTTP byte ranges, so video players can seek without
reloading an entire recording. The Windows launcher reuses a matching preview
with this capability or selects another available localhost port.

## Publish

The site has no build step and can be served directly by GitHub Pages. Point the Pages deployment at this directory (or publish its contents at the repository root).

## Demo media

The page has an interactive scene explorer, linked fire-template and sensor image galleries, 12 temporal-evolution videos, and 17 other video slots: nine fire-impact comparison players, six risk-awareness comparison players, and two physical experiment players. Configure the latter video paths in [`static/js/demo-media.js`](static/js/demo-media.js).

The image galleries contain all 36 scenes and 144 template/sensor pairs, indexed in [`scens/fire-gallery.json`](scens/fire-gallery.json). Both scene selectors stay in sync; the sensor template buttons switch between the four corresponding boards. Images load on demand and open at their original resolution. See [`scens/FIRE_GALLERY.md`](scens/FIRE_GALLERY.md) for the per-scene file structure and capture metadata. Gallery behavior and layout are in `static/js/fire-gallery.js` and `static/css/fire-gallery.css`.

The temporal-evolution gallery (`#temporal-evolution`) follows the static fire images. It has four template rows with three scene videos each, using the original MP4s and posters in `static/videos/temporal_evolution_12_videos_15s/`. The columns consistently show `4ok3usBNeis`, `6s7QHgap2fW`, and `BAbdmeyTvMZ`. Each 15-second clip includes 0–600 seconds of simulated evolution at 50× speed plus brief reference/final holds. Native controls support playback, seeking, and fullscreen; `preload="none"` avoids downloading all 12 videos on page load. On small screens each template row scrolls horizontally to keep its three videos legible.

| Slot | Content | Suggested file path |
| --- | --- | --- |
| `normal-person-agent-0`, `normal-person-agent-1`, `normal-person-merged` | Conventional navigation without fire: success | `static/videos/normal_person_videos/{agent_0,agent_1,merged}.mp4` |
| `conventional-fire-person-agent-0`, `conventional-fire-person-agent-1`, `conventional-fire-person-merged` | Conventional navigation in fire: failure | `static/videos/fire_conventional_person/{agent_0,agent_1,merged}.mp4` |
| `firenav-person-agent-0`, `firenav-person-agent-1`, `firenav-person-merged` | FireNav in fire: success | `static/videos/fire_person_videos/oracle_{agent_0,agent_1,merged}.mp4` |
| `risk-blind-agent-0`, `risk-blind-agent-1`, `risk-blind-merged` | Risk-blind row: Robot 1, Robot 2, combined view | `static/videos/fire_{person,bed}_videos/risk_none_{agent_0,agent_1,merged}.mp4` |
| `risk-aware-agent-0`, `risk-aware-agent-1`, `risk-aware-merged` | Risk-aware row: Robot 1, Robot 2, combined view | `static/videos/fire_{person,bed}_videos/oracle_{agent_0,agent_1,merged}.mp4` |
| `physical-person` | Physical person-search experiment | `static/videos/physical_experiments/physical_experiments_person.mp4` |
| `physical-bed` | Physical bed-search experiment | `static/videos/physical_experiments/physical_experimens_bed.mp4` |

Copy each asset into the site directory, then set its `src` to a path relative to `index.html`. For example:

```js
"physical-person": { type: "video", src: "static/videos/physical_experiments/physical_experiments_person.mp4" },
```

The scanned inventory section uses `static/js/scene-explorer.js` and `static/css/scene-explorer.css`. A scene selector switches between all 36 scanned scenes, loading `scens/<scene_id>/<scene_id>.semantic.glb` and the matching `scens/<scene_id>/inventory.json`. The default scene is `Nfvxx8J5NCo`. Desktop shows the interactive model on the left and a fixed-height, independently scrollable inventory on the right; mobile stacks these panels. Inventory includes searchable, expandable instances and the complete JSON, with a download link. Counts use the recovered `instances` array rather than the larger source annotation totals.

Models load when the section enters view. The viewer supports orbit, zoom, pan, top/reset views, textured/semantic display, and a height cutaway to reveal interiors. These supplied GLBs are rotated from Z-up into the inventory's Y-up coordinates. Local Three.js 0.180.0 modules and their MIT license live in `static/js/vendor/three/`; no CDN is needed at runtime. Scene switching cancels pending downloads and disposes old model resources. Preview through an HTTP server (as above), since browser module/model loading requires HTTP rather than opening `index.html` directly.

Video players provide native playback, seeking, volume, and fullscreen controls. They use `playsinline` and initially use `preload="none"`. Each navigation comparison loads and autoplays muted when its section becomes visible; physical experiment players remain manual. Optional `poster` and `captions` fields accept an image path and a WebVTT path; captions default to English, configurable with `captionLanguage` and `captionLabel`. Prefer browser-compatible MP4 (H.264) and include captions when a recording contains speech. Keep labels, timestamps, and sensor panels legible in the full-width player.

The fire-impact section precedes the risk-awareness comparison and shows person search in three rows of three views: conventional navigation without fire (success), conventional navigation in fire (failure), and FireNav in fire (success). Columns show Robot 1, Robot 2, and the combined view. All nine players synchronize playback, pause, seeking, and speed within their own section using `data-synchronized-videos`; controls do not affect the separate risk-awareness comparison. Recordings share elapsed playback time at their original speed. Shorter recordings hold their final frame until the longest finishes, then the group restarts together.

The navigation section compares two methods in two rows of three players on desktop: risk-blind above risk-aware (ours), each with Robot 1, Robot 2, and combined views. A single Category selector at the upper right switches all six players between person and bed search. The risk-blind row uses `risk_none` recordings, and the risk-aware row uses the existing `oracle` recordings. Each slot maps `categories.person` and `categories.bed` to a video source and its matching poster; `src` and `poster` provide the default person-search view. Switching categories resets all six players and starts the new comparison together. `static/js/navigation-playback.js` synchronizes playback, pause, seeking, and playback speed across all six players. Shorter recordings hold their final frame until the longest finishes, then all six restart together. The compact comparison uses each video's native controls to pause, play, or seek all six videos together; there is no separate playback toolbar. Leaving the section or hiding the browser tab pauses playback; returning resumes unless the user manually paused. When the browser blocks autoplay, pressing play on any video starts the comparison with a user gesture. Smaller screens stack the players vertically.

Physical deployment and experiments share one section, with the two-robot hardware photo in `static/images/robots.png` and only the two recordings from `physical_experiments/`. The original spelling `physical_experimens_bed.mp4` is preserved in its path.

## Paper results

The Experimental Evaluation section contains the six experimental figures
(Figures 6–11) and eight tables from the paper. A direct-link index leads to each
comparison figure and table. All content is displayed in five topic groups:
overall performance, ablation studies, MicroBenchmark Experiments, physical
validation, and infrastructure evaluation. Tables appear alongside the related
figures and remain fully expanded. Each figure opens in the image viewer and
links to its original vector PDF and related tables. Tables preserve the source
values, units, bold entries, and underlines, and provide CSV downloads. Wide
tables scroll within their own containers on small screens. The index and all
figures and tables remain accessible without JavaScript.

Assets live in `static/images/results/`, `static/pdfs/results/`, and
`static/data/results/`. The latter includes a source manifest with figure hashes
and table row counts. To refresh from the paper source, install PyMuPDF and Pillow,
then run `python scripts/import-paper-results.py --paper-dir ..`. The importer reads
the active tables in `sections/appendix.tex` and the six original figure PDFs,
ignores commented-out drafts, and updates the Results markup. Figure numbering,
table titles, and paper page links are defined in the importer and should be
reviewed when the manuscript changes. The website itself requires no build step.

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
