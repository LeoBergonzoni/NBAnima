
import re
import time
import csv
import sys
from pathlib import Path

import requests
from bs4 import BeautifulSoup
import pandas as pd

BASE = "https://www.espn.com"
TEAMS_URL = "https://www.espn.com/nba/teams"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
}

def get_roster_links():
    resp = requests.get(TEAMS_URL, headers=HEADERS, timeout=30)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")
    links = []
    # Each team card has "Roster" anchor
    for a in soup.find_all("a", string=re.compile(r"^Roster$", re.I)):
        href = a.get("href")
        if href and href.startswith("/"):
            href = BASE + href
        if href and "/team/roster/" in href:
            links.append(href)
    # De-duplicate, preserve order
    seen = set()
    uniq = []
    for url in links:
        if url not in seen:
            uniq.append(url)
            seen.add(url)
    return uniq

def parse_team_roster(url):
    resp = requests.get(url, headers=HEADERS, timeout=30)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")
    # Team name
    h1 = soup.find("h1")
    team_name = h1.get_text(strip=True) if h1 else None
    if team_name:
        team_name = team_name.replace(" Roster 2025-26", "").replace(" Roster 2024-25", "")
    # The roster table headers include Name, POS, Age, HT, WT ... we only take needed cols
    table = soup.find("table")
    rows = []
    if table:
        # find header positions
        headers = [th.get_text(strip=True) for th in table.find_all("th")]
        # Map indices
        def col_index(name):
            for i,h in enumerate(headers):
                if h.upper() == name.upper():
                    return i
            return None
        idx_name = col_index("Name")
        idx_pos  = col_index("POS")
        idx_age  = col_index("Age")
        idx_ht   = col_index("HT")
        idx_wt   = col_index("WT")

        for tr in table.find_all("tr"):
            tds = tr.find_all("td")
            if not tds or len(tds) < 5:
                continue
            def safe(i):
                if i is None or i >= len(tds): return ""
                return tds[i].get_text(" ", strip=True)
            name = safe(idx_name)
            pos  = safe(idx_pos)
            age  = safe(idx_age)
            ht   = safe(idx_ht)
            wt   = safe(idx_wt)
            if name and pos:
                rows.append({
                    "Team": team_name,
                    "Name": name,
                    "Position": pos,
                    "Age": age,
                    "Height": ht,
                    "Weight": wt
                })
    return team_name, rows

def main():
    print("Fetching team roster links...", file=sys.stderr)
    roster_urls = get_roster_links()
    print(f"Found {len(roster_urls)} roster pages.", file=sys.stderr)
    all_rows = []
    for i, url in enumerate(roster_urls, 1):
        print(f"[{i}/{len(roster_urls)}] {url}", file=sys.stderr)
        team, rows = parse_team_roster(url)
        if team and rows:
            all_rows.extend(rows)
        time.sleep(0.6)  # be polite
    if not all_rows:
        print("No rows parsed. Exiting.", file=sys.stderr)
        sys.exit(1)

    df = pd.DataFrame(all_rows, columns=["Team","Name","Position","Age","Height","Weight"])

    out_csv = Path("nba_rosters_full.csv")
    out_xlsx = Path("nba_rosters_full.xlsx")

    df.to_csv(out_csv, index=False)
    with pd.ExcelWriter(out_xlsx, engine="xlsxwriter") as writer:
        for team, sub in df.groupby("Team"):
            sub.to_excel(writer, sheet_name=team[:31], index=False)

    print(f"Saved {out_csv.resolve()}", file=sys.stderr)
    print(f"Saved {out_xlsx.resolve()}", file=sys.stderr)

if __name__ == "__main__":
    main()
