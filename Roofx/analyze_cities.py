import json
from collections import Counter

def analyze():
    path = "depoii-data-engine/warehouse_cache.json"
    try:
        with open(path, "r", encoding="utf-8") as f:
            permits = json.load(f)
        
        print(f"Total Permits: {len(permits)}")
        
        cities = Counter()
        for p in permits:
            city = p.get("city")
            if not city:
                city = "Unknown"
            cities[city] += 1
            
        print(f"Total Unique Cities: {len(cities)}")
        print("\nBreakdown by City:")
        for city, count in cities.most_common():
            print(f"  - {city}: {count} permits")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    analyze()
