import requests
import json
import time
import sys

BASE_URL = 'http://localhost:30000'

results = []

def record(test_num, name, status_code, elapsed_ms, passed, details):
    res = {
        'test_num': test_num,
        'name': name,
        'status_code': status_code,
        'response_time_ms': round(elapsed_ms, 2),
        'passed': passed,
        'details': details
    }
    results.append(res)
    mark = "PASS" if passed else "FAIL"
    print(f"[{mark}] Test {test_num}: {name} -> {status_code} ({round(elapsed_ms, 2)}ms)")
    if not passed or '--verbose' in sys.argv:
        print(f"       Details: {details}")

print("=================================================================")
print("STARTING E2E API TEST SUITE AGAINST http://localhost:30000")
print("=================================================================\n")

# -------------------------------------------------------------
# Test 1: Admin login
# -------------------------------------------------------------
t0 = time.time()
r_admin_login = requests.post(f"{BASE_URL}/api/admin/login", json={
    'username': 'admin-rmk-jrhackathon',
    'password': 'K18919H-M5820A'
})
t_admin_login = (time.time() - t0) * 1000
admin_data = r_admin_login.json() if r_admin_login.status_code == 200 else {}
admin_token = admin_data.get('token')
t1_pass = r_admin_login.status_code == 200 and bool(admin_token)
record(
    '1',
    "Admin Login (admin-rmk-jrhackathon)",
    r_admin_login.status_code,
    t_admin_login,
    t1_pass,
    {
        'token_received': bool(admin_token),
        'token_preview': (admin_token[:20] + '...') if admin_token else None,
        'username': admin_data.get('username'),
        'name': admin_data.get('name')
    }
)

admin_headers = {'Authorization': f'Bearer {admin_token}'} if admin_token else {}

# -------------------------------------------------------------
# Test 2: GET /api/admin/allocations/summary
# -------------------------------------------------------------
t0 = time.time()
r_summary = requests.get(f"{BASE_URL}/api/admin/allocations/summary", headers=admin_headers)
t_summary = (time.time() - t0) * 1000
sum_data = r_summary.json() if r_summary.status_code == 200 else {}
active_rev = sum_data.get('active_revision') or {}
active_stats = sum_data.get('active_stats') or {}
t2_pass = (
    r_summary.status_code == 200
    and active_rev.get('revision_number') == 5
    and active_rev.get('status') == 'PUBLISHED'
    and active_stats.get('assigned_count') == 282
)
record(
    '2',
    "GET /api/admin/allocations/summary (Active Revision #5, 282 teams)",
    r_summary.status_code,
    t_summary,
    t2_pass,
    {
        'active_revision_id': active_rev.get('id'),
        'revision_number': active_rev.get('revision_number'),
        'status': active_rev.get('status'),
        'is_active': active_rev.get('is_active'),
        'assigned_count': active_stats.get('assigned_count'),
        'total_teams': active_stats.get('total_teams'),
        'unassigned_count': active_stats.get('unassigned_count')
    }
)

# -------------------------------------------------------------
# Test 3: GET /api/admin/allocations/revisions
# -------------------------------------------------------------
t0 = time.time()
r_revs = requests.get(f"{BASE_URL}/api/admin/allocations/revisions", headers=admin_headers)
t_revs = (time.time() - t0) * 1000
revs_data = r_revs.json() if r_revs.status_code == 200 else {}
revisions = revs_data.get('revisions') or []
t3_pass = (
    r_revs.status_code == 200
    and len(revisions) == 5
    and all(r.get('assigned_count') == 282 for r in revisions)
)
rev_summaries = [
    {
        'id': r.get('id'),
        'revision_number': r.get('revision_number'),
        'status': r.get('status'),
        'assigned_count': r.get('assigned_count')
    }
    for r in revisions
]
record(
    '3',
    "GET /api/admin/allocations/revisions (5 Revisions with status 200 & 282 teams)",
    r_revs.status_code,
    t_revs,
    t3_pass,
    {
        'revision_count': len(revisions),
        'revisions': rev_summaries
    }
)

# -------------------------------------------------------------
# Test 4: GET /api/admin/allocations/revisions/120004
# -------------------------------------------------------------
t0 = time.time()
r_rev120004 = requests.get(f"{BASE_URL}/api/admin/allocations/revisions/120004", headers=admin_headers)
t_rev120004 = (time.time() - t0) * 1000
rev_det = r_rev120004.json() if r_rev120004.status_code == 200 else {}
panels = rev_det.get('panels') or []
assigned = rev_det.get('assigned') or []
stats = rev_det.get('stats') or {}
t4_pass = (
    r_rev120004.status_code == 200
    and len(panels) == 15
    and len(assigned) == 282
    and stats.get('assigned_count') == 282
    and stats.get('unassigned_count') == 0
)
record(
    '4',
    "GET /api/admin/allocations/revisions/120004 (Structure check)",
    r_rev120004.status_code,
    t_rev120004,
    t4_pass,
    {
        'panels_count': len(panels),
        'assigned_teams_count': len(assigned),
        'total_teams': stats.get('total_teams'),
        'unassigned_count': stats.get('unassigned_count'),
        'sample_panel': panels[0] if panels else None,
        'sample_assigned_team': {
            'team_id': assigned[0].get('team_id'),
            'team_code': assigned[0].get('team_code'),
            'team_name': assigned[0].get('team_name'),
            'panel_id': assigned[0].get('panel_id')
        } if assigned else None
    }
)

# -------------------------------------------------------------
# Test 5: Jury authentication
# 5a. P1-IN (Dr. T. Suresh)
# 5b. P1-EX (Mr S. Gowtham)
# 5c. P15-IN
# 5d. P15-EX
# -------------------------------------------------------------
jury_tokens = {}

jury_test_cases = [
    {
        'sub': '5a',
        'username': 'P1-IN',
        'password': 'rmkjh2026',
        'expected_name': 'Dr. T. Suresh',
        'expected_type': 'INTERNAL'
    },
    {
        'sub': '5b',
        'username': 'P1-EX',
        'password': 'rmkjh2026',
        'expected_name': 'Mr S. Gowtham',
        'expected_type': 'EXTERNAL'
    },
    {
        'sub': '5c',
        'username': 'P15-IN',
        'password': 'rmkjh2026',
        'expected_name': 'Dr.Y. Sukhi',
        'expected_type': 'INTERNAL'
    },
    {
        'sub': '5d',
        'username': 'P15-EX',
        'password': 'rmkjh2026',
        'expected_name': 'Mr. S.S Venkatasubramanian',
        'expected_type': 'EXTERNAL'
    }
]

for jc in jury_test_cases:
    u = jc['username']
    t0 = time.time()
    r_jlogin = requests.post(f"{BASE_URL}/api/jury/login", json={'username': u, 'password': jc['password']})
    t_jlogin = (time.time() - t0) * 1000
    jdata = r_jlogin.json() if r_jlogin.status_code == 200 else {}
    jtoken = jdata.get('token')
    jury_tokens[u] = jtoken

    # Verify profile via /api/jury/me
    jheaders = {'Authorization': f'Bearer {jtoken}'} if jtoken else {}
    t0_me = time.time()
    r_jme = requests.get(f"{BASE_URL}/api/jury/me", headers=jheaders)
    t_jme = (time.time() - t0_me) * 1000
    medata = r_jme.json() if r_jme.status_code == 200 else {}
    prof = medata.get('profile') or {}
    prof_name = prof.get('full_name')

    name_matched = True
    if jc['expected_name']:
        name_matched = (prof_name == jc['expected_name'])

    jc_pass = (
        r_jlogin.status_code == 200
        and bool(jtoken)
        and r_jme.status_code == 200
        and name_matched
        and medata.get('judge_type') == jc['expected_type']
    )

    record(
        jc['sub'],
        f"Jury Auth & Profile ({u} - {jc['expected_name']})",
        r_jlogin.status_code,
        t_jlogin + t_jme,
        jc_pass,
        {
            'login_time_ms': round(t_jlogin, 2),
            'me_time_ms': round(t_jme, 2),
            'token_received': bool(jtoken),
            'judge_type': medata.get('judge_type'),
            'panel_code': medata.get('panel_code'),
            'panel_venue': medata.get('panel_venue'),
            'full_name': prof_name,
            'designation': prof.get('designation'),
            'institution_name': prof.get('institution_name'),
            'company_name': prof.get('company_name')
        }
    )

# -------------------------------------------------------------
# Test 6: Jury Evaluation
# 6a. GET /api/jury/projects for P1-IN
# 6b. Submit evaluation with EMPTY remarks (optional remarks requirement)
# -------------------------------------------------------------
p1_in_token = jury_tokens.get('P1-IN')
p1_headers = {'Authorization': f'Bearer {p1_in_token}'} if p1_in_token else {}

t0 = time.time()
r_p1_proj = requests.get(f"{BASE_URL}/api/jury/projects", headers=p1_headers)
t_p1_proj = (time.time() - t0) * 1000
p1_proj_data = r_p1_proj.json() if r_p1_proj.status_code == 200 else {}
p1_projects = p1_proj_data.get('projects') or []
t6a_pass = r_p1_proj.status_code == 200 and len(p1_projects) == 19
record(
    '6a',
    "GET /api/jury/projects for P1-IN (19 projects loaded)",
    r_p1_proj.status_code,
    t_p1_proj,
    t6a_pass,
    {
        'panel': p1_proj_data.get('panel'),
        'total_projects': len(p1_projects),
        'stats': p1_proj_data.get('stats'),
        'sample_project': {
            'team_id': p1_projects[0].get('team_id'),
            'team_code': p1_projects[0].get('team_code'),
            'team_name': p1_projects[0].get('team_name')
        } if p1_projects else None
    }
)

# Fetch evaluation criteria for P1-IN
r_criteria = requests.get(f"{BASE_URL}/api/jury/criteria", headers=p1_headers)
criteria_list = r_criteria.json().get('criteria', [])

# Find a project in P1 that has NOT been submitted yet
pending_proj = None
for p in p1_projects:
    if p.get('evaluation_status') != 'SUBMITTED':
        pending_proj = p
        break

if not pending_proj:
    print("Warning: All projects are already submitted for P1-IN!")
    target_team_id = p1_projects[-1].get('team_id')
    target_team_code = p1_projects[-1].get('team_code')
else:
    target_team_id = pending_proj.get('team_id')
    target_team_code = pending_proj.get('team_code')

# Form submission payload with EMPTY remarks: ""
# Criteria-based scores
scores_payload = []
for c in criteria_list:
    # 8.0 out of 10.0 for each
    scores_payload.append({
        'criterion_id': c['id'],
        'score': 8.5,
        'comments': ''
    })

eval_submission_payload = {
    'team_id': target_team_id,
    'scores': scores_payload,
    'remarks': ''  # EXPLICITLY EMPTY REMARKS
}

t0 = time.time()
r_eval_submit = requests.post(
    f"{BASE_URL}/api/jury/evaluations/{target_team_id}/submit",
    json=eval_submission_payload,
    headers=p1_headers
)
t_eval_submit = (time.time() - t0) * 1000
eval_resp = r_eval_submit.json() if r_eval_submit.status_code == 200 else {}
t6b_pass = (
    r_eval_submit.status_code == 200
    and eval_resp.get('ok') is True
    and eval_resp.get('status') == 'SUBMITTED'
    and eval_resp.get('remarks') == ''
    and eval_resp.get('is_locked') is True
)

record(
    '6b',
    f"Submit evaluation with EMPTY remarks for {target_team_code} (team_id={target_team_id})",
    r_eval_submit.status_code,
    t_eval_submit,
    t6b_pass,
    {
        'team_id': target_team_id,
        'team_code': target_team_code,
        'empty_remarks_sent': eval_submission_payload['remarks'] == '',
        'response_ok': eval_resp.get('ok'),
        'evaluation_status': eval_resp.get('status'),
        'total_score': eval_resp.get('total_score'),
        'returned_remarks': eval_resp.get('remarks'),
        'is_locked': eval_resp.get('is_locked'),
        'error': eval_resp.get('error') if not t6b_pass else None
    }
)

# Verify evaluation persists and is locked via GET /api/jury/evaluations/:teamId
t0 = time.time()
r_get_eval = requests.get(f"{BASE_URL}/api/jury/evaluations/{target_team_id}", headers=p1_headers)
t_get_eval = (time.time() - t0) * 1000
get_eval_data = r_get_eval.json() if r_get_eval.status_code == 200 else {}
persisted_eval = get_eval_data.get('evaluation') or {}
t6c_pass = (
    r_get_eval.status_code == 200
    and persisted_eval.get('status') == 'SUBMITTED'
    and persisted_eval.get('remarks') == ''
)
record(
    '6c',
    f"Verify persisted evaluation for {target_team_code} (status=SUBMITTED, remarks empty)",
    r_get_eval.status_code,
    t_get_eval,
    t6c_pass,
    {
        'persisted_status': persisted_eval.get('status'),
        'persisted_score': persisted_eval.get('total_score'),
        'persisted_remarks': repr(persisted_eval.get('remarks')),
        'submitted_at': persisted_eval.get('submitted_at')
    }
)

print("\n=================================================================")
print("TEST SUMMARY REPORT")
print("=================================================================")
print(json.dumps(results, indent=2))

with open('scripts/e2e_test_report.json', 'w') as f:
    json.dump(results, f, indent=2)

all_passed = all(r['passed'] for r in results)
print(f"\nOVERALL RESULT: {'ALL TESTS PASSED' if all_passed else 'SOME TESTS FAILED'}")
sys.exit(0 if all_passed else 1)
