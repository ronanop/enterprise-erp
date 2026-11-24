#!/usr/bin/env bash
# End-to-end CRM demo as moksh@cachedigitech.com — verifies SMTP CRM emails.
set -euo pipefail

BASE="${BASE:-https://erp.iconnectplus.in/api/v1}"
EMAIL="${EMAIL:-moksh@cachedigitech.com}"
PASS="${PASS:-Cache@123}"
DEMO_TAG="Email Demo $(date -u +%Y%m%d-%H%M%S)"

BOQ_B64=$(base64 -w0 /opt/Cache-ERP/docs/user-manuals/crm/assets/demo-files/demo-boq.pdf)
SOW_B64=$(base64 -w0 /opt/Cache-ERP/docs/user-manuals/crm/assets/demo-files/demo-sow.pdf)
OEM_B64=$(base64 -w0 /opt/Cache-ERP/docs/user-manuals/crm/assets/demo-files/demo-oem-quote.pdf)
PO_B64=$(base64 -w0 /opt/Cache-ERP/docs/user-manuals/crm/assets/demo-files/demo-customer-po.pdf)

api() {
  local method=$1 path=$2
  shift 2
  curl -sk -X "$method" "${BASE}${path}" -H "$AUTH" -H "Content-Type: application/json" "$@"
}

json_field() {
  jq -r "$1"
}

echo "== Login $EMAIL =="
LOGIN=$(curl -sk -X POST "$BASE/auth/login" -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}")
TOKEN=$(echo "$LOGIN" | jq -r '.data.access_token // empty')
if [[ -z "$TOKEN" ]]; then
  echo "$LOGIN" | jq .
  exit 1
fi
AUTH="Authorization: Bearer $TOKEN"
MOKSH_ID=$(echo "$LOGIN" | jq -r '.data.user_id // .data.id // empty')
if [[ -z "$MOKSH_ID" || "$MOKSH_ID" == "null" ]]; then
  MOKSH_ID=$(api GET /users | jq -r '.data[] | select(.email|test("moksh";"i")) | .id' | head -1)
fi
EMP_ID=$(api GET /users | jq -r '.data[] | select(.email|test("moksh";"i")) | .employee_id' | head -1)
echo "user=$MOKSH_ID employee=$EMP_ID"

BRANCH_ID=$(api GET /branches | jq -r '.data[] | select(.branch_name=="Greater Kailash") | .id' | head -1)
[[ -n "$BRANCH_ID" ]] || BRANCH_ID=$(api GET /branches | jq -r '.data[0].id')
LEAD_SOURCE_ID=$(api GET /crm/lead-sources | jq -r '.data[0].id')
PIPELINE_ID=$(api GET /crm/pipelines | jq -r '.data[0].id')
echo "branch=$BRANCH_ID source=$LEAD_SOURCE_ID pipeline=$PIPELINE_ID"

BEFORE=$(date -u +%Y-%m-%dT%H:%M:%SZ)
echo "marker_before=$BEFORE"

echo "== 1) Create company =="
COMP=$(api POST /crm/companies -d "{
  \"branch_id\": \"$BRANCH_ID\",
  \"customer_name\": \"$DEMO_TAG Systems\",
  \"account_type\": \"Customer\",
  \"industry\": \"IT\",
  \"source\": \"referral\",
  \"first_name\": \"Moksh\",
  \"last_name\": \"Sharma\",
  \"customer_email\": \"$EMAIL\",
  \"phone\": \"9999999999\",
  \"billing_street\": \"CRC2 Sultanpur\",
  \"billing_city\": \"New Delhi\",
  \"billing_state\": \"DL\",
  \"billing_code\": \"110030\",
  \"billing_country\": \"India\",
  \"account_owner_id\": \"$MOKSH_ID\"
}")
COMPANY_ID=$(echo "$COMP" | jq -r '.data.id // empty')
if [[ -z "$COMPANY_ID" ]]; then echo "$COMP" | jq .; exit 1; fi
echo "company=$COMPANY_ID"

echo "== 2) Create lead (admin lead_created + BOQ/SOW task emails) =="
LEAD=$(api POST "/crm/companies/$COMPANY_ID/leads" -d "{
  \"branch_id\": \"$BRANCH_ID\",
  \"first_name\": \"Demo\",
  \"last_name\": \"Contact\",
  \"designation\": \"IT Head\",
  \"email\": \"$EMAIL\",
  \"mobile\": \"9999999999\",
  \"lead_source_id\": \"$LEAD_SOURCE_ID\",
  \"owner_employee_id\": \"$EMP_ID\",
  \"expected_amount\": 450000,
  \"product_type\": \"hardware\",
  \"sub_product_category\": \"Networking\",
  \"project_title\": \"$DEMO_TAG Campus WiFi\",
  \"purchase_model\": \"CapEx\",
  \"oem_name\": \"Cisco\"
}")
LEAD_ID=$(echo "$LEAD" | jq -r '.data.id // empty')
LEAD_CODE=$(echo "$LEAD" | jq -r '.data.lead_code // .data.dr_number // empty')
if [[ -z "$LEAD_ID" ]]; then echo "$LEAD" | jq .; exit 1; fi
echo "lead=$LEAD_ID code=$LEAD_CODE state=$(echo "$LEAD" | jq -r '.data.blueprint_state')"

sleep 2
echo "== 3) Complete BOQ My Job =="
BOQ_TASK=$(api GET "/crm/my-jobs?status=pending&entity_type=lead&my_tasks_only=true" \
  | jq -r --arg id "$LEAD_ID" '.data[] | select(.entity_id==$id and .action=="provide_boq_attachment") | .id' | head -1)
echo "boq_task=$BOQ_TASK"
api POST "/crm/my-jobs/$BOQ_TASK/decide" -d "{
  \"decision\": \"approved\",
  \"remark\": \"BOQ attached for email demo\",
  \"file_name\": \"demo-boq.pdf\",
  \"content_type\": \"application/pdf\",
  \"content_base64\": \"$BOQ_B64\"
}" | jq '{message, status: .data.status, action: .data.action}'

sleep 1
echo "== 4) Complete SOW My Job (may auto-convert) =="
SOW_TASK=$(api GET "/crm/my-jobs?status=pending&entity_type=lead&my_tasks_only=true" \
  | jq -r --arg id "$LEAD_ID" '.data[] | select(.entity_id==$id and .action=="provide_sow_attachment") | .id' | head -1)
echo "sow_task=$SOW_TASK"
api POST "/crm/my-jobs/$SOW_TASK/decide" -d "{
  \"decision\": \"approved\",
  \"remark\": \"SOW attached for email demo\",
  \"file_name\": \"demo-sow.pdf\",
  \"content_type\": \"application/pdf\",
  \"content_base64\": \"$SOW_B64\"
}" | jq '{message, status: .data.status, action: .data.action}'

sleep 2
LEAD_STATE=$(api GET "/crm/leads/$LEAD_ID" | jq -r '.data.blueprint_state // .data.status')
OPP_ID=$(api GET "/crm/leads/$LEAD_ID" | jq -r '.data.converted_opportunity_id // empty')
echo "lead_state=$LEAD_STATE opp=$OPP_ID"

if [[ -z "$OPP_ID" || "$OPP_ID" == "null" ]]; then
  echo "== Convert lead =="
  CONV=$(api POST "/crm/leads/$LEAD_ID/convert" -d "{
    \"pipeline_id\": \"$PIPELINE_ID\",
    \"opportunity_name\": \"$DEMO_TAG Campus WiFi\",
    \"expected_revenue\": 450000,
    \"remark\": \"Qualified for email demo\"
  }")
  OPP_ID=$(echo "$CONV" | jq -r '.data.id // .data.converted_opportunity_id // empty')
  if [[ -z "$OPP_ID" ]]; then
    OPP_ID=$(echo "$CONV" | jq -r '.data.opportunity.id // empty')
  fi
  if [[ -z "$OPP_ID" ]]; then echo "$CONV" | jq .; exit 1; fi
fi
echo "opportunity=$OPP_ID"

bp() { api GET "/crm/opportunities/$OPP_ID/blueprint" | jq -r '.data.blueprint_state // .data.current_state // .data.state // empty'; }
allowed() { api GET "/crm/opportunities/$OPP_ID/blueprint" | jq -c '.data.allowed_actions // []'; }

echo "opp_state=$(bp) allowed=$(allowed)"

# Opportunity may still need BOQ/SOW/deal reg path depending on state after convert
step_action() {
  local action=$1
  local body=${2:-'{}'}
  echo "-- action $action --"
  api POST "/crm/opportunities/$OPP_ID/actions/$action" -d "$body" | jq '{message, state: .data.blueprint_state, err: .errors}'
}

# Drive blueprint flexibly based on allowed actions
drive_until() {
  local target=$1
  local guard=0
  while [[ "$(bp)" != "$target" && $guard -lt 20 ]]; do
    guard=$((guard+1))
    local state actions
    state=$(bp)
    actions=$(allowed)
    echo "state=$state actions=$actions"
    case "$state" in
      open|boq_pending)
        if echo "$actions" | jq -e 'index("attach_boq")' >/dev/null; then
          step_action attach_boq "{\"file_name\":\"demo-boq.pdf\",\"content_type\":\"application/pdf\",\"content_base64\":\"$BOQ_B64\"}"
        elif echo "$actions" | jq -e 'index("send_boq_approval")' >/dev/null; then
          step_action send_boq_approval "{\"team_role\":\"presales\",\"remarks\":\"Please review BOQ\",\"assigned_user_ids\":[\"$MOKSH_ID\"]}"
          sleep 1
          TASK=$(api GET "/crm/my-jobs?status=pending&my_tasks_only=true" | jq -r --arg id "$OPP_ID" '.data[] | select(.entity_id==$id and (.action|test("boq"))) | .id' | head -1)
          [[ -n "$TASK" ]] && api POST "/crm/my-jobs/$TASK/decide" -d '{"decision":"approved","remark":"BOQ ok"}' | jq '{status:.data.status}'
        else
          break
        fi
        ;;
      boq_approval)
        TASK=$(api GET "/crm/my-jobs?status=pending&my_tasks_only=true" | jq -r --arg id "$OPP_ID" '.data[] | select(.entity_id==$id) | .id' | head -1)
        api POST "/crm/my-jobs/$TASK/decide" -d '{"decision":"approved","remark":"BOQ approved"}' | jq '{status:.data.status}'
        ;;
      sow_optional|sow_approval|sow_pending)
        if echo "$actions" | jq -e 'index("skip_sow")' >/dev/null; then
          step_action skip_sow '{}'
        elif echo "$actions" | jq -e 'index("attach_sow")' >/dev/null; then
          step_action attach_sow "{\"file_name\":\"demo-sow.pdf\",\"content_type\":\"application/pdf\",\"content_base64\":\"$SOW_B64\"}"
        else
          break
        fi
        ;;
      deal_reg)
        step_action deal_reg "{\"deal_reg_number\":\"$LEAD_CODE\"}"
        ;;
      oem_pending)
        step_action oem_received '{}'
        ;;
      oem_attached)
        step_action attach_oem_quote "{\"file_name\":\"demo-oem-quote.pdf\",\"content_type\":\"application/pdf\",\"content_base64\":\"$OEM_B64\"}"
        ;;
      quote_ready|quote_in_progress)
        break
        ;;
      *)
        echo "Unhandled state $state"
        break
        ;;
    esac
    sleep 1
  done
}

echo "== 5) Drive opportunity to quote_ready =="
drive_until quote_ready
echo "opp_state=$(bp)"

# If still before quote_ready, try common unlocks
if [[ "$(bp)" != "quote_ready" && "$(bp)" != "quote_in_progress" && "$(bp)" != "po_pending" ]]; then
  drive_until quote_ready
fi

echo "== 6) Create quote =="
QUOTE=$(api POST /crm/quotes -d "{
  \"opportunity_id\": \"$OPP_ID\",
  \"branch_id\": \"$BRANCH_ID\",
  \"subject\": \"$DEMO_TAG Quote\",
  \"freight\": 5000
}")
QUOTE_ID=$(echo "$QUOTE" | jq -r '.data.id // empty')
if [[ -z "$QUOTE_ID" ]]; then echo "$QUOTE" | jq .; exit 1; fi
echo "quote=$QUOTE_ID"

api POST "/crm/quotes/$QUOTE_ID/lines" -d '{
  "product_name": "Enterprise AP Bundle", "line_type": "hardware",
  "qty": 2, "unit_cost": 100000, "unit_sell": 150000, "gst_pct": 18
}' | jq '{message}'
api POST "/crm/quotes/$QUOTE_ID/lines" -d '{
  "product_name": "Implementation Services", "line_type": "services",
  "qty": 1, "unit_cost": 40000, "unit_sell": 60000, "gst_pct": 18
}' | jq '{message}'

echo "== 7) Approve quote internally (healthy margin) =="
api POST "/crm/quotes/$QUOTE_ID/approve-internally" -d '{}' | jq '{message, status: .data.status, state: .data.blueprint_state, errors}'

# If margin blocked, send for approval to Moksh
if api GET "/crm/quotes/$QUOTE_ID" | jq -e '.data.status != "approved" and .data.blueprint_state != "approved"' >/dev/null 2>&1; then
  echo "Trying send-for-approval..."
  api POST "/crm/quotes/$QUOTE_ID/send-for-approval" -d "{
    \"team_role\": \"management\",
    \"remarks\": \"Please approve quote\",
    \"assigned_user_ids\": [\"$MOKSH_ID\"]
  }" | jq '{message, errors}'
  sleep 1
  TASK=$(api GET "/crm/my-jobs?status=pending&entity_type=quote&my_tasks_only=true" | jq -r --arg id "$QUOTE_ID" '.data[] | select(.entity_id==$id) | .id' | head -1)
  echo "quote_task=$TASK"
  [[ -n "$TASK" ]] && api POST "/crm/my-jobs/$TASK/decide" -d '{"decision":"approved","remark":"Quote approved"}' | jq '{status:.data.status}'
fi

api POST "/crm/quotes/$QUOTE_ID/actions/send_to_customer" -d '{}' | jq '{message, state: .data.blueprint_state}'
api POST "/crm/quotes/$QUOTE_ID/actions/accept" -d '{"remark":"Customer accepted — email demo"}' | jq '{message, state: .data.blueprint_state}'
echo "opp_state=$(bp)"

echo "== 8) Customer PO chain (Moksh on all stages) =="
step_action attach_po "{\"file_name\":\"demo-customer-po.pdf\",\"content_type\":\"application/pdf\",\"content_base64\":\"$PO_B64\"}"

# send_po_approval may need chain owners — Moksh already configured
step_action send_po_approval "{
  \"team_role\": \"accounts\",
  \"remarks\": \"PO approval chain\",
  \"assigned_user_ids\": [\"$MOKSH_ID\"],
  \"po_approval_chain\": {
    \"finance\": [\"$MOKSH_ID\"],
    \"legal\": [\"$MOKSH_ID\"],
    \"management\": [\"$MOKSH_ID\"]
  }
}"

# Decide pending PO tasks (finance → legal → management)
for i in 1 2 3 4 5; do
  TASK=$(api GET "/crm/my-jobs?status=pending&my_tasks_only=true" | jq -r --arg id "$OPP_ID" '
    .data[] | select(.entity_id==$id and (.action|test("po|approve_po"))) | .id' | head -1)
  [[ -z "$TASK" ]] && break
  echo "po_task=$TASK"
  api POST "/crm/my-jobs/$TASK/decide" -d '{"decision":"approved","remark":"PO stage ok"}' | jq '{status:.data.status, action:.data.action}'
  sleep 1
done
echo "opp_state=$(bp)"

echo "== 9) Create OVF =="
OVF=$(api POST /crm/ovf -d "{
  \"quote_id\": \"$QUOTE_ID\",
  \"branch_id\": \"$BRANCH_ID\",
  \"po_number\": \"PO-EMAIL-DEMO-001\",
  \"delivery_period\": \"4 weeks\",
  \"vendor_payment_days\": 30,
  \"customer_payment_days\": 45
}")
OVF_ID=$(echo "$OVF" | jq -r '.data.id // empty')
if [[ -z "$OVF_ID" ]]; then echo "$OVF" | jq .; exit 1; fi
echo "ovf=$OVF_ID"

api POST "/crm/ovf/$OVF_ID/lines" -d '{
  "side":"customer_po","product_name":"Enterprise AP Bundle","qty":2,"unit_price":150000
}' | jq '{message}'
api POST "/crm/ovf/$OVF_ID/lines" -d '{
  "side":"vendor","product_name":"Enterprise AP Bundle","qty":2,"unit_price":100000
}' | jq '{message}'

echo "== 10) OVF send for approval → Moksh decides =="
api POST "/crm/ovf/$OVF_ID/send-for-approval" -d "{
  \"team_role\": \"management\",
  \"remarks\": \"Please approve OVF\",
  \"assigned_user_ids\": [\"$MOKSH_ID\"]
}" | jq '{message, state: .data.blueprint_state, errors}'
sleep 1
TASK=$(api GET "/crm/my-jobs?status=pending&entity_type=ovf&my_tasks_only=true" | jq -r --arg id "$OVF_ID" '.data[] | select(.entity_id==$id) | .id' | head -1)
echo "ovf_task=$TASK"
[[ -n "$TASK" ]] && api POST "/crm/my-jobs/$TASK/decide" -d '{"decision":"approved","remark":"OVF approved"}' | jq '{status:.data.status}'

# Freight / supporting if required
for i in 1 2 3; do
  TASK=$(api GET "/crm/my-jobs?status=pending&entity_type=ovf&my_tasks_only=true" | jq -r --arg id "$OVF_ID" '.data[] | select(.entity_id==$id) | .id' | head -1)
  [[ -z "$TASK" ]] && break
  ACTION=$(api GET "/crm/my-jobs/$TASK" | jq -r '.data.action')
  echo "ovf_extra_task=$TASK action=$ACTION"
  if [[ "$ACTION" == "provide_freight" ]]; then
    api POST "/crm/my-jobs/$TASK/decide" -d '{"decision":"approved","remark":"Freight set","freight":5000,"freight_medium":"road","freight_weight_kg":100,"freight_insurance":false}' | jq '{status:.data.status}'
  else
    api POST "/crm/my-jobs/$TASK/decide" -d '{"decision":"approved","remark":"Done"}' | jq '{status:.data.status}'
  fi
  sleep 1
done

echo "== 11) Share to SCM + Deal Won =="
api POST "/crm/ovf/$OVF_ID/share-to-scm" -d '{}' | jq '{message, state: .data.blueprint_state, errors}' || \
  api POST "/crm/ovf/$OVF_ID/actions/share_to_scm" -d '{}' | jq '{message, state: .data.blueprint_state}'

api POST "/crm/ovf/$OVF_ID/deal-won" -d '{"deal_won_amount": 360000}' | jq '{message, state: .data.blueprint_state, errors}' || \
  api POST "/crm/ovf/$OVF_ID/actions/deal_won" -d '{"deal_won_amount": 360000}' | jq '{message, state: .data.blueprint_state}'

echo "final opp=$(api GET "/crm/opportunities/$OPP_ID" | jq -c '{state:.data.blueprint_state, status:.data.status, won:.data.deal_won_amount}')"

echo "== 12) CRM email deliveries (since marker) =="
api GET "/notifications/deliveries?limit=200" | jq --arg email "$EMAIL" --arg before "$BEFORE" '
  [.data[]
    | select(.channel=="email")
    | select(.recipient_address|ascii_downcase == ($email|ascii_downcase))
    | select((.occurred_at // .delivered_at // .created_at) >= $before)
    | select(.event_type|tostring|startswith("crm.email") or (.event_type|tostring|startswith("crm.")))
  ]
  | sort_by(.occurred_at)
  | .[]
  | {status, event_type, subject, occurred_at, provider: (.provider_response|tostring|.[0:80])}
'

echo "== Summary counts =="
api GET "/notifications/deliveries?limit=200" | jq --arg email "$EMAIL" --arg before "$BEFORE" '
  [.data[]
    | select(.channel=="email")
    | select(.recipient_address|ascii_downcase == ($email|ascii_downcase))
    | select((.occurred_at // .delivered_at // .created_at) >= $before)
  ] as $rows
  | {
      total: ($rows|length),
      delivered: ([$rows[]|select(.status=="delivered")]|length),
      failed: ([$rows[]|select(.status=="failed")]|length),
      by_event: ([$rows[] | .event_type] | group_by(.) | map({event: .[0], n: length}))
    }
'

echo "DONE lead=$LEAD_ID opp=$OPP_ID quote=$QUOTE_ID ovf=$OVF_ID"
