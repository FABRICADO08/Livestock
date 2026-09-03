let googleClientId = null;

document.addEventListener('DOMContentLoaded', async function() {
    await initializeSignIn();
});

async function initializeSignIn() {
    try {
        const [configResponse, sessionResponse] = await Promise.all([
            fetch('/api/auth/config'),
            fetch('/api/auth/session')
        ]);

        if (sessionResponse.ok) {
            window.location.href = '/index.html';
            return;
        }

        if (!configResponse.ok) {
            showAlert('Google Sign-In is not configured right now. Please try again later.', 'warning');
            return;
        }

        const config = await configResponse.json();
        googleClientId = config.googleClientId;
        waitForGoogleAndRender(0);
    } catch (error) {
        console.error('Sign-in initialization error:', error);
        showAlert('Could not initialize sign-in', 'danger');
    }
}

function waitForGoogleAndRender(attempt) {
    if (attempt > 20) {
        showAlert('Google Sign-In script did not load', 'warning');
        return;
    }

    if (typeof google !== 'undefined' && google.accounts && google.accounts.id) {
        renderSignInButton();
        return;
    }

    setTimeout(() => waitForGoogleAndRender(attempt + 1), 250);
}

function renderSignInButton() {
    const target = document.getElementById('google-signin-button');
    if (!target || !googleClientId || typeof google === 'undefined' || !google.accounts || !google.accounts.id) {
        return;
    }

    google.accounts.id.initialize({
        client_id: googleClientId,
        callback: handleGoogleCredentialResponse
    });

    target.innerHTML = '';
    google.accounts.id.renderButton(target, {
        theme: 'outline',
        size: 'large',
        text: 'signin_with',
        shape: 'pill',
        width: 340
    });
}

async function handleGoogleCredentialResponse(googleResponse) {
    try {
        const response = await fetch('/api/auth/google', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ credential: googleResponse.credential })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Authentication failed');
        }

        window.location.href = '/index.html';
    } catch (error) {
        console.error('Sign-in error:', error);
        showAlert('Sign-in failed: ' + error.message, 'danger');
    }
}

function showAlert(message, type = 'info') {
    const alertContainer = document.getElementById('signin-alert');
    if (!alertContainer) return;
    alertContainer.innerHTML = `<div class="alert alert-${type}">${message}</div>`;
}
