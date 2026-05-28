import csv, json

# --- AMX ---
amx_cards = []
with open('/Users/davidconklin/Goodebags/card-data/AMX_cards.csv', newline='', encoding='latin-1') as f:
    reader = csv.DictReader(f)
    for row in reader:
        card_id = row['card_id'].strip()
        deck = row['deck'].strip()
        animations = [f"assets/animations/{card_id}.mp4"]
        if card_id == 'AM#43':
            animations.append("assets/animations/AM#43b.mp4")
        card = {
            "id": card_id,
            "deck": deck,
            "image": f"assets/cards/{card_id}.png",
            "animations": animations,
            "traits": [
                {"name": "Background",        "value": int(row['trait1_value'])},
                {"name": "Wearing & Holding", "value": int(row['trait2_value'])},
                {"name": "Head & Hat",        "value": int(row['trait3_value'])},
                {"name": "Face",              "value": int(row['trait4_value'])},
                {"name": "Eyes",              "value": int(row['trait5_value'])},
            ],
            "xtra": {
                "name": row['xtra_name'].strip(),
                "value": int(row['xtra_value'])
            }
        }
        amx_cards.append(card)

with open('/Users/davidconklin/Goodebags/public/games/apemodx/data/cards.json', 'w') as f:
    json.dump(amx_cards, f, indent=2)
print(f"AMX: {len(amx_cards)} cards written")

# --- TBK ---
tbk_cards = []
with open('/Users/davidconklin/Goodebags/card-data/TBK_cards.csv', newline='', encoding='latin-1') as f:
    reader = csv.DictReader(f)
    for row in reader:
        card_id = row['card_id'].strip()
        card = {
            "id": card_id,
            "image": f"assets/cards/{card_id}.png",
            "animations": [f"assets/animations/{card_id}.mp4"],
            "traits": [
                {"name": "Background", "value": int(row['trait1_value'])},
                {"name": "Shoes",      "value": int(row['trait2_value'])},
                {"name": "Wings",      "value": int(row['trait3_value'])},
                {"name": "Stinger",    "value": int(row['trait4_value'])},
                {"name": "Clothes",    "value": int(row['trait5_value'])},
                {"name": "Eyes",       "value": int(row['trait6_value'])},
                {"name": "Knees",      "value": int(row['trait7_value'])},
                {"name": "Antennae",   "value": int(row['trait8_value'])},
            ]
        }
        tbk_cards.append(card)

with open('/Users/davidconklin/Goodebags/public/games/tbk/data/cards.json', 'w') as f:
    json.dump(tbk_cards, f, indent=2)
print(f"TBK: {len(tbk_cards)} cards written")
