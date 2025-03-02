import sys
import spacy
import csv
import re

# Initialize SpaCy NLP model
nlp = spacy.load("en_core_web_sm")

def remove_pii_from_text(text):
    print(f"Processing text: {text}", file=sys.stderr)
    doc = nlp(str(text))
    pii_findings = []
    cleaned_text = str(text)

    # PII patterns 
    patterns = {
        'email': (r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', '[EMAIL]'),
        'phone': (r'\b\d{3}[-.]?\d{3}[-.]?\d{4}\b', '[PHONE]'),
        'street_address': (r'\b\d{1,5}\s+\b(?:[A-Za-z0-9]+(?:\s+[A-Za-z0-9]+)*)\s+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr)\b', '[ADDRESS]'),
        'username': (r'(?i)(?:username|user):\s*(\w+)', '[USERNAME]'),
        'ssn': (r'\b\d{3}-\d{2}-\d{4}\b', '[SSN]')
    }

    # Apply Regex-Based PII Removal
    for pii_type, (pattern, replacement) in patterns.items():
        matches = re.finditer(pattern, cleaned_text, re.IGNORECASE)
        for match in matches:
            pii_findings.append(f"Found {pii_type}: {match.group()}")
            print(f"Found {pii_type}: {match.group()}", file=sys.stderr)
            cleaned_text = cleaned_text.replace(match.group(), replacement)

    # Apply SpaCy NER 
    for ent in doc.ents:
        if ent.label_ in ["PERSON", "ORG"]:  # Remove names and organizations
            pii_findings.append(f"Found {ent.label_}: {ent.text}")
            print(f"Found {ent.label_}: {ent.text}", file=sys.stderr)
            cleaned_text = cleaned_text.replace(ent.text, f"[{ent.label_}]")

        # Handle locations (GPE - Geopolitical Entity)
        if ent.label_ == "GPE":
            if any(keyword in ent.text.lower() for keyword in ["street", "road", "lane", "blvd", "dr", "ave"]):
                pii_findings.append(f"Found ADDRESS: {ent.text}")
                print(f"Found ADDRESS: {ent.text}", file=sys.stderr)
                cleaned_text = cleaned_text.replace(ent.text, "[ADDRESS]")

    print(f"Cleaned text: {cleaned_text}", file=sys.stderr)
    return pii_findings, cleaned_text

def process_csv(input_path, output_path):
    """Process CSV file and remove PII from each cell."""
    all_findings = set()
    cleaned_rows = []
    
    try:
        print(f"Reading CSV from: {input_path}", file=sys.stderr)
        
        # Read the entire CSV file first
        with open(input_path, 'r', newline='', encoding='utf-8') as infile:
            # Read all rows into memory
            rows = list(csv.reader(infile))
            if not rows:
                raise ValueError("Empty CSV file")
            
            headers = rows[0]
            print(f"Headers: {headers}", file=sys.stderr)
            
            # Add headers to cleaned rows
            cleaned_rows.append(headers)
            
            # Process each data row
            for row_idx, row in enumerate(rows[1:], 1):
                print(f"Processing row {row_idx}", file=sys.stderr)
                cleaned_row = []
                
                # Process each cell in the row
                for col_idx, cell in enumerate(row):
                    if col_idx < len(headers):  # Only process cells that have corresponding headers
                        print(f"Processing column {headers[col_idx]}", file=sys.stderr)
                        findings, cleaned_cell = remove_pii_from_text(cell)
                        all_findings.update(findings)
                        cleaned_row.append(cleaned_cell)
                
                # If row is shorter than headers, pad with empty strings
                while len(cleaned_row) < len(headers):
                    cleaned_row.append("")
                
                # If row is longer than headers, truncate
                cleaned_row = cleaned_row[:len(headers)]
                
                cleaned_rows.append(cleaned_row)

        # Write the cleaned CSV
        print(f"Writing cleaned CSV to: {output_path}", file=sys.stderr)
        with open(output_path, 'w', newline='', encoding='utf-8') as outfile:
            writer = csv.writer(outfile)
            writer.writerows(cleaned_rows)

        # Print findings for Node.js to capture
        for finding in sorted(all_findings):
            print(finding)

        print("PII removal complete", file=sys.stderr)

    except Exception as e:
        print(f"Error processing file: {str(e)}", file=sys.stderr)
        sys.exit(1)

def main():
    if len(sys.argv) != 3:
        print("Usage: python remove_pii.py input_path output_path", file=sys.stderr)
        sys.exit(1)
    
    input_path = sys.argv[1]
    output_path = sys.argv[2]
    
    print(f"Starting PII removal process", file=sys.stderr)
    process_csv(input_path, output_path)

if __name__ == "__main__":
    main()