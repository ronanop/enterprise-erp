from pathlib import Path
p = Path("apps/web/src/components/projects/site-installation-list-page.tsx")
t = p.read_text(encoding="utf-8")
old = '''  scm: {
    title: "SCM / Logistics",
    description: "Material movement — MO request, IM material, and WH / on-site delivery dates.",
    empty: "No sites in SCM / Logistics.",
  },
  installation: {'''
new = '''  scm: {
    title: "SCM / Logistics",
    description: "Material movement — quantities and warehouse delivery dates.",
    empty: "No sites in SCM / Logistics.",
  },
  onsite_delivery: {
    title: "Onsite Delivery",
    description: "MO request and server / rack / PDU on-site delivery.",
    empty: "No sites in Onsite Delivery.",
  },
  material_handover: {
    title: "Material Handover",
    description: "IM material, power-on material, and WH → site handover.",
    empty: "No sites in Material Handover.",
  },
  installation: {'''
if old not in t:
    raise SystemExit('block1 not found')
t = t.replace(old, new, 1)
t = t.replace(
    "Handover to Application Team and HWAT / circle sign-off.",
    "Handover to Application Team and HW-AT / circle sign-off.",
)
t = t.replace(
    "Site installation register across Intake → Assign → Survey → SCM → Installation & Configuration → Acceptance.",
    "Site installation register across Intake → Survey → SCM → Onsite Delivery → Material Handover → Installation → Acceptance.",
)
# also handle if already HW-AT
t = t.replace(
    "Handover to Application Team and HW-AT / circle sign-off.",
    "Handover to Application Team and HW-AT / circle sign-off.",
)
p.write_text(t, encoding="utf-8")
print("ok")
