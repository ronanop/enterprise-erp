from pathlib import Path

p = Path(r"d:\ERP\apps\api\src\modules\project\service\engines\site_installation_engine.py")
text = p.read_text(encoding="utf-8")
marker = 'if action == "complete_acceptance":'
idx = text.index(marker)
print(repr(text[idx : idx + 450]))
