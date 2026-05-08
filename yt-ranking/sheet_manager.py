import gspread
from google.oauth2.service_account import Credentials
from datetime import datetime

class SheetManager:
    def __init__(self, credentials_path, sheet_url):
        self.scope = [
            "https://www.googleapis.com/auth/spreadsheets",
            "https://www.googleapis.com/auth/drive"
        ]
        self.creds = Credentials.from_service_account_file(
            credentials_path, scopes=self.scope
        )
        self.client = gspread.authorize(self.creds)
        self.sheet = self.client.open_by_url(sheet_url).get_worksheet(0)

    def get_data(self):
        """
        Reads all records from the sheet.
        Handles duplicate headers by using raw values if needed.
        """
        try:
            # Try the standard way first
            records = self.sheet.get_all_records()
            if records:
                return records
            # If records is empty but sheet might have headers
            values = self.sheet.get_all_values()
            if len(values) <= 1: return []
        except Exception:
            # Fallback for duplicate headers or other structural issues
            values = self.sheet.get_all_values()
            if not values:
                return []
        
        headers = values[0]
        # Create unique internal headers to avoid gspread error
        seen = {}
        unique_headers = []
        for h in headers:
            h_str = str(h)
            if h_str in seen:
                seen[h_str] += 1
                unique_headers.append(f"{h_str}_{seen[h_str]}")
            else:
                seen[h_str] = 0
                unique_headers.append(h_str)
        
        records = []
        for row in values[1:]:
            record = {}
            for i, val in enumerate(row):
                if i < len(unique_headers):
                    record[unique_headers[i]] = val
            records.append(record)
        return records

    def get_all_values(self):
        """Returns all values as a list of lists."""
        return self.sheet.get_all_values()

    def add_ranking_column(self, rankings):
        """
        Adds a new column with a unique date-based header and the ranking values.
        """
        headers = self.sheet.row_values(1)
        base_header = f"ranking_{datetime.now().strftime('%Y-%m-%d')}"
        
        # Ensure unique header name for this run
        header_name = base_header
        counter = 1
        while header_name in headers:
            header_name = f"{base_header}_{counter}"
            counter += 1

        new_col_index = len(headers) + 1
        
        # Update header
        self.sheet.update_cell(1, new_col_index, header_name)
        
        # Update values
        # gspread update expects a list of lists for range updates
        cells_to_update = [[r] for r in rankings]
        
        # Range string (e.g., C2:C10)
        # We start from row 2
        last_row = 1 + len(rankings)
        col_letter = self._get_column_letter(new_col_index)
        cell_range = f"{col_letter}2:{col_letter}{last_row}"
        
        self.sheet.update(cell_range, cells_to_update)

    def _get_column_letter(self, n):
        """Converts column index to Excel-style letter (e.g., 1 -> A, 27 -> AA)."""
        string = ""
        while n > 0:
            n, remainder = divmod(n - 1, 26)
            string = chr(65 + remainder) + string
        return string
