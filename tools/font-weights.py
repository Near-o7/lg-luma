"""Freeze the bundled variable Inter font at the web UI's weights/optical sizes."""
import sys
import json
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools import subset

directory = Path(sys.argv[1])
font = TTFont(directory / "font.ttf")
axes = {axis.axisTag for axis in font["fvar"].axes} if "fvar" in font else set()
metrics = {}
for weight in (350, 400, 450, 500, 550, 600, 650, 800):
    for display in (False, True):
        values = {"wght": weight} if "wght" in axes else {}
        if "opsz" in axes:
            values["opsz"] = 32 if display else 14
        instance = instantiateVariableFont(font, values, inplace=False) if axes else font
        instance.save(directory / f"font-{'display-' if display else ''}{weight}.ttf")
        units = instance["head"].unitsPerEm
        advances = instance["hmtx"].metrics
        metrics[f"{'display-' if display else ''}{weight}"] = {
            chr(codepoint): advances[glyph][0] / units
            for codepoint, glyph in instance.getBestCmap().items()
        }
cjk = TTFont(sys.argv[2])
options = subset.Options()
options.layout_features = []
options.name_IDs = ["*"]
subsetter = subset.Subsetter(options=options)
subsetter.populate(unicodes=[codepoint for codepoint in cjk.getBestCmap()
                             if codepoint < 0xA000 or 0xF900 <= codepoint <= 0xFAFF or 0xFF00 <= codepoint <= 0xFFEF])
subsetter.subset(cjk)
for weight in (400, 500):
    instance = instantiateVariableFont(cjk, {"wght": weight}, inplace=False)
    # Derived subsets use their own family name while retaining copyright/license tables.
    family = "Luma CJK"
    style = "Regular" if weight == 400 else "Medium"
    for name_id, value in [(1, family), (2, style), (4, f"{family} {style}"),
                           (6, f"LumaCJK-{style}"), (16, family), (17, style)]:
        instance["name"].setName(value, name_id, 3, 1, 0x409)
    instance.save(directory / f"font-cjk-{weight}.ttf")
    units = instance["head"].unitsPerEm
    advances = instance["hmtx"].metrics
    metrics[f"fallback-{weight}"] = {chr(cp): advances[glyph][0] / units
                                   for cp, glyph in instance.getBestCmap().items()}
(directory / "font-metrics.json").write_text(json.dumps(metrics, ensure_ascii=False), encoding="utf8")
