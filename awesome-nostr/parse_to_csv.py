#!/usr/bin/env python3
"""
Parse the awesome-nostr SOURCE.md file and convert it to CSV format.

Columns: "Category Tags", "Name", "Link", "Stars", "Description", "Additional Details"
"""

import re
import csv
import sys
from pathlib import Path

def parse_markdown_to_csv(input_file, output_file):
    """Parse the markdown file and convert to CSV format."""
    
    with open(input_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    lines = content.split('\n')
    
    # CSV data storage
    csv_data = []
    current_category = ""
    current_subcategory = ""
    
    # Process each line
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        
        # Skip empty lines
        if not line:
            i += 1
            continue
            
        # Handle main categories (## Category)
        if line.startswith('## '):
            current_category = line[3:].strip()
            current_subcategory = ""
            i += 1
            continue
            
        # Handle subcategories (### Subcategory)
        if line.startswith('### '):
            current_subcategory = line[4:].strip()
            i += 1
            continue
            
        # Handle list items (- [Name](link) description)
        if line.startswith('- ') and not line.startswith('  - '):
            # Extract the main item
            item_data = parse_list_item(line, current_category, current_subcategory)
            if item_data:
                # Check for additional details in following lines
                additional_details = []
                j = i + 1
                while j < len(lines) and lines[j].startswith('  - '):
                    additional_details.append(lines[j].strip())
                    j += 1
                
                # Add additional details to the item
                if additional_details:
                    item_data['additional_details'] = '\n'.join(additional_details)
                
                csv_data.append(item_data)
                i = j  # Skip the processed additional detail lines
            else:
                i += 1
        else:
            i += 1
    
    # Write to CSV
    write_csv(csv_data, output_file)
    print(f"Successfully converted {len(csv_data)} items to {output_file}")

def parse_list_item(line, category, subcategory):
    """Parse a single list item and extract relevant information."""
    
    # Remove the leading "- "
    content = line[2:].strip()
    
    # Skip if it's a nested item (starts with spaces)
    if line.startswith('  '):
        return None
    
    # Pattern to match [Name](link)![stars](stars_url) - description
    # or [Name](link) - description
    # or just [Name](link)
    
    # First, extract the main link and name
    link_pattern = r'\[([^\]]+)\]\(([^)]+)\)'
    link_match = re.search(link_pattern, content)
    
    if not link_match:
        # No link found, skip this item
        return None
    
    name = link_match.group(1)
    link = link_match.group(2)
    
    # Remove the link part from content to process the rest
    remaining_content = content[link_match.end():].strip()
    
    # Extract stars if present
    stars = ""
    stars_pattern = r'!\[stars\]\(([^)]+)\)'
    stars_match = re.search(stars_pattern, remaining_content)
    if stars_match:
        stars = stars_match.group(1)
        remaining_content = remaining_content[stars_match.end():].strip()
    
    # Extract description (everything after the first " - " or just the remaining text)
    description = ""
    if remaining_content.startswith(' - '):
        description = remaining_content[3:].strip()
    elif remaining_content.startswith('- '):
        description = remaining_content[2:].strip()
    elif remaining_content:
        description = remaining_content.strip()
    
    # Clean up description - remove markdown formatting
    description = clean_markdown(description)
    
    # Build category tags
    category_tags = category
    if subcategory:
        category_tags = f"{category}, {subcategory}"
    
    return {
        'category_tags': category_tags,
        'name': name,
        'link': link,
        'stars': stars,
        'description': description,
        'additional_details': ""
    }

def clean_markdown(text):
    """Remove markdown formatting from text."""
    if not text:
        return ""
    
    # Remove bold/italic markers
    text = re.sub(r'\*\*([^*]+)\*\*', r'\1', text)  # **bold**
    text = re.sub(r'\*([^*]+)\*', r'\1', text)      # *italic*
    
    # Remove inline code markers
    text = re.sub(r'`([^`]+)`', r'\1', text)        # `code`
    
    # Remove links but keep the text
    text = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', text)  # [text](link)
    
    # Remove image references
    text = re.sub(r'!\[[^\]]*\]\([^)]+\)', '', text)
    
    return text.strip()

def write_csv(data, output_file):
    """Write the parsed data to CSV file."""
    
    fieldnames = ['Category Tags', 'Name', 'Link', 'Stars', 'Description', 'Additional Details']
    
    with open(output_file, 'w', newline='', encoding='utf-8') as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames, quoting=csv.QUOTE_ALL)
        
        # Write header
        writer.writeheader()
        
        # Write data
        for item in data:
            # Escape newlines in additional details to prevent CSV line breaks
            additional_details = item['additional_details'].replace('\n', '\\n') if item['additional_details'] else ''
            
            writer.writerow({
                'Category Tags': item['category_tags'],
                'Name': item['name'],
                'Link': item['link'],
                'Stars': item['stars'],
                'Description': item['description'],
                'Additional Details': additional_details
            })

if __name__ == "__main__":
    input_file = "SOURCE.md"
    output_file = "awesome-nostr.csv"
    
    # Check if input file exists
    if not Path(input_file).exists():
        print(f"Error: {input_file} not found!")
        sys.exit(1)
    
    parse_markdown_to_csv(input_file, output_file)
