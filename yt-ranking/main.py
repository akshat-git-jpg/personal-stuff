import os
from dotenv import load_dotenv
from ranking_engine import YoutubeAPIRankChecker
from sheet_manager import SheetManager

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

# Load environment variables from myproj root .env
load_dotenv(dotenv_path=os.path.join(SCRIPT_DIR, "..", ".env"))

def main():
    # Configuration
    api_key = os.getenv("YT_API_KEY")
    sheet_url = os.getenv("GOOGLE_SHEET_URL")
    credentials_filename = os.getenv("CREDENTIALS_FILE", "credentials.json")
    credentials_path = credentials_filename if os.path.isabs(credentials_filename) else os.path.join(SCRIPT_DIR, credentials_filename)

    if not api_key:
        print("Error: YT_API_KEY not found in .env file.")
        return
    if not sheet_url:
        print("Error: GOOGLE_SHEET_URL not found in .env file.")
        return
    if not os.path.exists(credentials_path):
        print(f"Error: Credentials file not found at {credentials_path}")
        return

    print("Initializing...")
    rank_checker = YoutubeAPIRankChecker(api_key)
    sheet_manager = SheetManager(credentials_path, sheet_url)

    print("Fetching data from sheet...")
    data = sheet_manager.get_data()
    
    if not data:
        print("No data found in the sheet.")
        return

    # Identify columns (case-insensitive)
    url_col = next((k for k in data[0].keys() if "url" in k.lower()), None)
    keyword_col = next((k for k in data[0].keys() if "keyword" in k.lower()), None)
    status_col = next((k for k in data[0].keys() if "status" in k.lower()), None)

    if not url_col or not keyword_col:
        print(f"Error: Could not find 'URL' and 'Keyword' columns. Found: {list(data[0].keys())}")
        return

    print(f"Found columns: '{url_col}', '{keyword_col}', Status: '{status_col}'")
    
    rankings = []
    
    for row in data:
        url = row[url_col]
        keywords_str = str(row[keyword_col])
        status = row.get(status_col, "") if status_col else "To Check now"
        
        if status != "To Check now":
            print(f"Skipping row for {url} (Status: {status})")
            rankings.append("")
            continue

        if not url or not keywords_str:
            rankings.append("N/A")
            continue

        # Split keywords by newline and strip whitespace
        keywords = [k.strip() for k in keywords_str.split('\n') if k.strip()]
        row_rankings = []

        for keyword in keywords:
            print(f"Checking rank for '{keyword}' -> {url}")
            rank = rank_checker.get_ranking(keyword, url)
            
            if rank == -1:
                rank_str = "Not in Top 50"
            elif rank == -2:
                rank_str = "Error"
            else:
                rank_str = f"Rank {rank}"
                
            print(f"Result: {rank_str}")
            row_rankings.append(rank_str)

        # Join results with newlines to match the input format
        rankings.append('\n'.join(row_rankings))

    print("Updating sheet with new ranks...")
    sheet_manager.add_ranking_column(rankings)
    print("Done!")

if __name__ == "__main__":
    main()
