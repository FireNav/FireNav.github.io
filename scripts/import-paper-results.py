"""Import the paper's evaluation figures and appendix tables into the static site.

Run: python scripts/import-paper-results.py --paper-dir ..
Requires PyMuPDF and Pillow for faithful PDF-to-WebP rendering.
"""

import argparse
import csv
import hashlib
import html
import json
import re
import shutil
from pathlib import Path

import fitz
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
FIGURES = [
    (6, "dynamic_fire_paired_bars", "Dynamic fire challenges conventional navigation", "Gray solid bars show hazard-free navigation; red hatched bars show dynamic fire. Results are averaged across ObjectNav and PersonNav. F / A / P denote FMM / A* / PointNav; safety metrics apply only under fire.", [4]),
    (7, "fire_overall_heatmap", "FireNav across global and local planners", "Each cell pairs ObjectNav (left) and PersonNav (right). Darker shades indicate better performance, with task completion, efficiency, and safety shown together.", [5]),
    (8, "fire_ablation_combined", "What perception and risk awareness contribute", "Ablations isolate multimodal perception and fusion (a) and risk-aware planning (b). Green hatched segments indicate improvements; orange dotted segments indicate regressions. N / C / F / R / G denote Nearest / Co-UT / Fill / Random / GPT-4o.", [6, 7]),
    (9, "environmental_factors_v6", "Scene scale, fire conditions, and team size", "Sensitivity to scene scale (a), fire type (b), fire severity (c), and the number of agents (d). Increasing team size brings gains that diminish beyond three agents.", [8]),
    (10, "risk_awareness", "Risk-aware cooperative PersonNav", "Risk-blind (left) and risk-aware (right) navigation in the same dynamic-fire scenario. Hazard-aware planning redirects the team toward safer routes.", [7]),
    (11, "real_fire_Part2_v2", "Cooperative person search on physical robots", "A representative real-world person-search episode with two quadruped robots, showing first-person observations, the shared exploration map, and the reconstructed scene.", [3]),
]
TABLES = [
    ("fireworld_runtime", "FireWorld runtime efficiency", "Infrastructure", 17),
    ("physical_grounding", "Physical and empirical grounding", "Infrastructure", 21),
    ("runtime", "Online navigation runtime", "Physical deployment", 21),
    ("hazard_free_vs_fire", "Hazard-free vs. dynamic-fire navigation", "Overall performance", 22),
    ("fire_overall", "FireNav under dynamic fire", "Overall performance", 23),
    ("perception_ablation_overall", "Multimodal perception and fusion", "Ablation study", 23),
    ("risk_aware_overall", "Risk awareness", "Ablation study", 24),
    ("agent_number", "Number of agents", "Team size", 24),
]


def uncomment(text):
    return "\n".join(re.split(r"(?<!\\)%", line)[0] for line in text.splitlines())


def argument(text, pos):
    while pos < len(text) and text[pos].isspace():
        pos += 1
    assert text[pos] == "{", text[pos:pos + 80]
    start, depth = pos + 1, 1
    pos += 1
    while depth:
        if text[pos] == "{" and text[pos - 1] != "\\":
            depth += 1
        elif text[pos] == "}" and text[pos - 1] != "\\":
            depth -= 1
        pos += 1
    return text[start:pos - 1], pos


def tex(text):
    """Render only the small, explicit set of LaTeX used in these tables."""
    text = re.sub(r"\s+", " ", text.strip())
    out, pos = [], 0
    symbols = {"infra": "FireWorld", "system": "FireNav", "times": "&times;", "uparrow": "&uarr;", "downarrow": "&darr;", "dagger": "&dagger;"}
    wrappers = {"textbf": "strong", "underline": "u", "textit": "em", "emph": "em"}
    while pos < len(text):
        char = text[pos]
        if char == "\\":
            match = re.match(r"\\([a-zA-Z]+|.)", text[pos:])
            command = match.group(1)
            pos += len(match.group())
            if command in wrappers or command == "shortstack":
                value, pos = argument(text, pos)
                tag = wrappers.get(command)
                out.append(f"<{tag}>{tex(value)}</{tag}>" if tag else tex(value))
            elif command in symbols:
                out.append(symbols[command])
            elif command in ["%", "#", "&", "_"]:
                out.append(html.escape(command))
            elif command == "\\":
                out.append("<br>")
            else:
                raise ValueError(f"Unsupported table command: {command!r}")
        elif char == "{":
            value, pos = argument(text, pos)
            out.append(tex(value))
        elif char == "^":
            pos += 1
            if text[pos] == "{":
                value, pos = argument(text, pos)
            elif text[pos] == "\\":
                value = re.match(r"\\[a-zA-Z]+", text[pos:]).group()
                pos += len(value)
            else:
                value, pos = text[pos], pos + 1
            out.append(f"<sup>{tex(value)}</sup>")
        else:
            if char != "$":
                out.append(html.escape(char))
            pos += 1
    return "".join(out).strip()


def split_top(text, separator):
    parts, start, depth, pos = [], 0, 0, 0
    while pos < len(text):
        if depth == 0 and text.startswith(separator, pos):
            parts.append(text[start:pos].strip())
            pos += len(separator)
            start = pos
            continue
        if text[pos] == "\\" and pos + 1 < len(text) and text[pos + 1] in "%#&{}":
            pos += 2
            continue
        if text[pos] == "{":
            depth += 1
        elif text[pos] == "}":
            depth -= 1
        pos += 1
    if text[start:].strip():
        parts.append(text[start:].strip())
    return parts


def cell(raw):
    raw = raw.strip()
    result = {"colspan": 1, "rowspan": 1}
    for command, attr in [("multicolumn", "colspan"), ("multirow", "rowspan")]:
        if raw.startswith("\\" + command):
            size, pos = argument(raw, len(command) + 1)
            _, pos = argument(raw, pos)
            raw, pos = argument(raw, pos)
            result[attr] = int(size)
            break
    result["html"] = tex(raw)
    plain = re.sub(r"<sup>(.*?)</sup>", lambda m: m.group(1) if m.group(1) in ["*", "&dagger;", "*&dagger;"] else "^" + m.group(1), result["html"])
    result["text"] = html.unescape(re.sub(r"<[^>]+>", "", plain.replace("<br>", " ")))
    return result


def rows(raw):
    raw = re.sub(r"\\(?:toprule|midrule|bottomrule|hline)", "", raw)
    raw = re.sub(r"\\cmidrule(?:\([^)]*\))?\{[^}]+\}", "", raw)
    raw = re.sub(r"\\addlinespace(?:\[[^]]*\])?", "", raw)
    return [[cell(c) for c in split_top(row, "&")] for row in split_top(raw, "\\\\") if row.strip()]


def table(block, number, title, topic, page, output):
    caption = tex(argument(block, block.index("\\caption") + 8)[0])
    environment = re.search(r"\\begin\{tabularx?\}", block)
    pos = environment.end()
    _, pos = argument(block, pos)
    if environment.group().endswith("tabularx}"):
        _, pos = argument(block, pos)
    raw = block[pos:re.search(r"\\end\{tabularx?\}", block).start()]
    raw = re.sub(r"^\s*\\(?:toprule|hline)", "", raw)
    header, body = re.split(r"\\(?:midrule|hline)", raw, maxsplit=1)
    headrows, bodyrows = rows(header), rows(body)
    width = max(sum(c["colspan"] for c in row) for row in headrows)
    csvrows, active, data_count = [], {}, 0

    def render_row(row, is_header=False):
        nonlocal active, data_count
        output_cells, expanded, next_active = [], [""] * width, {}
        for col, (left, value) in active.items():
            expanded[col] = value
            if left > 1:
                next_active[col] = (left - 1, value)
        col = 0
        group = len(row) == 1 and row[0]["colspan"] == width
        average = any(c["text"] == "Average" for c in row)
        for c in row:
            if col in active and not c["html"]:
                col += 1
                continue
            while col in active:
                col += 1
            assert col + c["colspan"] <= width, (number, row)
            tag = "th" if is_header or col == 0 or group else "td"
            scope = "colgroup" if is_header and c["colspan"] > 1 else "col" if is_header else "rowgroup" if group or c["rowspan"] > 1 else "row"
            attrs = f' scope="{scope}"' if tag == "th" else ""
            for name in ["colspan", "rowspan"]:
                if c[name] > 1:
                    attrs += f' {name}="{c[name]}"'
            output_cells.append(f"<{tag}{attrs}>{c['html']}</{tag}>")
            for offset in range(c["colspan"]):
                expanded[col + offset] = c["text"]
                if c["rowspan"] > 1:
                    next_active[col + offset] = (c["rowspan"] - 1, c["text"])
            col += c["colspan"]
        assert col == width or all(c in active for c in range(col, width)), (number, col, width)
        active = next_active
        csvrows.append(expanded)
        if not is_header and not group:
            data_count += 1
        row_class = ' class="results-table-group"' if group else ' class="results-table-average"' if average else ""
        return f"<tr{row_class}>{''.join(output_cells)}</tr>"

    head = "\n".join(render_row(r, True) for r in headrows)
    assert not active
    bodies, current = [], []
    for row in bodyrows:
        if len(row) == 1 and row[0]["colspan"] == width and current:
            bodies.append("<tbody>" + "\n".join(current) + "</tbody>")
            current = []
        current.append(render_row(row))
    bodies.append("<tbody>" + "\n".join(current) + "</tbody>")
    assert not active
    csvname = f"table-{number}.csv"
    with (output / csvname).open("w", encoding="utf-8-sig", newline="") as stream:
        csv.writer(stream).writerows(csvrows)
    table_class = " results-table-prose" if number == 2 else ""
    rendered = f'''          <article class="results-table-card" id="results-table-{number}" aria-labelledby="results-table-{number}-title" tabindex="-1">
            <header class="results-table-heading"><span class="results-reference">Table {number:02}</span><h4 id="results-table-{number}-title">{title}</h4></header>
            <div class="results-table-body">
              <p id="results-table-{number}-note">{caption}</p>
              <div class="results-table-actions"><span>Scroll horizontally to see all columns.</span><a href="static/data/results/{csvname}" download>Download CSV &darr;</a><a href="static/pdfs/FireNav_MobiCom2027.pdf#page={page}" target="_blank" rel="noopener">View in paper &#8599;</a></div>
              <div class="results-table-scroll" role="region" aria-label="Table {number}: {title}" tabindex="0">
                <table class="results-data-table{table_class}" aria-describedby="results-table-{number}-note">
                  <caption class="sr-only">Table {number}: {title}</caption>
                  <thead>{head}</thead>
                  {''.join(bodies)}
                </table>
              </div>
            </div>
          </article>'''
    return rendered, {"number": number, "title": title, "rows": data_count, "columns": width, "csv": csvname, "paper_page": page}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--paper-dir", type=Path, default=ROOT.parent)
    args = parser.parse_args()
    paper = args.paper_dir.resolve()
    image_dir = ROOT / "static/images/results"
    pdf_dir = ROOT / "static/pdfs/results"
    data_dir = ROOT / "static/data/results"
    for directory in [image_dir, pdf_dir, data_dir]:
        directory.mkdir(parents=True, exist_ok=True)
    figure_html, metadata = {}, {"figures": [], "tables": []}
    for number, name, title, description, references in FIGURES:
        source = paper / "figures" / (name + ".pdf")
        with fitz.open(source) as document:
            page = document[0]
            scale = 3000 / page.rect.width
            pix = page.get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False)
            image = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
            image.save(image_dir / (name + ".webp"), "WEBP", lossless=True, method=6)
            width, height = image.size
        shutil.copyfile(source, pdf_dir / source.name)
        links = "".join(f'<a href="#results-table-{n}">Table {n} &darr;</a>' for n in references)
        size_class = " results-figure-physical" if number == 11 else ""
        figure_html[number] = f'''            <figure class="results-figure{size_class}" id="results-figure-{number}" tabindex="-1">
              <div class="results-figure-heading"><span class="results-reference">Figure {number:02}</span><h4>{title}</h4></div>
              <button class="zoom-trigger" type="button" data-lightbox="static/images/results/{name}.webp" data-alt="{html.escape(title)}" aria-label="Enlarge Figure {number}: {html.escape(title)}">
                <img src="static/images/results/{name}.webp" width="{width}" height="{height}" alt="{html.escape(description)}" loading="lazy" decoding="async">
                <span aria-hidden="true">Expand &#8599;</span>
              </button>
              <figcaption><p>{description}</p><div class="results-figure-links">{links}<a href="static/pdfs/results/{name}.pdf" target="_blank" rel="noopener">Figure PDF &#8599;</a></div></figcaption>
            </figure>'''
        metadata["figures"].append({"number": number, "source": "figures/" + source.name, "sha256": hashlib.sha256(source.read_bytes()).hexdigest(), "width": width, "height": height})
    appendix_path = paper / "sections/appendix.tex"
    appendix = uncomment(appendix_path.read_text(encoding="utf-8"))
    blocks = {re.search(r"\\label\{tab:([^}]+)\}", m.group(2)).group(1): m.group(2) for m in re.finditer(r"\\begin\{(table\*?)\}(.*?)\\end\{\1\}", appendix, re.S)}
    table_html = {}
    for number, (label, title, topic, page) in enumerate(TABLES, 1):
        markup, info = table(blocks[label], number, title, topic, page, data_dir)
        table_html[number] = markup
        metadata["tables"].append({**info, "label": "tab:" + label})
    metadata["appendix_source"] = "sections/appendix.tex"
    metadata["appendix_sha256"] = hashlib.sha256(appendix_path.read_bytes()).hexdigest()
    (data_dir / "sources.json").write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")
    groups = [
        ("overall", "Overall performance", "Conventional navigation and FireNav across ObjectNav and PersonNav.", [("figure", 6), ("table", 4), ("figure", 7), ("table", 5)]),
        ("ablation", "Ablation studies", "The contributions of multimodal perception, fusion, and risk-aware planning.", [("figure", 8), ("table", 6), ("figure", 10), ("table", 7)]),
        ("microbenchmark", "MicroBenchmark Experiments", "Scene scale, fire type, fire severity, and the number of agents.", [("figure", 9), ("table", 8)]),
        ("physical", "Physical validation", "Cooperative search on physical robots and the online navigation runtime.", [("figure", 11), ("table", 3)]),
        ("infrastructure", "Infrastructure evaluation", "FireWorld runtime efficiency and the physical grounding of the benchmark.", [("table", 1), ("table", 2)]),
    ]
    index_links, panels = [], []
    for i, (slug, label, description, items) in enumerate(groups, 1):
        references = "".join(f'<a href="#results-{kind}-{n}">{"Fig." if kind == "figure" else "Table"} {n}</a>' for kind, n in items)
        index_links.append(f'''            <div class="results-index-group">
              <a class="results-index-topic" href="#results-{slug}"><span>{i:02}</span>{html.escape(label)} <span aria-hidden="true">&darr;</span></a>
              <div class="results-index-references">{references}</div>
            </div>''')
        panels.append(f'''          <div class="results-group" id="results-{slug}" role="region" aria-labelledby="results-{slug}-title" tabindex="-1">
            <div class="results-group-heading"><div><span class="results-reference">{i:02} / Experiments</span><h3 id="results-{slug}-title">{html.escape(label)}</h3></div><p>{description}</p><a href="#results-index">Back to index &uarr;</a></div>
{chr(10).join(figure_html[n] if kind == "figure" else table_html[n] for kind, n in items)}
          </div>''')
    section = f'''    <section class="section section-results" id="results" aria-labelledby="results-title">
      <div class="shell">
        <div class="section-heading" data-reveal>
          <div><p class="section-kicker">Results</p><h2 id="results-title">Experimental Evaluation</h2></div>
          <p>Explore performance comparisons, ablation studies, microbenchmark experiments, and deployment results. Jump directly to any figure or table below.</p>
        </div>
        <nav class="results-index" id="results-index" aria-label="Index of experimental figures and tables" tabindex="-1">
{chr(10).join(index_links)}
        </nav>
        <div class="results-research">
{chr(10).join(panels)}
        </div>
      </div>
    </section>'''
    index_path = ROOT / "index.html"
    index = index_path.read_text(encoding="utf-8")
    index, count = re.subn(r'    <section class="section section-results" id="results"[^>]*>.*?    </section>', lambda _: section, index, count=1, flags=re.S)
    assert count == 1
    index_path.write_text(index, encoding="utf-8", newline="\n")
    print(f"Imported {len(FIGURES)} figures and {len(TABLES)} tables ({sum(t['rows'] for t in metadata['tables'])} data rows).")


if __name__ == "__main__":
    main()
