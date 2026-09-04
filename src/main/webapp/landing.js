// Landing page: greet signed-in users and route them to the right area.

document.addEventListener('DOMContentLoaded', async function () {
    const statusEl = document.getElementById('landing-status');
    const actionsEl = document.getElementById('landing-actions');
    const copyEl = document.getElementById('landing-copy');

    try {
        const response = await fetch('/api/auth/session');
        if (response.ok) {
            const user = await response.json();
            const name = (user.name && user.name.trim()) || user.email;
            copyEl.innerHTML = `Welcome back, <strong>${escapeHtml(name)}</strong>!<br>Jump back into your workspace.`;
            if (user.role === 'BUYER') {
                actionsEl.innerHTML = `
                    <a class="landing-btn landing-btn-primary" href="/index.html"><i class="bi bi-shop"></i>Browse Marketplace</a>
                    <a class="landing-btn landing-btn-outline" href="#" id="landing-logout"><i class="bi bi-box-arrow-left"></i>Sign Out</a>`;
            } else {
                actionsEl.innerHTML = `
                    <a class="landing-btn landing-btn-primary" href="/index.html"><i class="bi bi-grid-1x2-fill"></i>Open Dashboard</a>
                    <a class="landing-btn landing-btn-outline" href="#" id="landing-logout"><i class="bi bi-box-arrow-left"></i>Sign Out</a>`;
            }
            statusEl.textContent = 'You are signed in.';
        } else {
            statusEl.textContent = 'Sign in to get started.';
        }
    } catch (error) {
        statusEl.textContent = 'Sign in to get started.';
    }

    const logoutLink = document.getElementById('landing-logout');
    if (logoutLink) {
        logoutLink.addEventListener('click', async function (e) {
            e.preventDefault();
            try {
                await fetch('/api/auth/logout', { method: 'POST' });
            } catch (error) {
                // Ignore: we reload the page either way
            }
            window.location.reload();
        });
    }
});

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
