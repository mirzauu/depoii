import asyncio
import os
import sys

# Add the app directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from app.science.brief_service import generate_monday_brief

cities = [
    "Sonoma County, CA",
    "Gainesville, FL",
    "Chicago, IL",
    "Baton Rouge, LA",
    "Ashton, MD",
    "Bethesda, MD",
    "Boyds, MD",
    "Brookeville, MD",
    "Burtonsville, MD",
    "Cabin John, MD",
    "Chevy Chase, MD",
    "Clarksburg, MD",
    "Damascus, MD",
    "Darnestown, MD",
    "Dickerson, MD",
    "Gaithersburg, MD",
    "Germantown, MD",
    "Highland, MD",
    "Kensington, MD",
    "Montgomery County, MD",
    "Montgomery Village, MD",
    "Mount Airy, MD",
    "North Bethesda, MD",
    "Olney, MD",
    "Poolesville, MD",
    "Potomac, MD",
    "Rockville, MD",
    "Sandy Spring, MD",
    "Silver Spring, MD",
    "Takoma Park, MD",
    "Wheaton, MD",
    "Cambridge, MA",
    "Framingham, MA",
    "New York City, NY",
    "Cincinnati, OH",
    "Addison, TX",
    "Austin, TX",
    "Dallas, TX",
    "Fort Worth, TX"
]

async def main():
    print(f"{'City':<30} | {'Unresolved Buildings':<20}")
    print("-" * 52)
    for city in cities:
        try:
            brief = await generate_monday_brief(city)
            print(f"{city:<30} | {brief.summary.unresolved_buildings:<20}")
        except Exception as e:
            print(f"{city:<30} | Error: {e}")

if __name__ == '__main__':
    asyncio.run(main())
