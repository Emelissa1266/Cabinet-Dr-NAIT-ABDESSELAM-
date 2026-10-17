import pytest


@pytest.mark.django_db
def test_health_check_confirms_database_readiness(api_client):
    response = api_client.get("/api/v1/health/")

    assert response.status_code == 200
    assert response.data == {
        "status": "ok",
        "service": "clinic-management-api",
        "database": "ok",
    }
