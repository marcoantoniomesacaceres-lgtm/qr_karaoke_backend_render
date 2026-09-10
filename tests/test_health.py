"""
Health-check and static-page tests.
No authentication or external services required.
"""


def test_health_check_returns_ok(client):
    """GET /salud should return 200 with {"status": "ok"}."""
    response = client.get("/salud")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_root_serves_frontend(client):
    """GET / should serve the user-facing HTML page (200)."""
    response = client.get("/")
    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]


def test_admin_page_is_served(client):
    """GET /admin should serve the admin login HTML page (200)."""
    response = client.get("/admin")
    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]


def test_player_page_is_served(client):
    """GET /player and /api/v1/player2/ should serve the Player 2.0 page."""
    response = client.get("/api/v1/player2/")
    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]

    response_redirect = client.get("/player", follow_redirects=True)
    assert response_redirect.status_code == 200
    assert "text/html" in response_redirect.headers["content-type"]


