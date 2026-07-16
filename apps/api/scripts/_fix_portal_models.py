from pathlib import Path

p = Path(__file__).resolve().parents[1] / "scripts" / "_gen_portal_module.py"
text = p.read_text(encoding="utf-8")
text = text.replace("\\'\\'\\'", "'''")
p.write_text(text, encoding="utf-8")
print("fixed escaped quotes")
