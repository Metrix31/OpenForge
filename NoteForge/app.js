class NoteForge {
    constructor() {
        this.notes = [];
        this.currentNoteIndex = null;

        this.DATA_FILE = "noteforge-notes";
        this.autosaveInterval = null;

        this.initializeElements();
        this.bindEvents();
        this.loadNotes();

        this.updateNotesList();
        this.updateNoteCount();
        this.updateButtonStates();
        this.updateEditorStats();

        this.startAutosave();
    }


    /* =====================================================
       Initialization
       ===================================================== */

    initializeElements() {
        this.elements = {
            newNoteBtn: document.getElementById("newNoteBtn"),
            deleteBtn: document.getElementById("deleteBtn"),
            deleteAllBtn: document.getElementById("deleteAllBtn"),

            colorBtn: document.getElementById("colorBtn"),
            tagsBtn: document.getElementById("tagsBtn"),
            favoriteBtn: document.getElementById("favoriteBtn"),
            favoriteFilterBtn: document.getElementById("favoriteFilterBtn"),

            searchInput: document.getElementById("searchInput"),
            notesList: document.getElementById("notesList"),

            noteTitle: document.getElementById("noteTitle"),
            noteStatus: document.getElementById("noteStatus"),

            editor: document.getElementById("editor"),

            noteCount: document.getElementById("noteCount"),

            wordCount: document.getElementById("wordCount"),
            characterCount: document.getElementById("characterCount"),

            statusText: document.getElementById("statusText"),
            statusIndicator: document.getElementById("statusIndicator")
        };
    }


    /* =====================================================
       Events
       ===================================================== */

    bindEvents() {

        this.elements.newNoteBtn.addEventListener(
            "click",
            () => this.newNote()
        );

        this.elements.deleteBtn.addEventListener(
            "click",
            () => this.deleteNote()
        );

        this.elements.deleteAllBtn.addEventListener(
            "click",
            () => this.deleteAllNotes()
        );

        this.elements.colorBtn.addEventListener(
            "click",
            () => this.changeColor()
        );

        this.elements.tagsBtn.addEventListener(
            "click",
            () => this.editTags()
        );

        this.elements.favoriteBtn.addEventListener(
            "click",
            () => this.toggleFavorite()
        );

        this.elements.favoriteFilterBtn.addEventListener(
            "click",
            () => this.toggleFavoriteFilter()
        );

        this.elements.editor.addEventListener(
            "input",
            () => this.onTextChange()
        );

        this.elements.noteTitle.addEventListener(
            "input",
            () => this.onTitleChange()
        );

        this.elements.searchInput.addEventListener(
            "input",
            event => this.searchNotes(event.target.value)
        );


        /* Keyboard shortcuts */

        document.addEventListener("keydown", event => {

            if (event.ctrlKey && event.key.toLowerCase() === "n") {
                event.preventDefault();
                this.newNote();
            }

            if (event.ctrlKey && event.key.toLowerCase() === "s") {
                event.preventDefault();
                this.saveNotes(true);
            }

            if (event.ctrlKey && event.key.toLowerCase() === "f") {
                event.preventDefault();

                this.elements.searchInput.focus();
                this.elements.searchInput.select();
            }

            if (
                event.ctrlKey &&
                event.key === "Delete" &&
                this.currentNoteIndex !== null
            ) {
                event.preventDefault();
                this.deleteNote();
            }
        });
    }


    /* =====================================================
       Notes
       ===================================================== */

    newNote() {

        const newNote = {
            title: "",
            content: "",
            tags: [],
            color: null,
            favorite: false,
            lastModified: Date.now()
        };

        this.notes.push(newNote);

        this.currentNoteIndex = this.notes.length - 1;

        this.updateNotesList();
        this.updateNoteCount();

        this.loadNoteToEditor(this.currentNoteIndex);

        this.updateButtonStates();
        this.updateEditorStats();

        this.elements.noteTitle.focus();

        this.saveNotes();
        this.setStatus("Neue Notiz erstellt");
    }


    deleteNote() {

        if (this.currentNoteIndex === null) {
            return;
        }

        const note = this.notes[this.currentNoteIndex];

        this.showConfirmModal(
            "Notiz löschen",
            `Möchtest du „${this.getNoteTitle(note)}“ wirklich löschen?`,
            () => {

                this.notes.splice(this.currentNoteIndex, 1);

                if (this.notes.length === 0) {

                    this.currentNoteIndex = null;

                    this.clearEditor();

                } else {

                    this.currentNoteIndex = Math.min(
                        this.currentNoteIndex,
                        this.notes.length - 1
                    );

                    this.loadNoteToEditor(
                        this.currentNoteIndex
                    );
                }

                this.updateNotesList();
                this.updateNoteCount();
                this.updateButtonStates();

                this.saveNotes();

                this.hideModal();

                this.setStatus("Notiz gelöscht");
            }
        );
    }


    deleteAllNotes() {

        if (this.notes.length === 0) {
            this.setStatus("Keine Notizen vorhanden");
            return;
        }

        this.showConfirmModal(
            "Alle Notizen löschen",
            `Möchtest du wirklich alle ${this.notes.length} Notizen löschen? Diese Aktion kann nicht rückgängig gemacht werden.`,
            () => {

                this.notes = [];
                this.currentNoteIndex = null;

                this.clearEditor();

                this.updateNotesList();
                this.updateNoteCount();
                this.updateButtonStates();

                this.saveNotes();

                this.hideModal();

                this.setStatus("Alle Notizen gelöscht");
            }
        );
    }


    clearEditor() {

        this.elements.noteTitle.value = "";
        this.elements.editor.value = "";

        this.elements.noteTitle.disabled = true;
        this.elements.editor.disabled = true;

        this.elements.noteStatus.textContent =
            "Keine Notiz ausgewählt";

        this.elements.editor.style.backgroundColor =
            "var(--bg-primary)";

        this.updateEditorStats();
    }


    /* =====================================================
       Loading / Editing
       ===================================================== */

    loadNoteToEditor(index) {

        const note = this.notes[index];

        if (!note) {
            return;
        }

        /*
         * Migration für ältere NoteForge-Versionen
         */
        if (!Array.isArray(note.tags)) {
            note.tags = [];
        }

        if (typeof note.favorite !== "boolean") {
            note.favorite = false;
        }

        if (!note.title) {
            note.title = "";
        }

        if (!("color" in note)) {
            note.color = null;
        }


        this.elements.noteTitle.value =
            note.title || "";

        this.elements.editor.value =
            note.content || "";

        this.elements.noteTitle.disabled = false;
        this.elements.editor.disabled = false;


        if (note.color) {
            this.elements.editor.style.backgroundColor =
                note.color;
        } else {
            this.elements.editor.style.backgroundColor =
                "var(--bg-primary)";
        }


        this.updateNoteStatus(note);
        this.updateButtonStates();
        this.updateEditorStats();
    }


    onTextChange() {

        if (this.currentNoteIndex === null) {
            return;
        }

        const note = this.notes[this.currentNoteIndex];

        note.content = this.elements.editor.value;
        note.lastModified = Date.now();

        this.updateNoteStatus(note);
        this.updateEditorStats();
        this.updateNotesList();

        this.setStatus("Ungespeicherte Änderungen");
    }


    onTitleChange() {

        if (this.currentNoteIndex === null) {
            return;
        }

        const note = this.notes[this.currentNoteIndex];

        note.title =
            this.elements.noteTitle.value;

        note.lastModified = Date.now();

        this.updateNoteStatus(note);
        this.updateNotesList();

        this.setStatus("Ungespeicherte Änderungen");
    }


    /* =====================================================
       Titles
       ===================================================== */

    getNoteTitle(note) {

        if (!note) {
            return "Unbenannte Notiz";
        }

        if (note.title && note.title.trim()) {
            return note.title.trim();
        }

        if (note.content && note.content.trim()) {

            const firstLine =
                note.content
                    .split("\n")[0]
                    .trim();

            if (firstLine) {
                return firstLine;
            }
        }

        return "Unbenannte Notiz";
    }


    /* =====================================================
       Notes List
       ===================================================== */

    updateNotesList(searchQuery = "") {

        this.elements.notesList.innerHTML = "";

        const query =
            searchQuery.trim().toLowerCase();


        const filteredNotes =
            this.notes.filter((note, index) => {

                if (
                    this.favoriteFilter &&
                    !note.favorite
                ) {
                    return false;
                }

                if (!query) {
                    return true;
                }

                const title =
                    this.getNoteTitle(note)
                        .toLowerCase();

                const content =
                    (note.content || "")
                        .toLowerCase();

                const tags =
                    (note.tags || [])
                        .join(" ")
                        .toLowerCase();

                return (
                    title.includes(query) ||
                    content.includes(query) ||
                    tags.includes(query)
                );
            });


        filteredNotes.forEach(note => {

            const originalIndex =
                this.notes.indexOf(note);

            const li =
                document.createElement("li");

            li.dataset.index =
                originalIndex;


            if (
                originalIndex ===
                this.currentNoteIndex
            ) {
                li.classList.add("active");
            }


            if (note.favorite) {
                li.classList.add("favorite");
            }


            const title =
                this.getNoteTitle(note);

            const displayTitle =
                title.length > 34
                    ? title.substring(0, 31) + "..."
                    : title;


            li.innerHTML = `
<span class="title">
    ${this.escapeHtml(displayTitle)}
</span>
`;


            li.addEventListener(
                "click",
                () => {

                    this.currentNoteIndex =
                        originalIndex;

                    this.loadNoteToEditor(
                        originalIndex
                    );

                    this.updateNotesList();

                    this.updateButtonStates();
                }
            );


            this.elements.notesList.appendChild(li);
        });


        if (
            filteredNotes.length === 0 &&
            this.notes.length > 0
        ) {

            const empty =
                document.createElement("li");

            empty.className = "empty-state";

            empty.textContent =
                "Keine passenden Notizen";

            this.elements.notesList.appendChild(
                empty
            );
        }
    }


    searchNotes(query) {
        this.updateNotesList(query);
    }


    /* =====================================================
       Favorites
       ===================================================== */

    favoriteFilter = false;


    toggleFavorite() {

        if (this.currentNoteIndex === null) {
            return;
        }

        const note =
            this.notes[this.currentNoteIndex];

        note.favorite =
            !note.favorite;

        note.lastModified =
            Date.now();

        this.updateNotesList();
        this.updateButtonStates();

        this.saveNotes();

        this.setStatus(
            note.favorite
                ? "Zu Favoriten hinzugefügt"
                : "Aus Favoriten entfernt"
        );
    }


    toggleFavoriteFilter() {

        this.favoriteFilter =
            !this.favoriteFilter;

        this.elements.favoriteFilterBtn.classList.toggle(
            "active",
            this.favoriteFilter
        );

        this.updateNotesList();

        this.setStatus(
            this.favoriteFilter
                ? "Favoriten werden angezeigt"
                : "Alle Notizen werden angezeigt"
        );
    }


    /* =====================================================
       Colors
       ===================================================== */

    changeColor() {

        if (this.currentNoteIndex === null) {
            return;
        }

        const colors = [
            {
                name: "Standard",
                value: null
            },
            {
                name: "Grün",
                value: "#10251d"
            },
            {
                name: "Blau",
                value: "#101b2b"
            },
            {
                name: "Violett",
                value: "#1c1629"
            },
            {
                name: "Rot",
                value: "#291516"
            },
            {
                name: "Orange",
                value: "#2a2115"
            },
            {
                name: "Grau",
                value: "#1a1e1d"
            }
        ];


        const overlay =
            document.createElement("div");

        overlay.className =
            "modal-overlay";

        overlay.id =
            "colorModal";


        overlay.innerHTML = `
<div class="modal color-modal">

    <h3>Notizfarbe</h3>

<p>
    Wähle eine Farbe für diese Notiz.
</p>

<div class="color-grid">

    ${colors.map(color => `
                        <button
                            class="color-option"
                            data-color="${color.value || ""}"
                            title="${color.name}"
                        >
                            <span
                                class="color-preview"
                                style="background:
                                    ${color.value || "var(--bg-primary)"};
                            "></span>

                            <span>
                                ${color.name}
                            </span>
                        </button>
                    `).join("")}

</div>

<div class="modal-buttons">

    <button
        class="modal-btn cancel"
    >
        Schließen
    </button>

</div>

</div>
`;


        document.body.appendChild(overlay);


        overlay
            .querySelectorAll(".color-option")
            .forEach(button => {

                button.addEventListener(
                    "click",
                    () => {

                        const color =
                            button.dataset.color ||
                            null;

                        this.notes[
                            this.currentNoteIndex
                        ].color = color;


                        this.elements.editor.style.backgroundColor =
                            color ||
                            "var(--bg-primary)";


                        this.saveNotes();

                        this.hideColorModal();

                        this.setStatus(
                            "Notizfarbe geändert"
                        );
                    }
                );
            });


        overlay
            .querySelector(".cancel")
            .addEventListener(
                "click",
                () => this.hideColorModal()
            );


        overlay.addEventListener(
            "click",
            event => {

                if (
                    event.target === overlay
                ) {
                    this.hideColorModal();
                }
            }
        );
    }


    hideColorModal() {

        const modal =
            document.getElementById(
                "colorModal"
            );

        if (modal) {
            modal.remove();
        }
    }


    /* =====================================================
       Tags
       ===================================================== */

    editTags() {

        if (this.currentNoteIndex === null) {
            return;
        }

        const note =
            this.notes[this.currentNoteIndex];

        const currentTags =
            note.tags.join(", ");


        const newTags =
            prompt(
                "Tags (durch Komma getrennt):",
                currentTags
            );


        if (newTags === null) {
            return;
        }


        note.tags =
            newTags
                .split(",")
                .map(tag => tag.trim())
                .filter(Boolean);


        note.lastModified =
            Date.now();


        this.updateNotesList();
        this.saveNotes();

        this.setStatus("Tags aktualisiert");
    }


    /* =====================================================
       Button States
       ===================================================== */

    updateButtonStates() {

        const hasSelection =
            this.currentNoteIndex !== null &&
            !!this.notes[this.currentNoteIndex];


        const buttons = [
            this.elements.deleteBtn,
            this.elements.colorBtn,
            this.elements.tagsBtn,
            this.elements.favoriteBtn
        ];


        buttons.forEach(button => {

            button.disabled =
                !hasSelection;

        });


        if (!hasSelection) {

            this.elements.favoriteBtn.textContent =
                "☆";

            return;
        }


        const note =
            this.notes[this.currentNoteIndex];


        this.elements.favoriteBtn.textContent =
            note.favorite
                ? "★"
                : "☆";


        this.elements.favoriteBtn.title =
            note.favorite
                ? "Favorit entfernen"
                : "Zu Favoriten hinzufügen";


        this.elements.favoriteBtn.style.color =
            note.favorite
                ? "var(--accent)"
                : "";
    }


    /* =====================================================
       Status / Statistics
       ===================================================== */

    updateNoteStatus(note) {

        if (!note) {
            this.elements.noteStatus.textContent =
                "Keine Notiz ausgewählt";

            return;
        }

        const date =
            new Date(note.lastModified);

        this.elements.noteStatus.textContent =
            `Zuletzt geändert: ${date.toLocaleTimeString(
    "de-DE",
    {
        hour: "2-digit",
        minute: "2-digit"
    }
)}`;
    }


    updateEditorStats() {

        const text =
            this.elements.editor.value || "";


        const characters =
            text.length;


        const words =
            text.trim()
                ? text.trim().split(/\s+/).length
                : 0;


        this.elements.wordCount.textContent =
            `${words} ${words === 1 ? "Wort" : "Wörter"}`;


        this.elements.characterCount.textContent =
            `${characters} ${characters === 1 ? "Zeichen" : "Zeichen"}`;
    }


    updateNoteCount() {

        this.elements.noteCount.textContent =
            this.notes.length;
    }


    /* =====================================================
       Confirmation Modal
       ===================================================== */

    showConfirmModal(
        title,
        message,
        onConfirm
    ) {

        this.hideModal();


        const overlay =
            document.createElement("div");

        overlay.className =
            "modal-overlay";

        overlay.id =
            "confirmModal";


        overlay.innerHTML = `
<div class="modal">

    <h3>${this.escapeHtml(title)}</h3>

<p>${this.escapeHtml(message)}</p>

<div class="modal-buttons">

    <button
        class="modal-btn confirm"
    >
        Löschen
    </button>

    <button
        class="modal-btn cancel"
    >
        Abbrechen
    </button>

</div>

</div>
`;


        document.body.appendChild(
            overlay
        );


        overlay
            .querySelector(".confirm")
            .addEventListener(
                "click",
                onConfirm
            );


        overlay
            .querySelector(".cancel")
            .addEventListener(
                "click",
                () => this.hideModal()
            );


        overlay.addEventListener(
            "click",
            event => {

                if (
                    event.target === overlay
                ) {
                    this.hideModal();
                }
            }
        );
    }


    hideModal() {

        const modal =
            document.getElementById(
                "confirmModal"
            );

        if (modal) {
            modal.remove();
        }
    }


    /* =====================================================
       Storage
       ===================================================== */

    loadNotes() {

        try {

            const saved =
                localStorage.getItem(
                    this.DATA_FILE
                );


            if (!saved) {
                return;
            }


            const parsed =
                JSON.parse(saved);


            if (Array.isArray(parsed)) {

                this.notes =
                    parsed.map(note => ({
                        title: note.title || "",
                        content: note.content || "",
                        tags: Array.isArray(note.tags)
                            ? note.tags
                            : [],
                        color:
                            "color" in note
                                ? note.color
                                : null,
                        favorite:
                            Boolean(note.favorite),
                        lastModified:
                            note.lastModified ||
                            Date.now()
                    }));
            }

        } catch (error) {

            console.error(
                "Fehler beim Laden der Notizen:",
                error
            );

            this.notes = [];

            this.setStatus(
                "Notizen konnten nicht geladen werden"
            );
        }
    }


    saveNotes(manual = false) {

        try {

            localStorage.setItem(
                this.DATA_FILE,
                JSON.stringify(this.notes)
            );


            if (manual) {
                this.setStatus(
                    "Gespeichert"
                );
            }

        } catch (error) {

            console.error(
                "Fehler beim Speichern:",
                error
            );

            this.setStatus(
                "Fehler beim Speichern"
            );
        }
    }


    /* =====================================================
       Autosave
       ===================================================== */

    startAutosave() {

        this.autosaveInterval =
            setInterval(
                () => {

                    this.saveNotes();

                    this.setStatus(
                        `Automatisch gespeichert um ${new Date().toLocaleTimeString(
    "de-DE"
)}`
                    );

                },
                30000
            );


        this.setStatus(
            "Bereit"
        );
    }


    /* =====================================================
       Status
       ===================================================== */

    setStatus(message) {

        this.elements.statusText.textContent =
            message;


        if (
            this.elements.statusIndicator
        ) {

            this.elements.statusIndicator.style.background =
                "var(--accent)";
        }
    }


    /* =====================================================
       Security / Utility
       ===================================================== */

    escapeHtml(value) {

        return String(value)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }
}


/* =========================================================
   Start Application
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {
        window.noteForge =
            new NoteForge();
    }
);
