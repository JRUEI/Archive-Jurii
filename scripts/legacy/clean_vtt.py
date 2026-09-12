import sys
import re

def clean_vtt(input_path, output_path):
    with open(input_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    clean_lines = []
    current_time = "00:00"
    
    for line in lines:
        line = line.strip()
        if not line or line == 'WEBVTT' or line.startswith('Kind:') or line.startswith('Language:'):
            continue
            
        if '-->' in line:
            # Extract starting time
            match = re.search(r'^(\d{2}:\d{2}:\d{2})', line)
            if match:
                # Convert 00:00:04 to 00:04
                time_parts = match.group(1).split(':')
                if len(time_parts) == 3:
                    if time_parts[0] == '00':
                        current_time = f"{time_parts[1]}:{time_parts[2]}"
                    else:
                        current_time = f"{time_parts[0]}:{time_parts[1]}:{time_parts[2]}"
            continue
            
        # Remove tags
        clean_text = re.sub(r'<[^>]+>', '', line).strip()
        
        if clean_text:
            clean_lines.append((current_time, clean_text))

    # Deduplicate
    deduped = []
    for time, text in clean_lines:
        if not deduped:
            deduped.append((time, text))
            continue
            
        last_time, last_text = deduped[-1]
        
        if text == last_text:
            continue
            
        # Sometimes a line is just a substring because it's growing
        # But since we stripped tags, the line with tags is actually the FULL line.
        # Let's just avoid adjacent exact duplicates.
        if text not in last_text:
            deduped.append((time, text))
        else:
            # text is in last_text, so it's a redundant prefix, ignore
            pass

    with open(output_path, 'w', encoding='utf-8') as f:
        for time, text in deduped:
            f.write(f"[{time}] {text}\n")

if __name__ == "__main__":
    clean_vtt(sys.argv[1], sys.argv[2])
