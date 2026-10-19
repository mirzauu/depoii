import os
import asyncio
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

async def main():
    load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))
    db_url = os.environ.get('DATABASE_URL')
    engine = create_async_engine(db_url)
    async with engine.connect() as conn:
        result = await conn.execute(text('SELECT COUNT(*) FROM normalized_permits'))
        print(f'Count: {result.scalar()}')

if __name__ == "__main__":
    asyncio.run(main())
