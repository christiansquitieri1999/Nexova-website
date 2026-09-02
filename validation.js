const form = document.querySelector('#talent-form');

if (form) {
	const fields = {
		fullName: document.querySelector('#full-name'),
		email: document.querySelector('#email'),
		phone: document.querySelector('#phone'),
		country: document.querySelector('#country'),
		yearsExperience: document.querySelector('#years-experience'),
		sector: document.querySelector('#sector'),
		englishLevel: document.querySelector('#english-level'),
		linkedin: document.querySelector('#linkedin'),
		comments: document.querySelector('#comments'),
		dataPolicy: document.querySelector('#data-policy')
	};

	const commentsCounter = document.querySelector('#comments-counter');
	const successMessage = document.querySelector('#success-message');
	const clearButton = document.querySelector('#clear-form');
	const errorClasses = ['border-red-600', 'bg-red-50', 'focus:border-red-700', 'focus:ring-red-700/30'];
	const validClasses = ['border-green-500', 'bg-green-50', 'focus:border-green-500', 'focus:ring-green-100'];
	const touchedFields = new Set();

	const validators = {
		fullName: () => fields.fullName.value.trim().split(/\s+/).filter(Boolean).length >= 2,
		email: () => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email.value.trim()),
		phone: () => /^\+\d{1,3}\s[\d\s()-]{6,}$/.test(fields.phone.value.trim()),
		country: () => fields.country.value !== '',
		yearsExperience: () => {
			const years = Number(fields.yearsExperience.value);
			return fields.yearsExperience.value !== '' && Number.isInteger(years) && years >= 0 && years <= 50;
		},
		sector: () => fields.sector.value !== '',
		englishLevel: () => fields.englishLevel.value !== '',
		availability: () => Boolean(form.querySelector('input[name="availability"]:checked')),
		linkedin: () => fields.linkedin.value.trim() === '' || /^https?:\/\/.+\..+/.test(fields.linkedin.value.trim()),
		comments: () => fields.comments.value.length <= 500,
		dataPolicy: () => fields.dataPolicy.checked
	};

	const messages = {
		fullName: 'Name must contain at least first and last name',
		email: 'Enter a valid email (example: name@company.com)',
		phone: 'Phone must include country code (example: +34 612 345 678)',
		country: 'Select your country of residence',
		yearsExperience: 'Years of experience must be between 0 and 50',
		sector: 'Select your sector of interest',
		englishLevel: 'Indicate your English level',
		availability: 'Select your availability',
		linkedin: 'If you include LinkedIn, it must be a valid URL',
		comments: () => `Comments cannot exceed 500 characters (${500 - fields.comments.value.length} remaining)`,
		dataPolicy: 'You must accept the data processing policy to continue'
	};

	const errorIds = {
		fullName: 'full-name-error',
		email: 'email-error',
		phone: 'phone-error',
		country: 'country-error',
		yearsExperience: 'years-experience-error',
		sector: 'sector-error',
		englishLevel: 'english-level-error',
		availability: 'availability-error',
		linkedin: 'linkedin-error',
		comments: 'comments-error',
		dataPolicy: 'data-policy-error'
	};
	const fieldNames = Object.keys(validators);

	function setError(name, message) {
		const error = document.querySelector(`#${errorIds[name]}`);
		if (!error) return;

		const controls = name === 'availability'
			? [...form.querySelectorAll('input[name="availability"]')]
			: [fields[name]];

		error.setAttribute('role', 'alert');
		error.setAttribute('aria-live', 'polite');
		error.classList.add('rounded-lg', 'border', 'border-red-200', 'bg-red-50', 'px-3', 'py-2');

		if (message) {
			error.textContent = message;
			error.classList.remove('hidden');
			controls.forEach((control) => {
				if (!control) return;
				control.setAttribute('aria-invalid', 'true');
				control.setAttribute('aria-describedby', mergeDescriptions(control, errorIds[name]));
				control.classList.remove(...validClasses);
				control.classList.add(...errorClasses);
			});
			return;
		}

		error.textContent = '';
		error.classList.add('hidden');
		controls.forEach((control) => {
			if (!control) return;
			control.removeAttribute('aria-invalid');
			const descriptions = removeDescription(control, errorIds[name]);
			if (descriptions) {
				control.setAttribute('aria-describedby', descriptions);
			} else {
				control.removeAttribute('aria-describedby');
			}
			control.classList.remove(...errorClasses);
			if (shouldShowValidState(name)) {
				control.classList.add(...validClasses);
			} else {
				control.classList.remove(...validClasses);
			}
		});
	}

	function mergeDescriptions(control, errorId) {
		const descriptions = new Set((control.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean));
		descriptions.add(errorId);
		return [...descriptions].join(' ');
	}

	function removeDescription(control, errorId) {
		return (control.getAttribute('aria-describedby') || '')
			.split(/\s+/)
			.filter((description) => description && description !== errorId)
			.join(' ');
	}

	function shouldShowValidState(name) {
		if (!touchedFields.has(name)) return false;
		if (name === 'availability') return validators.availability();
		if (name === 'linkedin' || name === 'comments') return fields[name].value.trim() !== '';
		return Boolean(fields[name]?.value || fields[name]?.checked);
	}

	function validateField(name, hideSuccess = true) {
		touchedFields.add(name);
		const isValid = validators[name]();
		const message = typeof messages[name] === 'function' ? messages[name]() : messages[name];
		setError(name, isValid ? '' : message);
		if (hideSuccess) {
			successMessage.classList.add('hidden');
		}
		return isValid;
	}

	function updateCommentsCounter(shouldValidate = true) {
		const remaining = 500 - fields.comments.value.length;
		commentsCounter.textContent = `${remaining} remaining`;
		if (shouldValidate) {
			validateField('comments');
		}
	}

	function clearFormState(showSuccess = false) {
		form.reset();
		touchedFields.clear();
		fieldNames.forEach((name) => setError(name, ''));
		updateCommentsCounter(false);
		successMessage.classList.toggle('hidden', !showSuccess);
	}

	['fullName', 'email', 'phone', 'country', 'yearsExperience', 'sector', 'englishLevel', 'linkedin', 'dataPolicy'].forEach((name) => {
		fields[name].addEventListener('input', () => validateField(name));
		fields[name].addEventListener('change', () => validateField(name));
		fields[name].addEventListener('blur', () => validateField(name));
	});

	form.querySelectorAll('input[name="availability"]').forEach((input) => {
		input.addEventListener('change', () => validateField('availability'));
	});

	fields.comments.addEventListener('input', updateCommentsCounter);
	updateCommentsCounter(false);
	clearButton?.addEventListener('click', () => {
		clearFormState(false);
		fields.fullName.focus();
	});

	form.addEventListener('submit', (event) => {
		event.preventDefault();

		const isValid = fieldNames.map((name) => validateField(name, false)).every(Boolean);

		successMessage.classList.toggle('hidden', !isValid);

		if (isValid) {
			clearFormState(true);
			successMessage.focus();
		} else {
			const firstInvalidField = fieldNames.find((name) => !validators[name]());
			const firstInvalidControl = firstInvalidField === 'availability'
				? form.querySelector('input[name="availability"]')
				: fields[firstInvalidField];

			firstInvalidControl?.focus();
		}
	});
}
