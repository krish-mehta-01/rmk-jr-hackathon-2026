import requests
import json

BASE = 'http://localhost:30000'

# Login as P1-IN
res = requests.post(f'{BASE}/api/jury/login', json={'username': 'P1-IN', 'password': 'rmkjh2026'})
token = res.json().get('token')
headers = {'Authorization': f'Bearer {token}'}

# Get projects
res_proj = requests.get(f'{BASE}/api/jury/projects', headers=headers)
projects = res_proj.json().get('projects', [])

pending_projects = [p for p in projects if p.get('evaluation_status') != 'SUBMITTED']
print(f"Total projects: {len(projects)}, Pending: {len(pending_projects)}")
for p in pending_projects:
    print(f"ID: {p['team_id']}, Code: {p['team_code']}, Name: {p['team_name']}, Status: {p['evaluation_status']}")
