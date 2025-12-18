// Interception script running in the Main World
(function () {
    console.log('Efaas Extension: Initializing interception script in Main World');

    // Save original submit function
    const originalSubmit = HTMLFormElement.prototype.submit;

    // Override submit
    HTMLFormElement.prototype.submit = function () {
        console.log('Efaas Extension: Intercepted form.submit() call');

        // Check if this looks like the OAuth callback form
        const codeInput = this.querySelector('input[name="code"]');
        const stateInput = this.querySelector('input[name="state"]');

        if (codeInput && stateInput) {
            // CHECK FOR DISABLE FLAG
            if (document.documentElement.hasAttribute('data-efaas-interception-disabled')) {
                console.log('Efaas Extension: Interception skipped (disabled by user) - override');
                return originalSubmit.apply(this, arguments);
            }

            console.log('Efaas Extension: Detected OAuth callback form submission');

            // Extract data
            const formData = {};
            const inputs = this.querySelectorAll('input');
            inputs.forEach(input => {
                if (input.name) formData[input.name] = input.value;
            });

            // Dispatch event to content script
            const event = new CustomEvent('efaasOAuthIntercepted', {
                detail: {
                    formData: formData,
                    originalAction: this.action
                }
            });
            window.dispatchEvent(event);

            // STOP the submission
            return;
        }

        // If not our form, proceed normally
        return originalSubmit.apply(this, arguments);
    };

    // Also try to intercept standard submit events (user clicks)
    window.addEventListener('submit', function (e) {
        const form = e.target;
        // Check if form is valid before querying
        if (!form || !form.querySelector) return;

        const codeInput = form.querySelector('input[name="code"]');
        const stateInput = form.querySelector('input[name="state"]');

        if (codeInput && stateInput) {
            // CHECK FOR DISABLE FLAG FIRST
            if (document.documentElement.hasAttribute('data-efaas-interception-disabled')) {
                console.log('Efaas Extension: Interception skipped (disabled by user) - listener');
                return; // Allow default submission
            }

            console.log('Efaas Extension: Intercepted submit event');
            e.preventDefault();
            e.stopImmediatePropagation();

            const formData = {};
            const inputs = form.querySelectorAll('input');
            inputs.forEach(input => {
                if (input.name) formData[input.name] = input.value;
            });

            const event = new CustomEvent('efaasOAuthIntercepted', {
                detail: {
                    formData: formData,
                    originalAction: form.action
                }
            });
            window.dispatchEvent(event);
        }
    }, true); // Capture phase matches earlier

})();
