/* DOM references */
const loginView = document.getElementById("loginView");
const appView = document.getElementById("appView");
const content = document.getElementById("content");

const loginForm = document.getElementById("loginForm");
const loginMsg = document.getElementById("loginMsg");
const logoutLink = document.getElementById("logoutLink");


/* Session state */
let currentUserRole = null;


/* Role and access helpers */
async function loadMe() {
  const me = await getJSON("dolphin.php?action=me");
  currentUserRole = me.role;
  return me;
}

function isAdmin() {
  return String(currentUserRole || "").toLowerCase() === "admin";
}

function applyRoleUI() {
  const usersNav = document.getElementById("usersNav");
  if (usersNav) {
    usersNav.classList.toggle("hidden", !isAdmin());
  }
}

function setActiveNav(route) {
	document.querySelectorAll(".sidebar a").forEach((link) => {
    	link.classList.remove("active");

    	if (link.dataset.route === route) {
      		link.classList.add("active");
    	}
  	});
}



/* API helpers */
async function postAction(action, data) {
	const form = new FormData();
	form.append("action", action);

	Object.keys(data).forEach((k) => form.append(k, data[k]));

	const res = await fetch("dolphin.php", {
		method: "POST",
		body: form,
		credentials: "same-origin"
	});

	const text = await res.text();
	return { ok: res.ok, status: res.status, text };
}

async function getJSON(url) {
	const res = await fetch(url, { credentials: "same-origin" });

	if (!res.ok) {
		const text = await res.text();
		throw new Error(text || "Request failed");
	}

	return res.json();
}


/* View toggling */
function showApp() {
	loginView.classList.add("hidden");
	appView.classList.remove("hidden");
}

function showLogin() {
	appView.classList.add("hidden");
	loginView.classList.remove("hidden");
}


/* Formatting utilities */
function formatSqlDateTime(sql) {
  	// Expected: "YYYY-MM-DD HH:MM:SS"
  	if (!sql) return "";

  	const s = String(sql).trim();

  	// If it's only a date (YYYY-MM-DD)
  	if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    	const d = new Date(`${s}T00:00:00`);
    	if (Number.isNaN(d.getTime())) return s;
    	return new Intl.DateTimeFormat("en-US", {
      		month: "long",
      		day: "numeric",
      		year: "numeric"
    	}).format(d);
  	}

  	// If it's date + time
  	const parts = s.split(" ");
  	if (parts.length >= 2) {
    	const [datePart, timePart] = parts;
    	const d = new Date(`${datePart}T00:00:00`);
    	if (Number.isNaN(d.getTime())) return s;

    	const prettyDate = new Intl.DateTimeFormat("en-US", {
      		month: "long",
      		day: "numeric",
      		year: "numeric"
    	}).format(d);

    	return `${prettyDate} ${timePart}`;
  	}

  	return s;
}


function esc(value) {
	return String(value ?? "")
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#039;");
}

function formatName(title, firstname, lastname) {
	return [title, firstname, lastname].filter(Boolean).join(" ").trim();
}

function typePill(type) {
	const t = String(type || "").toLowerCase();

	if (t.includes("sales")) {
		return '<span class="pill lead">SALES LEAD</span>';
	}

	return '<span class="pill support">SUPPORT</span>';
}


/* Dashboard */
async function loadDashboard(filter = "all") {
	content.innerHTML = `
		<div class="page-header">
			<div class="page-title">Dashboard</div>
			<button class="primary-btn" id="addContactBtn">+ Add Contact</button>
		</div>

		<!-- Card starts from Filter By onwards -->
		<div class="card">
			<div class="filters" id="dashboardFilters">
				<span class="filter-label">
					<i class="fa-solid fa-filter"></i>
					Filter By:
				</span>
				<a href="#" data-filter="all" class="active">All</a>
				<a href="#" data-filter="sales">Sales Leads</a>
				<a href="#" data-filter="support">Support</a>
				<a href="#" data-filter="assigned">Assigned to me</a>
			</div>

			<div class="table-wrap">
				<table>
					<thead>
						<tr>
							<th>Name</th>
							<th>Email</th>
							<th>Company</th>
							<th>Type</th>
							<th></th>
						</tr>
					</thead>
					<tbody id="contactsBody">
						<tr>
							<td colspan="5">Loading...</td>
						</tr>
					</tbody>
				</table>
			</div>
		</div>
	`;

	document.getElementById("addContactBtn").addEventListener("click", (e) => {
		e.preventDefault();
		loadRoute("new-contact");
	});

	const filters = document.getElementById("dashboardFilters");
	filters.addEventListener("click", async (e) => {
		const link = e.target.closest("a[data-filter]");
		if (!link) return;

		e.preventDefault();
		const selected = link.dataset.filter;

		filters.querySelectorAll("a[data-filter]").forEach((a) => {
			a.classList.toggle("active", a.dataset.filter === selected);
		});

		await renderContacts(selected);
	});

	await renderContacts(filter);
}


/* Dashboard data rendering */
async function renderContacts(filter) {
	const body = document.getElementById("contactsBody");

	try {
		const contacts = await getJSON("dolphin.php?action=contacts");

		let rows = contacts;

		if (filter === "sales") {
			rows = contacts.filter((c) => String(c.type || "").toLowerCase().includes("sales"));
		}

		if (filter === "support") {
			rows = contacts.filter((c) => String(c.type || "").toLowerCase().includes("support"));
		}

		if (filter === "assigned") {
			rows = contacts.filter((c) => Number(c.assigned_to) === Number(c.current_user_id || 0));
		}

		if (!rows.length) {
			body.innerHTML = `
				<tr>
					<td colspan="5">No contacts found.</td>
				</tr>
			`;
			return;
		}

		body.innerHTML = rows
			.map((c) => {
				const name = formatName(c.title, c.firstname, c.lastname);
				return `
					<tr>
						<td>${esc(name)}</td>
						<td>${esc(c.email)}</td>
						<td>${esc(c.company)}</td>
						<td>${typePill(c.type)}</td>
						<td><a class="view-link" href="#" data-id="${esc(c.id)}">View</a></td>
					</tr>
				`;
			})
			.join("");

		body.querySelectorAll("a.view-link").forEach((a) => {
			a.addEventListener("click", (e) => {
				e.preventDefault();
				const id = a.dataset.id;
				loadRoute(`contact:${id}`);
			});
		});
	} catch (err) {
		body.innerHTML = `
			<tr>
				<td colspan="5">${esc(err.message || "Failed to load contacts")}</td>
			</tr>
		`;
	}
}


/* Users */
async function loadUsers() {
	content.innerHTML = `<div class="page-title">Users</div><p>Loading...</p>`;

	try {
		const users = await getJSON("dolphin.php?action=users");

		content.innerHTML = `
			<div class="page-header">
				<div class="page-title">Users</div>
				<button class="primary-btn" id="addUserBtn">+ Add User</button>
			</div>

			<div class="table-wrap">
				<table>
					<thead>
						<tr>
							<th>Name</th>
							<th>Email</th>
							<th>Role</th>
							<th>Created</th>
						</tr>
					</thead>
					<tbody>
						${users
							.map((u) => {
								const name = [u.firstname, u.lastname].filter(Boolean).join(" ");
								return `
									<tr>
										<td>${esc(name)}</td>
										<td>${esc(u.email)}</td>
										<td>${esc(u.role)}</td>
										<td>${esc(u.created_at)}</td>
									</tr>
								`;
							})
							.join("")}
					</tbody>
				</table>
			</div>
		`;

		document.getElementById("addUserBtn").addEventListener("click", (e) => {
			e.preventDefault();
			loadRoute("new-user");
		});
	} catch (err) {
		content.textContent = err.message || "Failed to load users";
	}
}


/* New user form */
async function loadNewUser() {
	content.innerHTML = `
		<div class="page-header">
			<div class="page-title">New User</div>
		</div>

		<div class="contact-form">
			<form id="newUserForm">
				<div class="form-grid">
					<div class="form-group">
						<label for="ufirstname">First Name</label>
						<input id="ufirstname" name="firstname" type="text" placeholder="Jane" required>
					</div>

					<div class="form-group">
						<label for="ulastname">Last Name</label>
						<input id="ulastname" name="lastname" type="text" placeholder="Doe" required>
					</div>

					<div class="form-group">
						<label for="uemail">Email</label>
						<input id="uemail" name="email" type="email" placeholder="something@example.com" required>
					</div>

					<div class="form-group">
						<label for="upassword">Password</label>
						<input id="upassword" name="password" type="password" required>
					</div>

					<div class="form-group" style="max-width: 240px;">
						<label for="urole">Role</label>
						<select id="urole" name="role" required>
							<option value="Member">Member</option>
							<option value="Admin">Admin</option>
						</select>
					</div>
				</div>

				<div class="form-actions">
					<button type="submit">Save</button>
					<p id="newUserMsg" class="msg" aria-live="polite"></p>
				</div>
			</form>
		</div>
	`;

	document.getElementById("newUserForm").addEventListener("submit", async (e) => {
		e.preventDefault();
		const msg = document.getElementById("newUserMsg");
		msg.textContent = "";

		const f = e.target;

		const data = {
			firstname: f.firstname.value.trim(),
			lastname: f.lastname.value.trim(),
			email: f.email.value.trim(),
			password: f.password.value,
			role: f.role.value
		};

		const result = await postAction("add_user", data);

		if (!result.ok) {
			msg.textContent = result.text || "Failed to add user";
			return;
		}

		msg.textContent = result.text || "User created";
  		msg.classList.add("success");

		f.reset();
  		f.role.value = "Member";

		// go back to users list and show the new user
		setTimeout(() => loadUsers(), 600);
	});
}



/* Contact details */
async function loadContactDetails(id) {
	content.innerHTML = `<div class="page-title">Contact</div><p>Loading...</p>`;

	try {
		const contact = await getJSON(
			`dolphin.php?action=contact&id=${encodeURIComponent(id)}`
		);

		const currentType = String(contact.type || "").toLowerCase();
		const isSales = currentType.includes("sales");
		const nextType = isSales ? "Support" : "Sales Lead";
		const switchLabel = isSales ? "Switch to Support" : "Switch to Sales Lead";

		let notes = [];
		try {
			notes = await getJSON(
				`dolphin.php?action=notes&contact_id=${encodeURIComponent(id)}`
			);
		} catch (e) {
			notes = [];
		}

		const name = formatName(contact.title, contact.firstname, contact.lastname);

		const createdAt = contact.created_at ? formatSqlDateTime(contact.created_at) : "";
		const updatedAt = contact.updated_at ? formatSqlDateTime(contact.updated_at) : "";


		const assignedTo = contact.assigned_to_name
			? String(contact.assigned_to_name)
			: contact.assigned_to
				? `User #${contact.assigned_to}`
				: "Unassigned";

		const createdBy = contact.created_by_name
			? String(contact.created_by_name)
			: contact.created_by
				? `User #${contact.created_by}`
				: "Unknown";

		const notesHtml = notes.length
			? notes
					.map((n) => {
						const author = `${n.firstname || ""} ${n.lastname || ""}`.trim() || "User";
						const body = n.comment || "";
						const time = n.created_at ? formatSqlDateTime(n.created_at) : "";
						return `
							<div class="note">
								<div class="note-author">${esc(author)}</div>
								<div class="note-body">${esc(body)}</div>
								<div class="note-time">${esc(time)}</div>
							</div>
						`;
					})
					.join("")
			: `<div class="note-empty">No notes yet.</div>`;

		content.innerHTML = `
			<div class="contact-header">
				<div class="contact-left">
					<div class="avatar" aria-hidden="true">
						<i class="fa-solid fa-user"></i>
					</div>

					<div>
						<div class="contact-name">${esc(name)}</div>
						<div class="contact-meta">
							<div>Created on ${esc(createdAt)} by ${esc(createdBy)}</div>
							<div>Updated on ${esc(updatedAt)}</div>
						</div>
					</div>
				</div>

				<div class="contact-actions">
  					<button class="btn success" id="assignMeBtn" type="button">
    					<i class="fa-solid fa-user-check" aria-hidden="true"></i>
    					<span>Assign to me</span>
  					</button>

  					<button class="btn warn" id="switchTypeBtn" type="button">
    					<i class="fa-solid fa-right-left" aria-hidden="true"></i>
    					<span>${switchLabel}</span>
  					</button>
				</div>
			</div>

			<div class="info-card">
				<div class="info-grid">
					<div class="info-item">
						<div class="info-label">Email</div>
						<div class="info-value">${esc(contact.email)}</div>
					</div>

					<div class="info-item">
						<div class="info-label">Telephone</div>
						<div class="info-value">${esc(contact.telephone || "")}</div>
					</div>

					<div class="info-item">
						<div class="info-label">Company</div>
						<div class="info-value">${esc(contact.company || "")}</div>
					</div>

					<div class="info-item">
						<div class="info-label">Assigned To</div>
						<div class="info-value">${esc(assignedTo)}</div>
					</div>
				</div>
			</div>

			<div class="notes-card">
				<div class="notes-head">
					<div class="notes-title">Notes</div>
				</div>

				<div class="notes-list" id="notesList">
					${notesHtml}
				</div>

				<div class="notes-form">
					<label for="noteText" class="note-label">
						Add a note about ${esc(contact.firstname || "this contact")}
					</label>
					<textarea id="noteText" rows="4" placeholder="Enter details here"></textarea>
					<div class="notes-form-actions">
						<button class="btn primary" id="addNoteBtn" type="button">Add Note</button>
					</div>
				</div>
			</div>
		`;

		document.getElementById("addNoteBtn").addEventListener("click", async () => {
			const noteText = document.getElementById("noteText").value.trim();
			if (!noteText) return;

			const result = await postAction("add_note", {
				contact_id: id,
				comment: noteText
			});

			if (!result.ok) {
				alert(result.text || "Failed to add note");
				return;
			}

			await loadContactDetails(id);
		});

		document.getElementById("assignMeBtn").addEventListener("click", async () => {
			const result = await postAction("assign_contact", { contact_id: id });
			if (!result.ok) {
				alert(result.text || "assign_contact not implemented yet");
				return;
			}
			await loadContactDetails(id);
		});

		document.getElementById("switchTypeBtn").addEventListener("click", async () => {
  			const result = await postAction("switch_type", { contact_id: id, type: nextType });
  			if (!result.ok) {
    			alert(result.text || "switch_type not implemented yet");
    			return;
  			}
  		await loadContactDetails(id);
	});

	} catch (err) {
		content.textContent = err.message || "Failed to load contact";
	}
}



/* New contact form */
async function loadNewContact() {
	content.innerHTML = `
		<div class="page-header">
			<div class="page-title">New Contact</div>
		</div>

		<div class="contact-form">
			<form id="newContactForm">
				<div class="form-row">
					<div class="form-group">
						<label for="title">Title</label>
						<select id="title" name="title" class="select-small">
							<option value="Mr">Mr</option>
							<option value="Ms">Ms</option>
							<option value="Mrs">Mrs</option>
							<option value="Dr">Dr</option>
						</select>
					</div>
				</div>

				<div class="form-grid">
					<div class="form-group">
						<label for="firstname">First Name</label>
						<input id="firstname" name="firstname" type="text" placeholder="Jane" required>
					</div>

					<div class="form-group">
						<label for="lastname">Last Name</label>
						<input id="lastname" name="lastname" type="text" placeholder="Doe" required>
					</div>

					<div class="form-group">
						<label for="emailC">Email</label>
						<input id="emailC" name="email" type="email" placeholder="something@example.com" required>
					</div>

					<div class="form-group">
						<label for="telephone">Telephone</label>
						<input
    						id="telephone" name="telephone" type="text" placeholder="123-456-7890" maxlength="12" required>
					</div>

					<div class="form-group">
						<label for="company">Company</label>
						<input id="company" name="company" type="text" required>
					</div>

					<div class="form-group">
						<label for="type">Type</label>
						<select id="type" name="type" required>
							<option value="" disabled selected>Select a type</option>
							<option value="Sales Lead">Sales Lead</option>
							<option value="Support">Support</option>
						</select>
					</div>
				</div>

				<div class="form-row">
					<div class="form-group">
						<label for="assigned_to">Assigned To</label>
						<select id="assigned_to" name="assigned_to" required>
							<option value="">Loading users.</option>
						</select>
					</div>
				</div>

				<div class="form-actions">
					<button class="btn btn-primary" type="submit">Save</button>
					<p id="newContactMsg" class="msg" aria-live="polite"></p>
				</div>
			</form>
		</div>
	`;

	// Populate Assigned To dropdown with users
	try {
		const users = await getJSON("dolphin.php?action=users_basic");
		const sel = document.getElementById("assigned_to");
		sel.innerHTML = `<option value="">Select a user</option>` + users
			.map(u => `<option value="${esc(u.id)}">${esc(u.firstname)} ${esc(u.lastname)}</option>`)
			.join("");
	} catch (err) {
		document.getElementById("newContactMsg").textContent =
			err.message || "Failed to load users for Assigned To";
	}

	const phoneInput = document.getElementById("telephone");
	phoneInput.addEventListener("input", () => {
  		let digits = phoneInput.value.replace(/\D/g, "").substring(0, 10);

  		if (digits.length > 6) {
    		phoneInput.value =
      			digits.slice(0, 3) + "-" +
      			digits.slice(3, 6) + "-" +
      			digits.slice(6);
  		} else if (digits.length > 3) {
    		phoneInput.value =
      			digits.slice(0, 3) + "-" +
      			digits.slice(3);
  		} else {
    		phoneInput.value = digits;
  		}
	});

	document.getElementById("newContactForm").addEventListener("submit", async (e) => {
		e.preventDefault();
		const msg = document.getElementById("newContactMsg");
		msg.textContent = "";

		const f = e.target;

		const phone = f.telephone.value.trim();
  		if (!/^\d{3}-\d{3}-\d{4}$/.test(phone)) {
    		msg.textContent = "Telephone is required and must be in the format XXX-XXX-XXXX";
    		msg.classList.remove("success");
    		f.telephone.focus();
    		return;
  		}

		const data = {
			title: f.title.value,
			firstname: f.firstname.value.trim(),
			lastname: f.lastname.value.trim(),
			email: f.email.value.trim(),
			telephone: f.telephone.value.trim(),
			company: f.company.value.trim(),
			type: f.type.value,
			assigned_to: f.assigned_to.value
		};

		const result = await postAction("create_contact", data);

		if (!result.ok) {
			msg.textContent = result.text || "Failed to add contact";
			msg.classList.remove("success");
			return;
		}

		msg.textContent = result.text || "Contact added successfully";
		msg.classList.add("success");

		f.reset();

		f.type.selectedIndex = 0;
  		f.assigned_to.selectedIndex = 0;
  		f.title.value = "Mr"; 
		
		setTimeout(() => {loadRoute("dashboard");}, 700);
	});
}



/* Router */
async function loadRoute(route) {
	const mainRoute = route.startsWith("contact:") ? null : route;
  	if (mainRoute) {
    	setActiveNav(mainRoute);
  	}

	if (route === "users" || route === "new-user") {
  		if (!isAdmin()) {
    		content.innerHTML = `
      			<div class="page-title">Access denied</div>
      			<p>Admins only.</p>
    		`;
    		return;
  		}
	}

	if (route === "dashboard") {
		await loadDashboard();
		return;
	}

	if (route === "users") {
		await loadUsers();
		return;
	}

	if (route === "new-contact") {
	await loadNewContact();
	return;
    }

	if (route === "new-user") {
	await loadNewUser();
	return;
	}

	if (route.startsWith("contact:")) {
		const id = route.split(":")[1];
		await loadContactDetails(id);
		return;
	}

	content.textContent = "Coming next: " + route;
}


/* Authentication events */
loginForm.addEventListener("submit", async (e) => {
	e.preventDefault();
	loginMsg.textContent = "";

	const email = loginForm.email.value.trim();
	const password = loginForm.password.value;

	const result = await postAction("login", { email, password });

	if (!result.ok) {
		loginMsg.textContent = result.text || "Login failed";
		return;
	}

	showApp();

	// load role info first
	await loadMe();
	applyRoleUI();

	// load dashboard after
	await loadRoute("dashboard");
});

logoutLink.addEventListener("click", async (e) => {
	e.preventDefault();

	await postAction("logout", {});
	showLogin();
	content.textContent = "";

	//clear login fields
	loginForm.reset();
	loginMsg.textContent = "";
});



/* Navigation events */
document.querySelectorAll("[data-route]").forEach((link) => {
	link.addEventListener("click", async (e) => {
		e.preventDefault();
		await loadRoute(link.dataset.route);
	});
});
