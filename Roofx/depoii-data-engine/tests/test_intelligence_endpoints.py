import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.mark.asyncio
async def test_active_storms_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/v1/storms/active-swaths")
        assert res.status_code == 200
        data = res.json()
        assert data["type"] == "FeatureCollection"
        for feature in data["features"]:
            assert feature["properties"]["storm_name"] != "May 28, 2024 Dallas Severe Hail Core"


@pytest.mark.asyncio
async def test_unresolved_exposure_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/v1/intelligence/unresolved-exposure?min_sqft=50000")
        assert res.status_code == 200
        data = res.json()
        assert data["total_targets"] == 0
        assert data["targets"] == []
        assert data["max_hail_inches"] == 0
        assert data["storm_name"] == ""
        assert "May 28" not in res.text


@pytest.mark.asyncio
async def test_ranked_and_dossier_do_not_serve_old_leads():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        ranked = await client.get("/api/v1/intelligence/leads/ranked")
        assert ranked.status_code == 200
        body = ranked.json()
        assert body["total_matching"] == 0
        assert body["leads"] == []
        for parcel_id in (
            "DCAD-PARCEL-00000662970600000",
            "1001510001",
        ):
            dossier = await client.get(f"/api/v1/intelligence/leads/{parcel_id}/dossier")
            assert dossier.status_code == 404
