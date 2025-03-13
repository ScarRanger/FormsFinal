document.addEventListener('DOMContentLoaded', async function () {
    await loadFormFields(); // Load form fields dynamically when page loads
});

const statisurl = "https://8383-2401-4900-52b2-2d88-e19e-4232-5d1f-969e.ngrok-free.app"

async function loadFormFields() {
    try {
        const response = await fetch(statisurl+'/get_form_fields'); // Fetch form fields from backend
        const fields = await response.json();

        const form = document.getElementById('dynamicForm');
        form.innerHTML = ''; // Clear previous fields

        fields.forEach(field => {
            const div = document.createElement('div');
            div.classList.add('inputbox');

            let input;
            if (field.type === 'file') {
                input = document.createElement('input');
                input.type = 'file';
                input.id = field.name;
                input.accept = 'image/*';
                input.addEventListener('change', previewImage);
            } else {
                input = document.createElement('input');
                input.type = field.type;
                input.id = field.name;
                input.required = field.required;
                if (field.type === 'email') {
                    input.addEventListener('input', () => validateEmail(input));
                }
                if (field.type === 'tel') {
                    input.addEventListener('input', () => validatePhone(input));
                }
            }

            const label = document.createElement('span');
            label.textContent = field.name.charAt(0).toUpperCase() + field.name.slice(1);

            div.appendChild(input);
            div.appendChild(label);
            form.appendChild(div);
        });

        // Image preview container
        const previewDiv = document.createElement('div');
        previewDiv.classList.add('image-preview');
        const img = document.createElement('img');
        img.id = 'imagePreview';
        img.style.display = 'none';
        previewDiv.appendChild(img);
        form.appendChild(previewDiv);

        // Progress bar container
        const progressContainer = document.createElement('div');
        progressContainer.classList.add('progress-container');
        progressContainer.id = 'progressContainer';
        const progressBar = document.createElement('div');
        progressBar.classList.add('progress-bar');
        progressBar.id = 'progressBar';
        progressContainer.appendChild(progressBar);
        form.appendChild(progressContainer);

        // Error message container
        const errorContainer = document.createElement('div');
        errorContainer.id = 'errorContainer';
        errorContainer.classList.add('error-container');
        form.appendChild(errorContainer);

        // Append submit button
        const submitBtn = document.createElement('input');
        submitBtn.type = 'submit';
        submitBtn.value = 'Submit';
        submitBtn.classList.add('sub');
        submitBtn.id = 'submit';
        submitBtn.addEventListener('click', submitForm);

        form.appendChild(submitBtn);
    } catch (error) {
        console.error('Error loading form fields:', error);
    }
}

// Image preview before upload
function previewImage(event) {
    const file = event.target.files[0];

    if (file) {
        if (file.size > 5 * 1024 * 1024) { // 5MB size limit
            showError(null, "File is too large! Maximum size is 5MB.");
            return;
        }

        const reader = new FileReader();
        reader.onload = function (e) {
            const imgPreview = document.getElementById('imagePreview');
            imgPreview.src = e.target.result;
            imgPreview.style.display = 'block';
        };
        reader.readAsDataURL(file);
    }
}

// Form submission
// Function to show loading overlay with Bootstrap spinner
function showLoadingOverlay() {
    let overlay = document.createElement('div');
    overlay.id = 'loadingOverlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    overlay.style.display = 'flex';
    overlay.style.justifyContent = 'center';
    overlay.style.alignItems = 'center';
    overlay.style.zIndex = '9999';

    overlay.innerHTML = `
        <div class="text-center text-white">
            <div class="spinner-border text-light" role="status">
                <span class="visually-hidden">Uploading...</span>
            </div>
            <p class="mt-2">Submitting.....</p>
        </div>
    `;

    document.body.appendChild(overlay);
}

// Function to remove loading overlay
function hideLoadingOverlay() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.remove();
    }
}

// Updated form submission function
async function submitForm(e) {
    e.preventDefault();
    showLoadingOverlay(); // Show spinner overlay

    const formData = new FormData();
    const inputs = document.querySelectorAll('#dynamicForm input');

    let hasEmptyField = false;
    let invalidEmail = false;
    let invalidPhone = false;

    document.querySelectorAll('.error-message').forEach(el => el.remove());
    clearError(null); 

    inputs.forEach(input => {
        if (input.required && !input.value) {
            hasEmptyField = true;
            showError(input, "This field is required.");
        }
        if (input.type === 'email' && !validateEmail(input)) {
            invalidEmail = true;
        }
        if (input.type === 'tel' && !validatePhone(input)) {
            invalidPhone = true;
        }
        if (input.type === 'file' && input.files.length > 0) {
            if (input.files[0].size > 5 * 1024 * 1024) {
                showError(null, "File is too large! Maximum size is 5MB.");
                hideLoadingOverlay(); // Hide overlay if file is too large
                return;
            }
            formData.append(input.id, input.files[0]);

            // Convert image to base64 and store it for success page
            const reader = new FileReader();
            reader.onload = function (event) {
                sessionStorage.setItem("uploadedImage", event.target.result);
            };
            reader.readAsDataURL(input.files[0]);
        } else {
            formData.append(input.id, input.value);
        }
    });

    if (hasEmptyField || invalidEmail || invalidPhone) {
        showError(null, "Please correct the errors in the form.");
        hideLoadingOverlay();
        return;
    }

    try {
        const response = await fetch(statisurl+"/submit_form", {
            method: 'POST',
            body: formData
        });

        const result = await response.json();
        if (result.success) {
            alert("Data stored successfully!");

            document.getElementById("dynamicForm").reset();
            document.getElementById("imagePreview").src = "";
            document.getElementById("imagePreview").style.display = "none";

            hideLoadingOverlay(); // Hide overlay after success

            const queryParams = new URLSearchParams();
            formData.forEach((value, key) => {
                if (key !== "submit") { // Exclude "submit" field
                    queryParams.append(key.charAt(0).toUpperCase() + key.slice(1), value);
                }
            });

            window.location.href = `success.html?${queryParams.toString()}`;
        } else {
            console.error("Error submitting data:", result.message);
            showError(null, "An error occurred: " + result.message);
            hideLoadingOverlay();
        }

    } catch (error) {
        console.error("Error submitting data:", error);
        showError(null, "A network error occurred. Please try again later.");
        hideLoadingOverlay();
    }
}




// Email validation function
function validateEmail(input) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isValid = re.test(input.value);
    if (!isValid) {
        showError(input, "Please enter a valid email address.");
    } else {
        clearError(input);
    }
    return isValid;
}

// Phone number validation function
function validatePhone(input) {
    const re = /^(?:0\d{10}|\d{10})$/;
    const isValid = re.test(input.value);
    if (!isValid) {
        showError(input, "Please enter a valid phone number.");
    } else {
        clearError(input);
    }
    return isValid;
}

// Show error message below the input field or in the general error container
function showError(input, message) {
    if (input) {
        clearError(input);
        const error = document.createElement('div');
        error.classList.add('error-message');
        error.textContent = message;
        input.parentNode.appendChild(error);
    } else {
        const errorContainer = document.getElementById('errorContainer');
        errorContainer.textContent = message;
        errorContainer.style.display = 'block';
    }
}

// Clear error message below the input field or in the general error container
function clearError(input) {
    if (input) {
        const error = input.parentNode.querySelector('.error-message');
        if (error) {
            error.remove();
        }
    } else {
        const errorContainer = document.getElementById('errorContainer');
        errorContainer.textContent = '';
        errorContainer.style.display = 'none';
    }
}
